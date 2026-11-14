const express = require('express');
const catalog = require('../catalog');
const settings = require('../settings');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get(
  '/search',
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q.length < 2) return res.json([]);
    const items = await catalog.list({ where: ['(p.name LIKE ? OR p.brand LIKE ?)'], params: [`%${q}%`, `%${q}%`], order: 'p.sold DESC', limit: 6 });
    res.json(items.map((p) => ({ name: p.name, slug: p.slug, image: p.image, price: p.finalPrice, oldPrice: p.discount ? p.price : 0 })));
  })
);

router.post(
  '/cart',
  wrap(async (req, res) => {
    const cart = await catalog.priceCart(req.body.items);
    const s = await settings.all();
    const shipping = catalog.shippingFee(cart.subtotal, s);
    res.json({ ...cart, shipping, total: cart.subtotal + shipping });
  })
);

module.exports = router;
