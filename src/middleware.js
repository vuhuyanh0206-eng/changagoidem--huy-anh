const crypto = require('crypto');
const db = require('./db');
const settings = require('./settings');
const { vnd, escapeHtml } = require('./utils');

let menuCache = null;
let menuCacheAt = 0;

async function getMenu() {
  if (menuCache && Date.now() - menuCacheAt < 60_000) return menuCache;
  const cats = await db.query('SELECT id, parent_id, name, slug, image FROM categories WHERE active = 1 ORDER BY sort, id');
  const roots = cats.filter((c) => !c.parent_id).map((c) => ({ ...c, children: cats.filter((x) => x.parent_id === c.id) }));
  menuCache = roots;
  menuCacheAt = Date.now();
  return roots;
}
function clearMenuCache() {
  menuCache = null;
}

async function locals(req, res, next) {
  try {
    if (!req.session.csrf) req.session.csrf = crypto.randomBytes(18).toString('hex');
    res.locals.csrfToken = req.session.csrf;
    res.locals.s = await settings.all();
    res.locals.vnd = vnd;
    res.locals.esc = escapeHtml;
    res.locals.path = req.path;
    res.locals.query = req.query;
    res.locals.siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    res.locals.admin = req.session.adminId ? { id: req.session.adminId, username: req.session.adminName } : null;
    res.locals.flash = req.session.flash || null;
    req.session.flash = null;
    if (!req.path.startsWith('/admin') && !req.path.startsWith('/api')) res.locals.menu = await getMenu();
    next();
  } catch (e) {
    next(e);
  }
}

/** CSRF cho mọi request POST (form + fetch). Route multipart gọi lại verifyCsrf sau khi multer đọc body. */
function csrf(req, res, next) {
  if (req.method !== 'POST') return next();
  if ((req.headers['content-type'] || '').startsWith('multipart/form-data')) return next();
  return verifyCsrf(req, res, next);
}
function verifyCsrf(req, res, next) {
  const token = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (token && req.session.csrf && token === req.session.csrf) return next();
  const err = new Error('Invalid CSRF token');
  err.code = 'EBADCSRFTOKEN';
  next(err);
}

function requireAdmin(req, res, next) {
  if (req.session.adminId) return next();
  res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
}

module.exports = { locals, csrf, verifyCsrf, requireAdmin, getMenu, clearMenuCache };
