import { Component, Input } from '@angular/core';

@Component({
  selector: 'db-state-message',
  standalone: true,
  template: `
    @if (loading) {
      <div class="loading">{{ loadingMessage }}</div>
    } @else if (empty) {
      <div class="empty">
        <p>{{ emptyMessage }}</p>
        <ng-content select="[emptyActions]" />
      </div>
    }
  `,
})
export class DbStateMessageComponent {
  @Input() loading = false;
  @Input() empty = false;
  @Input() loadingMessage = 'Cargando...';
  @Input() emptyMessage = 'No hay datos para mostrar.';
}
