import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { isNoAccessHttpError } from './auth-error.util';

const SESSION_EXPIRED_MESSAGE =
  'Tu sesión venció. Ingresá de nuevo para seguir.';

/** Varias respuestas 401 simultáneas cierran la sesión una sola vez. */
let handlingUnauthorized = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.enabled) {
    return next(req);
  }

  return from(auth.getIdToken()).pipe(
    switchMap((token) => {
      const authedReq = token
        ? req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`,
            },
          })
        : req;

      return next(authedReq).pipe(
        catchError((error: unknown) => {
          if (
            error instanceof HttpErrorResponse &&
            error.status === 401 &&
            // Sin token no había sesión que cerrar; en /login no se redirige (sin loops).
            !!token &&
            !router.url.startsWith('/login')
          ) {
            if (handlingUnauthorized) {
              return throwError(() => error);
            }
            handlingUnauthorized = true;
            return from(
              auth
                .handleNoAccess(SESSION_EXPIRED_MESSAGE)
                .then(() => router.navigateByUrl('/login'))
                .finally(() => {
                  handlingUnauthorized = false;
                }),
            ).pipe(switchMap(() => throwError(() => error)));
          }

          if (!isNoAccessHttpError(error)) {
            return throwError(() => error);
          }

          return from(
            auth.handleNoAccess().then(async () => {
              await router.navigateByUrl('/login');
            }),
          ).pipe(switchMap(() => throwError(() => error)));
        }),
      );
    }),
  );
};
