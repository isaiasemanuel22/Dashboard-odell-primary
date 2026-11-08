import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function createHost(path = '/api/orders/1'): {
    host: ArgumentsHost;
    res: { status: jest.Mock; json: jest.Mock; end: jest.Mock };
  } {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      end: jest.fn(),
    };

    const host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
          originalUrl: path,
          url: path,
          requestId: 'req-test',
        }),
        getResponse: () => res,
      }),
    } as unknown as ArgumentsHost;

    return { host, res };
  }

  it('responde 413 cuando body-parser indica entity.too.large', () => {
    const { host, res } = createHost();
    const exception = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      status: 413,
      statusCode: 413,
      limit: 102400,
      length: 500000,
    });

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: [
          'El contenido es demasiado grande. Si pegaste imágenes en el detalle, subilas con el botón de imagen.',
        ],
        path: '/api/orders/1',
        requestId: 'req-test',
      }),
    );
  });

  it('responde 413 cuando statusCode es 413 sin type', () => {
    const { host, res } = createHost();
    const exception = Object.assign(new Error('too large'), {
      statusCode: 413,
    });

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 413,
      }),
    );
  });

  it('responde 500 ante un Error genérico', () => {
    const { host, res } = createHost();

    filter.catch(new Error('boom'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: ['Error interno del servidor'],
      }),
    );
  });

  it('respeta HttpException', () => {
    const { host, res } = createHost();

    filter.catch(
      new HttpException('No encontrado', HttpStatus.NOT_FOUND),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: ['No encontrado'],
      }),
    );
  });
});
