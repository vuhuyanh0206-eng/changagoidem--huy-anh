const express = require('express');
const db = require('../db');
const catalog = require('../catalog');
const reviews = require('../reviews');
const policies = require('../policies');
const { hydrateProduct, orderCode, now, parseJSON } = require('../utils');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const PER_PAGE = 16;

/* ---------- Trang chủ ---------- */
router.get(
  '/',
  wrap(async (req, res) => {
    const [banners, flash, featuredPool, latestPosts, cats] = await Promise.all([
      db.query('SELECT * FROM banners WHERE active = 1 ORDER BY sort, id'),
      catalog.list({ where: ['p.is_hot = 1', 'p.sale_price > 0'], order: `p.best DESC, ${catalog.SORTS.discount}`, limit: 10 }),
      catalog.list({ where: ['p.is_featured = 1'], order: 'p.id DESC', limit: 120 }),
      db.query('SELECT id, title, slug, excerpt, image, created_at FROM posts WHERE active = 1 ORDER BY id DESC LIMIT 3'),
      db.query('SELECT * FROM categories WHERE active = 1 AND parent_id IS NULL ORDER BY sort, id'),
    ]);
    // Sản phẩm nổi bật: mới nhất trước, lấy xen kẽ từng danh mục để trang chủ đa dạng
    const byCat = new Map();
    for (const p of featuredPool) (byCat.get(p.category_id) || byCat.set(p.category_id, []).get(p.category_id)).push(p);
    // Thứ tự danh mục theo sản phẩm mới nhất của từng danh mục
    const order = [...new Set(featuredPool.map((p) => p.category_id))];
    const featured = [];
    while (featured.length < 8 && order.some((id) => byCat.get(id).length)) {
      for (const id of order) {
        const q = byCat.get(id);
        if (q.length && featured.length < 8) featured.push(q.shift());
      }
    }
    const counts = await db.query('SELECT category_id, COUNT(*) AS n FROM products WHERE active = 1 GROUP BY category_id');
    const countMap = Object.fromEntries(counts.map((c) => [c.category_id, Number(c.n)]));
    const childCats = await db.query('SELECT id, parent_id FROM categories WHERE active = 1 AND parent_id IS NOT NULL');
    res.render('shop/home', {
      meta: { title: `${res.locals.s.site_name} – ${res.locals.s.tagline}`, description: res.locals.s.meta_description },
      mainBanners: banners.filter((b) => b.position === 'main'),
      sideBanners: banners.filter((b) => b.position === 'side').slice(0, 3),
      flash,
      featured,
      latestPosts,
      reviews: await reviews.latest(6),
      cats: cats.map((c) => ({ ...c, count: (countMap[c.id] || 0) + childCats.filter((k) => k.parent_id === c.id).reduce((a, k) => a + (countMap[k.id] || 0), 0) })),
    });
  })
);

/* ---------- Danh mục + lọc ---------- */
async function renderListing(req, res, { title, description, where, params, cat, breadcrumb, heroImage, subcats = null }) {
  const q = req.query;
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const w = [...where];
  const p = [...params];
  const brands = [].concat(q.brand || []).filter(Boolean).slice(0, 10);
  if (brands.length) {
    w.push(`p.brand IN (${brands.map(() => '?').join(',')})`);
    p.push(...brands);
  }
  const min = parseInt(q.min, 10);
  const max = parseInt(q.max, 10);
  if (min > 0) {
    w.push(`${catalog.finalPriceSql} >= ?`);
    p.push(min);
  }
  if (max > 0) {
    w.push(`${catalog.finalPriceSql} <= ?`);
    p.push(max);
  }
  const firm = [].concat(q.firm || []).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 5);
  if (firm.length) {
    w.push(`p.firmness IN (${firm.map(() => '?').join(',')})`);
    p.push(...firm);
  }
  const sort = catalog.SORTS[q.sort] ? q.sort : 'new'; // mặc định: sản phẩm mới thêm lên đầu
  const [products, total, brandRows] = await Promise.all([
    catalog.list({ where: w, params: p, order: catalog.SORTS[sort], limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    catalog.count({ where: w, params: p }),
    db.query(`SELECT DISTINCT p.brand FROM products p WHERE ${['p.active = 1', ...where].join(' AND ')} AND p.brand IS NOT NULL AND p.brand <> '' ORDER BY p.brand`, params),
  ]);
  res.render('shop/listing', {
    meta: {
      title: `${title} | ${res.locals.s.site_name}`,
      description: description && description.length >= 110 ? description : `${title} chính hãng giá tại kho ${res.locals.s.site_name}. ${description || ''} Giao nhanh, quà tặng kèm, bảo hành chính hãng.`.replace(/\s+/g, ' '),
    },
    title,
    subcats,
    description,
    cat,
    heroImage,
    breadcrumb,
    products,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PER_PAGE)),
    sort,
    filters: { brands, min: min || '', max: max || '', firm },
    brandOptions: brandRows.map((b) => b.brand),
    query: q,
  });
}

