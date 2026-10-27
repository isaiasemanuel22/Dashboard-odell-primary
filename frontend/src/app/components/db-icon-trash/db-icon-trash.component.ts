import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'db-icon-trash',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './db-icon-trash.component.html',
  styleUrl: './db-icon-trash.component.scss',
})
export class DbIconTrashComponent {
  @Input() size: number | string = 18;
}
