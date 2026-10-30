import 'dotenv/config';
import { config as load } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

load({ path: '../../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx --env-file-if-exists=../../.env prisma/seed.ts' },
  datasource: { url: env('DIRECT_URL') },
});
