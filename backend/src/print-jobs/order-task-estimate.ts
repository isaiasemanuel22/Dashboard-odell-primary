import { ProductType, ServiceType, TaskType } from '../common/enums';
import { OrderItem, Product, Product3D } from '../common/interfaces';
import {
  designPrintMachineLabel,
  designPrintTaskName,
  isDesignPrintConfigured,
} from '../orders/design-print.util';

export function productionTaskName(item: OrderItem, quantity?: number): string {
  if (isDesignPrintConfigured(item)) {
    return designPrintTaskName({
      ...item,
      productionRequiredQuantity: quantity ?? item.productionRequiredQuantity,
    });
  }
  const qty = quantity ?? item.productionRequiredQuantity ?? item.quantity;
  return `Hacer ${qty} ${item.productName}`;
}

export function calcTaskPriority(dueDate: string): number {
  const days =
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days <= 3) return 3;
  if (days <= 7) return 2;
  return 1;
}

export function defaultTaskMachine(item: OrderItem, taskType: TaskType = TaskType.SERVICE, products: Product[] = []): string {
  if (
    taskType === TaskType.PRODUCTION &&
    isDesignPrintConfigured(item)
  ) {
    return designPrintMachineLabel(item.printPaperType);
  }

  if (item.serviceType === ServiceType.MODELADO) {
    return 'Modelado 3D';
  }
  if (item.serviceType === ServiceType.DISENO_GRAFICO) {
    return 'Diseño gráfico';
  }

  if (item.serviceType === ServiceType.IMPRESION_3D) {
    if (item.productId) {
      const product = products.find((p) => p.id === item.productId);
      if (product?.type === ProductType.RESINA) return 'Impresora resina';
    }
    return 'Impresora FDM';
  }

  return 'Estampado';
}

export function estimateTaskHours(item: OrderItem, taskType: TaskType = TaskType.SERVICE, products: Product[] = []): number {
  if (
    taskType === TaskType.PRODUCTION &&
    isDesignPrintConfigured(item)
  ) {
    return Math.max(1, item.quantity);
  }

  if (item.printTimeHours) {
    return Math.max(
      1,
      Math.ceil(Number(item.printTimeHours) * item.quantity),
    );
  }

  if (item.productId) {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      const product3d = product as Product3D;
      if (product3d.printTimeHours) {
        return Math.max(
          1,
          Math.ceil(product3d.printTimeHours * item.quantity),
        );
      }
      if (product.assemblyTimeHours) {
        return Math.max(
          1,
          Math.ceil(product.assemblyTimeHours * item.quantity),
        );
      }
    }
  }

  switch (item.serviceType) {
    case ServiceType.DISENO_GRAFICO:
      return 4;
    case ServiceType.MODELADO:
      return 6;
    case ServiceType.IMPRESION_3D:
      return 6;
    case ServiceType.ESTAMPADO:
      return Math.max(1, item.quantity);
    default:
      return 2;
  }
}
