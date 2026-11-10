import { strFromU8, unzipSync } from 'fflate';

export const BAMBU_3MF_READ_ERROR =
  'No pudimos leer el archivo. Subí un .3mf guardado desde Bambu Studio';

export const BAMBU_3MF_NOT_SLICED_WARNING =
  'El archivo no está sliceado: completá gramos y horas a mano o subí el que guardás después de slicear en Bambu Studio';

export interface Bambu3mfFilament {
  index: number;
  type: string;
  color: string;
  grams: number | null;
}

export interface Bambu3mfParseResult {
  slicer: 'bambu' | 'otro';
  sliced: boolean;
  plate: number;
  plateCount: number;
  printHours: number | null;
  totalGrams: number | null;
  filaments: Bambu3mfFilament[];
  colorChanges: number | null;
  purgeGrams: number | null;
  warnings: string[];
}

const METADATA_ALLOW = new Set([
  'Metadata/slice_info.config',
  'Metadata/project_settings.config',
  'Metadata/model_settings.config',
  'Metadata/plate_1.gcode',
]);

function isAllowedMetadataPath(name: string): boolean {
  if (METADATA_ALLOW.has(name)) return true;
  return /^Metadata\/plate_\d+\.json$/.test(name);
}

/**
 * used_g de cada filamento: por ahora asumimos que NO incluye la purga
 * (solo la pieza). Se valida con un .3mf real sliceado.
 */
export function mapUsedGrams(
  usedG: number | null,
  _purgeGrams: number | null,
): number | null {
  return usedG;
}

export async function parseBambu3mfFile(
  source: File | ArrayBuffer | Uint8Array,
): Promise<Bambu3mfParseResult> {
  const bytes = await toUint8(source);
  return parseBambu3mfBytes(bytes);
}

export function parseBambu3mfBytes(bytes: Uint8Array): Bambu3mfParseResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => isAllowedMetadataPath(file.name),
    });
  } catch {
    throw new Error(BAMBU_3MF_READ_ERROR);
  }

  if (!Object.keys(files).length) {
    throw new Error(BAMBU_3MF_READ_ERROR);
  }

  const sliceInfo = readText(files, 'Metadata/slice_info.config');
  const projectSettings = readText(files, 'Metadata/project_settings.config');
  const gcode = readText(files, 'Metadata/plate_1.gcode');
  const warnings: string[] = [];

  const slicer = detectSlicer(sliceInfo, projectSettings, files);
  const plates = parseSlicePlates(sliceInfo);
  const plateCount = Math.max(1, plates.length || countPlateJson(files) || 1);

  if (plates.length > 1) {
    warnings.push(
      `El archivo tiene ${plates.length} placas; usamos la placa 1`,
    );
  }

  const plate = plates.find((p) => p.index === 1) ?? plates[0] ?? null;
  const settings = parseProjectSettings(projectSettings);

  if (!plate) {
    const filaments = filamentsFromSettings(settings);
    return {
      slicer,
      sliced: false,
      plate: 1,
      plateCount,
      printHours: null,
      totalGrams: null,
      filaments,
      colorChanges: null,
      purgeGrams: null,
      warnings: [...warnings, BAMBU_3MF_NOT_SLICED_WARNING],
    };
  }

  const colorChanges = gcode ? countToolChanges(gcode) : null;
  const purgeFromGcode = gcode ? parsePurgeGramsFromGcode(gcode) : null;
  const purgeGrams =
    purgeFromGcode != null
      ? round1(purgeFromGcode)
      : estimatePurgeGrams(settings, colorChanges, gcode);

  const filaments = plate.filaments.map((f) => ({
    index: f.index,
    type: f.type,
    color: normalizeHex(f.color),
    grams: mapUsedGrams(f.usedG, purgeGrams),
  }));

  const totalFromFilaments = filaments.reduce(
    (sum, f) => sum + (Number(f.grams) || 0),
    0,
  );
  const totalGrams =
    plate.weight != null
      ? round1(plate.weight)
      : totalFromFilaments > 0
        ? round1(totalFromFilaments)
        : null;

  return {
    slicer,
    sliced: true,
    plate: plate.index,
    plateCount,
    printHours:
      plate.predictionSeconds != null
        ? roundHours(plate.predictionSeconds / 3600)
        : null,
    totalGrams,
    filaments,
    colorChanges,
    purgeGrams,
    warnings,
  };
}

async function toUint8(
  source: File | ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  const buf = await source.arrayBuffer();
  return new Uint8Array(buf);
}

function readText(
  files: Record<string, Uint8Array>,
  path: string,
): string | null {
  const data = files[path];
  if (!data) return null;
  return strFromU8(data);
}

function detectSlicer(
  sliceInfo: string | null,
  projectSettings: string | null,
  files: Record<string, Uint8Array>,
): 'bambu' | 'otro' {
  const blob = `${sliceInfo ?? ''}\n${projectSettings ?? ''}`;
  if (/bambu|BambuStudio|BBL_/i.test(blob)) return 'bambu';
  if (files['Metadata/plate_1.gcode'] || /flush_volumes_matrix/.test(blob)) {
    return 'bambu';
  }
  return 'otro';
}

