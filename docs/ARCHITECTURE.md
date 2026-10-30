# Kiến trúc hệ thống — Đom Đóm FC (Sân 7 Manager)

Oct 30, 2026 · @Mike

## 1. Tóm tắt quyết định

Khuyến nghị: giữ stack TypeScript của BRD nhưng nâng lên bản hiện hành (Next.js 16 LTS, Prisma 7), chạy dạng **modular monolith** một lần deploy, Postgres ở Singapore, và tách mọi công thức vào `packages/core` dùng chung client/server. Không chọn OutSystems ODC cho bản chính thức (lý do ở mục 3).

| # | Hạng mục | Quyết định | Lý do chính |
| --- | --- | --- | --- |
| D1 | Nền tảng | Next.js 16 (App Router, LTS) + TypeScript, không dùng ODC | Giao diện tuỳ biến nặng, thuật toán chạy cả client lẫn server, chi phí \~0đ giai đoạn đầu |
| D2 | Kiểu kiến trúc | Modular monolith: 1 app web, các module nghiệp vụ tách thư mục, không microservice | Quy mô nhỏ (vài nghìn user), 1 người phát triển, deploy đơn giản |
| D3 | Logic nghiệp vụ | `packages/core` TypeScript thuần: điểm vị trí, inferStats, autoPick (Hungarian), buildPlan, teamSeason, fund ledger | Phản hồi tức thì ở client, server là nguồn sự thật, test Vitest độc lập DB |
| D4 | CSDL | PostgreSQL (Neon, vùng Singapore) + Prisma 7 | Quan hệ chặt, JSONB cho chỉ số/đội hình, branch DB cho staging |
| D5 | Hosting | Vercel, function chạy vùng Singapore (`sin1`) | Gần người dùng VN, preview deploy mỗi PR |
| D6 | Job định kỳ | 1 endpoint `POST /api/jobs/tick` idempotent, gọi mỗi 5 phút bởi scheduler bên ngoài; mọi trạng thái hết hạn cũng được chốt "lười" khi đọc | Không phụ thuộc gói Vercel; job trễ vẫn đúng kết quả |
| D7 | Auth | Session tự quản lý trong bảng `sessions`, cookie httpOnly, argon2id (`@node-rs/argon2`) | Đúng đặc tả BRD (SĐT/email + mật khẩu, khoá 5 lần/15 phút), ít phụ thuộc |
| D8 | Thông báo | Outbox: ghi `notifications` trong cùng transaction, đẩy Web Push (VAPID) sau khi commit | Không mất thông báo khi push lỗi; phase 2 thêm kênh Zalo OA cùng outbox |
| D9 | Ảnh | Cloudflare R2, upload thẳng bằng presigned URL, resize ở trình duyệt trước khi gửi | Server không xử lý ảnh, egress R2 miễn phí |
| D10 | PWA | Serwist (service worker) + cache GET API kiểu stale-while-revalidate | Cài lên màn hình chính, xem dữ liệu lần cuối khi mất mạng |
| D11 | Chất lượng | Vitest (core), Playwright (luồng), GitHub Actions, Sentry | Đúng tiêu chí nghiệm thu mục 11 BRD |

## 2. Bối cảnh và động lực kiến trúc

Hệ thống nhỏ về tải nhưng dày về nghiệp vụ: phần khó là công thức, phân quyền theo đội và trải nghiệm mobile, không phải scale. Kiến trúc vì vậy tối ưu cho tốc độ phát triển, độ đúng và chi phí, không tối ưu cho hàng triệu request.

### 2.1 Ước lượng quy mô (giả định để thiết kế)

| Chỉ số | Năm đầu | Ngưỡng cần xem lại kiến trúc |
| --- | --- | --- |
| Số đội | 50–200 | > 5.000 |
| Người dùng | 1.000–4.000 | > 100.000 |
| Trận/tuần (toàn hệ thống) | 100–400 | > 20.000 |
| Request đỉnh | \~20 req/s (tối CN, mở điểm danh) | > 500 req/s |
| Dữ liệu | < 200 MB sau 1 năm (ảnh nằm ở R2) | > 50 GB |

