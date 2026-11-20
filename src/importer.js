/**
 * Nhập sản phẩm từ các file JSON trong data/imports/ vào CSDL.
 * Tên file = slug danh mục (dem-bong-ep.json, dem-foam.json, dem-lo-xo.json…).
 *
 * - Tự chạy khi khởi động server: CHỈ THÊM sản phẩm chưa có (theo slug), không ghi đè
 *   những gì admin đã sửa. Riêng ảnh: nếu sản phẩm vẫn đang dùng ảnh minh hoạ (/images/stock/)
 *   và file JSON có ảnh thật thì tự thay bằng ảnh thật.
 * - Cập nhật lại giá/kích thước cho sản phẩm đã có: npm run import -- --update
 *
 * Định dạng: [{ name, brand, hidden?, images?, features?, firmness?, badge?, contact?, thickness?, gift?, description_html?,
 *               variants: [{ w, l, t, price, sale }] }]
 * (w x l = kích thước cm, t = độ dày cm, price = giá gốc, sale = giá khuyến mãi, 0 nếu không giảm;
 *  contact = true: không niêm yết giá, hiện "Liên hệ báo giá")
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { slugify, now, cheapestSize, sanitizeHtml } = require('./utils');

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
  'dem-cao-su': {
    kind: 'Đệm cao su', sku: 'CS',
    stock: [['/images/stock/s25.jpg', '/images/stock/s19.jpg'], ['/images/stock/s19.jpg', '/images/stock/s11.jpg']],
    tagline: 'Cao su thiên nhiên đàn hồi, thoáng khí, kháng khuẩn tự nhiên.',
    intro: 'phù hợp người cần nâng đỡ êm ái, thoáng mát và độ bền cao',
    points: ['<strong>Thoáng khí:</strong> lỗ thông hơi xuyên suốt giúp đệm khô thoáng.', '<strong>Bền bỉ:</strong> cao su đàn hồi tốt, giữ form nhiều năm.'],
    firm: 3,
  },
  'dem-hybrid': {
    kind: 'Đệm hybrid', sku: 'HY',
    stock: [['/images/stock/s25.jpg', '/images/stock/s12.jpg']],
    tagline: 'Kết hợp nhiều lớp vật liệu, êm ái và nâng đỡ tốt.',
    intro: 'phù hợp người muốn cân bằng giữa độ êm và độ nâng đỡ',
    points: [], firm: 3,
  },
  'phu-kien': { kind: 'Phụ kiện', sku: 'PK', stock: [['/images/stock/s12.jpg', '/images/stock/s03.jpg']], tagline: '', intro: 'tiện dụng cho phòng ngủ', points: [], firm: 0 },
  'goi-ngu': { kind: 'Gối ngủ', sku: 'GO', stock: [['/images/stock/s06.jpg', '/images/stock/s07.jpg']], tagline: '', intro: 'giúp nâng đỡ cổ vai gáy, ngủ ngon hơn', points: [], firm: 0 },
  'bo-chan-ga-goi': { kind: 'Bộ chăn ga gối', sku: 'CG', stock: [['/images/stock/s07.jpg', '/images/stock/s06.jpg']], tagline: '', intro: 'cho phòng ngủ thêm sang trọng', points: [], firm: 0 },
  'chan-he': { kind: 'Chăn hè', sku: 'CH', stock: [['/images/stock/s07.jpg', '/images/stock/s06.jpg']], tagline: '', intro: 'mỏng nhẹ, mát cho mùa hè', points: [], firm: 0 },
  'chan-dong': { kind: 'Chăn đông', sku: 'CD', stock: [['/images/stock/s07.jpg', '/images/stock/s06.jpg']], tagline: '', intro: 'ấm áp cho mùa đông', points: [], firm: 0 },
  'dem-tron': { kind: 'Đệm tròn', sku: 'DT', stock: [['/images/stock/s05.jpg', '/images/stock/s16.jpg']], tagline: 'Đệm tròn sản xuất theo kích thước giường.', intro: 'dành cho giường tròn, khách sạn, homestay', points: [], firm: 3 },
  'san-pham-cho-be': { kind: 'Sản phẩm cho bé', sku: 'BB', stock: [['/images/stock/s06.jpg', '/images/stock/s07.jpg']], tagline: '', intro: 'an toàn cho bé', points: [], firm: 0 },
  'dem-lo-xo': {
    kind: 'Đệm lò xo', sku: 'LX',
    stock: [['/images/stock/s05.jpg', '/images/stock/s16.jpg'], ['/images/stock/s16.jpg', '/images/stock/s04.jpg'], ['/images/stock/s04.jpg', '/images/stock/s05.jpg']],
    tagline: 'Lò xo nâng đỡ chuẩn cột sống, êm ái, thoáng khí.',
    intro: 'phù hợp gia đình, khách sạn và người muốn cảm giác nằm êm có độ nảy',
    points: ['<strong>Thoáng khí:</strong> khoang lò xo lưu thông không khí, không bí nóng.', '<strong>Bền bỉ:</strong> khung lò xo chắc chắn, viền đệm chống lún mép.'],
    firm: 3,
  },
};

// Danh mục tự tạo nếu CSDL chưa có (khi thêm file import cho danh mục mới)
const NEW_CATEGORIES = {
  'dem-hybrid': { name: 'Đệm Hybrid', description: 'Đệm cao su hybrid kết hợp nhiều lớp vật liệu: êm ái, thoáng khí, nâng đỡ tốt.', sort: 2 },
  'dem-tron': { name: 'Đệm Tròn', description: 'Đệm tròn bông ép, foam, lò xo cho giường tròn – sản xuất theo kích thước yêu cầu.', sort: 3 },
  'bo-chan-ga-goi': { parent: 'chan-ga-goi', name: 'Bộ Chăn Ga Gối', description: 'Bộ chăn ga gối lụa, tơ tằm, Tencel, cotton cao cấp chính hãng.', sort: 1 },
  'chan-he': { parent: 'chan-ga-goi', name: 'Chăn Hè', description: 'Chăn hè mỏng nhẹ, mát lạnh: băng lạnh, thun lạnh, lụa tơ tằm.', sort: 2 },
  'chan-dong': { parent: 'chan-ga-goi', name: 'Chăn Đông', description: 'Chăn đông, chăn lông cừu, ruột chăn ấm áp cho mùa lạnh.', sort: 3 },
  'san-pham-cho-be': { name: 'Sản Phẩm Cho Bé', description: 'Đệm, gối cao su thiên nhiên an toàn cho trẻ sơ sinh và trẻ nhỏ.', sort: 6, image: '/images/products/liena/nem-em-be-pompoms-4.jpg' },
};

const label = (v) => v.label || `${v.w} x ${v.l} x ${v.t} cm`;

function build(p, idx, category) {
  const T = TYPES[category] || TYPES['dem-bong-ep'];
  const variants = (p.variants || []).filter((v) => (v.label || (v.w && v.l && v.t)) && v.price > 0);
  const sizes = p.contact ? [] : variants.map((v) => ({ label: label(v), price: v.price, sale_price: v.sale && v.sale < v.price ? v.sale : 0 }));
  const thick = p.contact && p.thickness ? [p.thickness] : [...new Set(variants.filter((v) => v.t).map((v) => v.t))].sort((a, b) => a - b);
  const dims = [...new Set(variants.filter((v) => v.w).map((v) => `${v.w} x ${v.l}`))];
  const thickText = thick.length > 1 ? `${thick[0]} – ${thick[thick.length - 1]}cm` : thick.length ? `${thick[0]}cm` : '';
  const firm = p.firmness ?? (category === 'dem-bong-ep' && thick[thick.length - 1] >= 16 && thick.length === 1 ? 4 : T.firm);
  const firmText = ['', 'Mềm', 'Mềm vừa', 'Vừa', 'Cứng vừa', 'Cứng'][firm];
  const dimText = dims.length ? `${dims.length} kích thước từ ${dims[0]} đến ${dims[dims.length - 1]}cm` : 'kích thước theo yêu cầu';
  const short = p.short ? p.short : p.contact
    ? `${p.name} chính hãng ${p.brand}, dày ${thickText}. ${p.features?.[0] ? p.features[0] + "." : T.tagline} Báo giá theo số lượng dự án.`
    : `${p.name} chính hãng ${p.brand}: ${thick.length > 1 ? `${thick.length} độ dày (${thick.join(', ')}cm)` : `dày ${thickText}`}, ${dimText}. ${T.tagline}`;
  const feats = (p.features || []).map((f) => `<li>${f}.</li>`).join('\n');
  const description = p.description_html ? sanitizeHtml(p.description_html) : `<h3>${p.name}</h3>
<p>${p.name} là dòng ${T.kind.toLowerCase()} chính hãng của thương hiệu <strong>${p.brand}</strong>, ${T.intro}.</p>
<ul>
${feats}
<li><strong>Độ dày:</strong> ${thick.map((t) => t + 'cm').join(', ')}.</li>
<li><strong>Kích thước:</strong> ${dims.length ? dims.join(', ') + ' (cm). Nhận đặt kích thước theo yêu cầu.' : 'sản xuất theo kích thước yêu cầu.'}</li>
${T.points.map((x) => `<li>${x}</li>`).join('\n')}
</ul>
<p>Liên hệ hotline hoặc Zalo để được tư vấn chọn loại đệm phù hợp và báo giá tốt nhất tại kho.</p>`;
  const specs = p.specs ? [...p.specs] : [
    ['Thương hiệu', p.brand],
    ['Loại đệm', T.kind],
    ['Độ dày', thick.map((t) => t + ' cm').join(', ')],
    ['Kích thước', dims.length ? dims.join(', ') + ' (cm)' : 'Theo yêu cầu'],
    ['Độ cứng', firmText],
    ['Xuất xứ', 'Việt Nam'],
  ];
  if (p.specs) {
    const at = Math.max(2, specs.findIndex((r) => r[0] === 'Xuất xứ'));
    if (thick.length) specs.splice(at, 0, ['Độ dày', thick.map((t) => t + ' cm').join(', ')]);
    if (dims.length) specs.splice(at + (thick.length ? 1 : 0), 0, ['Kích thước', dims.join(', ') + ' (cm)']);
  }
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
  let cat = await db.one('SELECT id FROM categories WHERE slug = ?', [catSlug]);
  if (!cat && NEW_CATEGORIES[catSlug]) {
    const c = NEW_CATEGORIES[catSlug];
    const first = items.find((x) => x.images?.length);
    const parent = c.parent ? await db.one('SELECT id FROM categories WHERE slug = ?', [c.parent]) : null;
    const r = await db.run('INSERT INTO categories (parent_id, name, slug, description, image, sort, active) VALUES (?, ?, ?, ?, ?, ?, 1)', [parent ? parent.id : null, c.name, catSlug, c.description, c.image || (first ? first.images[0] : '/images/stock/s06.jpg'), c.sort]);
    cat = { id: r.insertId };
    console.log(`Tạo danh mục mới: ${c.name}`);
  }
  // Danh mục còn dùng ảnh minh hoạ -> đổi sang ảnh sản phẩm thật (hãng nhập gần nhất)
  if (cat) {
    const row = await db.one('SELECT image FROM categories WHERE id = ?', [cat.id]);
    const lastBrand = [...items].reverse().find((x) => x.images?.length)?.brand;
    const pick = items.find((x) => x.brand === lastBrand && x.images?.length);
    if (pick && (!row?.image || row.image.startsWith('/images/stock/'))) await db.run('UPDATE categories SET image = ? WHERE id = ?', [pick.images[0], cat.id]);
  }
  let added = 0;
  let updated = 0;
  for (const [i, p] of items.entries()) {
    if (!p.name || (!p.variants?.length && !p.contact)) continue;
    const slug = slugify(p.name);
    const b = build(p, i, catSlug);
    const exists = await db.one('SELECT id, images FROM products WHERE slug = ?', [slug]);
    if (exists) {
      let changed = false;
      // hidden: 1 -> ẩn khỏi web (không xoá, có thể bật lại trong admin)
      if (p.hidden) {
        const r = await db.run('UPDATE products SET active = 0 WHERE id = ? AND active = 1', [exists.id]);
        if (r.changes) changed = true;
      }
      // Thứ tự ưu tiên / bán chạy / flash sale: luôn đồng bộ theo file
      for (const col of ['pin', 'best', 'is_hot']) {
        if (col in p) {
          const r = await db.run(`UPDATE products SET ${col} = ? WHERE id = ? AND ${col} <> ?`, [Number(p[col]) || 0, exists.id, Number(p[col]) || 0]);
          if (r.changes) changed = true;
        }
      }
      if (p.images?.length && isStock(exists.images)) {
        await db.run('UPDATE products SET images = ? WHERE id = ?', [JSON.stringify(p.images), exists.id]);
        changed = true;
      }
      if (update) {
        await db.run('UPDATE products SET price = ?, sale_price = ?, sizes = ?, thickness = ?, brand = ? WHERE id = ?', [b.base.price, b.base.sale_price, JSON.stringify(b.sizes), b.thickText, p.brand, exists.id]);
        if ('gift' in p) await db.run('UPDATE products SET gift = ? WHERE id = ?', [p.gift || '', exists.id]);
        if (p.warranty) await db.run('UPDATE products SET warranty = ? WHERE id = ?', [p.warranty, exists.id]);
        if (p.short) await db.run('UPDATE products SET short_desc = ? WHERE id = ?', [b.short, exists.id]);
        if (p.specs) await db.run('UPDATE products SET specs = ? WHERE id = ?', [JSON.stringify(b.specs), exists.id]);
        changed = true;
      }
      if (changed) updated++;
      continue;
    }
    await db.run(
      `INSERT INTO products (category_id, name, slug, brand, sku, price, sale_price, short_desc, description, specs, sizes, images, thickness, firmness, warranty, badge, gift, is_featured, is_hot, in_stock, active, rating_avg, rating_count, sold, pin, best, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,5.0,0,0,?,?,?)`,
      [cat ? cat.id : null, p.name, slug, p.brand, b.sku + String(i + 1).padStart(3, '0'), b.base.price, b.base.sale_price, b.short, b.description, JSON.stringify(b.specs), JSON.stringify(b.sizes), JSON.stringify(b.imgs), b.thickText, b.firm, p.warranty || '', p.badge || '', p.gift || '', p.featured ? 1 : 0, p.is_hot ? 1 : 0, p.hidden ? 0 : 1, Number(p.pin) || 0, Number(p.best) || 0, now()]
    );
    added++;
  }
  return { file: path.basename(file), added, updated };
}

// Ảnh bìa danh mục do chủ shop chọn (luôn áp dụng khi nhập dữ liệu)
const CATEGORY_COVERS = {
  'dem-foam': '/images/products/vikosan/vk-smartsleep-1.jpg',
  'dem-cao-su': '/images/products/liena/nem-cao-su-lien-a-classic-1.jpg',
  'dem-tron': '/images/products/elan/dem-tron-lo-xo-1.jpg',
  'chan-ga-goi': '/images/products/vikosan/vk-cg-dl7-1.jpg',
};

// Tăng số này mỗi khi sửa giá / quà / bảo hành trong data/imports để website (kể cả trên Hostinger) tự cập nhật 1 lần khi khởi động
const DATA_VERSION = '2026-11-20f';

// Banner trượt trang chủ do chủ shop chọn (khớp theo đường dẫn), áp dụng 1 lần theo DATA_VERSION
const MAIN_BANNERS = [
  { link: '/#sieu-sale', image: '/images/products/dunlopillo/nem-lo-xo-cao-cap-coolsilk-royale-windsor-36-cm-2.jpg', subtitle: 'Ưu đãi lớn cho nhiều dòng đệm chính hãng · kèm bộ quà tặng cao cấp' },
  { link: '/danh-muc/dem-cao-su', image: '/images/products/liena/banner-ruot-cao-su-lien-a.jpg', eyebrow: 'Đệm cao su thiên nhiên', title: 'Giấc ngủ sâu, thức dậy nhẹ nhàng', subtitle: 'Đệm cao su giảm từ 10% – liên hệ để có giá tốt nhất' },
];

async function importAll(opts = {}) {
  if (!fs.existsSync(DIR)) return [];
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
  const ver = await db.one("SELECT svalue FROM settings WHERE skey = 'data_version'").catch(() => null);
  const sync = ver?.svalue !== DATA_VERSION;
  const o = sync ? { ...opts, update: true } : opts;
  const res = [];
  for (const f of files) res.push(await importFile(path.join(DIR, f), o));
  for (const [slug, image] of Object.entries(CATEGORY_COVERS)) await db.run('UPDATE categories SET image = ? WHERE slug = ?', [image, slug]);
  if (sync) {
    for (const b of MAIN_BANNERS) {
      const sets = Object.keys(b).filter((k) => k !== 'link');
      await db.run(`UPDATE banners SET ${sets.map((k) => `${k} = ?`).join(', ')} WHERE position = 'main' AND link = ?`, [...sets.map((k) => b[k]), b.link]);
    }
    // Đổi tên shop "Kho Đệm HP" -> "Đệm 191" trong dữ liệu đã lưu (cài đặt, bài viết, sản phẩm, banner, danh mục)
    const RENAME = [['Kho Đệm HP', 'Đệm 191'], ['Kho đệm HP', 'Đệm 191'], ['KHO ĐỆM HP', 'ĐỆM 191']];
    const TEXT_COLS = { settings: ['svalue'], posts: ['title', 'excerpt', 'content'], products: ['short_desc', 'description'], banners: ['eyebrow', 'title', 'subtitle'], categories: ['description'] };
    for (const [from, to] of RENAME) {
      for (const [table, cols] of Object.entries(TEXT_COLS)) {
        await db.run(`UPDATE ${table} SET ${cols.map((c) => `${c} = REPLACE(${c}, ?, ?)`).join(', ')}`, cols.flatMap(() => [from, to]));
      }
    }
    // Ngày kết thúc đếm ngược Black Friday: bỏ giá trị cũ đã lưu để dùng mặc định trong settings.js
    await db.run("DELETE FROM settings WHERE skey = 'flash_sale_end'");
    if (ver) await db.run("UPDATE settings SET svalue = ? WHERE skey = 'data_version'", [DATA_VERSION]);
    else await db.run("INSERT INTO settings (skey, svalue) VALUES ('data_version', ?)", [DATA_VERSION]);
    console.log(`Đồng bộ dữ liệu sản phẩm theo phiên bản ${DATA_VERSION}`);
  }
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
