import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { FilamentType, PaperType, ProductType } from '../enums';
import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
} from '../interfaces';

export class ProductComponentDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  colorId?: string;
}

export class FdmFilamentLineDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsEnum(FilamentType)
  filamentType!: FilamentType;

  @IsNumber()
  @Min(0.1)
  grams!: number;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  colorId?: string;
}

export class ProductAttachmentDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsNumber()
  @Min(0)
  size!: number;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString({ each: true })
  productTypes!: string[];
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(ProductType)
  type!: ProductType;

  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttachmentDto)
  attachments?: ProductAttachmentDto[];

  @IsOptional()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  includesPieces?: boolean;

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
  @IsEnum(FilamentType)
  filamentType?: FilamentType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FdmFilamentLineDto)
  filaments?: FdmFilamentLineDto[];

  /** Gramos de purga AMS por unidad (≥0, hasta 1 decimal). */
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 1 },
    { message: 'La purga debe ser un número con hasta 1 decimal' },
  )
  @Min(0, { message: 'La purga no puede ser negativa' })
  purgeGrams?: number | null;

  /** Cambios de color del modelo (entero ≥0). */
  @IsOptional()
  @IsInt({ message: 'Los cambios de color deben ser un entero' })
  @Min(0, { message: 'Los cambios de color no pueden ser negativos' })
  colorChanges?: number | null;

  /** Impresora FDM preferida (id de perfil con cola). null = cualquiera. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'La impresora preferida es inválida' })
  preferredPrinterId?: string | null;

  @IsOptional()
  @IsString()
  resinType?: string;

  @IsOptional()
  @IsString()
  colorId?: string;

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
  @IsString()
  impresoId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  widthCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  lengthCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  heightCm?: number;

  @IsOptional()
  estampadoPrints?: EstampadoPrintSpec[];

  @IsOptional()
  estampadoPressCycles?: EstampadoPressCycle[];

  @IsOptional()
  prints?: EstampadoPrintSpec[];

  @IsOptional()
  pressCycles?: EstampadoPressCycle[];

  @IsOptional()
  estampadoSupplies?: EstampadoSupplyLine[];

  @IsOptional()
  supplies?: EstampadoSupplyLine[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  assemblyTimeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsNumber()
  suggestedPrice?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductComponentDto)
  components?: ProductComponentDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductPricingInputDto extends PartialType(CreateProductDto) {
  @IsEnum(ProductType)
  type!: ProductType;
}

export class BulkPriceDto {
  @IsIn(['all', 'category', 'filament_type'])
  scope!: 'all' | 'category' | 'filament_type';

  @ValidateIf((data: BulkPriceDto) => data.scope === 'category')
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ValidateIf((data: BulkPriceDto) => data.scope === 'filament_type')
  @IsEnum(FilamentType)
  filamentType?: FilamentType;

  @IsNumber()
  @Min(-50)
  @Max(200)
  percent!: number;

  @IsIn([0, 100, 500])
  roundTo!: 0 | 100 | 500;
}
