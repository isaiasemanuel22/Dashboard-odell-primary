import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { resolveMediaUrls } from '../../shared/utils/media-url.util';

export type ProductImageCarouselVariant = 'card' | 'detail';
type SlideDirection = 'next' | 'prev';

@Component({
  selector: 'app-product-image-carousel',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-image-carousel.component.html',
  styleUrl: './product-image-carousel.component.scss',
})
export class ProductImageCarouselComponent implements OnChanges {
  @Input({ required: true }) alt = '';
  @Input() images: string[] = [];
  @Input() variant: ProductImageCarouselVariant = 'card';
  /** En cards: al hacer clic en la foto navega al detalle (no en flechas/dots). */
  @Input() link?: string | string[];

  currentIndex = 0;
  slideDirection: SlideDirection = 'next';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['images']) {
      this.currentIndex = 0;
      this.slideDirection = 'next';
    }
  }

  get resolvedImages(): string[] {
    return resolveMediaUrls(this.images);
  }

  get hasImages(): boolean {
    return this.resolvedImages.length > 0;
  }

  get hasMultiple(): boolean {
    return this.resolvedImages.length > 1;
  }

  get counterLabel(): string {
    return `${this.currentIndex + 1} / ${this.resolvedImages.length}`;
  }

  prev(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.hasMultiple) return;
    this.moveTo(
      (this.currentIndex - 1 + this.resolvedImages.length) %
        this.resolvedImages.length,
      'prev',
    );
  }

  next(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.hasMultiple) return;
    this.moveTo(
      (this.currentIndex + 1) % this.resolvedImages.length,
      'next',
    );
  }

  goTo(index: number, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (index < 0 || index >= this.resolvedImages.length) return;
    if (index === this.currentIndex) return;
    this.moveTo(index, index > this.currentIndex ? 'next' : 'prev');
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.hasMultiple) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.moveTo(
        (this.currentIndex - 1 + this.resolvedImages.length) %
          this.resolvedImages.length,
        'prev',
      );
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.moveTo(
        (this.currentIndex + 1) % this.resolvedImages.length,
        'next',
      );
    }
  }

  private moveTo(index: number, direction: SlideDirection): void {
    this.slideDirection = direction;
    this.currentIndex = index;
  }

  slideBackground(url: string): string {
    return `url("${url}")`;
  }
}
