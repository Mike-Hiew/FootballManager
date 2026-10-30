/**
 * Tạo (hoặc nâng quyền) tài khoản quản trị hệ thống — dùng cho production, nơi không chạy seed demo.
 *
 *   DATABASE_URL="<chuỗi kết nối Direct>" pnpm db:create-admin --phone 0901234567 --name "Nguyễn Văn A" [--email a@x.vn]
 *
 * - SĐT đã có tài khoản (ví dụ vừa đăng ký ở /dang-ky): chỉ nâng role thành admin, giữ nguyên mật khẩu.
 * - Chưa có: tạo tài khoản mới. Mật khẩu lấy từ biến ADMIN_PASSWORD; không có thì sinh ngẫu nhiên và in ra một lần.
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { hash } from '@node-rs/argon2';
import { emailSchema, passwordSchema, phoneSchema } from '@san7/core';
import { prisma } from '../src';

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const { values } = parseArgs({
  options: { phone: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } },
  strict: true,
});

const phone = phoneSchema.safeParse(values.phone ?? '');
if (!phone.success) die('Thiếu hoặc sai --phone (ví dụ --phone 0901234567)');

const existing = await prisma.user.findUnique({ where: { phone: phone.data } });
if (existing) {
  if (existing.role === 'admin') console.info(`${existing.name} (${phone.data}) đã là admin.`);
  else {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'admin' } });
    console.info(`Đã nâng ${existing.name} (${phone.data}) thành admin. Mật khẩu giữ nguyên.`);
  }
} else {
  const name = values.name?.trim();
  if (!name) die('SĐT chưa có tài khoản: cần thêm --name "Họ tên"');
  const email = values.email ? emailSchema.safeParse(values.email) : null;
  if (email && !email.success) die('Sai --email');
  if (email && (await prisma.user.findUnique({ where: { email: email.data } }))) die(`Email ${email.data} đã thuộc tài khoản khác`);
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) die(`ADMIN_PASSWORD không hợp lệ: ${pw.error.issues[0]?.message}`);
  await prisma.user.create({ data: { name, phone: phone.data, email: email?.data ?? null, role: 'admin', passwordHash: await hash(pw.data) } });
  console.info(`Đã tạo admin ${name} (${phone.data}).`);
  if (generated) console.info(`Mật khẩu (chỉ in một lần, hãy lưu lại): ${password}`);
}
await prisma.$disconnect();
