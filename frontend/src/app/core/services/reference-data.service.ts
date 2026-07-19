import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ReferenceData } from '../models';
import { CatalogFacade } from '../../store/catalog/catalog.facade';

@Injectable({ providedIn: 'root' })
export class ReferenceDataService {
  private readonly catalogFacade = inject(CatalogFacade);

  load(refresh = false): Observable<ReferenceData> {
    return this.catalogFacade.ensureLoaded(refresh);
  }

  invalidate(): void {
    this.catalogFacade.invalidate();
  }
}
