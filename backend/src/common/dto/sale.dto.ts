import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LOSS_REASON_CODES, LOSS_REASON_NOTE_MAX } from '../loss-reason';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { PaymentMethod, TreasuryAccount } from '../enums';

export class CreateRetailSaleItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  productName?: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateRetailSaleDto {
  @ValidateNested({ each: true })
  @Type(() => CreateRetailSaleItemDto)
  items!: CreateRetailSaleItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  soldAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  @IsIn(LOSS_REASON_CODES)
  lossReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LOSS_REASON_NOTE_MAX)
  lossReasonNote?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsEnum(TreasuryAccount)
  account?: TreasuryAccount;
}

export class UpdateRetailSaleDto extends PartialType(CreateRetailSaleDto) {}
