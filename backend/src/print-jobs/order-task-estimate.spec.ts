import { ServiceType, TaskType } from '../common/enums';
import { estimateTaskHours } from './order-task-estimate';

describe('estimateTaskHours diseño y modelado', () => {
  it('usa las horas cotizadas', () => {
    expect(
      estimateTaskHours(
        {
          serviceType: ServiceType.MODELADO,
          productName: 'Pieza',
          quantity: 1,
          unitPrice: 1000,
          budgetedHours: 3,
        },
        TaskType.SERVICE,
      ),
    ).toBe(3);
  });

  it('sin horas cotizadas mantiene el valor por defecto', () => {
    expect(
      estimateTaskHours(
        {
          serviceType: ServiceType.DISENO_GRAFICO,
          productName: 'Logo',
          quantity: 1,
          unitPrice: 1000,
        },
        TaskType.SERVICE,
      ),
    ).toBe(4);
  });
});
