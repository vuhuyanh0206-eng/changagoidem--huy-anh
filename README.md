# Đệm 191 – Website bán chăn ga gối đệm

Website bán hàng cho **Đệm 191**, viết bằng **Node.js + Express + EJS**. Khi chạy trên Hostinger, dữ liệu lưu trong MySQL. Khi chạy thử trên máy, website tự dùng SQLite nên không cần cài thêm gì.

## Tính năng

**Phía khách hàng**
- Trang chủ dựng theo bố cục mẫu:
  - danh mục dọc, slider banner và 3 banner phụ
  - dải cam kết
  - danh mục dạng lưới, Flash Sale có đồng hồ đếm ngược, sản phẩm nổi bật có tab
  - mục chọn đệm theo nhu cầu, câu chuyện thương hiệu, mục dự án khách sạn, đánh giá khách hàng, tin tức
- Trang danh mục có bộ lọc theo giá, thương hiệu và độ cứng, có sắp xếp và phân trang.
- Tìm kiếm có gợi ý ngay khi gõ.
- Trang chi tiết sản phẩm:
  - bộ ảnh có phóng to
  - chọn kích thước thì giá đổi theo
  - nút mua ngay, thêm vào giỏ, gọi điện và Zalo
  - thanh mua hàng cố định ở cuối màn hình trên điện thoại
- Giỏ hàng (ngăn kéo bên cạnh và trang riêng) và trang thanh toán:
  - hỗ trợ **COD** và **chuyển khoản qua VietQR** (mã QR tự điền số tiền và mã đơn)
  - giá luôn được tính lại ở máy chủ, khách không sửa được giá
- Các trang dự án khách sạn, giới thiệu, liên hệ, chính sách và tin tức.
- Form "Gọi lại cho tôi" ở mọi trang.
- Nút gọi điện và Zalo nổi; thanh điều hướng dưới cùng trên điện thoại.
- SEO: thẻ meta, Open Graph, dữ liệu có cấu trúc (Product, Breadcrumb, Store), `sitemap.xml`, `robots.txt`.
- Hỗ trợ Google Analytics 4 và Facebook Pixel (nhập mã trong admin).

**Trang quản trị `/admin`**
- Tổng quan: doanh thu, biểu đồ 7 ngày, sản phẩm bán chạy.
- Đơn hàng: lọc theo trạng thái, tìm kiếm, cập nhật trạng thái (Mới → Đã xác nhận → Đang giao → Hoàn thành / Huỷ).
- Danh sách khách cần gọi lại (từ các form tư vấn).
- Sản phẩm: thêm, sửa, ẩn, xoá; nhiều kích thước và giá; thông số; tải nhiều ảnh, kéo để sắp xếp.
- Quản lý danh mục, banner (slider và banner phụ) và bài viết.
- Cài đặt: hotline, Zalo, địa chỉ, Google Maps, phí giao hàng, tài khoản ngân hàng VietQR, SEO, GA4, Pixel; đổi mật khẩu.

**Bảo mật:** chống CSRF trên mọi form, giới hạn số lần đăng nhập sai, Helmet/CSP, mật khẩu mã hoá bằng bcrypt, lọc HTML do admin nhập, kiểm tra loại và kích thước ảnh tải lên.

---

## 1. Chạy thử trên máy

Yêu cầu: Node.js 22.5 trở lên.

```bash
npm install
cp .env.example .env   # rồi để trống dòng DB_HOST= để dùng SQLite
npm run dev
```

Mở http://localhost:3000. Trang quản trị ở http://localhost:3000/admin, đăng nhập bằng `ADMIN_USER` / `ADMIN_PASSWORD` trong file `.env`.

Muốn xoá hết và nạp lại dữ liệu mẫu: `npm run seed`.

---

## 2. Đưa code lên GitHub

```bash
git init
git add .
git commit -m "Đệm 191 website"
git branch -M main
git remote add origin https://github.com/<tai-khoan>/kho-dem-hp.git
git push -u origin main
```

> File `.env`, thư mục `node_modules`, cơ sở dữ liệu SQLite và ảnh trong `public/uploads` đã được loại khỏi Git, nên mật khẩu không bị đưa lên GitHub.

---

## 3. Deploy lên Hostinger

