import { Component, HostListener, Input } from '@angular/core';

/**
 * Contenedor de formularios del dashboard.
 * Por defecto Enter en inputs/selects no dispara el submit implícito del
 * `<form>` hijo (evita cerrar modales al confirmar un campo). Login y
 * pantallas que sí quieren Enter→enviar usan `[allowEnterSubmit]="true"`.
 */
@Component({
  selector: 'db-form',
  standalone: true,
  template: `<ng-content />`,
  styleUrl: './db-form.component.scss',
  host: { class: 'db-form' },
})
export class DbFormComponent {
  /** Si es true, Enter en un input envía el formulario (p. ej. login). */
  @Input() allowEnterSubmit = false;

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.defaultPrevented) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (this.isEnterAllowedTarget(target)) return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const form = target.closest('form');
      form?.requestSubmit();
      return;
    }

    if (this.allowEnterSubmit) return;

    event.preventDefault();
  }

  private isEnterAllowedTarget(el: HTMLElement): boolean {
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return true;
    if (el.isContentEditable) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.closest('button, [type="submit"], [role="button"]')) return true;
    // TipTap / editores enriquecidos suelen usar un div contenteditable
    // o un rol textbox dentro del editor.
    if (el.closest('.ProseMirror, .db-rich-text-editor__editor')) return true;
    return false;
  }
}
