# Đom Đóm FC — Sân 7 Manager

Web app (PWA, ưu tiên mobile) quản lý nhiều đội bóng phong trào sân 7: cầu thủ và 17 chỉ số, điểm 10 vị trí, chiến thuật kiểu FO4, lịch đấu, điểm danh 1 chạm, kết quả, khai báo, vote MVP, quỹ đội, thống kê mùa, Khám phá và Admin.

- Nghiệp vụ: [docs/BRD.md](docs/BRD.md) · Kiến trúc: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Kế hoạch & trạng thái: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) · Dựng hạ tầng: [docs/SETUP.md](docs/SETUP.md) · Vận hành: [docs/RUNBOOK.md](docs/RUNBOOK.md)
- Prototype giao diện gốc: [docs/prototype/domdom-fc.html](docs/prototype/domdom-fc.html)

## Cấu trúc

```text
apps/web          Next.js 16 (App Router): giao diện, Server Actions, REST /api/*, job /api/jobs/tick
  server/         auth (argon2id + session), authz (vai trò theo đội), services/*, jobs/tick
  components/     các tab: dashboard, players, tactics, matches, quỹ, thống kê, duyệt…
  test/           Vitest tích hợp, chạy service trên Postgres thật
packages/core     TypeScript thuần: điểm vị trí, inferStats, Hungarian autoPick, buildPlan, mùa, MVP, quỹ, thời gian VN
packages/db       Prisma 7 schema, migration, seed dữ liệu demo (port từ prototype)
e2e               Playwright theo tiêu chí nghiệm thu BRD 11.1
```

## Chạy local

Yêu cầu: Node 22, pnpm 10, PostgreSQL 16+.

```bash
pnpm install
```

```bash
cp .env.example .env   # sửa DATABASE_URL / DIRECT_URL nếu cần
```

```bash
pnpm db:deploy && pnpm db:seed
```

```bash
pnpm dev               # http://localhost:3000
```

Tài khoản demo (chỉ khi `SEED_DEMO=true`): Admin `0900000000` / `admin123`; ĐT Đom Đóm `0901000002`, thành viên `0901000009`, ĐT Phố Huế `0902000002`, đang chờ duyệt `0901000099` — mật khẩu `123456`. Trang đăng nhập có nút đăng nhập nhanh.

## Kiểm thử

```bash
pnpm --filter @san7/core test     # 59 test công thức (golden fixture sinh từ prototype)
```

```bash
pnpm --filter @san7/web test      # test tích hợp trên DB san7_test (TEST_DATABASE_URL)
```

```bash
pnpm e2e                          # Playwright trên DB san7_e2e (E2E_DATABASE_URL), tự bật dev server cổng 3200
```

```bash
pnpm --filter @san7/e2e visual    # so ảnh app với prototype ở 1920/1440/1024/390 → e2e/visual-report/index.html
```

Bộ so sánh giao diện chụp `docs/prototype/domdom-fc.html` và app với cùng dữ liệu demo, cùng giờ cố định, tắt chuyển động, rồi tính tỉ lệ pixel lệch (pixelmatch). Hai bên chụp trong cùng một lần chạy nên không cần commit ảnh mốc. Ngân sách mặc định ≤ 6 %; vài màn có ngoại lệ ghi lý do trong `e2e/visual/prototype.spec.ts` (tính năng BRD bắt buộc mà prototype không có).

Tạo trước hai DB rỗng `san7_test`, `san7_e2e`; bộ test tự chạy `prisma migrate deploy` và seed.

### Hiệu năng (BRD 9.4)

Chạy app bản production (`pnpm --filter @san7/web build && pnpm --filter @san7/web start`) với dữ liệu demo, rồi:

```bash
k6 run e2e/perf/k6-smoke.js                 # API p95 < 300 ms ở 20 req/s
```

```bash
pnpm --filter @san7/e2e lighthouse          # LCP trang Đội < 1.5 s (mobile, Slow 4G) → e2e/perf-report/
```

Cả hai nhận `BASE_URL` để đo staging/production (tài khoản đo qua `LOGIN_ID`/`LOGIN_PW`). Workflow `Perf` chạy hai bước này khi push lên `main`, hoặc chạy tay với `base_url`.

## Job định kỳ

Scheduler ngoài (cron-job.org / Upstash QStash) gọi mỗi 5 phút:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/jobs/tick
```

Job chốt MVP quá hạn, ghi tiền sân trận đã qua, nhắc điểm danh 9:00 ngày đá, nhắc quỹ ngày 5, chụp mùa 1/1, đẩy push còn sót. Mọi việc idempotent; trạng thái quá hạn cũng được chốt "lười" khi đọc.
