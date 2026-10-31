# BRD — Hệ thống quản lý đội bóng sân 7 (Đom Đóm FC)

Oct 29, 2026 · @Mike

## 1. Tổng quan

Xây một web app (ưu tiên mobile, cài được như PWA) cho nhiều đội bóng phong trào sân 7: quản lý cầu thủ, chiến thuật, lịch đấu, điểm danh, thống kê, MVP và quỹ đội. Tài liệu này mô tả đủ nghiệp vụ, công thức, dữ liệu và giao diện để Claude Code dựng hệ thống thật từ prototype HTML "Đom Đóm FC" (bản 21).

### 1.1 Mục tiêu

- Đội trưởng tạo đội, mời thành viên bằng 1 link, duyệt hồ sơ, xếp đội hình và chốt người đá trong vài phút.
- Thành viên điểm danh 1 chạm, tự khai bàn thắng/kiến tạo, vote MVP, xem quỹ và chỉ số của mình.
- Đội khác xem được lịch sử trận, thành viên và chỉ số của mọi đội (chỉ đọc).
- Mọi thống kê theo mùa = năm dương lịch, tự reset ngày 1/1.

### 1.2 Phạm vi

| Trong phạm vi (v1) | Ngoài phạm vi (v1) |
| --- | --- |
| Đăng ký, đăng nhập bằng SĐT hoặc email + mật khẩu | Thanh toán online (VNPay, MoMo) |
| Đa đội, đa vai trò, một người ở nhiều đội | Đặt sân với chủ sân |
| Cầu thủ, 17 chỉ số, điểm 6 vị trí | Video, livestream |
| Chiến thuật tổng + trận tới, kế hoạch thay người | Chat trong đội (dùng Zalo) |
| Lịch đấu, điểm danh, kết quả, khai báo, MVP | Giải đấu nhiều đội, bảng xếp hạng giải |
| Quỹ tháng, đá lẻ, sổ thu chi | Xuất hoá đơn |
| Thông báo trong app + web push | SMS OTP (để phase 2) |
| Dashboard đội, màn Của tôi, Khám phá, Admin | App native iOS/Android |

### 1.3 Thuật ngữ

| Thuật ngữ | Nghĩa |
| --- | --- |
| Đội trưởng (ĐT) | Người quản lý một đội; một đội có thể có nhiều ĐT (`captainIds`) |
| Thành viên quỹ | Đóng quỹ cố định mỗi tháng, đá bao nhiêu trận cũng được |
| Đá lẻ | Không đóng quỹ tháng, trả phí theo từng trận có đi đá |
| Đợt | Một khoảng thời gian trong trận, giữa hai lần thay người |
| Mùa | Năm dương lịch hiện tại (YEAR) |
| Điểm vị trí | Điểm 1–10 thể hiện mức hợp của cầu thủ với một vị trí, tính từ chỉ số |
| Xuất sắc | Cầu thủ có điểm vị trí ≥ 8.0 ở ít nhất một vị trí trong sơ đồ trận |
| Chế độ xem (visit) | Xem đội khác, chỉ đọc |

### 1.4 Cách dùng tài liệu này với Claude Code

1. Đặt file BRD (xuất Markdown) vào thư mục gốc repo, tên `docs/BRD.md`; kèm file prototype `domdom-fc.html` làm tham chiếu giao diện.
2. Yêu cầu Claude Code làm theo thứ tự phase ở mục 11, mỗi phase một PR, kèm test cho các công thức ở mục 4, 5, 6.
3. Mọi chuỗi giao diện bằng tiếng Việt; mã nguồn, tên bảng, tên API bằng tiếng Anh.
4. Công thức, ngưỡng và trọng số trong tài liệu là chuẩn; prototype chỉ là minh hoạ. Khi lệch nhau, theo tài liệu.

### 1.5 Stack đề xuất

| Lớp | Lựa chọn | Ghi chú |
| --- | --- | --- |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS | PWA, SSR cho trang Khám phá công khai |
| Backend | Next.js Route Handlers / Server Actions | Có thể tách NestJS nếu cần |
| CSDL | PostgreSQL 16 + Prisma | JSONB cho chỉ số, sơ đồ |
| Auth | Phiên cookie httpOnly, mật khẩu băm argon2id | SĐT chuẩn hoá về dạng 0xxxxxxxxx |
| Job định kỳ | Cron mỗi 5 phút (Vercel Cron / pg-boss) | Đóng vote MVP, nhắc điểm danh, reset mùa |
| Ảnh | S3-compatible (R2) | Avatar ≤ 320 px, ảnh đội ≤ 1200 px |
| Thông báo | Bảng `notifications` + Web Push (VAPID) | Phase 2: Zalo OA |
| Test | Vitest (công thức), Playwright (luồng) |  |

Câu hỏi mở: có giữ stack này hay chuyển sang OutSystems ODC cho bản chính thức?

## 2. Vai trò và phân quyền

Có 4 vai trò; quyền xét theo từng đội, vì một người có thể là ĐT ở đội A và thành viên ở đội B. Mọi kiểm tra quyền phải chạy ở server; ẩn nút trên giao diện chỉ là phụ.

| Vai trò | Xác định | Phạm vi |
| --- | --- | --- |
| Admin | `users.role = 'admin'` | Toàn hệ thống; có mọi quyền của ĐT ở mọi đội |
| Đội trưởng | `team_captains(team_id, user_id)` | Đội mình quản lý |
| Thành viên | `players.user_id` thuộc đội, `status = 'active'` | Đội mình; chỉ đọc + vài thao tác tự phục vụ |
| Khách (đội khác) | Người dùng đã đăng nhập, không thuộc đội đang xem | Chỉ đọc phần công khai |

### 2.1 Ma trận quyền

Ký hiệu: **Sửa** = tạo/sửa/xoá; **Xem** = chỉ đọc; **Mình** = chỉ với dữ liệu của chính mình; **—** = không thấy.

| Chức năng | Admin | Đội trưởng | Thành viên | Khách |
| --- | --- | --- | --- | --- |
| Thông tin đội, sân nhà, quy định, ảnh cúp | Sửa | Sửa | Xem | Xem |
| Tạo / làm mới link mời | Sửa | Sửa | — | — |
| Duyệt đơn xin vào đội | Sửa | Sửa | — | — |
| Hồ sơ + chỉ số cầu thủ | Sửa | Sửa trực tiếp | Mình: gửi sửa, chờ duyệt | Xem |
| Thêm / xoá cầu thủ, đổi loại quỹ / đá lẻ | Sửa | Sửa | — | — |
| Chiến thuật tổng, đội hình trận tới | Sửa | Sửa | Xem | — |
| Tạo / sửa / xoá trận | Sửa | Sửa | Xem | Xem lịch sử |
| Mở / đóng điểm danh, nhắc người chưa vote | Sửa | Sửa | — | — |
| Điểm danh Đi / Nghỉ | Sửa hộ bất kỳ ai | Sửa hộ bất kỳ ai (ghi "đội trưởng chỉnh") | Mình, khi vote đang mở | — |
| Tỉ số, bàn thắng, kiến tạo của trận | Sửa | Sửa | Mình: khai báo, chờ duyệt | Xem |
| Mở vote MVP, chỉ định MVP | Sửa | Sửa | — | — |
| Bỏ phiếu MVP | — | Nếu có đá trận đó | Nếu có đá trận đó | — |
| Xem số phiếu khi vote còn mở | Xem | Xem | — | — |
| Quỹ: mức đóng, đánh dấu đã đóng, ghi thu chi | Sửa | Sửa | Xem | — |
| Lịch sử đóng quỹ của mình | — | Mình | Mình | — |
| Thống kê mùa, dashboard đội | Xem | Xem | Xem | Xem |
| Tab Duyệt | Xem + xử lý | Xem + xử lý | — | — |
| Tab Hệ thống (danh sách user, đội) | Sửa | — | — | — |

### 2.2 Tab hiển thị theo vai trò

| Tab (route) | Admin | ĐT | Thành viên | Khách |
| --- | --- | --- | --- | --- |
| Đội `#doi` | ✓ | ✓ | ✓ | ✓ |
| Của tôi `#toi` | nếu là cầu thủ | nếu là cầu thủ | ✓ | — |
| Chiến thuật `#chien-thuat`, Trận tới `#tran-toi` | ✓ | ✓ | ✓ | — |
| Cầu thủ `#cau-thu` | ✓ | ✓ | ✓ | ✓ |
| Lịch đấu `#lich` | ✓ | ✓ | ✓ | ✓ |
| Thống kê `#thong-ke` | ✓ | ✓ | ✓ | ✓ |
| Quỹ đội `#quy` | ✓ | ✓ | ✓ | — |
| Duyệt `#duyet` (badge số việc chờ) | ✓ | ✓ | — | — |
| Khám phá `#kham-pha` | ✓ | ✓ | ✓ | ✓ |
| Hệ thống `#he-thong` | ✓ | — | — | — |

Khi xem đội khác, hiện thanh "Bạn đang xem <Đội> ở chế độ chỉ xem" có nút "Về đội của tôi". Route không được phép thì chuyển về `#doi`. Thao tác bị chặn trả về lỗi 403 và toast "Chỉ đội trưởng mới thay đổi được mục này".

## 3. Luồng tài khoản, tạo đội và gia nhập

Mỗi đội có đúng một link mời; người nhận tự khai hồ sơ + chỉ số, và chỉ vào đội khi ĐT duyệt. Khoá nhận diện thành viên trong đội là cặp (SĐT, tên đội).

### 3.1 Quy tắc dữ liệu nhận diện

