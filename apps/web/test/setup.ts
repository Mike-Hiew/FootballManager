import { execSync } from 'node:child_process';
import { beforeAll } from 'vitest';

/** Mỗi file test bắt đầu từ dữ liệu demo sạch (các file chạy tuần tự). */
beforeAll(() => {
  const cwd = new URL('../../../packages/db', import.meta.url).pathname;
  execSync('npx tsx prisma/seed.ts', { cwd, env: process.env, stdio: 'pipe' });
});
