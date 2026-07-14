import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

const CACHEABLE_SEGMENTS = [
  '/reference-data',
  '/categories',
  '/customers',
  '/products',
  '/orders',
  '/print-jobs/board',
];

@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== 'GET') {
      return next.handle();
    }

    const path = this.normalizePath(req);
    if (!CACHEABLE_SEGMENTS.some((segment) => path.includes(segment))) {
      return next.handle();
    }

    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((body) => {
        if (body === undefined) return body;

        const etag = `"${createHash('md5').update(JSON.stringify(body)).digest('hex')}"`;
        const ifNoneMatch = req.headers['if-none-match'];

        if (ifNoneMatch === etag) {
          throw new HttpException('', HttpStatus.NOT_MODIFIED);
        }

        res.setHeader('ETag', etag);
        return body;
      }),
    );
  }

  private normalizePath(req: Request): string {
    const base = (req.originalUrl ?? req.url).split('?')[0] ?? '';
    return base.startsWith('/api') ? base : `/api${base}`;
  }
}
