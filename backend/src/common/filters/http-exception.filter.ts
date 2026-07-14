import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Error interno del servidor';

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

    if (status === HttpStatus.NOT_MODIFIED) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    response.status(status).json(payload);
  }
}
