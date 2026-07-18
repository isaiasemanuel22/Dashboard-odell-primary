import { ServiceType } from '../common/enums';
import {
  mergeProfitMargins,
  normalizeProfitMargins,
} from './profit-margins.util';

describe('profit-margins.util', () => {
  it('normaliza claves y convierte strings numéricos', () => {
    expect(
      normalizeProfitMargins({
        impresion_3d: '55',
        estampado: 25,
      }),
    ).toEqual({
      impresion_3d: 55,
      diseno: 50,
      estampado: 25,
    });
  });

  it('combina parches sin perder otros servicios', () => {
    expect(
      mergeProfitMargins(
        { impresion_3d: 40, diseno: 50, estampado: 35 },
        { [ServiceType.IMPRESION_3D]: 60 },
      ),
    ).toEqual({
      impresion_3d: 60,
      diseno: 50,
      estampado: 35,
    });
  });
});
