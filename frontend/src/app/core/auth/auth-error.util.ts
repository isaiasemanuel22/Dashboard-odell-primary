import { HttpErrorResponse } from '@angular/common/http';

export const NO_ACCESS_MESSAGE =
  'Tu cuenta no tiene acceso. Pedile al administrador que te dé de alta.';

export function isNoAccessHttpError(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
    return false;
  }
  const message = extractHttpMessage(error);
  return message.includes('no tiene acceso');
}

export function authErrorMessage(error: unknown): string {
  if (isNoAccessHttpError(error)) {
    return NO_ACCESS_MESSAGE;
  }

  const code =
    typeof error === 'object' &&
    error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Probá más tarde.';
    case 'auth/invalid-email':
      return 'El email no es válido.';
    case 'auth/popup-closed-by-user':
      return 'Cerraste la ventana de Google. Intentá de nuevo.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana emergente. Permitila e intentá otra vez.';
    case 'auth/cancelled-popup-request':
      return 'Ya hay un inicio de sesión en curso.';
    case 'auth/account-exists-with-different-credential':
      return 'Ese email ya está registrado con otro método. Usá email y contraseña.';
    case 'auth/operation-not-allowed':
      return 'Google no está habilitado. En Firebase: Authentication → Sign-in method → Google → Enable.';
    case 'auth/configuration-not-found':
      return 'Firebase Auth no está inicializado. Entrá a Authentication → «Comenzar» y activá Google (y email/contraseña si querés).';
    case 'auth/unauthorized-domain':
      return 'Este dominio no está autorizado. En Firebase: Authentication → Settings → Authorized domains.';
    default:
      if (code) {
        return `Error de autenticación (${code}).`;
      }
      return 'No se pudo iniciar sesión. Intentá de nuevo.';
  }
}

function extractHttpMessage(error: HttpErrorResponse): string {
  const body = error.error;
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) {
      return message.filter((part): part is string => typeof part === 'string').join(' ');
    }
  }
  return error.message ?? '';
}
