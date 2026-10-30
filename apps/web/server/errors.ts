/** Lỗi nghiệp vụ có mã HTTP; thông điệp tiếng Việt hiện thẳng cho người dùng (toast). */
export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 423 | 429,
    message: string,
  ) {
    super(message);
  }
}

export const CAPTAIN_ONLY = 'Chỉ đội trưởng mới thay đổi được mục này';

export const unauthorized = (m = 'Bạn cần đăng nhập') => new AppError(401, m);
export const forbidden = (m = CAPTAIN_ONLY) => new AppError(403, m);
export const notFound = (m = 'Không tìm thấy dữ liệu') => new AppError(404, m);
export const conflict = (m: string) => new AppError(409, m);
export const invalid = (m: string) => new AppError(422, m);

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

/** Lấy thông điệp đầu tiên của ZodError. */
export function zodMessage(e: { issues: Array<{ message: string; path: PropertyKey[] }> }): string {
  const i = e.issues[0];
  return i ? i.message : 'Dữ liệu không hợp lệ';
}
