-- v6 fase 1 (§28): integraciones, factura y comisión en ventas de mostrador/feria.
-- NO se ejecuta desde el repo: aplicarlo a mano (primero local, después Heroku con OK de Isaías).
-- Equivale al cambio en backend/prisma/schema.prisma (Float = DOUBLE en MySQL).

ALTER TABLE app_settings
  ADD COLUMN integrations JSON NOT NULL DEFAULT (JSON_OBJECT());

ALTER TABLE orders
  ADD COLUMN activity_history JSON NOT NULL DEFAULT (JSON_ARRAY()),
  ADD COLUMN invoice_type VARCHAR(8) NULL,
  ADD COLUMN invoice_number VARCHAR(32) NULL,
  ADD COLUMN invoiced_at DATETIME(3) NULL;

ALTER TABLE retail_sales
  ADD COLUMN invoice_type VARCHAR(8) NULL,
  ADD COLUMN invoice_number VARCHAR(32) NULL,
  ADD COLUMN invoiced_at DATETIME(3) NULL,
  ADD COLUMN fee DOUBLE NOT NULL DEFAULT 0;