// Mục cũ đã gộp vào mục khác -> chuyển hướng vĩnh viễn để giữ link và SEO
const MERGED_CATEGORIES = { 'chan-long-cuu': 'chan-dong' };
router.get('/danh-muc/:slug', (req, res, next) => {
  const to = MERGED_CATEGORIES[req.params.slug];
  if (!to) return next();
  const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(301, `/danh-muc/${to}${qs}`);
});

router.get(
  '/danh-muc/:slug',
  wrap(async (req, res, next) => {
    const cat = await db.one('SELECT * FROM categories WHERE slug = ? AND active = 1', [req.params.slug]);
    if (!cat) return next();
    const children = await db.query('SELECT id, name, slug FROM categories WHERE parent_id = ? AND active = 1 ORDER BY sort, id', [cat.id]);
    const ids = [cat.id, ...children.map((c) => c.id)];
    const parent = cat.parent_id ? await db.one('SELECT id, name, slug FROM categories WHERE id = ?', [cat.parent_id]) : null;
    const subcats = parent ? { parent, items: await db.query('SELECT id, name, slug FROM categories WHERE parent_id = ? AND active = 1 ORDER BY sort, id', [parent.id]) } : children.length ? { parent: cat, items: children } : null;
    await renderListing(req, res, {
      title: cat.name,
      description: cat.description,
      cat,
      heroImage: cat.image,
      where: [`p.category_id IN (${ids.map(() => '?').join(',')})`],
      params: ids,
      subcats,
      breadcrumb: parent ? [{ name: parent.name, href: '/danh-muc/' + parent.slug }, { name: cat.name }] : [{ name: cat.name }],
    });
  })
);

router.get(
  '/dem',
  wrap(async (req, res) => {
    const cats = await db.query("SELECT id FROM categories WHERE slug LIKE 'dem-%'");
    const ids = cats.map((c) => c.id);
    await renderListing(req, res, {
      title: 'Tất cả đệm',
      description: 'Đệm cao su, đệm lò xo, đệm foam, đệm bông ép chính hãng Liên Á, Dunlopillo, Vikosan, Elan… giá tại kho, giao nhanh, quà tặng kèm, bảo hành chính hãng.',
      heroImage: '/images/stock/s05.jpg',
      where: ids.length ? [`p.category_id IN (${ids.map(() => '?').join(',')})`] : ['1=0'],
      params: ids,
      breadcrumb: [{ name: 'Đệm' }],
    });
  })
);

router.get(
  '/khuyen-mai',
  wrap(async (req, res) => {
    if (!req.query.sort) req.query.sort = 'discount';
    await renderListing(req, res, {
      title: 'Khuyến mại hot',
      description: 'Tổng hợp chăn ga gối đệm đang giảm giá sâu nhất tại Đệm 191: đệm cao su, lò xo, foam chính hãng giảm đến 30%, kèm quà tặng cao cấp và giao nhanh.',
      heroImage: '/images/stock/s18.jpg',
      where: ['p.sale_price > 0', 'p.sale_price < p.price'],
      params: [],
      breadcrumb: [{ name: 'Khuyến mại' }],
    });
  })
);

router.get(
  '/tim-kiem',
  wrap(async (req, res) => {
    const kw = String(req.query.q || '').trim().slice(0, 80);
    await renderListing(req, res, {
      title: kw ? `Kết quả cho “${kw}”` : 'Tìm kiếm',
      where: kw ? ['(p.name LIKE ? OR p.brand LIKE ? OR p.short_desc LIKE ?)'] : [],
      params: kw ? [`%${kw}%`, `%${kw}%`, `%${kw}%`] : [],
      breadcrumb: [{ name: 'Tìm kiếm' }],
    });
  })
);

