# Kế hoạch triển khai — Đom Đóm FC (Sân 7 Manager)

Oct 30, 2026 · dựa trên `docs/BRD.md` (29/10), `docs/ARCHITECTURE.md` (30/10) và prototype `docs/prototype/domdom-fc.html` (v3)

## Trạng thái thực hiện (30/10/2026)

Toàn bộ P0–P4 và phần chính của P5 đã có code trên nhánh, gom thành vài commit lớn thay vì 18 PR riêng.

| Hạng mục | Trạng thái |
| --- | --- |
| `packages/core` (mọi công thức BRD 4–7) | Xong · 59 test Vitest, golden fixture sinh từ chính prototype |
| Schema Prisma 7 + migration + seed demo | Xong · seed port nguyên `sample()`/`seedDB()` của prototype |
| Auth, phân quyền theo đội, DTO theo vai trò | Xong |
| Mọi màn: Đội, Của tôi, Chiến thuật, Trận tới + kế hoạch thay người, Cầu thủ, Lịch + modal trận, Thống kê, Quỹ, Duyệt, Khám phá, Hệ thống | Xong · dùng lại CSS prototype nên giao diện khớp |
| REST API theo BRD 9.2, job `/api/jobs/tick`, outbox thông báo | Xong |
| PWA (service worker tự viết, offline, Web Push + nút Đi/Nghỉ) | Xong · cần khoá VAPID để bật push thật |
| Upload ảnh R2 (presigned PUT) | Xong · chưa có R2 thì dùng data URL (chỉ dev/staging) |
| Test tích hợp service trên Postgres thật | 28 test xanh (`apps/web/test`) |
| E2E Playwright theo 11.1 | 14 test xanh (`e2e/tests`) |
| CI GitHub Actions, runbook | Xong (`.github/workflows/ci.yml`, `docs/RUNBOOK.md`) |
| Bảo mật: CSP có nonce, giới hạn tần suất theo IP | Xong · `apps/web/proxy.ts` + `server/csp.ts` (test E2E không vi phạm CSP trên mọi màn), `server/ratelimit.ts` + bảng `rate_hits` (5 test tích hợp) |
| Hiệu năng (BRD 9.4) | Đo local (bản production, dữ liệu demo): k6 20 req/s → API p95 21 ms (mục tiêu < 300 ms); Lighthouse mobile Slow 4G → LCP trang Đội 904 ms (< 1.5 s), điểm 91; `buildPlan` 20 người < 200 ms có test. Script `e2e/perf/`, workflow `Perf`. Cần đo lại trên staging thật (Vercel `sin1` + Neon) |
| So giao diện với prototype (11.1 #15) | Xong · `e2e/visual`: 13 màn/modal × 4 độ rộng, ngân sách ≤ 6 % pixel lệch (ngoại lệ có ghi lý do); báo cáo HTML là artifact CI |

### Điểm lệch so với kế hoạch ban đầu (có chủ đích)

- **Giao diện**: dùng lại nguyên CSS của prototype (`apps/web/app/prototype.css`) + component React sinh đúng markup, thay vì viết lại bằng Tailwind/Radix — nhanh hơn và khớp pixel hơn. Kéo thả dùng HTML5 drag & drop như prototype (không thêm dnd-kit); cập nhật lạc quan dùng `useOptimistic` + Server Actions (không thêm TanStack Query); service worker viết tay (không thêm Serwist).
- **Ngày nghiệp vụ** lưu dạng chuỗi `YYYY-MM-DD` theo giờ VN (không dùng `@db.Date`) để tránh lệch múi giờ; thời điểm vẫn là `timestamptz`.
- **inferStats**: thuật toán BRD (GD 600 vòng + ridge + làm tròn 0.5) lệch tới 0.5 ở điểm ≥ 9, vi phạm tiêu chí ≤ 0.3. Đã thêm bước tinh chỉnh ±0.5 chỉ chạy khi lệch > 0.3, nên kết quả trùng prototype ở mọi ca bình thường.
- **Khoá job tick**: dùng lease trên `job_runs` thay cho `pg_try_advisory_lock` (advisory lock theo phiên không an toàn với pool kết nối serverless).
- **Test DB**: dùng `prisma migrate deploy` + seed (Prisma chặn `migrate reset` khi chạy bởi agent).

### Còn lại trước go-live

- Chốt các câu hỏi mở mục 1 (MVP 60%, ngưỡng đủ người, tên miền).
- Tạo hạ tầng thật: Neon (Singapore), Vercel (`sin1`), cron-job.org, R2, khoá VAPID, Resend; nối Sentry (`@sentry/nextjs`) khi có DSN.
- Đo lại k6 + Lighthouse trên staging thật (chạy tay workflow `Perf` với `base_url`).

## 0. Tóm tắt

- **Mục tiêu:** dựng bản chính thức chạy được trên production, qua toàn bộ 15 tiêu chí nghiệm thu mục 11.1 BRD bằng test tự động.
- **Stack (theo ARCHITECTURE):** pnpm + Turborepo · Next.js 16 LTS (App Router) · React 19 · TypeScript strict · Prisma 7 · PostgreSQL 17 (Neon, Singapore) · Tailwind 4 · TanStack Query · Zod · Vitest · Playwright · Vercel `sin1` · R2 · Web Push VAPID · Sentry.
- **Cách làm:** 6 phase (P0–P5), **18 PR**. Mỗi PR nhỏ, có test, deploy preview + Neon branch, merge vào `main` → staging. Cổng chuyển phase (gate) ghi rõ ở mục 2.
- **Ước lượng:** ~ 32–40 ngày công cho 1 người + Claude Code (chi tiết mục 2). Không tính thời gian chờ chốt câu hỏi mở.
- **Nguyên tắc xuyên suốt**
  1. Công thức nằm **một chỗ** trong `packages/core`, test trước rồi mới dùng ở UI/server.
  2. Mọi service nhận `ctx = { user, teamId, role }` từ lớp `authz`; không truy vấn nào thiếu `teamId`.
  3. Tác dụng phụ (thông báo, sổ quỹ, audit) ghi **trong cùng transaction** với thay đổi gốc.
  4. Mọi trạng thái có hạn (MVP 24h, tiền sân trận đã qua) chốt **idempotent** bởi cả job `tick` lẫn lần đọc đầu tiên sau hạn.
  5. Mọi màn dùng design token mục 10.1 từ ngày đầu; phần hiệu ứng/pixel-perfect dồn về P5.
  6. Chuỗi UI tiếng Việt; mã, bảng, API tiếng Anh. BRD là chuẩn khi lệch prototype.

## 1. Quyết định giả định cho các câu hỏi mở

Để không chặn tiến độ, plan chọn mặc định dưới đây. Mỗi mục được cô lập trong code để đổi rẻ nếu Mike chốt khác.

| # | Câu hỏi | Mặc định dùng | Chỗ cô lập trong code | Cần chốt trước |
| --- | --- | --- | --- | --- |
| Q1 | Gói hạ tầng | Free: Vercel Hobby + Neon Free + cron-job.org (đã tick trong ARCHITECTURE 7.3) | env + `vercel.json` | — (đã chốt) |
| Q2 | MVP 60% | Quorum: số phiếu ≥ ceil(0.6·N người Đi), dẫn đầu không hoà | `core/mvp.ts` → `resolveMvp(rule)` | PR 3.3 |
| Q3 | Ngưỡng "đủ người" | Cấu hình theo đội, cột `teams.fullSquad` mặc định 7 | `core/attendance.ts` | PR 3.2 |
| Q4 | Đăng nhập Google phase 1 | Không; phase 2 thêm bảng `user_identities` (provider, subject) mà không đổi bảng `users` | `server/auth` | P1 |
| Q5 | Tên miền / tên sản phẩm | Dùng domain Vercel tạm; `APP_NAME`, `APP_URL` qua env | env | P5 (trước khi bật push production) |
| Q6 | Độ dài mật khẩu | Theo ARCHITECTURE 7.2: ≥ 8 ký tự + chặn top 1.000 mật khẩu phổ biến; seed demo vẫn `123456` (bỏ qua kiểm tra ở seed) | `core/schemas.ts` | P1 |

## 2. Lộ trình

| Phase | Nội dung | PR | Ngày công | Cổng chuyển phase (gate) |
| --- | --- | --- | --- | --- |
| P0 | Khởi tạo repo, CI, hạ tầng, token giao diện | 0.1, 0.2 | 3 | `pnpm build/test/lint` xanh trên CI; preview deploy Vercel chạy trang "hello" đọc được DB Neon |
| P1 | Nền dữ liệu + Auth + Đội + Link mời + Duyệt đơn | 1.1, 1.2, 1.3, 1.4 | 8 | Playwright: đăng ký ĐT 2 bước, chặn trùng tên đội, luồng mời → chờ → duyệt → vào đội, link cũ hết hiệu lực; test 403 khách |
| P2 | Cầu thủ + công thức + Chiến thuật | 2.1, 2.2, 2.3 | 7 | Vitest công thức (12 cầu thủ ±0.05, inferStats ±0.3, Hungarian ≥ tham lam); xếp đội hình tổng chạy end-to-end |
| P3 | Lịch, điểm danh, kết quả, khai báo, MVP, thông báo, job | 3.1, 3.2, 3.3, 3.4 | 8 | buildPlan 12×4 qua test; vote MVP 7/5 tự chốt khi gọi `tick` với đồng hồ giả; thông báo trong app hoạt động |
| P4 | Quỹ, thống kê mùa, dashboard, Của tôi, Khám phá, Admin | 4.1, 4.2, 4.3, 4.4 | 7 | Số dư khớp công thức; đổi năm → số mùa về 0, quỹ giữ; khách không thấy quỹ/SĐT |
| P5 | Theme hoàn chỉnh, PWA, Web Push, a11y, hiệu năng, go-live | 5.1, 5.2, 5.3 | 5–7 | Toàn bộ 11.1 xanh; visual diff 4 breakpoint; Lighthouse LCP < 1.5 s 4G; backup + giám sát bật |

Song song hoá được: sau khi P1 xong schema, PR 2.1 (`core` thuần) có thể làm song song với 1.3–1.4 vì không phụ thuộc DB.

---

## 3. Chi tiết từng PR

Định dạng mỗi PR: **Phạm vi** · **File chính** · **Test** · **Xong khi (DoD)**.

### P0 — Khởi tạo

#### PR 0.1 — Monorepo & CI

- **Phạm vi:** khung thư mục đúng ARCHITECTURE mục 5 (`apps/web`, `packages/{core,db,config}`, `e2e/`); pnpm workspace, Turborepo pipeline (`build`, `test`, `lint`, `typecheck`); ghim Node 22, `packageManager`, `engines`; ESLint + Prettier; quy tắc import một chiều (`web → services → db/core`, `core` không import framework) bằng `eslint-plugin-boundaries`.
- **CI (GitHub Actions):** install có cache → typecheck → lint → Vitest → build → Playwright (chạy với Postgres service container + seed). Chạy trên mọi PR.
- **Test:** 1 test mẫu ở `core`, 1 test Playwright mở trang chủ.
- **DoD:** CI xanh; `pnpm dev` chạy được local.

#### PR 0.2 — Hạ tầng & design token

- **Phạm vi:**
  - Neon project (Singapore), DB `main` + branch theo PR (Neon GitHub integration); Vercel project region `sin1`, biến môi trường; Sentry (`@sentry/nextjs`); `.env.example` liệt kê đủ biến (mục 7).
  - `packages/config/tailwind`: token mục 10.1 thành CSS variables (`--bg`, `--surface`, `--gold`, `--cta`, `--night`, `--coral`, `--good/ok/bad`, màu Đi/Nghỉ, gradient số mạ vàng), bo góc 22/28/999, bóng, font Jost + Be Vietnam Pro tự host (`next/font`).
  - Bộ component nền `components/ui`: `Button` (chính/phụ/ghost/trên nền đen), `Chip`, `Seg`, `Avatar` (chữ cái + HSL theo hash id), `InfoTip` (ⓘ) + **Tooltip dùng chung** `position: fixed` (hover/focus/chạm, kẹp 8 px), `Modal` (bottom sheet ở mobile), `Toast` (2 s), `EmptyState`. Dùng Radix cho Popover/Dialog/Tooltip.
  - Layout khung: header tràn viền (không sticky), hàng tab pill; ≤ 760 px tab thành thanh đáy cố định. Tôn trọng `prefers-reduced-motion`.
- **Test:** Playwright snapshot trang `/_dev/ui` (gallery component) ở 1440 và 390 px.
- **DoD:** preview deploy đọc được `SELECT 1` từ Neon; gallery component khớp màu prototype.

### P1 — Nền dữ liệu, Auth, Đội, Gia nhập

#### PR 1.1 — Schema Prisma đầy đủ + seed

- **Phạm vi:** toàn bộ schema mục 4 của plan này (BRD 9.1 + chỉnh của ARCHITECTURE 7.2); migration đầu; partial unique index qua SQL migration; `packages/db` export client singleton (pooled URL cho runtime, direct URL cho migrate).
- **Seed** `packages/db/seed.ts`: port **nguyên dữ liệu** hàm `sample()` + `seedDB()` của prototype (dòng 1541–1710): 5 tài khoản demo mục 11.2, Đom Đóm FC 12 cầu thủ với 17 chỉ số, 4 trận đã đá (5–3, 2–2, 1–3, 4–1), 2 trận sắp tới, MVP trận 4 đang mở, 1 đơn xin vào (Hải Râu), 1 cập nhật hồ sơ, 1 khai báo chờ, 4 khoản ghi tay, 6 quy định; Phố Huế United 9 cầu thủ (chỉ số suy bằng `inferStats` — vì vậy seed P. Huế bật sau PR 2.1), 3 trận + 1 sắp tới, sơ đồ 3-2-1. Ngày tương đối −25, −18, −11, −4, +3, +10 so với ngày seed. Ghi `fund_entries` tự sinh đúng như job sẽ ghi. Chặn chạy khi `NODE_ENV=production`.
- **Test:** `prisma migrate reset` + seed chạy sạch trong CI; test SQL các ràng buộc (trùng `nameKey`, 2 đơn pending cùng SĐT bị chặn).
- **DoD:** `pnpm db:reset` cho ra DB demo đầy đủ.

#### PR 1.2 — Auth

- **Phạm vi** (`server/auth`):
  - `core/text.ts`: `normPhone` (bỏ ký tự không phải số, `84…` → `0…`), `normEmail`, `normName` (bỏ dấu, `đ→d`, thường, chỉ a–z0–9), `initials`. Test bảng ví dụ.
  - Mật khẩu argon2id (`@node-rs/argon2`); session kiểu Lucia: token 32 byte, lưu SHA-256 trong `sessions`, cookie httpOnly + `SameSite=Lax` + `Secure`, gia hạn trượt 30 ngày, nhớ `currentTeamId`.
  - Khoá đăng nhập: `login_attempts`, sai 5 lần/15 phút → `lockedUntil = now + 15'`.
  - CSRF: Server Action đã có kiểm tra Origin; Route Handler mutation kiểm `Origin`/`Sec-Fetch-Site` + header tuỳ chỉnh.
  - API: `POST /auth/register` (bước 1), `POST /auth/login`, `POST /auth/logout`, `GET /me`, `POST /auth/forgot` + `POST /auth/reset` (email, token 1 giờ, gửi qua Resend/SMTP — phase 1 có thể log link ra console ở staging).
  - Màn: `/dang-nhap` (có nút đăng nhập nhanh demo ở dev/staging như prototype), `/dang-ky`, `/quen-mat-khau`. Điều hướng sau đăng nhập: 0 đội + đơn chờ → **Chờ duyệt**; 0 đội → **Chưa có đội** (Tạo đội / Khám phá); ≥1 → đội gần nhất.
- **Test:** Vitest cho chuẩn hoá + lockout (đồng hồ giả); Playwright đăng ký → đăng xuất → đăng nhập bằng SĐT dạng `+84 90…` và bằng email.
- **DoD:** phiên sống 30 ngày, sai 5 lần bị khoá với thông báo tiếng Việt.

#### PR 1.3 — Authz + Đội + tạo đội 2 bước

- **Phạm vi:**
  - `server/authz`: `getTeamRole(user, teamId)` → `admin | captain | member | guest`; `requireRole(ctx, ...)`; lỗi chuẩn `ForbiddenError` → 403 + toast "Chỉ đội trưởng mới thay đổi được mục này". Helper `route()` bọc Route Handler: parse Zod (422), map lỗi Prisma unique (409), 403.
  - `server/dto`: `PublicTeamDTO`, `PublicPlayerDTO` (không SĐT, email, dob, quỹ), `MemberViewDTO`, `CaptainViewDTO`.
  - Service `team`: tạo đội (transaction: `teams`, `team_captains`, `players` cho ĐT với `isCaptain`, `payType=quy`, `invites`, phí mặc định 200.000/80.000), sửa thông tin (link bản đồ chỉ `https://`, quy định tách dòng + bỏ số thứ tự đầu dòng), `check-name` (debounce 300 ms ở client), `GET /teams?q=` (tìm bỏ dấu qua `nameKey`).
  - Màn: đăng ký bước 2/2 "Tạo đội", modal "Sửa thông tin đội" (chưa cần ảnh — ảnh ở 5.2), header với dropdown đổi đội, chip vai trò, route group `(app)/[teamId]/…` và **lọc tab theo vai trò** đúng bảng BRD 2.2; route không được phép → chuyển `doi`; thanh "Bạn đang xem … ở chế độ chỉ xem".
  - `audit_logs` + helper `audit(ctx, action, before, after)`.
- **Test:** unit cho ma trận quyền (bảng-driven, 4 vai trò × mọi chức năng mục 2.1); Playwright: tạo "dom dom fc" bị chặn vì trùng "Đom Đóm FC".
- **DoD:** một người là ĐT đội A và thành viên đội B thấy đúng tab ở mỗi đội.

#### PR 1.4 — Link mời, đơn xin vào, tab Duyệt (phần đơn)

- **Phạm vi:**
  - `invites`: mã 6 ký tự a–z0–9 (crypto), `POST /teams/:id/invite/rotate` đặt `revoked_at` mã cũ. Trang `/join/[code]`: tên, ảnh, số thành viên; mã sai/thu hồi → "Link mời không còn hiệu lực, xin link mới từ đội trưởng".
  - Form gia nhập: họ tên, biệt danh, ngày sinh, SĐT, mật khẩu (SĐT đã có tài khoản → xác thực mật khẩu cũ), số áo, chân thuận, quỹ/đá lẻ, phong cách, **tự chấm điểm vị trí** (avatar thêm ở 5.2). Lưu `join_requests.payload` (chưa suy chỉ số — `inferStats` gắn vào ở PR 2.1, payload giữ `ratings` để suy lại). Chặn trùng: đã là thành viên / đang chờ.
  - Tab **Duyệt** (khung + loại "đơn xin vào"), khối **Link mời** (Sao chép, Chia sẻ Web Share, Tạo link mới có xác nhận). Duyệt → tạo `players` active (cảnh báo trùng số áo, không chặn); Từ chối + lý do.
  - Service `notify.emit()` bản tối thiểu (chỉ ghi bảng `notifications`, loại trừ người gây sự kiện) + chuông header, panel 30 mục, "Đánh dấu đã đọc hết". Push thật ở 5.3.
- **Test:** Playwright tiêu chí 11.1 #2 (trừ phần sửa chỉ số — bổ sung ở 2.2).
- **DoD:** gate P1.

### P2 — Cầu thủ, công thức, chiến thuật

#### PR 2.1 — `packages/core`: công thức cầu thủ & đội hình

Port từ prototype (dòng 1436–1540, 1840–1880), sửa theo BRD khi lệch.

| Module | Hàm | Nguồn prototype | Test bắt buộc |
| --- | --- | --- | --- |
| `stats.ts` | `STAT_KEYS` (17), nhóm, `faceStats()` 6 chỉ số gộp, `suggestStyles()` 14 tag | `STAT`, `FACE`, `STYLE_RULE` | Bảng ngưỡng gợi ý từng tag |
| `positions.ts` | `WEIGHTS` (RB=LB, RM=LM), `footAdj`, `positionScore`, `allScores`, `explain()` (danh sách đóng góp giảm dần + dòng chân thuận), `scoreTier()` ≥8 / 6.5–7.9 / <6.5 | `W`, `posScore`, `footAdj` | Tổng mỗi dòng trọng số = 100; **12 cầu thủ mẫu ±0.05** (Khánh Mười LM 8.2, Hùng Gôn GK 8.3, Quang Còi ST 8.0 + bảng golden 120 giá trị sinh từ prototype); chỉ số thiếu = 5 |
| `infer.ts` | `inferStats(ratings, foot)` GD có chiếu + ridge, 600 vòng, làm tròn 0.5 | `inferStats` | {CB 8.2, CDM 7} → CB tính lại 8.2 ± 0.3; property test ngẫu nhiên: mọi vị trí đã chấm lệch ≤ 0.3 |
| `formation.ts` | 5 sơ đồ + toạ độ, `changeFormation()` giữ người cùng vị trí, người còn lại vào slot trống điểm cao nhất | `FORMATIONS` | Đổi 2-3-1 → 3-2-1 giữ GK, CB |
| `autopick.ts` | `autoPick(players, formation)` **Hungarian** (ma trận 7×N, tối đa Σ điểm), GK slot 0 | `autoPick` | Σ điểm ≥ bản tham lam trên 1.000 bộ ngẫu nhiên; < 1 ms với 30 người |
| `lineup.ts` | `lineupSummary()`: điểm đội hình, Ra sân x/7, Đúng sở trường x/7 (top 3 vị trí), chip lối chơi, cảnh báo (chưa có TM, chưa xác nhận đi) | `renderTactics` | Theo dữ liệu seed |
| `schemas.ts` | Zod: `Stats` (17 khoá, 1–10 bước 0.5), `Lineup` (7 × id\|null), payload đơn, profile | — | Từ chối 10.5, 0.7 |

- **DoD:** coverage `core` ≥ 90%; `core` không có import ngoài Zod (kiểm bằng lint rule).

#### PR 2.2 — Tab Cầu thủ, hồ sơ, sửa chờ duyệt

- **Phạm vi:**
  - Service `player`: CRUD (ĐT), đổi `payType` (hiệu lực từ tháng sau: lưu `payTypeFrom` — xem mục 4), `status=left` thay vì xoá cứng khi đã có dữ liệu, `POST /stats/infer`.
  - Tab **Cầu thủ**: lưới thẻ auto-fill 280 px (avatar, số áo, tên, top 3 vị trí màu, chip Quỹ/Đá lẻ, sao MVP mùa — tạm 0 đến P3), lọc nhóm vị trí, tìm bỏ dấu, sắp xếp.
  - **Modal cầu thủ 3 tab**: Hồ sơ · Chỉ số (thanh trượt 5 nhóm, bảng 10 vị trí cập nhật trực tiếp bằng `core`, **popover công thức chỉ khi hover/chạm**) · Từ điểm vị trí (nút "Ước lượng chỉ số" đổ sang tab Chỉ số). 4 chế độ: sửa (ĐT), tự sửa → chờ duyệt, xem (khách), duyệt đơn.
  - `profile_edits`: một bản chờ/cầu thủ (gửi lại ghi đè); Duyệt hiện bản so sánh cũ/mới (trường đổi tô vàng), ĐT sửa thêm rồi Duyệt/Từ chối. Gắn `inferStats` vào đơn xin vào (ĐT thấy & sửa chỉ số trước khi duyệt).
- **Test:** Playwright: ĐT sửa chỉ số đơn của Hải Râu rồi duyệt (hoàn tất 11.1 #2); thành viên gửi sửa → ĐT thấy diff; khách mở modal chỉ xem, `PATCH /players/:id` → 403; popover chỉ hiện khi hover/focus (11.1 #3).

#### PR 2.3 — Chiến thuật tổng

- **Phạm vi:** route `chien-thuat`; thanh trên (pill sơ đồ, 3 số liệu, "Xếp tự động", "Bỏ hết"); **sân SVG** (cỏ sọc, vạch vôi, thẻ tròn: số áo, badge điểm, tên, mã vị trí, "C"); bảng phải (Tổng quan, Vị trí · Cầu thủ · Điểm, Dự bị với vị trí tốt nhất); tương tác bảng 5.3: chạm cầu thủ → slot sáng theo `scoreTier` + điểm từng slot + thẻ chi tiết + "Hợp nhất trên sân: CM (8.4)"; chạm slot → tô danh sách + top 3 gợi ý; chạm-chạm để đặt/hoán đổi; kéo thả desktop bằng dnd-kit, thả vào Dự bị để rút ra. Thành viên/khách: highlight được, không xếp. `PUT /teams/:id/lineup` (lưu `formation`, `lineup`), `POST /teams/:id/auto-pick`.
- **Test:** Vitest cho reducer xếp đội hình (đặt, hoán đổi, rút ra, đổi sơ đồ); Playwright 11.1 #5 (màu viền đúng ngưỡng, top 3 đúng thứ tự).
- **DoD:** gate P2.

### P3 — Trận đấu, điểm danh, MVP, thông báo, job

#### PR 3.1 — Lịch đấu & quản lý trận

- **Phạm vi:** service `match` (tạo/sửa/xoá — xoá mềm khi đã có tỉ số; `kickoffAt` tính từ `date`+`time` theo `Asia/Ho_Chi_Minh`; mặc định ngày = ngày đá sân nhà gần nhất trong 7 ngày tới, giờ, sân, `cost`, `fee` chép từ `perMatchFee`); tab **Lịch** (Sắp tới tăng dần / Đã đá giảm dần + lọc mùa; thẻ trận đủ chip; trận gần nhất khối ngày đen-vàng); **modal trận** khung 3 tab; tab Kết quả: tỉ số −/+ , bảng bàn/kiến tạo theo người Đi, cảnh báo mềm (tổng bàn ≠ tỉ số, KT > bàn); `audit` khi sửa tỉ số. Tiện ích thời gian `core/time.ts` (`today()` theo VN, `isPast`, `isPlayed`, `seasonOf`) — **mọi chỗ dùng đồng hồ phải nhận `now` truyền vào** để test đổi năm/24h.
- **Test:** Vitest `time.ts` quanh nửa đêm VN; Playwright tạo trận, nhập tỉ số.

#### PR 3.2 — Điểm danh + Trận sắp tới + kế hoạch thay người

- **Phạm vi:**
  - `attendance`: `POST /matches/:id/vote/{open,close,remind}`, `PUT /matches/:id/attendance/:playerId` upsert `ON CONFLICT`; quy tắc: thành viên chỉ vote mình khi `open` và trận chưa qua; chạm lại = bỏ chọn (xoá dòng); ĐT sửa hộ mọi lúc → `setByCaptain=true` + audit; tự vote lại xoá cờ; sang Nghỉ → `lePaid=false`. Lần mở đầu → thông báo `vote` cho mọi thành viên. Nhắc N người chưa vote.
  - Tab Điểm danh trong modal trận (tóm tắt, dòng người, nút Đi|Nghỉ, ĐT thấy "Chưa trả / Đã trả 80.000đ" cho đá lẻ Đi — ghi sổ ở 4.1).
  - Client: TanStack Query + cập nhật lạc quan, hoàn tác khi 403/409, toast; `revalidateTag('match:'+id)`.
  - `core/plan.ts` **`buildPlan`** port prototype dòng 1882+: xếp hạng ex › quy › best, chia đợt (`maxMin = floor(7P/N)`), chọn người từng đợt theo trọng số, **5.040 hoán vị** + phạt −0.3 đổi loại vị trí, sinh lệnh ▲/▼/↔. Tham số lưu theo đội (`planMinutes/Periods/Min`).
  - Route `tran-toi`: dropdown trận, thanh trận, đội hình trận (`matches.lineup`, nguồn = người Đi), "Thiếu N người", ô tóm tắt kế hoạch → **popup Đề xuất thay người** (bảng người × đợt, mốc phút, kết luận) tính lại tức thì ở client. `GET /matches/:id/plan` dùng chung `core`.
- **Test:** Vitest buildPlan: 12×4 → mọi người ≥ 2 đợt, Σ = 28, phần dư cho xuất sắc rồi quỹ (11.1 #6); N ≤ 7; P=6; benchmark < 200 ms N=20. Playwright 11.1 #7: thành viên sửa vote người khác → 403, vote khi đóng → 403, ĐT sửa hộ hiện "đội trưởng chỉnh".

#### PR 3.3 — Khai báo, MVP, tab Duyệt đầy đủ

- **Phạm vi:**
  - `claims`: điều kiện trận đã qua + người Đi; ghi đè khi pending; thông báo ĐT; Duyệt → ghi `match_events`, `approved`; Từ chối → `rejected`; thông báo `result`.
  - `core/mvp.ts`: `quorum(n) = ceil(0.6n)`, `resolveMvp(ballots, goers)` → `done|need`.
  - `mvp`: mở vote (sau khi có tỉ số, `closesAt = +24h`, thông báo người Đi); `PUT /mvp/ballot` (chỉ người Đi, không tự bầu, đổi được đến khi đóng, upsert); **ẩn số phiếu** với không phải ĐT khi đang mở; chỉ định bởi ĐT bất kỳ lúc nào; `closeMvp(matchId, now)` trong transaction `SELECT … FOR UPDATE`, chỉ xử lý `status='open' AND closes_at <= now`; gọi **lười** khi đọc trận/dashboard.
  - Tab Duyệt: thêm "cập nhật hồ sơ", "khai báo", "MVP cần chỉ định"; badge tổng.
  - Sao MVP mùa trên sân chiến thuật, thẻ cầu thủ (đếm `mvp_player_id` theo mùa).
- **Test:** Vitest `resolveMvp` (7 Đi/5 phiếu/không hoà → done; 4 phiếu → need; hoà → need); integration test `closeMvp` gọi 2 lần song song chỉ chốt 1 lần; Playwright 11.1 #9 (khai báo chỉ cho người Đi sau ngày đá, duyệt xong thống kê đổi).

#### PR 3.4 — Job `tick` & outbox

- **Phạm vi:** `POST /api/jobs/tick` (xác thực `Authorization: Bearer CRON_SECRET`), `pg_try_advisory_lock`, mỗi việc idempotent qua `job_runs(job, key)` unique; việc: chốt MVP quá hạn, ghi tiền sân trận đã qua (gọi service quỹ ở 4.1 — tạm stub), nhắc điểm danh 09:00–09:04 ngày đá, nhắc quỹ ngày 5 (stub tới 4.1), snapshot mùa 00:05 1/1 (stub tới 4.2), gửi lại outbox sót. Trả về < 10 s. Cấu hình cron-job.org mỗi 5 phút + Sentry Cron Monitor cảnh báo nếu > 15 phút không chạy.
- **Test:** integration với `now` giả: tạo trận MVP mở, nhảy +24h, gọi `tick` 2 lần → 1 MVP, 1 thông báo (11.1 #10 "job chạy dù không ai mở app"); nhắc 09:00 không gửi lặp.
- **DoD:** gate P3.

### P4 — Quỹ, thống kê, dashboard, các màn còn lại

#### PR 4.1 — Quỹ đội (ledger)

- **Phạm vi:** service `fund` theo ARCHITECTURE 6.4: `fund_entries` với `UNIQUE(team_id, source, source_key)`; nguồn `dues` (upsert khi bật/tắt ✓, số tiền = Σ `dues_payments.amount` của tháng, ngày 01), `pitch` (−cost khi trận qua — job + sửa `cost`), `le` (upsert = Σ người đã trả × `match.fee`), `manual` (± nội dung bắt buộc, chỉ loại này xoá được + audit). `core/fund.ts`: `balance`, `monthIn/Out`, `outstanding()` (thành viên quỹ chưa đóng tháng này × monthlyFee + lượt đá lẻ Đi chưa trả) — port `ledger()`, `debts()` prototype dòng 2242–2290 nhưng đọc từ sổ.
  - Tab **Quỹ**: 4 ô số (ô số dư nền đen chữ vàng), bảng quỹ tháng (4 tháng gần nhất, ✓ bật/tắt chỉ ĐT, dòng "Đã thu"), tiền theo trận (bấm → modal trận tab Điểm danh), sổ thu chi + form thêm, form mức đóng + ⓘ. Thành viên chỉ đọc; khách không vào được (route + API).
  - Nối job: tiền sân, nhắc quỹ ngày 5 (đội bật `duesReminder`).
- **Test:** Vitest `fund.ts`; integration: số dư = quỹ tháng + đá lẻ − tiền sân ± ghi tay trên seed; sửa `cost` trận cũ chỉ đổi đúng dòng `pitch`; đổi `perMatchFee` không đổi `match.fee` cũ (11.1 #12); đổi payType chỉ có hiệu lực tháng sau.

#### PR 4.2 — Thống kê mùa & snapshot

- **Phạm vi:** `core/season.ts` port `teamSeason()` / `playerSeason()` (dòng 1711, 2301): T-H-B, bàn thắng–thua, bảng cầu thủ (Trận, Bàn, KT, B+KT, MVP, % tham gia), tie-break (chỉ số chính → ít trận hơn → chỉ số còn lại), chuỗi (hiện tại, thắng/thua dài nhất, bất bại), phong độ 5 trận, Vua phá lưới/kiến tạo (> 0). Server lấy dữ liệu thô bằng 1–2 truy vấn theo `teamId + year` rồi gọi `core`. Tab **Thống kê**: ô tổng, bảng sắp xếp mọi cột, lịch sử trận, bộ chọn mùa. Job snapshot 1/1 → `season_snapshots` + thông báo tổng kết; khối "Bảng vàng các mùa".
- **Test:** Vitest bảng chuỗi/tie-break; integration "đặt `now` = 1/1 năm sau → mọi số mùa về 0, số dư quỹ giữ nguyên" (11.1 #11).

#### PR 4.3 — Dashboard tab Đội + Của tôi

- **Phạm vi (chức năng + bố cục, hiệu ứng để P5):** hero (tên, khẩu hiệu, "N năm · M thành viên · Đội trưởng …"), **khối Trận tới** 3 cột (đếm ngược 30 s, "Đang diễn ra · chờ kết quả", số Đi/tổng, chip Đủ/Thiếu theo `fullSquad`, thanh Đi/Nghỉ/Chưa, dãy avatar ≤10 + "+N", trạng thái chưa vote → viền vàng nhấp nháy + "✓ Tôi đi"/"Nghỉ", nút phụ theo vai trò, "Chưa có lịch"), hàng vinh danh (Giày vàng, Vua kiến tạo, donut T/H/B), 4 ô chuỗi, Sân nhà (Mở bản đồ/Sao chép), Quy định (2 dòng đầu + icon theo từ khoá — port `ruleIcon`), Ngôi sao MVP top 5 + Trận gần nhất. `GET /teams/:id/dashboard` một lần gọi.
  - **Của tôi** `toi`: thẻ cá nhân + "Cập nhật hồ sơ & chỉ số" (chip Đang chờ duyệt), ô số mùa, lịch sử quỹ (lưới tháng hoặc bảng đá lẻ), bảng trận mùa + nút "Khai báo", nhắc trận chưa vote. `GET /me/season`.
- **Test:** Playwright 11.1 #8 (bấm "✓ Tôi đi" → số Đi tăng ngay, hết nhấp nháy) và 11.1 #14 (tooltip chuột/bàn phím/chạm; 2 quy định đầu là chữ).

#### PR 4.4 — Khám phá + Admin

- **Phạm vi:** `/kham-pha` SSR công khai, ISR 5 phút (đội `hidden=false`): thẻ đội (crest, tên, khẩu hiệu, số thành viên, sân nhà, T-H-B mùa, chuỗi 5 trận), tìm bỏ dấu; "Xem" → chế độ khách (Đội, Cầu thủ, Lịch đã đá, Thống kê) chỉ dùng `Public*DTO`. **Admin** `he-thong`: ô tổng, bảng user (khoá/mở, đặt lại mật khẩu), bảng đội (vào với quyền ĐT, chuyển ĐT, ẩn đội); `/api/admin/*`.
- **Test:** Playwright 11.1 #13: khách thấy 4 tab, không thấy Quỹ/SĐT/nút sửa; gọi `PATCH`/`PUT` mọi route sửa → 403 (test lặp qua danh sách route); kiểm JSON trả về không chứa `phone|email|dob`.
- **DoD:** gate P4.

### P5 — Hoàn thiện & go-live

#### PR 5.1 — Theme pixel-perfect & chuyển động

- So khớp prototype: hero đốm sáng đom đóm + vệt sáng 7 s, khối hiện lần lượt 60 ms, đếm số 900 ms, thẻ vinh danh nâng 4 px + cúp xoay, **sân mini SVG động 6 s** (port `pitchScene()` dòng 2427), modal kính ngà, blur-in 250 ms khi chuyển tab, breakpoint 1180/1000/860/760/440, không `backdrop-filter` trên cha của thanh đáy/bottom sheet. Tắt hết khi reduced-motion.
- **Test:** Playwright visual snapshot từng màn ở 1920/1440/1024/390 so với ảnh chụp prototype (ngưỡng diff), kiểm không cuộn ngang (11.1 #15); axe-core a11y (WCAG AA) cho mọi màn.

#### PR 5.2 — Ảnh (R2)

- `POST /api/uploads/sign` trả presigned PUT (kiểm quyền + loại + kích thước); resize ở trình duyệt (`browser-image-compression`): avatar ≤ 320 px, ảnh đội ≤ 1200 px JPEG 80%, ảnh cúp ≤ 320 px PNG. Gắn vào form gia nhập, hồ sơ, sửa đội. Avatar rỗng → chữ cái HSL.

#### PR 5.3 — PWA, Web Push, vận hành

- Serwist: manifest, icon, cache GET API stale-while-revalidate, persist TanStack Query vào IndexedDB → xem dữ liệu lần cuối khi offline.
- Web Push VAPID: `POST /push/subscribe`, `dispatchOutbox()` trong `after()` + `tick`; 404/410 → xoá subscription; thông báo `vote` có action **Đi/Nghỉ** gọi API điểm danh từ service worker. Màn hướng dẫn "Thêm vào màn hình chính" cho iPhone sau lần đăng nhập đầu.
- Vận hành: Neon PITR/backup hằng ngày giữ 14 ngày (hoặc `pg_dump` qua GitHub Actions lên R2 nếu gói free không đủ), Sentry alert, Vercel Analytics, security headers (CSP, HSTS), rate limit login, rà soát `security-review`; runbook `docs/RUNBOOK.md` (deploy, migrate, rollback, xoay `CRON_SECRET`/VAPID).
- **Go-live checklist:** domain + `APP_URL`, VAPID theo domain, tắt seed demo, tạo admin thật, Lighthouse LCP < 1.5 s (4G) trang Đội, API p95 < 300 ms (k6 smoke 20 req/s).

---

## 4. Schema chốt (BRD 9.1 + chỉnh của ARCHITECTURE 7.2)

Mọi bảng: `id` cuid, `created_at`, `updated_at`, `timestamptz`. Tiền là `Int` (đồng).

| Bảng | Khác so với BRD 9.1 | Ràng buộc / index |
| --- | --- | --- |
| `users` | thêm `lockedReason`, `disabledAt` (admin khoá) | `phone` unique, `email` unique |
| `sessions` | **mới**: `tokenHash`, `userId`, `expiresAt`, `currentTeamId` | index `userId` |
| `login_attempts` | **mới**: `key` (phone/email/IP), `at`, `ok` | index `(key, at)` |
| `password_resets` | **mới**: `tokenHash`, `userId`, `expiresAt`, `usedAt` | |
| `teams` | bỏ `inviteCode` → bảng `invites`; thêm `fullSquad` (7), `duesReminder` (true), `createdBy` | `nameKey` unique |
| `team_captains` | như BRD | PK `(teamId, userId)` |
| `invites` | **mới**: `teamId`, `code`, `revokedAt` | `code` unique; partial unique `(teamId) WHERE revoked_at IS NULL` |
| `players` | thêm `payTypeFrom` (tháng có hiệu lực) + `payTypePrev` | unique `(teamId, userId)`; index `(teamId, status)` |
| `join_requests` | thêm `phone` (chuẩn hoá) để chặn trùng | partial unique `(teamId, phone) WHERE status='pending'` |
| `profile_edits` | như BRD + `reason`, `decidedBy/At` | unique `playerId WHERE status='pending'` |
| `matches` | thêm `kickoffAt timestamptz`, `voteRemindedAt` | index `(teamId, date)`, `(kickoffAt)` |
| `attendance`, `match_events`, `claims` | như BRD (`claims` thêm `decidedBy/At`) | PK/unique `(matchId, playerId)` |
| `mvp_votes`, `mvp_ballots` | như BRD | index `(status, closesAt)` cho job |
| `dues_payments` | thêm `amount` (chốt mức lúc đóng) | PK `(teamId, playerId, month)` |
| `fund_entries` | thêm `source` (dues/pitch/le/manual), `sourceKey`, `deletedAt`, `deletedBy` | unique `(teamId, source, sourceKey)` |
| `notifications` | thêm `pushedAt`, `actorId` | index `(userId, readAt, createdAt)`, `(pushedAt) WHERE pushed_at IS NULL` |
| `push_subscriptions` | **mới**: `userId`, `endpoint`, `p256dh`, `auth` | `endpoint` unique |
| `season_snapshots` | **mới**: `teamId`, `year`, `data` JSONB | unique `(teamId, year)` |
| `audit_logs` | **mới**: `teamId`, `actorId`, `action`, `entity`, `entityId`, `before`, `after` JSONB | index `(teamId, createdAt)` |
| `job_runs` | **mới**: `job`, `key`, `ranAt` | unique `(job, key)` |

## 5. Truy vết tiêu chí nghiệm thu (BRD 11.1) → test

| # | Tiêu chí | Loại test | PR |
| --- | --- | --- | --- |
| 1 | Đăng ký 2 bước, chặn trùng tên đội | E2E `auth-team.spec` | 1.3 |
| 2 | Link mời → chờ → ĐT sửa chỉ số → duyệt → thông báo; link cũ hết hiệu lực | E2E `join.spec` | 1.4, 2.2 |
| 3 | Điểm vị trí 12 cầu thủ ±0.05; popover chỉ khi hover/chạm | Vitest `positions.test` + E2E | 2.1, 2.2 |
| 4 | inferStats lệch ≤ 0.3 | Vitest `infer.test` | 2.1 |
| 5 | Highlight slot đúng màu; top 3 gợi ý đúng thứ tự | E2E `tactics.spec` | 2.3 |
| 6 | Trận tới chỉ người Đi; plan 12×4 | Vitest `plan.test` + E2E | 3.2 |
| 7 | Thông báo có nút Đi/Nghỉ; 403 khi vote hộ/đã đóng; "đội trưởng chỉnh" | E2E `attendance.spec` | 3.2, 5.3 |
| 8 | Khối Trận tới nhấp nháy + "✓ Tôi đi" lạc quan | E2E `dashboard.spec` | 4.3 |
| 9 | Khai báo chỉ người Đi sau ngày đá; duyệt cập nhật thống kê | E2E `claims.spec` | 3.3 |
| 10 | MVP 7/5 tự chốt; 4 phiếu/hoà → need; job không cần app | Vitest + integration `tick.test` | 3.3, 3.4 |
| 11 | Sao MVP trên sân; đổi năm → số mùa 0, quỹ giữ | integration `season.test` | 3.3, 4.2 |
| 12 | Công thức số dư; Còn phải thu; đổi mức đá lẻ không đổi trận cũ | Vitest + integration `fund.test` | 4.1 |
| 13 | Khách: 4 tab, không quỹ/SĐT/nút sửa, API sửa 403 | E2E `guest.spec` | 4.4 |
| 14 | Tooltip chuột/bàn phím/chạm; 2 quy định đầu | E2E `dashboard.spec` | 4.3 |
| 15 | Khớp prototype 4 breakpoint; không cuộn ngang; reduced-motion | `e2e/visual/prototype.spec.ts` + `mobile.spec` | 5.1 |

## 6. Chiến lược test

- **Vitest — `packages/core`:** golden test sinh từ prototype (chạy hàm prototype trong Node một lần, lưu JSON `__fixtures__/prototype-golden.json`) để bản port khớp số; property test (fast-check) cho `inferStats`, `autoPick`, `buildPlan`.
- **Integration — `apps/web/server`:** Vitest + Postgres thật (Docker trong CI / Neon branch), mỗi test trong transaction rollback; đồng hồ tiêm qua `ctx.now`.
- **E2E — Playwright:** chạy trên seed, project mobile (390 px, chạm) + desktop; fixture đăng nhập theo vai trò bằng tài khoản mục 11.2.
- **Không merge** khi CI đỏ; mỗi PR ghi tiêu chí 11.1 nào chuyển sang xanh.

## 7. Môi trường & biến

| Biến | Dùng cho |
| --- | --- |
| `DATABASE_URL` (pooled), `DIRECT_URL` | Prisma runtime / migrate |
| `APP_URL`, `APP_NAME` | link mời, email, push |
| `CRON_SECRET` | `/api/jobs/tick` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | ảnh |
| `RESEND_API_KEY` (hoặc SMTP), `MAIL_FROM` | quên mật khẩu |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | giám sát |
| `SEED_DEMO=true` | chỉ dev/staging |

Môi trường: **local** (Docker Postgres) → **preview** mỗi PR (Vercel + Neon branch, seed demo) → **staging** = `main` (seed demo) → **production** (tag release, không seed).

## 8. Rủi ro thực thi

| Rủi ro | Cách giảm |
| --- | --- |
| Bản port công thức lệch prototype | Golden fixture sinh từ chính prototype + test BRD; BRD thắng khi lệch, ghi chú lệch trong test |
| Quên lọc `teamId` → lộ dữ liệu | Service chỉ nhận `ctx`; lint rule cấm import `prisma` ngoài `server/services`; `guest.spec` quét mọi route |
| Lệch múi giờ (trận qua ngày, mùa 1/1) | Mọi hàm nhận `now`; `core/time.ts` duy nhất; test quanh 00:00 VN |
| iPhone không nhận push | Chuông trong app là kênh chính; hướng dẫn cài PWA; phase 2 Zalo OA |
| Cron ngoài ngừng | Chốt lười khi đọc + Sentry Cron Monitor |
| Phạm vi UI phình to | Chức năng trước (P1–P4), hiệu ứng dồn P5; snapshot so với prototype làm thước đo "xong" |

## 9. Ngoài phạm vi v1 (để phase sau)

Thanh toán online, đặt sân, SMS OTP, Zalo OA, chat, giải đấu nhiều đội, app native, đăng nhập Google/Zalo (thêm bảng `user_identities`).
