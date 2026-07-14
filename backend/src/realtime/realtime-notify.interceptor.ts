import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { StoreChangeService } from '../store/store-change.service';
import {
  normalizeApiPath,
  shouldTrackHttpMutation,
} from '../store/route-registry';

@Injectable()
export class RealtimeNotifyInterceptor implements NestInterceptor {
  constructor(private readonly storeChange: StoreChangeService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();
    const path = normalizeApiPath(req.originalUrl ?? req.url);

    if (!shouldTrackHttpMutation(path, method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (body) => {
          this.storeChange.recordHttpMutation(path, method, body);
        },
      }),
    );
  }
}
