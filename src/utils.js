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
    rating_count: Number(p.rating_count) || 0,
    defaultSize: pickDefaultSize(sizes),
    imgLabel: imageLabel(p),
  };
}

/** Nhãn nhỏ phủ lên ảnh đệm: loại đệm, tên dòng, bảo hành, độ dày. Chỉ áp dụng cho danh mục đệm (slug bắt đầu bằng dem-). */
function imageLabel(p) {
  const slug = String(p.cat_slug || '');
  if (!slug.startsWith('dem-')) return null;
  const name = String(p.name || '');
  let type = p.cat_name || 'Đệm';
  if (slug === 'dem-lo-xo') {
    if (/túi/i.test(name)) type = 'Đệm Lò Xo Túi Độc Lập';
    else if (/cuộn/i.test(name)) type = 'Đệm Lò Xo Cuộn';
    else if (/liên kết/i.test(name)) type = 'Đệm Lò Xo Liên Kết';
  }
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const brands = [p.brand, 'Liên Á', 'Dunlopillo', 'Dunlop', 'Hanvico', 'Elan', "Doll's", 'Everhome', 'Everon'].filter(Boolean);
  const model = brands
    .reduce((t, b) => t.replace(new RegExp(`(^|\\s)${esc(b)}(?=\\s|$)`, 'gi'), ' '), name)
    .replace(/\s+/g, ' ').trim()
    .replace(/^(đệm|nệm)\s+/i, '')
    .replace(/^(lò xo|bông ép|bông|cao su thiên nhiên|cao su|hybrid|tròn)\s+/i, '')
    .replace(/^((túi|cuộn|liên kết|cao cấp|khách sạn|thiên nhiên|tinh khiết|nhập khẩu|gấp gọn|hybrid)\s+)+/i, '')
    .replace(/\s*\d+(?:[.,]\d+)?\s?cm\b/gi, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
  return { type, model: model || name, warranty: p.warranty || 'Chính hãng', thickness: String(p.thickness || '').replace(/\s*cm$/i, 'cm') };
}

const finalOf = (s) => (s.sale_price > 0 && s.sale_price < s.price ? s.sale_price : s.price);

/** Kích thước chọn sẵn: ưu tiên 1m6 x 2m (160 x 200), độ dày mỏng nhất; không có thì lấy kích thước đầu tiên. */
function pickDefaultSize(sizes = []) {
  if (!sizes.length) return null;
  return sizes.find((s) => /^(1m6 x 2m|160 x 200)/.test(s.label)) || sizes[0];
}

/** Biến thể rẻ nhất – dùng làm giá "Từ …" ở danh sách sản phẩm. */
function cheapestSize(sizes = []) {
  return sizes.reduce((best, s) => (!best || finalOf(s) < finalOf(best) ? s : best), null);
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

module.exports = { slugify, vnd, now, parseJSON, hydrateProduct, pickDefaultSize, cheapestSize, orderCode, escapeHtml, sanitizeHtml, ORDER_STATUS };