/* ---------- Chi tiết sản phẩm ---------- */
router.get(
  '/san-pham/:slug',
  wrap(async (req, res, next) => {
    const row = await db.one('SELECT * FROM products WHERE slug = ? AND active = 1', [req.params.slug]);
    if (!row) return next();
    const cat = row.category_id ? await db.one('SELECT id, name, slug FROM categories WHERE id = ?', [row.category_id]) : null;
    const product = hydrateProduct({ ...row, cat_slug: cat ? cat.slug : '', cat_name: cat ? cat.name : '' });
    db.run('UPDATE products SET views = views + 1 WHERE id = ?', [row.id]).catch(() => {});
    const related = await catalog.list({ where: ['p.category_id = ?', 'p.id <> ?'], params: [row.category_id || 0, row.id], order: 'p.id DESC', limit: 8 });
    const productReviews = await reviews.forProduct(row.id);
    res.render('shop/product', {
      meta: {
        title: `${product.name} | ${res.locals.s.site_name}`.length > 65 ? product.name : `${product.name} | ${res.locals.s.site_name}`,
        description: product.short_desc,
        image: product.image,
        type: 'product',
        product: product.finalPrice > 0 ? { id: product.id, brand: product.brand || res.locals.s.site_name, availability: Number(product.in_stock) ? 'in stock' : 'out of stock', price: product.finalPrice } : null,
      },
      product,
      cat,
      related,
      productReviews,
      reviewed: req.query.reviewed === '1',
      breadcrumb: [...(cat ? [{ name: cat.name, href: `/danh-muc/${cat.slug}` }] : []), { name: product.name }],
    });
  })
);

/* ---------- Giỏ hàng & đặt hàng ---------- */
router.get('/gio-hang', (req, res) => res.render('shop/cart', { meta: { title: 'Giỏ hàng', robots: 'noindex' }, breadcrumb: [{ name: 'Giỏ hàng' }] }));
router.get('/thanh-toan', (req, res) => res.render('shop/checkout', { meta: { title: 'Thanh toán', robots: 'noindex' }, breadcrumb: [{ name: 'Giỏ hàng', href: '/gio-hang' }, { name: 'Thanh toán' }], errors: null, form: {} }));

router.post(
  '/dat-hang',
  wrap(async (req, res) => {
    const b = req.body;
    const form = {
      customer_name: String(b.customer_name || '').trim().slice(0, 160),
      phone: String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 15),
      email: String(b.email || '').trim().slice(0, 160),
      province: String(b.province || '').trim().slice(0, 120),
      address: String(b.address || '').trim().slice(0, 255),
      note: String(b.note || '').trim().slice(0, 1000),
      payment_method: b.payment_method === 'bank' ? 'bank' : 'cod',
    };
    const errors = {};
    if (form.customer_name.length < 2) errors.customer_name = 'Vui lòng nhập họ tên';
    if (!/^(\+?84|0)\d{9,10}$/.test(form.phone)) errors.phone = 'Số điện thoại chưa đúng (VD: 0988 367 226)';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Email chưa đúng định dạng';
    if (form.address.length < 5) errors.address = 'Vui lòng nhập địa chỉ nhận hàng';
    if (!b.agree) errors.agree = 'Vui lòng đánh dấu đồng ý với điều khoản giao dịch và chính sách bảo mật';
    const cart = await catalog.priceCart(parseJSON(b.items, []));
    if (!cart.lines.length) errors.cart = 'Giỏ hàng đang trống';
    if (Object.keys(errors).length) {
      return res.status(422).render('shop/checkout', { meta: { title: 'Thanh toán', robots: 'noindex' }, breadcrumb: [{ name: 'Thanh toán' }], errors, form });
    }
    const shipping = catalog.shippingFee(cart.subtotal, res.locals.s);
    const code = orderCode();
    await db.run(
      `INSERT INTO orders (code, customer_name, phone, email, address, province, note, payment_method, items, subtotal, shipping, total, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'new',?)`,
      [code, form.customer_name, form.phone, form.email, form.address, form.province, form.note, form.payment_method, JSON.stringify(cart.lines), cart.subtotal, shipping, cart.subtotal + shipping, now()]
    );
    for (const l of cart.lines) db.run('UPDATE products SET sold = sold + ? WHERE id = ?', [l.qty, l.id]).catch(() => {});
    req.session.orders = [...(req.session.orders || []).slice(-9), code];
    res.redirect(`/dat-hang-thanh-cong/${code}`);
  })
);

router.get(
  '/dat-hang-thanh-cong/:code',
  wrap(async (req, res, next) => {
    if (!(req.session.orders || []).includes(req.params.code)) return res.redirect('/');
    const order = await db.one('SELECT * FROM orders WHERE code = ?', [req.params.code]);
    if (!order) return next();
    order.items = parseJSON(order.items, []);
    res.render('shop/success', { meta: { title: 'Đặt hàng thành công', robots: 'noindex' }, order });
  })
);

