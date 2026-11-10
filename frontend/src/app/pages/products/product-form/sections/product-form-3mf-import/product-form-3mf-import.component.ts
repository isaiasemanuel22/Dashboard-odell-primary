import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ColorConfig,
  FdmFilamentLine,
  FilamentType,
  ProductAttachment,
} from '../../../../../core/models';
import { FormDialogService } from '../../../../../modals/form-dialog.service';
import { SettingsFacade } from '../../../../../store/settings/settings.facade';
import { nearestCatalogColorId } from '../../../../../shared/utils/color.helpers';
import {
  createEmptyFdmFilamentLine,
  createFdmFilamentLineId,
  hasValidFdmFilamentInput,
  normalizePurgeGrams,
} from '../../../../../shared/utils/fdm.helpers';
import {
  BAMBU_3MF_READ_ERROR,
  Bambu3mfParseResult,
  mapBambuFilamentType,
  parseBambu3mfFile,
} from '../../../../../shared/utils/bambu-3mf.parser';
import { DbButtonComponent } from '../../../../../components/db-button/db-button.component';

export interface ProductForm3mfApplyPayload {
  file: File;
  result: Bambu3mfParseResult;
  filaments: FdmFilamentLine[];
  printTimeHours: number | null;
  purgeGrams: number | null;
  colorChanges: number | null;
}

