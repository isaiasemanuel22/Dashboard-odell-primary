import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import {
  FilamentType,
  PaperType,
  ProductType,
  ServiceType,
  SupplyCategory,
} from '../enums';
import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
} from '../interfaces';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
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
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
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
  modelingRatePerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  graphicDesignRatePerHour?: number;

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
  modelingRatePerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  graphicDesignRatePerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  errorMarginPercent?: number;
}

export class UpdateProfitMarginsDto {
  @IsObject()
  profitMargins!: Record<string, number>;
}

export class UpdateWholesaleDiscountDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99)
  percent?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(ServiceType, { each: true })
  serviceTypes?: ServiceType[];
}

export class UpdateAutomaticAlertsDto {
  @IsOptional()
  @IsBoolean()
  ordersDue?: boolean;

  @IsOptional()
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyReceivables?: boolean;
}

export class UpdateAgentToolsDto {
  @IsOptional()
  @IsBoolean()
  consultar_stock?: boolean;

  @IsOptional()
  @IsBoolean()
  cotizar_producto?: boolean;

  @IsOptional()
  @IsBoolean()
  ver_cola?: boolean;

  @IsOptional()
  @IsBoolean()
  crear_presupuesto?: boolean;

  @IsOptional()
  @IsBoolean()
  registrar_pago?: boolean;
}

export class UpdateAttendantDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  stockDeliveryDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  deliveryMarginDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  monthlyBudgetUsd?: number;
}

export class UpdatePaperPricesDto {
  @IsObject()
  paperReferenceSheets!: Record<string, Record<string, number>>;
}

export class MachineProfileDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MaxLength(255)
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
  @MaxLength(255)
  productType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  washSupplyId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consumptionMl?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  washBathUses?: number;

  @IsOptional()
  @IsBoolean()
  queueEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  workHoursPerDay?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workWeekdays?: number[];

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  workStartHour?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  amsType?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  amsSlots?: (string | null)[];

  @IsOptional()
  @IsBoolean()
  costBase?: boolean;
}

export class UpdateMachineProfileDto extends PartialType(MachineProfileDto) {}

export class PowerConsumptionEntryDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  watts!: number;
}

export class UpdatePowerConsumptionEntryDto extends PartialType(
  PowerConsumptionEntryDto,
) {}

export class MachineCostEntryDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  costPerHour!: number;
}

export class UpdateMachineCostEntryDto extends PartialType(
  MachineCostEntryDto,
) {}

export class NamedCostEntryDto {
  @IsString()
  @MaxLength(255)
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
  @MaxLength(255)
  @IsNotEmpty()
  brand!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsNotEmpty()
  filamentTypeId?: string;

  /** Compat / fallback si aún no se envía filamentTypeId. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  materialType?: string;

  @IsNumber()
  @Min(0)
  pricePerKg!: number;
}

export class UpdateFilamentPriceDto extends PartialType(FilamentPriceDto) {}

export class FilamentTypeConfigDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name!: string;
}

export class UpdateFilamentTypeConfigDto extends PartialType(
  FilamentTypeConfigDto,
) {}

export class ResinPriceDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  brand!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsNotEmpty()
  resinTypeId?: string;

  /** Compat / fallback si aún no se envía resinTypeId. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  resinType?: string;

  @IsNumber()
  @Min(0)
  pricePerLiter!: number;
}

export class UpdateResinPriceDto extends PartialType(ResinPriceDto) {}

export class ResinTypeConfigDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name!: string;
}

export class UpdateResinTypeConfigDto extends PartialType(ResinTypeConfigDto) {}

export class ColorConfigDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MaxLength(16)
  @IsNotEmpty()
  hex!: string;
}

export class UpdateColorConfigDto extends PartialType(ColorConfigDto) {}

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
  @MaxLength(255)
  brand?: string;

  @IsOptional()
  @IsEnum(FilamentType)
  filamentType?: FilamentType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
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
  @MaxLength(255)
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MaxLength(32)
  paperType!: string;

  @IsNumber()
  @Min(0.0001)
  widthCm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  lengthCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  heightCm?: number;
}

export class UpdateImpresoDto extends PartialType(CreateImpresoDto) {}

export class ImpresoPreviewCostDto {
  @IsString()
  @MaxLength(32)
  paperType!: string;

  @IsNumber()
  @Min(0.0001)
  widthCm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  lengthCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  heightCm?: number;
}

export class SupplyDefaultPriceDto {
  @IsEnum(SupplyCategory)
  category!: SupplyCategory;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  filamentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  resinType?: string;
}

export class CreateSupplyDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name!: string;

  @IsEnum(SupplyCategory)
  category!: SupplyCategory;

  @IsString()
  @MaxLength(32)
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
  @MaxLength(128)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  filamentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  resinType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supplier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  supplierId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  spoolGrams?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  colorId?: string;
}

export class UpdateSupplyDto extends PartialType(CreateSupplyDto) {}

export class SupplyDefaultPriceQueryDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  filamentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  resinType?: string;
}

export class ResetDatabaseDto {
  @IsString()
  @MaxLength(64)
  @IsNotEmpty()
  code!: string;
}