/* ---------- Tin tức ---------- */
router.get(
  '/tin-tuc',
  wrap(async (req, res) => {
    const posts = await db.query('SELECT id, title, slug, excerpt, image, created_at FROM posts WHERE active = 1 ORDER BY id DESC LIMIT 30');
    res.render('shop/blog', { meta: { title: `Tin tức & tư vấn | ${res.locals.s.site_name}`, description: 'Kinh nghiệm chọn đệm, so sánh đệm cao su – lò xo – foam, kích thước đệm chuẩn và mẹo vệ sinh, bảo quản chăn ga gối đệm từ Đệm 191.' }, posts, breadcrumb: [{ name: 'Tin tức' }] });
  })
);
router.get(
  '/tin-tuc/:slug',
  wrap(async (req, res, next) => {
    const post = await db.one('SELECT * FROM posts WHERE slug = ? AND active = 1', [req.params.slug]);
    if (!post) return next();
    const more = await db.query('SELECT id, title, slug, image, created_at FROM posts WHERE active = 1 AND id <> ? ORDER BY id DESC LIMIT 4', [post.id]);
    const picks = await catalog.list({ where: ['p.is_featured = 1'], order: 'p.id DESC', limit: 4 });
    res.render('shop/post', { meta: { title: `${post.title} | ${res.locals.s.site_name}`, description: post.excerpt, image: post.image, type: 'article' }, post, more, picks, breadcrumb: [{ name: 'Tin tức', href: '/tin-tuc' }, { name: post.title }] });
  })
);

/* ---------- Trang tĩnh ---------- */
router.get(
  '/du-an-khach-san',
  wrap(async (req, res) => {
    const cat = await db.one("SELECT * FROM categories WHERE slug = 'du-an-khach-san'");
    const products = await catalog.list({ where: ["(p.brand = 'HP Hotel' OR p.category_id = ?)"], params: [cat ? cat.id : 0], limit: 8 });
    res.render('shop/hotel', { meta: { title: `Dự án khách sạn | ${res.locals.s.site_name}`, description: 'Cung cấp đệm, chăn ga gối trọn gói cho khách sạn, homestay, resort với giá dự án.' }, products, breadcrumb: [{ name: 'Dự án khách sạn' }] });
  })
);
router.get('/gioi-thieu', wrap(async (req, res) => {
  const brands = (await db.query("SELECT p.brand, COUNT(*) n FROM products p WHERE p.active = 1 AND p.brand IS NOT NULL AND p.brand <> '' GROUP BY p.brand ORDER BY n DESC")).map((r) => r.brand);
  res.render('shop/about', { brands,  meta: { title: `Giới thiệu | ${res.locals.s.site_name}`, description: 'Giới thiệu Đệm 191 – cửa hàng chăn ga gối đệm chính hãng tại Hải Phòng: Liên Á, Dunlopillo, Vikosan, Elan… showroom tại Hải Phòng, giá tại kho, vận chuyển toàn quốc, bảo hành chính hãng.' }, breadcrumb: [{ name: 'Giới thiệu' }] });
}));
router.get('/lien-he', (req, res) => res.render('shop/contact', { meta: { title: `Liên hệ | ${res.locals.s.site_name}`, description: `Liên hệ Đệm 191: hotline ${res.locals.s.hotline}, showroom tại Hải Phòng. Tư vấn chọn đệm, báo giá tốt nhất và đặt hàng nhanh qua điện thoại, Zalo.` }, breadcrumb: [{ name: 'Liên hệ' }], sent: req.query.sent === '1' }));

router.get('/chinh-sach/:slug', (req, res, next) => {
  const POLICIES = policies.build(res.locals.s);
  const p = POLICIES[req.params.slug];
  if (!p) return next();
  res.render('shop/page', { meta: { title: `${p.title} | ${res.locals.s.site_name}`, description: ((t) => (t.length > 158 ? t.slice(0, 156).replace(/\s\S*$/, '') + '…' : t))(p.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) }, page: p, policies: POLICIES, current: req.params.slug, breadcrumb: [{ name: p.title }] });
});

