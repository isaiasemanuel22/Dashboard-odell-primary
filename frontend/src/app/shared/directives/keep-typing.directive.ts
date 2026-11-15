import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgModel } from '@angular/forms';

/**
 * Campo numérico con [ngModel]: mientras tiene el foco muestra lo que se
 * escribe (vacío, 0 o fuera de rango) aunque el componente corrija el modelo;
 * al salir muestra el valor final del modelo.
 */
@Directive({
  selector: 'input[dbKeepTyping]',
  standalone: true,
})
export class KeepTypingDirective {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef)
    .nativeElement;
  private readonly ngModel = inject(NgModel, { self: true, optional: true });
  private typed: string | null = null;

  @HostListener('focus')
  onFocus(): void {
    this.typed = this.el.value;
  }

  @HostListener('input')
  onInput(): void {
    this.typed = this.el.value;
    // NgModel escribe el valor corregido después de la detección de cambios.
    setTimeout(() => {
      if (this.typed !== null && this.el.value !== this.typed) {
        this.el.value = this.typed;
      }
    });
  }

  @HostListener('blur')
  onBlur(): void {
    this.typed = null;
    setTimeout(() => {
      if (this.typed !== null || !this.ngModel) return;
      const model = this.ngModel.model;
      const next = model == null ? '' : String(model);
      if (this.el.value !== next) this.el.value = next;
    });
  }
}
