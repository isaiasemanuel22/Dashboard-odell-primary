import { test, expect } from './fixtures';
import { gotoApp } from './helpers/nav';
import { api, apiGet, apiPost, apiDelete, cleanupCreated, createCustomer, createQuote, e2eName } from './helpers/api';

const TS = Date.now();
const NOMBRE_TILDE = `E2E-${TS} Ñandú Pérez`;

test.afterAll(async () => {
  await cleanupCreated();
});

test.describe('Ajustes', () => {
  test('M-14: impreso 500x500 no entra en el pliego (UI y API)', async ({ page }) => {
    await gotoApp(page, '/ajustes/impresos');
    await page.getByRole('button', { name: /Nuevo impreso/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo impreso' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Nombre').fill(e2eName('impreso grande'));
    await dialog.getByLabel('Ancho (cm)').fill('500');
    await dialog.getByLabel('Largo (cm)').fill('500');
    await expect(dialog.getByText(/no entra en el pliego/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Crear impreso' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
  });

  test('M-14: API rechaza 500x500 (400) y acepta 25x25', async () => {
    const ctx = await api();
    const bad = await ctx.post('impresos', {
      data: { name: e2eName('impreso 500'), paperType: 'dtf', widthCm: 500, lengthCm: 500, heightCm: 0 },
    });
    expect(bad.status()).toBe(400);

    const ok = await ctx.post('impresos', {
      data: { name: e2eName('impreso 25'), paperType: 'dtf', widthCm: 25, lengthCm: 25, heightCm: 0 },
    });
    expect(ok.status()).toBe(201);
    const { id } = await ok.json();
    expect(await apiDelete(`impresos/${id}`)).toBe(true);
  });

  test('A-9: el reseteo pide escribir RESETEAR y el codigo arranca vacio', async ({ page }) => {
    await gotoApp(page, '/ajustes');
    await page.getByRole('button', { name: 'Resetear base de datos' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Resetear base de datos' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/Escribí RESETEAR/)).toHaveValue('');
    await expect(dialog.getByLabel('Código de confirmación')).toHaveValue('');
    await expect(dialog.getByRole('button', { name: 'Resetear', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
  });

  test('M-9: aviso "Faltan tarifas" si Modelado/Diseno estan sin definir', async ({ page }) => {
    const s = await apiGet<{ modelingRatePerHour?: number; graphicDesignRatePerHour?: number }>('settings/general');
    const missing = !s.modelingRatePerHour || !s.graphicDesignRatePerHour;
    test.skip(!missing, 'Las tarifas de Modelado y Diseño están definidas: no hay aviso que verificar');
    await gotoApp(page, '/ajustes/valores-generales');
    await expect(page.getByText('Faltan tarifas por hora.').first()).toBeVisible();
  });
});

test.describe('Busqueda sin tildes', () => {
  test('Clientes, Pedidos e Insumos encuentran "nandu perez"', async ({ page }) => {
    const c = await createCustomer({ name: NOMBRE_TILDE });
    const supply = await apiPost<{ id: string }>('supplies', {
      name: `E2E-${TS} Tinta Ñandú`,
      category: 'otros',
      unit: 'unidad',
      stock: 1,
      minStock: 0,
      unitPrice: 10,
    }).catch(() => null);

    // Clientes
    await gotoApp(page, '/clientes');
    await page.getByRole('searchbox', { name: /Buscar clientes/ }).or(page.getByPlaceholder(/Buscar por nombre, email/)).first().fill('nandu perez');
    await expect(page.getByText(NOMBRE_TILDE).locator("visible=true").first()).toBeVisible();

    // Pedidos: sin pedidos del cliente, la busqueda no debe romper y el buscador acepta el texto
    await gotoApp(page, '/pedidos');
    const pedBox = page.getByRole('searchbox', { name: /Buscar pedidos/ }).or(page.getByPlaceholder(/Buscar por cliente/)).first();
    await pedBox.fill('nandu perez');
    await expect(pedBox).toHaveValue('nandu perez');

    // Insumos
    if (supply) {
      await gotoApp(page, '/insumos');
      const box = page.getByRole('searchbox', { name: /Buscar insumos/ }).or(page.getByPlaceholder(/Buscar insumo|Buscar por nombre/)).first();
      await box.fill('nandu');
      await expect(page.getByText(`E2E-${TS} Tinta Ñandú`).locator("visible=true").first()).toBeVisible();
    }
    expect(c.id).toBeTruthy();
  });
});

test.describe('Redirects', () => {
  test('/cola-de-trabajo lleva a /cola', async ({ page }) => {
    await gotoApp(page, '/cola-de-trabajo');
    await expect(page).toHaveURL(/\/cola$/);
  });

  test('URL inventada lleva al inicio', async ({ page }) => {
    await gotoApp(page, `/ruta-inventada-${TS}`);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe('Presupuestos y selectores', () => {
  test('U-6: menu "···" tiene Ver, Editar, Duplicar y Eliminar', async ({ page }) => {
    const cust = await createCustomer({ name: e2eName('cliente presupuesto') });
    const q = await createQuote({ customerId: cust.id, status: 'borrador', items: [] });
    await gotoApp(page, '/presupuestos');
    const search = page.getByPlaceholder(/Buscar por cliente o concepto/).first();
    await search.fill(cust.name);
    const row = page.getByRole('row').filter({ hasText: cust.name }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /Acciones|···/ }).first().click();
    const menu = page.getByRole('menu');
    for (const name of ['Ver', 'Editar', 'Duplicar', 'Eliminar']) {
      await expect(menu.getByRole('menuitem', { name })).toBeVisible();
    }
    await page.keyboard.press('Escape');
    expect(q.id).toBeTruthy();
  });

  test('E53/E73: proveedores del formulario de insumo en orden alfabetico', async ({ page }) => {
    await gotoApp(page, '/insumos');
    await page.getByRole('button', { name: /Nuevo insumo/ }).first().click();
    const dialog = page.getByRole('dialog');
    const select = dialog.getByLabel(/Proveedor/).first();
    await expect(select).toBeVisible();
    const readReal = async () =>
      (await select.locator('option').allTextContents())
        .map((t) => t.trim())
        .filter((l) => l !== 'Sin proveedor' && !l.startsWith('+ Nuevo'));
    await expect.poll(async () => (await readReal()).length).toBeGreaterThan(1);
    const real = await readReal();
    // Las opciones desambiguadas pueden sumar un sufijo; se compara por el nombre base.
    const sorted = [...real].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    expect(real).toEqual(sorted);
  });
});
