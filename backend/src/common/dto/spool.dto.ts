import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SpoolPrinterLocationDto {
  @IsIn(['printer'])
  kind!: 'printer';

  @IsString()
  @IsNotEmpty()
  printerId!: string;

  @IsInt()
  @Min(1)
  @Max(4)
  slot!: number;
}

export class SpoolShelfLocationDto {
  @IsIn(['shelf'])
  kind!: 'shelf';

  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class OpenSpoolDto {
  @IsString()
  @IsNotEmpty()
  supplyId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  grams?: number;

  @ValidateNested()
  @Type(() => Object)
  location!: SpoolPrinterLocationDto | SpoolShelfLocationDto;
}

export class MoveSpoolDto {
  @ValidateNested()
  @Type(() => Object)
  location!: SpoolPrinterLocationDto | SpoolShelfLocationDto;
}

export class AdjustSpoolDto {
  @IsNumber()
  @Min(0)
  remainingGrams!: number;
}
