import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { EtagInterceptor } from './common/interceptors/etag.interceptor';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppConfigService } from './config/app-config.service';
import { ensureUploadsDir } from './upload/upload.paths';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api');
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'If-None-Match'],
    exposedHeaders: ['X-Request-Id', 'ETag'],
  });
  ensureUploadsDir();
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.enableShutdownHooks();

  await app.listen(config.port);
  console.log(`API corriendo en http://localhost:${config.port}/api`);
}
bootstrap();
