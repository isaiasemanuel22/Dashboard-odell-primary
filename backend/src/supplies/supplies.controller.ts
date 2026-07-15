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
import { SupplyCategory, SupplyType } from '../common/enums';
import {
  CreateSupplyDto,
  SupplyDefaultPriceDto,
  UpdateSupplyDto,
} from '../common/dto';
import { SuppliesService } from './supplies.service';

@Controller('supplies')
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Get()
  findAll(
    @Query('type') type?: SupplyType,
    @Query('category') category?: SupplyCategory,
  ) {
    return this.suppliesService.findAll(type, category);
  }

  @Get('low-stock')
  findLowStock() {
    return this.suppliesService.findLowStock();
  }

  @Post('default-price')
  getDefaultPrice(@Body() data: SupplyDefaultPriceDto) {
    return this.suppliesService.resolveDefaultPrice(data as never);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliesService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateSupplyDto) {
    return this.suppliesService.create(data as never);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateSupplyDto) {
    return this.suppliesService.update(id, data as never);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.suppliesService.remove(id);
    return { deleted: true };
  }
}
