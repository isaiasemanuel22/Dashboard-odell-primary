import { Type } from 'class-transformer';
import {
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

export class SpoolLocationDto {
  @IsIn(['printer', 'shelf'], {
    message: 'La ubicación debe ser impresora o estante',
  })
  kind!: 'printer' | 'shelf';

  @ValidateIf((o: SpoolLocationDto) => o.kind === 'printer')
  @IsString({ message: 'La impresora es obligatoria' })
  @IsNotEmpty({ message: 'La impresora es obligatoria' })
  printerId?: string;

  @ValidateIf((o: SpoolLocationDto) => o.kind === 'printer')
  @IsInt({ message: 'La ranura debe ser un número entero' })
  @Min(1, { message: 'La ranura debe ser entre 1 y 4' })
  @Max(4, { message: 'La ranura debe ser entre 1 y 4' })
  slot?: number;

  @ValidateIf((o: SpoolLocationDto) => o.kind === 'shelf')
  @IsString({ message: 'El texto del estante es obligatorio' })
  @IsNotEmpty({ message: 'El texto del estante es obligatorio' })
  @MaxLength(120, { message: 'El texto del estante no puede superar 120 caracteres' })
  text?: string;
}

export class OpenSpoolDto {
  @IsString({ message: 'El insumo es obligatorio' })
  @IsNotEmpty({ message: 'El insumo es obligatorio' })
  supplyId!: string;

  @IsOptional()
  @IsNumber({}, { message: 'Los gramos deben ser un número' })
  @Min(0.001, { message: 'Los gramos deben ser mayores a 0' })
  grams?: number;

  @ValidateNested({ message: 'La ubicación no es válida' })
  @Type(() => SpoolLocationDto)
  location!: SpoolLocationDto;
}

export class MoveSpoolDto {
  @ValidateNested({ message: 'La ubicación no es válida' })
  @Type(() => SpoolLocationDto)
  location!: SpoolLocationDto;
}

export class AdjustSpoolDto {
  @IsNumber({}, { message: 'Los gramos restantes deben ser un número' })
  @Min(0, { message: 'Los gramos restantes no pueden ser negativos' })
  remainingGrams!: number;
}
