import { PartialType, PickType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TreasuryAccount } from '../enums';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateFairDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsString()
  @Matches(DAY_RE, { message: 'La fecha debe tener formato AAAA-MM-DD' })
  date!: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  calendarEntryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingFloat?: number;
}

export class UpdateFairDto extends PartialType(
  PickType(CreateFairDto, [
    'name',
    'date',
    'recurring',
    'calendarEntryId',
  ] as const),
) {}

export class OpenFairDto {
  @IsNumber()
  @Min(0)
  openingFloat!: number;
}

export class CloseFairDto {
  @IsNumber()
  @Min(0)
  countedCash!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  differenceReason?: string;
}

export class CreateFairExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsEnum(TreasuryAccount)
  account?: TreasuryAccount;
}
