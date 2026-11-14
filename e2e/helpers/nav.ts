import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Espera a que Angular termine de cargar la ruta (sin spinner de pagina). */
export async function gotoApp(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/** Abre el formulario de Nuevo pedido desde /pedidos (vista desktop). */
export async function openNewOrder(page: Page): Promise<void> {
  await gotoApp(page, '/pedidos');
  await page.getByRole('button', { name: /Nuevo pedido|Crear primer pedido/ }).first().click();
  await expect(page.locator('.order-form__footer')).toBeVisible();
}

/** Abre el formulario de Nuevo presupuesto desde /presupuestos (vista desktop). */
export async function openNewQuote(page: Page): Promise<void> {
  await gotoApp(page, '/presupuestos');
  await page.getByRole('button', { name: /Nuevo presupuesto/ }).first().click();
  await expect(page.locator('.quote-form__footer')).toBeVisible();
}

/** Escribe en el buscador de la pagina actual (ej. "Buscar producto"). */
export async function searchInPage(page: Page, ariaLabel: string | RegExp, text: string): Promise<void> {
  const box = page.getByRole('searchbox', { name: ariaLabel }).or(page.getByPlaceholder(ariaLabel)).first();
  await box.fill(text);
}

/**
 * Aviso del pie del formulario de pedido/presupuesto (el motivo por el que no se puede guardar,
 * o la nota "Se crea en estado Pendiente..."). Devuelve el locator para usar con expect.
 */
export function footerNotice(page: Page): Locator {
  return page
    .locator('.order-form__footer, .quote-form__footer')
    .locator('.order-form__warning, .order-form__note, [role="status"]')
    .first();
}

/** Texto del aviso del pie ('' si no hay). */
export async function readFooterNotice(page: Page): Promise<string> {
  const loc = footerNotice(page);
  return (await loc.count()) ? ((await loc.innerText()).trim()) : '';
}
