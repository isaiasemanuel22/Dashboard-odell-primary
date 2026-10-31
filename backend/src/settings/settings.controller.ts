import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ColorConfigDto,
  FilamentPriceDto,
  FilamentTypeConfigDto,
  MachineCostEntryDto,
  MachineProfileDto,
  PowerConsumptionEntryDto,
  ResetDatabaseDto,
  ResinPriceDto,
  ResinTypeConfigDto,
  SupplyDefaultPriceDto,
  UpdateCoreValuesDto,
  LegacyPatchGeneralSettingsDto,
  UpdateGeneralSettingsDto,
  UpdateMachineProfileDto,
  UpdatePaperPricesDto,
  UpdateProfitMarginsDto,
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
  updateGeneral(@Body() data: LegacyPatchGeneralSettingsDto) {
    return this.settingsService.patchGeneralSettings(data);
  }

  @Patch('core-values')
  updateCoreValues(@Body() data: UpdateCoreValuesDto) {
    return this.settingsService.updateCoreValues(data);
  }

  @Patch('profit-margins')
  updateProfitMargins(@Body() data: UpdateProfitMarginsDto) {
    return this.settingsService.updateProfitMargins(data.profitMargins);
  }

  @Patch('paper-prices')
  updatePaperPrices(@Body() data: UpdatePaperPricesDto) {
    return this.settingsService.updatePaperPrices(data.paperReferenceSheets);
  }

  @Get('machine-profiles')
  getMachineProfiles() {
    return this.settingsService.getMachineProfiles();
  }

  @Post('machine-profiles')
  addMachineProfile(@Body() data: MachineProfileDto) {
    return this.settingsService.addMachineProfile(data as never);
  }

  @Patch('machine-profiles/:id')
  updateMachineProfile(
    @Param('id') id: string,
    @Body() data: UpdateMachineProfileDto,
  ) {
    return this.settingsService.updateMachineProfile(id, data as never);
  }

  @Delete('machine-profiles/:id')
  removeMachineProfile(@Param('id') id: string) {
    this.settingsService.removeMachineProfile(id);
    return { deleted: true };
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

  @Post('general/filament-types')
  addFilamentType(@Body() data: FilamentTypeConfigDto) {
    return this.settingsService.addFilamentType(data);
  }

  @Patch('general/filament-types/:id')
  updateFilamentType(
    @Param('id') id: string,
    @Body() data: Partial<FilamentTypeConfigDto>,
  ) {
    return this.settingsService.updateFilamentType(id, data);
  }

  @Delete('general/filament-types/:id')
  removeFilamentType(@Param('id') id: string) {
    this.settingsService.removeFilamentType(id);
    return { deleted: true };
  }

  @Post('general/resin-types')
  addResinType(@Body() data: ResinTypeConfigDto) {
    return this.settingsService.addResinType(data);
  }

  @Patch('general/resin-types/:id')
  updateResinType(
    @Param('id') id: string,
    @Body() data: Partial<ResinTypeConfigDto>,
  ) {
    return this.settingsService.updateResinType(id, data);
  }

  @Delete('general/resin-types/:id')
  removeResinType(@Param('id') id: string) {
    this.settingsService.removeResinType(id);
    return { deleted: true };
  }

  @Post('general/colors')
  addColor(@Body() data: ColorConfigDto) {
    return this.settingsService.addColor(data);
  }

  @Patch('general/colors/:id')
  updateColor(@Param('id') id: string, @Body() data: Partial<ColorConfigDto>) {
    return this.settingsService.updateColor(id, data);
  }

  @Delete('general/colors/:id')
  removeColor(@Param('id') id: string) {
    this.settingsService.removeColor(id);
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

  @Post('supply-default-price')
  getSupplyDefaultPrice(@Body() data: SupplyDefaultPriceDto) {
    return this.costCalculator.getUnitPriceForSupply(
      data.category,
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
