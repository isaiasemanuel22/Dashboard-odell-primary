import { test as base, expect, type Page } from '@playwright/test';

/**
 * Login local: AuthService acepta testing@test.com solo fuera de produccion y guarda la
 * sesion en sessionStorage (clave odell.localTestSession). sessionStorage no entra en
 * storageState, asi que se siembra con un init script en cada pagina. El backend local
 * (REQUIRE_AUTH!=true) deja pasar llamadas sin token, no hay globalSetup ni credenciales.
 */
const IGNORED_CONSOLE = [
  /favicon/i,
  /Download the Angular DevTools/i,
  /\[vite\]|\[webpack\]|HMR/i,
  /WebSocket connection/i, // realtime/dev server
];

export interface ConsoleProblems {
  errors: string[];
}

export const test = base.extend<{ consoleProblems: ConsoleProblems }>({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem('odell.localTestSession', '1');
      } catch {
        /* about:blank */
      }
    });
    await use(context);
  },
  // Junta console.error y excepciones de pagina de cada test.
  consoleProblems: async ({ page }, use) => {
    const problems: ConsoleProblems = { errors: [] };
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
      problems.errors.push(text);
    });
    page.on('pageerror', (err) => problems.errors.push(`pageerror: ${err.message}`));
    await use(problems);
  },
});

export { expect };
export type { Page };
