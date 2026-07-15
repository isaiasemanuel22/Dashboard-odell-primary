import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ServiceType } from '../enums';

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
  profitMargins?: Record<string, number>;

  @IsOptional()
  paperPricesPerSqm?: Record<string, number>;

  @IsOptional()
  processProfiles?: unknown[];

  @IsOptional()
  machineProfiles?: unknown[];

  @IsOptional()
  filamentTypeAverages?: Record<string, number>;

  @IsOptional()
  resinTypeAverages?: Record<string, number>;
}

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
  @IsString()
  type!: string;

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
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  filamentType?: string;

  @IsOptional()
  @IsString()
  resinType?: string;

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