interface SlicePlate {
  index: number;
  predictionSeconds: number | null;
  weight: number | null;
  filaments: Array<{
    index: number;
    type: string;
    color: string;
    usedG: number | null;
  }>;
}

function parseSlicePlates(xml: string | null): SlicePlate[] {
  if (!xml || !/<plate[\s>]/i.test(xml)) return [];
  const plates: SlicePlate[] = [];
  const plateRe = /<plate\b[^>]*>([\s\S]*?)<\/plate>/gi;
  let match: RegExpExecArray | null;
  let fallbackIndex = 1;
  while ((match = plateRe.exec(xml))) {
    const body = match[1] ?? '';
    const index =
      Number(metaValue(body, 'index')) ||
      Number(attr(match[0], 'index')) ||
      fallbackIndex;
    fallbackIndex += 1;
    const prediction = Number(metaValue(body, 'prediction'));
    const weight = Number(metaValue(body, 'weight'));
    const filaments: SlicePlate['filaments'] = [];
    const filamentRe = /<filament\b([^>]*)\/?>/gi;
    let fMatch: RegExpExecArray | null;
    let fIndex = 1;
    while ((fMatch = filamentRe.exec(body))) {
      const attrs = fMatch[1] ?? '';
      const id = Number(attr(attrs, 'id')) || fIndex;
      const type = attr(attrs, 'type') || 'PLA';
      const color = attr(attrs, 'color') || '#000000';
      const usedGRaw = attr(attrs, 'used_g');
      const usedG =
        usedGRaw != null && usedGRaw !== ''
          ? Number(usedGRaw)
          : null;
      filaments.push({
        index: id,
        type,
        color: normalizeHex(color),
        usedG: Number.isFinite(usedG as number) ? (usedG as number) : null,
      });
      fIndex += 1;
    }
    plates.push({
      index,
      predictionSeconds: Number.isFinite(prediction) ? prediction : null,
      weight: Number.isFinite(weight) ? weight : null,
      filaments,
    });
  }
  return plates;
}

function metaValue(body: string, key: string): string | null {
  const re = new RegExp(
    `<metadata\\b[^>]*\\bkey=["']${key}["'][^>]*\\bvalue=["']([^"']*)["']`,
    'i',
  );
  const m = body.match(re);
  if (m?.[1] != null) return m[1];
  const re2 = new RegExp(
    `<metadata\\b[^>]*\\bvalue=["']([^"']*)["'][^>]*\\bkey=["']${key}["']`,
    'i',
  );
  return body.match(re2)?.[1] ?? null;
}

function attr(source: string, name: string): string | null {
  const re = new RegExp(`\\b${name}=["']([^"']*)["']`, 'i');
  return source.match(re)?.[1] ?? null;
}

interface ProjectSettings {
  filamentTypes: string[];
  filamentColours: string[];
  filamentDensities: number[];
  flushMatrix: number[];
  flushMultiplier: number;
  matrixSize: number;
}

function parseProjectSettings(raw: string | null): ProjectSettings {
  const empty: ProjectSettings = {
    filamentTypes: [],
    filamentColours: [],
    filamentDensities: [],
    flushMatrix: [],
    flushMultiplier: 1,
    matrixSize: 0,
  };
  if (!raw) return empty;
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const filamentTypes = asStringArray(json['filament_type']);
    const filamentColours = asStringArray(json['filament_colour']).map(
      normalizeHex,
    );
    const filamentDensities = asNumberArray(json['filament_density']).map(
      (n) => (n > 0 ? n : 1.24),
    );
    const flushMatrix = asNumberArray(json['flush_volumes_matrix']);
    const flushMultiplierRaw = json['flush_multiplier'];
    let flushMultiplier = 1;
    if (Array.isArray(flushMultiplierRaw)) {
      flushMultiplier = Number(flushMultiplierRaw[0]) || 1;
    } else if (flushMultiplierRaw != null) {
      flushMultiplier = Number(flushMultiplierRaw) || 1;
    }
    const matrixSize = Math.floor(Math.sqrt(flushMatrix.length));
    return {
      filamentTypes,
      filamentColours,
      filamentDensities,
      flushMatrix,
      flushMultiplier,
      matrixSize,
    };
  } catch {
    return empty;
  }
}

function filamentsFromSettings(settings: ProjectSettings): Bambu3mfFilament[] {
  const count = Math.max(
    settings.filamentTypes.length,
    settings.filamentColours.length,
    0,
  );
  if (!count) return [];
  const out: Bambu3mfFilament[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      index: i + 1,
      type: settings.filamentTypes[i] || 'PLA',
      color: normalizeHex(settings.filamentColours[i] || '#000000'),
      grams: null,
    });
  }
  return out;
}

function countPlateJson(files: Record<string, Uint8Array>): number {
  return Object.keys(files).filter((name) =>
    /^Metadata\/plate_\d+\.json$/.test(name),
  ).length;
}

