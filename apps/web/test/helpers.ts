import { prisma } from '@san7/db';
import { roleIn, type Ctx } from '@/server/authz';

/** Dựng ctx như lớp authz cho một user (theo SĐT) trong một đội. */
export async function ctxFor(phone: string, teamId: string, now = new Date()): Promise<Ctx> {
  const u = await prisma.user.findUniqueOrThrow({ where: { phone } });
  const user = { id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role };
  const { role, playerId } = await roleIn(user, teamId);
  return { user, teamId, role, playerId, now };
}

export const CAPTAIN = '0901000002';
export const MEMBER = '0901000009'; // Quang Còi (p9)
export const OTHER_CAPTAIN = '0902000002'; // Anh Thép — khách ở Đom Đóm
export const ADMIN = '0900000000';
export const DOM = 't-domdom';
export const PH = 't-phohue';

export async function expectStatus(p: Promise<unknown>, status: number) {
  try {
    await p;
  } catch (e) {
    if ((e as { status?: number }).status === status) return e as Error;
    throw e;
  }
  throw new Error(`Mong đợi lỗi ${status} nhưng thành công`);
}
