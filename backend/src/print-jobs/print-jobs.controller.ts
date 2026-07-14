import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  UpdatePrintJobDto,
  UpdatePrintJobStatusDto,
} from '../common/dto';
import { PrintJobsService } from './print-jobs.service';

@Controller('print-jobs')
export class PrintJobsController {
  constructor(private readonly printJobsService: PrintJobsService) {}

  @Get('board')
  getBoard() {
    return this.printJobsService.getBoard();
  }

  @Get()
  findAll(@Query('orderId') orderId?: string) {
    if (orderId) {
      return this.printJobsService.findByOrderId(orderId);
    }
    return this.printJobsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.printJobsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePrintJobDto) {
    return this.printJobsService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdatePrintJobStatusDto) {
    return this.printJobsService.updateStatus(id, body.status);
  }
}
