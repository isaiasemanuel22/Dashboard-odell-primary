export const environment = {
  production: false,
  apiUrl: '/api',
  /** Imágenes de productos: 'backend' → backend/uploads (recomendado en local). */
  productImageStorage: 'backend' as 'backend' | 'firebase',
  firebase: {
    apiKey: 'AIzaSyBXqQBoiPR97ZxTBmStvlpNccejCM5DD4k',
    authDomain: 'dashboard-odell-2.firebaseapp.com',
    projectId: 'dashboard-odell-2',
    storageBucket: 'dashboard-odell-2.firebasestorage.app',
    messagingSenderId: '890028004561',
    appId: '1:890028004561:web:de45b15d33cb851f0261f0',
  },
};
