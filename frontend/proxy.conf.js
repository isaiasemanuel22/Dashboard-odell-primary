const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const root = __dirname;
const fileEnv = {
  ...loadDotEnv(join(root, '.env')),
  ...loadDotEnv(join(root, '.env.local')),
};

const target =
  fileEnv.API_PROXY_TARGET?.trim() ||
  process.env.API_PROXY_TARGET?.trim() ||
  'http://localhost:3000';

/** @type {import('webpack-dev-server').Configuration['proxy']} */
module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    logLevel: 'warn',
  },
  '/uploads': {
    target,
    secure: false,
    changeOrigin: true,
    logLevel: 'warn',
  },
};

console.log('[proxy] API →', target);
