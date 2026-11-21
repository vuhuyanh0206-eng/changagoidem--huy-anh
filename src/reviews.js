const db = require('./db');
const { now } = require('./utils');

// Tính lại điểm sao trung bình & số lượt đánh giá của sản phẩm từ các đánh giá đã duyệt
async function refreshRating(productId) {
  const r = await db.one('SELECT COUNT(*) AS n, AVG(rating) AS a FROM reviews WHERE approved = 1 AND product_id = ?', [productId]);
  const n = Number(r.n) || 0;
  const avg = n ? Math.round(Number(r.a) * 10) / 10 : 5.0;
  await db.run('UPDATE products SET rating_count = ?, rating_avg = ? WHERE id = ?', [n, avg, productId]);
}

async function create({ productId, name, phone, rating, content }) {
  await db.run('INSERT INTO reviews (product_id, name, phone, rating, content, approved, created_at) VALUES (?,?,?,?,?,0,?)', [productId || null, name, phone, rating, content, now()]);
}

const forProduct = (productId, limit = 20) =>
  db.query('SELECT id, name, rating, content, created_at FROM reviews WHERE approved = 1 AND product_id = ? ORDER BY id DESC LIMIT ' + Number(limit), [productId]);

const latest = (limit = 6) =>
  db.query(`SELECT r.name, r.rating, r.content, r.created_at, p.name AS product_name, p.slug AS product_slug FROM reviews r LEFT JOIN products p ON p.id = r.product_id WHERE r.approved = 1 AND r.rating >= 4 ORDER BY r.id DESC LIMIT ${Number(limit)}`);

module.exports = { refreshRating, create, forProduct, latest };
