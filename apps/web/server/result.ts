import { unstable_rethrow } from 'next/navigation';
import { AppError } from './errors';

export type ActionResult<T = undefined> =
  | { ok: true; data: T; warning?: string | null }
  | { ok: false; error: string; status: number };

/** Bọc service: lỗi nghiệp vụ → thông điệp tiếng Việt; lỗi lạ → log + thông điệp chung. */
export async function run<T>(fn: () => Promise<T>, warning?: (d: T) => string | null | undefined): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, warning: warning?.(data) ?? null };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) return { ok: false, error: e.message, status: e.status };
    console.error(e);
    return { ok: false, error: 'Có lỗi xảy ra, vui lòng thử lại', status: 500 };
  }
}
