import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'db-row-menu',
  standalone: true,
  templateUrl: './db-row-menu.component.html',
  styleUrl: './db-row-menu.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DbRowMenuComponent {
  @Input() open = false;
  @Input() top = '2.1rem';
  @Input() right = '0.35rem';
  @Input() minWidth = '7rem';
  @Input() zIndex = 2;
  @Input() bottom: string | null = null;
  @Input() compact = false;
  @Output() toggled = new EventEmitter<void>();
}
