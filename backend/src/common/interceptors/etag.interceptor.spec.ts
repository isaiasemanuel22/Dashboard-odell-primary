import { createHash } from 'crypto';
import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import { EtagInterceptor } from './etag.interceptor';

describe('EtagInterceptor', () => {
  const interceptor = new EtagInterceptor();

  function createContext(
    ifNoneMatch?: string,
    path = '/api/products',
  ): ExecutionContext {
    const headers: Record<string, string> = {};
    if (ifNoneMatch) {
      headers['if-none-match'] = ifNoneMatch;
    }

    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: `${path}?all=true`,
          url: `${path}?all=true`,
          headers,
        }),
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  }

  it('devuelve 304 sin escribir la respuesta manualmente', (done) => {
    const body = [{ id: 'prod-1', name: 'Pieza' }];
    const etag = `"${createHash('md5').update(JSON.stringify(body)).digest('hex')}"`;
    const context = createContext(etag);

    interceptor
      .intercept(context, { handle: () => of(body) })
      .subscribe({
        error: (err) => {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.NOT_MODIFIED);
          done();
        },
      });
  });

  it('incluye ETag cuando el contenido cambió', (done) => {
    const body = [{ id: 'prod-1', name: 'Pieza' }];
    const context = createContext();
    const res = context.switchToHttp().getResponse<{ setHeader: jest.Mock }>();

    interceptor
      .intercept(context, { handle: () => of(body) })
      .subscribe({
        next: (result) => {
          expect(result).toEqual(body);
          expect(res.setHeader).toHaveBeenCalledWith('ETag', expect.any(String));
          done();
        },
      });
  });
});
