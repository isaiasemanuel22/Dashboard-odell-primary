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
  CloseFairDto,
  CreateFairDto,
  CreateFairExpenseDto,
  OpenFairDto,
  UpdateFairDto,
} from '../common/dto';
import { FairsService } from './fairs.service';

@Controller('fairs')
export class FairsController {
  constructor(private readonly fairsService: FairsService) {}

  @Get()
  list(@Query('month') month?: string) {
    return this.fairsService.list(month);
  }

  // Antes de ':id' para que 'plan' no se tome como un id.
  @Get('plan')
  plan(@Query('name') name?: string) {
    return this.fairsService.plan(name);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.fairsService.detail(id);
  }

  @Post()
  create(@Body() data: CreateFairDto) {
    return this.fairsService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateFairDto) {
    return this.fairsService.update(id, data);
  }

  @Post(':id/open')
  open(@Param('id') id: string, @Body() data: OpenFairDto) {
    return this.fairsService.open(id, data);
  }

  @Post(':id/expenses')
  addExpense(@Param('id') id: string, @Body() data: CreateFairExpenseDto) {
    return this.fairsService.addExpense(id, data);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @Body() data: CloseFairDto) {
    return this.fairsService.close(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.fairsService.remove(id);
    return { deleted: true };
  }
}
