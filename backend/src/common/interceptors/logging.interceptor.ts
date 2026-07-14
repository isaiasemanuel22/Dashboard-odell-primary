import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const { method } = req;
    const path = this.requestPath(req);
    const started = Date.now();
    const requestId = req.requestId ?? '-';
    const userId = req.user?.uid ?? '-';

    this.logger.log(`→ [${requestId}] ${method} ${path} user=${userId}`);

    return next.handle().pipe(
      tap({
        next: () => this.logResponse(req, context, started),
        error: (error: { status?: number; getStatus?: () => number }) => {
          const status = error.getStatus?.() ?? error.status ?? 500;
          const ms = Date.now() - started;
          const line = `← [${requestId}] ${method} ${path} ${status} ${ms}ms user=${userId}`;
          if (status === 304) {
            this.logger.log(line);
            return;
          }
          this.logger.warn(line);
        },
      }),
    );
  }

  private logResponse(
    req: Request,
    context: ExecutionContext,
    started: number,
  ): void {
    const res = context.switchToHttp().getResponse<Response>();
    const path = this.requestPath(req);
    const ms = Date.now() - started;
    const requestId = req.requestId ?? '-';
    const userId = req.user?.uid ?? '-';
    this.logger.log(
      `← [${requestId}] ${req.method} ${path} ${res.statusCode} ${ms}ms user=${userId}`,
    );
  }

  private requestPath(req: Request): string {
    const base = req.originalUrl ?? req.url;
    return base.startsWith('/api') ? base : `/api${base}`;
  }
}
