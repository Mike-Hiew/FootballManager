import 'dotenv/config';
import { config as load } from 'dotenv';
import { defineConfig } from 'prisma/config';

load({ path: '../../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx --env-file-if-exists=../../.env prisma/seed.ts' },
  // `prisma generate` không cần DB; migrate/seed sẽ báo lỗi rõ nếu thiếu URL.
  // Migrate cần kết nối trực tiếp (advisory lock không qua được pooler); DATABASE_URL_UNPOOLED do Neon trên Vercel đặt.
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '' },
});
