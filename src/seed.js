/**
 * Dữ liệu mẫu ban đầu. Tự chạy khi CSDL trống.
 * Chạy lại từ đầu (XOÁ dữ liệu cũ): npm run seed
 */
const bcrypt = require('bcryptjs');
const db = require('./db');
const { slugify, now, cheapestSize } = require('./utils');

const img = (n) => `/images/stock/s${String(n).padStart(2, '0')}.jpg`;

const CATEGORIES = [
  { name: 'Đệm Foam', image: img(12), desc: 'Đệm foam, memory foam ôm sát cơ thể, giảm áp lực vai – hông.' },
  { name: 'Đệm Cao Su', image: img(25), desc: 'Cao su thiên nhiên 100%, thoáng khí, đàn hồi, bền 15–20 năm.' },
  { name: 'Đệm Lò Xo', image: img(5), desc: 'Lò xo túi độc lập, nâng đỡ chuẩn cột sống, không truyền chuyển động.' },
  { name: 'Đệm Bông Ép', image: img(2), desc: 'Bông ép cứng chắc, nhẹ, giá tốt – phù hợp người thích nằm cứng.' },
  { name: 'Chăn Ga Gối', image: img(1), desc: 'Bộ chăn ga gối Tencel, cotton lụa cao cấp, mềm mát, không xù.' },
  { name: 'Chăn Lông Cừu', image: img(8), desc: 'Chăn lông cừu ấm áp, nhẹ, giữ nhiệt tốt cho mùa đông.' },
  { name: 'Gối Ngủ', image: img(6), desc: 'Gối cao su non, gối lông vũ, gối công thái học chống đau cổ.' },
  { name: 'Dự Án Khách Sạn', image: img(17), desc: 'Cung cấp đệm – chăn ga trọn gói cho khách sạn, homestay, resort.' },
  { name: 'Phụ Kiện', image: img(7), desc: 'Topper, tấm bảo vệ đệm, ruột chăn, ruột gối.' },
];

const MATTRESS_SIZES = [
  ['1m2 x 2m', 0.72],
  ['1m4 x 2m', 0.82],
  ['1m6 x 2m', 1],
  ['1m8 x 2m', 1.14],
  ['2m x 2m2', 1.3],
];
const sizesFor = (base, sale) =>
  MATTRESS_SIZES.map(([label, k]) => ({
    label,
    price: Math.round((base * k) / 10000) * 10000,
    sale_price: sale ? Math.round((sale * k) / 10000) * 10000 : 0,
  }));

