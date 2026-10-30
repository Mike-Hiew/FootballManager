import { hash, verify } from '@node-rs/argon2';

// argon2id, tham số mặc định của @node-rs/argon2 (m=19 MiB, t=2, p=1) theo khuyến nghị OWASP.
export const hashPassword = (pw: string) => hash(pw);

export async function verifyPassword(hashed: string, pw: string): Promise<boolean> {
  try {
    return await verify(hashed, pw);
  } catch {
    return false;
  }
}