### Cách A: Gói Business / Cloud (có mục Node.js trong hPanel)

1. **Tạo cơ sở dữ liệu:** vào hPanel → **Databases → MySQL Databases**, tạo database và user. Ghi lại *tên database*, *user* và *mật khẩu*.
2. **Tạo ứng dụng Node.js:** vào hPanel → **Websites → Add website → Node.js Apps**, chọn **Import Git repository**, kết nối GitHub rồi chọn repo `kho-dem-hp`.
3. **Cấu hình build:**
   - Framework: **Express** (hoặc Other)
   - Node version: **22.x**
   - Build command: `npm install`
   - Start command: `npm start`
   - Entry file: `server.js`
4. **Biến môi trường (Environment variables):** thêm các biến sau.
   ```
   NODE_ENV=production
   SESSION_SECRET=<chuỗi ngẫu nhiên dài 40+ ký tự>
   SITE_URL=https://ten-mien-cua-ban.vn
   ADMIN_USER=admin
   ADMIN_PASSWORD=<mật khẩu mạnh>
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=<tên database>
   DB_USER=<user database>
   DB_PASSWORD=<mật khẩu database>
   ```
5. **Deploy.** Lần chạy đầu, website tự tạo bảng và nạp dữ liệu mẫu.
6. **Gắn tên miền và bật SSL** trong hPanel (SSL miễn phí).
7. **Sau khi deploy:** vào `/admin`, đổi mật khẩu, nhập tài khoản ngân hàng, địa chỉ và link Google Maps, rồi thay ảnh và sản phẩm mẫu bằng hàng thật.

Mỗi lần `git push` lên nhánh `main`, Hostinger sẽ deploy lại (nếu bật auto-deploy, hoặc bấm **Redeploy**).

> **Lưu ý về ảnh tải lên:** ảnh admin upload được lưu ở `public/uploads`. Một số kiểu deploy sẽ ghi đè thư mục ứng dụng khi redeploy. Nếu thấy ảnh mất sau khi deploy lại, đặt biến `UPLOAD_DIR` trỏ tới một thư mục nằm ngoài thư mục code (ví dụ `/home/<user>/khodem-uploads`). Website sẽ tự phục vụ ảnh từ thư mục đó qua đường dẫn `/uploads/...`.

### Cách B: VPS Hostinger (Ubuntu)

```bash
# Cài Node 22 + PM2 + Nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx mysql-server
sudo npm i -g pm2

# Lấy code
git clone https://github.com/<tai-khoan>/kho-dem-hp.git && cd kho-dem-hp
npm install --omit=dev
cp .env.example .env && nano .env      # điền thông tin MySQL, SESSION_SECRET, SITE_URL

pm2 start server.js --name khodem && pm2 save && pm2 startup
```

Cấu hình Nginx làm reverse proxy về cổng 3000 (`proxy_pass http://127.0.0.1:3000;`), rồi chạy `sudo certbot --nginx` để có HTTPS.

Cập nhật code mới: `git pull && npm install --omit=dev && pm2 restart khodem`.

---

## Cấu trúc thư mục

```
server.js              Điểm khởi chạy (Express)
src/db.js              Kết nối CSDL (MySQL hoặc SQLite)
src/schema.js          Tạo bảng tự động
src/seed.js            Dữ liệu mẫu
src/routes/shop.js     Các trang cho khách hàng
src/routes/admin.js    Trang quản trị
src/routes/api.js      API tìm kiếm và giỏ hàng
views/                 Giao diện EJS (shop/, admin/, partials/)
public/css, js, images Tài nguyên tĩnh
```

## Thiết kế

- Màu chủ đạo xanh navy `#0F2A4D` kết hợp vàng đồng `#C08A2C`; nền kem `#FAF8F4`.
- Font **Cormorant Garamond** cho tiêu đề, **Be Vietnam Pro** cho nội dung (hiển thị tiếng Việt chuẩn).
- Icon SVG nét mảnh, không dùng emoji. Giao diện tương thích điện thoại, máy tính bảng và máy tính, tôn trọng thiết lập giảm chuyển động (`prefers-reduced-motion`).

Ảnh minh hoạ lấy từ Unsplash (giấy phép miễn phí). Nên thay bằng ảnh sản phẩm thật trong trang quản trị.
