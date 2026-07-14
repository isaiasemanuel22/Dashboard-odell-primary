import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';

const responseCache = new Map<string, { etag: string; body: unknown }>();

const CACHEABLE_SEGMENTS = [
  '/reference-data',
  '/categories',
  '/customers',
  '/products',
  '/orders',
  '/print-jobs/board',
];

function storeResponse(key: string, event: HttpResponse<unknown>): void {
  const etag = event.headers.get('ETag');
  if (etag && event.body !== undefined) {
    responseCache.set(key, { etag, body: event.body });
  }
}

function cachedSuccess(
  cached: { etag: string; body: unknown },
  source: HttpResponse<unknown> | HttpErrorResponse,
): HttpResponse<unknown> {
  return new HttpResponse({
    body: cached.body,
    status: 200,
    headers: source.headers,
    url: source.url ?? undefined,
  });
}

export const etagInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    return next(req);
  }

  const isCacheable = CACHEABLE_SEGMENTS.some((segment) =>
    req.url.includes(segment),
  );
  if (!isCacheable) {
    return next(req);
  }

  const key = req.urlWithParams;
  const cached = responseCache.get(key);
  const request = cached
    ? req.clone({ setHeaders: { 'If-None-Match': cached.etag } })
    : req;

  return next(request).pipe(
    switchMap((event) => {
      if (event instanceof HttpResponse) {
        storeResponse(key, event);
      }
      return [event];
    }),
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 304) {
        return throwError(() => err);
      }

      const hit = responseCache.get(key);
      if (hit) {
        return [cachedSuccess(hit, err)];
      }

      const retryReq = req.clone({
        headers: req.headers.delete('If-None-Match'),
      });
      return next(retryReq).pipe(
        switchMap((event) => {
          if (event instanceof HttpResponse) {
            storeResponse(key, event);
          }
          return [event];
        }),
      );
    }),
  );
};
