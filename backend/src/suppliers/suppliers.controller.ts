import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateSupplierDto, UpdateSupplierDto } from '../common/dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get(':id/order-draft')
  orderDraft(@Param('id') id: string) {
    return this.suppliersService.orderDraft(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateSupplierDto) {
    return this.suppliersService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateSupplierDto) {
    return this.suppliersService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.suppliersService.remove(id);
    return { deleted: true };
  }
}
