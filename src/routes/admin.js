const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('../db');
const settings = require('../settings');
const { requireAdmin, verifyCsrf, clearMenuCache } = require('../middleware');
const { slugify, now, parseJSON, hydrateProduct, cheapestSize, sanitizeHtml, ORDER_STATUS } = require('../utils');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const flash = (req, type, msg) => (req.session.flash = { type, msg });

/* ---------- Upload ảnh ---------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, req.app.locals.UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `${slugify(path.basename(file.originalname, path.extname(file.originalname))).slice(0, 50) || 'anh'}-${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)),
});
const fileUrl = (f) => '/uploads/' + f.filename;

async function uniqueSlug(table, base, id = 0) {
  let slug = slugify(base) || 'muc';
  let n = 1;
  while (await db.one(`SELECT id FROM ${table} WHERE slug = ? AND id <> ?`, [slug, id])) slug = `${slugify(base)}-${++n}`;
  return slug;
}
const int = (v) => Math.max(0, parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10) || 0);
const bool = (v) => (v === 'on' || v === '1' || v === 1 || v === true ? 1 : 0);

/* ---------- Đăng nhập ---------- */
const attempts = new Map();
router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('admin/login', { error: null, next: req.query.next || '/admin' });
});
router.post(
  '/login',
  wrap(async (req, res) => {
    const key = req.ip;
    const a = attempts.get(key) || { n: 0, t: Date.now() };
    if (Date.now() - a.t > 15 * 60 * 1000) Object.assign(a, { n: 0, t: Date.now() });
    if (a.n >= 8) return res.status(429).render('admin/login', { error: 'Bạn nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.', next: '/admin' });
    const user = await db.one('SELECT * FROM admins WHERE username = ?', [String(req.body.username || '').trim()]);
    if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash)) {
      a.n++;
      attempts.set(key, a);
      return res.status(401).render('admin/login', { error: 'Sai tên đăng nhập hoặc mật khẩu.', next: req.body.next || '/admin' });
    }
    attempts.delete(key);
    req.session.adminId = user.id;
    req.session.adminName = user.username;
    const next = String(req.body.next || '/admin');
    res.redirect(next.startsWith('/admin') ? next : '/admin');
  })
);
router.post('/logout', (req, res) => {
  req.session.adminId = null;
  req.session.adminName = null;
  res.redirect('/admin/login');
});

router.use(requireAdmin);
router.use(
  wrap(async (req, res, next) => {
    const r = await db.one("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'");
    const l = await db.one('SELECT COUNT(*) AS n FROM leads WHERE handled = 0');
    res.locals.badge = { orders: Number(r.n), leads: Number(l.n) };
    res.locals.ORDER_STATUS = ORDER_STATUS;
    next();
  })
);

/* ---------- Dashboard ---------- */
router.get(
  '/',
  wrap(async (req, res) => {
    const today = now().slice(0, 10);
    const month = today.slice(0, 7);
    const [t, m, p, recent, top, leads] = await Promise.all([
      db.one("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS s FROM orders WHERE created_at LIKE ? AND status <> 'cancelled'", [today + '%']),
      db.one("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS s FROM orders WHERE created_at LIKE ? AND status <> 'cancelled'", [month + '%']),
      db.one('SELECT COUNT(*) AS n FROM products WHERE active = 1'),
      db.query('SELECT * FROM orders ORDER BY id DESC LIMIT 8'),
      db.query('SELECT id, name, sold, images FROM products ORDER BY sold DESC LIMIT 5'),
      db.query('SELECT * FROM leads WHERE handled = 0 ORDER BY id DESC LIMIT 5'),
    ]);
    // Doanh thu 7 ngày
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const r = await db.one("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE created_at LIKE ? AND status <> 'cancelled'", [key + '%']);
      days.push({ label: key.slice(8) + '/' + key.slice(5, 7), value: Number(r.s) });
    }
    res.render('admin/dashboard', { title: 'Tổng quan', stats: { today: t, month: m, products: p.n }, recent, top: top.map(hydrateProduct), leads, days });
  })
);

