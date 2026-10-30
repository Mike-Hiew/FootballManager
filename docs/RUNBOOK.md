# Runbook vận hành — Sân 7 Manager

## Môi trường

| Môi trường | Hạ tầng | Dữ liệu |
| --- | --- | --- |
| local | Postgres local, `pnpm dev` | seed demo |
| preview (mỗi PR) | Vercel preview + Neon branch | seed demo |
| staging (`main`) | Vercel + Neon branch `staging` | seed demo (`SEED_DEMO=true`) |
| production | Vercel `sin1` + Neon `main` (Singapore) | không seed |

## Biến môi trường

Dựng từ đầu (tạo tài khoản, khai biến, tạo admin): xem `docs/SETUP.md`.

Xem `.env.example`. Bắt buộc ở production: `DATABASE_URL` (pooled), `DIRECT_URL`, `APP_URL`, `CRON_SECRET`. Nên có: `VAPID_PUBLIC_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (push), `R2_*` (ảnh), `RESEND_API_KEY` + `MAIL_FROM` (quên mật khẩu).

Sinh khoá VAPID:

```bash
npx web-push generate-vapid-keys
```

Khi chưa cấu hình R2, ảnh được resize ở trình duyệt và lưu dạng data URL — chỉ dùng cho dev/staging.

## Deploy

1. Vercel project trỏ Root Directory = `apps/web`; `apps/web/vercel.json` đặt region `sin1` và chạy `prisma migrate deploy` trước `next build`.
2. Migration chỉ dùng `prisma migrate deploy` ở staging/production. Không bao giờ chạy `prisma migrate reset` trên DB thật.
3. Sau deploy: kiểm `GET /dang-nhap` 200 và gọi thử `/api/jobs/tick` với `CRON_SECRET`.

## Bảo mật

- **CSP**: `apps/web/proxy.ts` gắn `Content-Security-Policy` có nonce riêng cho mỗi lần tải trang (`script-src 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`); nội dung ở `apps/web/server/csp.ts`. Vì nonce theo request nên mọi trang render động. Thêm script/dịch vụ bên ngoài (Sentry, analytics…) thì phải mở thêm nguồn ở đó, nếu không trình duyệt sẽ chặn.
- **Giới hạn tần suất theo IP** (`apps/web/server/ratelimit.ts`, bảng `rate_hits`): đăng nhập 30/15 phút, đăng ký 10/giờ, quên mật khẩu 5/giờ (thêm 3/giờ cho mỗi email đích), đặt lại mật khẩu 10/15 phút, gửi đơn xin vào đội 10/giờ. Vượt ngưỡng → 429. Khoá theo tài khoản (sai 5 lần/15 phút) vẫn áp dụng riêng. Job tick xoá bản ghi cũ hơn 1 ngày.
- IP lấy từ `x-real-ip` / `x-forwarded-for` do Vercel đặt. Nếu tự host sau reverse proxy, proxy phải ghi đè hai header này bằng IP thật, nếu không người gọi có thể tự khai IP để né giới hạn.

## Hiệu năng

- Mục tiêu BRD 9.4: trang Đội LCP < 1.5 s trên 4G, API p95 < 300 ms.
- Đo staging/production: Actions → **Perf** → Run workflow, điền `base_url`. Production không có tài khoản demo: tạo một tài khoản đo và đặt secret `PERF_LOGIN_ID` / `PERF_LOGIN_PW` (cùng `team_id` của đội đó).
- k6 bắn 20 req/s trong 1 phút từ một IP; giới hạn theo IP chỉ áp vào đăng nhập/đăng ký… nên chỉ lần đăng nhập ở bước setup bị tính.
- Báo cáo Lighthouse HTML ở artifact `perf-report`.

## Quản trị viên

Production không có seed demo. Tạo hoặc nâng quyền admin (chuỗi kết nối Direct):

```bash
DATABASE_URL="<direct-url>" pnpm db:create-admin --phone 0901234567 --name "Họ Tên"
```

## Rollback

- Code: Vercel → Deployments → Promote bản trước.
- Dữ liệu: Neon point-in-time restore (giữ ≥ 14 ngày). Migration mới nên chỉ thêm cột/bảng để bản code cũ vẫn chạy được.

## Job tick

- Scheduler chính: cron-job.org mỗi 5 phút, header `Authorization: Bearer <CRON_SECRET>`.
- Dự phòng: `.github/workflows/tick.yml` (15 phút, cần biến repo `APP_URL` và secret `CRON_SECRET`).
- Job dùng khoá lease 2 phút trong `job_runs(job='lock', key='tick')`; các việc nhắc dùng `job_runs` để không gửi lặp.
- Nếu scheduler ngừng: MVP vẫn được chốt khi có người mở trang đội (chốt lười); nhắc 9:00 / ngày 5 sẽ trễ.

## Xoay khoá

- `CRON_SECRET`: đổi trên Vercel và scheduler cùng lúc.
- VAPID: đổi khoá làm mất mọi subscription cũ — người dùng phải bật lại thông báo.

## Sự cố thường gặp

| Triệu chứng | Kiểm tra |
| --- | --- |
| Không nhận push trên iPhone | Người dùng phải "Thêm vào màn hình chính" rồi bật thông báo trong app |
| Báo "Bạn thao tác quá nhiều lần" (429) | Giới hạn theo IP ở mục Bảo mật; nhiều người chung một IP (wifi công ty) có thể chạm ngưỡng đăng nhập — tăng `RULES.login` nếu cần |
| Người dùng bị khoá đăng nhập | Sai 5 lần/15 phút → tự mở sau 15 phút; Admin có thể "Mở khoá"/"Đặt lại mật khẩu" ở tab Hệ thống |
| Số dư quỹ lạ | Bảng `fund_entries` có khoá nguồn; mọi thao tác ĐT ghi `audit_logs` (ai, trước/sau) |