Các con số trên là giả định, BRD chưa nêu. Mọi khối dữ liệu đều theo đội và nhỏ (1 đội ≤ 30 cầu thủ, ≤ 150 trận/năm), nên thống kê mùa tính trực tiếp bằng SQL mỗi lần đọc là đủ nhanh, chưa cần bảng tổng hợp.

### 2.2 Động lực kiến trúc (lấy từ BRD)

| Động lực | Nguồn BRD | Hệ quả thiết kế |
| --- | --- | --- |
| Công thức là chuẩn, có test bắt buộc (điểm vị trí ± 0.05, inferStats ± 0.3, buildPlan 12×4) | Mục 4, 5, 11.1 | Một package `core` thuần, chạy được ở client và server, test bằng Vitest |
| Phân quyền theo từng đội, 4 vai trò, kiểm tra ở server | Mục 2 | Lớp `authz` tập trung, mọi truy vấn bắt buộc có `teamId` |
| Job chạy không phụ thuộc ai mở app (chốt MVP 24h, nhắc 9:00, nhắc quỹ ngày 5, snapshot 1/1) | Mục 6.6, 7.4, 9.3 | Scheduler ngoài + hàm chốt idempotent + chốt lười khi đọc |
| Điểm danh lạc quan < 100 ms, buildPlan < 200 ms | Mục 8.3, 9.4 | Tính ở client từ `core`, server xác nhận; không gọi API khi kéo tham số |
| LCP < 1.5 s trên 4G, API p95 < 300 ms | Mục 9.4 | Server Components + function ở Singapore cạnh DB; ảnh nhỏ, font tự host |
| PWA, xem offline, Web Push | Mục 1, 9.4 | Service worker + VAPID; iOS chỉ nhận push khi đã cài PWA |
| Khách xem đội khác, không lộ SĐT/email/quỹ | Mục 2, 8.5 | DTO công khai riêng, không trả nguyên bản ghi |
| Lịch sử quỹ không đổi khi sửa trận | Mục 7.2 | Sổ cái `fund_entries` có khoá nguồn, ghi trong transaction |
| Tiếng Việt, múi giờ Asia/Ho\_Chi\_Minh, mùa = năm dương lịch | Mục 9.3, 9.4 | Mọi mốc thời gian tính theo `Asia/Ho_Chi_Minh`, lưu `timestamptz` |

## 3. Lựa chọn công nghệ (ADR)

Trả lời câu hỏi mở của BRD: chọn Next.js + PostgreSQL. ODC hợp với app nội bộ doanh nghiệp có license sẵn; app này cần UI tuỳ biến sâu và chạy gần như miễn phí, hai điểm ODC yếu nhất.

### ADR-01: Next.js hay OutSystems ODC

| Tiêu chí | Next.js + Postgres | OutSystems ODC |
| --- | --- | --- |
| Giao diện kính mờ, sân SVG động, kéo thả đội hình, popover công thức | Toàn quyền CSS/SVG, khớp prototype HTML pixel-perfect | Làm được qua theme + JS block, nhưng tốn công và khó giữ đúng prototype |
| Thuật toán (gradient descent 600 vòng, 5.040 hoán vị, Hungarian) | Một code TS chạy cả client lẫn server | Server action chạy được; muốn chạy client phải viết lại bằng JS riêng, dễ lệch 2 bản |
| Sinh code bằng Claude Code theo BRD | Rất hợp: code text, PR, test tự động | Hạn chế: model nằm trong ODC Studio, khó review/diff |
| PWA + Web Push + trang Khám phá SSR công khai | Có sẵn hoặc thư viện chuẩn | PWA có; push web và SEO trang công khai hạn chế hơn |
| Chi phí giai đoạn đầu | \~0đ (gói free) | License doanh nghiệp, không hợp dự án phong trào |
| Lợi thế | Hệ sinh thái lớn, dễ tuyển người | Mike quen ODC; auth, role, deploy, app native có sẵn |