/* ---------- Sản phẩm ---------- */
router.get(
  '/products',
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const cat = parseInt(req.query.cat, 10) || 0;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const where = ['1=1'];
    const params = [];
    if (q) {
      where.push('(p.name LIKE ? OR p.sku LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (cat) {
      where.push('p.category_id = ?');
      params.push(cat);
    }
    const total = Number((await db.one(`SELECT COUNT(*) AS n FROM products p WHERE ${where.join(' AND ')}`, params)).n);
    const rows = await db.query(
      `SELECT p.*, c.name AS cat_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT 20 OFFSET ?`,
      [...params, (page - 1) * 20]
    );
    const cats = await db.query('SELECT id, name FROM categories ORDER BY sort, id');
    res.render('admin/products', { title: 'Sản phẩm', products: rows.map(hydrateProduct), cats, q, cat, page, pages: Math.ceil(total / 20), total });
  })
);

async function productForm(req, res, product) {
  const cats = await db.query('SELECT id, name FROM categories ORDER BY sort, id');
  res.render('admin/product-form', { title: product.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm', product, cats });
}
router.get('/products/new', wrap((req, res) => productForm(req, res, hydrateProduct({ firmness: 3, active: 1, in_stock: 1, images: '[]', sizes: '[]', specs: '[]' }))));
router.get(
  '/products/:id',
  wrap(async (req, res, next) => {
    const p = await db.one('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) return next();
    productForm(req, res, hydrateProduct(p));
  })
);

router.post(
  '/products/save',
  upload.array('new_images', 10),
  verifyCsrf,
  wrap(async (req, res) => {
    const b = req.body;
    const id = parseInt(b.id, 10) || 0;
    const name = String(b.name || '').trim();
    if (!name) {
      flash(req, 'err', 'Tên sản phẩm không được để trống');
      return res.redirect(id ? `/admin/products/${id}` : '/admin/products/new');
    }
    const kept = [].concat(b.keep_images || []).filter((x) => typeof x === 'string' && (x.startsWith('/uploads/') || x.startsWith('/images/')));
    const images = [...kept, ...(req.files || []).map(fileUrl)];
    const labels = [].concat(b.size_label || []);
    const prices = [].concat(b.size_price || []);
    const sales = [].concat(b.size_sale || []);
    const sizes = labels.map((l, i) => ({ label: String(l).trim(), price: int(prices[i]), sale_price: int(sales[i]) })).filter((s) => s.label && s.price);
    const specK = [].concat(b.spec_key || []);
    const specV = [].concat(b.spec_val || []);
    const specs = specK.map((k, i) => [String(k).trim(), String(specV[i] || '').trim()]).filter((s) => s[0] && s[1]);
    // Giá hiển thị ở danh sách = biến thể rẻ nhất (“Từ …”)
    const base = cheapestSize(sizes); // giá "Từ …" = biến thể rẻ nhất
    const price = base ? base.price : int(b.price);
    const sale = base ? base.sale_price : int(b.sale_price);
    const slug = await uniqueSlug('products', b.slug || name, id);
    const vals = [
      parseInt(b.category_id, 10) || null, name, slug, String(b.brand || '').trim(), String(b.sku || '').trim(), price, sale,
      String(b.short_desc || '').trim(), sanitizeHtml(b.description || ''), JSON.stringify(specs), JSON.stringify(sizes), JSON.stringify(images),
      String(b.thickness || '').trim(), Math.min(5, int(b.firmness)), String(b.warranty || '').trim(), String(b.badge || '').trim(), String(b.gift || '').trim().slice(0, 255),
      bool(b.is_featured), bool(b.is_hot), bool(b.in_stock), bool(b.active), int(b.sold),
    ];
    const cols = 'category_id, name, slug, brand, sku, price, sale_price, short_desc, description, specs, sizes, images, thickness, firmness, warranty, badge, gift, is_featured, is_hot, in_stock, active, sold';
    if (id) {
      await db.run(`UPDATE products SET ${cols.split(', ').map((c) => c + ' = ?').join(', ')} WHERE id = ?`, [...vals, id]);
      flash(req, 'ok', 'Đã lưu sản phẩm');
      return res.redirect(`/admin/products/${id}`);
    }
    const r = await db.run(`INSERT INTO products (${cols}, rating_avg, rating_count, created_at) VALUES (${cols.split(',').map(() => '?').join(',')}, 5.0, 0, ?)`, [...vals, now()]);
    flash(req, 'ok', 'Đã thêm sản phẩm mới');
    res.redirect(`/admin/products/${r.insertId}`);
  })
);
router.post(
  '/products/:id/delete',
  wrap(async (req, res) => {
    await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    flash(req, 'ok', 'Đã xoá sản phẩm');
    res.redirect('/admin/products');
  })
);
router.post(
  '/products/:id/toggle',
  wrap(async (req, res) => {
    await db.run('UPDATE products SET active = 1 - active WHERE id = ?', [req.params.id]);
    res.redirect(req.get('referer') || '/admin/products');
  })
);

/* ---------- Danh mục ---------- */
router.get(
  '/categories',
  wrap(async (req, res) => {
    const cats = await db.query('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS n FROM categories c ORDER BY c.sort, c.id');
    const edit = req.query.edit ? cats.find((c) => String(c.id) === req.query.edit) : null;
    res.render('admin/categories', { title: 'Danh mục', cats, edit });
  })
);
router.post(
  '/categories/save',
  upload.single('image_file'),
  verifyCsrf,
  wrap(async (req, res) => {
    const b = req.body;
    const id = parseInt(b.id, 10) || 0;
    const name = String(b.name || '').trim();
    if (!name) {
      flash(req, 'err', 'Tên danh mục không được để trống');
      return res.redirect('/admin/categories');
    }
    const image = req.file ? fileUrl(req.file) : String(b.image || '');
    const slug = await uniqueSlug('categories', b.slug || name, id);
    const parent = parseInt(b.parent_id, 10) || null;
    const vals = [name, slug, String(b.description || ''), image, int(b.sort), bool(b.active), parent === id ? null : parent];
    if (id) await db.run('UPDATE categories SET name=?, slug=?, description=?, image=?, sort=?, active=?, parent_id=? WHERE id=?', [...vals, id]);
    else await db.run('INSERT INTO categories (name, slug, description, image, sort, active, parent_id) VALUES (?,?,?,?,?,?,?)', vals);
    clearMenuCache();
    flash(req, 'ok', 'Đã lưu danh mục');
    res.redirect('/admin/categories');
  })
);
router.post(
  '/categories/:id/delete',
  wrap(async (req, res) => {
    await db.run('UPDATE products SET category_id = NULL WHERE category_id = ?', [req.params.id]);
    await db.run('UPDATE categories SET parent_id = NULL WHERE parent_id = ?', [req.params.id]);
    await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    clearMenuCache();
    flash(req, 'ok', 'Đã xoá danh mục');
    res.redirect('/admin/categories');
  })
);

/* ---------- Banner ---------- */
router.get(
  '/banners',
  wrap(async (req, res) => {
    const banners = await db.query('SELECT * FROM banners ORDER BY position, sort, id');
    const edit = req.query.edit === 'new' ? { position: 'main', theme: 'dark', active: 1 } : req.query.edit ? banners.find((b) => String(b.id) === req.query.edit) : null;
    res.render('admin/banners', { title: 'Banner', banners, edit });
  })
);
router.post(
  '/banners/save',
  upload.single('image_file'),
  verifyCsrf,
  wrap(async (req, res) => {
    const b = req.body;
    const id = parseInt(b.id, 10) || 0;
    const image = req.file ? fileUrl(req.file) : String(b.image || '');
    if (!image) {
      flash(req, 'err', 'Vui lòng chọn ảnh banner');
      return res.redirect('/admin/banners?edit=' + (id || 'new'));
    }
    const vals = [b.position === 'side' ? 'side' : 'main', b.eyebrow || '', b.title || '', b.subtitle || '', b.cta || '', image, b.link || '', b.theme === 'light' ? 'light' : 'dark', int(b.sort), bool(b.active)];
    if (id) await db.run('UPDATE banners SET position=?, eyebrow=?, title=?, subtitle=?, cta=?, image=?, link=?, theme=?, sort=?, active=? WHERE id=?', [...vals, id]);
    else await db.run('INSERT INTO banners (position, eyebrow, title, subtitle, cta, image, link, theme, sort, active) VALUES (?,?,?,?,?,?,?,?,?,?)', vals);
    flash(req, 'ok', 'Đã lưu banner');
    res.redirect('/admin/banners');
  })
);
router.post(
  '/banners/:id/delete',
  wrap(async (req, res) => {
    await db.run('DELETE FROM banners WHERE id = ?', [req.params.id]);
    flash(req, 'ok', 'Đã xoá banner');
    res.redirect('/admin/banners');
  })
);

/* ---------- Đơn hàng ---------- */
router.get(
  '/orders',
  wrap(async (req, res) => {
    const status = ORDER_STATUS[req.query.status] ? req.query.status : '';
    const q = String(req.query.q || '').trim();
    const where = ['1=1'];
    const params = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (q) {
      where.push('(code LIKE ? OR phone LIKE ? OR customer_name LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const orders = await db.query(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 200`, params);
    res.render('admin/orders', { title: 'Đơn hàng', orders, status, q });
  })
);
router.get(
  '/orders/:id',
  wrap(async (req, res, next) => {
    const order = await db.one('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return next();
    order.items = parseJSON(order.items, []);
    res.render('admin/order', { title: 'Đơn ' + order.code, order });
  })
);
router.post(
  '/orders/:id/status',
  wrap(async (req, res) => {
    if (ORDER_STATUS[req.body.status]) await db.run('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    flash(req, 'ok', 'Đã cập nhật trạng thái đơn');
    res.redirect('/admin/orders/' + req.params.id);
  })
);

/* ---------- Khách để lại liên hệ ---------- */
router.get(
  '/leads',
  wrap(async (req, res) => {
    const leads = await db.query('SELECT * FROM leads ORDER BY handled, id DESC LIMIT 300');
    res.render('admin/leads', { title: 'Khách cần tư vấn', leads });
  })
);
router.post(
  '/leads/:id/toggle',
  wrap(async (req, res) => {
    await db.run('UPDATE leads SET handled = 1 - handled WHERE id = ?', [req.params.id]);
    res.redirect('/admin/leads');
  })
);

/* ---------- Bài viết ---------- */
router.get(
  '/posts',
  wrap(async (req, res) => {
    const posts = await db.query('SELECT id, title, slug, image, active, created_at FROM posts ORDER BY id DESC');
    res.render('admin/posts', { title: 'Bài viết', posts });
  })
);
router.get(
  '/posts/:id',
  wrap(async (req, res, next) => {
    const post = req.params.id === 'new' ? { active: 1 } : await db.one('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return next();
    res.render('admin/post-form', { title: post.id ? 'Sửa bài viết' : 'Viết bài mới', post });
  })
);
router.post(
  '/posts/save',
  upload.single('image_file'),
  verifyCsrf,
  wrap(async (req, res) => {
    const b = req.body;
    const id = parseInt(b.id, 10) || 0;
    const title = String(b.title || '').trim();
    if (!title) {
      flash(req, 'err', 'Tiêu đề không được để trống');
      return res.redirect('/admin/posts/' + (id || 'new'));
    }
    const image = req.file ? fileUrl(req.file) : String(b.image || '');
    const slug = await uniqueSlug('posts', b.slug || title, id);
    const vals = [title, slug, String(b.excerpt || ''), sanitizeHtml(b.content || ''), image, bool(b.active)];
    if (id) {
      await db.run('UPDATE posts SET title=?, slug=?, excerpt=?, content=?, image=?, active=? WHERE id=?', [...vals, id]);
      flash(req, 'ok', 'Đã lưu bài viết');
      return res.redirect('/admin/posts/' + id);
    }
    const r = await db.run('INSERT INTO posts (title, slug, excerpt, content, image, active, created_at) VALUES (?,?,?,?,?,?,?)', [...vals, now()]);
    flash(req, 'ok', 'Đã đăng bài viết');
    res.redirect('/admin/posts/' + r.insertId);
  })
);
router.post(
  '/posts/:id/delete',
  wrap(async (req, res) => {
    await db.run('DELETE FROM posts WHERE id = ?', [req.params.id]);
    flash(req, 'ok', 'Đã xoá bài viết');
    res.redirect('/admin/posts');
  })
);

/* ---------- Cài đặt ---------- */
router.get('/settings', (req, res) => res.render('admin/settings', { title: 'Cài đặt website' }));
router.post(
  '/settings',
  wrap(async (req, res) => {
    await settings.save(req.body);
    flash(req, 'ok', 'Đã lưu cài đặt');
    res.redirect('/admin/settings');
  })
);
router.post(
  '/password',
  wrap(async (req, res) => {
    const u = await db.one('SELECT * FROM admins WHERE id = ?', [req.session.adminId]);
    const { current, next: pw, confirm } = req.body;
    if (!u || !bcrypt.compareSync(String(current || ''), u.password_hash)) flash(req, 'err', 'Mật khẩu hiện tại không đúng');
    else if (String(pw || '').length < 8) flash(req, 'err', 'Mật khẩu mới cần ít nhất 8 ký tự');
    else if (pw !== confirm) flash(req, 'err', 'Xác nhận mật khẩu không khớp');
    else {
      await db.run('UPDATE admins SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(pw, 10), u.id]);
      flash(req, 'ok', 'Đã đổi mật khẩu');
    }
    res.redirect('/admin/settings#password');
  })
);

module.exports = router;
