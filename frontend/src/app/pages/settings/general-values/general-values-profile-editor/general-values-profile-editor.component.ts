import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbButtonComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
} from '@general-components';
import { MachineProfile, MachineProfileRole, ProductType } from '../../../../core/models';

@Component({
  selector: 'app-general-values-profile-editor',
  standalone: true,
  imports: [
    FormsModule,
    DbFormGridComponent,
    DbInputComponent,
    DbSelectComponent,
    DbButtonComponent,
  ],
  templateUrl: './general-values-profile-editor.component.html',
  styleUrl: './general-values-profile-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralValuesProfileEditorComponent {
  @Input({ required: true }) profile!: MachineProfile;
  @Input() roleOptions: DbSelectOption[] = [];
  @Input() productTypeOptions: DbSelectOption[] = [];
  @Input() supplyOptions: DbSelectOption[] = [];
  @Input() saving = false;

  @Output() cancelEdit = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  get isWash(): boolean {
    return this.profile.role === MachineProfileRole.WASH;
  }

  get productTypeValue(): string {
    return this.profile.productType ?? '';
  }

  onRoleChange(): void {
    if (
      this.isWash &&
      (this.profile.washBathUses === undefined || this.profile.washBathUses === null)
    ) {
      this.profile.washBathUses = 10;
    }
  }

  setProductType(value: string): void {
    this.profile.productType = value ? (value as ProductType) : undefined;
  }
}