- **SĐT**: bỏ ký tự không phải số; đầu `84` đổi thành `0`. Duy nhất trong hệ thống.
- **Email**: chữ thường, tuỳ chọn với thành viên, bắt buộc với ĐT. Duy nhất nếu có.
- **Tên đội**: duy nhất sau khi chuẩn hoá `normName` = bỏ dấu, `đ→d`, chữ thường, bỏ mọi ký tự không phải a–z, 0–9. Ví dụ "Đom Đóm FC" và "dom-dom fc" trùng nhau. Tối đa 40 ký tự. Kiểm tra trùng ngay khi gõ (debounce 300 ms) và lại khi lưu.
- **Mật khẩu**: tối thiểu 6 ký tự, băm argon2id ở server. Prototype dùng FNV chỉ để demo, không được dùng lại.
- **Mã mời**: 6 ký tự a–z0–9 ngẫu nhiên, link `/<host>/#join-<code>` (bản thật: `/join/<code>`). Tạo mã mới thì mã cũ hết hiệu lực.

### 3.2 Đăng ký đội trưởng và tạo đội (2 bước)

1. **Bước 1/2 – Tài khoản**: họ tên, SĐT, email, mật khẩu, nhập lại mật khẩu. Lỗi: SĐT/email đã có → "Số điện thoại đã có tài khoản, hãy đăng nhập".
2. **Bước 2/2 – Tạo đội**: tên đội (duy nhất), ngày thành lập, khẩu hiệu, sân nhà (tên, địa chỉ, link bản đồ, ngày đá trong tuần, giờ bắt đầu–kết thúc, tiền sân/buổi), số áo của ĐT, vị trí sở trường.
3. Hệ thống tạo đội, gán người tạo vào `team_captains`, tạo bản ghi cầu thủ cho ĐT (loại quỹ, `captain = true`), sinh mã mời, mặc định quỹ tháng 200.000đ và đá lẻ 80.000đ/trận.
4. Chuyển vào tab Đội; banner gợi ý "Sao chép link mời".

Người đã có tài khoản (ví dụ đang là thành viên đội khác) vẫn tạo được đội mới từ màn "Chưa có đội" hoặc menu tài khoản.

### 3.3 Gia nhập qua link mời

1. Mở link → trang hiện tên, ảnh, số thành viên của đội. Mã sai/hết hạn → "Link mời không còn hiệu lực, xin link mới từ đội trưởng".
2. Form: họ tên, biệt danh, ngày sinh, SĐT, mật khẩu (nếu SĐT đã có tài khoản thì nhập mật khẩu cũ để xác thực), số áo mong muốn, chân thuận, hình thức (quỹ/đá lẻ), avatar, phong cách, và **tự chấm điểm 1–10 cho các vị trí sở trường**.
3. Server suy ngược 17 chỉ số từ điểm tự chấm (mục 4.4) và lưu đơn `join_requests` trạng thái `pending`. Chặn nộp trùng: cùng SĐT đã là thành viên hoặc đang chờ ở đội này.
4. Thông báo cho mọi ĐT: "\<Tên> xin vào đội <Đội>". Người xin thấy màn "Đang chờ đội trưởng duyệt".
5. ĐT mở tab Duyệt: xem, **sửa mọi trường và chỉ số**, rồi Duyệt hoặc Từ chối (lý do tuỳ chọn). Số áo trùng → cảnh báo, không chặn.
6. Duyệt → tạo `players` (status `active`), gửi thông báo "Bạn đã vào đội"; từ chối → thông báo kèm lý do, đơn chuyển `rejected`.

### 3.4 Đăng nhập và chọn đội

- Đăng nhập bằng SĐT hoặc email + mật khẩu. Sai 5 lần trong 15 phút → khoá 15 phút.
- Sau đăng nhập: 0 đội + có đơn chờ → màn Chờ duyệt; 0 đội, không đơn → màn Chưa có đội (Tạo đội / Khám phá); ≥ 1 đội → vào đội gần nhất, header có dropdown đổi đội. Admin thấy mọi đội.
- Phiên lưu 30 ngày, nhớ đội đang chọn.
- Quên mật khẩu: phase 1 qua email; phase 2 qua SMS OTP.

### 3.5 Thành viên cập nhật hồ sơ

Thành viên sửa hồ sơ/chỉ số của mình → lưu thành `profile_edits` (pending), dữ liệu cũ giữ nguyên. ĐT thấy bản so sánh cũ/mới (trường đổi tô vàng), có thể sửa thêm rồi Duyệt hoặc Từ chối. Mỗi cầu thủ chỉ có 1 bản chờ; gửi lại thì ghi đè bản chờ.

## 4. Module cầu thủ

Mỗi cầu thủ có hồ sơ + 17 chỉ số thang 1–10; điểm hợp 6 vị trí được tính ra từ chỉ số, không nhập tay. Chiều ngược lại (từ điểm vị trí suy ra chỉ số) dùng khi thành viên mới chưa biết tự chấm chi tiết.

### 4.1 Hồ sơ

| Trường | Kiểu | Bắt buộc | Quy tắc |
| --- | --- | --- | --- |
| fullName | text ≤ 60 | Có | Họ tên đầy đủ |
| nick | text ≤ 24 | Không | Tên hiển thị ưu tiên; trống thì lấy từ cuối của họ tên |
| dob | date | Không | Hiện tuổi |
| avatar | ảnh | Không | Resize ≤ 320 px; trống thì hiện 2 chữ cái đầu trên nền màu theo hash id |
| num | số 0–99 | Không | Cảnh báo nếu trùng trong đội |
| foot | Trái / Phải / Hai chân | Có | Ảnh hưởng điểm vị trí biên |
| payType | quy / le | Có | Chỉ ĐT đổi được |
| styles | mảng tag | Không | Chọn từ 14 phong cách (4.5) |
| captain | bool | — | Hiện huy hiệu "C" |
| status | active / left | — | Người rời đội giữ lại để không mất thống kê cũ |
| stats | 17 số 1–10, bước 0.5 | Có | Xem 4.2 |

### 4.2 17 chỉ số

| Mã | Tên | Mô tả | Nhóm |
| --- | --- | --- | --- |
| PAC | Tốc độ | Bứt tốc + tốc độ tối đa | Thể chất |
| STA | Thể lực | Chạy bền suốt trận | Thể chất |
| STR | Sức mạnh | Tì đè, va chạm | Thể chất |
| DRI | Rê dắt | Giữ bóng, khống chế, xoay người | Kỹ thuật |
| PAS | Chuyền ngắn | Phối hợp nhỏ, chuyền chính xác | Kỹ thuật |
| LPA | Chuyền dài/tạt | Phát động dài, tạt bóng | Kỹ thuật |
| FIN | Dứt điểm | Kết thúc trong vòng cấm | Kỹ thuật |
| SHO | Sút xa | Lực sút, sút ngoài vòng cấm | Kỹ thuật |
| HEA | Không chiến | Đánh đầu, bật nhảy | Kỹ thuật |
| TAC | Tắc bóng | Tranh chấp, đoạt bóng 1v1 | Phòng ngự |
| DEF | Kèm & cắt | Kèm người, chọn vị trí, cắt bóng | Phòng ngự |
| VIS | Nhãn quan | Nhìn thấy đường chuyền | Tư duy |
| ATP | Chạy chỗ | Di chuyển không bóng khi tấn công | Tư duy |
| REA | Phản ứng | Phản ứng nhanh với tình huống | Tư duy |
| HAN | Bắt & bay người | Bắt dính, đổ người cản phá | Thủ môn |
| REF | Phản xạ | Phản xạ cự ly gần | Thủ môn |
| GKP | Chọn vị trí TM | Đứng đúng chỗ, băng ra | Thủ môn |

Đầu vào chỉ số: thanh trượt 1–10 bước 0.5, nhóm theo 5 nhóm trên. Thẻ cầu thủ hiển thị 6 chỉ số gộp kiểu FIFA:

| Chỉ số thẻ | Công thức |
| --- | --- |
| Tốc độ | PAC |
| Sút | 0.5·FIN + 0.35·SHO + 0.15·ATP |
| Chuyền | 0.5·PAS + 0.3·LPA + 0.2·VIS |
| Rê dắt | 0.8·DRI + 0.2·REA |
| Phòng ngự | 0.45·TAC + 0.45·DEF + 0.1·HEA |
| Thể chất | 0.45·STA + 0.4·STR + 0.15·HEA |

### 4.3 Công thức điểm vị trí

6 vị trí của sân 7: GK (Thủ môn), CB (Trung vệ), LB / RB (Hậu vệ trái/phải), CM (Tiền vệ), ST (Tiền đạo). Đã bỏ CDM, LM, RM, CAM của sân 11 (chốt 30/10/2026); điểm tự chấm cũ cho các vị trí này được bỏ qua.

```latex
\text{Điểm}(p, v) = \mathrm{clamp}_{[1,10]}\left( \mathrm{round}_{0.1}\left( \frac{\sum_{k} w_{v,k} \cdot s_{p,k}}{100} + \Delta_{\text{chân}}(p, v) \right) \right)
```

Trọng số w (%, tổng mỗi dòng = 100). RB dùng trọng số của LB. Chỉ số thiếu mặc định 5.

| Vị trí | Trọng số |
| --- | --- |
| GK | HAN 40, REF 24, GKP 20, PAS 6, LPA 5, REA 5 |
| CB | TAC 32, DEF 24, HEA 11, STR 10, PAC 7, PAS 6, DRI 5, REA 5 |
| LB / RB | TAC 22, DEF 22, DRI 13, STA 10, PAS 10, REA 8, PAC 7, LPA 5, HEA 3 |
| CM | DRI 18, PAS 18, VIS 12, STA 9, LPA 8, DEF 8, ATP 8, REA 8, TAC 6, SHO 5 |
| ST | FIN 22, DRI 16, SHO 15, PAC 12, ATP 11, REA 9, HEA 6, DEF 4, STR 2, PAS 2, VIS 1 |

