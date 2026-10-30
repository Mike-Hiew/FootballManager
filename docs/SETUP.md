# Dựng hạ tầng — phương án miễn phí

Hướng dẫn dựng Sân 7 Manager bằng các gói free: **Vercel Hobby + Neon + Cloudflare R2 + Resend + cron-job.org**. Không cần sửa code. Chi phí duy nhất là tên miền (không bắt buộc, xem mục 3).

Làm **staging trước** (có dữ liệu demo), chạy ổn rồi mới làm production. Vận hành hằng ngày, sự cố, rollback: xem `docs/RUNBOOK.md`.

## Giới hạn của gói miễn phí

| Dịch vụ | Dùng để | Giới hạn cần biết |
| --- | --- | --- |
| Vercel Hobby | Chạy app (region Singapore `sin1`) | Chỉ dùng phi thương mại — có thu phí người dùng thì phải lên Pro. Cron của Vercel chỉ 1 lần/ngày nên job dùng cron-job.org |
| Neon Free | Postgres | 0,5 GB. DB tự ngủ khi rảnh; job gọi mỗi 5 phút nên gần như luôn thức |
| Cloudflare R2 | Ảnh (avatar, logo đội, cúp) | 10 GB, không tính phí băng thông. Cloudflare có thể yêu cầu gắn thẻ mới bật được R2 |
| Resend | Email quên mật khẩu | 100 email/ngày, 3.000/tháng. Cần tên miền riêng |
| cron-job.org | Gọi job mỗi 5 phút | Miễn phí |
| GitHub Actions | CI, job dự phòng | Repo private: 2.000 phút/tháng — job dự phòng 15 phút/lần tốn ~2.900 phút/tháng, nên **repo private thì không bật** (bỏ qua mục 7.1) |

## 0. Chuẩn bị (trên máy bạn)

Mỗi môi trường (staging, production) dùng một bộ riêng:

```bash
openssl rand -hex 32
```

→ `CRON_SECRET`.

```bash
npx web-push generate-vapid-keys
```

