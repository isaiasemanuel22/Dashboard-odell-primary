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
      .set('Authorization', 'Bearer test-token')
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
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('confirma pedido con producto y crea Preparar pedido bloqueada', async () => {
    const customers = await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', 'Bearer test-token');
    const products = await request(app.getHttpServer())
      .get('/api/products')
      .set('Authorization', 'Bearer test-token');
    const customer = customers.body[0];
    const product = products.body.find(
      (item: { type: string }) => item.type === 'fdm',
    );

    const created = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', 'Bearer test-token')
      .send({
        customerId: customer.id,
        dueDate: '2026-09-01T18:00:00.000Z',
        items: [
          {
            serviceType: 'impresion_3d',
            productId: product.id,
            productName: product.name,
            quantity: 2,
            unitPrice: product.price,
          },
        ],
      })
      .expect(201);

    const overview = await request(app.getHttpServer())
      .get(`/api/orders/${created.body.id}/overview`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(overview.body.order.status).toBe('pendiente');
    expect(overview.body.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskType: 'PREPARE_ORDER',
          status: 'bloqueado',
        }),
      ]),
    );
  });

  afterEach(async () => {
    await app?.close();
  });
});