Điều chỉnh chân thuận Δ chỉ áp dụng cho vị trí biên (LB = Trái; RB = Phải): đúng chân +0.3, ngược chân −0.3, hai chân +0.2; vị trí khác 0.

Thang màu điểm: ≥ 8.0 xanh (xuất sắc), 6.5–7.9 vàng, < 6.5 đỏ.

**Giải thích công thức chỉ hiện khi hover/chạm vào ô điểm**: popover liệt kê từng chỉ số × trọng số = đóng góp (sắp xếp theo trọng số giảm dần), dòng chân thuận nếu có, tổng điểm, và dòng "Điểm = Σ (chỉ số × trọng số) / 100 ± chân thuận".

Test bắt buộc: Khánh Mười (seed, chân Trái) có CM = 7.9; Hùng Gôn GK = 8.3; Quang Còi ST = 8.0 (sai số ± 0.05).

### 4.4 Suy ngược chỉ số từ điểm vị trí (`inferStats`)

Đầu vào: map {vị trí → điểm tự chấm} + chân thuận. Đầu ra: 17 chỉ số làm tròn 0.5. Thuật toán: gradient descent có chiếu, regularize về một prior (ridge).

1. `out` = các vị trí đã chấm trừ GK. `m` = trung bình điểm `out` − 0.5 (không có thì 5).
2. `inv[k]` = tổng trọng số của chỉ số k qua các vị trí trong `out`.
3. Prior: chỉ số TM (HAN, REF, GKP) = điểm GK nếu có, không thì 3; chỉ số khác = 4 + (m − 4) · min(1, inv\[k\] / 15).
4. Lặp 600 lần: gradient g\[k\] = 0.04·(s\[k\] − prior\[k\]) + Σ\_v 2·e\_v·w\_{v,k}/100, với e\_v = (Σ w·s/100) − (điểm\_v − Δchân). Cập nhật s\[k\] = clamp(s\[k\] − 1.5·g\[k\], 1, 10).
5. Làm tròn về bước 0.5.

Test: nhập {CB: 8.2, CM: 7} → tính lại CB nằm trong 8.2 ± 0.3. Giao diện: tab "Từ điểm vị trí" trong form cầu thủ, nút "Ước lượng chỉ số" đổ kết quả vào tab Chỉ số để chỉnh tiếp.

### 4.5 Phong cách thi đấu

14 tag: Tốc độ, Rê dắt, Kiến thiết, Chuyền dài, Dứt điểm, Sút xa, Không chiến, Pressing, Càn quét, Đọc tình huống, Bền bỉ, Thủ lĩnh, Phản xạ (TM), Phát động (TM). Gợi ý tự động (người dùng vẫn tự bật/tắt):

| Tag | Gợi ý khi |
| --- | --- |
| Tốc độ | PAC ≥ 8.5 |
| Rê dắt | DRI ≥ 8.5 |
| Kiến thiết | (PAS + VIS)/2 ≥ 8.5 |
| Chuyền dài | LPA ≥ 8 |
| Dứt điểm | FIN ≥ 8.5 |
| Sút xa | SHO ≥ 8.5 |
| Không chiến | HEA ≥ 8.5 |
| Pressing | (STA + PAC + TAC)/3 ≥ 7.5 |
| Càn quét | (TAC + STA)/2 ≥ 8 |
| Đọc tình huống | (DEF + REA)/2 ≥ 8 |
| Bền bỉ | STA ≥ 8.5 |
| Phản xạ (TM), Phát động (TM) | REF ≥ 8.5; HAN ≥ 6 và (LPA + PAS)/2 ≥ 7 |
| Thủ lĩnh | Chỉ gán tay |

### 4.6 Tab Cầu thủ

- Lưới thẻ (auto-fill, min 280 px): avatar, số áo, tên, top 3 vị trí kèm điểm màu, chip Quỹ/Đá lẻ, sao MVP mùa.
- Lọc theo nhóm vị trí (TM / Hậu vệ / Tiền vệ / Tiền đạo), tìm theo tên, sắp xếp theo số áo / điểm cao nhất / tên.
- Bấm thẻ → modal 3 tab: Hồ sơ, Chỉ số (thanh trượt + bảng điểm 6 vị trí cập nhật trực tiếp), Từ điểm vị trí. Chế độ: sửa (ĐT), tự sửa → chờ duyệt (thành viên), xem (khách), duyệt đơn (ĐT).

## 5. Module chiến thuật

Tab Chiến thuật có 2 chế độ chuyển bằng nút pill: **Chiến thuật tổng** (đội hình mạnh nhất cả đội, route `#chien-thuat`) và **Trận sắp tới** (chỉ lấy người đã điểm danh Đi, route `#tran-toi`). Mỗi chế độ lưu đội hình riêng: tổng lưu ở đội, trận tới lưu ở từng trận. Không có đội hình A/B/C.

### 5.1 Sơ đồ sân 7

Tọa độ (x, y) tính theo % chiều ngang / dọc sân, khung thành đội mình ở dưới (y = 100). Slot 0 luôn là GK.

| Sơ đồ | 7 slot (vị trí x,y) |
| --- | --- |
| 2-3-1 (mặc định) | GK 50,91 · CB 30,73 · CB 70,73 · CM 17,48 · CM 50,52 · CM 83,48 · ST 50,20 |
| 3-2-1 | GK 50,91 · LB 18,72 · CB 50,75 · RB 82,72 · CM 32,49 · CM 68,49 · ST 50,20 |
| 2-1-2-1 | GK 50,91 · CB 30,75 · CB 70,75 · CM 50,59 · CM 20,40 · CM 80,40 · ST 50,17 |
| 3-1-2 | GK 50,91 · LB 18,72 · CB 50,75 · RB 82,72 · CM 50,51 · ST 32,23 · ST 68,23 |
| 2-2-2 | GK 50,91 · CB 30,74 · CB 70,74 · CM 30,50 · CM 70,50 · ST 30,23 · ST 70,23 |

Đổi sơ đồ: giữ người cũ ở slot cùng vị trí, người còn lại đặt vào slot trống có điểm cao nhất.

### 5.2 Giao diện kiểu FO4

- **Thanh trên**: chọn sơ đồ (pill), 3 số liệu: Điểm đội hình (trung bình điểm 7 người ở slot của họ), Ra sân x/7, Đúng sở trường x/7 (slot là 1 trong 2 vị trí cao điểm nhất của người đó; trước là 3, giảm khi chỉ còn 6 vị trí). Nút "Xếp tự động", "Bỏ hết" (chỉ ĐT).
- **Sân** bên trái (\~5/12 chiều ngang desktop): cỏ sọc, vạch vôi. Mỗi slot là thẻ tròn: số áo to, badge điểm màu, tên, mã vị trí; huy hiệu "C" cho ĐT; **sao vàng phát sáng + số lần MVP trong năm** (ví dụ ★ 2) nếu đã từng là MVP mùa này.
- **Bảng bên phải**: Tổng quan đội hình (chip lối chơi nổi bật = đếm tag phong cách của 7 người; cảnh báo như "chưa có thủ môn", "X, Y chưa xác nhận đi trận này"), rồi bảng Vị trí · Cầu thủ · Điểm cho 7 đá chính và phần Dự bị (vị trí tốt nhất của họ).
- **Tooltip ⓘ** "Cách xếp đội hình": chạm cầu thủ để xem thẻ và vị trí hợp, rồi chạm slot hoặc dòng bảng để xếp; chạm slot để xem ai hợp nhất; desktop kéo thả được.

### 5.3 Highlight khi chọn

| Thao tác | Phản hồi |
| --- | --- |
| Chạm một cầu thủ (trên sân hoặc dự bị) | Các slot phát sáng theo mức hợp: điểm ≥ 8 viền xanh sáng, 6.5–7.9 vàng, dưới mờ đi; mỗi slot hiện điểm của người này. Thẻ chi tiết (6 chỉ số gộp, top vị trí, nút Hồ sơ / Đưa xuống dự bị). Dòng gợi ý "Hợp nhất trên sân: CM (8.4)". |
| Chạm một slot | Các cầu thủ trong danh sách được tô theo điểm ở vị trí đó; hiện top 3 gợi ý để chạm là xếp. |
| Chạm cầu thủ rồi chạm slot | Đặt vào slot; nếu slot có người thì hoán đổi. |
| Kéo thả (desktop) | Như trên; thả vào vùng dự bị để rút ra. |
| Thành viên / khách | Vẫn thấy highlight và thẻ, không xếp được. |

### 5.4 Xếp tự động (`autoPick`)

Nguồn người: chế độ tổng = mọi cầu thủ active; chế độ trận = người Đi.

1. Tạo mọi cặp (điểm, cầu thủ, slot), sắp xếp điểm giảm dần.
2. Điền GK trước bằng cặp GK điểm cao nhất.
3. Duyệt danh sách, điền slot trống bằng người chưa dùng (tham lam).

Bản thật nên thay bước 3 bằng thuật toán Hungarian (tối đa tổng điểm 7 slot) — cùng giao diện, kết quả không tệ hơn.

### 5.5 Trận sắp tới

- Dropdown chọn trận (mặc định trận gần nhất chưa đá). Thanh trận: "vs <Đối thủ> · ngày · giờ · sân", số Đi / Nghỉ / Chưa trả lời, nút "Điểm danh" mở modal trận.
- Dưới ngưỡng "đủ người" của đội (mặc định 9, ĐT chỉnh trong Thông tin đội): cảnh báo "Thiếu N người"; slot trống vẫn hiển thị.
- Ô tóm tắt kế hoạch thay người (số đợt, số lượt thay, "ai cũng được ra sân") — bấm mở **popup Đề xuất thay người**.