**Quyết định:** Next.js. Chỉ cân nhắc ODC nếu có tổ chức tài trợ license sẵn và chấp nhận đơn giản hoá phần hiệu ứng giao diện.

### ADR-02 đến ADR-16: các lựa chọn còn lại

| ADR | Hạng mục | Chọn | Phương án loại | Ghi chú |
| --- | --- | --- | --- | --- |
| 02 | Framework | Next.js 16 (dòng Active LTS), React 19, TypeScript strict | Next.js 15 như BRD ghi | Next.js 15 đã sang Maintenance LTS; bắt đầu mới thì dùng 16 |
| 03 | Kiểu API | Server Actions cho form/mutation trong app + Route Handlers `/api/*` REST cho PWA cache, push, job, client ngoài | Chỉ REST; tRPC; GraphQL | Giữ bảng API của BRD; mọi handler gọi chung lớp service |
| 04 | ORM | Prisma 7 (client TypeScript, không còn engine Rust) + `$queryRaw` cho thống kê | Drizzle | BRD đã viết schema Prisma; Prisma 8 mới ra nên chờ ổn định rồi nâng |
| 05 | CSDL | PostgreSQL 17 trên Neon, vùng AWS Singapore; pooled connection | Supabase; Postgres tự host | Branch DB cho mỗi PR preview; gói free 0.5 GB đủ năm đầu |
| 06 | Hosting | Vercel, function region `sin1` | VPS Docker (Coolify) | VPS rẻ và có worker thật nhưng tự lo vá lỗi, backup, TLS |
| 07 | Scheduler | Cron ngoài (cron-job.org / Upstash QStash / GitHub Actions) gọi `/api/jobs/tick` mỗi 5 phút, ký bằng `CRON_SECRET` | Vercel Cron; pg-boss | Vercel Cron gói Hobby chỉ chạy 1 lần/ngày, mỗi 5 phút cần Pro 20 USD/người/tháng; pg-boss cần tiến trình chạy liên tục, không hợp serverless |
| 08 | Auth | Tự viết theo mẫu session của Lucia: bảng `sessions`, token 32 byte, lưu SHA-256, gia hạn trượt 30 ngày | Auth.js; Better Auth; Clerk | Luồng SĐT + mật khẩu + khoá đăng nhập là đặc thù, thư viện lớn không tiết kiệm được nhiều |
| 09 | UI | Tailwind CSS 4 + CSS variables (token mục 10.1 BRD) + Radix primitives cho popover/dialog/tooltip | shadcn full; MUI | Radix cho truy cập bàn phím/ARIA đúng WCAG; style tự viết theo prototype |
| 10 | State client | TanStack Query (cache, optimistic, persist IndexedDB) + `useOptimistic` cho Server Action | Redux; SWR | Đáp ứng điểm danh < 100 ms và xem offline |
| 11 | Validation | Zod: một schema dùng cho form, API, JSONB `stats`/`lineup` | Yup | Schema đặt trong `packages/core` |
| 12 | Kéo thả | dnd-kit (desktop), chạm-chạm cho mobile | react-beautiful-dnd | BRD yêu cầu cả hai cách |
| 13 | Ảnh | Cloudflare R2 + presigned PUT, `browser-image-compression` resize trước | Vercel Blob; Cloudinary | Avatar ≤ 320 px, ảnh đội ≤ 1200 px JPEG 80% |
| 14 | Push | `web-push` + VAPID; outbox trong Postgres | Firebase FCM; OneSignal | Không thêm bên thứ ba; phase 2 thêm Zalo OA vào cùng outbox |
| 15 | Rate limit | Bảng `login_attempts` trong Postgres | Upstash Redis | Tải nhỏ, bớt một dịch vụ |
| 16 | Giám sát | Sentry (lỗi + trace), Vercel Analytics (Web Vitals), log JSON | Datadog | Free tier đủ |

