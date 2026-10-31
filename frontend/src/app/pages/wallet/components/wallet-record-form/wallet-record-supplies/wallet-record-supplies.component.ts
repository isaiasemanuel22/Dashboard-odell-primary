import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DbButtonComponent,
  DbFormFieldComponent,
  DbFormGridComponent,
  DbInputComponent,
} from '@general-components';
import { Supply } from '../../../../../core/models';
import { CurrencyArsPipe } from '../../../../../shared/pipes/labels.pipe';
import { computeSupplyPurchaseDelta } from '../../../../../shared/utils/supply-unit.util';

export interface WalletSupplyLine {
  supplyId: string;
  supplyName: string;
  unit: string;
  quantity: number;
  amountSpent: number;
  unitPrice: number;
}

@Component({
  selector: 'app-wallet-record-supplies',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    DbButtonComponent,
    DbFormFieldComponent,
    DbFormGridComponent,
    DbInputComponent,
  ],
  templateUrl: './wallet-record-supplies.component.html',
  styleUrl: '../../wallet-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class WalletRecordSuppliesComponent {
  @Input() supplies: Supply[] = [];
  @Input() selectedSupplyId = '';
  @Input() lines: WalletSupplyLine[] = [];
  @Input() total = 0;

  @Output() selectedSupplyIdChange = new EventEmitter<string>();
  @Output() add = new EventEmitter<void>();
  @Output() createSupply = new EventEmitter<void>();
  @Output() remove = new EventEmitter<string>();
  @Output() lineChange = new EventEmitter<WalletSupplyLine>();

  supplyLineDelta(line: WalletSupplyLine): number {
    return computeSupplyPurchaseDelta(line.amountSpent, line.quantity, line.unitPrice);
  }

  supplyLineListTotal(line: WalletSupplyLine): number {
    return Math.round(line.quantity * line.unitPrice);
  }
}
