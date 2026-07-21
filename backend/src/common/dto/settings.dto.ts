import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import {
  FilamentType,
  PaperType,
  ProductType,
  ResinType,
  ServiceType,
} from '../enums';
import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
} from '../interfaces';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ServiceType)
  type?: ServiceType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsString()
  supplier?: string;
}

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsObject()
  filamentTypeAverages?: Record<string, number>;

  @IsOptional()
  @IsObject()
  resinTypeAverages?: Record<string, number>;
}

/** Compatibilidad: PATCH /settings/general con campos parciales (clientes legacy). */
export class LegacyPatchGeneralSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  electricityCostPerKwh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCostPerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  errorMarginPercent?: number;

  @IsOptional()
  @IsObject()
  profitMargins?: Record<string, number>;

  @IsOptional()
  @IsObject()
  paperPricesPerSqm?: Record<string, number>;

  @IsOptional()
  machineProfiles?: unknown[];

  @IsOptional()
  @IsObject()
  filamentTypeAverages?: Record<string, number>;

  @IsOptional()
  @IsObject()
  resinTypeAverages?: Record<string, number>;
}

export class UpdateCoreValuesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  electricityCostPerKwh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborCostPerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  errorMarginPercent?: number;
}

export class UpdateProfitMarginsDto {
  @IsObject()
  profitMargins!: Record<string, number>;
}

export class UpdatePaperPricesDto {
  @IsObject()
  paperPricesPerSqm!: Record<string, number>;
}

export class MachineProfileDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  role!: string;

  @IsNumber()
  @Min(0)
  watts!: number;

  @IsNumber()
  @Min(0)
  costPerHour!: number;

  @IsOptional()
  @IsString()
  productType?: string;

  @IsOptional()
  @IsString()
  washSupplyId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumptionMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  washBathUses?: number;
}

export class UpdateMachineProfileDto extends PartialType(MachineProfileDto) {}

export class PowerConsumptionEntryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  watts!: number;
}

export class MachineCostEntryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  costPerHour!: number;
}

export class NamedCostEntryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  watts?: number;

  @IsNumber()
  @Min(0)
  costPerHour?: number;
}

export class FilamentPriceDto {
  @IsString()
  @IsNotEmpty()
  brand!: string;

  @IsString()
  materialType!: string;

  @IsNumber()
  @Min(0)
  pricePerKg!: number;
}

export class ResinPriceDto {
  @IsString()
  @IsNotEmpty()
  brand!: string;

  @IsString()
  resinType!: string;

  @IsNumber()
  @Min(0)
  pricePerLiter!: number;
}

export class CalculateCostDto {
  @IsEnum(ProductType)
  type!: ProductType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grams?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  printTimeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  workTimeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsEnum(FilamentType)
  filamentType?: FilamentType;

  @IsOptional()
  @IsEnum(ResinType)
  resinType?: ResinType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  washMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cureMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pressMinutes?: number;

  @IsOptional()
  @IsEnum(PaperType)
  paperType?: PaperType;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  widthCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  heightCm?: number;

  @IsOptional()
  estampadoPrints?: EstampadoPrintSpec[];

  @IsOptional()
  estampadoPressCycles?: EstampadoPressCycle[];

  @IsOptional()
  estampadoSupplies?: EstampadoSupplyLine[];
}

export class CreateImpresoDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  paperType!: string;

  @IsNumber()
  @Min(0.0001)
  widthCm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  lengthCm?: number;

  @IsNumber()
  @Min(0.0001)
  heightCm!: number;
}

export class UpdateImpresoDto extends PartialType(CreateImpresoDto) {}

export class ImpresoPreviewCostDto {
  @IsString()
  paperType!: string;

  @IsNumber()
  @Min(0.0001)
  widthCm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  lengthCm?: number;

  @IsNumber()
  @Min(0.0001)
  heightCm!: number;
}

export class SupplyDefaultPriceDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  filamentType?: string;

  @IsOptional()
  @IsString()
  resinType?: string;
}

export class CreateSupplyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  type!: string;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  minStock!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsBoolean()
  priceFromSettings?: boolean;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  filamentType?: string;

  @IsOptional()
  @IsString()
  resinType?: string;

  @IsOptional()
  @IsString()
  supplier?: string;
}

export class UpdateSupplyDto extends PartialType(CreateSupplyDto) {}

export class SupplyDefaultPriceQueryDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  filamentType?: string;

  @IsOptional()
  @IsString()
  resinType?: string;
}

export const DATABASE_RESET_CODE = '22899';

export class ResetDatabaseDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