### Phiên bản chốt khi khởi tạo

Node.js 22 LTS · Next.js 16.x LTS · React 19 · TypeScript 5.x strict · Prisma 7.x · PostgreSQL 17 · Tailwind 4 · pnpm + Turborepo. Ghim bằng `packageManager` và `engines`, nâng định kỳ theo bản vá bảo mật hằng tháng của Next.js.

## 4. Kiến trúc tổng thể

Mọi yêu cầu đi vào một app Next.js chạy ở Singapore; giao diện, API và job đều gọi cùng một lớp service nên quy tắc nghiệp vụ chỉ viết một lần.

&#91;embedded content: kiến trúc container · 1 app, 4 dịch vụ ngoài\]

Trình duyệt gọi app qua HTTPS và tải ảnh thẳng lên R2 bằng URL ký sẵn; scheduler ngoài chỉ gọi một endpoint. App không giữ trạng thái, nên chạy được trên Vercel hoặc một container trên VPS mà không đổi code.

| Khối | Trách nhiệm | Không làm |
| --- | --- | --- |
| Trình duyệt / PWA | Hiển thị, tính tức thì bằng `core` (điểm vị trí, highlight, buildPlan khi kéo tham số), cập nhật lạc quan, cache offline | Quyết định quyền hoặc ghi số liệu cuối cùng |
| Giao diện (Server Components) | Render trang, đọc dữ liệu qua service, SSR trang Khám phá công khai | Gọi Prisma trực tiếp từ component |
| API (Route Handlers + Server Actions) | Nhận yêu cầu, kiểm Zod, gọi service, trả DTO theo vai trò | Chứa logic nghiệp vụ |
| Job tick | Chạy các việc đến hạn (mục 6.5), idempotent | Giữ trạng thái riêng |
| authz → services → core → Prisma | Kiểm quyền theo đội, giao dịch, sổ quỹ, outbox thông báo, audit | Biết về HTTP hay cookie |
| Neon Postgres | Nguồn sự thật, ràng buộc duy nhất, khoá hàng khi chốt | — |

## 5. Cấu trúc mã nguồn và ranh giới module

Một repo pnpm + Turborepo, một app deploy, ba package dùng chung. Quy tắc phụ thuộc chỉ đi một chiều: `web → services → db/core`, `core` không import gì của framework hay DB.

```text
san7/
├─ apps/
│  └─ web/                     # Next.js 16 (UI + API + job endpoint)
│     ├─ app/
│     │  ├─ (auth)/            # dang-nhap, dang-ky, quen-mat-khau
│     │  ├─ (app)/[teamId]/    # doi, toi, chien-thuat, tran-toi, cau-thu, lich, thong-ke, quy, duyet
│     │  ├─ kham-pha/          # SSR công khai, ISR 5 phút
│     │  ├─ join/[code]/       # trang mời
│     │  ├─ he-thong/          # admin
│     │  └─ api/               # REST theo BRD 9.2 + /api/jobs/tick + /api/push/*
│     ├─ server/
│     │  ├─ auth/              # session, password, lockout
│     │  ├─ authz/             # requireRole(teamId, 'captain'|'member'|...)
│     │  ├─ services/          # team, player, match, attendance, mvp, fund, approval, notify, season
│     │  ├─ jobs/              # tick(): closeMvp, remindAttendance, remindDues, seasonSnapshot, dispatchOutbox
│     │  └─ dto/               # PublicTeamDTO, MemberViewDTO, CaptainViewDTO
│     ├─ components/           # ui/ (token, Button, Chip, Tooltip...), pitch/, cards/, modals/
│     └─ sw.ts                 # Serwist service worker
├─ packages/
│  ├─ core/                    # TS thuần, 0 phụ thuộc runtime ngoài Zod
│  │  ├─ stats.ts              # 17 chỉ số, 6 chỉ số gộp, styles gợi ý
│  │  ├─ positions.ts          # bảng trọng số, positionScore, explain()
│  │  ├─ infer.ts              # inferStats (GD có chiếu + ridge)
│  │  ├─ formation.ts          # 5 sơ đồ, đổi sơ đồ giữ người
│  │  ├─ autopick.ts           # Hungarian 7×N
│  │  ├─ plan.ts               # buildPlan (chia đợt + 5.040 hoán vị)
│  │  ├─ season.ts             # teamSeason, streaks, leaderboard, tie-break
│  │  ├─ mvp.ts                # quorum ceil(0.6·N), resolve
│  │  ├─ fund.ts               # số dư, còn phải thu
│  │  ├─ text.ts               # normName, normPhone, initials
│  │  └─ schemas.ts            # Zod dùng chung
│  ├─ db/                      # prisma/schema.prisma, migrations, seed.ts, client
│  └─ config/                  # tsconfig, eslint, tailwind preset (token)
└─ e2e/                        # Playwright theo tiêu chí 11.1
```

