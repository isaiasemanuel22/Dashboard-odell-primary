import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbButtonComponent,
  DbCheckboxComponent,
  DbFormGridComponent,
  DbInputComponent,
  DbSelectComponent,
  DbSelectOption,
  MobileToggleRowComponent,
} from '@general-components';
import {
  ColorConfig,
  MachineProfile,
  MachineProfileRole,
  ProductType,
} from '../../../../core/models';

const WEEKDAY_CHIPS: { value: number; label: string }[] = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'M' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];

@Component({
  selector: 'app-general-values-profile-editor',
  standalone: true,
  imports: [
    FormsModule,
    DbFormGridComponent,
    DbInputComponent,
    DbSelectComponent,
    DbCheckboxComponent,
    DbButtonComponent,
    MobileToggleRowComponent,
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
  @Input() colors: ColorConfig[] = [];
  @Input() saving = false;
  /** En hoja mobile: sin tip «Se abre desde…» y con «Quitar equipo». */
  @Input() sheetMode = false;

  @Output() cancelEdit = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();
  @Output() costBaseChange = new EventEmitter<boolean>();

  readonly weekdayChips = WEEKDAY_CHIPS;

  get isWash(): boolean {
    return this.profile.role === MachineProfileRole.WASH;
  }

  get showPrintQueue(): boolean {
    return (
      this.profile.role === MachineProfileRole.PRINT &&
      this.profile.productType === ProductType.FDM
    );
  }

  get productTypeValue(): string {
    return this.profile.productType ?? '';
  }

  get amsSlotOptions(): DbSelectOption[] {
    return [
      { value: '', label: 'Vacía' },
      ...this.colors.map((color) => ({
        value: color.id,
        label: color.name,
      })),
    ];
  }

  get amsSlots(): (string | null)[] {
    const slots = this.profile.amsSlots ?? [null, null, null, null];
    const padded = slots.slice(0, 4);
    while (padded.length < 4) padded.push(null);
    return padded;
  }

  onRoleChange(): void {
    if (
      this.isWash &&
      (this.profile.washBathUses === undefined ||
        this.profile.washBathUses === null)
    ) {
      this.profile.washBathUses = 10;
    }
    this.ensurePrintQueueDefaults();
  }

  setProductType(value: string): void {
    this.profile.productType = value ? (value as ProductType) : undefined;
    this.ensurePrintQueueDefaults();
  }

  setQueueEnabled(enabled: boolean): void {
    this.ensurePrintQueueDefaults();
    this.profile.queueEnabled = enabled;
  }

  setCostBase(enabled: boolean): void {
    // No mutar el perfil acá: puede venir congelado del store (NgRx).
    // El padre reemplaza machineProfiles con copias (spread).
    this.costBaseChange.emit(enabled);
  }

  toggleWeekday(day: number): void {
    this.ensurePrintQueueDefaults();
    const current = new Set(this.profile.workWeekdays ?? []);
    if (current.has(day)) {
      current.delete(day);
    } else {
      current.add(day);
    }
    this.profile.workWeekdays = [...current].sort((a, b) => a - b);
  }

  isWeekdayOn(day: number): boolean {
    return (this.profile.workWeekdays ?? [1, 2, 3, 4, 5, 6]).includes(day);
  }

  slotValue(index: number): string {
    return this.amsSlots[index] ?? '';
  }

  setSlot(index: number, value: string): void {
    this.ensurePrintQueueDefaults();
    const slots = [...this.amsSlots];
    slots[index] = value || null;
    this.profile.amsSlots = slots;
  }

  slotHex(index: number): string | null {
    const id = this.amsSlots[index];
    if (!id) return null;
    return this.colors.find((color) => color.id === id)?.hex ?? null;
  }

  private ensurePrintQueueDefaults(): void {
    if (!this.showPrintQueue) return;
    if (this.profile.workHoursPerDay == null) {
      this.profile.workHoursPerDay = 16;
    }
    if (!this.profile.workStartHour) {
      this.profile.workStartHour = '08:00';
    }
    if (!this.profile.workWeekdays?.length) {
      this.profile.workWeekdays = [1, 2, 3, 4, 5, 6];
    }
    if (!this.profile.amsSlots || this.profile.amsSlots.length < 4) {
      this.profile.amsSlots = this.amsSlots;
    }
  }
}
