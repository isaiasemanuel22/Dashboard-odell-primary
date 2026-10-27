import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CompleteCalendarEntryDto,
  CreateCalendarEntryDto,
  UpdateCalendarEntryDto,
} from '../common/dto';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  getFeed(@Query('from') from?: string, @Query('to') to?: string) {
    return this.calendarService.getFeed(from, to);
  }

  @Get('entries')
  findAllEntries() {
    return this.calendarService.findAllEntries();
  }

  @Get('entries/:id')
  findOneEntry(@Param('id') id: string) {
    return this.calendarService.findOneEntry(id);
  }

  @Post('entries')
  createEntry(@Body() data: CreateCalendarEntryDto) {
    return this.calendarService.createEntry(data);
  }

  @Patch('entries/:id')
  updateEntry(@Param('id') id: string, @Body() data: UpdateCalendarEntryDto) {
    return this.calendarService.updateEntry(id, data);
  }

  @Patch('entries/:id/complete')
  completeEntry(
    @Param('id') id: string,
    @Body() body: CompleteCalendarEntryDto,
  ) {
    return this.calendarService.completeEntry(id, body.completed);
  }

  @Delete('entries/:id')
  removeEntry(@Param('id') id: string) {
    this.calendarService.removeEntry(id);
    return { deleted: true };
  }
}