| Module | Sở hữu bảng | Được gọi bởi | Ghi chú |
| --- | --- | --- | --- |
| auth | users, sessions, login\_attempts | mọi route | Chỉ module này đọc `password_hash` |
| team | teams, team\_captains, invites | Đội, Duyệt, Khám phá, Admin | `nameKey` duy nhất, xoay mã mời |
| player | players, join\_requests, profile\_edits | Cầu thủ, Duyệt | Điểm vị trí tính bằng `core`, không lưu |
| match | matches, match\_events, claims | Lịch, Kết quả, Duyệt | Xoá mềm khi đã có tỉ số |
| attendance | attendance | Trận tới, Lịch | Upsert theo (matchId, playerId) |
| mvp | mvp\_votes, mvp\_ballots | Lịch, job | `closeMvp()` idempotent |
| fund | fund\_entries, dues\_payments, team fees | Quỹ, Của tôi | Ghi sổ trong cùng transaction với sự kiện gốc |
| notify | notifications, push\_subscriptions | mọi module qua `emit()` | Outbox, không gửi cho người gây sự kiện |
| season | season\_snapshots | Thống kê, Dashboard, job 1/1 | Đọc trực tiếp bằng SQL + `core/season` |
| audit | audit\_logs | các thao tác ĐT | Ghi ai, làm gì, trước/sau |

Mọi service nhận `ctx = { user, teamId, role }` đã xác thực từ lớp `authz`; service không tự đọc cookie. Nhờ đó Server Action, Route Handler và job dùng chung một service.

## 6. Các luồng xử lý chính

Ba nguyên tắc chung: mọi ghi đều idempotent (upsert theo khoá tự nhiên), mọi tác dụng phụ (thông báo, sổ quỹ, audit) ghi trong cùng transaction với thay đổi gốc, và mọi trạng thái có hạn được chốt bởi cả job lẫn lần đọc đầu tiên sau hạn.

### 6.1 Điểm danh 1 chạm (mục tiêu < 100 ms cảm nhận)

1. Client cập nhật cache TanStack Query ngay (số Đi +1, tắt viền nhấp nháy), hiện toast.
2. Gọi `PUT /api/matches/:id/attendance/:playerId` với `{status}`.
3. Server: `authz` kiểm tra là chính mình + `voteState = open` + trận chưa qua (hoặc là ĐT); `INSERT … ON CONFLICT (match_id, player_id) DO UPDATE`; nếu sang Nghỉ thì `le_paid = false`; ĐT sửa hộ thì `set_by_captain = true`.
4. Lỗi 403/409 → client hoàn tác cache, toast lỗi tiếng Việt.
5. `revalidateTag('match:' + id)` để dashboard và Trận tới của người khác thấy số mới ở lần tải sau (không cần realtime).

