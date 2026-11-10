import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ProductAttachment } from '../../core/models';
import { formatFileSizeEsAr } from '../../shared/utils/file-size.util';

/** Lista de solo lectura de adjuntos de un pedido o presupuesto. Se oculta si no hay. */
@Component({
  selector: 'app-document-attachments-view',
  standalone: true,
  templateUrl: './document-attachments-view.component.html',
  styleUrl: './document-attachments-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentAttachmentsViewComponent {
  @Input() attachments: ProductAttachment[] | null | undefined = [];

  get items(): ProductAttachment[] {
    return this.attachments ?? [];
  }

  isImage(item: ProductAttachment): boolean {
    return item.mimeType?.startsWith('image/') === true;
  }

  size(item: ProductAttachment): string {
    return formatFileSizeEsAr(item.size);
  }
}
