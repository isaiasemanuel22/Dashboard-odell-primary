import {
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ColorConfig, GeneralSettings } from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import {
  DbButtonComponent,
  DbInputComponent,
  DbPillGroupComponent,
  DbRowMenuComponent,
  DbStateMessageComponent,
} from '@general-components';

type ColorFamily =
  | 'all'
  | 'neutros'
  | 'rojos'
  | 'naranjas'
  | 'verdes'
  | 'azules'
  | 'marrones';

@Component({
  selector: 'app-color-settings',
  standalone: true,
  imports: [
    FormsModule,
    DbButtonComponent,
    DbInputComponent,
    DbPillGroupComponent,
    DbRowMenuComponent,
    DbStateMessageComponent,
  ],
  templateUrl: './color-settings.component.html',
  styleUrl: './color-settings.component.scss',
})
export class ColorSettingsComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private settingsSub?: Subscription;

  settings: GeneralSettings | null = null;
  message = '';

  newColor = { name: '', hex: '#0E7AAB' };
  editingId: string | null = null;
  editForm = { name: '', hex: '#000000' };
  search = '';
  family: ColorFamily = 'all';
  openMenuId: string | null = null;

  readonly families: { value: ColorFamily; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'neutros', label: 'Neutros' },
    { value: 'rojos', label: 'Rojos y rosas' },
    { value: 'naranjas', label: 'Naranjas y amarillos' },
    { value: 'verdes', label: 'Verdes' },
    { value: 'azules', label: 'Azules y violetas' },
    { value: 'marrones', label: 'Marrones' },
  ];

  ngOnInit(): void {
    this.settingsSub = this.settingsService.watchGeneralSettings().subscribe((settings) => {
      this.settings = settings ? structuredClone(settings) : null;
    });
    this.settingsService.getGeneralSettings(false).subscribe();
  }

  ngOnDestroy(): void {
    this.settingsSub?.unsubscribe();
  }

  get previewHex(): string {
    const hex = this.newColor.hex.trim();
    if (!hex) return '#CCCCCC';
    return hex.startsWith('#') ? hex : `#${hex}`;
  }

  get visibleColors(): ColorConfig[] {
    const query = this.search.trim().toLowerCase();
    return (this.settings?.colors ?? [])
      .filter((color) => {
        const matchesFamily =
          this.family === 'all' || this.colorFamily(color.hex) === this.family;
        const matchesSearch =
          !query ||
          color.name.toLowerCase().includes(query) ||
          color.hex.toLowerCase().includes(query);
        return matchesFamily && matchesSearch;
      })
      .slice()
      .sort((a, b) => this.comparePaletteOrder(a, b));
  }

  focusCreate(): void {
    document.getElementById('new-color-name')?.focus();
  }

  toggleMenu(id: string): void {
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  addColor(): void {
    if (!this.newColor.name.trim() || !this.newColor.hex.trim()) return;

    this.settingsService.addColor({ ...this.newColor }).subscribe({
      next: () => {
        this.newColor = { name: '', hex: '#0E7AAB' };
        this.message = 'Color agregado al catálogo.';
      },
    });
  }

  startEdit(item: ColorConfig): void {
    this.openMenuId = null;
    this.editingId = item.id;
    this.editForm = { name: item.name, hex: item.hex };
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(): void {
    if (!this.editingId || !this.editForm.name.trim() || !this.editForm.hex.trim()) {
      return;
    }

    this.settingsService.updateColor(this.editingId, { ...this.editForm }).subscribe({
      next: () => {
        this.message = 'Color actualizado.';
        this.editingId = null;
      },
    });
  }

  deleteColor(id: string): void {
    this.openMenuId = null;
    if (!confirm('¿Eliminar este color del catálogo?')) return;
    this.settingsService.deleteColor(id).subscribe({
      next: () => {
        this.message = 'Color eliminado.';
      },
      error: () => {
        this.message =
          'No se pudo eliminar: el color está asignado a uno o más insumos.';
      },
    });
  }

  private comparePaletteOrder(a: ColorConfig, b: ColorConfig): number {
    const familyOrder: Exclude<ColorFamily, 'all'>[] = [
      'neutros',
      'rojos',
      'naranjas',
      'marrones',
      'verdes',
      'azules',
    ];
    const familyA = this.colorFamily(a.hex);
    const familyB = this.colorFamily(b.hex);
    const familyDiff =
      familyOrder.indexOf(familyA) - familyOrder.indexOf(familyB);
    if (familyDiff !== 0) return familyDiff;

    const hslA = this.hslFromHex(a.hex);
    const hslB = this.hslFromHex(b.hex);
    if (!hslA && !hslB) return a.name.localeCompare(b.name, 'es');
    if (!hslA) return 1;
    if (!hslB) return -1;

    if (familyA === 'neutros') {
      const lightDiff = hslA.l - hslB.l;
      if (Math.abs(lightDiff) > 0.001) return lightDiff;
      return a.name.localeCompare(b.name, 'es');
    }

    const hueDiff = hslA.h - hslB.h;
    if (Math.abs(hueDiff) > 0.01) return hueDiff;
    const satDiff = hslB.s - hslA.s;
    if (Math.abs(satDiff) > 0.001) return satDiff;
    const lightDiff = hslB.l - hslA.l;
    if (Math.abs(lightDiff) > 0.001) return lightDiff;
    return a.name.localeCompare(b.name, 'es');
  }

  private colorFamily(hex: string): Exclude<ColorFamily, 'all'> {
    const hsl = this.hslFromHex(hex);
    if (!hsl) return 'neutros';
    const { h, s, l } = hsl;
    if (s < 0.12 || l > 0.94 || l < 0.08) return 'neutros';
    if (h >= 15 && h < 50 && l < 0.55 && s < 0.75) return 'marrones';
    if (h < 20 || h >= 330) return 'rojos';
    if (h < 70) return 'naranjas';
    if (h < 170) return 'verdes';
    return 'azules';
  }

  private hslFromHex(
    value: string,
  ): { h: number; s: number; l: number } | null {
    const parsed = this.parseHex(value);
    if (!parsed) return null;
    return this.toHsl(parsed.r, parsed.g, parsed.b);
  }

  private parseHex(value: string): { r: number; g: number; b: number } | null {
    const hex = value.trim().replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  private toHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    return { h: h * 60, s, l };
  }
}
