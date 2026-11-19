/** Truy vấn sản phẩm dùng chung cho storefront + API. */
const db = require('./db');
const { hydrateProduct, parseJSON } = require('./utils');

const LIST_COLS = `p.id, p.category_id, p.name, p.slug, p.brand, p.price, p.sale_price, p.short_desc, p.images, p.sizes, p.thickness,
  p.firmness, p.warranty, p.badge, p.gift, p.is_featured, p.is_hot, p.in_stock, p.rating_avg, p.rating_count, p.sold,
  (SELECT c.slug FROM categories c WHERE c.id = p.category_id) AS cat_slug, (SELECT c.name FROM categories c WHERE c.id = p.category_id) AS cat_name`;

async function list({ where = [], params = [], order = 'p.id DESC', limit = 12, offset = 0 } = {}) {
  const w = ['p.active = 1', ...where].join(' AND ');
  const rows = await db.query(`SELECT ${LIST_COLS} FROM products p WHERE ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return rows.map(hydrateProduct);
}

async function count({ where = [], params = [] } = {}) {
  const w = ['p.active = 1', ...where].join(' AND ');
  const r = await db.one(`SELECT COUNT(*) AS n FROM products p WHERE ${w}`, params);
  return Number(r.n);
}

const finalPriceSql = 'CASE WHEN p.sale_price > 0 AND p.sale_price < p.price THEN p.sale_price ELSE p.price END';

const SORTS = {
  new: 'p.id DESC',
  popular: 'p.sold DESC',
  price_asc: `${finalPriceSql} ASC`,
  price_desc: `${finalPriceSql} DESC`,
  discount: '(p.price - p.sale_price) DESC',
};

/**
 * Tính lại giỏ hàng từ DB (không tin giá phía client).
 * items: [{id, size, qty}]
 */
async function priceCart(items) {
  const clean = (Array.isArray(items) ? items : [])
    .map((i) => ({ id: parseInt(i.id, 10), size: String(i.size || '').slice(0, 40), qty: Math.min(99, Math.max(1, parseInt(i.qty, 10) || 1)) }))
    .filter((i) => i.id > 0)
    .slice(0, 50);
  if (!clean.length) return { lines: [], subtotal: 0 };
  const ids = [...new Set(clean.map((i) => i.id))];
  const rows = await db.query(`SELECT id, name, slug, price, sale_price, images, sizes, in_stock FROM products WHERE active = 1 AND id IN (${ids.map(() => '?').join(',')})`, ids);
  const map = new Map(rows.map((r) => [r.id, r]));
  const lines = [];
  for (const it of clean) {
    const p = map.get(it.id);
    if (!p) continue;
    const sizes = parseJSON(p.sizes, []);
    let price = Number(p.price);
    let sale = Number(p.sale_price);
    let size = '';
    if (sizes.length) {
      const s = sizes.find((x) => x.label === it.size) || sizes[0];
      size = s.label;
      price = Number(s.price);
      sale = Number(s.sale_price);
    }
    const unit = sale > 0 && sale < price ? sale : price;
    if (!(unit > 0)) continue; // sản phẩm "Liên hệ báo giá" không đặt qua giỏ
    const images = parseJSON(p.images, []);
    lines.push({ id: p.id, name: p.name, slug: p.slug, image: images[0] || '/images/placeholder.svg', size, qty: it.qty, unit, price, total: unit * it.qty });
  }
  return { lines, subtotal: lines.reduce((a, l) => a + l.total, 0) };
}

function shippingFee(subtotal, s) {
  const fee = parseInt(s.shipping_fee, 10) || 0;
  const min = parseInt(s.free_ship_min, 10) || 0;
  if (!fee) return 0;
  if (min && subtotal >= min) return 0;
  return fee;
}

module.exports = { list, count, SORTS, finalPriceSql, priceCart, shippingFee };
