/**
 * Lớp truy cập CSDL mỏng, hỗ trợ 2 driver:
 *  - MySQL (mysql2)        → production trên Hostinger (khi có DB_HOST)
 *  - SQLite (node:sqlite)  → chạy thử trên máy, không cần cài gì thêm
 * Mọi câu SQL trong dự án dùng cú pháp chung cho cả hai (placeholder "?").
 */
const path = require('path');
const fs = require('fs');

let driver = null;
let dialect = null;

async function init() {
  if (driver) return;
  if (process.env.DB_HOST) {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
    });
    dialect = 'mysql';
    driver = {
      async query(sql, params = []) {
        const [rows] = await pool.query(sql, params);
        return rows;
      },
      async run(sql, params = []) {
        const [res] = await pool.query(sql, params);
        return { insertId: res.insertId, changes: res.affectedRows };
      },
      async exec(sql) {
        for (const stmt of splitStatements(sql)) await pool.query(stmt);
      },
    };
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const dir = path.join(__dirname, '..', 'data');
    fs.mkdirSync(dir, { recursive: true });
    // timeout: chờ tối đa 10s khi CSDL đang bận (VD: 2 tiến trình cùng mở) thay vì lỗi "database is locked"
    const db = new DatabaseSync(path.join(dir, 'khodem.db'), { timeout: 10000 });
    db.exec('PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    dialect = 'sqlite';
    const norm = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
    driver = {
      async query(sql, params = []) {
        return db.prepare(sql).all(...norm(params)).map((r) => ({ ...r }));
      },
      async run(sql, params = []) {
        const res = db.prepare(sql).run(...norm(params));
        return { insertId: Number(res.lastInsertRowid), changes: Number(res.changes) };
      },
      async exec(sql) {
        db.exec(sql);
      },
    };
  }
}

function splitStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  init,
  get dialect() {
    return dialect;
  },
  query: (sql, params) => driver.query(sql, params),
  one: async (sql, params) => (await driver.query(sql, params))[0] || null,
  run: (sql, params) => driver.run(sql, params),
  exec: (sql) => driver.exec(sql),
};
