import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbCheckboxComponent, DbInputComponent } from '@dashboard-form';

@Component({
  selector: 'app-product-form-assembly',
  standalone: true,
  imports: [FormsModule, DbInputComponent, DbCheckboxComponent],
  templateUrl: './product-form-assembly.component.html',
  styleUrl: '../../product-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormAssemblyComponent {
  @Input() assemblyTimeHours = 0;
  @Input() deductPiecesOnSale = false;
  @Input() assemblyHint = '';

  @Output() assemblyTimeHoursChange = new EventEmitter<number>();
  @Output() deductPiecesOnSaleChange = new EventEmitter<boolean>();
  @Output() changed = new EventEmitter<void>();
}
