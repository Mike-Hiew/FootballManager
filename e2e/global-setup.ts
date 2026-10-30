import { execSync } from 'node:child_process';

export default function setup() {
  const url = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/san7_e2e';
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, SEED_DEMO: 'true' };
  const cwd = new URL('../packages/db', import.meta.url).pathname;
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'inherit' });
}
