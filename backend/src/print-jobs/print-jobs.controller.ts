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
import { UpdatePrintJobDto, UpdatePrintJobStatusDto } from '../common/dto';
import { PrintJobActor } from '../common/interfaces';
import { ADMIN_ROLE_ID } from '../users/user-access.bootstrap';
import { PrintJobsService } from './print-jobs.service';

@Controller('print-jobs')
export class PrintJobsController {
  constructor(private readonly printJobsService: PrintJobsService) {}

  @Get('board')
  getBoard() {
    return this.printJobsService.getBoard();
  }

  @Post('reconcile-missing-supplies')
  reconcileMissingSupplies() {
    return { blocked: this.printJobsService.blockMissingSupplies() };
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
    return this.printJobsService.update(id, dto, this.actorFromRequest(request));
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
    const profile = request.appUser;
    return {
      userId: request.user?.uid,
      isAdmin:
        !!profile &&
        (profile.isAdmin || profile.roleIds.includes(ADMIN_ROLE_ID)),
    };
  }
}
