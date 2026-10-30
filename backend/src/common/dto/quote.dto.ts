import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { QuoteStatus } from '../enums';
import { ORDER_RICH_TEXT_HTML_MAX_LENGTH } from '../../orders/rich-text.util';
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

  @IsOptional()
  @IsString()
  @MaxLength(ORDER_RICH_TEXT_HTML_MAX_LENGTH)
  description?: string;

  /** Solo borrador | enviado al crear/guardar desde el formulario. */
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;
}

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}

export class UpdateQuoteStatusDto {
  @IsEnum(QuoteStatus)
  status!: QuoteStatus;
}
