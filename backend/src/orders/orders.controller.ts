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
  CreateOrderDto,
  UpdateOrderDto,
  UpdateStatusDto,
} from '../common/dto';
import { OrderStatus, ServiceType } from '../common/enums';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(
    @Query('customerId') customerId?: string,
    @Query('status') status?: OrderStatus,
    @Query('openOnly') openOnly?: string,
    @Query('service') service?: ServiceType,
    @Query('q') q?: string,
  ) {
    return this.ordersService.findAll({
      customerId,
      status,
      openOnly: openOnly === 'true' || openOnly === '1',
      service,
      q,
    });
  }

  @Get(':id/overview')
  getOverview(@Param('id') id: string) {
    return this.ordersService.getOverview(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateOrderDto) {
    return this.ordersService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateOrderDto) {
    return this.ordersService.update(id, data);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    return this.ordersService.updateStatus(id, body.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.ordersService.remove(id);
    return { deleted: true };
  }
}
