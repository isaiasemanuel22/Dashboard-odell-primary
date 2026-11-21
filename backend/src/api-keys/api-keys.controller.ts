import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { assertAdmin } from '../auth/admin.util';
import { CreateApiKeyDto } from '../common/dto';
import { AppConfigService } from '../config/app-config.service';
import { API_KEY_SCOPE_OPTIONS } from './api-key-scopes';
import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
export class ApiKeysController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  list(@Req() request: Request) {
    assertAdmin(request, this.config.requireAuth);
    return this.apiKeys.list();
  }

  @Get('scopes')
  scopes(@Req() request: Request) {
    assertAdmin(request, this.config.requireAuth);
    return API_KEY_SCOPE_OPTIONS;
  }

  @Post()
  create(@Req() request: Request, @Body() data: CreateApiKeyDto) {
    assertAdmin(request, this.config.requireAuth);
    return this.apiKeys.create(data.name, data.scopes, request.appUser?.id);
  }

  @Post(':id/revoke')
  revoke(@Req() request: Request, @Param('id') id: string) {
    assertAdmin(request, this.config.requireAuth);
    return this.apiKeys.revoke(id);
  }
}
