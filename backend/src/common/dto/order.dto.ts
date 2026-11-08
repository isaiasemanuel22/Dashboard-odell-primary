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
import { Type } from 'class-transformer';
import {
  OrderStatus,
  FilamentType,
  PaperType,
  PaymentMethod,
  PriceType,
  PrintJobStatus,
  SalesChannel,
  ServiceType,
  TreasuryAccount,
} from '../enums';
import {
  EstampadoPressCycle,
  EstampadoPrintSpec,
  EstampadoSupplyLine,
} from '../interfaces';
import { FdmFilamentLineDto } from './product.dto';
import { ORDER_RICH_TEXT_HTML_MAX_LENGTH } from '../../orders/rich-text.util';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class UpdatePrintJobStatusDto {
  @IsEnum(PrintJobStatus)
  status!: PrintJobStatus;

  /** Obligatorio al pasar a BLOQUEADO (máx 255). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  blockedReason?: string;
}

export class RegisterPrintJobFailureDto {
  @IsInt()
  @Min(1)
  @Max(1000)
  pieces!: number;

  @IsNumber()
  @Min(0)
  @Max(100000)
  grams!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  hours!: number;

  @IsIn(['despegue', 'enredo', 'corte_luz', 'atasco', 'otro'])
  reason!: 'despegue' | 'enredo' | 'corte_luz' | 'atasco' | 'otro';

  @IsOptional()
  @IsBoolean()
  reprint?: boolean;
}

/** Query de GET /print-jobs/:id/failure-cost. */
export class PrintJobFailureCostQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  grams!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  hours!: number;
}

export class SupplyReplacementDto {
  @IsString()
  @IsNotEmpty()
  requirementKey!: string;

  @IsString()
  @IsNotEmpty()
  supplyId!: string;
}

export class UpdatePrintJobDto {
  @IsOptional()
  @IsEnum(PrintJobStatus)
  status?: PrintJobStatus;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  responsibleUserId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplyReplacementDto)
  supplyReplacements?: SupplyReplacementDto[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  actualHours?: number | null;

  @IsOptional()
  @IsIn(['alta', 'normal'])
  priority?: 'alta' | 'normal';

  /** Obligatorio al pasar a BLOQUEADO (máx 255). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  blockedReason?: string;
}

export class AssignPrintJobPrinterDto {
  /** Id de perfil, null para desasignar, o 'auto'. */
  @ValidateIf((_, value) => value !== null)
  @IsString()
  printerId!: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class PrinterQueueHoursQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  hours?: number;
}

export class PrinterCapacityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-52)
  @Max(52)
  weekOffset?: number;
}

export class CreateIndependentTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  productName!: string;

  /** Vacío u omitido: la tarea interna no tiene área. */
  @IsOptional()
  @IsIn([
    '',
    ServiceType.IMPRESION_3D,
    ServiceType.DISENO_GRAFICO,
    ServiceType.MODELADO,
    ServiceType.ESTAMPADO,
  ])
  type?: ServiceType | '';

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  responsibleUserId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;
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
  @IsNumber()
  @Min(0)
  listUnitPrice?: number;

  @IsOptional()
  @IsBoolean()
  unitPriceManual?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

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
  @IsIn(['fdm', 'resina'])
  printProcess?: 'fdm' | 'resina';

  @IsOptional()
  @IsString()
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FdmFilamentLineDto)
  filaments?: FdmFilamentLineDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  workTimeHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  laborNote?: string;

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

  @IsOptional()
  @IsIn(['hours', 'fixed'])
  chargeMode?: 'hours' | 'fixed';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  workKind?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @IsOptional()
  @IsBoolean()
  includesRevisions?: boolean;

  @IsOptional()
  @IsBoolean()
  needsClientProduct?: boolean;

  @IsOptional()
  @IsBoolean()
  linkPrint?: boolean;
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

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsEnum(TreasuryAccount)
  account?: TreasuryAccount;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;
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

  @IsOptional()
  @IsEnum(PriceType)
  priceType?: PriceType;

  /** Null borra el canal guardado. */
  @IsOptional()
  @IsEnum(SalesChannel)
  salesChannel?: SalesChannel | null;

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

  /** uid de Firebase del responsable del pedido. */
  @IsOptional()
  @IsString()
  responsibleUserId?: string;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