### 5.6 Đề xuất thay người (`buildPlan`)

Mục tiêu: ai đi cũng được đá, nhưng phút thi đấu và vị trí ưu tiên theo thứ tự: **Xuất sắc (điểm vị trí tốt nhất trong sơ đồ ≥ 8.0) › Thành viên quỹ › Mức phù hợp vị trí**.

Tham số (lưu theo đội): thời lượng 20–120 phút (mặc định 80), số đợt 2 / 3 / 4 / 6 (mặc định 4), tối thiểu mỗi người (1 đến maxMin, mặc định maxMin).

1. **Xếp hạng**: với mỗi người Đi, tính `best` = điểm cao nhất trong các vị trí của sơ đồ; `ex` = best ≥ 8; `quy` = payType quỹ. Sắp xếp theo ex ↓, quy ↓, best ↓.
2. **Chia số đợt**: N người, P đợt, tổng suất = 7·P. Nếu N ≤ 7: ai cũng đá đủ P đợt. Ngược lại maxMin = floor(7P / N); ai cũng được `min` đợt; phần dư chia lần lượt theo thứ tự ưu tiên, mỗi người tối đa P.
3. **Chọn người từng đợt k** (còn L = P − k đợt): bắt buộc = ai còn `left ≥ L`; còn lại xếp theo trọng số `w = left/L + 0.2·ex + 0.1·quy + 0.12·(đang trên sân đợt trước)`; đợt 1 giữ nguyên thứ tự ưu tiên. Lấy 7 người đầu, trừ `left`.
4. **Xếp vị trí tối ưu**: duyệt đủ 5.040 hoán vị 7 người × 7 slot, tối đa Σ điểm; phạt −0.3 khi một người đổi sang vị trí khác loại so với đợt trước. Điểm trung bình đợt = trung bình điểm các slot có người.
5. **Sinh lệnh thay** giữa 2 đợt: ▲ vào / ▼ ra ghép theo cùng slot, rồi cùng mã vị trí, rồi bất kỳ; người ra không ai thay = "ra nghỉ"; người ở lại đổi vị trí = "↔ chuyển CM → ST".

Popup hiển thị: thanh ưu tiên (★ Xuất sắc › Quỹ › Phù hợp), bảng người × đợt (ô = vị trí đá hoặc "nghỉ", cột tổng phút = số đợt × thời lượng / P), lịch thay theo mốc phút (ví dụ "Phút 20"), dòng kết luận "N người đi · ai cũng được ra sân · tối thiểu m đợt/người". Thay tham số thì tính lại ngay (< 200 ms với N ≤ 20).

Test: 12 người, 4 đợt → maxMin = 2, mọi người ≥ 2 đợt, tổng suất = 28, người xuất sắc nhận phần dư trước.

## 6. Lịch đấu, điểm danh, kết quả và MVP

Mỗi trận đi qua 3 giai đoạn: sắp đá (điểm danh), đã qua ngày đá (nhập kết quả, khai báo, MVP), đã chốt. Một trận là "đã đá" khi có tỉ số; là "đã qua" khi có tỉ số hoặc ngày đá < hôm nay.

### 6.1 Tạo và sửa trận (ĐT)

| Trường | Kiểu | Mặc định |
| --- | --- | --- |
| date | date | Ngày đá sân nhà gần nhất trong 7 ngày tới |
| time | HH:mm | Giờ bắt đầu của sân nhà |
| opp | text ≤ 60, bắt buộc | — |
| venue | text | Tên sân nhà |
| type | Giao hữu / Giải đấu | Giao hữu |
| cost (tiền sân) | số đồng | Tiền sân/buổi của sân nhà |
| fee (đá lẻ/người) | số đồng | Mức đá lẻ hiện tại; đổi mức chỉ áp dụng cho trận tạo sau |
| note | text ≤ 200 | Ví dụ "Mặc áo vàng, có mặt 19:15" |
| openVote | checkbox | Bật: mở điểm danh và thông báo ngay khi lưu |

Xoá trận: cần xác nhận; trận đã có tỉ số thì xoá mềm.

### 6.2 Tab Lịch đấu

- Hai nhóm: **Sắp tới** (tăng dần) và **Đã đá** (giảm dần, lọc theo mùa).
- Thẻ trận: khối ngày (thứ, ngày, tháng), "vs Đối thủ", giờ · sân · loại; chip trạng thái: Vote đang mở / đã đóng / chưa mở; số người Đi; chip của mình "Bạn: Đi / Nghỉ / Chưa vote". Trận đã đá: tỉ số, chữ T/H/B màu, ★ MVP.
- Trận sắp tới gần nhất có khối ngày nền đen chữ vàng.
- Bấm thẻ → modal trận 3 tab: **Điểm danh**, **Kết quả**, **MVP**.

### 6.3 Điểm danh (vote tham gia)

- Trạng thái vote: `null` (chưa mở) → `open` → `closed` (có thể mở lại). Lần mở đầu tiên gửi thông báo cho mọi thành viên: "Trận CN 1/11 19:30 vs Hoàng Mai Stars: bạn đi được không?" kèm nút Đi / Nghỉ ngay trong thông báo.
- Thành viên chỉ đổi vote của mình khi vote đang mở và trận chưa qua. Chạm lại lựa chọn đang chọn = bỏ chọn.
- ĐT đổi được vote của bất kỳ ai, kể cả khi đã đóng (trường hợp đặc biệt); dòng đó ghi "đội trưởng chỉnh" (`attBy[pid] = 'cap'`). Thành viên tự vote lại thì xoá đánh dấu này.
- Chuyển sang Nghỉ thì bỏ đánh dấu "đã trả đá lẻ" của người đó.
- Tóm tắt: X đi, Y nghỉ, Z chưa trả lời; ĐT thấy thêm "Đá lẻ đã trả a/b · số tiền".
- Dòng người: avatar, số áo, tên, chip "Bạn", phụ chú Quỹ / Đá lẻ · phí; nút phân đoạn Đi | Nghỉ; với đá lẻ đang Đi, ĐT có nút "Chưa trả / Đã trả 80.000đ".
- ĐT có nút "Nhắc N người chưa vote" → gửi thông báo cho ai chưa trả lời. Job tự nhắc lúc 9:00 ngày đá (hạn điểm danh theo quy định là 12:00).

### 6.4 Kết quả trận (ĐT)

- Nhập tỉ số bằng nút − / + cho 2 đội. Lưu tỉ số = trận "đã đá".
- Bảng bàn thắng / kiến tạo từng người Đi (nếu chưa điểm danh thì hiện cả đội, kèm gợi ý). Cảnh báo mềm khi tổng bàn của cầu thủ ≠ tỉ số đội mình (cho phép phản lưới), hoặc tổng kiến tạo > tổng bàn.
- Thành viên xem tỉ số và bảng chỉ đọc.

### 6.5 Thành viên tự khai bàn thắng / kiến tạo

1. Điều kiện: trận đã qua, thành viên có trạng thái Đi.
2. Thành viên nhập số bàn, số kiến tạo của mình → `claims[pid] = {g, a, status: 'pending'}`. Gửi lại khi đang chờ thì ghi đè.
3. ĐT nhận thông báo "Minh Lùn khai 1 bàn, 1 kiến tạo trận vs Anh Em Mỹ Đình"; tab Duyệt hiện so sánh "hiện ghi / khai báo".
4. Duyệt → ghi đè `ev[pid]`, claim `approved`; từ chối → `rejected`. Thông báo kết quả cho thành viên.

### 6.6 Vote MVP

- **Mở vote** (ĐT, sau khi trận đã đá): `mvpVote = {status: 'open', at, closes: at + 24h, votes: {}}`. Thông báo cho mọi người Đi: "Vote MVP trận vs … đã mở, hạn 24 giờ".
- **Ai được vote**: chỉ người có trạng thái Đi trong trận; không tự vote cho mình; đổi phiếu được đến khi đóng.
- **Ẩn kết quả**: khi vote còn mở, chỉ ĐT thấy thanh số phiếu; thành viên thấy "Phiếu đang ẩn" (ⓘ).
- **Chốt sau 24 giờ** (job mỗi 5 phút, không phụ thuộc ai mở app): N = số người Đi, cần = ceil(0.6 · N) phiếu.
  - Số phiếu ≥ cần và người dẫn đầu không hoà → MVP = người dẫn đầu, `status = 'done'`, `by = 'vote'`, thông báo "MVP trận vs …: Quang Còi với 3/4 phiếu".
  - Ngược lại (thiếu phiếu hoặc hoà) → `status = 'need'`, báo ĐT "cần chỉ định MVP", tab Duyệt +1.
- **ĐT chỉ định** bất kỳ lúc nào (kể cả không mở vote): `by = 'captain'`, thông báo người Đi.
- Quy tắc 60% là **ngưỡng số người tham gia bỏ phiếu** (quorum), không phải 60% số phiếu dồn cho một người. Đã chốt 30/10/2026.
- **Hiển thị MVP**: sao vàng phát sáng trên thẻ sân chiến thuật + số lần MVP trong năm; bảng "Ngôi sao MVP" ở dashboard; cột MVP ở Thống kê.

### 6.7 Thống kê mùa (tab Thống kê)

Chỉ tính trận đã đá có ngày thuộc YEAR.

- Ô tổng: số trận, Thắng-Hòa-Thua, bàn thắng–thua, Vua phá lưới, Vua kiến tạo, Nhiều MVP nhất.
- Bảng cầu thủ: Trận (số trận có Đi), Bàn, Kiến tạo, B+KT, MVP, tỉ lệ tham gia %. Sắp xếp được theo mọi cột.
- Xếp hạng hoà: bằng chỉ số chính → ít trận hơn đứng trên → nhiều chỉ số còn lại hơn đứng trên.
- Bảng lịch sử từng trận: ngày, đối thủ, tỉ số, người ghi bàn, MVP.

