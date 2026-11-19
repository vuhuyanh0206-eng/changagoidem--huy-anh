/** Tạo bảng nếu chưa có — chạy tự động mỗi lần khởi động server. */
const db = require('./db');

function ddl(d) {
  const id = d === 'mysql' ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const text = d === 'mysql' ? 'MEDIUMTEXT' : 'TEXT';
  const tail = d === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
  return `
CREATE TABLE IF NOT EXISTS categories (
  id ${id},
  parent_id INT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(190) NOT NULL UNIQUE,
  description TEXT,
  image VARCHAR(255),
  sort INT DEFAULT 0,
  active INT DEFAULT 1
)${tail};
CREATE TABLE IF NOT EXISTS products (
  id ${id},
  category_id INT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  brand VARCHAR(120),
  sku VARCHAR(80),
  price INT DEFAULT 0,
  sale_price INT DEFAULT 0,
  short_desc TEXT,
  description ${text},
  specs TEXT,
  sizes TEXT,
  images TEXT,
  thickness VARCHAR(40),
  firmness INT DEFAULT 3,
  warranty VARCHAR(60),
  badge VARCHAR(60),
  gift VARCHAR(255) DEFAULT '',
  is_featured INT DEFAULT 0,
  is_hot INT DEFAULT 0,
  in_stock INT DEFAULT 1,
  active INT DEFAULT 1,
  rating_avg DECIMAL(2,1) DEFAULT 5.0,
  rating_count INT DEFAULT 0,
  sold INT DEFAULT 0,
  views INT DEFAULT 0,
  created_at VARCHAR(30)
)${tail};
CREATE TABLE IF NOT EXISTS banners (
  id ${id},
  position VARCHAR(20) DEFAULT 'main',
  eyebrow VARCHAR(120),
  title VARCHAR(200),
  subtitle VARCHAR(255),
  cta VARCHAR(60),
  image VARCHAR(255),
  link VARCHAR(255),
  theme VARCHAR(20) DEFAULT 'dark',
  sort INT DEFAULT 0,
  active INT DEFAULT 1
)${tail};
CREATE TABLE IF NOT EXISTS orders (
  id ${id},
  code VARCHAR(30) NOT NULL UNIQUE,
  customer_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(160),
  address VARCHAR(255) NOT NULL,
  province VARCHAR(120),
  note TEXT,
  payment_method VARCHAR(20) DEFAULT 'cod',
  items TEXT,
  subtotal INT DEFAULT 0,
  shipping INT DEFAULT 0,
  total INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'new',
  created_at VARCHAR(30)
)${tail};
CREATE TABLE IF NOT EXISTS posts (
  id ${id},
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT,
  content ${text},
  image VARCHAR(255),
  active INT DEFAULT 1,
  created_at VARCHAR(30)
)${tail};
CREATE TABLE IF NOT EXISTS leads (
  id ${id},
  name VARCHAR(160),
  phone VARCHAR(30),
  message TEXT,
  source VARCHAR(60),
  handled INT DEFAULT 0,
  created_at VARCHAR(30)
)${tail};
CREATE TABLE IF NOT EXISTS settings (
  skey VARCHAR(80) PRIMARY KEY,
  svalue TEXT
)${tail};
CREATE TABLE IF NOT EXISTS admins (
  id ${id},
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(120) NOT NULL,
  created_at VARCHAR(30)
)${tail}
`;
}

// Cột thêm sau khi đã có CSDL: tự ALTER nếu thiếu (bỏ qua lỗi "đã tồn tại")
const ADDED_COLUMNS = [
  ['products', 'gift', "VARCHAR(255) DEFAULT ''"],
  ['products', 'pin', 'INT DEFAULT 0'], // ưu tiên hiển thị trong danh mục (lớn hơn lên trước)
  ['products', 'best', 'INT DEFAULT 0'], // thứ hạng bán chạy (lớn hơn lên trước)
];

async function migrate() {
  await db.exec(ddl(db.dialect));
  for (const [table, col, type] of ADDED_COLUMNS) {
    try {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  }
}

module.exports = { migrate };
