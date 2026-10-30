# Runbook vận hành — Sân 7 Manager

## Môi trường

| Môi trường | Hạ tầng | Dữ liệu |
| --- | --- | --- |
| local | Postgres local, `pnpm dev` | seed demo |
| preview (mỗi PR) | Vercel preview + Neon branch | seed demo |
| staging (`main`) | Vercel + Neon branch `staging` | seed demo (`SEED_DEMO=true`) |
| production | Vercel `sin1` + Neon `main` (Singapore) | không seed |

## Biến môi trường

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
| Người dùng bị khoá đăng nhập | Sai 5 lần/15 phút → tự mở sau 15 phút; Admin có thể "Mở khoá"/"Đặt lại mật khẩu" ở tab Hệ thống |
| Số dư quỹ lạ | Bảng `fund_entries` có khoá nguồn; mọi thao tác ĐT ghi `audit_logs` (ai, trước/sau) |
