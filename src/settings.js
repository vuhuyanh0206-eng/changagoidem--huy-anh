const db = require('./db');

const DEFAULTS = {
  site_name: 'Đệm 191',
  tagline: 'Chăn ga gối đệm chính hãng – Giá tại kho',
  hotline: '0988 367 226',
  hotline2: '0912 831 034',
  zalo: '0988367226',
  email: '',
  address: '191 Tôn Đức Thắng, Lê Chân, Hải Phòng | 172 Đà Nẵng, Ngô Quyền, Hải Phòng',
  map_embed: '',
  open_hours: '8:00 – 21:00 tất cả các ngày',
  facebook: '',
  free_ship_text: 'Vận chuyển toàn quốc, miễn phí cho đơn hàng có bán kính dưới 20km tính từ shop',
  shipping_fee: '0',
  free_ship_min: '0',
  bank_code: '',
  bank_account: '',
  bank_holder: '',
  meta_description:
    'Đệm 191 – chuyên đệm cao su, đệm lò xo, đệm foam, chăn ga gối chính hãng giá tại kho. Giao nhanh, quà tặng cao cấp, bảo hành chính hãng.',
  ga_id: '',
  fb_pixel: '2086145585500475', // Meta Pixel / tập dữ liệu "sản phẩm 2026" (nối với danh mục Catalog_Products)
  flash_sale_end: '2026-12-05T23:59',
  // Popup nhận voucher (bật = '1', tắt = '0')
  voucher_on: '1',
  voucher_value: '200.000đ',
  voucher_title: 'Nhận voucher ưu đãi khi mua đệm',
  voucher_sub: 'Để lại thông tin, Đệm 191 gửi voucher và tư vấn chọn đệm miễn phí cho bạn.',
  // Thông tin chủ sở hữu website (bắt buộc hiển thị theo NĐ 52/2013, NĐ 85/2021)
  biz_name: '',        // Tên hộ kinh doanh / công ty trên giấy ĐKKD
  biz_reg_no: '',      // Số giấy chứng nhận ĐKKD
  biz_reg_date: '',    // Ngày cấp
  biz_reg_place: '',   // Nơi cấp
  biz_tax_code: '',    // Mã số thuế
  biz_rep: '',         // Người đại diện / chủ hộ
  biz_address: '',     // Địa chỉ trụ sở (để trống = địa chỉ đầu tiên của cửa hàng)
  bct_url: '',         // Link xác thực "Đã thông báo Bộ Công Thương" (dán sau khi được duyệt)
  return_days: '7',    // Số ngày đổi trả
};

let cache = null;

async function all() {
  if (cache) return cache;
  const rows = await db.query('SELECT skey, svalue FROM settings');
  const map = { ...DEFAULTS };
  for (const r of rows) map[r.skey] = r.svalue ?? '';
  if (!String(map.fb_pixel || '').trim()) map.fb_pixel = DEFAULTS.fb_pixel; // ô Pixel để trống trong admin thì dùng Pixel mặc định
  cache = map;
  return map;
}

async function save(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (!(k in DEFAULTS)) continue;
    const exists = await db.one('SELECT skey FROM settings WHERE skey = ?', [k]);
    if (exists) await db.run('UPDATE settings SET svalue = ? WHERE skey = ?', [String(v ?? ''), k]);
    else await db.run('INSERT INTO settings (skey, svalue) VALUES (?, ?)', [k, String(v ?? '')]);
  }
  cache = null;
}

module.exports = { all, save, DEFAULTS };
