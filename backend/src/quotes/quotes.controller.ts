import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateQuoteDto,
  UpdateQuoteDto,
  UpdateQuoteStatusDto,
} from '../common/dto';
import { UserAccessService } from '../users/user-access.service';
import { resolveOrderResponsible } from './quote-responsible.util';
import { QuoteStatus } from '../common/enums';
import { QuotesService } from './quotes.service';

@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly userAccess: UserAccessService,
  ) {}

  private responsibleFor(request: Request): Promise<string | undefined> {
    return resolveOrderResponsible(request.user?.uid, () =>
      this.userAccess.listOrderResponsibles(),
    );
  }

  @Get()
  findAll() {
    return this.quotesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotesService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateQuoteDto) {
    return this.quotesService.create(data);
  }

  @Post(':id/order')
  async createOrder(@Param('id') id: string, @Req() request: Request) {
    return this.quotesService.createOrderFromQuote(
      id,
      await this.responsibleFor(request),
    );
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateQuoteStatusDto,
    @Req() request: Request,
  ) {
    return this.quotesService.updateStatus(
      id,
      body.status,
      body.status === QuoteStatus.ACEPTADO
        ? await this.responsibleFor(request)
        : request.user?.uid,
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateQuoteDto) {
    return this.quotesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.quotesService.remove(id);
    return { deleted: true };
  }
}
