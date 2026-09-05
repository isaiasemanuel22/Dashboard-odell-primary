import { BadRequestException } from '@nestjs/common';
import { SupplyCategory } from './enums';
import { ColorConfig } from './interfaces';

export const INDISTINTO_COLOR_ID = 'indistinto';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function normalizeColorHex(value: string): string {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return withHash.toUpperCase();
}

export function isValidColorHex(value: string): boolean {
  return HEX_COLOR_PATTERN.test(normalizeColorHex(value));
}

export function validateColorConfig(data: {
  name?: string;
  hex?: string;
}): { name: string; hex: string } {
  const name = data.name?.trim() ?? '';
  if (!name) {
    throw new BadRequestException('El nombre del color es obligatorio');
  }
  const hex = data.hex?.trim() ?? '';
  if (!hex || !isValidColorHex(hex)) {
    throw new BadRequestException(
      'El color debe estar en formato hexadecimal (#RRGGBB)',
    );
  }
  return { name, hex: normalizeColorHex(hex) };
}

export function findColorById(
  colors: ColorConfig[],
  colorId?: string | null,
): ColorConfig | undefined {
  if (!colorId || colorId === INDISTINTO_COLOR_ID) return undefined;
  return colors.find((color) => color.id === colorId);
}

export function validateSupplyColorId(
  colors: ColorConfig[],
  colorId?: string | null,
  required = false,
): string | undefined {
  if (!colorId?.trim()) {
    if (required) {
      throw new BadRequestException('Seleccioná un color para el insumo');
    }
    return undefined;
  }
  if (!findColorById(colors, colorId)) {
    throw new BadRequestException('El color seleccionado no existe en el catálogo');
  }
  return colorId.trim();
}

export function normalizeProductColorId(
  colorId?: string | null,
): string | undefined {
  if (!colorId?.trim()) return undefined;
  const normalized = colorId.trim();
  if (normalized === INDISTINTO_COLOR_ID) {
    return INDISTINTO_COLOR_ID;
  }
  return normalized;
}

export function isIndistintoColor(colorId?: string | null): boolean {
  return !colorId || colorId === INDISTINTO_COLOR_ID;
}

export function supplyRequiresColor(category: SupplyCategory): boolean {
  return (
    category === SupplyCategory.FDM ||
    category === SupplyCategory.RESINA ||
    category === SupplyCategory.ESTAMPADO
  );
}

export function resolveProductColorId(
  colors: ColorConfig[],
  colorId?: string | null,
): string {
  const normalized = normalizeProductColorId(colorId) ?? INDISTINTO_COLOR_ID;
  if (normalized === INDISTINTO_COLOR_ID) {
    return INDISTINTO_COLOR_ID;
  }
  if (!findColorById(colors, normalized)) {
    throw new BadRequestException(
      'El color seleccionado no existe en el catálogo',
    );
  }
  return normalized;
}
