import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Dashboard API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/dashboard/stats (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/dashboard/stats')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('totalOrders');
        expect(res.body).toHaveProperty('monthlyRevenue');
      });
  });

  it('/api/health (GET) expone arquitectura single-instance', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.architecture.singleInstance).toBe(true);
        expect(res.body.architecture.store).toBe('in-memory');
      });
  });

  it('/api/customers (GET) responde lista', () => {
    return request(app.getHttpServer())
      .get('/api/customers')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  afterEach(async () => {
    await app?.close();
  });
});