const P = (o) => o;
const PRODUCTS = [
  P({ cat: 'Đệm Cao Su', name: 'Đệm Cao Su Thiên Nhiên HP Royal Latex', brand: 'HP Premium', price: 15900000, sale: 11290000, thickness: '15cm', firmness: 3, warranty: '15 năm', badge: 'Bán chạy', featured: 1, hot: 1, imgs: [25, 19, 11], sold: 312, short: 'Cao su thiên nhiên 100% từ Đông Nam Bộ, 7 vùng nâng đỡ, kháng khuẩn tự nhiên.' }),
  P({ cat: 'Đệm Cao Su', name: 'Đệm Cao Su Organic HP Pure Nature', brand: 'HP Premium', price: 19900000, sale: 14490000, thickness: '20cm', firmness: 3, warranty: '20 năm', badge: 'Cao cấp', featured: 1, imgs: [19, 25, 11], sold: 128, short: 'Chứng nhận Organic, vỏ Tencel lạnh, lỗ thoáng khí xuyên suốt.' }),
  P({ cat: 'Đệm Cao Su', name: 'Đệm Cao Su Gấp 3 HP Flexi', brand: 'HP Basic', price: 8900000, sale: 6590000, thickness: '10cm', firmness: 3, warranty: '10 năm', imgs: [11, 25], sold: 205, short: 'Gấp 3 tiện di chuyển, phù hợp căn hộ, phòng trọ cao cấp.' }),
  P({ cat: 'Đệm Lò Xo', name: 'Đệm Lò Xo Túi Độc Lập HP Royal Dream', brand: 'HP Premium', price: 18500000, sale: 12950000, thickness: '28cm', firmness: 3, warranty: '10 năm', badge: 'Hot', featured: 1, hot: 1, imgs: [5, 16, 4], sold: 276, short: '1.200 lò xo túi độc lập, viền cứng chống lún mép, lớp gel làm mát.' }),
  P({ cat: 'Đệm Lò Xo', name: 'Đệm Lò Xo Memory Foam HP Eco Sleep', brand: 'HP Premium', price: 13900000, sale: 9450000, thickness: '25cm', firmness: 2, warranty: '10 năm', featured: 1, imgs: [16, 5, 22], sold: 189, short: 'Kết hợp lò xo túi và memory foam, êm ái ôm sát nhưng vẫn đàn hồi.' }),
  P({ cat: 'Đệm Lò Xo', name: 'Đệm Lò Xo Khách Sạn HP Grand Hotel', brand: 'HP Hotel', price: 16900000, sale: 0, thickness: '30cm', firmness: 3, warranty: '10 năm', badge: 'Chuẩn 5 sao', featured: 1, imgs: [4, 18, 17], sold: 98, short: 'Tiêu chuẩn khách sạn 5 sao, pillow-top dày, bền bỉ tần suất cao.' }),
  P({ cat: 'Đệm Foam', name: 'Đệm Memory Foam HP Cool Gel', brand: 'HP Premium', price: 9900000, sale: 6890000, thickness: '20cm', firmness: 2, warranty: '10 năm', badge: 'Mát lạnh', featured: 1, hot: 1, imgs: [12, 22, 3], sold: 341, short: 'Memory foam hạt gel làm mát, giảm 30% nhiệt tích tụ, êm như mây.' }),
  P({ cat: 'Đệm Foam', name: 'Đệm Foam Cuộn Hút Chân Không HP Cloud Box', brand: 'HP Basic', price: 6500000, sale: 4290000, thickness: '22cm', firmness: 3, warranty: '7 năm', hot: 1, imgs: [22, 12], sold: 420, short: 'Giao tận nhà trong hộp nhỏ gọn, nở đủ form sau 24 giờ.' }),
  P({ cat: 'Đệm Foam', name: 'Đệm Foam Massage HP Ortho Care', brand: 'HP Premium', price: 11900000, sale: 8990000, thickness: '18cm', firmness: 4, warranty: '10 năm', badge: 'Cho người đau lưng', featured: 1, imgs: [3, 12], sold: 156, short: 'Mặt gai massage, độ cứng vừa – cứng, hỗ trợ người đau lưng, thoát vị.' }),
  P({ cat: 'Chăn Ga Gối', name: 'Bộ Chăn Ga Gối Tencel 60s HP Silk Touch', brand: 'HP Home', price: 3590000, sale: 2490000, firmness: 0, warranty: '1 năm', badge: 'Mới', featured: 1, hot: 1, imgs: [1, 9, 7], sold: 233, bedding: true, short: 'Tencel 60s mềm mượt như lụa, mát lạnh, không phai màu sau 100 lần giặt.' }),
  P({ cat: 'Chăn Ga Gối', name: 'Bộ Chăn Ga Cotton Lụa HP Classic', brand: 'HP Home', price: 2490000, sale: 1790000, firmness: 0, warranty: '1 năm', imgs: [9, 1], sold: 198, bedding: true, short: 'Cotton lụa 100% thấm hút tốt, hoạ tiết thanh lịch.' }),
  P({ cat: 'Chăn Lông Cừu', name: 'Chăn Lông Cừu Úc HP Merino Warm', brand: 'HP Home', price: 4290000, sale: 3190000, firmness: 0, warranty: '2 năm', badge: 'Mùa đông', featured: 1, imgs: [8, 1], sold: 87, bedding: true, short: 'Lông cừu Merino Úc, ấm mà nhẹ, điều hoà độ ẩm tự nhiên.' }),
  P({ cat: 'Gối Ngủ', name: 'Gối Cao Su Non Công Thái Học HP Neck Care', brand: 'HP Home', price: 890000, sale: 590000, firmness: 0, warranty: '2 năm', hot: 1, imgs: [6, 7], sold: 640, pillow: true, short: 'Thiết kế lượn sóng nâng đỡ đốt sống cổ, giảm ngáy, chống mỏi vai gáy.' }),
  P({ cat: 'Gối Ngủ', name: 'Gối Lông Vũ Khách Sạn HP Feather', brand: 'HP Hotel', price: 1290000, sale: 990000, firmness: 0, warranty: '1 năm', featured: 1, imgs: [7, 6], sold: 275, pillow: true, short: 'Lông vũ nhân tạo cao cấp, bồng bềnh như gối khách sạn 5 sao.' }),
  P({ cat: 'Phụ Kiện', name: 'Topper Làm Mềm Đệm HP Soft Layer', brand: 'HP Home', price: 2490000, sale: 1690000, thickness: '5cm', firmness: 1, warranty: '3 năm', imgs: [12, 3], sold: 166, short: 'Làm mềm đệm cứng ngay lập tức, kéo dài tuổi thọ đệm.' }),
  P({ cat: 'Phụ Kiện', name: 'Tấm Bảo Vệ Đệm Chống Thấm HP Guard', brand: 'HP Home', price: 690000, sale: 490000, firmness: 0, warranty: '1 năm', imgs: [9, 2], sold: 455, short: 'Chống thấm nước, chống mạt bụi, giặt máy thoải mái.' }),
  P({ cat: 'Dự Án Khách Sạn', name: 'Combo Đệm + Chăn Ga Khách Sạn HP Hotel Set', brand: 'HP Hotel', price: 12900000, sale: 0, thickness: '25cm', firmness: 3, warranty: '10 năm', badge: 'Giá dự án', imgs: [17, 18, 20, 10], sold: 64, short: 'Trọn bộ đệm lò xo + chăn ga trắng khách sạn. Báo giá riêng cho đơn số lượng.' }),
];

