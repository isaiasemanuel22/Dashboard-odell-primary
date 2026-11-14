import { test, expect } from './fixtures';
import { gotoApp } from './helpers/nav';

const ROUTES = ['/dashboard', '/productos', '/pedidos', '/presupuestos', '/cola', '/insumos', '/ajustes'];

for (const route of ROUTES) {
  test(`humo ${route} carga sin errores de consola`, async ({ page, consoleProblems }) => {
    await gotoApp(page, route);
    await expect(page).toHaveURL(new RegExp(`${route}`));
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page.getByRole('heading').first()).toBeVisible();
    expect(consoleProblems.errors, consoleProblems.errors.join('\n')).toEqual([]);
  });
}