### 6.2 Vote MVP và chốt sau 24 giờ

| Trạng thái | Vào khi | Ra khi |
| --- | --- | --- |
| `open` | ĐT mở vote sau khi có tỉ số; `closes_at = opened_at + 24h` | Tới `closes_at` |
| `done` (by vote) | Số phiếu ≥ ceil(0.6 × số người Đi) và người dẫn đầu không hoà | — |
| `need` | Thiếu phiếu hoặc hoà | ĐT chỉ định |
| `done` (by captain) | ĐT chỉ định bất kỳ lúc nào | — |

`closeMvp(matchId)` chạy trong transaction với `SELECT … FOR UPDATE` trên `mvp_votes`, chỉ xử lý khi `status = 'open' AND closes_at <= now()`, nên gọi hai lần cũng chỉ chốt một lần. Hàm được gọi bởi job `tick` (quét `WHERE status='open' AND closes_at <= now()`) và bởi `GET` modal trận / dashboard nếu thấy vote đã quá hạn. Nhờ vậy job trễ vài phút vẫn không ai thấy trạng thái sai.

### 6.3 Thông báo (outbox)

1. Service gọi `notify.emit({kind, teamId, recipients, matchId, view, text})` bên trong transaction nghiệp vụ → ghi các dòng `notifications` (loại trừ người gây sự kiện).
2. Sau commit, `after()` của Next.js gọi `dispatchOutbox()` gửi Web Push cho các dòng `pushed_at IS NULL`; job `tick` quét lại các dòng còn sót.
3. Push trả 404/410 → xoá `push_subscriptions` đó. Push có action "Đi"/"Nghỉ" gọi thẳng API điểm danh từ service worker.

### 6.4 Sổ quỹ (ledger có khoá nguồn)

Mọi khoản tiền là một dòng `fund_entries(team_id, date, kind, amount, source, source_key)` với `UNIQUE(team_id, source, source_key)`. Nguồn và khoá:

| Nguồn | `source_key` | Ghi khi | Số tiền |
| --- | --- | --- | --- |
| `dues` | `2026-10` | ĐT bật/tắt ✓ quỹ tháng | upsert = số người đã đóng × monthlyFee của tháng đó |
| `pitch` | `matchId` | Trận chuyển sang đã qua (job tick) hoặc sửa `cost` | − cost |
| `le` | `matchId` | ĐT đánh dấu đã trả đá lẻ | upsert = số người đã trả × `match.fee` |
| `manual` | id ngẫu nhiên | ĐT nhập Thu/Chi | ± số tiền, nội dung bắt buộc |

Số dư = `SUM(amount)`. Khoản tự sinh không xoá tay được; sửa trận chỉ cập nhật đúng dòng có khoá đó và ghi `audit_logs`. Cách này cho số dư khớp tiêu chí 11.1 và có lịch sử khi trận bị sửa.

### 6.5 Job `tick` mỗi 5 phút

| Việc | Điều kiện chạy | Chống chạy trùng |
| --- | --- | --- |
| Chốt MVP | `closes_at <= now()` | Khoá hàng + kiểm tra trạng thái |
| Ghi tiền sân trận đã qua | ngày đá < hôm nay, chưa có dòng `pitch` | `UNIQUE` sổ quỹ |
| Nhắc điểm danh 9:00 ngày đá | 09:00–09:04 giờ VN, vote đang mở | Bảng `job_runs(job, key)` duy nhất |
| Nhắc đóng quỹ ngày 5 | Ngày 5, 09:00, đội bật nhắc | `job_runs('dues', teamId+tháng)` |
| Snapshot mùa | 00:05 ngày 1/1 | `job_runs('season', teamId+năm)` |
| Gửi lại push sót | `pushed_at IS NULL` quá 1 phút | Cập nhật có điều kiện |

