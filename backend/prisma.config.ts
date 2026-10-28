import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Placeholder solo para `prisma generate` en builds (Heroku) sin DATABASE_URL aún.
// En runtime / db push se usa la URL real del entorno.
const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  'mysql://generate:generate@127.0.0.1:3306/generate';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
