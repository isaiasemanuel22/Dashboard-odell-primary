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

const DEFAULT_WORK_WEEKDAYS = [1, 2, 3, 4, 5, 6];

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
  @Output() profileChange = new EventEmitter<MachineProfile>();

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
    return this.paddedAmsSlots(this.profile.amsSlots);
  }

  setName(name: string): void {
    this.emitProfile({ ...this.profile, name });
  }

  setWatts(watts: number): void {
    this.emitProfile({ ...this.profile, watts });
  }

  setCostPerHour(costPerHour: number): void {
    this.emitProfile({ ...this.profile, costPerHour });
  }

  setWashSupplyId(washSupplyId: string): void {
    this.emitProfile({ ...this.profile, washSupplyId });
  }

  setConsumptionMl(consumptionMl: number): void {
    this.emitProfile({ ...this.profile, consumptionMl });
  }

  setWashBathUses(washBathUses: number): void {
    this.emitProfile({ ...this.profile, washBathUses });
  }

  setWorkHoursPerDay(workHoursPerDay: number): void {
    this.emitProfile(
      this.withPrintQueueDefaults({ ...this.profile, workHoursPerDay }),
    );
  }

  setWorkStartHour(workStartHour: string): void {
    this.emitProfile(
      this.withPrintQueueDefaults({ ...this.profile, workStartHour }),
    );
  }

  setAmsType(amsType: string): void {
    this.emitProfile(this.withPrintQueueDefaults({ ...this.profile, amsType }));
  }

  onRoleChange(role: MachineProfileRole): void {
    let next: MachineProfile = { ...this.profile, role };
    if (
      role === MachineProfileRole.WASH &&
      (next.washBathUses === undefined || next.washBathUses === null)
    ) {
      next = { ...next, washBathUses: 10 };
    }
    this.emitProfile(this.withPrintQueueDefaults(next));
  }

  setProductType(value: string): void {
    const productType = value ? (value as ProductType) : undefined;
    this.emitProfile(
      this.withPrintQueueDefaults({ ...this.profile, productType }),
    );
  }

  setQueueEnabled(enabled: boolean): void {
    this.emitProfile(
      this.withPrintQueueDefaults({ ...this.profile, queueEnabled: enabled }),
    );
  }

  setCostBase(enabled: boolean): void {
    // No mutar el perfil acá: puede venir congelado del store (NgRx).
    // El padre reemplaza machineProfiles con copias (spread).
    this.costBaseChange.emit(enabled);
  }

  toggleWeekday(day: number): void {
    const current = new Set(this.profile.workWeekdays ?? []);
    if (current.has(day)) {
      current.delete(day);
    } else {
      current.add(day);
    }
    const workWeekdays = [...current].sort((a, b) => a - b);
    this.emitProfile(
      this.withPrintQueueDefaults({ ...this.profile, workWeekdays }),
    );
  }

  isWeekdayOn(day: number): boolean {
    return (this.profile.workWeekdays ?? DEFAULT_WORK_WEEKDAYS).includes(day);
  }

  slotValue(index: number): string {
    return this.amsSlots[index] ?? '';
  }

  setSlot(index: number, value: string): void {
    const slots = [...this.amsSlots];
    slots[index] = value || null;
    this.emitProfile(
      this.withPrintQueueDefaults({ ...this.profile, amsSlots: slots }),
    );
  }

  slotHex(index: number): string | null {
    const id = this.amsSlots[index];
    if (!id) return null;
    return this.colors.find((color) => color.id === id)?.hex ?? null;
  }

  private emitProfile(next: MachineProfile): void {
    this.profileChange.emit(next);
  }

  private paddedAmsSlots(value?: (string | null)[]): (string | null)[] {
    const slots = (value ?? [null, null, null, null]).slice(0, 4);
    while (slots.length < 4) slots.push(null);
    return slots;
  }

  private withPrintQueueDefaults(profile: MachineProfile): MachineProfile {
    const showPrintQueue =
      profile.role === MachineProfileRole.PRINT &&
      profile.productType === ProductType.FDM;
    if (!showPrintQueue) return profile;

    return {
      ...profile,
      workHoursPerDay:
        profile.workHoursPerDay == null ? 16 : profile.workHoursPerDay,
      workStartHour: profile.workStartHour || '08:00',
      workWeekdays: profile.workWeekdays?.length
        ? profile.workWeekdays
        : [...DEFAULT_WORK_WEEKDAYS],
      amsSlots: this.paddedAmsSlots(profile.amsSlots),
    };
  }
}
