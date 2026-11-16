import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { BehaviorSubject, of } from 'rxjs';
import { createEmptyEstampadoPrint } from '../../../../shared/utils/estampado.helpers';
import { GeneralSettings, ProductType } from '../../../../core/models';
import { ImpresosService } from '../../../../core/services/impresos.service';
import { SuppliesService } from '../../../../core/services/settings.service';
import { SettingsFacade } from '../../../../store/settings/settings.facade';
import { ProductFormStateManagerService } from '../services/product-form-state-manager.service';
import { ProductFormProductionFieldsComponent } from './product-form-production-fields.component';

describe('ProductFormProductionFieldsComponent — impresos de Estampado', () => {
  let fixture: ComponentFixture<ProductFormProductionFieldsComponent>;
  let component: ProductFormProductionFieldsComponent;
  const stateManager = new ProductFormStateManagerService();
  const settings = {
    paperPricesPerSqm: { dtf: 10000, sublimacion: 10000, dtfUv: 10000 },
    errorMarginPercent: 0,
  } as unknown as GeneralSettings;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductFormProductionFieldsComponent],
      providers: [
        provideRouter([]),
        {
          provide: Store,
          useValue: { selectSignal: () => () => [], select: () => of([]) },
        },
        { provide: SuppliesService, useValue: { watchSupplies: () => of([]) } },
        { provide: ImpresosService, useValue: { getImpresos: () => of([]) } },
        {
          provide: SettingsFacade,
          useValue: {
            watchUntilDestroyed: () => new BehaviorSubject(settings),
            peekGeneralSettings: () => settings,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductFormProductionFieldsComponent);
    component = fixture.componentInstance;
    const state = stateManager.createInitialState();
    component.form = stateManager.buildFormGroup(state);
    component.form.controls.type.setValue(ProductType.ESTAMPADO);
    component.productType = ProductType.ESTAMPADO;
    // La facade reescribe otros campos del form en cada cambio (precio sugerido, etc.).
    component.form.valueChanges.subscribe(() =>
      component.form.controls.suggestedPrice.setValue(
        (component.form.controls.suggestedPrice.value ?? 0) + 1,
        { emitEvent: false },
      ),
    );
    fixture.detectChanges();
    // ngModel escribe el valor inicial en un microtask: esperar antes de interactuar.
    await fixture.whenStable();
    settle();
  });

  function settle(): void {
    // El componente es OnPush: fixture.detectChanges() solo lo revisa la primera vez.
    fixture.debugElement.injector.get(ChangeDetectorRef).detectChanges();
  }

  function typeInto(row: number, control: string, value: number): void {
    const rows = fixture.nativeElement.querySelectorAll(
      'app-order-quote-estampado-prints .line-table__row',
    );
    const input = rows[row].querySelector(
      `[data-control="${control}"] input, input[data-control="${control}"]`,
    ) as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    settle();
  }

  function addPrint(): void {
    const button = fixture.nativeElement.querySelector(
      'app-order-quote-estampado-prints .line-table__toolbar-actions button',
    ) as HTMLButtonElement;
    button.click();
    settle();
  }

  function rowCosts(): string[] {
    return [
      ...fixture.nativeElement.querySelectorAll(
        'app-order-quote-estampado-prints .line-table__cost',
      ),
    ].map((el) => (el as HTMLElement).textContent!.replace(/\s/g, ''));
  }

  it('la fila 1 calcula con medida libre aunque se agregue una 2.ª fila', () => {
    addPrint();
    typeInto(0, 'widthCm', 20);
    typeInto(0, 'lengthCm', 25);
    typeInto(1, 'widthCm', 10);
    typeInto(1, 'lengthCm', 10);

    const prints = component.line.estampadoPrints!;
    expect(prints.length).toBe(2);
    expect(prints[0].widthCm).toBe(20);
    expect(prints[0].lengthCm).toBe(25);
    expect(prints[1].widthCm).toBe(10);
    expect(component.form.controls.prints.value[0].lengthCm).toBe(25);
    const costs = rowCosts();
    expect(costs[0]).not.toContain('$0');
    expect(costs[1]).not.toContain('$0');
  });

  it('tras borrar la fila 1, la que queda sigue calculando', () => {
    addPrint();
    typeInto(1, 'widthCm', 10);
    typeInto(1, 'lengthCm', 10);
    (
      fixture.nativeElement.querySelector(
        'app-order-quote-estampado-prints .dynamic-list-item__remove',
      ) as HTMLButtonElement
    ).click();
    settle();
    typeInto(0, 'widthCm', 20);
    typeInto(0, 'lengthCm', 25);

    expect(component.line.estampadoPrints!.length).toBe(1);
    expect(component.line.estampadoPrints![0].widthCm).toBe(20);
    expect(component.line.estampadoPrints![0].lengthCm).toBe(25);
  });

  it('alta: producto nuevo que pasa a Estampado calcula la fila inicial (E132)', () => {
    // Estado de arranque del alta: componente nuevo, tipo previo sin impresos.
    fixture = TestBed.createComponent(ProductFormProductionFieldsComponent);
    component = fixture.componentInstance;
    component.form = stateManager.buildFormGroup(stateManager.createInitialState());
    component.form.controls.prints.setValue([], { emitEvent: false });
    component.form.controls.type.setValue(ProductType.COMBO);
    fixture.componentRef.setInput('productType', ProductType.COMBO);
    fixture.detectChanges();
    settle();

    // Lo que hace la facade al cambiar el tipo (handleTypeChange).
    component.form.controls.type.setValue(ProductType.ESTAMPADO);
    component.form.patchValue(
      { prints: [createEmptyEstampadoPrint()] },
      { emitEvent: false },
    );
    fixture.componentRef.setInput('productType', ProductType.ESTAMPADO);
    fixture.detectChanges();
    settle();

    typeInto(0, 'widthCm', 20);
    typeInto(0, 'lengthCm', 25);

    expect(component.form.controls.prints.value[0].widthCm).toBe(20);
    expect(component.form.controls.prints.value[0].lengthCm).toBe(25);
    expect(rowCosts()[0]).not.toContain('$0');
  });
});
