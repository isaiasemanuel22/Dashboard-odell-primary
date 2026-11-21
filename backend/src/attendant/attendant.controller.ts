import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { assertAdmin } from '../auth/admin.util';
import { ChatsService } from '../chats/chats.service';
import {
  AttendantRunsQueryDto,
  SimulateInboundDto,
  UpdateAttendantDto,
} from '../common/dto';
import { AppConfigService } from '../config/app-config.service';
import { AttendantService } from './attendant.service';

@Controller('attendant')
export class AttendantController {
  constructor(
    private readonly attendant: AttendantService,
    private readonly chats: ChatsService,
    private readonly config: AppConfigService,
  ) {}

  @Get('status')
  status() {
    return this.attendant.status();
  }

  @Get('conversations/:id/runs')
  runs(@Param('id') id: string, @Query() query: AttendantRunsQueryDto) {
    return this.attendant.runs(id, query.limit);
  }

  /** Mensaje entrante de prueba, como si llegara por el webhook de Meta. */
  @Post('simulate')
  simulate(@Req() request: Request, @Body() data: SimulateInboundDto) {
    if (this.config.isProduction) throw new NotFoundException();
    assertAdmin(request, this.config.requireAuth);
    const { conversation, message } = this.chats.registerInbound({
      channel: data.channel,
      externalId: data.externalId,
      displayName: data.name,
      text: data.text,
    });
    void this.attendant.enqueue(conversation.id, message.id);
    return { conversationId: conversation.id, messageId: message.id };
  }
}

/** Ajustes del agente en la misma ruta que el resto de Ajustes. */
@Controller('settings')
export class AttendantSettingsController {
  constructor(
    private readonly attendant: AttendantService,
    private readonly config: AppConfigService,
  ) {}

  @Patch('attendant')
  update(@Req() request: Request, @Body() data: UpdateAttendantDto) {
    assertAdmin(request, this.config.requireAuth);
    return this.attendant.updateSettings(data);
  }
}