function descFor(p) {
  return `<h3>Vì sao nên chọn ${p.name}?</h3>
<p>${p.short} Sản phẩm được Kho Đệm HP nhập trực tiếp từ nhà máy nên giá luôn tốt hơn thị trường, kèm đầy đủ phiếu bảo hành chính hãng.</p>
<ul>
<li><strong>Nâng đỡ chuẩn:</strong> phân bổ đều trọng lượng, giữ cột sống ở tư thế tự nhiên.</li>
<li><strong>Thoáng mát:</strong> cấu trúc thoáng khí, phù hợp khí hậu nóng ẩm Việt Nam.</li>
<li><strong>An toàn:</strong> vật liệu đạt chứng nhận, không mùi hoá chất, an toàn cho trẻ nhỏ.</li>
<li><strong>Dễ vệ sinh:</strong> vỏ có khoá kéo, tháo giặt dễ dàng.</li>
</ul>
<h3>Chính sách khi mua tại Kho Đệm HP</h3>
<p>Giao hàng – lắp đặt miễn phí nội thành, nằm thử 30 đêm, đổi size miễn phí trong 7 ngày, hỗ trợ trả góp 0% qua thẻ tín dụng.</p>`;
}

function specsFor(p) {
  const s = [['Thương hiệu', p.brand], ['Bảo hành', p.warranty]];
  if (p.thickness) s.push(['Độ dày', p.thickness]);
  if (p.firmness) s.push(['Độ cứng', ['', 'Mềm', 'Mềm vừa', 'Vừa', 'Cứng vừa', 'Cứng'][p.firmness]]);
  s.push(['Xuất xứ', 'Việt Nam'], ['Vỏ bọc', p.bedding ? 'Tencel / Cotton cao cấp' : 'Vải gấm chần bông, có khoá kéo']);
  return s;
}

