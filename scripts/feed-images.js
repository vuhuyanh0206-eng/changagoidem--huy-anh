/**
 * Tạo ảnh có in sẵn nhãn cho băng chuyền Facebook (danh mục sản phẩm).
 *
 * Cách chạy (trên máy Mac, cần Google Chrome):
 *   1. npm run dev            (mở web trên máy ở http://localhost:3000)
 *   2. npm run feed-images    (ở cửa sổ khác)
 *   3. Commit & push thư mục public/images/feed
 *
 * Chạy lại mỗi khi thêm sản phẩm đệm mới hoặc đổi bảo hành / độ dày / ảnh chính.
 * Ảnh lưu ở public/images/feed/<slug>.jpg; feed /feed/facebook.csv tự dùng ảnh này làm ảnh chính.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const db = require('../src/db');
const { hydrateProduct } = require('../src/utils');

const run = promisify(execFile);
const BASE = process.env.LABEL_BASE || 'http://localhost:3000';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, '..', 'public', 'images', 'feed');
const ONLY = process.argv.slice(2); // tuỳ chọn: chỉ tạo cho các slug này

async function shoot(p, tmp) {
  const png = path.join(tmp, `${p.slug}.png`);
  await run(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${path.join(tmp, 'profile-' + p.id)}`,
    '--window-size=1080,1080', '--virtual-time-budget=4000', `--screenshot=${png}`,
    `${BASE}/feed/label/${p.id}`,
  ], { timeout: 60000 });
  // PNG -> JPG chất lượng 85 bằng công cụ có sẵn trên macOS
  await run('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', png, '--out', path.join(OUT, `${p.slug}.jpg`)]);
}

(async () => {
  await db.init();
  const r = await fetch(`${BASE}/`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Không mở được ${BASE} – hãy chạy "npm run dev" trước.`);
  fs.mkdirSync(OUT, { recursive: true });
  const rows = await db.query(
    `SELECT p.*, (SELECT c.name FROM categories c WHERE c.id = p.category_id) AS cat_name, (SELECT c.slug FROM categories c WHERE c.id = p.category_id) AS cat_slug
     FROM products p WHERE p.active = 1 ORDER BY p.id`
  );
  const list = rows
    .map(hydrateProduct)
    .filter((p) => p.imgLabel && p.finalPrice > 0 && p.images.some((i) => !/placeholder/.test(i)))
    .filter((p) => !ONLY.length || ONLY.includes(p.slug));
  const keep = new Set(list.map((p) => `${p.slug}.jpg`));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feedimg-'));
  console.log(`Tạo ${list.length} ảnh vào ${path.relative(process.cwd(), OUT)} …`);
  let done = 0;
  const queue = [...list];
  const worker = async () => {
    for (let p; (p = queue.shift()); ) {
      try {
        await shoot(p, tmp).catch(() => shoot(p, tmp)); // Chrome thỉnh thoảng lỗi khi chạy song song: thử lại 1 lần
        console.log(`✓ ${++done}/${list.length} ${p.slug}`);
      } catch (e) {
        console.error(`✗ ${p.slug}: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  // Xoá ảnh của sản phẩm đã ẩn / đổi slug (chỉ khi tạo toàn bộ)
  if (!ONLY.length) for (const f of fs.readdirSync(OUT)) if (f.endsWith('.jpg') && !keep.has(f)) fs.unlinkSync(path.join(OUT, f));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('Xong. Nhớ commit & push thư mục public/images/feed.');
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
