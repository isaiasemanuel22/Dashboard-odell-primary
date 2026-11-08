import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdjustSpoolDto, MoveSpoolDto, OpenSpoolDto } from '../common/dto';
import { SpoolsService } from './spools.service';

@Controller('spools')
export class SpoolsController {
  constructor(private readonly spoolsService: SpoolsService) {}

  @Get('alerts')
  getAlerts() {
    return this.spoolsService.getAlerts();
  }

  @Get()
  findAll(
    @Query('open') open?: string,
    @Query('supplyId') supplyId?: string,
    @Query('printerId') printerId?: string,
  ) {
    const openFilter =
      open === undefined
        ? true
        : open === 'true' || open === '1'
          ? true
          : open === 'false' || open === '0'
            ? false
            : true;
    return this.spoolsService.findAll({
      open: openFilter,
      supplyId,
      printerId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.spoolsService.findOne(id);
  }

  @Post()
  open(@Body() data: OpenSpoolDto) {
    return this.spoolsService.open(data);
  }

  @Patch(':id')
  move(@Param('id') id: string, @Body() data: MoveSpoolDto) {
    // Compat: body con location = mover; con remainingGrams = ajustar.
    if (
      data &&
      typeof data === 'object' &&
      'remainingGrams' in (data as object) &&
      !('location' in (data as object))
    ) {
      return this.spoolsService.adjust(id, data as unknown as AdjustSpoolDto);
    }
    return this.spoolsService.move(id, data);
  }

  @Patch(':id/adjust')
  adjust(@Param('id') id: string, @Body() data: AdjustSpoolDto) {
    return this.spoolsService.adjust(id, data);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string) {
    return this.spoolsService.finish(id);
  }
}
