import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { isNoAccessHttpError } from './auth-error.util';

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
