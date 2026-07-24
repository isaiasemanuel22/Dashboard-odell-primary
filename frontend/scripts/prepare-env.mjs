import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] === 'production' ? 'production' : 'development';
const isProd = mode === 'production';

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

const fileEnv = {
  ...loadDotEnv(join(root, '.env')),
  ...loadDotEnv(join(root, '.env.local')),
};

const defaultFirebase = {
  apiKey: 'AIzaSyBXqQBoiPR97ZxTBmStvlpNccejCM5DD4k',
  authDomain: 'dashboard-odell-2.firebaseapp.com',
  projectId: 'dashboard-odell-2',
  storageBucket: 'dashboard-odell-2.firebasestorage.app',
  messagingSenderId: '890028004561',
  appId: '1:890028004561:web:de45b15d33cb851f0261f0',
};

const apiUrl = (
  isProd
    ? (process.env.API_URL ?? fileEnv.API_URL ?? '')
    : (fileEnv.API_URL ?? process.env.API_URL ?? '/api')
).trim();

if (isProd && !apiUrl) {
  console.error(
    '[prepare-env] API_URL es obligatoria para build de producción (env o frontend/.env)',
  );
  process.exit(1);
}

const firebase = {
  apiKey: fileEnv.FIREBASE_API_KEY ?? defaultFirebase.apiKey,
  authDomain: fileEnv.FIREBASE_AUTH_DOMAIN ?? defaultFirebase.authDomain,
  projectId: fileEnv.FIREBASE_PROJECT_ID ?? defaultFirebase.projectId,
  storageBucket: fileEnv.FIREBASE_STORAGE_BUCKET ?? defaultFirebase.storageBucket,
  messagingSenderId:
    fileEnv.FIREBASE_MESSAGING_SENDER_ID ?? defaultFirebase.messagingSenderId,
  appId: fileEnv.FIREBASE_APP_ID ?? defaultFirebase.appId,
};

const content = `/** Generado por scripts/prepare-env.mjs — no editar a mano */
export const environment = {
  production: ${isProd},
  apiUrl: ${JSON.stringify(apiUrl)},
  firebase: {
    apiKey: ${JSON.stringify(firebase.apiKey)},
    authDomain: ${JSON.stringify(firebase.authDomain)},
    projectId: ${JSON.stringify(firebase.projectId)},
    storageBucket: ${JSON.stringify(firebase.storageBucket)},
    messagingSenderId: ${JSON.stringify(firebase.messagingSenderId)},
    appId: ${JSON.stringify(firebase.appId)},
  },
};
`;

const outFile = join(
  root,
  'src/environments',
  isProd ? 'environment.prod.ts' : 'environment.ts',
);

writeFileSync(outFile, content, 'utf8');
console.log(
  `[prepare-env] ${isProd ? 'production' : 'development'} → ${outFile.replace(root + '/', '')}`,
);
console.log('[prepare-env] apiUrl =', apiUrl);
