import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@san7/db';
import { hit, RULES } from '@/server/ratelimit';
import * as auth from '@/server/services/auth';
import { tick } from '@/server/jobs/tick';
import { expectStatus } from './helpers';

const req = vi.hoisted(() => ({ ip: '203.0.113.7' }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': `${req.ip}, 10.0.0.1` }) }));

describe('Giới hạn tần suất theo IP (API công khai)', () => {
  beforeEach(async () => {
    await prisma.rateHit.deleteMany();
  });

  it('quá ngưỡng trong cửa sổ → 429, ra khỏi cửa sổ thì dùng tiếp', async () => {
    const rule = { max: 3, windowMs: 60e3 };
    const t0 = new Date('2026-10-30T10:00:00Z');
    for (let i = 0; i < 3; i++) await hit('test:k', rule, new Date(t0.getTime() + i * 1000));
    await expectStatus(hit('test:k', rule, new Date(t0.getTime() + 5000)), 429);
    // khoá khác không bị ảnh hưởng
    await hit('test:other', rule, new Date(t0.getTime() + 5000));
    // sau 1 phút kể từ lần đầu
    await hit('test:k', rule, new Date(t0.getTime() + 61_000));
  });

  it('quên mật khẩu: tính theo IP thật đầu tiên trong x-forwarded-for', async () => {
    req.ip = '203.0.113.8';
    for (let i = 0; i < RULES.forgot.max; i++) await auth.forgotPassword(`khong-co-${i}@example.com`);
    await expectStatus(auth.forgotPassword('khong-co-x@example.com'), 429);
    expect(await prisma.rateHit.count({ where: { key: 'forgot:ip:203.0.113.8' } })).toBe(RULES.forgot.max);
    // IP khác vẫn gửi được
    req.ip = '203.0.113.9';
    await auth.forgotPassword('khong-co-y@example.com');
  });

  it('quên mật khẩu: tối đa 3 lần/giờ cho cùng một email dù đổi IP', async () => {
    for (let i = 0; i < RULES.forgotEmail.max; i++) {
      req.ip = `198.51.100.${i}`;
      await auth.forgotPassword('nan-nhan@example.com');
    }
    req.ip = '198.51.100.99';
    await expectStatus(auth.forgotPassword('nan-nhan@example.com'), 429);
  });

  it('đăng nhập: quá ngưỡng IP thì chặn trước cả khi kiểm tra mật khẩu', async () => {
    req.ip = '192.0.2.1';
    for (let i = 0; i < RULES.login.max; i++) await prisma.rateHit.create({ data: { key: 'login:ip:192.0.2.1' } });
    await expectStatus(auth.login('0901000002', '123456'), 429);
    req.ip = '192.0.2.2';
    expect((await auth.login('0901000002', '123456').catch((e) => e)).status).not.toBe(429);
  });

  it('job tick dọn dấu vết cũ hơn 1 ngày', async () => {
    const now = new Date();
    await prisma.rateHit.createMany({ data: [{ key: 'a', at: new Date(now.getTime() - 2 * 864e5) }, { key: 'b', at: now }] });
    await prisma.jobRun.deleteMany({ where: { job: 'lock' } });
    await tick(now);
    expect((await prisma.rateHit.findMany()).map((r) => r.key)).toEqual(['b']);
  });
});
