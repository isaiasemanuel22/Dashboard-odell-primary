import { NgModule } from '@angular/core';
import { DashboardFormModule } from '../dashboard-form/dashboard-form.module';
import { DbButtonComponent } from '../db-button/db-button.component';
import { FormModalComponent } from '../form-modal/form-modal.component';

export const GENERAL_COMPONENTS = [
  DbButtonComponent,
  FormModalComponent,
] as const;

@NgModule({
  imports: [DashboardFormModule, ...GENERAL_COMPONENTS],
  exports: [DashboardFormModule, ...GENERAL_COMPONENTS],
})
export class GeneralComponentsModule {}