function sizesOf(p) {
  if (p.pillow) return [{ label: '45 x 65cm', price: p.price, sale_price: p.sale }, { label: '50 x 70cm', price: Math.round(p.price * 1.15 / 10000) * 10000, sale_price: p.sale ? Math.round(p.sale * 1.15 / 10000) * 10000 : 0 }];
  if (p.bedding) return [{ label: '1m6 x 2m', price: p.price, sale_price: p.sale }, { label: '1m8 x 2m', price: Math.round(p.price * 1.1 / 10000) * 10000, sale_price: p.sale ? Math.round(p.sale * 1.1 / 10000) * 10000 : 0 }, { label: '2m x 2m2', price: Math.round(p.price * 1.2 / 10000) * 10000, sale_price: p.sale ? Math.round(p.sale * 1.2 / 10000) * 10000 : 0 }];
  if (p.price < 1000000) return [];
  return sizesFor(p.price, p.sale);
}

const BANNERS = [
  { position: 'main', eyebrow: 'Siêu sale cuối năm', title: 'Giảm đến 50% toàn bộ đệm', subtitle: 'Tặng kèm bộ chăn ga Tencel trị giá 2.490.000₫ cho đơn từ 10 triệu', cta: 'Mua ngay', image: img(18), link: '/khuyen-mai', theme: 'dark' },
  { position: 'main', eyebrow: 'Đệm cao su thiên nhiên', title: 'Giấc ngủ sâu, tỉnh dậy nhẹ nhõm', subtitle: 'Cao su 100% – bảo hành 15 năm – nằm thử 30 đêm', cta: 'Khám phá', image: img(25), link: '/danh-muc/dem-cao-su', theme: 'light' },
  { position: 'main', eyebrow: 'Lò xo túi độc lập', title: 'Chuẩn khách sạn 5 sao tại nhà', subtitle: 'Royal Dream – 1.200 lò xo, gel làm mát, viền chống lún', cta: 'Xem bộ sưu tập', image: img(4), link: '/danh-muc/dem-lo-xo', theme: 'dark' },
  { position: 'side', eyebrow: 'Giảm 30%', title: 'Đệm cao su Organic', subtitle: 'Kháng khuẩn – thoáng mát', cta: 'Xem ngay', image: img(19), link: '/danh-muc/dem-cao-su', theme: 'light' },
  { position: 'side', eyebrow: 'Mới về', title: 'Chăn ga Tencel 60s', subtitle: 'Mát lạnh như lụa', cta: 'Xem ngay', image: img(7), link: '/danh-muc/chan-ga-goi', theme: 'light' },
  { position: 'side', eyebrow: 'Dự án', title: 'Trọn gói khách sạn', subtitle: 'Báo giá trong 2 giờ', cta: 'Nhận báo giá', image: img(17), link: '/du-an-khach-san', theme: 'dark' },
];

const POSTS = [
  { title: 'Cách chọn đệm phù hợp cho người đau lưng', image: img(3), excerpt: 'Người đau lưng nên nằm đệm cứng hay mềm? Chuyên gia của Kho Đệm HP giải đáp chi tiết và gợi ý 3 dòng đệm phù hợp nhất.' },
  { title: 'Đệm cao su hay đệm lò xo: nên mua loại nào?', image: img(25), excerpt: 'So sánh độ bền, độ thoáng, giá thành và cảm giác nằm giữa đệm cao su thiên nhiên và đệm lò xo túi độc lập.' },
  { title: '5 mẹo vệ sinh đệm tại nhà đúng cách', image: img(11), excerpt: 'Giữ đệm luôn sạch, thơm và bền lâu với 5 mẹo đơn giản ai cũng làm được, không cần dịch vụ.' },
  { title: 'Kích thước đệm tiêu chuẩn tại Việt Nam', image: img(12), excerpt: 'Bảng kích thước đệm 1m2, 1m4, 1m6, 1m8, 2m2 và cách chọn size phù hợp với giường và số người nằm.' },
];

