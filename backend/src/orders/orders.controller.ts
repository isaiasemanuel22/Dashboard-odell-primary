import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiScopes } from '../auth/api-scopes.decorator';
import {
  CreateOrderDto,
  CreateOrderDeliveryDto,
  CreateOrderPaymentDto,
  MarkInvoiceDto,
  OrderWhatsAppLogDto,
  VoidOrderPaymentDto,
  OrderPriceDecisionDto,
  UpdateOrderDto,
  UpdateStatusDto,
} from '../common/dto';
import { OrderStatus, ServiceType } from '../common/enums';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiScopes('pedidos:leer')
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

  @ApiScopes('pedidos:leer')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateOrderDto) {
    if (!data.responsibleUserId?.trim()) {
      throw new BadRequestException('El responsable es obligatorio');
    }
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

  @Post(':id/price-decision')
  decidePrice(@Param('id') id: string, @Body() body: OrderPriceDecisionDto) {
    return body.action === 'apply'
      ? this.ordersService.applyCatalogPrices(id)
      : this.ordersService.keepCatalogPrices(id);
  }

  @Put(':id/invoice')
  markInvoice(@Param('id') id: string, @Body() body: MarkInvoiceDto) {
    return this.ordersService.markInvoice(id, body);
  }

  @Delete(':id/invoice')
  removeInvoice(@Param('id') id: string) {
    return this.ordersService.removeInvoice(id);
  }

  @Post(':id/whatsapp-log')
  logWhatsApp(@Param('id') id: string, @Body() body: OrderWhatsAppLogDto) {
    return this.ordersService.logWhatsApp(id, body);
  }

  @Post(':id/payments')
  addPayment(@Param('id') id: string, @Body() body: CreateOrderPaymentDto) {
    return this.ordersService.addPayment(id, body);
  }

  @Post(':id/payments/:paymentId/void')
  voidPayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() body: VoidOrderPaymentDto,
  ) {
    return this.ordersService.voidPayment(id, paymentId, body.reason);
  }

  @Post(':id/deliveries')
  deliver(@Param('id') id: string, @Body() body: CreateOrderDeliveryDto) {
    return this.ordersService.deliver(id, body.items);
  }

  @Post(':id/deliver-all')
  deliverAll(@Param('id') id: string) {
    return this.ordersService.deliverAll(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.ordersService.remove(id);
    return { deleted: true };
  }
}
