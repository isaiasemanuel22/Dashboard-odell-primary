import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
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
  Spool,
  Supply,
} from '../../../../core/models';
import { SpoolsService } from '../../../../core/services/spools.service';
import { SuppliesService } from '../../../../core/services/supplies.service';

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

export interface LiveAmsSlotView {
  slot: number;
  code: string | null;
  colorName: string | null;
  hex: string | null;
  remainingGrams: number | null;
  empty: boolean;
}

@Component({
  selector: 'app-general-values-profile-editor',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
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
export class GeneralValuesProfileEditorComponent
  implements OnChanges, OnDestroy
{
  private readonly spoolsService = inject(SpoolsService);
  private readonly suppliesService = inject(SuppliesService);
  private slotsSub?: Subscription;

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
  readonly liveAmsSlots = signal<LiveAmsSlotView[]>(this.emptySlots());

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profile'] || changes['colors']) {
      this.reloadLiveAms();
    }
  }

  ngOnDestroy(): void {
    this.slotsSub?.unsubscribe();
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

  slotLabel(slot: LiveAmsSlotView): string {
    if (slot.empty) return 'Vacía';
    const grams =
      slot.remainingGrams != null
        ? `${Math.round(slot.remainingGrams)} g`
        : '';
    const color = slot.colorName?.trim() || 'Sin color';
    const code = slot.code ?? '—';
    return grams ? `${code} · ${color} · ${grams}` : `${code} · ${color}`;
  }

  private reloadLiveAms(): void {
    this.slotsSub?.unsubscribe();
    if (!this.showPrintQueue || !this.profile?.id) {
      this.liveAmsSlots.set(this.emptySlots());
      return;
    }
    const printerId = this.profile.id;
    this.slotsSub = forkJoin({
      spools: this.spoolsService.list({ open: true, printerId }).pipe(
        catchError(() => of([] as Spool[])),
      ),
      supplies: this.suppliesService.getSupplies().pipe(
        take(1),
        catchError(() => of([] as Supply[])),
      ),
    }).subscribe(({ spools, supplies }) => {
      this.liveAmsSlots.set(
        this.buildLiveSlots(printerId, spools, supplies, this.colors),
      );
    });
  }

  private buildLiveSlots(
    printerId: string,
    spools: Spool[],
    supplies: Supply[],
    colors: ColorConfig[],
  ): LiveAmsSlotView[] {
    const supplyById = new Map(supplies.map((s) => [s.id, s]));
    const bySlot = new Map<number, Spool>();
    for (const spool of spools) {
      if (spool.finishedAt) continue;
      if (spool.location.kind !== 'printer') continue;
      if (spool.location.printerId !== printerId) continue;
      const slot = Number(spool.location.slot);
      if (slot < 1 || slot > 4) continue;
      const prev = bySlot.get(slot);
      if (
        !prev ||
        Number(spool.remainingGrams) < Number(prev.remainingGrams)
      ) {
        bySlot.set(slot, spool);
      }
    }

    return [1, 2, 3, 4].map((slot) => {
      const spool = bySlot.get(slot);
      if (!spool) {
        return {
          slot,
          code: null,
          colorName: null,
          hex: null,
          remainingGrams: null,
          empty: true,
        };
      }
      const supply = supplyById.get(spool.supplyId);
      const color = supply?.colorId
        ? (colors.find((c) => c.id === supply.colorId) ?? null)
        : null;
      return {
        slot,
        code: spool.code,
        colorName: color?.name ?? null,
        hex: color?.hex ?? null,
        remainingGrams: Number(spool.remainingGrams),
        empty: false,
      };
    });
  }

  private emptySlots(): LiveAmsSlotView[] {
    return [1, 2, 3, 4].map((slot) => ({
      slot,
      code: null,
      colorName: null,
      hex: null,
      remainingGrams: null,
      empty: true,
    }));
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
