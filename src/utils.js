const crypto = require('crypto');

function slugify(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function vnd(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('vi-VN') + '₫';
}

function now() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseJSON(s, fallback) {
  if (s == null || s === '') return fallback;
  if (typeof s === 'object') return s;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

/** Chuẩn hoá 1 dòng sản phẩm từ DB thành object dùng ở view. */
function hydrateProduct(p) {
  if (!p) return p;
  const images = parseJSON(p.images, []);
  const sizes = parseJSON(p.sizes, []);
  const specs = parseJSON(p.specs, []);
  const price = Number(p.price) || 0;
  const sale = Number(p.sale_price) || 0;
  const final = sale > 0 && sale < price ? sale : price;
  return {
    ...p,
    images,
    sizes,
    specs,
    image: images[0] || '/images/placeholder.svg',
    finalPrice: final,
    discount: sale > 0 && sale < price ? Math.round((1 - sale / price) * 100) : 0,
    rating_avg: Number(p.rating_avg) || 5,
  };
}

function orderCode() {
  const d = new Date();
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `HP${y}${m}${day}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Loại bỏ thẻ/thuộc tính nguy hiểm khỏi HTML do admin nhập (mô tả, bài viết). */
function sanitizeHtml(html = '') {
  return String(html)
    .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

const ORDER_STATUS = {
  new: { label: 'Mới', tone: 'blue' },
  confirmed: { label: 'Đã xác nhận', tone: 'indigo' },
  shipping: { label: 'Đang giao', tone: 'amber' },
  done: { label: 'Hoàn thành', tone: 'green' },
  cancelled: { label: 'Đã huỷ', tone: 'red' },
};

module.exports = { slugify, vnd, now, parseJSON, hydrateProduct, orderCode, escapeHtml, sanitizeHtml, ORDER_STATUS };
