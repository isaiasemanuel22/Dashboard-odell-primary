import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { FilamentType, PaperType, ProductType, ResinType } from '../enums';
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

  @IsEnum(ProductType)
  type!: ProductType;

  @IsOptional()
  @IsString({ each: true })
  images?: string[];

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
