# Thiệp cưới online cho khách ở xa

Mỗi khách nhận một link riêng mang tên mình. Khách xem thiệp, xem đường đi, xác nhận tham dự, để lại lời chúc và gửi quà mừng qua mã QR ngân hàng. Bạn theo dõi tất cả trên trang quản trị. Mọi thông tin được sửa trong **Google Sheet**.

- **Trang thiệp và trang quản trị**: GitHub Pages, miễn phí.
- **Dữ liệu** (khách, lượt xem, xác nhận, lời chúc, quà): Google Sheet, qua Google Apps Script, miễn phí.
- Không cần thuê VPS.

```
thiep-cuoi-online/
├── apps-script/
│   ├── Code.gs            ← dán vào Apps Script của Google Sheet
│   └── appsscript.json    ← file cấu hình Apps Script
├── site/                  ← trang web (được chép nguyên vào dist/)
│   ├── index.html         ← trang chung (khách nhập mã nếu mở nhầm)
│   ├── config.js          ← cấu hình khi chạy thử trên máy
│   ├── admin/index.html   ← trang quản trị
│   └── assets/            ← style.css, guest.js, admin.js, og.jpg (ảnh xem trước), demo.json, hình rồng phượng *.svg
├── templates/thiep.html   ← khuôn trang riêng của từng khách
├── scripts/build.mjs      ← tạo dist/m/<mã>/index.html cho từng khách
└── .github/workflows/deploy.yml  ← GitHub tự build và xuất bản
```

---

## 0. Chạy thử trên máy (không cần Google, không cần GitHub)

Cần Node.js 20 trở lên.

```bash
npm run preview
```

Mở `http://localhost:5173/m/demo1/` để xem thiệp mẫu. Mọi thao tác chỉ lưu tạm trên máy.

Nếu không muốn dùng `npx serve`: chạy `node scripts/build.mjs` rồi mở thư mục `dist/` bằng một máy chủ tĩnh bất kỳ, ví dụ `python3 -m http.server` trong thư mục `dist`.

---

## 1. Tạo Google Sheet và Apps Script

