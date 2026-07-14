import { Component, Input } from '@angular/core';

@Component({
  selector: 'db-skeleton',
  standalone: true,
  template: `
    @switch (variant) {
      @case ('cards') {
        <div class="skeleton-cards">
          @for (row of rows; track row) {
            <div class="skeleton-card">
              <div class="skeleton-line title"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
            </div>
          }
        </div>
      }
      @case ('detail') {
        <div class="skeleton-detail">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      }
      @default {
        <div class="skeleton-default">
          @for (row of rows; track row) {
            <div class="skeleton-line"></div>
          }
        </div>
      }
    }
  `,
  styles: `
    .skeleton-cards {
      display: grid;
      gap: 1rem;
    }

    .skeleton-card,
    .skeleton-detail,
    .skeleton-default {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: 0.75rem;
      background: var(--surface-2, #f4f4f5);
    }

    .skeleton-line {
      height: 0.875rem;
      border-radius: 0.375rem;
      background: linear-gradient(
        90deg,
        rgba(0, 0, 0, 0.06) 25%,
        rgba(0, 0, 0, 0.12) 37%,
        rgba(0, 0, 0, 0.06) 63%
      );
      background-size: 400% 100%;
      animation: shimmer 1.4s ease infinite;
    }

    .skeleton-line.title {
      height: 1.25rem;
      width: 40%;
    }

    .skeleton-line.short {
      width: 55%;
    }

    @keyframes shimmer {
      0% {
        background-position: 100% 0;
      }
      100% {
        background-position: -100% 0;
      }
    }
  `,
})
export class DbSkeletonComponent {
  @Input() variant: 'cards' | 'detail' | 'lines' = 'cards';
  @Input() count = 4;

  get rows(): number[] {
    return Array.from({ length: this.count }, (_, index) => index);
  }
}
