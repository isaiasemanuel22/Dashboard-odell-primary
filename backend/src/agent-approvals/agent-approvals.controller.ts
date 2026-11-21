import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { assertAdmin } from '../auth/admin.util';
import { AppConfigService } from '../config/app-config.service';
import { AgentApprovalsService } from './agent-approvals.service';

@Controller('agent-approvals')
export class AgentApprovalsController {
  constructor(
    private readonly approvals: AgentApprovalsService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  list(@Req() request: Request, @Query('status') status?: string) {
    assertAdmin(request, this.config.requireAuth);
    return this.approvals.list(status);
  }

  @Post(':id/approve')
  approve(@Req() request: Request, @Param('id') id: string) {
    assertAdmin(request, this.config.requireAuth);
    return this.approvals.approve(id, request.appUser?.id);
  }

  @Post(':id/reject')
  reject(@Req() request: Request, @Param('id') id: string) {
    assertAdmin(request, this.config.requireAuth);
    return this.approvals.reject(id, request.appUser?.id);
  }
}