/** Cuenta cambios de herramienta: M620 S<n> o T<n>, sin la carga inicial. */
export function countToolChanges(gcode: string): number {
  const lines = gcode.split(/\r?\n/);
  let previous: number | null = null;
  let changes = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;
    const m620 = trimmed.match(/^M620\b[^;]*\bS(\d+)/i);
    const tMatch = !m620 ? trimmed.match(/^T(\d+)\b/i) : null;
    const tool = m620
      ? Number(m620[1])
      : tMatch
        ? Number(tMatch[1])
        : null;
    if (tool == null || !Number.isFinite(tool)) continue;
    if (previous == null) {
      previous = tool;
      continue;
    }
    if (tool !== previous) {
      changes += 1;
      previous = tool;
    }
  }
  return changes;
}

/**
 * Busca un total de flush/purga en gramos en comentarios de cabecera.
 * Si no hay, null.
 */
export function parsePurgeGramsFromGcode(gcode: string): number | null {
  const header = gcode.slice(0, 200_000);
  const patterns = [
    /;\s*(?:total[_\s-]?)?(?:flush|purge)[_\s-]?(?:weight|grams?|g)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i,
    /;\s*flush_volume_to_filament_weight\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i,
    /;\s*total flush weight\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)\s*g/i,
  ];
  for (const re of patterns) {
    const m = header.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return null;
}

function estimatePurgeGrams(
  settings: ProjectSettings,
  colorChanges: number | null,
  gcode: string | null,
): number | null {
  if (!settings.flushMatrix.length || settings.matrixSize < 2) {
    return null;
  }

  let volumeMm3 = 0;
  if (gcode) {
    const transitions = listToolTransitions(gcode);
    if (!transitions.length) {
      // Gcode sin cambios → purga 0 (no hay AMS flush).
      return 0;
    }
    for (const { from, to } of transitions) {
      volumeMm3 += flushVolume(settings, from, to);
    }
  } else if (colorChanges != null && colorChanges > 0) {
    // Sin secuencia: promedio de la matriz (fuera de diagonal) × cambios.
    const avg = averageOffDiagonal(settings);
    if (avg == null) return null;
    volumeMm3 = avg * colorChanges;
  } else {
    // Sin gcode ni cambios conocidos: no inventamos purga.
    return null;
  }

  const density = averageDensity(settings);
  // mm³ × g/cm³ / 1000 = g  (1 cm³ = 1000 mm³)
  const grams = (volumeMm3 * settings.flushMultiplier * density) / 1000;
  return round1(grams);
}

function listToolTransitions(
  gcode: string,
): Array<{ from: number; to: number }> {
  const lines = gcode.split(/\r?\n/);
  let previous: number | null = null;
  const out: Array<{ from: number; to: number }> = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;
    const m620 = trimmed.match(/^M620\b[^;]*\bS(\d+)/i);
    const tMatch = !m620 ? trimmed.match(/^T(\d+)\b/i) : null;
    const tool = m620
      ? Number(m620[1])
      : tMatch
        ? Number(tMatch[1])
        : null;
    if (tool == null || !Number.isFinite(tool)) continue;
    if (previous == null) {
      previous = tool;
      continue;
    }
    if (tool !== previous) {
      out.push({ from: previous, to: tool });
      previous = tool;
    }
  }
  return out;
}

function flushVolume(
  settings: ProjectSettings,
  fromTool: number,
  toTool: number,
): number {
  const n = settings.matrixSize;
  if (fromTool < 0 || toTool < 0 || fromTool >= n || toTool >= n) return 0;
  return Math.max(0, Number(settings.flushMatrix[fromTool * n + toTool]) || 0);
}

function averageOffDiagonal(settings: ProjectSettings): number | null {
  const n = settings.matrixSize;
  if (n < 2) return null;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      sum += Math.max(0, Number(settings.flushMatrix[i * n + j]) || 0);
      count += 1;
    }
  }
  return count ? sum / count : null;
}

function averageDensity(settings: ProjectSettings): number {
  if (!settings.filamentDensities.length) return 1.24;
  const sum = settings.filamentDensities.reduce((a, b) => a + b, 0);
  return sum / settings.filamentDensities.length;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? ''));
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item) || 0);
}

function normalizeHex(value: string): string {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{8}$/.test(cleaned)) {
    // Bambu a veces manda RRGGBBAA
    return `#${cleaned.slice(0, 6).toUpperCase()}`;
  }
  return '#000000';
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Mapea el tipo de Bambu al FilamentType del catálogo (código). */
export function mapBambuFilamentType(raw: string): string {
  const text = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!text) return 'pla';
  if (/\bpetg\b/.test(text)) return 'petg';
  if (/\btpu\b/.test(text)) return 'tpu';
  if (/\babs\b/.test(text)) return 'abs';
  if (/\basa\b/.test(text)) return 'asa';
  if (/\bnylon\b|pa\b/.test(text)) return 'nylon';
  if (/\bpla\b/.test(text)) return 'pla';
  return 'otro';
}
