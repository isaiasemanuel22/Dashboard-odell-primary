import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbSelectComponent, DbInputComponent, DbSelectOption } from '@general-components';
import { FilamentType, ResinType } from '../../../../core/models';

@Component({
  selector: 'app-supply-form-material',
  standalone: true,
  imports: [FormsModule, DbSelectComponent, DbInputComponent],
  templateUrl: './supply-form-material.component.html',
  styleUrl: './supply-form-material.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class SupplyFormMaterialComponent {
  @Input() isFilament = false;
  @Input() isResin = false;
  @Input() showColorField = false;
  @Input() filamentType: FilamentType | string = '';
  @Input() resinType: ResinType | string = '';
  @Input() brand = '';
  @Input() colorId = '';
  @Input() selectedColorHex?: string;
  @Input() filamentTypeOptions: DbSelectOption[] = [];
  @Input() resinTypeOptions: DbSelectOption[] = [];
  @Input() filamentBrandOptions: DbSelectOption[] = [];
  @Input() resinBrandOptions: DbSelectOption[] = [];
  @Input() colorOptions: DbSelectOption[] = [];

  @Output() filamentTypeChange = new EventEmitter<FilamentType>();
  @Output() resinTypeChange = new EventEmitter<ResinType>();
  @Output() brandChange = new EventEmitter<string>();
  @Output() colorIdChange = new EventEmitter<string>();
}
