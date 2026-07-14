import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductType } from '../common/enums';
import {
  CreateProductDto,
  ProductPricingInputDto,
  UpdateProductDto,
} from '../common/dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Query('type') type?: ProductType,
    @Query('all') all?: string,
  ) {
    const includeUnpublished = all === 'true' || all === '1';
    return this.productsService.findAll(type, includeUnpublished);
  }

  @Post('preview-pricing')
  previewPricing(@Body() data: ProductPricingInputDto) {
    return this.productsService.previewPricing(data);
  }

  @Get(':id/overview')
  getOverview(@Param('id') id: string) {
    return this.productsService.getOverview(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateProductDto) {
    return this.productsService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateProductDto) {
    return this.productsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.productsService.remove(id);
    return { deleted: true };
  }
}
