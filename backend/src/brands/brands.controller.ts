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
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { BrandMaterialType } from '../common/enums';
import { BrandsService } from './brands.service';

class BrandBodyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsEnum(BrandMaterialType, { each: true })
  materialTypes?: BrandMaterialType[];
}

class UpdateBrandBodyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(BrandMaterialType, { each: true })
  materialTypes?: BrandMaterialType[];
}

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  findAll(@Query('materialType') materialType?: BrandMaterialType) {
    return this.brandsService.findAll(materialType);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.brandsService.findOne(id);
  }

  @Post()
  create(@Body() data: BrandBodyDto) {
    return this.brandsService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateBrandBodyDto) {
    return this.brandsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.brandsService.remove(id);
    return { deleted: true };
  }
}
