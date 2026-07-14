export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function isFirebaseConfigured(config?: FirebaseConfig): boolean {
  if (!config?.apiKey?.trim()) return false;
  return !config.apiKey.startsWith('YOUR_');
}
