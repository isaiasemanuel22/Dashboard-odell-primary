import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AssignPrintJobPrinterDto,
  CreateIndependentTaskDto,
  PrinterCapacityQueryDto,
  PrinterQueueHoursQueryDto,
  UpdatePrintJobDto,
  UpdatePrintJobStatusDto,
} from '../common/dto';
import { PrintJobActor } from '../common/interfaces';
import { AppConfigService } from '../config/app-config.service';
import { actorFromRequest } from './print-job-actor.util';
import { PrintJobsService } from './print-jobs.service';
import { PrinterQueueService } from './printer-queue.service';

@Controller('print-jobs')
export class PrintJobsController {
  constructor(
    private readonly printJobsService: PrintJobsService,
    private readonly printerQueueService: PrinterQueueService,
    private readonly config: AppConfigService,
  ) {}

  @Get('board')
  getBoard() {
    return this.printJobsService.getBoard();
  }

  @Get('printer-queue')
  getPrinterQueue() {
    return this.printerQueueService.getPrinterQueue();
  }

  @Get('delivery-estimate')
  deliveryEstimate(@Query() query: PrinterQueueHoursQueryDto) {
    return this.printerQueueService.deliveryEstimate(query.hours);
  }

  @Get('capacity')
  getCapacity(@Query() query: PrinterCapacityQueryDto) {
    return this.printerQueueService.getCapacity(query.weekOffset);
  }

  @Post('reconcile-missing-supplies')
  reconcileMissingSupplies() {
    return { blocked: this.printJobsService.blockMissingSupplies() };
  }

  @Post()
  createIndependent(
    @Body() dto: CreateIndependentTaskDto,
    @Req() request: Request,
  ) {
    return this.printJobsService.createIndependent(
      dto,
      this.actorFromRequest(request),
    );
  }

  @Get()
  findAll(@Query('orderId') orderId?: string) {
    if (orderId) {
      return this.printJobsService.findByOrderId(orderId);
    }
    return this.printJobsService.findAll();
  }

  @Get(':id/supply-shortages')
  supplyShortages(@Param('id') id: string) {
    return this.printJobsService.supplyShortages(id);
  }

  @Patch(':id/assignment')
  assignPrinter(
    @Param('id') id: string,
    @Body() dto: AssignPrintJobPrinterDto,
    @Req() request: Request,
  ) {
    return this.printerQueueService.assign(
      id,
      dto,
      this.actorFromRequest(request),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.printJobsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrintJobDto,
    @Req() request: Request,
  ) {
    return this.printJobsService.update(
      id,
      dto,
      this.actorFromRequest(request),
    );
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdatePrintJobStatusDto,
    @Req() request: Request,
  ) {
    return this.printJobsService.updateStatus(
      id,
      body.status,
      this.actorFromRequest(request),
    );
  }

  /** Admin: rol role-admin o el mismo criterio que CurrentUserProfile.isAdmin. */
  private actorFromRequest(request: Request): PrintJobActor {
    return actorFromRequest(request, this.config.requireAuth);
  }
}
