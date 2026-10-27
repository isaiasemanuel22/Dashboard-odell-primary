import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import {
  CalendarEntryKind,
  CalendarLinkType,
  CalendarNotify,
  CalendarRepeat,
} from '../enums';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export class CreateCalendarEntryDto {
  @IsEnum(CalendarEntryKind)
  kind!: CalendarEntryKind;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  @Matches(DAY_RE)
  date!: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_RE)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_RE)
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsEnum(CalendarRepeat)
  repeat?: CalendarRepeat;

  @IsOptional()
  @IsArray()
  weekdays?: number[];

  @IsOptional()
  @IsEnum(CalendarNotify)
  notify?: CalendarNotify;

  @IsOptional()
  @IsEnum(CalendarLinkType)
  linkType?: CalendarLinkType;

  @IsOptional()
  @IsString()
  linkId?: string;
}

export class UpdateCalendarEntryDto extends PartialType(CreateCalendarEntryDto) {}

export class CompleteCalendarEntryDto {
  @IsBoolean()
  completed!: boolean;
}
