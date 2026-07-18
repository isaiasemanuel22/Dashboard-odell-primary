import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiUrl = process.env.API_URL?.trim() || 'http://localhost:3000/api';

const content = `export const environment = {
  production: true,
  apiUrl: ${JSON.stringify(apiUrl)},
  productImageStorage: 'firebase' as 'backend' | 'firebase',
  firebase: {
    apiKey: 'AIzaSyBXqQBoiPR97ZxTBmStvlpNccejCM5DD4k',
    authDomain: 'dashboard-odell-2.firebaseapp.com',
    projectId: 'dashboard-odell-2',
    storageBucket: 'dashboard-odell-2.firebasestorage.app',
    messagingSenderId: '890028004561',
    appId: '1:890028004561:web:de45b15d33cb851f0261f0',
  },
};
`;

writeFileSync(join(root, 'src/environments/environment.prod.ts'), content, 'utf8');
console.log('[prepare-prod-env] apiUrl =', apiUrl);