### 6.8 Popup tỉ số sau trận và nhắc khai báo

Bổ sung 30/10/2026.

- **Trận kết thúc** = đã qua giờ đá và ĐT đã nhập tỉ số. Lần đầu có tỉ số được ghi lại (`matches.resultAt`); sửa tỉ số sau đó không tính là kết thúc lại, xoá tỉ số thì xoá mốc.
- **Popup tỉ số**: mỗi thành viên/ĐT của đội thấy **một lần** khi mở app lần đầu sau khi trận kết thúc, ở bất kỳ tab nào của đội. Chỉ cho trận mới nhất, trong 7 ngày kể từ khi có tỉ số; không báo cho người nhập tỉ số, khách, hay người vào đội sau giờ đá. Đánh dấu đã xem ngay khi popup hiện (bảng `match_receipts`), nên tải lại hay chuyển trang cũng không hiện lại; tắt bằng ✕, nút Đóng, bấm ra ngoài hoặc Esc.
- **Nội dung**: tên hai đội, tỉ số lớn, nhãn Thắng/Hoà/Thua, người ghi bàn, MVP (nếu có), sân, số người ra quân; nút "Khai báo bàn/kiến tạo" (nếu người xem có Đi và chưa khai) và "Đóng".
- **Không khí**: thắng — pháo giấy, đom đóm bay, cúp nhún, tỉ số phát sáng; hoà — tông dịu, đom đóm nhạt; thua — tông xám xanh, mưa nhẹ, lời động viên. Tắt chuyển động khi người dùng bật giảm chuyển động.
- **Nhắc khai báo trên tab Đội**: người có Đi trận đã kết thúc (trong 7 ngày) mà chưa khai báo thấy dòng "Trận vs … kết thúc x–y. Bạn có ghi bàn hay kiến tạo không?" (kèm số ĐT đang ghi cho họ) với nút **Khai báo** (mở tab Kết quả của trận) và **Không có** (tắt nhắc trận đó). Khai báo xong cũng tự tắt.
- API: `POST /matches/:id/result-seen`, `POST /matches/:id/claim-skip`.

## 7. Quỹ đội

Số dư quỹ = tổng 4 nguồn trong sổ thu chi; 3 nguồn đầu tự sinh từ dữ liệu, chỉ khoản ghi tay là nhập trực tiếp. Tiền lưu bằng số nguyên đồng (VND), hiển thị `200.000đ`, số âm dùng dấu −.

### 7.1 Mức đóng

| Cấu hình | Mặc định | Ghi chú |
| --- | --- | --- |
| monthlyFee – quỹ tháng | 200.000đ | Áp dụng cho thành viên `payType = quy` |
| perMatchFee – đá lẻ/trận | 80.000đ | Chép vào `match.fee` khi tạo trận; đổi mức không đổi trận cũ |

### 7.2 Sổ thu chi (tự sinh)

| Nguồn | Sinh khi | Số tiền | Ngày ghi |
| --- | --- | --- | --- |
| Quỹ tháng | Tháng có ≥ 1 người đã đóng | + số người đã đóng × monthlyFee | Ngày 01 của tháng |
| Tiền sân | Trận đã qua, cost > 0 | − cost | Ngày đá |
| Đá lẻ | Trận đã qua, có người đã trả | + số người đã trả × match.fee | Ngày đá |
| Ghi tay | ĐT nhập Thu / Chi | ± số tiền, nội dung bắt buộc | Ngày chọn (mặc định hôm nay) |

Chỉ khoản ghi tay xoá được (có xác nhận, lưu nhật ký người xoá). Sắp xếp mới nhất trước. Bản thật nên ghi các khoản tự sinh thành bản ghi thật trong `fund_entries` (với khoá nguồn) để có lịch sử không đổi khi sửa trận.

### 7.3 Tab Quỹ đội

- **4 ô số**: Số dư quỹ (ô nền đen chữ vàng); Thu tháng này; Chi tháng này; Còn phải thu = (số thành viên quỹ chưa đóng tháng này × monthlyFee) + Σ phí các lượt đá lẻ đã đi nhưng chưa trả, kèm chip tên từng người nợ.
- **Bảng quỹ tháng**: hàng = thành viên quỹ (theo số áo), cột = 4 tháng gần nhất; ô là nút bật/tắt ✓ (chỉ ĐT). Dòng cuối "Đã thu" theo tháng.
- **Tiền theo trận**: ngày, trận, tiền sân (đỏ), đá lẻ đã trả a/b, đã thu (xanh). Bấm dòng → mở modal trận tab Điểm danh để đánh dấu đã trả.
- **Sổ thu chi**: ngày, nội dung, chip nguồn, số tiền ± màu, nút Xoá (ghi tay). Form thêm: Thu/Chi, số tiền, ngày, nội dung.
- **Form mức đóng** (chỉ ĐT) + ⓘ giải thích Quỹ vs Đá lẻ.
- Thành viên xem toàn bộ tab ở chế độ chỉ đọc (minh bạch). Khách không thấy tab Quỹ.

### 7.4 Quy tắc

- Chuyển thành viên từ quỹ sang đá lẻ (hoặc ngược lại) có hiệu lực từ tháng sau; không đổi dữ liệu đã thu.
- Đánh dấu "đã trả đá lẻ" chỉ cho người đá lẻ có trạng thái Đi.
- Thông báo tự động ngày 5 hằng tháng cho thành viên quỹ chưa đóng (theo quy định "đóng trước ngày 10"); ĐT bật/tắt được.
- Tiền phạt (đến muộn…) nhập như khoản Thu ghi tay, nội dung có tên người.
- Quỹ không reset ngày 1/1: số dư chuyển tiếp.

## 8. Thông tin đội, dashboard và các màn còn lại

Tab Đội là trang chủ sau đăng nhập: một dashboard ít chữ, thông tin phụ nằm trong icon ⓘ hiện khi hover/chạm, và khối "Trận tới" là nơi điểm danh nhanh nhất.

### 8.1 Thông tin đội (ĐT sửa qua modal "Sửa thông tin đội")

| Nhóm | Trường |
| --- | --- |
| Cơ bản | Tên đội (duy nhất), ngày thành lập, khẩu hiệu, ảnh đội (≤ 1200 px, JPEG 80%) |
| Sân nhà | Tên sân, địa chỉ, link bản đồ (bắt buộc `https://`), ngày đá trong tuần (nút T2…CN), giờ bắt đầu, giờ kết thúc, tiền sân/buổi |
| Quy định | Textarea, mỗi dòng một quy định; tự bỏ số thứ tự đầu dòng. **2 dòng đầu hiện nổi bật, còn lại thu gọn thành icon** |
| Ảnh cúp | Ảnh riêng cho Giày vàng và Vua kiến tạo (≤ 320 px PNG); trống thì dùng hình minh hoạ SVG có sẵn |

### 8.2 Dashboard tab Đội (thứ tự từ trên xuống)

1. **Ảnh bìa (hero)** nền đen, đốm sáng đom đóm, vệt sáng quét ngang 7 giây/lần: tên đội (Jost 300, vàng, 38–64 px), khẩu hiệu, dòng "7 năm · 12 thành viên · Đội trưởng Tuấn Tạ" (ngày thành lập trong tooltip). Có ảnh đội thì làm nền. Nút "Sửa thông tin đội" (ĐT).
2. **Khối Trận tới** (chi tiết 8.3).
3. **Hàng vinh danh** 3 cột: thẻ Giày vàng (ghi nhiều bàn nhất mùa), thẻ Vua kiến tạo, ô Thành tích. Thẻ vinh danh: ảnh cúp, nhãn vàng, avatar + tên (họ tên trong tooltip) + số áo, số lớn mạ vàng + đơn vị, ⓘ "Mùa 2026 · 4 trận · 1.25 bàn/trận · 1 kiến tạo", dòng #2 #3 #4 (số hạng màu san hô). Chưa ai ghi bàn → "Chưa có bàn nào trong mùa này". Ô Thành tích: donut T/H/B với % thắng ở tâm, chú thích số T/H/B, ⓘ chứa số trận, bàn thắng–thua, hiệu số, bàn/trận.
4. **4 ô chuỗi**: Chuỗi hiện tại (số + thắng/thua/hoà, ⓘ "Bất bại N trận gần nhất"), Thắng dài nhất, Thua dài nhất, Phong độ (5 chấm T/H/B, mới nhất bên phải, hover ra ngày + tỉ số).
5. **3 ô cuối**: Sân nhà (tên + ⓘ địa chỉ, pill ngày đá, giờ, tiền sân, nút Mở bản đồ / Sao chép link); Quy định đội (2 quy định đánh số + hàng icon "Khác"); Ngôi sao MVP (top 5 theo số MVP mùa, thanh vàng so sánh, hạng 1 nền vàng nhạt) + khối Trận gần nhất (nền đen, tỉ số lớn vàng, ★ MVP).

Công thức chuỗi: lấy dãy kết quả T/H/B theo thời gian của mùa; chuỗi hiện tại = số kết quả giống nhau liên tiếp tính từ trận cuối; thắng/thua dài nhất = đoạn T/B liên tiếp dài nhất; bất bại = số trận liên tiếp từ cuối không có B. Vua phá lưới / kiến tạo: chỉ số > 0, hoà thì ít trận hơn rồi chỉ số còn lại cao hơn.

Hiệu ứng: các khối hiện lần lượt (trễ 60 ms), số lớn đếm từ 0 trong 900 ms, thẻ vinh danh nâng 4 px + cúp xoay nhẹ + vệt sáng khi hover. Tắt hết khi `prefers-reduced-motion`.

