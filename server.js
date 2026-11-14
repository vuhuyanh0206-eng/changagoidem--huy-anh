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
const { locals, csrf } = require('./src/middleware');

const app = express();
const PORT = process.env.PORT || 3000;
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
        connectSrc: ["'self'", 'https://www.google-analytics.com', 'https://*.google-analytics.com'],
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

(async () => {
  await db.init();
  await migrate();
  await seedIfEmpty();
  app.listen(PORT, () => console.log(`Kho Đệm HP đang chạy tại http://localhost:${PORT} (CSDL: ${db.dialect})`));
})().catch((e) => {
  console.error('Không khởi động được server:', e);
  process.exit(1);
});
