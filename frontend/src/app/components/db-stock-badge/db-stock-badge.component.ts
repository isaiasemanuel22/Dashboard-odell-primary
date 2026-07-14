import { Component, Input } from '@angular/core';

@Component({
  selector: 'db-stock-badge',
  standalone: true,
  template: `
    @if (low) {
      <span class="stock-alert alert">
        @if (showIcon) { ⚠️ }
        {{ lowLabel }}
      </span>
    } @else {
      <span class="stock-alert ok">
        @if (showIcon) { ✓ }
        {{ okLabel }}
      </span>
    }
  `,
})
export class DbStockBadgeComponent {
  @Input() low = false;
  @Input() lowLabel = 'Stock bajo';
  @Input() okLabel = 'OK';
  @Input() showIcon = true;
}
