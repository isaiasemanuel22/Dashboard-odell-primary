import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { FairsService } from './fairs.service';

describe('FairsService', () => {
  let service: FairsService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/fairs`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FairsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list pide el mes como YYYY-MM', () => {
    service.list('2026-10').subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('month')).toBe('2026-10');
    req.flush({ fairs: [], kpis: {} });
  });

  it('open manda el fondo inicial', () => {
    service.open('f1', 10000).subscribe();
    const req = http.expectOne(`${base}/f1/open`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ openingFloat: 10000 });
    req.flush({});
  });

  it('addExpense y close usan los endpoints de la feria', () => {
    service.addExpense('f1', { name: 'Stand', amount: 8000 }).subscribe();
    const expense = http.expectOne(`${base}/f1/expenses`);
    expect(expense.request.body).toEqual({ name: 'Stand', amount: 8000 });
    expense.flush({});

    service.close('f1', { countedCash: 41000, differenceReason: 'vuelto' }).subscribe();
    const close = http.expectOne(`${base}/f1/close`);
    expect(close.request.method).toBe('POST');
    expect(close.request.body).toEqual({ countedCash: 41000, differenceReason: 'vuelto' });
    close.flush({});
  });

  it('plan pide por nombre', () => {
    service.plan('Feria Plaza').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/plan`);
    expect(req.request.params.get('name')).toBe('Feria Plaza');
    req.flush({ basedOn: 0, items: [] });
  });

  it('remove hace DELETE', () => {
    service.remove('f1').subscribe();
    const req = http.expectOne(`${base}/f1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: true });
  });
});
