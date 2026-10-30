import { execSync } from 'node:child_process';

/** DB test riêng: migrate deploy + seed dữ liệu demo trước toàn bộ suite. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/san7_test';
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, SEED_DEMO: 'true', PRISMA_HIDE_UPDATE_MESSAGE: '1' };
  const cwd = new URL('../../../packages/db', import.meta.url).pathname;
  // migrate deploy chỉ áp migration còn thiếu; seed tự xoá dữ liệu cũ của DB test.
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'pipe' });
}