router.post(
  '/lien-he',
  wrap(async (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 160);
    const phone = String(req.body.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
    const email = String(req.body.email || '').trim().slice(0, 120);
    const message = [String(req.body.message || '').trim().slice(0, 2000), email ? `Email: ${email}` : ''].filter(Boolean).join(' · ');
    const source = String(req.body.source || 'lien-he').slice(0, 60);
    const ok = phone.length >= 9 && !!req.body.agree;
    if (ok) await db.run('INSERT INTO leads (name, phone, message, source, handled, created_at) VALUES (?,?,?,?,0,?)', [name, phone, message, source, now()]);
    if (req.get('accept')?.includes('application/json')) return res.json({ ok });
    const back = String(req.body.back || '/lien-he');
    res.redirect((back.startsWith('/') && !back.startsWith('//') ? back : '/lien-he') + (back.includes('?') ? '&' : '?') + 'sent=1');
  })
);

/* ---------- Khách gửi đánh giá sản phẩm (chờ duyệt) ---------- */
router.post(
  '/danh-gia',
  wrap(async (req, res) => {
    const product = await db.one('SELECT id, slug FROM products WHERE id = ? AND active = 1', [parseInt(req.body.product_id, 10) || 0]);
    if (!product) return res.redirect('/');
    const name = String(req.body.name || '').trim().slice(0, 80);
    const phone = String(req.body.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
    const rating = Math.min(5, Math.max(1, parseInt(req.body.rating, 10) || 5));
    const content = String(req.body.content || '').trim().slice(0, 1500);
    // Trường ẩn "website" để chặn bot tự điền form
    if (name && content.length >= 5 && req.body.agree && !req.body.website) await reviews.create({ productId: product.id, name, phone, rating, content });
    res.redirect(`/san-pham/${product.slug}?reviewed=1#danh-gia`);
  })
);

/* ---------- SEO ---------- */
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /gio-hang\nDisallow: /thanh-toan\nSitemap: ${res.locals.siteUrl}/sitemap.xml\n`);
});
router.get(
  '/sitemap.xml',
  wrap(async (req, res) => {
    const base = res.locals.siteUrl;
    const [cats, prods, posts] = await Promise.all([
      db.query('SELECT slug FROM categories WHERE active = 1'),
      db.query('SELECT slug FROM products WHERE active = 1'),
      db.query('SELECT slug FROM posts WHERE active = 1'),
    ]);
    const urls = ['/', '/dem', '/khuyen-mai', '/tin-tuc', '/du-an-khach-san', '/gioi-thieu', '/lien-he', ...cats.map((c) => `/danh-muc/${c.slug}`), ...prods.map((p) => `/san-pham/${p.slug}`), ...posts.map((p) => `/tin-tuc/${p.slug}`)];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`);
  })
);

/* ---------- Feed sản phẩm cho Facebook / Meta Commerce Manager (danh mục quảng cáo, băng chuyền) ---------- */
router.get(
  '/feed/facebook.csv',
  wrap(async (req, res) => {
    const base = res.locals.siteUrl;
    const s = res.locals.s;
    const rows = await db.query(
      `SELECT p.*, (SELECT c.name FROM categories c WHERE c.id = p.category_id) AS cat_name, (SELECT c.slug FROM categories c WHERE c.id = p.category_id) AS cat_slug
       FROM products p WHERE p.active = 1 ORDER BY p.id`
    );
    const abs = (u) => (/^https?:/i.test(u) ? u : base + u);
    const plain = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'product_type'];
    const lines = [head.join(',')];
    for (const r of rows) {
      const p = hydrateProduct(r);
      if (!(p.finalPrice > 0)) continue; // "Liên hệ báo giá": Facebook bắt buộc có giá nên bỏ qua
      const imgs = p.images.filter((i) => !/placeholder/.test(i));
      if (!imgs.length) continue;
      const desc = (plain(p.short_desc) || plain(p.description) || p.name).slice(0, 5000);
      const hasSale = p.discount > 0;
      lines.push(
        [
          p.id,
          p.name.slice(0, 200),
          desc,
          Number(p.in_stock) ? 'in stock' : 'out of stock',
          'new',
          `${Number(p.price)} VND`,
          hasSale ? `${Number(p.sale_price)} VND` : '',
          `${base}/san-pham/${p.slug}`,
          abs(imgs[0]),
          imgs.slice(1, 10).map(abs).join(','),
          p.brand || s.site_name,
          p.cat_name || '',
        ]
          .map(cell)
          .join(',')
      );
    }
    res.set('Cache-Control', 'public, max-age=900');
    res.type('text/csv; charset=utf-8').send('﻿' + lines.join('\n') + '\n');
  })
);

module.exports = router;
