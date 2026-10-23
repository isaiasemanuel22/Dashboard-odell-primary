import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl, parseMysqlUrl } from '../src/prisma/db-url.util';

type BrandKind = 'filament' | 'resin';

type BrandRow = {
  id: string;
  name: string;
  materialTypes: Set<BrandKind>;
};

async function columnExists(
  prisma: PrismaClient,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND COLUMN_NAME = ${column}
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseJson(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return value ?? [];
}

function asArray(value: unknown): unknown[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está configurada en backend/.env');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(parseMysqlUrl(databaseUrl)),
  });

  try {
    await prisma.$connect();
    const suppliesHaveBrand = await columnExists(prisma, 'supplies', 'brand');
    const productsHaveBrand = await columnExists(prisma, 'products', 'brand');
    if (!suppliesHaveBrand && !productsHaveBrand) {
      console.log('La marca ya está migrada. Nada que hacer.');
      return;
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`brands\` (
        \`id\` VARCHAR(64) NOT NULL,
        \`name\` VARCHAR(128) NOT NULL,
        \`material_types\` JSON NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL,
        UNIQUE INDEX \`brands_name_key\`(\`name\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    if (!(await columnExists(prisma, 'supplies', 'brand_id'))) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE `supplies` ADD COLUMN `brand_id` VARCHAR(64) NULL',
      );
    }
    if (!(await columnExists(prisma, 'products', 'brand_id'))) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE `products` ADD COLUMN `brand_id` VARCHAR(64) NULL',
      );
    }

    const existing = await prisma.$queryRaw<{ id: string; name: string; material_types: unknown }[]>`
      SELECT id, name, material_types FROM brands
    `;
    const byName = new Map<string, BrandRow>();
    let nextNumber = 1;
    for (const row of existing) {
      const match = row.id.match(/^br-(\d+)$/);
      if (match) nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
      const types = new Set<BrandKind>();
      const parsed = parseJson(row.material_types);
      if (Array.isArray(parsed)) {
        for (const type of parsed) {
          if (type === 'filament' || type === 'resin') types.add(type);
        }
      }
      byName.set(row.name.trim().toLowerCase(), {
        id: row.id,
        name: row.name,
        materialTypes: types,
      });
    }

    const ensure = (name: unknown, type?: BrandKind): string | null => {
      if (typeof name !== 'string' || !name.trim()) return null;
      const trimmed = name.trim();
      const key = trimmed.toLowerCase();
      let brand = byName.get(key);
      if (!brand) {
        brand = {
          id: `br-${nextNumber++}`,
          name: trimmed,
          materialTypes: new Set(type ? [type] : []),
        };
        byName.set(key, brand);
        return brand.id;
      }
      if (type) brand.materialTypes.add(type);
      return brand.id;
    };

    const settings = await prisma.$queryRaw<
      { filament_prices: unknown; resin_prices: unknown }[]
    >`SELECT filament_prices, resin_prices FROM app_settings WHERE id = 1`;
    const settingsRow = settings[0];
    const filamentPrices = asArray(settingsRow?.filament_prices);
    const resinPrices = asArray(settingsRow?.resin_prices);

    const nextFilamentPrices = filamentPrices.map((entry) => {
      const record = asRecord(entry);
      if (!record) return entry;
      const brandId =
        typeof record.brandId === 'string'
          ? record.brandId
          : ensure(record.brand, 'filament');
      return {
        id: record.id,
        brandId,
        materialType: record.materialType,
        pricePerKg: record.pricePerKg,
      };
    });
    const nextResinPrices = resinPrices.map((entry) => {
      const record = asRecord(entry);
      if (!record) return entry;
      const brandId =
        typeof record.brandId === 'string'
          ? record.brandId
          : ensure(record.brand, 'resin');
      return {
        id: record.id,
        brandId,
        resinType: record.resinType,
        pricePerLiter: record.pricePerLiter,
      };
    });

    if (suppliesHaveBrand) {
      const supplies = await prisma.$queryRaw<
        { id: string; brand: string | null; category: string; resin_type: string | null }[]
      >`SELECT id, brand, category, resin_type FROM supplies`;
      for (const supply of supplies) {
        const type =
          supply.category === 'fdm'
            ? 'filament'
            : supply.category === 'resina' && supply.resin_type
              ? 'resin'
              : undefined;
        const brandId = ensure(supply.brand, type as BrandKind | undefined);
        if (!brandId) continue;
        await prisma.$executeRaw`
          UPDATE supplies SET brand_id = ${brandId} WHERE id = ${supply.id}
        `;
      }
    }

    if (productsHaveBrand) {
      const products = await prisma.$queryRaw<
        { id: string; brand: string | null; type: string; fdm_filaments: unknown }[]
      >`SELECT id, brand, type, fdm_filaments FROM products`;
      for (const product of products) {
        const type =
          product.type === 'fdm'
            ? 'filament'
            : product.type === 'resina'
              ? 'resin'
              : undefined;
        const brandId = ensure(product.brand, type as BrandKind | undefined);
        const lines = parseJson(product.fdm_filaments);
        const nextLines = Array.isArray(lines)
          ? lines.map((line) => {
              const record = asRecord(line);
              if (!record) return line;
              const lineBrandId =
                typeof record.brandId === 'string'
                  ? record.brandId
                  : ensure(record.brand, 'filament');
              return {
                ...record,
                brandId: lineBrandId ?? undefined,
                brand: undefined,
              };
            })
          : [];
        await prisma.$executeRaw`
          UPDATE products
          SET brand_id = ${brandId},
              fdm_filaments = ${JSON.stringify(nextLines)}
          WHERE id = ${product.id}
        `;
      }
    }

    const now = new Date();
    for (const brand of byName.values()) {
      const types = JSON.stringify([...brand.materialTypes]);
      await prisma.$executeRaw`
        INSERT INTO brands (id, name, material_types, created_at)
        VALUES (${brand.id}, ${brand.name}, ${types}, ${now})
        ON DUPLICATE KEY UPDATE
          material_types = ${types}
      `;
    }

    if (settingsRow) {
      await prisma.$executeRaw`
        UPDATE app_settings
        SET filament_prices = ${JSON.stringify(nextFilamentPrices)},
            resin_prices = ${JSON.stringify(nextResinPrices)}
        WHERE id = 1
      `;
    }

    console.log(`Marcas listas: ${byName.size}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