### 8.3 Khối Trận tới + điểm danh nhanh

Desktop chia 3 cột; ≤ 1180 px sân mini lên đầu rồi 2 cột; ≤ 900 px một cột.

- **Cột 1**: nhãn "● Trận tới" (chấm nhấp nháy) + chip "Đang điểm danh" khi vote mở; "vs <Đối thủ>" cỡ lớn vàng; dòng thứ-ngày · giờ · sân · icon ₫ (tooltip phí đá lẻ); đồng hồ đếm ngược ngày/giờ/phút (cập nhật 30 giây; qua giờ đá hiện "Đang diễn ra · chờ kết quả").
- **Cập nhật 30/10/2026 — khối Trận tới kiểu sân vận động**: cảnh sân (khán đài có đèn flash, cột đèn pha, biển LED tên đội, sân phối cảnh, cầu thủ đom đóm phối hợp ghi bàn) phủ kín cả khối; thông tin trận bên trái và bảng điểm danh bên phải nổi trên nền. Trạng thái theo giờ đá, tự chuyển không cần tải lại: **Trận tới** (đếm ngược) → **Trực tiếp · Đang diễn ra** (phút thi đấu + thanh tiến độ, ẩn nút điểm danh; thời lượng = giờ đá sân nhà của đội, mặc định 90 phút) → **Vừa kết thúc · Chờ tỉ số** (ĐT có nút "Nhập tỉ số"). Chưa điểm danh: cả khối lắc nhẹ theo nhịp + viền vàng sáng + nút "✓ Tôi đi" nảy. Thẻ nhắc đóng quỹ/đá lẻ còn phải đóng cũng lắc theo nhịp kèm đồng xu; tắt hết chuyển động khi người dùng bật giảm chuyển động.
- **Cột 2 – sân mini động** (SVG, vòng lặp 6 giây): sân phối cảnh nhìn về khung thành, cầu thủ phe mình là đốm vàng phát sáng (đom đóm), đối thủ xanh ngọc đi qua lại, thủ môn dịch ngang; quả bóng chuyền qua 3 người (nhỏ dần theo chiều sâu, xoay, có bóng đổ), sút bổng vào lưới, lưới rung, thủ môn bay sai hướng, chữ "VÀO!". Ngày đá hiện nhãn "Tối nay". Dừng khi reduced-motion.
- **Cột 3 – điểm danh**: số lớn "7/12 đi"; chip "Đủ người" hoặc "Thiếu N" (ngưỡng theo đội, mặc định 9, tooltip giải thích); thanh màu đi (xanh) / nghỉ (đỏ) / chưa (xám) có tooltip số lượng; dãy avatar người Đi (tối đa 10 + "+N", hover ra tên).
  - Thành viên chưa vote khi vote mở: cả khối viền vàng nhấp nháy 2.4 giây, ô "● Bạn đi không?" + nút vàng lớn "✓ Tôi đi" và nút "Nghỉ".
  - Đã vote: 2 nút "Tôi đi" (xanh khi chọn) / "Tôi nghỉ" (đỏ khi chọn) + ⓘ "Đổi được đến khi đội trưởng đóng điểm danh".
  - Vote chưa mở / đã đóng: dòng trạng thái ngắn.
  - Nút phụ: ĐT thấy "Mở điểm danh" (khi chưa mở) hoặc "Nhắc N người", "Danh sách", "Đội hình trận"; thành viên thấy "Danh sách", "Đội hình trận".
- Bấm Đi/Nghỉ cập nhật lạc quan (optimistic) trong < 100 ms, toast "Đã điểm danh: bạn ĐI trận vs …"; lỗi thì hoàn tác.
- Không có trận: "Chưa có lịch" + nút "Tạo trận mới" (ĐT).

### 8.4 Màn Của tôi

- Thẻ cá nhân: avatar, tên, số áo, vị trí tốt nhất, 6 chỉ số gộp; nút "Cập nhật hồ sơ & chỉ số" (gửi duyệt; có bản chờ thì hiện chip "Đang chờ duyệt").
- Ô số mùa: số trận đã đá / tổng trận (tỉ lệ tham gia %), bàn, kiến tạo, MVP.
- Lịch sử quỹ: thành viên quỹ → lưới tháng Đã đóng / Chưa đóng; đá lẻ → bảng trận · tiền · Đã trả / Chưa trả.
- Bảng trận mùa của mình: ngày, trận, kết quả, vote (Đi/Nghỉ), bàn, KT, nút "Khai báo" cho trận đã qua có đi.
- Trận sắp tới chưa vote → nhắc + nút Đi/Nghỉ.

### 8.5 Khám phá (mọi đội)

- Lưới thẻ đội: ảnh/crest, tên, khẩu hiệu, số thành viên, sân nhà, thành tích mùa T-H-B, chuỗi 5 trận. Tìm theo tên (bỏ dấu).
- Bấm "Xem" → chế độ xem: tab Đội, Cầu thủ, Lịch đấu (đã đá), Thống kê; mọi nút sửa ẩn. Không lộ SĐT, email, ngày sinh, quỹ.

### 8.6 Tab Duyệt (ĐT)

Gộp 4 loại việc chờ, badge tổng trên tab: đơn xin vào đội; cập nhật hồ sơ; khai báo bàn/kiến tạo; vote MVP cần chỉ định. Thêm khối **Link mời**: ô link + nút Sao chép, Chia sẻ (Web Share API), Tạo link mới (xác nhận), ⓘ giải thích.

### 8.7 Admin (tab Hệ thống)

- Bảng người dùng: tên, SĐT, email, vai trò, các đội, ngày tạo; khoá/mở khoá, đặt lại mật khẩu.
- Bảng đội: tên, ĐT, số thành viên, số trận, ngày tạo; vào đội với quyền ĐT; chuyển ĐT; ẩn đội vi phạm.
- Ô tổng: số user, số đội, số trận tuần này.

### 8.8 Thông báo

| Loại (kind) | Gửi cho | Nội dung mẫu | Chạm vào |
| --- | --- | --- | --- |
| vote | Thành viên | "Trận CN 1/11 19:30 vs X: bạn đi được không?" + nút Đi/Nghỉ | Modal trận, tab Điểm danh |
| vote (nhắc) | Người chưa vote | "Nhắc: bạn chưa vote trận vs X ngày 1/11" | Như trên |
| mvp | Người Đi / ĐT | Mở vote, kết quả, cần chỉ định | Modal trận, tab MVP |
| join | ĐT | "Hải Râu xin vào đội" | Tab Duyệt |
| edit | ĐT | "Quang Còi gửi cập nhật hồ sơ" | Tab Duyệt |
| claim | ĐT | "Minh Lùn khai 1 bàn, 1 kiến tạo" | Tab Duyệt |
| result | Người gửi | Đã duyệt / từ chối đơn, hồ sơ, khai báo | Tab liên quan |
| fund | Thành viên quỹ chưa đóng | "Nhắc đóng quỹ T11" | Tab Quỹ |

Chuông trên header có badge số chưa đọc; panel 30 mục gần nhất, "Đánh dấu đã đọc hết". Không gửi thông báo cho chính người gây ra sự kiện. Mỗi thông báo cũng đẩy Web Push nếu người dùng đã bật.

## 9. Dữ liệu, API và yêu cầu phi chức năng

