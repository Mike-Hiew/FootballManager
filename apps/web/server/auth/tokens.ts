import { createHash, randomBytes } from 'node:crypto';

export const newToken = () => randomBytes(32).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
/** Mã mời 6 ký tự a–z0–9 (BRD 3.1). */
export function inviteCode(): string {
  const b = randomBytes(6);
  return Array.from(b, (x) => ALPHA[x % ALPHA.length]).join('');
}
