import { ServiceType } from '../../core/models';

export const LEGACY_DESIGN_SERVICE = 'diseno';

export function isDesignService(serviceType: ServiceType): boolean {
  return (
    serviceType === ServiceType.DISENO_GRAFICO ||
    serviceType === ServiceType.MODELADO
  );
}

export function isGraphicDesignService(serviceType: ServiceType): boolean {
  return serviceType === ServiceType.DISENO_GRAFICO;
}

/** Área de Odell. Insumo suelto y servicio de un tercero no lo son. */
export function isAreaService(serviceType: ServiceType): boolean {
  return designatedArea(serviceType) !== null;
}

/** Área designada, o null si el valor está vacío o no es un área. */
export function designatedArea(
  serviceType: string | null | undefined,
): ServiceType | null {
  if (
    serviceType === ServiceType.IMPRESION_3D ||
    serviceType === ServiceType.ESTAMPADO ||
    serviceType === ServiceType.DISENO_GRAFICO ||
    serviceType === ServiceType.MODELADO
  ) {
    return serviceType;
  }
  return null;
}

export function isSupplyOrderLine(serviceType: ServiceType): boolean {
  return serviceType === ServiceType.INSUMO;
}

export function isThirdPartyService(serviceType: ServiceType): boolean {
  return serviceType === ServiceType.SERVICIO_TERCERO;
}

export function normalizeServiceType(value: unknown): ServiceType | null {
  if (value === LEGACY_DESIGN_SERVICE) {
    return ServiceType.DISENO_GRAFICO;
  }

  if (
    typeof value === 'string' &&
    (Object.values(ServiceType) as string[]).includes(value)
  ) {
    return value as ServiceType;
  }

  return null;
}
