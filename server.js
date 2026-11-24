require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieSession = require('cookie-session');

const db = require('./src/db');
const { migrate } = require('./src/schema');
const { seedIfEmpty } = require('./src/seed');
const { importAll } = require('./src/importer');
const { locals, csrf } = require('./src/middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Mở cổng ngay khi chạy; trong lúc khởi tạo CSDL (hoặc nếu khởi tạo lỗi) trả 503 kèm lý do ngắn gọn
let boot = { state: 'starting', error: null };
app.use((req, res, next) => {
  if (boot.state === 'ready') return next();
  res.status(503).type('text/plain; charset=utf-8').set('Retry-After', '30');
  res.send(boot.state === 'starting' ? 'Website đang khởi động, vui lòng tải lại sau ít phút.' : `Lỗi khởi động website: ${boot.error}`);
});
const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 24)) console.warn('CẢNH BÁO: hãy đặt SESSION_SECRET dài ít nhất 24 ký tự trong biến môi trường!');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.locals.UPLOAD_DIR = UPLOAD_DIR;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com', 'https://connect.facebook.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://www.facebook.com', 'https://connect.facebook.net'],
        frameSrc: ["'self'", 'https://www.google.com', 'https://maps.google.com', 'https://www.youtube.com'],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(
  cookieSession({
    name: 'khp.sid',
    keys: [process.env.SESSION_SECRET || 'dev-secret-change-me'],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd && process.env.COOKIE_SECURE !== 'false',
  })
);

// Ảnh WebP: trình duyệt hỗ trợ WebP nhận bản .webp nhẹ hơn (cùng đường dẫn .jpg/.png), trình duyệt cũ vẫn nhận ảnh gốc
const webpExists = new Map();
app.use('/images', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!/\.(jpe?g|png)$/i.test(req.path)) return next();
  res.vary('Accept');
  if (!/image\/webp/.test(req.headers.accept || '')) return next();
  const rel = decodeURIComponent(req.path).replace(/\.(jpe?g|png)$/i, '.webp');
  if (rel.includes('..')) return next();
  if (!webpExists.has(rel)) webpExists.set(rel, fs.existsSync(path.join(__dirname, 'public', 'images', rel)));
  if (webpExists.get(rel)) req.url = rel + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));
if (process.env.UPLOAD_DIR) app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: isProd ? '30d' : 0 }));

app.use(locals);
app.use(csrf);

app.use('/admin', require('./src/routes/admin'));
app.use('/api', require('./src/routes/api'));
app.use('/', require('./src/routes/shop'));

app.use((req, res) => res.status(404).render('shop/404', { meta: { title: 'Không tìm thấy trang' } }));
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'EBADCSRFTOKEN') return res.status(403).send('Phiên làm việc đã hết hạn, vui lòng tải lại trang và thử lại.');
  res.status(500).render('shop/404', { meta: { title: 'Có lỗi xảy ra' }, error: true });
});

app.listen(PORT, () => console.log(`Đệm 191 đang chạy tại http://localhost:${PORT}`));
(async () => {
  await db.init();
  await migrate();
  await seedIfEmpty();
  await importAll();
  boot = { state: 'ready', error: null };
  console.log(`Khởi tạo xong (CSDL: ${db.dialect})`);
})().catch((e) => {
  console.error('Không khởi động được server:', e);
  boot = { state: 'failed', error: `${e.code || e.name || 'Error'} – ${String(e.message || e).slice(0, 160)}${db.via ? ` [${db.via}]` : ''}${e.code === 'ER_ACCESS_DENIED_ERROR' ? ` [mật khẩu nhận được dài ${String(process.env.DB_PASSWORD || '').length} ký tự]` : ''}` };
});
