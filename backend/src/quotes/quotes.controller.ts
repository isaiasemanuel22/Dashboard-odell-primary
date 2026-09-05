import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateQuoteDto,
  UpdateQuoteDto,
  UpdateQuoteStatusDto,
} from '../common/dto';
import { QuotesService } from './quotes.service';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

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
  createOrder(@Param('id') id: string) {
    return this.quotesService.createOrderFromQuote(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateQuoteStatusDto,
  ) {
    return this.quotesService.updateStatus(id, body.status);
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
