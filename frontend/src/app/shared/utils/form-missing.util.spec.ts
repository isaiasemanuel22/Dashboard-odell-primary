import { PaperType } from '../../core/models';
import type {
  EstampadoPrintSpec,
  EstampadoSupplyLine,
} from '../../core/models';
import {
  estampadoMissingLabels,
  fixedPriceMissingLabels,
  formatMissingSummary,
  pickMissingControl,
  scrollToField,
} from './form-missing.util';

const print = (over: Partial<EstampadoPrintSpec> = {}): EstampadoPrintSpec => ({
  id: 'p1',
  paperType: PaperType.DTF,
  quantity: 1,
  ...over,
});
const supply = (supplyId: string): EstampadoSupplyLine => ({
  id: 's1',
  supplyId,
  quantity: 1,
  colorId: 'indistinto',
});

describe('form-missing.util', () => {
  it('formatMissingSummary singular y plural', () => {
    expect(formatMissingSummary([])).toBe('');
    expect(formatMissingSummary(['categoría'])).toBe('Falta: categoría');
    expect(formatMissingSummary(['a', 'b'])).toBe('Faltan: a · b');
  });

  it('precio fijo vacío o en 0 es faltante; calculado o con precio no', () => {
    expect(fixedPriceMissingLabels(true, null)).toEqual(['precio fijo']);
    expect(fixedPriceMissingLabels(true, 0)).toEqual(['precio fijo']);
    expect(fixedPriceMissingLabels(true, 1500)).toEqual([]);
    expect(fixedPriceMissingLabels(false, null)).toEqual([]);
  });

  it('estampado: impreso sin medida e insumo sin elegir', () => {
    expect(estampadoMissingLabels([print()], [])).toEqual([
      'medida del impreso',
    ]);
    expect(
      estampadoMissingLabels(
        [print({ widthCm: 10, lengthCm: 5 })],
        [supply('')],
      ),
    ).toEqual(['insumo']);
    expect(
      estampadoMissingLabels(
        [print({ widthCm: 10, lengthCm: 5 })],
        [supply('sup-1')],
      ),
    ).toEqual([]);
    expect(estampadoMissingLabels(null, undefined)).toEqual([]);
  });

  it('scrollToField enfoca el input interno y devuelve false si no existe', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-missing="name"><input id="i" /></div>';
    document.body.appendChild(root);
    expect(scrollToField(root, '[data-missing="name"]')).toBeTrue();
    expect(document.activeElement?.id).toBe('i');
    expect(scrollToField(root, '[data-missing="nada"]')).toBeFalse();
    root.remove();
  });

  it('pickMissingControl elige el campo vacío y, si no, el primero; también por etiqueta', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<input aria-label="Gramos" value="10" id="a"><input aria-label="Gramos" value="0" id="b">' +
      '<label for="c">Peso</label><input id="c" value="">';
    expect(pickMissingControl(root, 'input[aria-label="Gramos"]')?.id).toBe(
      'b',
    );
    expect(
      pickMissingControl(root, 'input[aria-label="Nada"]', 'Peso')?.id,
    ).toBe('c');
    expect(pickMissingControl(root, 'input[aria-label="Nada"]')).toBeNull();
  });
});
