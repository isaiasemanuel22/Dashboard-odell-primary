import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MaterialsService } from '../../core/services/materials.service';
import {
  DbStateMessageComponent,
  MaterialsTableComponent,
} from '@general-components';

@Component({
  selector: 'app-materials',
  standalone: true,
  imports: [AsyncPipe, DbStateMessageComponent, MaterialsTableComponent],
  templateUrl: './materials.component.html',
})
export class MaterialsComponent {
  private readonly materialsService = inject(MaterialsService);
  materials$ = this.materialsService.getMaterials();
}
