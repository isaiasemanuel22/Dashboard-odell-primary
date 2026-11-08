import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { Supplier, SupplyCategory } from '../../../core/models';
import { SettingsService } from '../../../core/services/settings.service';
import { SuppliersService } from '../../../core/services/suppliers.service';
import { FormDialogService } from '../../../modals/form-dialog.service';
import { SupplyFormComponent } from './supply-form.component';

const NEW_SUPPLIER = '__new_supplier__';

describe('SupplyFormComponent — proveedor nuevo', () => {
  let fixture: ComponentFixture<SupplyFormComponent>;
  let component: SupplyFormComponent;
  let formDialogs: { openSupplier: jasmine.Spy };
  let suppliersService: { list: jasmine.Spy };

  const created: Supplier = {
    id: 'sup-new',
    name: 'Proveedor Nuevo',
    leadTimeBusinessDays: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    formDialogs = {
      openSupplier: jasmine.createSpy('openSupplier'),
    };
    suppliersService = {
      list: jasmine.createSpy('list').and.returnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [SupplyFormComponent],
      providers: [
        { provide: FormDialogService, useValue: formDialogs },
        { provide: SuppliersService, useValue: suppliersService },
        {
          provide: SettingsService,
          useValue: {
            getGeneralSettings: () =>
              of({
                filamentPrices: [],
                resinPrices: [],
                filamentTypes: [],
                resinTypes: [],
              }),
          },
        },
      ],
    })
      .overrideComponent(SupplyFormComponent, {
        set: { template: '', imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SupplyFormComponent);
    component = fixture.componentInstance;
    component.defaultCategory = SupplyCategory.FDM;
    fixture.detectChanges();
  });

  it('al crear proveedor lo agrega a la lista y selecciona su id', fakeAsync(() => {
    component.supplierId = 'prev-id';
    component.suppliers = [
      {
        id: 'prev-id',
        name: 'Anterior',
        leadTimeBusinessDays: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    formDialogs.openSupplier.and.returnValue(of(created));
    suppliersService.list.and.returnValue(of([created]));

    component.onSupplierChange(NEW_SUPPLIER);
    tick();

    expect(formDialogs.openSupplier).toHaveBeenCalledWith(null);
    expect(component.suppliers.some((s) => s.id === created.id)).toBeTrue();
    expect(component.supplierId).toBe(created.id);
    expect(component.supplierId).not.toBe(NEW_SUPPLIER);
    expect(
      component.supplierOptions.some((o) => o.value === created.id),
    ).toBeTrue();
  }));

  it('si se cancela el diálogo vuelve al valor previo', fakeAsync(() => {
    component.supplierId = 'prev-id';
    formDialogs.openSupplier.and.returnValue(of(undefined));

    component.onSupplierChange(NEW_SUPPLIER);
    tick();

    expect(component.supplierId).toBe('prev-id');
  }));

  it('applyCreatedSupplier fuerza la selección aunque list() no traiga el id aún', fakeAsync(() => {
    suppliersService.list.and.returnValue(of([]));
    component.applyCreatedSupplier(created);
    tick();

    expect(component.supplierId).toBe(created.id);
    expect(component.suppliers.find((s) => s.id === created.id)?.name).toBe(
      'Proveedor Nuevo',
    );
  }));
});
