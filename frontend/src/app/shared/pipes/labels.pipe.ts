import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  FilamentType,
  OrderStatus,
  PaperType,
  PrintJobStatus,
  ProductType,
  ResinType,
  ServiceType,
  SupplyCategory,
  SupplyType,
} from '../../core/models';
import {
  FILAMENT_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  PAPER_TYPE_LABELS,
  PRINT_JOB_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  RESIN_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  SUPPLY_CATEGORY_LABELS,
  SUPPLY_TYPE_LABELS,
} from '../constants/labels';
import { resolveMediaUrl } from '../utils/media-url.util';
import {
  excerptPlainText,
  plainTextFromHtml,
  sanitizeRichTextHtml,
} from '../utils/rich-text.util';

@Pipe({ name: 'serviceTypeLabel', standalone: true })
export class ServiceTypeLabelPipe implements PipeTransform {
  transform(value: ServiceType): string {
    return SERVICE_TYPE_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'productTypeLabel', standalone: true })
export class ProductTypeLabelPipe implements PipeTransform {
  transform(value: ProductType): string {
    return PRODUCT_TYPE_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'paperTypeLabel', standalone: true })
export class PaperTypeLabelPipe implements PipeTransform {
  transform(value: PaperType): string {
    return PAPER_TYPE_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'supplyTypeLabel', standalone: true })
export class SupplyTypeLabelPipe implements PipeTransform {
  transform(value: SupplyType): string {
    return SUPPLY_TYPE_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'supplyCategoryLabel', standalone: true })
export class SupplyCategoryLabelPipe implements PipeTransform {
  transform(value: SupplyCategory): string {
    return SUPPLY_CATEGORY_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'mediaUrl', standalone: true })
export class MediaUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string | null {
    return resolveMediaUrl(value);
  }
}

@Pipe({ name: 'filamentTypeLabel', standalone: true })
export class FilamentTypeLabelPipe implements PipeTransform {
  transform(value: string | FilamentType | null | undefined): string {
    if (!value) return '';
    return FILAMENT_TYPE_LABELS[value as FilamentType] ?? value.toUpperCase();
  }
}

@Pipe({ name: 'resinTypeLabel', standalone: true })
export class ResinTypeLabelPipe implements PipeTransform {
  transform(value: ResinType): string {
    return RESIN_TYPE_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'orderStatusLabel', standalone: true })
export class OrderStatusLabelPipe implements PipeTransform {
  transform(value: OrderStatus): string {
    return ORDER_STATUS_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'printJobStatusLabel', standalone: true })
export class PrintJobStatusLabelPipe implements PipeTransform {
  transform(value: PrintJobStatus): string {
    return PRINT_JOB_STATUS_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'currencyArs', standalone: true })
export class CurrencyArsPipe implements PipeTransform {
  transform(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }
}

@Pipe({ name: 'dateShort', standalone: true })
export class DateShortPipe implements PipeTransform {
  transform(value: string): string {
    return new Date(value).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}

@Pipe({ name: 'dateTime', standalone: true })
export class DateTimePipe implements PipeTransform {
  transform(value: string): string {
    return new Date(value).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

@Pipe({ name: 'profitMargin', standalone: true })
export class ProfitMarginPipe implements PipeTransform {
  transform(price: number, profit: number): number | null {
    if (price <= 0) return null;
    return Math.round((profit / price) * 100);
  }
}

@Pipe({ name: 'richText', standalone: true })
export class RichTextPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      sanitizeRichTextHtml(value),
    );
  }
}

@Pipe({ name: 'plainText', standalone: true })
export class PlainTextPipe implements PipeTransform {
  transform(value: string | null | undefined, maxLength = 120): string {
    return excerptPlainText(value, maxLength);
  }
}

@Pipe({ name: 'plainTextLength', standalone: true })
export class PlainTextLengthPipe implements PipeTransform {
  transform(value: string | null | undefined): number {
    return plainTextFromHtml(value).length;
  }
}