Prototype lưu toàn bộ vào một object JSON trong localStorage; bản thật tách thành 15 bảng PostgreSQL dưới đây (cộng \`season\_snapshots\`, \`audit\_logs\`, \`push\_subscriptions\`). Mọi bảng có `id` (cuid), `created_at`, `updated_at`; dữ liệu thuộc đội luôn có `team_id` và truy vấn luôn lọc theo nó.

### 9.1 Schema (Prisma, rút gọn)

```prisma
model User {
  id           String   @id @default(cuid())
  name         String
  phone        String   @unique          // chuẩn hoá 0xxxxxxxxx
  email        String?  @unique          // lowercase
  passwordHash String                    // argon2id
  role         String   @default("user") // user | admin
  lockedUntil  DateTime?
  players      Player[]
  captainOf    TeamCaptain[]
  createdAt    DateTime @default(now())
}

model Team {
  id            String  @id @default(cuid())
  name          String
  nameKey       String  @unique             // normName(name)
  foundedOn     DateTime?
  slogan        String?
  photoUrl      String?
  awardBootUrl  String?
  awardAssistUrl String?
  homeName      String?
  homeAddress   String?
  homeMapUrl    String?
  homeDays      Int[]                       // 0=CN..6=T7
  homeFrom      String?                     // "19:30"
  homeTo        String?
  homeCost      Int     @default(0)
  rules         String[]                    // thứ tự = ưu tiên, 2 dòng đầu nổi bật
  formation     String  @default("2-3-1")
  lineup        Json                        // [playerId|null] × 7
  inviteCode    String  @unique
  monthlyFee    Int     @default(200000)
  perMatchFee   Int     @default(80000)
  planMinutes   Int     @default(80)
  planPeriods   Int     @default(4)
  planMin       Int?
  hidden        Boolean @default(false)
}

model TeamCaptain { teamId String; userId String; @@id([teamId, userId]) }

model Player {
  id        String  @id @default(cuid())
  teamId    String
  userId    String?
  fullName  String
  nick      String?
  dob       DateTime?
  avatarUrl String?
  num       Int?
  foot      String              // Trái | Phải | Hai chân
  payType   String              // quy | le
  stats     Json                // {PAC:7.5, ...} 17 khoá
  styles    String[]
  isCaptain Boolean @default(false)
  status    String  @default("active") // active | left
  @@unique([teamId, userId])
}

model JoinRequest  { id String @id; teamId String; userId String; payload Json; status String; reason String?; decidedBy String?; decidedAt DateTime? }
model ProfileEdit  { id String @id; teamId String; playerId String @unique; payload Json; status String }

model Match {
  id        String   @id @default(cuid())
  teamId    String
  date      DateTime @db.Date
  time      String?
  opponent  String
  venue     String?
  type      String   // Giao hữu | Giải đấu
  cost      Int      @default(0)
  fee       Int                    // phí đá lẻ chốt lúc tạo
  note      String?
  scoreUs   Int?
  scoreThem Int?
  voteState String?  // null | open | closed
  voteOpenedAt DateTime?
  lineup    Json?    // đội hình trận tới
  mvpPlayerId String?
  deletedAt DateTime?
}

model Attendance { matchId String; playerId String; status String /* di | nghi */; setByCaptain Boolean; lePaid Boolean @default(false); @@id([matchId, playerId]) }
model MatchEvent { matchId String; playerId String; goals Int @default(0); assists Int @default(0); @@id([matchId, playerId]) }
model Claim      { id String @id; matchId String; playerId String; goals Int; assists Int; status String; @@unique([matchId, playerId]) }
model MvpVote    { matchId String @id; status String /* open|done|need */; openedAt DateTime; closesAt DateTime; closedAt DateTime?; decidedBy String? /* vote|captain */ }
model MvpBallot  { matchId String; voterId String; candidateId String; @@id([matchId, voterId]) }
model DuesPayment{ teamId String; playerId String; month String /* 2026-10 */; @@id([teamId, playerId, month]) }
model FundEntry  { id String @id; teamId String; date DateTime @db.Date; kind String /* in|out */; amount Int; note String; createdBy String }
model Notification { id String @id; userId String; teamId String?; kind String; matchId String?; view String?; text String; readAt DateTime?; createdAt DateTime @default(now()) }
```

### 9.2 API (REST, JSON)

Tiền tố `/api`. Mọi route trả 403 nếu sai quyền theo mục 2, 409 khi trùng (tên đội, SĐT), 422 khi dữ liệu sai.

| Nhóm | Route | Quyền |
| --- | --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /me`, `POST /auth/forgot` | Công khai / đã đăng nhập |
| Đội | `POST /teams`, `GET /teams?q=`, `GET /teams/:id`, `PATCH /teams/:id`, `GET /teams/check-name?name=` | Tạo: user; sửa: ĐT |
| Link mời | `GET /join/:code`, `POST /join/:code`, `POST /teams/:id/invite/rotate` | Công khai / user / ĐT |
| Duyệt | `GET /teams/:id/approvals`, `POST /join-requests/:id/{approve,reject}`, `POST /profile-edits/:id/{approve,reject}`, `POST /claims/:id/{approve,reject}` | ĐT |
| Cầu thủ | `GET/POST /teams/:id/players`, `PATCH /players/:id`, `POST /players/:id/edit-request`, `POST /stats/infer` | Theo mục 2 |
| Chiến thuật | `PUT /teams/:id/lineup`, `PUT /matches/:id/lineup`, `POST /teams/:id/auto-pick`, `GET /matches/:id/plan?minutes=&periods=&min=` | ĐT sửa; mọi thành viên xem |
| Trận | `GET/POST /teams/:id/matches`, `PATCH/DELETE /matches/:id`, `PUT /matches/:id/score`, `PUT /matches/:id/events` | ĐT |
| Điểm danh | `POST /matches/:id/vote/{open,close,remind}`, `PUT /matches/:id/attendance/:playerId` | ĐT / chính mình khi mở |
| Khai báo | `POST /matches/:id/claims` | Người Đi |
| MVP | `POST /matches/:id/mvp/open`, `PUT /matches/:id/mvp/ballot`, `PUT /matches/:id/mvp` (chỉ định) | ĐT / người Đi |
| Quỹ | `GET /teams/:id/fund`, `PUT /teams/:id/fund/fees`, `PUT /teams/:id/dues/:month/:playerId`, `PUT /matches/:id/le-paid/:playerId`, `POST/DELETE /teams/:id/fund/entries` | Xem: thành viên; sửa: ĐT |
| Thống kê | `GET /teams/:id/season?year=`, `GET /teams/:id/dashboard`, `GET /me/season?teamId=` | Theo tab |
| Thông báo | `GET /notifications`, `POST /notifications/read-all`, `POST /push/subscribe` | Chính mình |
| Admin | `GET /admin/users`, `GET /admin/teams`, `PATCH /admin/users/:id`, `PATCH /admin/teams/:id` | Admin |

Tính toán điểm vị trí, inferStats, buildPlan, teamSeason đặt trong một package dùng chung `packages/core` (TypeScript thuần, không phụ thuộc DB) để chạy được cả ở client (phản hồi tức thì) và server (nguồn sự thật).

### 9.3 Mùa giải và reset 1/1

- Không xoá dữ liệu. "Reset" = mọi thống kê, vinh danh, MVP, chuỗi, sao trên sân chỉ tính trận có `date` thuộc năm hiện tại (múi giờ Asia/Ho\_Chi\_Minh).
- 00:05 ngày 1/1 job chụp ảnh mùa cũ vào `season_snapshots` (Giày vàng, Vua kiến tạo, MVP nhiều nhất, thành tích) để làm "Bảng vàng các mùa" và gửi thông báo tổng kết.
- Tab Thống kê có bộ chọn mùa để xem năm cũ. Quỹ không reset.

### 9.4 Yêu cầu phi chức năng

| Hạng mục | Yêu cầu |
| --- | --- |
| Hiệu năng | Trang Đội < 1.5 s trên 4G (LCP); API p95 < 300 ms; buildPlan < 200 ms với 20 người |
| Bảo mật | argon2id; cookie httpOnly + SameSite=Lax; CSRF token cho form; rate limit login 5/15 phút; kiểm tra quyền phía server; escape mọi nội dung người dùng; link bản đồ chỉ nhận http(s) |
| Riêng tư | Khách không thấy SĐT, email, ngày sinh, quỹ của đội khác; SĐT thành viên chỉ ĐT thấy |
| Đồng thời | Ghi điểm danh/phiếu MVP là upsert theo khoá (matchId, playerId); đóng vote MVP trong transaction, idempotent |
| Khả dụng | PWA: cài lên màn hình chính, xem được dữ liệu lần cuối khi mất mạng. Lời mời cài app (bổ sung 31/10/2026): Android/Chrome có nút "Cài app" mở hộp cài của trình duyệt; iPhone/iPad (Safari không có hộp cài tự động) hướng dẫn Chia sẻ → "Thêm vào MH chính"; mở trong Zalo/Facebook/Messenger thì hướng dẫn mở bằng Safari/Chrome + nút sao chép link. Không chặn thao tác, "Để sau" ẩn tới lần mở app sau, đã mở từ icon thì không hiện. Icon PNG 180/192/512 + maskable cho màn hình chính. |
| Truy cập | WCAG 2.1 AA: tương phản, focus rõ, tooltip mở được bằng bàn phím, `aria-label` cho nút icon, hỗ trợ reduced-motion |
| Ngôn ngữ | Tiếng Việt; ngày d/M, tiền `vi-VN` + "đ" |
| Nhật ký | `audit_logs` cho thao tác của ĐT: sửa tỉ số, đổi vote hộ, xoá khoản thu chi, duyệt/từ chối |
| Sao lưu | Backup DB hằng ngày, giữ 14 ngày |

## 10. Thiết kế giao diện

Phong cách: **màu Ballon d'Or** (đen đêm, vàng champagne, ngà, số hạng màu san hô) + **hiệu ứng kính mờ kiểu Modernist** (frosted glass, viền sáng, bo tròn lớn, pill). Một theme sáng duy nhất có củ ý; các khối nhấn (header, hero, trận tới, vinh danh) là kính khói đen. Prototype `domdom-fc.html` bản 21 là tham chiếu hình ảnh chính xác.

### 10.1 Design tokens

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| --bg | #f4efe5 + các quầng sáng vàng / xanh ngọc / san hô | Nền trang |
| --surface | rgba(255,255,255,.62) + blur(22px) saturate(140%) | Thẻ kính trắng |
| --edge | rgba(255,255,255,.78) | Viền kính |
| --ink / --muted | #141414 / #6b655b | Chữ chính / phụ |
| --gold / --gold-2 | #e3bf86 / #c9a063 | Tiêu đề trên nền đen, gạch chân |
| --cta | #f3c58a | Nút chính, tab đang chọn |
| --accent | #9c6c22 | Chữ nhấn trên nền sáng |
| --night / --onyx | #08090b / #0b0c0e | Khối kính khói đen (độ mờ .82–.96) |
| --coral | #c9532f | Số hạng #2 #3 #4 |
| --good / --ok / --bad | #23894f / #b88300 / #c43e33 | Thắng-Hòa-Thua, thang điểm |
| Đi / Nghỉ | #2fae86 / #e5553e | Thanh điểm danh, nút đã chọn |
| Số mạ vàng | gradient #fff3d6 → #e3bf86 → #a77630 | Số lớn vinh danh, đếm ngược |

| Kiểu chữ | Font | Ghi chú |
| --- | --- | --- |
| Hiển thị (tên đội, tiêu đề, số lớn) | Jost 300–600 | Tiêu đề mục 28 px + gạch vàng 44×2 px; nhãn nhỏ viết hoa, giãn chữ .1–.2em |
| Nội dung | Be Vietnam Pro 300–700 | Phủ đủ dấu tiếng Việt |

Bo góc: thẻ 22 px, khối lớn 28 px, nút và tab 999 px (pill). Bóng: 0 8px 28px rgba(40,30,15,.08) cho thẻ sáng; 0 24px 60px rgba(0,0,0,.22) cho khối đen.

### 10.2 Bố cục

- **Header tràn viền** hết chiều ngang, nền đen chuyển sắc + đường vàng mảnh ở mép dưới (sáng nhất ở giữa). Nội dung trong header căn theo khung 1360 px. Header **không dính** khi cuộn. Gồm: crest + tên đội (Jost 300, viết hoa, vàng), dropdown đổi đội, chuông, avatar + tên + chip vai trò (ĐỘI TRƯỞNG nền vàng), Đăng xuất; hàng tab pill có icon.
- **Nội dung**: max-width 1360 px, căn giữa, lề hai bên clamp(16px, 3vw, 40px). Không tràn toàn màn hình.
- **Lưới**: Dashboard 3 cột (1.15fr 1.15fr .9fr); Chiến thuật sân 5fr + bảng 7fr; danh sách thẻ auto-fill min 280 px.
- **Breakpoint**: 1180 (khối Trận tới 2 cột), 1000 (vinh danh 2 cột), 860 (1 cột, tắt blur khung lớn), 760 (tab chuyển xuống **thanh đáy cố định** kính đen, tab đang chọn nền vàng), 440 (thu nhỏ pill form).
- Không đặt `backdrop-filter` trên phần tử cha của thanh đáy hoặc bottom sheet (nó tạo containing block làm lệch `position: fixed`).

### 10.3 Nguyên tắc nội dung: ít chữ

- Không lặp thông tin đã thấy ở chỗ khác (ví dụ bỏ "Còn 3 ngày" khi đã có đồng hồ; bỏ tên đội mình trong "vs Đối thủ"; bỏ ngày đá viết chữ khi đã có pill ngày).
- Thông tin phụ, hướng dẫn, giải thích → icon ⓘ 17 px (chữ i nghiêng, nền mờ; hover chuyển vàng).
- **Tooltip**: một hộp dùng chung `position: fixed`, nền đen .94, viền vàng mờ, chữ 12.5 px, rộng tối đa 280 px; hiện trên phần tử, hết chỗ thì hiện dưới, kẹp trong màn hình 8 px. Mở bằng hover, focus bàn phím, hoặc chạm (mobile); đóng khi rời chuột, chạm chỗ khác, cuộn. Dùng attribute `data-tt` + `tabindex=0` + `aria-label`.
- **Quy định đội**: 2 quy định đầu hiện đầy đủ; các quy định còn lại là ô icon 38 px trong hàng "Khác", hover hiện nội dung. Icon chọn theo từ khoá: đồng hồ (muộn, giờ, phút), ô tick (điểm danh, vote, báo nghỉ), đồng xu (quỹ, tiền, phạt, trả, đóng), khiên (xoạc, chấn thương, an toàn), áo (áo, đồng phục, giày), trái tim (anh em, tôn trọng, thắng thua), mặc định ⓘ.
- Điểm vị trí luôn kèm popover công thức khi hover (mục 4.3), không in sẵn.

### 10.4 Thành phần chuẩn

| Thành phần | Mô tả |
| --- | --- |
| Nút | Pill; chính = nền --cta chữ đen; phụ = kính trắng .7; ghost = trong suốt; trên nền đen = trắng .07 viền trắng .18 |
| Seg / chip chọn | Pill; mục đã chọn nền onyx chữ vàng |
| Chip | Quỹ (xanh ngọc), Đá lẻ (vàng nhạt), Vote đang mở (xanh), Thắng / Thua |
| Avatar | Tròn; không ảnh thì 2 chữ cái trên nền HSL theo hash id |
| Thẻ sân | Tròn trắng, số áo, badge điểm màu, nhãn tên nền đen, "C", ★ MVP |
| Modal | Kính ngà .86, header có tab gạch vàng; mobile thành bottom sheet |
| Toast | Nền onyx, 2 giây |
| Trạng thái rỗng | Khung nét đứt, một câu + một nút hành động |

### 10.5 Chuyển động

Chuyển tab: blur-in 250 ms. Dashboard: hiện lần lượt, đếm số, vệt sáng, sân mini 6 giây, viền vàng nhấp nháy khi chưa điểm danh. Mọi chuyển động tắt khi `prefers-reduced-motion: reduce`.

## 11. Nghiệm thu, dữ liệu mẫu và kế hoạch triển khai

Hệ thống đạt khi mọi mục dưới đây qua test tự động (Vitest cho công thức, Playwright cho luồng) trên dữ liệu mẫu.

### 11.1 Tiêu chí nghiệm thu

- [ ] ĐT đăng ký 2 bước, tạo đội; tạo "dom dom fc" bị chặn vì trùng "Đom Đóm FC".
- [ ] Người mới mở link mời, khai hồ sơ + điểm vị trí, thấy màn chờ; ĐT sửa chỉ số rồi duyệt; người đó vào đội và nhận thông báo. Tạo link mới thì link cũ báo hết hiệu lực.
- [ ] Điểm vị trí khớp bảng trọng số mục 4.3 cho cả 12 cầu thủ mẫu (sai số ± 0.05); popover công thức chỉ hiện khi hover/chạm.
- [ ] inferStats: điểm tính lại từ chỉ số suy ra lệch ≤ 0.3 so với điểm tự chấm.
- [ ] Chạm cầu thủ → slot phát sáng đúng màu theo ngưỡng; chạm slot → top 3 gợi ý đúng thứ tự.
- [ ] Trận tới chỉ lấy người Đi; kế hoạch 12 người × 4 đợt: ai cũng ≥ 2 đợt, tổng 28 suất, người xuất sắc và quỹ nhận phần dư trước.
- [ ] Mở điểm danh gửi thông báo có nút Đi/Nghỉ; thành viên không sửa được vote người khác (403) hay vote khi đã đóng; ĐT sửa hộ thì hiện "đội trưởng chỉnh".
- [ ] Khối Trận tới: thành viên chưa vote thấy viền nhấp nháy + nút "✓ Tôi đi"; bấm xong số Đi tăng ngay, hết nhấp nháy.
- [ ] Khai báo bàn/kiến tạo chỉ mở cho người Đi sau ngày đá; duyệt xong cập nhật thống kê và vinh danh.
- [ ] Vote MVP: 7 người Đi, 5 phiếu, không hoà → tự chốt sau 24 giờ; 4 phiếu hoặc hoà → `need` và ĐT chỉ định. Job chạy dù không ai mở app.
- [ ] MVP hiện sao + số lần trên sân chiến thuật; đổi năm hệ thống sang 1/1 năm sau thì mọi số mùa về 0, quỹ giữ nguyên.
- [ ] Quỹ: số dư = quỹ tháng + đá lẻ − tiền sân ± ghi tay; "Còn phải thu" liệt kê đúng người nợ; đổi mức đá lẻ không đổi trận cũ.
- [ ] Khách xem đội khác: thấy Đội, Cầu thủ, Lịch, Thống kê; không thấy Quỹ, SĐT, nút sửa; gọi API sửa bị 403.
- [ ] Dashboard: tooltip mở bằng chuột, bàn phím và chạm; 2 quy định đầu hiện chữ, phần còn lại là icon.
- [ ] Giao diện khớp prototype ở 1920, 1440, 1024, 390 px; không cuộn ngang; reduced-motion tắt chuyển động.

### 11.2 Dữ liệu mẫu (seed)

Dùng lại đúng bộ dữ liệu của prototype để test so sánh được. Mật khẩu mọi tài khoản demo `123456`, admin `admin123`; chỉ nạp ở môi trường dev/staging.

| Tài khoản | SĐT | Vai trò |
| --- | --- | --- |
| Quản trị hệ thống | 0900000000 | Admin |
| Lê Anh Tuấn (Tuấn Tạ) | 0901000002 | ĐT Đom Đóm FC |
| Ngô Đăng Quang (Quang Còi) | 0901000009 | Thành viên Đom Đóm FC |
| Trần Đức Anh (Anh Thép) | 0902000002 | ĐT Phố Huế United |
| Lương Văn Hải (Hải Râu) | 0901000099 | Đang chờ duyệt |

- **Đom Đóm FC**: 12 cầu thủ (8 quỹ, 4 đá lẻ) với chỉ số đầy đủ trong hàm `sample()` của prototype; 4 trận đã đá (5–3, 2–2, 1–3, 4–1), 2 trận sắp tới (vs Hoàng Mai Stars đang điểm danh; vs FC Văn Phòng Láng Hạ); vote MVP trận 4 đang mở; 1 đơn xin vào, 1 cập nhật hồ sơ, 1 khai báo đang chờ; quỹ 200.000đ/tháng, 4 khoản ghi tay; sân nhà Sân Chảo Lửa, T3 + T6, 19:30–21:00, 700.000đ; 6 quy định.
- **Phố Huế United**: 9 cầu thủ (chỉ số suy ngược từ điểm vị trí), 3 trận đã đá, 1 sắp tới, sơ đồ 3-2-1.
- Ngày trận tính tương đối so với ngày seed (−25, −18, −11, −4, +3, +10 ngày).

### 11.3 Kế hoạch triển khai

Làm theo 5 phase, mỗi phase một PR có test và chạy được trên staging; cổng chuyển phase ghi dưới sơ đồ.

&#91;embedded content: lộ trình · 5 phase, 5 cổng kiểm tra\]

Phase 1–2 làm nền dữ liệu và công thức; giao diện theme đầy đủ để cuối cùng, nhưng mọi màn đều dùng token mục 10.1 ngay từ đầu.

### 11.4 Câu hỏi mở

- Stack chính thức: Next.js + PostgreSQL (đề xuất) hay OutSystems ODC?
- Có cần đăng nhập bằng Zalo / Google ở phase 1 không?
- Tên miền và tên sản phẩm chính thức (prototype dùng "Sân 7 Manager").
