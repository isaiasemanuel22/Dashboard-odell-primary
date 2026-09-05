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