const postContent = (p) => `<p>${p.excerpt}</p>
<h2>1. Hiểu nhu cầu của bạn</h2>
<p>Mỗi người có tư thế ngủ, cân nặng và thói quen khác nhau. Người nằm nghiêng thường hợp đệm mềm vừa để vai và hông lún vừa đủ; người nằm ngửa và nằm sấp nên chọn đệm vừa đến cứng vừa để giữ cột sống thẳng.</p>
<h2>2. Chú ý chất liệu</h2>
<p>Cao su thiên nhiên bền và thoáng; lò xo túi độc lập nâng đỡ tốt và không truyền chuyển động; memory foam ôm sát, giảm áp lực. Hãy nằm thử ít nhất 10–15 phút tại showroom trước khi quyết định.</p>
<h2>3. Đừng bỏ qua chính sách</h2>
<p>Bảo hành, nằm thử, đổi trả là những yếu tố giúp bạn yên tâm. Tại Kho Đệm HP, bạn được nằm thử 30 đêm và đổi size miễn phí trong 7 ngày.</p>
<blockquote>Cần tư vấn nhanh? Gọi hotline hoặc nhắn Zalo để được chuyên viên hỗ trợ miễn phí.</blockquote>`;

async function wipe() {
  for (const t of ['products', 'categories', 'banners', 'posts', 'orders', 'leads']) await db.run(`DELETE FROM ${t}`);
}

async function seed() {
  const catIds = {};
  let i = 0;
  for (const c of CATEGORIES) {
    const r = await db.run('INSERT INTO categories (name, slug, description, image, sort, active) VALUES (?,?,?,?,?,1)', [c.name, slugify(c.name), c.desc, c.image, i++]);
    catIds[c.name] = r.insertId;
  }
  let k = 0;
  for (const p of PRODUCTS) {
    const sizes = sizesOf(p);
    const base = cheapestSize(sizes); // giá "Từ …" = biến thể rẻ nhất
    await db.run(
      `INSERT INTO products (category_id, name, slug, brand, sku, price, sale_price, short_desc, description, specs, sizes, images, thickness, firmness, warranty, badge, is_featured, is_hot, in_stock, active, rating_avg, rating_count, sold, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,?,?,?)`,
      [
        catIds[p.cat], p.name, slugify(p.name), p.brand, 'HP' + String(1001 + k), base ? base.price : p.price, base ? base.sale_price : p.sale,
        p.short, descFor(p), JSON.stringify(specsFor(p)), JSON.stringify(sizes), JSON.stringify(p.imgs.map(img)),
        p.thickness || '', p.firmness || 0, p.warranty || '', p.badge || '', p.featured ? 1 : 0, p.hot ? 1 : 0,
        (4.6 + ((k * 7) % 5) / 10).toFixed(1), 20 + ((k * 37) % 180), p.sold || 0, now(),
      ]
    );
    k++;
  }
  let b = 0;
  for (const x of BANNERS) {
    await db.run('INSERT INTO banners (position, eyebrow, title, subtitle, cta, image, link, theme, sort, active) VALUES (?,?,?,?,?,?,?,?,?,1)', [x.position, x.eyebrow, x.title, x.subtitle, x.cta, x.image, x.link, x.theme, b++]);
  }
  for (const p of POSTS) {
    await db.run('INSERT INTO posts (title, slug, excerpt, content, image, active, created_at) VALUES (?,?,?,?,?,1,?)', [p.title, slugify(p.title), p.excerpt, postContent(p), p.image, now()]);
  }
}

async function ensureAdmin() {
  const a = await db.one('SELECT id FROM admins LIMIT 1');
  if (a) return;
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASSWORD || 'khodemhp@2026';
  await db.run('INSERT INTO admins (username, password_hash, created_at) VALUES (?,?,?)', [user, bcrypt.hashSync(pass, 10), now()]);
  console.log(`Đã tạo tài khoản admin "${user}". Hãy đổi mật khẩu trong trang quản trị.`);
}

async function seedIfEmpty() {
  await ensureAdmin();
  const c = await db.one('SELECT COUNT(*) AS n FROM categories');
  if (Number(c.n) === 0) {
    await seed();
    console.log('Đã nạp dữ liệu mẫu.');
  }
}

module.exports = { seedIfEmpty };

if (require.main === module) {
  require('dotenv').config();
  (async () => {
    await db.init();
    await require('./schema').migrate();
    if (process.argv.includes('--force')) await wipe();
    await seedIfEmpty();
    process.exit(0);
  })();
}
