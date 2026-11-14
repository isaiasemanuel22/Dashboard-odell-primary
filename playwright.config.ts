import { defineConfig, devices } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Sin E2E_BASE_URL: prueba 4300 y luego 4200 (chequeo TCP sincronico) y usa el primero que responde. */
function detectBaseUrl(): string {
  const probe =
    "const s=require('net').connect({port:+process.argv[1],host:'127.0.0.1'});" +
    "s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),1500);";
  for (const port of [4300, 4200]) {
    try {
      execFileSync(process.execPath, ['-e', probe, String(port)], { stdio: 'ignore', timeout: 3000 });
      return `http://localhost:${port}`;
    } catch {
      /* siguiente */
    }
  }
  return 'http://localhost:4300';
}

// Carga .env.e2e (sin dependencias) si existe.
const envFile = path.join(__dirname, '.env.e2e');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1, // base local compartida y store en memoria
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  globalTeardown: './e2e/global-teardown.ts',
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL || detectBaseUrl(),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-AR',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        channel: process.env.E2E_CHANNEL || undefined,
      },
    },
  ],
});
