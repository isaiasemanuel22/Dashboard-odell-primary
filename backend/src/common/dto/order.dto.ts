import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { OrderStatus, FilamentType, PaperType, PrintJobStatus, ServiceType } from '../enums';
import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
} from '../interfaces';
import { ORDER_RICH_TEXT_HTML_MAX_LENGTH } from '../../orders/rich-text.util';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class UpdatePrintJobStatusDto {
  @IsEnum(PrintJobStatus)
  status!: PrintJobStatus;
}

export class UpdatePrintJobDto {
  @IsOptional()
  @IsEnum(PrintJobStatus)
  status?: PrintJobStatus;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  responsibleUserId?: string;
}

export class OrderDeliveryLineDto {
  @IsNumber()
  @Min(0)
  orderItemIndex!: number;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;
}

export class CreateOrderDeliveryDto {
  @ValidateNested({ each: true })
  @Type(() => OrderDeliveryLineDto)
  items!: OrderDeliveryLineDto[];
}

export class OrderItemDto {
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsBoolean()
  includesPrint?: boolean;

  @IsOptional()
  @IsEnum(PaperType)
  printPaperType?: PaperType;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  printWidthCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  printLengthCm?: number;

  @IsOptional()
  @IsString()
  printImpresoId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  designUnitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  printTimeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grams?: number;

  @IsOptional()
  @IsEnum(FilamentType)
  filamentType?: FilamentType;

  @IsOptional()
  @IsArray()
  estampadoPrints?: EstampadoPrintSpec[];

  @IsOptional()
  @IsArray()
  estampadoPressCycles?: EstampadoPressCycle[];

  @IsOptional()
  @IsArray()
  estampadoSupplies?: EstampadoSupplyLine[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetedHours?: number;
}

export class OrderPriceDecisionDto {
  @IsIn(['apply', 'keep'])
  action!: 'apply' | 'keep';
}

export class CreateOrderPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsBoolean()
  deposit?: boolean;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(ServiceType, { each: true })
  services?: ServiceType[];

  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsString()
  @IsNotEmpty()
  dueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(ORDER_RICH_TEXT_HTML_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
