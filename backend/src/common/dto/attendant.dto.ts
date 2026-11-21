import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ChatChannel } from '../enums';

export class AttendantRunsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/** Mensaje entrante de prueba, solo fuera de producción. */
export class SimulateInboundDto {
  @IsEnum(ChatChannel)
  channel!: ChatChannel;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  externalId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text!: string;
}
