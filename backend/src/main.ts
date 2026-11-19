import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { EtagInterceptor } from './common/interceptors/etag.interceptor';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppConfigService } from './config/app-config.service';
import { ensureUploadsDir } from './upload/upload.paths';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // El webhook de Meta valida la firma sobre el cuerpo crudo.
    rawBody: true,
  });
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api');
  // API JSON consumida desde otro origen (Netlify): se deja pasar el recurso
  // entre orígenes y se desactiva la CSP, que no aplica a respuestas JSON.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(requestIdMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new EtagInterceptor());

  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'If-None-Match',
      'X-Api-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'ETag'],
  });
  ensureUploadsDir();
  app.enableShutdownHooks();

  await app.listen(config.port);
  console.log(`API corriendo en http://localhost:${config.port}/api`);
}
void bootstrap();
