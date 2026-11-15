/**
 * Nhập sản phẩm từ các file JSON trong data/imports/ vào CSDL.
 * Tên file = slug danh mục (dem-bong-ep.json, dem-foam.json, dem-lo-xo.json…).
 *
 * - Tự chạy khi khởi động server: CHỈ THÊM sản phẩm chưa có (theo slug), không ghi đè
 *   những gì admin đã sửa. Riêng ảnh: nếu sản phẩm vẫn đang dùng ảnh minh hoạ (/images/stock/)
 *   và file JSON có ảnh thật thì tự thay bằng ảnh thật.
 * - Cập nhật lại giá/kích thước cho sản phẩm đã có: npm run import -- --update
 *
 * Định dạng: [{ name, brand, images?, features?, firmness?, badge?, contact?, thickness?,
 *               variants: [{ w, l, t, price, sale }] }]
 * (w x l = kích thước cm, t = độ dày cm, price = giá gốc, sale = giá khuyến mãi, 0 nếu không giảm;
 *  contact = true: không niêm yết giá, hiện "Liên hệ báo giá")
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { slugify, now, cheapestSize } = require('./utils');

const DIR = path.join(__dirname, '..', 'data', 'imports');

// Thông tin theo danh mục: tên loại, mã SKU, ảnh minh hoạ dự phòng, câu mô tả chung
const TYPES = {
  'dem-bong-ep': {
    kind: 'Đệm bông ép', sku: 'BE',
    stock: [['/images/stock/s02.jpg', '/images/stock/s21.jpg'], ['/images/stock/s21.jpg', '/images/stock/s02.jpg'], ['/images/stock/s11.jpg', '/images/stock/s02.jpg'], ['/images/stock/s09.jpg', '/images/stock/s21.jpg']],
    tagline: 'Bông ép tỷ trọng cao, mặt phẳng, cứng chắc, nâng đỡ cột sống tốt.',
    intro: 'phù hợp người thích nằm cứng, người lớn tuổi, người bị đau lưng và trẻ nhỏ đang phát triển cột sống',
    points: ['<strong>Cứng phẳng, không xẹp lún:</strong> bông ép tỷ trọng cao giữ form lâu năm.', '<strong>Thoáng khí, dễ vệ sinh:</strong> vỏ đệm có khoá kéo, tháo ra giặt được.'],
    firm: 5,
  },
  'dem-foam': {
    kind: 'Đệm foam', sku: 'FO',
    stock: [['/images/stock/s12.jpg', '/images/stock/s22.jpg'], ['/images/stock/s22.jpg', '/images/stock/s03.jpg'], ['/images/stock/s03.jpg', '/images/stock/s12.jpg']],
    tagline: 'Foam đàn hồi, êm vừa phải, ôm theo đường cong cơ thể.',
    intro: 'phù hợp người thích cảm giác êm vừa, nằm nghiêng nhiều và cần giảm áp lực vai – hông',
    points: ['<strong>Đàn hồi tốt:</strong> foam phục hồi nhanh, không để lại vết lún.', '<strong>Nhẹ, dễ di chuyển:</strong> thuận tiện khi vệ sinh, thay ga.'],
    firm: 3,
  },
  'dem-lo-xo': {
    kind: 'Đệm lò xo', sku: 'LX',
    stock: [['/images/stock/s05.jpg', '/images/stock/s16.jpg'], ['/images/stock/s16.jpg', '/images/stock/s04.jpg'], ['/images/stock/s04.jpg', '/images/stock/s05.jpg']],
    tagline: 'Lò xo nâng đỡ chuẩn cột sống, êm ái, thoáng khí.',
    intro: 'phù hợp gia đình, khách sạn và người muốn cảm giác nằm êm có độ nảy',
    points: ['<strong>Thoáng khí:</strong> khoang lò xo lưu thông không khí, không bí nóng.', '<strong>Bền bỉ:</strong> khung lò xo chắc chắn, viền đệm chống lún mép.'],
    firm: 3,
  },
};

const label = (v) => `${v.w} x ${v.l} x ${v.t} cm`;

function build(p, idx, category) {
  const T = TYPES[category] || TYPES['dem-bong-ep'];
  const variants = (p.variants || []).filter((v) => v.w && v.l && v.t && v.price > 0);
  const sizes = p.contact ? [] : variants.map((v) => ({ label: label(v), price: v.price, sale_price: v.sale && v.sale < v.price ? v.sale : 0 }));
  const thick = p.contact && p.thickness ? [p.thickness] : [...new Set(variants.map((v) => v.t))].sort((a, b) => a - b);
  const dims = [...new Set(variants.map((v) => `${v.w} x ${v.l}`))];
  const thickText = thick.length > 1 ? `${thick[0]} – ${thick[thick.length - 1]}cm` : thick.length ? `${thick[0]}cm` : '';
  const firm = p.firmness || (category === 'dem-bong-ep' && thick[thick.length - 1] >= 16 && thick.length === 1 ? 4 : T.firm);
  const firmText = ['', 'Mềm', 'Mềm vừa', 'Vừa', 'Cứng vừa', 'Cứng'][firm];
  const dimText = dims.length ? `${dims.length} kích thước từ ${dims[0]} đến ${dims[dims.length - 1]}cm` : 'kích thước theo yêu cầu';
  const short = p.contact
    ? `${p.name} chính hãng ${p.brand}, dày ${thickText}. ${p.features?.[0] ? p.features[0] + "." : T.tagline} Báo giá theo số lượng dự án.`
    : `${p.name} chính hãng ${p.brand}: ${thick.length > 1 ? `${thick.length} độ dày (${thick.join(', ')}cm)` : `dày ${thickText}`}, ${dimText}. ${T.tagline}`;
  const feats = (p.features || []).map((f) => `<li>${f}.</li>`).join('\n');
  const description = `<h3>${p.name}</h3>
<p>${p.name} là dòng ${T.kind.toLowerCase()} chính hãng của thương hiệu <strong>${p.brand}</strong>, ${T.intro}.</p>
<ul>
${feats}
<li><strong>Độ dày:</strong> ${thick.map((t) => t + 'cm').join(', ')}.</li>
<li><strong>Kích thước:</strong> ${dims.length ? dims.join(', ') + ' (cm). Nhận đặt kích thước theo yêu cầu.' : 'sản xuất theo kích thước yêu cầu.'}</li>
${T.points.map((x) => `<li>${x}</li>`).join('\n')}
</ul>
<p>Liên hệ hotline hoặc Zalo để được tư vấn chọn loại đệm phù hợp và báo giá tốt nhất tại kho.</p>`;
  const specs = [
    ['Thương hiệu', p.brand],
    ['Loại đệm', T.kind],
    ['Độ dày', thick.map((t) => t + ' cm').join(', ')],
    ['Kích thước', dims.length ? dims.join(', ') + ' (cm)' : 'Theo yêu cầu'],
    ['Độ cứng', firmText],
    ['Xuất xứ', 'Việt Nam'],
  ];
  const base = cheapestSize(sizes) || { price: 0, sale_price: 0 };
  const imgs = p.images?.length ? p.images : T.stock[idx % T.stock.length];
  return { sizes, specs, short, description, thickText, firm, base, imgs, sku: T.sku };
}

const isStock = (json) => {
  try {
    const a = JSON.parse(json || '[]');
    return !a.length || a.every((x) => String(x).startsWith('/images/stock/'));
  } catch {
    return true;
  }
};

async function importFile(file, { update = false } = {}) {
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  const catSlug = path.basename(file, '.json');
  const cat = await db.one('SELECT id FROM categories WHERE slug = ?', [catSlug]);
  let added = 0;
  let updated = 0;
  for (const [i, p] of items.entries()) {
    if (!p.name || (!p.variants?.length && !p.contact)) continue;
    const slug = slugify(p.name);
    const b = build(p, i, catSlug);
    const exists = await db.one('SELECT id, images FROM products WHERE slug = ?', [slug]);
    if (exists) {
      let changed = false;
      if (p.images?.length && isStock(exists.images)) {
        await db.run('UPDATE products SET images = ? WHERE id = ?', [JSON.stringify(p.images), exists.id]);
        changed = true;
      }
      if (update) {
        await db.run('UPDATE products SET price = ?, sale_price = ?, sizes = ?, thickness = ?, brand = ? WHERE id = ?', [b.base.price, b.base.sale_price, JSON.stringify(b.sizes), b.thickText, p.brand, exists.id]);
        changed = true;
      }
      if (changed) updated++;
      continue;
    }
    await db.run(
      `INSERT INTO products (category_id, name, slug, brand, sku, price, sale_price, short_desc, description, specs, sizes, images, thickness, firmness, warranty, badge, is_featured, is_hot, in_stock, active, rating_avg, rating_count, sold, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'',?,0,0,1,1,5.0,0,0,?)`,
      [cat ? cat.id : null, p.name, slug, p.brand, b.sku + String(i + 1).padStart(3, '0'), b.base.price, b.base.sale_price, b.short, b.description, JSON.stringify(b.specs), JSON.stringify(b.sizes), JSON.stringify(b.imgs), b.thickText, b.firm, p.badge || '', now()]
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
