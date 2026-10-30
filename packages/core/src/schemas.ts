import { z } from 'zod';
import { STAT_KEYS, STYLES } from './stats';
import { FEET, POSITIONS, type Position } from './positions';
import { FORMATION_IDS } from './formation';

// Không cho Zod thử `new Function` (dò JIT): CSP của app chặn eval nên mỗi trang sẽ sinh báo cáo vi phạm.
z.config({ jitless: true });

const half = z.number().min(1).max(10).refine((v) => Number.isInteger(v * 2), 'Bước 0.5');
export const statsSchema = z.object(Object.fromEntries(STAT_KEYS.map((k) => [k, half])) as Record<(typeof STAT_KEYS)[number], typeof half>);

/** Điểm tự chấm theo vị trí. Bỏ qua vị trí không còn dùng (CDM/LM/RM/CAM trong đơn/hồ sơ cũ) thay vì báo lỗi. */
export const ratingsSchema = z
  .record(z.string(), z.number().min(1).max(10))
  .transform((r) => Object.fromEntries(Object.entries(r).filter(([k]) => (POSITIONS as readonly string[]).includes(k))) as Partial<Record<Position, number>>);

export const lineupSchema = z.array(z.string().min(1).nullable()).length(7);
export const formationSchema = z.enum(FORMATION_IDS as [string, ...string[]]);
export const footSchema = z.enum(FEET);
export const payTypeSchema = z.enum(['quy', 'le']);
export const styleSchema = z.enum(STYLES);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ');
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ không hợp lệ');
export const moneySchema = z.number().int().min(0).max(1_000_000_000);

export const PASSWORD_MIN = 8;
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'qwertyui', '11111111', '00000000',
  '88888888', '12341234', 'iloveyou', 'abcd1234', 'abc12345', 'qwerty123', '1q2w3e4r', '123123123',
  'matkhau1', 'matkhau123', 'admin123', 'football', 'bongda123', '66666666', '99999999', '87654321',
]);
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Mật khẩu tối thiểu ${PASSWORD_MIN} ký tự`)
  .max(128)
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), 'Mật khẩu quá phổ biến, hãy chọn mật khẩu khác');

export const phoneSchema = z
  .string()
  .transform((p) => {
    let d = p.replace(/\D/g, '');
    if (d.startsWith('84')) d = '0' + d.slice(2);
    return d;
  })
  .refine((d) => /^0\d{9,10}$/.test(d), 'Số điện thoại không hợp lệ');

export const emailSchema = z.string().trim().toLowerCase().email('Email không hợp lệ');

/** Ảnh: URL https (R2) hoặc data URL ảnh đã resize ở trình duyệt (fallback khi chưa cấu hình R2). */
export const imageUrlSchema = z
  .string()
  .max(400_000, 'Ảnh quá lớn')
  .refine((u) => /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(u), 'Ảnh không hợp lệ');

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Nhập họ tên').max(60),
  nick: z.string().trim().max(24).optional().nullable(),
  dob: dateSchema.optional().nullable(),
  num: z.number().int().min(0).max(99).optional().nullable(),
  foot: footSchema,
  styles: z.array(styleSchema).max(14).default([]),
  avatarUrl: imageUrlSchema.optional().nullable(),
  stats: statsSchema,
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const teamNameSchema = z.string().trim().min(2, 'Tên đội quá ngắn').max(40, 'Tên đội tối đa 40 ký tự');
