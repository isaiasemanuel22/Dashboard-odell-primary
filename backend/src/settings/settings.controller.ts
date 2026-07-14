import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CalculateCostDto,
  FilamentPriceDto,
  MachineCostEntryDto,
  PowerConsumptionEntryDto,
  ResetDatabaseDto,
  ResinPriceDto,
  SupplyDefaultPriceDto,
  UpdateGeneralSettingsDto,
} from '../common/dto';
import { CostCalculatorService } from './cost-calculator.service';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly costCalculator: CostCalculatorService,
  ) {}

  @Get('general')
  getGeneral() {
    return this.settingsService.getGeneralSettings();
  }

  @Patch('general')
  updateGeneral(@Body() data: UpdateGeneralSettingsDto) {
    return this.settingsService.updateGeneralSettings(data as never);
  }

  @Post('general/filament-prices')
  addFilamentPrice(@Body() data: FilamentPriceDto) {
    return this.settingsService.addFilamentPrice(data as never);
  }

  @Patch('general/filament-prices/:id')
  updateFilamentPrice(
    @Param('id') id: string,
    @Body() data: Partial<FilamentPriceDto>,
  ) {
    return this.settingsService.updateFilamentPrice(id, data as never);
  }

  @Delete('general/filament-prices/:id')
  removeFilamentPrice(@Param('id') id: string) {
    this.settingsService.removeFilamentPrice(id);
    return { deleted: true };
  }

  @Post('general/resin-prices')
  addResinPrice(@Body() data: ResinPriceDto) {
    return this.settingsService.addResinPrice(data as never);
  }

  @Patch('general/resin-prices/:id')
  updateResinPrice(
    @Param('id') id: string,
    @Body() data: Partial<ResinPriceDto>,
  ) {
    return this.settingsService.updateResinPrice(id, data as never);
  }

  @Delete('general/resin-prices/:id')
  removeResinPrice(@Param('id') id: string) {
    this.settingsService.removeResinPrice(id);
    return { deleted: true };
  }

  @Post('general/power-consumptions')
  addPowerConsumption(@Body() data: PowerConsumptionEntryDto) {
    return this.settingsService.addPowerConsumption(data);
  }

  @Patch('general/power-consumptions/:id')
  updatePowerConsumption(
    @Param('id') id: string,
    @Body() data: Partial<PowerConsumptionEntryDto>,
  ) {
    return this.settingsService.updatePowerConsumption(id, data);
  }

  @Delete('general/power-consumptions/:id')
  removePowerConsumption(@Param('id') id: string) {
    this.settingsService.removePowerConsumption(id);
    return { deleted: true };
  }

  @Post('general/machine-costs')
  addMachineCost(@Body() data: MachineCostEntryDto) {
    return this.settingsService.addMachineCost(data);
  }

  @Patch('general/machine-costs/:id')
  updateMachineCost(
    @Param('id') id: string,
    @Body() data: Partial<MachineCostEntryDto>,
  ) {
    return this.settingsService.updateMachineCost(id, data);
  }

  @Delete('general/machine-costs/:id')
  removeMachineCost(@Param('id') id: string) {
    this.settingsService.removeMachineCost(id);
    return { deleted: true };
  }

  @Post('calculate-cost')
  calculateCost(@Body() data: CalculateCostDto) {
    return this.costCalculator.calculateCost(data as never);
  }

  @Post('supply-default-price')
  getSupplyDefaultPrice(@Body() data: SupplyDefaultPriceDto) {
    return this.costCalculator.getUnitPriceForSupply(
      data.type as import('../common/enums').SupplyType,
      data.brand,
      data.filamentType as import('../common/enums').FilamentType,
      data.resinType as import('../common/enums').ResinType,
    );
  }

  @Post('reset-database')
  resetDatabase(@Body() body: ResetDatabaseDto) {
    return this.settingsService.resetDatabase(body.code);
  }
}
