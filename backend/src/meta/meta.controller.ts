import { Body, Controller, Get, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SendTemplateDto, TemplateTargetDto } from '../common/dto';
import { AppConfigService } from '../config/app-config.service';
import { MetaGraphClient } from './meta-graph.client';
import type { MetaTemplateStatus } from './meta-graph.client';
import { META_TEMPLATES } from './meta.constants';
import { MetaTemplatesService } from './meta-templates.service';

/** Estado de la conexión con Meta (solo lectura: todo sale de env) y plantillas. */
@Controller('meta')
export class MetaController {
  private readonly logger = new Logger(MetaController.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly graph: MetaGraphClient,
    private readonly templates: MetaTemplatesService,
  ) {}

  @Get('status')
  async status(@Req() request: Request) {
    const config = this.config;
    let metaTemplates: MetaTemplateStatus[] = [];
    let displayPhoneNumber: string | null = null;
    if (config.whatsappConfigured) {
      // Si Meta no responde, la pantalla igual muestra lo que hay en env.
      try {
        displayPhoneNumber = (await this.graph.phoneInfo()).displayPhoneNumber;
        if (config.whatsappBusinessAccountId) {
          metaTemplates = await this.graph.listTemplates();
        }
      } catch (error) {
        this.logger.warn(
          `Meta no respondió el estado: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const proto =
      request.get('x-forwarded-proto')?.split(',')[0] ?? request.protocol;
    return {
      webhookUrl: `${proto}://${request.get('host')}/api/meta/webhook`,
      verifyTokenConfigured: !!config.metaVerifyToken,
      appSecretConfigured: !!config.metaAppSecret,
      whatsapp: {
        connected: config.whatsappConfigured,
        phoneNumberId: config.whatsappPhoneNumberId ?? null,
        businessAccountId: config.whatsappBusinessAccountId ?? null,
        displayPhoneNumber,
      },
      instagram: {
        connected: config.pageConfigured && !!config.instagramAccountId,
        accountId: config.instagramAccountId ?? null,
      },
      messenger: {
        connected: config.pageConfigured,
        pageId: config.metaPageId ?? null,
      },
      templates: Object.values(META_TEMPLATES).map((template) => ({
        key: template.key,
        name: template.name,
        label: template.label,
        body: template.body,
        metaStatus:
          metaTemplates.find((t) => t.name === template.name)?.status ?? null,
      })),
    };
  }

  @Post('templates/preview')
  preview(@Body() data: TemplateTargetDto) {
    return this.templates.preview(data);
  }

  @Post('templates/send')
  send(@Body() data: SendTemplateDto, @Req() request: Request) {
    return this.templates.sendTemplate(data, request.user?.uid);
  }
}
