import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

function isEntityTooLarge(exception: unknown): boolean {
  if (!exception || typeof exception !== 'object') return false;
  const err = exception as {
    type?: string;
    status?: number;
    statusCode?: number;
  };
  return (
    err.type === 'entity.too.large' ||
    err.status === HttpStatus.PAYLOAD_TOO_LARGE ||
    err.statusCode === HttpStatus.PAYLOAD_TOO_LARGE
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let exceptionResponse: string | object;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      exceptionResponse = exception.getResponse();
    } else if (isEntityTooLarge(exception)) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      exceptionResponse =
        'El contenido es demasiado grande. Si pegaste imágenes en el detalle, subilas con el botón de imagen.';
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      exceptionResponse = 'Error interno del servidor';
    }

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as { message?: string | string[] }).message ??
          'Error');

    const payload = {
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      path: request.originalUrl ?? request.url,
      requestId: request.requestId ?? null,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.requestId ?? '-'}] ${request.method} ${payload.path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (status === Number(HttpStatus.NOT_MODIFIED)) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    response.status(status).json(payload);
  }
}
