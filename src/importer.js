/**
 * Nhập sản phẩm từ các file JSON trong data/imports/ vào CSDL.
 *
 * - Tự chạy khi khởi động server: CHỈ THÊM sản phẩm chưa có (theo slug), không ghi đè
 *   những gì admin đã sửa.
 * - Cập nhật lại giá/kích thước cho sản phẩm đã có: npm run import -- --update
 *
 * Định dạng file: [{ name, brand, category, variants: [{ w, l, t, price, sale }] }]
 * (w x l = kích thước cm, t = độ dày cm, price = giá gốc, sale = giá khuyến mãi, 0 nếu không giảm)
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { slugify, now, cheapestSize } = require('./utils');

const DIR = path.join(__dirname, '..', 'data', 'imports');

// Ảnh minh hoạ xoay vòng (thay bằng ảnh thật trong trang admin)
const IMAGES = {
  'dem-bong-ep': [
    ['/images/stock/s02.jpg', '/images/stock/s21.jpg'],
    ['/images/stock/s21.jpg', '/images/stock/s02.jpg'],
    ['/images/stock/s11.jpg', '/images/stock/s02.jpg'],
    ['/images/stock/s09.jpg', '/images/stock/s21.jpg'],
  ],
};

const label = (v) => `${v.w} x ${v.l} x ${v.t} cm`;

function build(p, idx, category) {
  const variants = (p.variants || []).filter((v) => v.w && v.l && v.t && v.price > 0);
  const sizes = variants.map((v) => ({ label: label(v), price: v.price, sale_price: v.sale && v.sale < v.price ? v.sale : 0 }));
  const thick = [...new Set(variants.map((v) => v.t))].sort((a, b) => a - b);
  const dims = [...new Set(variants.map((v) => `${v.w} x ${v.l}`))];
  const thickText = thick.length > 1 ? `${thick[0]} – ${thick[thick.length - 1]}cm` : `${thick[0]}cm`;
  const maxT = thick[thick.length - 1] || 0;
  const firm = maxT >= 16 && thick.length === 1 ? 4 : 5;
  const short = `${p.name} chính hãng ${p.brand}: ${thick.length} độ dày (${thick.join(', ')}cm), ${dims.length} kích thước từ ${dims[0]} đến ${dims[dims.length - 1]}cm. Bông ép tỷ trọng cao, mặt phẳng, cứng chắc, nâng đỡ cột sống tốt.`;
  const description = `<h3>${p.name}</h3>
<p>${p.name} là dòng đệm bông ép của thương hiệu <strong>${p.brand}</strong>, phù hợp người thích nằm cứng, người lớn tuổi, người bị đau lưng và trẻ nhỏ đang phát triển cột sống.</p>
<ul>
<li><strong>Độ dày:</strong> ${thick.map((t) => t + 'cm').join(', ')} – mỏng nhẹ dễ gấp gọn hoặc dày êm như đệm chính.</li>
<li><strong>Kích thước:</strong> ${dims.join(', ')} (cm). Nhận đặt kích thước theo yêu cầu.</li>
<li><strong>Cứng phẳng, không xẹp lún:</strong> bông ép tỷ trọng cao giữ form lâu năm.</li>
<li><strong>Thoáng khí, dễ vệ sinh:</strong> vỏ đệm có khoá kéo, tháo ra giặt được.</li>
</ul>
<p>Liên hệ hotline hoặc Zalo để được tư vấn chọn độ dày phù hợp và báo giá tốt nhất tại kho.</p>`;
  const specs = [
    ['Thương hiệu', p.brand],
    ['Loại đệm', 'Đệm bông ép'],
    ['Độ dày', thick.map((t) => t + ' cm').join(', ')],
    ['Kích thước', dims.join(', ') + ' (cm)'],
    ['Độ cứng', firm === 5 ? 'Cứng' : 'Cứng vừa'],
    ['Xuất xứ', 'Việt Nam'],
  ];
  const base = cheapestSize(sizes) || { price: 0, sale_price: 0 };
  const imgs = (IMAGES[category] || IMAGES['dem-bong-ep'])[idx % 4];
  return { sizes, specs, short, description, thickText, firm, base, imgs };
}

async function importFile(file, { update = false } = {}) {
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  const catSlug = path.basename(file, '.json');
  const cat = await db.one('SELECT id FROM categories WHERE slug = ?', [catSlug]);
  let added = 0;
  let updated = 0;
  for (const [i, p] of items.entries()) {
    if (!p.name || !p.variants?.length) continue;
    const slug = slugify(p.name);
    const b = build(p, i, catSlug);
    const exists = await db.one('SELECT id FROM products WHERE slug = ?', [slug]);
    if (exists) {
      if (!update) continue;
      await db.run('UPDATE products SET price = ?, sale_price = ?, sizes = ?, thickness = ?, brand = ? WHERE id = ?', [b.base.price, b.base.sale_price, JSON.stringify(b.sizes), b.thickText, p.brand, exists.id]);
      updated++;
      continue;
    }
    await db.run(
      `INSERT INTO products (category_id, name, slug, brand, sku, price, sale_price, short_desc, description, specs, sizes, images, thickness, firmness, warranty, badge, is_featured, is_hot, in_stock, active, rating_avg, rating_count, sold, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'','',0,0,1,1,5.0,0,0,?)`,
      [cat ? cat.id : null, p.name, slug, p.brand, 'BE' + String(i + 1).padStart(3, '0'), b.base.price, b.base.sale_price, b.short, b.description, JSON.stringify(b.specs), JSON.stringify(b.sizes), JSON.stringify(b.imgs), b.thickText, b.firm, now()]
    );
    added++;
  }
  return { file: path.basename(file), added, updated };
}

async function importAll(opts = {}) {
  if (!fs.existsSync(DIR)) return [];
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const res = [];
  for (const f of files) res.push(await importFile(path.join(DIR, f), opts));
  for (const r of res) if (r.added || r.updated) console.log(`Nhập ${r.file}: thêm ${r.added}, cập nhật ${r.updated} sản phẩm.`);
  return res;
}

module.exports = { importAll };

if (require.main === module) {
  require('dotenv').config();
  (async () => {
    await db.init();
    await require('./schema').migrate();
    await importAll({ update: process.argv.includes('--update') });
    process.exit(0);
  })();
}
