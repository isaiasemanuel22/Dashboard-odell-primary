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
      diseno_grafico: 50,
      modelado: 50,
      estampado: 25,
    });
  });

  it('migra el margen legacy de diseno a ambos servicios creativos', () => {
    expect(
      normalizeProfitMargins({
        impresion_3d: 40,
        diseno: 65,
        estampado: 35,
      }),
    ).toEqual({
      impresion_3d: 40,
      diseno_grafico: 65,
      modelado: 65,
      estampado: 35,
    });
  });

  it('combina parches sin perder otros servicios', () => {
    expect(
      mergeProfitMargins(
        {
          impresion_3d: 40,
          diseno_grafico: 50,
          modelado: 45,
          estampado: 35,
        },
        { [ServiceType.IMPRESION_3D]: 60 },
      ),
    ).toEqual({
      impresion_3d: 60,
      diseno_grafico: 50,
      modelado: 45,
      estampado: 35,
    });
  });
});
