import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UpdateMaterialDto } from '../common/dto';
import { MaterialsService } from './materials.service';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  findAll() {
    return this.materialsService.findAll();
  }

  @Get('low-stock')
  findLowStock() {
    return this.materialsService.findLowStock();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateMaterialDto) {
    return this.materialsService.update(id, data);
  }
}
