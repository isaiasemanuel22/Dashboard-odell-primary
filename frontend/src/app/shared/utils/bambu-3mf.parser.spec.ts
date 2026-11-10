import { strToU8, zipSync } from 'fflate';
import {
  BAMBU_3MF_NOT_SLICED_WARNING,
  BAMBU_3MF_READ_ERROR,
  countToolChanges,
  mapUsedGrams,
  parseBambu3mfBytes,
  parsePurgeGramsFromGcode,
} from './bambu-3mf.parser';

function zipFrom(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] = strToU8(content);
  }
  return zipSync(entries);
}

const PROJECT_SETTINGS_2 = JSON.stringify({
  filament_type: ['PLA', 'PETG'],
  filament_colour: ['#111111', '#B91C1C'],
  filament_density: ['1.24', '1.27'],
  flush_volumes_matrix: [0, 800, 700, 0],
  flush_multiplier: [1],
});

const SLICE_INFO_2 = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="15120"/>
    <metadata key="weight" value="55"/>
    <filament id="1" type="PLA" color="#111111" used_g="38" used_m="12"/>
    <filament id="2" type="PETG" color="#B91C1C" used_g="17" used_m="6"/>
  </plate>
</config>`;

const GCODE_WITH_CHANGES = `; HEADER
; total flush weight = 9.0 g
G28
M620 S0
T0
G1 X10
M620 S1
T1
G1 X20
M620 S0
T0
G1 X30
`;

describe('bambu-3mf.parser', () => {
  it('lee un Bambu sliceado con 2 colores y gcode', () => {
    const bytes = zipFrom({
      'Metadata/slice_info.config': SLICE_INFO_2,
      'Metadata/project_settings.config': PROJECT_SETTINGS_2,
      'Metadata/plate_1.json': '{"index":1}',
      'Metadata/plate_1.gcode': GCODE_WITH_CHANGES,
      // El modelo 3D no debe descomprimirse; lo incluimos solo para el zip.
      '3D/3dmodel.model': 'HUGE'.repeat(1000),
    });

    const result = parseBambu3mfBytes(bytes);
    expect(result.sliced).toBe(true);
    expect(result.slicer).toBe('bambu');
    expect(result.plate).toBe(1);
    expect(result.plateCount).toBe(1);
    expect(result.printHours).toBe(4.2);
    expect(result.totalGrams).toBe(55);
    expect(result.filaments.length).toBe(2);
    expect(result.filaments[0].grams).toBe(38);
    expect(result.filaments[1].grams).toBe(17);
    expect(result.colorChanges).toBe(2);
    expect(result.purgeGrams).toBe(9);
    expect(mapUsedGrams(38, 9)).toBe(38);
  });

  it('estima purga desde la matriz si no hay total en el gcode', () => {
    const gcode = `
G28
M620 S0
T0
M620 S1
T1
M620 S0
T0
`;
    const bytes = zipFrom({
      'Metadata/slice_info.config': SLICE_INFO_2,
      'Metadata/project_settings.config': PROJECT_SETTINGS_2,
      'Metadata/plate_1.gcode': gcode,
    });
    const result = parseBambu3mfBytes(bytes);
    // cambios 0→1 (800) + 1→0 (700) = 1500 mm³ × 1 × ~1.255 / 1000 ≈ 1.9
    expect(result.colorChanges).toBe(2);
    expect(result.purgeGrams).toBeGreaterThan(0);
    expect(result.purgeGrams).toBeLessThan(5);
  });

  it('sliceado sin gcode: colorChanges null y purga estimada si hay matriz', () => {
    const bytes = zipFrom({
      'Metadata/slice_info.config': SLICE_INFO_2,
      'Metadata/project_settings.config': PROJECT_SETTINGS_2,
    });
    const result = parseBambu3mfBytes(bytes);
    expect(result.sliced).toBe(true);
    expect(result.colorChanges).toBeNull();
    // Sin cambios conocidos → null (no inventa cambios)
    expect(result.purgeGrams).toBeNull();
  });

  it('sin slicear: warning y colores desde project_settings', () => {
    const bytes = zipFrom({
      'Metadata/project_settings.config': PROJECT_SETTINGS_2,
      'Metadata/model_settings.config': '<config/>',
    });
    const result = parseBambu3mfBytes(bytes);
    expect(result.sliced).toBe(false);
    expect(result.printHours).toBeNull();
    expect(result.totalGrams).toBeNull();
    expect(result.filaments.length).toBe(2);
    expect(result.filaments[0].type).toBe('PLA');
    expect(result.filaments[0].grams).toBeNull();
    expect(result.warnings).toContain(BAMBU_3MF_NOT_SLICED_WARNING);
  });

  it('varias placas: usa la 1 y avisa', () => {
    const multi = `<?xml version="1.0"?>
<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="3600"/>
    <metadata key="weight" value="10"/>
    <filament id="1" type="PLA" color="#000000" used_g="10" used_m="3"/>
  </plate>
  <plate>
    <metadata key="index" value="2"/>
    <metadata key="prediction" value="7200"/>
    <metadata key="weight" value="20"/>
    <filament id="1" type="PLA" color="#FFFFFF" used_g="20" used_m="6"/>
  </plate>
</config>`;
    const bytes = zipFrom({
      'Metadata/slice_info.config': multi,
      'Metadata/project_settings.config': PROJECT_SETTINGS_2,
      'Metadata/plate_1.json': '{}',
      'Metadata/plate_2.json': '{}',
    });
    const result = parseBambu3mfBytes(bytes);
    expect(result.plate).toBe(1);
    expect(result.plateCount).toBe(2);
    expect(result.totalGrams).toBe(10);
    expect(result.warnings.some((w) => w.includes('2 placas'))).toBe(true);
  });

  it('archivo inválido lanza el mensaje de lectura', () => {
    expect(() => parseBambu3mfBytes(new Uint8Array([1, 2, 3, 4]))).toThrowError(
      BAMBU_3MF_READ_ERROR,
    );
  });

  it('cuenta cambios de herramienta sin la carga inicial', () => {
    expect(countToolChanges('T0\nT1\nT0\n')).toBe(2);
    expect(countToolChanges('M620 S0\nM620 S1\nM620 S1\nM620 S2\n')).toBe(2);
  });

  it('lee purga en gramos desde comentarios del gcode', () => {
    expect(
      parsePurgeGramsFromGcode('; total flush weight = 12.5 g\nG28\n'),
    ).toBe(12.5);
  });
});
