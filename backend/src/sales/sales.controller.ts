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
  CreateRetailSaleDto,
  UpdateRetailSaleDto,
} from '../common/dto';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  getOverview(@Query('month') month?: string) {
    return this.salesService.getOverview(month);
  }

  @Get('retail/:id')
  getRetailSale(@Param('id') id: string) {
    return this.salesService.findRetailSale(id);
  }

  @Post('retail')
  createRetailSale(@Body() data: CreateRetailSaleDto) {
    return this.salesService.createRetail(data);
  }

  @Patch('retail/:id')
  updateRetailSale(
    @Param('id') id: string,
    @Body() data: UpdateRetailSaleDto,
  ) {
    return this.salesService.updateRetail(id, data);
  }

  @Delete('retail/:id')
  deleteRetailSale(@Param('id') id: string) {
    this.salesService.removeRetail(id);
    return { deleted: true };
  }
}