→ `VAPID_PUBLIC_KEY` (cũng là `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) và `VAPID_PRIVATE_KEY`.

## 1. Database (Neon)

Cách gọn nhất là tạo ngay trong Vercel (sau khi làm bước 4.1): **Storage → Create Database → Neon**, region **Singapore**. Hoặc tạo ở neon.tech: project region **AWS Asia Pacific (Singapore)**, Postgres 17.

1. Lấy 2 chuỗi kết nối:
   - **Pooled** (host có `-pooler`) → `DATABASE_URL`
   - **Direct / unpooled** → `DIRECT_URL` (migration cần kết nối trực tiếp). Tạo qua Vercel thì thường có sẵn biến `DATABASE_URL_UNPOOLED` — đặt `DIRECT_URL` bằng giá trị đó.
2. Tạo branch `staging` cho staging; branch `main` cho production.

## 2. Ảnh (Cloudflare R2)

1. R2 → **Create bucket**, ví dụ `san7-images`.
2. Cho đọc công khai: gắn custom domain (ví dụ `img.tenmien.vn`) hoặc bật `r2.dev`. Domain đó là `R2_PUBLIC_URL`.
3. **Manage R2 API Tokens** → token quyền **Object Read & Write**, chỉ cho bucket này → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. `R2_ACCOUNT_ID` ở trang tổng quan R2.
4. Bucket → **Settings → CORS policy** (bắt buộc — trình duyệt upload thẳng lên R2):

```json
[
  {
    "AllowedOrigins": ["https://tenmien.vn", "https://staging-cua-ban.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Không muốn dùng R2: bỏ trống các biến `R2_*`, app tự lưu ảnh dạng data URL trong DB. Chạy được nhưng DB phình nhanh — chỉ hợp để thử.

## 3. Email (Resend)

Cần tên miền riêng (~300.000đ/năm cho .vn/.com). Không có tên miền thì bỏ qua bước này: app vẫn chạy trên `*.vercel.app`, chỉ không gửi được email quên mật khẩu — admin đặt lại mật khẩu cho người dùng ở tab **Hệ thống**.

1. **Domains** → thêm tên miền → tạo các bản ghi DNS (SPF, DKIM) Resend đưa ra → chờ Verified.
2. **API Keys** → key quyền *Sending access* → `RESEND_API_KEY`.
3. `MAIL_FROM`, ví dụ `Sân 7 <no-reply@tenmien.vn>`.

## 4. App (Vercel Hobby)

1. **Add New → Project** → import repo `Mike-Hiew/FootballManager`.
2. **Root Directory** = `apps/web`, Framework = Next.js. Không sửa Build Command — `apps/web/vercel.json` đã chạy `prisma migrate deploy` trước `next build` và đặt region `sin1`.
3. **Settings → Environment Variables**:

| Biến | Production | Preview (staging) |
| --- | --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Neon branch `main` | Neon branch `staging` |
| `APP_URL` | `https://tenmien.vn` (không có `/` cuối) | URL staging |
| `CRON_SECRET` | bộ riêng | bộ riêng |
| `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | bộ riêng | bộ riêng |
| `VAPID_SUBJECT` | `mailto:email-cua-ban` | như production |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | ✓ | ✓ |
| `RESEND_API_KEY`, `MAIL_FROM` | ✓ | ✓ |
| `APP_NAME` | tuỳ chọn | tuỳ chọn |
| `SEED_DEMO` | **không đặt** | `true` |

4. Có tên miền: **Settings → Domains** → thêm tên miền, trỏ DNS theo hướng dẫn của Vercel. Đổi tên miền thì phải sửa `APP_URL` và CORS của R2.

## 5. Dữ liệu ban đầu

Các lệnh dưới chạy từ thư mục gốc repo trên máy bạn, dùng chuỗi kết nối **Direct**.

**Staging** — nạp dữ liệu demo:

```bash
DATABASE_URL="<direct-url-staging>" DIRECT_URL="<direct-url-staging>" SEED_DEMO=true pnpm db:seed
```

**Production** — không seed. Tạo tài khoản quản trị:

```bash
DATABASE_URL="<direct-url-production>" pnpm db:create-admin --phone 0901234567 --name "Họ Tên" --email ban@tenmien.vn
```

- Không đặt `ADMIN_PASSWORD` thì lệnh sinh mật khẩu ngẫu nhiên và in ra **một lần** — lưu lại ngay.
- SĐT đã có tài khoản (ví dụ vừa đăng ký ở `/dang-ky`) thì lệnh chỉ nâng quyền admin, giữ nguyên mật khẩu.

## 6. Job mỗi 5 phút (cron-job.org)

Tạo cronjob:

- URL: `https://tenmien.vn/api/jobs/tick`
- Method: **POST**
- Lịch: mỗi 5 phút
- Header: `Authorization: Bearer <CRON_SECRET>`

Job chốt MVP quá hạn, ghi tiền sân, nhắc điểm danh 9:00, nhắc đóng quỹ ngày 5, chốt mùa 1/1 và đẩy push còn sót. Nếu job ngừng, MVP vẫn được chốt khi có người mở trang đội, nhưng các thông báo nhắc sẽ trễ.

## 7. GitHub

**Settings → Secrets and variables → Actions**:

1. Job dự phòng (chỉ nên bật khi repo public): variable `APP_URL`, secret `CRON_SECRET`.
2. Đo hiệu năng production: secret `PERF_LOGIN_ID`, `PERF_LOGIN_PW` — một tài khoản riêng để đo (production không có tài khoản demo).

## 8. Kiểm tra sau deploy

1. Mở `/dang-nhap`, đăng nhập bằng admin vừa tạo; vào tab **Hệ thống** thấy được.
2. Đổi ảnh đại diện → ảnh hiện lại sau khi tải trang (R2 + CORS đúng).
3. Gọi job — kết quả là JSON có `"locked": false`:

```bash
curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://tenmien.vn/api/jobs/tick
```

4. Quên mật khẩu → email về (Resend).
5. Trên điện thoại: "Thêm vào màn hình chính" rồi bật thông báo (bắt buộc với iPhone) → mở vote một trận → điện thoại nhận push.
6. Actions → **Perf** → Run workflow với `base_url` (production thêm `team_id` của đội có tài khoản đo). Mục tiêu: API p95 < 300 ms, LCP trang Đội < 1.5 s.

## Khi cần nâng cấp

- Thu phí người dùng → Vercel Pro. Khi đó có thể bỏ cron-job.org và dùng Vercel Cron (`/api/jobs/tick` đã nhận `GET` với `Authorization: Bearer <CRON_SECRET>`, đúng cách Vercel Cron gọi).
- DB gần 0,5 GB → Neon Launch.