@Component({
  selector: 'app-product-form-3mf-import',
  standalone: true,
  imports: [DbButtonComponent],
  templateUrl: './product-form-3mf-import.component.html',
  styleUrl: './product-form-3mf-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductForm3mfImportComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialogs = inject(FormDialogService);
  private readonly settingsFacade = inject(SettingsFacade);

  @Input() existingFilaments: FdmFilamentLine[] = [];
  @Input() existingPrintHours = 0;
  /** .3mf ya guardado en el producto (edición). */
  @Input() existingAttachment: ProductAttachment | null = null;
  /** Valores del producto para la línea «Guardado: …». */
  @Input() savedPrintHours = 0;
  @Input() savedGrams = 0;
  @Input() savedColorCount = 0;
  @Output() readonly applied = new EventEmitter<ProductForm3mfApplyPayload>();

  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  fileName: string | null = null;
  /** Una sola línea: «Leído: …» o «Guardado: …». */
  cardSummary: string | null = null;
  fromBambu = false;
  /** Tras CORS u otro fallo de descarga, se oculta «Volver a leer». */
  rereadAvailable = false;
  noteKind: 'ok' | 'warn' | null = null;
  noteText = '';
  reading = false;
  dragOver = false;
  error = '';

  private seededFromAttachment = false;
  private sessionRead = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['existingAttachment'] ||
      changes['savedPrintHours'] ||
      changes['savedGrams'] ||
      changes['savedColorCount']
    ) {
      this.syncExistingAttachmentCard();
    }
  }

  get hasCard(): boolean {
    return !!this.fileName;
  }

  /** Solo con adjunto persistido y si la descarga CORS sigue disponible. */
  get showRereadButton(): boolean {
    return (
      this.rereadAvailable &&
      !!this.existingAttachment?.url &&
      !this.sessionRead
    );
  }

  onBrowse(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file) void this.handleFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
    this.cdr.markForCheck();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    this.cdr.markForCheck();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) void this.handleFile(file);
    this.cdr.markForCheck();
  }

  onChangeFile(): void {
    this.onBrowse();
  }

  async onReread(): Promise<void> {
    const attachment = this.existingAttachment;
    if (!attachment?.url || !this.rereadAvailable) return;

    this.reading = true;
    this.error = '';
    this.cdr.markForCheck();

    try {
      const res = await fetch(attachment.url, { mode: 'cors' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const file = new File([blob], attachment.name || 'modelo.3mf', {
        type: blob.type || 'model/3mf',
      });
      this.reading = false;
      await this.handleFile(file);
    } catch {
      this.rereadAvailable = false;
      this.reading = false;
      this.cdr.markForCheck();
    }
  }

  private syncExistingAttachmentCard(): void {
    const attachment = this.existingAttachment;
    if (!attachment) {
      this.rereadAvailable = false;
      if (this.seededFromAttachment && !this.sessionRead) {
        this.fileName = null;
        this.cardSummary = null;
        this.fromBambu = false;
        this.seededFromAttachment = false;
      }
      this.cdr.markForCheck();
      return;
    }

    if (!this.sessionRead) {
      this.fileName = attachment.name;
      this.fromBambu = false;
      this.cardSummary = buildSavedSummary(
        this.savedPrintHours,
        this.savedGrams,
        this.savedColorCount,
      );
      this.seededFromAttachment = true;
      this.rereadAvailable = true;
    }

    this.cdr.markForCheck();
  }

  private async handleFile(file: File): Promise<void> {
    if (!/\.3mf$/i.test(file.name)) {
      this.error = BAMBU_3MF_READ_ERROR;
      this.cdr.markForCheck();
      return;
    }

    const needsConfirm =
      hasValidFdmFilamentInput(this.existingFilaments) ||
      Number(this.existingPrintHours) > 0;

    if (needsConfirm) {
      const ok = await firstValueFrom(
        this.dialogs.openConfirm({
          title: 'Reemplazar datos de impresión',
          message:
            'Se van a reemplazar los filamentos y el tiempo cargados. ¿Seguimos?',
          confirmLabel: 'Reemplazar',
          cancelLabel: 'Cancelar',
        }),
      );
      if (!ok) return;
    }

    this.reading = true;
    this.error = '';
    this.cdr.markForCheck();

    try {
      const result = await parseBambu3mfFile(file);
      const settings = this.settingsFacade.peekGeneralSettings();
      const catalog: ColorConfig[] = settings?.colors ?? [];
      const filaments = this.toFilamentLines(result, catalog);

      this.sessionRead = true;
      this.fileName = file.name;
      this.fromBambu = result.slicer === 'bambu';
      this.cardSummary = this.buildSummary(result);
      if (result.warnings.length) {
        this.noteKind = 'warn';
        this.noteText = result.warnings.join(' ');
      } else if (result.sliced) {
        this.noteKind = 'ok';
        this.noteText =
          'Completamos gramos, tiempo, colores y purga desde el archivo. Podés corregir cualquier valor.';
      } else {
        this.noteKind = 'warn';
        this.noteText = result.warnings[0] ?? '';
      }

      this.applied.emit({
        file,
        result,
        filaments,
        printTimeHours: result.printHours,
        purgeGrams: normalizePurgeGrams(result.purgeGrams),
        colorChanges: result.colorChanges,
      });
    } catch (err: unknown) {
      this.fileName = this.existingAttachment?.name ?? null;
      this.cardSummary = null;
      this.fromBambu = false;
      this.sessionRead = false;
      this.noteKind = null;
      this.noteText = '';
      this.error =
        err instanceof Error && err.message
          ? err.message
          : BAMBU_3MF_READ_ERROR;
      this.syncExistingAttachmentCard();
    } finally {
      this.reading = false;
      this.cdr.markForCheck();
    }
  }

  private toFilamentLines(
    result: Bambu3mfParseResult,
    catalog: ColorConfig[],
  ): FdmFilamentLine[] {
    if (!result.filaments.length) {
      return [createEmptyFdmFilamentLine(FilamentType.PLA)];
    }
    return result.filaments.map((f) => ({
      id: createFdmFilamentLineId(),
      filamentType: mapBambuFilamentType(f.type) as FilamentType,
      grams: Math.max(0, Number(f.grams) || 0),
      colorId: nearestCatalogColorId(f.color, catalog),
      source: '3mf' as const,
    }));
  }

  private buildSummary(result: Bambu3mfParseResult): string {
    const parts: string[] = [];
    if (result.printHours != null) {
      parts.push(formatHoursLabel(result.printHours));
    }
    if (result.totalGrams != null) {
      parts.push(`${formatNumber(result.totalGrams)} g`);
    }
    const colors = result.filaments.length;
    if (colors > 0) {
      parts.push(`${colors} ${colors === 1 ? 'color' : 'colores'}`);
    }
    parts.push(`placa ${result.plate} de ${result.plateCount}`);
    return `Leído: ${parts.join(' · ')}`;
  }
}

function buildSavedSummary(
  hours: number,
  grams: number,
  colorCount: number,
): string | null {
  const h = Number(hours) || 0;
  const g = Number(grams) || 0;
  const n = Math.max(0, Math.trunc(Number(colorCount) || 0));
  if (h <= 0 && g <= 0 && n <= 0) return null;
  const parts: string[] = [];
  if (h > 0) parts.push(formatHoursLabel(h));
  if (g > 0) parts.push(`${formatNumber(g)} g`);
  if (n > 0) parts.push(`${n} ${n === 1 ? 'color' : 'colores'}`);
  return parts.length ? `Guardado: ${parts.join(' · ')}` : null;
}

function formatHoursLabel(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m} min`;
  if (m <= 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 1,
  }).format(n);
}