1. Vào [sheets.new](https://sheets.new) để tạo một Google Sheet trống. Đặt tên, ví dụ "Thiệp cưới Quân Hà".
2. Mở **Tiện ích mở rộng → Apps Script**.
3. Xóa nội dung mặc định, dán toàn bộ `apps-script/Code.gs` vào và lưu.
4. Mở **Cài đặt dự án** (biểu tượng bánh răng), bật **Hiển thị tệp kê khai "appsscript.json"**. Quay lại trình soạn thảo, mở `appsscript.json`, dán nội dung file cùng tên trong thư mục `apps-script/` và lưu.
5. Chọn hàm `setup` rồi bấm **Chạy**. Google hỏi quyền: chọn tài khoản → *Nâng cao* → *Đi tới … (không an toàn)* → *Cho phép*. Cảnh báo này bình thường với script tự viết.
6. Quay lại Sheet. Bạn sẽ thấy 5 tab mới: `CaiDat`, `NghiLe`, `LoTrinh`, `Khach`, `Admin`, kèm dữ liệu mẫu. Tải lại trang Sheet thì xuất hiện thêm menu **Thiệp cưới**.

## 2. Điền thông tin vào Sheet

| Tab | Điền gì |
| --- | --- |
| **CaiDat** | Tên cô dâu chú rể, ngày cưới, ngày âm lịch, hạn xác nhận, ngân hàng, số tài khoản và chủ tài khoản hai bên, người và số điện thoại hỗ trợ, link livestream, `dia_chi_trang` (điền ở bước 5). Chỉ sửa cột `gia_tri`. |
| **NghiLe** | Mỗi lễ một dòng: mã ngắn (`vq`, `th`, `tiec`…), tên lễ, nơi tổ chức, ngày (để trống thì lấy ngày cưới), giờ, địa chỉ, link Google Maps. |
| **LoTrinh** | Mỗi bước một dòng. Cùng một `ma_noi` (ví dụ `hanoi`) là cùng một nhóm. Để trống `ma_noi` cho nhóm khách ở gần. |
| **Khach** | Mỗi khách một dòng: `ten_hien_thi`, `cach_goi` (dùng trong lời mời, ví dụ "Bác và gia đình"), `ben` (trai/gai), `so_ghe`, `nghi_le` (các mã cách nhau dấu phẩy), `den_tu` (mã nơi trong LoTrinh). Cột `ma` để trống, hệ thống tự tạo. Các cột từ `luot_xem` trở đi do hệ thống ghi, đừng sửa tay. |
| **Admin** | Gmail của người được ủy quyền và vai trò: Quản trị toàn bộ, Quản lý nhà gái, Quản lý nhà trai, Chỉ xem. Gmail chủ thiệp **không** ghi ở đây mà khai ở bước 4. |

Mẹo:
- Ngày nên gõ dạng `2026-12-19`.
- Muốn xuống dòng trong một ô (ví dụ tên bố mẹ), bấm Alt + Enter.
- **Link Google Maps:** mở Google Maps, tìm đúng nhà hoặc nhà hàng, bấm **Chia sẻ → Sao chép đường liên kết**, rồi dán vào cột `link_ban_do`.

Chọn menu **Thiệp cưới → Kiểm tra cài đặt** để xem còn thiếu gì.

## 3. Tạo mã đăng nhập Google cho trang quản trị

Trang quản trị dùng nút "Đăng nhập bằng Google" để biết ai đang vào. Bước này cần một **OAuth Client ID**, miễn phí.

1. Vào [console.cloud.google.com](https://console.cloud.google.com) và tạo một dự án mới, ví dụ "thiep-cuoi".
2. Mở **APIs & Services → OAuth consent screen** (màn hình xin quyền):
   - Chọn *External*.
   - Điền tên ứng dụng và email của bạn.
   - Không cần thêm scope nào. Lưu lại.
3. Mở **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Loại: **Web application**.
   - Mục **Authorized JavaScript origins**, thêm `https://ten-ban.github.io`. Chỉ ghi tên miền, không ghi thêm đường dẫn phía sau. Nếu dùng tên miền riêng, thêm cả tên miền đó.
   - Nếu muốn thử trên máy, thêm `http://localhost:5173`.
4. Sao chép **Client ID**. Nó có dạng `…apps.googleusercontent.com`.

Nếu chưa muốn làm bước này, bạn vẫn dùng được thiệp. Khi đó bạn xem số liệu thẳng trong tab `Khach` của Sheet.

## 4. Khai báo bí mật và triển khai Apps Script

1. Trong Apps Script, mở **Cài đặt dự án → Thuộc tính tập lệnh → Thêm thuộc tính** và thêm:

   | Thuộc tính | Giá trị |
   | --- | --- |
   | `OWNER_EMAIL` | Gmail của bạn, cấp cao nhất |
   | `GOOGLE_CLIENT_ID` | Client ID ở bước 3 |
   | `BUILD_KEY` | Một chuỗi bí mật tự đặt, dài và khó đoán, ví dụ `qh-2026-7f9c2a` |

2. Bấm **Triển khai → Tùy chọn triển khai mới → Loại: Ứng dụng web**:
   - *Thực thi với tư cách*: **Tôi**.
   - *Ai có quyền truy cập*: **Bất kỳ ai**.
3. Sao chép **URL ứng dụng web**. Nó có dạng `https://script.google.com/macros/s/…/exec`.
4. Thử mở `URL?action=ping` trên trình duyệt. Thấy `{"ok":true}` là được.

> Nếu sau này bạn sửa `Code.gs`: vào **Triển khai → Quản lý các lần triển khai → Sửa → Phiên bản mới**. Cách này giữ nguyên URL. Còn nếu chỉ sửa dữ liệu trong Sheet thì không cần triển khai lại.

## 5. Đưa lên GitHub Pages

1. Tạo repo mới trên GitHub, ví dụ `thiep-cuoi-online`. Để **Public** thì GitHub Pages mới miễn phí. Repo **không chứa** danh sách khách: danh sách chỉ được đọc từ Sheet lúc build.
2. Tải toàn bộ thư mục này lên repo. Có thể kéo thả file trên giao diện web, hoặc dùng git:
   ```bash
   git init && git add . && git commit -m "Thiệp cưới" && git branch -M main
   git remote add origin https://github.com/ten-ban/thiep-cuoi-online.git && git push -u origin main
   ```
3. Vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.
4. Vào **Settings → Secrets and variables → Actions**:
   - Tab **Variables**: thêm `APPS_SCRIPT_URL` (URL ở bước 4) và `GOOGLE_CLIENT_ID`.
   - Tab **Secrets**: thêm `BUILD_KEY`, đúng chuỗi đã khai ở bước 4.
5. Vào tab **Actions → Xuất bản thiệp → Run workflow**. Sau 1–3 phút, trang chạy ở `https://ten-ban.github.io/thiep-cuoi-online/`.
6. Điền địa chỉ đó (có dấu `/` ở cuối) vào ô `dia_chi_trang` trong tab `CaiDat`, rồi chạy workflow thêm một lần để ảnh xem trước trên Zalo dùng đúng địa chỉ.

## 6. (Tùy chọn) Thêm khách trên trang quản trị là tự xuất bản

Mặc định, sau khi thêm khách mới bạn bấm **Run workflow** trên GitHub, hoặc chọn menu **Thiệp cưới → Xuất bản lại thiệp**. Muốn việc này tự động:

1. Trên GitHub, vào **Settings (tài khoản) → Developer settings → Fine-grained tokens → Generate new token**:
   - Chỉ chọn repo thiệp.
   - Quyền **Actions: Read and write**.
2. Trong Apps Script, thêm các thuộc tính:
   - `GH_TOKEN`: token vừa tạo.
   - `GH_REPO`: `ten-ban/thiep-cuoi-online`.
   - `GH_WORKFLOW` (không bắt buộc): mặc định `deploy.yml`.
   - `GH_BRANCH` (không bắt buộc): mặc định `main`.

## 7. Kiểm tra trước khi gửi

- [ ] Mở `…/admin/` bằng Chrome hoặc Safari, đăng nhập bằng Gmail chủ thiệp và thấy danh sách khách.
- [ ] Bấm **Xem thiệp** một khách, gửi thử một xác nhận và một lời chúc, rồi xem tab `Khach` trong Sheet có ghi nhận không.
- [ ] Mở phần quà mừng và **quét mã QR bằng app ngân hàng**: tên chủ tài khoản và nội dung `MUNG CUOI xxxxx` phải đúng.
- [ ] Gửi link một khách cho chính mình qua Zalo và Messenger để xem ảnh và tiêu đề xem trước.
- [ ] Bấm **Chỉ đường** ở từng lễ trên điện thoại.

## 8. Dùng hằng ngày

| Việc | Làm ở đâu |
| --- | --- |
| Sửa ngày, giờ, địa chỉ, link chỉ đường, số tài khoản, lời hướng dẫn | Google Sheet. Khách thấy ngay lần mở thiệp tiếp theo. |
| Thêm khách | Tab **Nhập khách** trên trang quản trị, hoặc thêm dòng trong tab `Khach` rồi chọn **Xuất bản lại thiệp** |
| Gửi thiệp | Trang quản trị → **Copy tin mời** → dán vào Zalo/Messenger; hoặc **Soạn Gmail** |
| Nhắc khách | Bộ lọc **Chưa mở thiệp** và **Đã xem, chưa trả lời** → **Sao chép danh sách cần nhắc** |
| Cấp quyền cho người khác | Thêm Gmail vào tab `Admin` |
| Đối soát tiền mừng sau cưới | Tải sao kê từ app/Internet Banking → tab **Mừng cưới & đối soát** → dán vào → **Đối soát**. Giao dịch không có mã được đánh dấu "kiểm tra tay". |

Chỉ cần **xuất bản lại** khi thêm khách mới hoặc đổi tên cô dâu chú rể, để tiêu đề xem trước trên Zalo đổi theo.

## 9. Tùy biến giao diện

- **Màu**: sửa khối `:root` ở đầu `site/assets/style.css`.
- **Hình rồng phượng**: phong bì dùng `site/assets/long-phung-vong.svg` (con dấu mở thiệp nằm ở viên ngọc giữa), phía dưới dùng `site/assets/long-vu-phuong-tuong.svg`, khung mã QR dùng `site/assets/khung-qr.svg`. Muốn thay hình, giữ nguyên tên file. Vùng có màu trong SVG được tô vàng ánh kim bằng CSS (lớp `.art` trong `style.css`). Ẩn hình phía dưới bằng `hien_huy_hieu` trong tab `CaiDat`.
- **Ảnh xem trước khi gửi link**: thay `site/assets/og.jpg` bằng ảnh cưới, khổ 1200 × 630, dưới 300 KB.
- **Câu chữ trên thiệp**: nằm trong hàm `render()` của `site/assets/guest.js`.

## 10. Riêng tư và an toàn

- Link khách dùng mã ngẫu nhiên 5 ký tự, không lộ tên trong đường dẫn. Trang có thẻ `noindex` nên Google không đưa lên kết quả tìm kiếm.
- Số điện thoại, ghi chú nội bộ và số tiền chỉ nằm trong Google Sheet, không nằm trong repo công khai.
- **Đừng chia sẻ file Sheet** cho admin phụ. Họ vào trang quản trị bằng Gmail của mình, và chỉ thấy đúng phần được phép.
- Sau đám cưới: tắt GitHub Pages (**Settings → Pages**), ngừng triển khai Apps Script, rồi tải bản sao Sheet về máy và xóa dữ liệu khách nếu không cần giữ.

## 11. Xử lý sự cố

| Hiện tượng | Cách xử lý |
| --- | --- |
| Thiệp báo "Không tìm thấy thiệp này" | Mã trong link không có trong tab `Khach`, hoặc khách mới chưa được xuất bản lại. |
| Thiệp báo lỗi mạng hoặc "Failed to fetch" | Kiểm tra `APPS_SCRIPT_URL`: phải kết thúc bằng `/exec`, và quyền truy cập phải là "Bất kỳ ai". |
| Build trên GitHub báo "Sai BUILD_KEY" | Secret `BUILD_KEY` trên GitHub phải trùng thuộc tính `BUILD_KEY` trong Apps Script. |
| Trang admin báo "chưa được cấp quyền" | Thêm Gmail đó vào tab `Admin`, hoặc kiểm tra `OWNER_EMAIL`. |
| Nút đăng nhập Google không hiện, hoặc báo lỗi origin | Thêm đúng `https://ten-ban.github.io` vào *Authorized JavaScript origins*. Thay đổi có thể mất vài phút mới có hiệu lực. |
| Zalo vẫn hiện ảnh hoặc tiêu đề cũ | Zalo nhớ bản xem trước một thời gian. Chốt nội dung trước khi gửi hàng loạt. |
| Đổi `Code.gs` mà không thấy tác dụng | Phải tạo phiên bản triển khai mới (xem bước 4). |
