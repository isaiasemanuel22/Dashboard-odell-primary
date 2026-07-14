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
import { PaperType } from '../common/enums';
import {
  CreateImpresoDto,
  ImpresoPreviewCostDto,
  UpdateImpresoDto,
} from '../common/dto';
import { ImpresosService } from './impresos.service';

@Controller('impresos')
export class ImpresosController {
  constructor(private readonly impresosService: ImpresosService) {}

  @Get()
  findAll(@Query('paperType') paperType?: PaperType) {
    return this.impresosService.findAll(paperType);
  }

  @Post('preview-cost')
  previewCost(@Body() data: ImpresoPreviewCostDto) {
    return this.impresosService.previewCost(
      data.paperType as PaperType,
      data.widthCm,
      data.heightCm,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.impresosService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateImpresoDto) {
    return this.impresosService.create(data as never);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateImpresoDto) {
    return this.impresosService.update(id, data as never);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.impresosService.remove(id);
    return { deleted: true };
  }
}
