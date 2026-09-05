import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { QuoteStatus } from '../enums';
import { OrderItemDto } from './order.dto';

export class CreateQuoteDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}

export class UpdateQuoteStatusDto {
  @IsEnum(QuoteStatus)
  status!: QuoteStatus;
}
