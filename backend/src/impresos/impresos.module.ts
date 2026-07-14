import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ImpresosController } from './impresos.controller';
import { ImpresosService } from './impresos.service';

@Module({
  imports: [SettingsModule],
  controllers: [ImpresosController],
  providers: [ImpresosService],
  exports: [ImpresosService],
})
export class ImpresosModule {}
