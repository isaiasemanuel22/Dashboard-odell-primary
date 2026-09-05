import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TreasuryExpenseCategory, TreasuryMovementDirection } from '../enums';

function isPersonMovement(data: CreateTreasuryExpenseDto): boolean {
  return (
    data.category === TreasuryExpenseCategory.PAYMENT ||
    data.category === TreasuryExpenseCategory.LOAN ||
    data.category === TreasuryExpenseCategory.LOAN_REPAYMENT
  );
}

export class TreasurySupplyLineDto {
  @IsString()
  @MinLength(1)
  supplyId!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0.01)
  amountSpent!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateTreasuryExpenseDto {
  @ValidateIf((data: CreateTreasuryExpenseDto) => !data.isSupplyPurchase)
  @IsString()
  @MinLength(1)
  name?: string;

  @IsBoolean()
  isSupplyPurchase!: boolean;

  @ValidateIf((data: CreateTreasuryExpenseDto) => !data.isSupplyPurchase)
  @IsOptional()
  @IsEnum(TreasuryExpenseCategory)
  category?: TreasuryExpenseCategory;

  @ValidateIf(
    (data: CreateTreasuryExpenseDto) =>
      !data.isSupplyPurchase && !isPersonMovement(data),
  )
  @IsEnum(TreasuryMovementDirection)
  direction?: TreasuryMovementDirection;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  occurredAt!: string;

  @ValidateIf((data: CreateTreasuryExpenseDto) => data.isSupplyPurchase)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TreasurySupplyLineDto)
  supplyLines?: TreasurySupplyLineDto[];
}