`tick` dùng `pg_try_advisory_lock` để hai lần gọi chồng nhau không chạy song song, và trả về nhanh (< 10 giây) để vừa giới hạn thời gian function.

## 7. Rủi ro, đề xuất chỉnh BRD và câu hỏi mở

### 7.1 Rủi ro kỹ thuật

| Rủi ro | Mức | Cách xử lý |
| --- | --- | --- |
| Web Push trên iPhone chỉ chạy khi người dùng đã "Thêm vào màn hình chính" | Cao (nhiều thành viên dùng iPhone) | Màn hướng dẫn cài PWA sau lần đăng nhập đầu; chuông trong app là kênh chính; phase 2 Zalo OA |
| Scheduler ngoài ngừng chạy | Trung bình | Chốt lười khi đọc (6.2); cảnh báo Sentry Cron Monitor nếu `tick` không chạy quá 15 phút |
| Gói free (Vercel Hobby, Neon Free) có giới hạn và Vercel Hobby chỉ cho dùng phi thương mại | Trung bình | Khi bắt đầu thu phí người dùng: chuyển Vercel Pro hoặc VPS (mục Hạ tầng) |
| Neon free "ngủ" khi không dùng → truy vấn đầu chậm vài trăm ms | Thấp | Chấp nhận ở năm đầu; `tick` 5 phút cũng giữ DB thức phần lớn thời gian |
| Lệch kết quả công thức giữa client và server | Thấp | Một mã `core` duy nhất; server luôn tính lại, client chỉ hiển thị |
| Rò rỉ dữ liệu đội khác (lỗi quên lọc `teamId`) | Cao về hậu quả | Lớp `authz` bắt buộc + test Playwright "khách gọi API sửa → 403" + DTO công khai riêng |

### 7.2 Đề xuất chỉnh BRD

1. Mục 1.5: đổi "Next.js 15" thành "Next.js 16 LTS", "Vercel Cron / pg-boss" thành "scheduler ngoài gọi endpoint tick" (lý do ADR-07).
2. Mục 7.2: chốt sổ quỹ theo ledger có khoá nguồn (6.4) thay vì tính lại từ dữ liệu mỗi lần; `dues_payments` thêm cột `amount` để đổi mức quỹ không làm đổi tháng cũ.
3. Mục 9.1: thêm bảng `sessions`, `login_attempts`, `invites` (mã mời có `revoked_at` để báo "link không còn hiệu lực"), `job_runs`; thêm `kickoff_at timestamptz` vào `matches` để job so giờ chính xác.
4. Mục 3.3: thêm ràng buộc chỉ một đơn `pending` cho mỗi (đội, SĐT) bằng partial unique index.
5. Mục 5.4: dùng Hungarian ngay từ phase 2 (7 slot × tối đa 30 người chạy < 1 ms), bỏ bản tham lam.
6. Mục 3.1: mật khẩu tối thiểu 8 ký tự và chặn 1.000 mật khẩu phổ biến; 6 ký tự quá yếu cho tài khoản giữ tiền quỹ.

### 7.3 Câu hỏi mở cần Mike chốt

- [x] Giai đoạn đầu có chấp nhận chạy gói free (Vercel Hobby + Neon Free + cron ngoài), hay đi thẳng Vercel Pro 20 USD/tháng?
- [x] Quy tắc MVP 60%: giữ cách hiểu quorum như BRD? — Đã chốt: 60% là ngưỡng số người bỏ phiếu.
- [x] Ngưỡng "đủ người" cố định 7 hay cấu hình theo đội? — Đã chốt: mặc định 9 (7 + 2 dự bị), ĐT tự chỉnh trong Thông tin đội (7–30).
- [ ] Đăng nhập Google ở phase 1? (Zalo cần OA đã xác thực, hợp phase 2)
- [ ] Tên miền chính thức để cấu hình VAPID, email và cookie domain.
