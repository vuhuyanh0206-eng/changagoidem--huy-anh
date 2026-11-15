/* Kho Đệm HP – storefront interactions (vanilla JS, không phụ thuộc thư viện) */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const vnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + '₫';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Cart store (localStorage) ---------------- */
  const KEY = 'khp_cart_v1';
  const Cart = {
    read() {
      try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
    },
    write(items) {
      try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
      Cart.sync();
    },
    add(id, size = '', qty = 1) {
      const items = Cart.read();
      const hit = items.find((i) => i.id === id && i.size === size);
      if (hit) hit.qty = Math.min(99, hit.qty + qty);
      else items.push({ id, size, qty });
      Cart.write(items);
    },
    setQty(id, size, qty) {
      const items = Cart.read().map((i) => (i.id === id && i.size === size ? { ...i, qty: Math.max(1, Math.min(99, qty)) } : i));
      Cart.write(items);
    },
    remove(id, size) {
      Cart.write(Cart.read().filter((i) => !(i.id === id && i.size === size)));
    },
    clear() { Cart.write([]); },
    count() { return Cart.read().reduce((a, i) => a + i.qty, 0); },
    async price() {
      const items = Cart.read();
      if (!items.length) return { lines: [], subtotal: 0, shipping: 0, total: 0 };
      const r = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.KHP.csrf }, body: JSON.stringify({ items }) });
      if (!r.ok) throw new Error('cart');
      return r.json();
    },
    async sync() {
      const n = Cart.count();
      $$('[data-cart-count]').forEach((el) => {
        el.textContent = n;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      });
      $$('[data-cart-count-text]').forEach((el) => (el.textContent = n ? `(${n} sản phẩm)` : ''));
      try {
        const data = await Cart.price();
        $$('[data-cart-total]').forEach((el) => (el.textContent = vnd(data.subtotal)));
        document.dispatchEvent(new CustomEvent('cart:priced', { detail: data }));
      } catch {}
    },
  };
  window.KHPCart = Cart;

  /* ---------------- Toast ---------------- */
  let toastT;
  function toast(html) {
    const t = $('[data-toast]');
    if (!t) return;
    t.innerHTML = `<svg class="i"><use href="#i-check"/></svg><span>${html}</span>`;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.hidden = true), 3200);
  }

  /* ---------------- Drawers ---------------- */
  const scrim = $('[data-scrim]');
  let lastFocus = null;
  function openDrawer(id) {
    const d = document.getElementById(id);
    if (!d) return;
    lastFocus = document.activeElement;
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    scrim.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('[data-close]', d)?.focus(), 50);
    if (id === 'drawer-cart') renderMiniCart();
  }
  function closeDrawers() {
    $$('.drawer.is-open, .filters.is-open').forEach((d) => {
      d.classList.remove('is-open');
      d.setAttribute('aria-hidden', 'true');
    });
    scrim.hidden = true;
    document.body.style.overflow = '';
    lastFocus?.focus?.();
  }
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      // Trên trang giỏ hàng thì đi thẳng tới trang, không mở drawer
      if (opener.dataset.open === 'drawer-cart' && location.pathname === '/gio-hang') return;
      e.preventDefault();
      openDrawer(opener.dataset.open);
    }
    if (e.target.closest('[data-close]') || e.target === scrim) closeDrawers();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawers();
      closeCat();
    }
  });

  /* ---------------- Mini cart ---------------- */
  async function renderMiniCart() {
    const body = $('[data-mini-cart]');
    const foot = $('[data-mini-cart-foot]');
    if (!body) return;
    const data = await Cart.price().catch(() => ({ lines: [] }));
    if (!data.lines.length) {
      body.innerHTML = `<div class="empty"><div class="empty__ico"><svg class="i"><use href="#i-cart"/></svg></div><b>Giỏ hàng đang trống</b><p>Khám phá những mẫu đệm được yêu thích nhất.</p><a class="btn btn--navy" href="/dem">Mua sắm ngay</a></div>`;
      foot.hidden = true;
      return;
    }
    body.innerHTML = data.lines
      .map(
        (l) => `<div class="mini-line">
        <a href="/san-pham/${esc(l.slug)}"><img src="${esc(l.image)}" alt="" width="72" height="56"></a>
        <div><a href="/san-pham/${esc(l.slug)}"><b>${esc(l.name)}</b></a><small>${l.size ? esc(l.size) + ' · ' : ''}SL: ${l.qty}</small><div class="price__now">${vnd(l.total)}</div></div>
        <button class="mini-line__rm" type="button" data-rm="${l.id}" data-rm-size="${esc(l.size)}" aria-label="Xoá ${esc(l.name)}"><svg class="i"><use href="#i-trash"/></svg></button>
      </div>`
      )
      .join('');
    $('[data-mini-total]').textContent = vnd(data.subtotal);
    foot.hidden = false;
  }
  document.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (!rm) return;
    Cart.remove(Number(rm.dataset.rm), rm.dataset.rmSize || '');
    if (rm.closest('[data-mini-cart]')) renderMiniCart();
  });

  /* ---------------- Add to cart (card buttons) ---------------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add-cart]');
    if (!b) return;
    e.preventDefault();
    Cart.add(Number(b.dataset.id), b.dataset.size || '', 1);
    toast(`Đã thêm vào giỏ hàng <a href="/gio-hang" data-open="drawer-cart">Xem giỏ</a>`);
  });

  /* ---------------- Sticky header shadow + to-top ---------------- */
  const header = $('.header');
  const toTop = $('[data-to-top]');
  const onScroll = () => {
    const y = scrollY;
    header?.classList.toggle('is-stuck', y > 40);
    if (toTop) toTop.hidden = y < 700;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toTop?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* ---------------- Category dropdown (header button) ---------------- */
  const catBtn = $('[data-toggle-cat]');
  const megaCat = $('#mega-cat');
  function closeCat() {
    if (!megaCat || megaCat.hidden) return;
    megaCat.hidden = true;
    catBtn?.setAttribute('aria-expanded', 'false');
  }
  catBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Trang chủ đã có danh mục dọc → cuộn tới đó
    const heroCats = $('.hero__cats');
    if (heroCats && getComputedStyle(heroCats).display !== 'none') {
      heroCats.scrollIntoView({ behavior: 'smooth', block: 'center' });
      heroCats.animate?.([{ boxShadow: '0 0 0 0 rgba(217,168,72,.8)' }, { boxShadow: '0 0 0 8px rgba(217,168,72,0)' }], 800);
      return;
    }
    const open = megaCat.hidden;
    megaCat.hidden = !open;
    catBtn.setAttribute('aria-expanded', String(open));
    if (open) megaCat.style.top = header.getBoundingClientRect().bottom + scrollY + 'px';
  });
  document.addEventListener('click', (e) => {
    if (megaCat && !megaCat.hidden && !e.target.closest('#mega-cat')) closeCat();
  });

  /* ---------------- Search suggestions ---------------- */
  const sInput = $('[data-search]');
  const sBox = $('[data-suggest]');
  let sTimer, sCtrl, sIdx = -1;
  sInput?.addEventListener('input', () => {
    clearTimeout(sTimer);
    const q = sInput.value.trim();
    if (q.length < 2) {
      sBox.hidden = true;
      return;
    }
    sTimer = setTimeout(async () => {
      sCtrl?.abort();
      sCtrl = new AbortController();
      try {
        const r = await fetch('/api/search?q=' + encodeURIComponent(q), { signal: sCtrl.signal });
        const items = await r.json();
        sIdx = -1;
        sBox.innerHTML = items.length
          ? items.map((p) => `<a class="suggest__item" href="/san-pham/${esc(p.slug)}"><img src="${esc(p.image)}" alt=""><div><b>${esc(p.name)}</b><span>${p.price > 0 ? vnd(p.price) : 'Liên hệ'}${p.oldPrice ? `<s>${vnd(p.oldPrice)}</s>` : ''}</span></div></a>`).join('') +
            `<a class="suggest__all" href="/tim-kiem?q=${encodeURIComponent(q)}">Xem tất cả kết quả cho “${esc(q)}”</a>`
          : `<div class="suggest__empty">Không tìm thấy sản phẩm phù hợp. Thử “đệm cao su”, “gối”…</div>`;
        sBox.hidden = false;
      } catch {}
    }, 220);
  });
  sInput?.addEventListener('keydown', (e) => {
    const items = $$('.suggest__item', sBox);
    if (sBox.hidden || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sIdx = (sIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('is-focus', i === sIdx));
    } else if (e.key === 'Enter' && sIdx >= 0) {
      e.preventDefault();
      location.href = items[sIdx].href;
    }
  });
  document.addEventListener('click', (e) => {
    if (sBox && !e.target.closest('.search')) sBox.hidden = true;
  });

  /* ---------------- Hero slider ---------------- */
  $$('[data-slider]').forEach((root) => {
    const slides = $$('.slide', root);
    const dots = $$('[data-dot]', root);
    if (slides.length < 2) return;
    let i = 0, timer;
    const go = (n) => {
      slides[i].classList.remove('is-active');
      dots[i]?.classList.remove('is-active');
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('is-active');
      dots[i]?.classList.add('is-active');
    };
    const play = () => {
      if (reduceMotion) return;
      clearInterval(timer);
      timer = setInterval(() => go(i + 1), 5500);
    };
    $('[data-next]', root)?.addEventListener('click', () => { go(i + 1); play(); });
    $('[data-prev]', root)?.addEventListener('click', () => { go(i - 1); play(); });
    dots.forEach((d) => d.addEventListener('click', () => { go(Number(d.dataset.dot)); play(); }));
    root.addEventListener('mouseenter', () => clearInterval(timer));
    root.addEventListener('mouseleave', play);
    let x0 = null;
    root.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    root.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); play(); }
      x0 = null;
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(timer) : play()));
    play();
  });

  /* ---------------- Product rails ---------------- */
  $$('[data-rail]').forEach((rail) => {
    const track = $('.rail__track', rail);
    const prev = $('[data-rail-prev]', rail);
    const next = $('[data-rail-next]', rail);
    const update = () => {
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
    };
    const step = () => track.clientWidth * 0.8;
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', update, { passive: true });
    update();
  });

  /* ---------------- Tabs (featured) ---------------- */
  $$('[data-tabs]').forEach((tabs) => {
    const panel = tabs.closest('.section').querySelector('[data-tab-panel]');
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $$('button', tabs).forEach((x) => {
        x.classList.toggle('is-active', x === b);
        x.setAttribute('aria-selected', String(x === b));
      });
      const f = b.dataset.filter;
      $$('.pgrid__item', panel).forEach((it) => it.classList.toggle('is-hidden', f !== 'all' && it.dataset.cat !== f));
    });
  });

  /* ---------------- Countdown (flash sale) ---------------- */
  $$('[data-countdown]').forEach((el) => {
    let end = Date.parse(el.dataset.countdown);
    if (!end || end < Date.now()) {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      end = d.getTime();
    }
    const h = $('[data-h]', el), m = $('[data-m]', el), s = $('[data-s]', el);
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      h.textContent = pad(Math.floor(left / 3.6e6));
      m.textContent = pad(Math.floor((left % 3.6e6) / 6e4));
      s.textContent = pad(Math.floor((left % 6e4) / 1000));
    };
    tick();
    setInterval(tick, 1000);
  });

  /* ---------------- Reveal on scroll ---------------- */
  if ('IntersectionObserver' in window && !reduceMotion) {
    const targets = $$('.section__head, .cat-tile, .need__card, .story__media, .story__body, .review, .post-card, .hotel-band__text, .hotel-band__gallery, .value');
    targets.forEach((el) => el.classList.add('reveal'));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      }),
      { rootMargin: '0px 0px -8% 0px' }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* ---------------- Product detail ---------------- */
  const pd = $('[data-product]');
  if (pd) {
    const data = JSON.parse($('#product-data').textContent);
    const priceNow = $('[data-price-now]');
    const priceOld = $('[data-price-old]');
    const save = $('[data-price-save]');
    const sizeLabel = $('[data-size-label]');
    const qtyInput = $('[data-qty]', pd);
    const stickyPrice = $('[data-sticky-price]');
    const currentSize = () => ($('input[name="size"]:checked', pd) || {}).value || '';
    const renderPrice = () => {
      let price = data.price, sale = data.sale_price;
      const s = data.sizes.find((x) => x.label === currentSize());
      if (s) { price = s.price; sale = s.sale_price; }
      const final = sale > 0 && sale < price ? sale : price;
      const txt = final > 0 ? vnd(final) : 'Liên hệ báo giá';
      priceNow.textContent = txt;
      if (stickyPrice) stickyPrice.textContent = txt;
      if (sale > 0 && sale < price) {
        priceOld.textContent = vnd(price);
        priceOld.hidden = false;
        save.textContent = `Tiết kiệm ${vnd(price - sale)}`;
        save.hidden = false;
      } else {
        priceOld.hidden = true;
        save.hidden = true;
      }
      if (sizeLabel) sizeLabel.textContent = currentSize();
    };
    // Chọn 2 bước: độ dày → kích thước (chỉ hiện kích thước có ở độ dày đó)
    const dimLabel = $('[data-dim-label]');
    const thickLabel = $('[data-thick-label]');
    const syncDimLabel = () => {
      const s = currentSize().match(/^(\d+ x \d+)/);
      if (dimLabel) dimLabel.textContent = s ? s[1] + ' cm' : '';
    };
    $$('input[name="thick"]', pd).forEach((r) =>
      r.addEventListener('change', () => {
        const t = r.value;
        const prevDim = (currentSize().match(/^(\d+ x \d+)/) || [])[1];
        let pick = null;
        $$('[data-dims] .size', pd).forEach((lab) => {
          const on = lab.dataset.thick === t;
          lab.hidden = !on;
          const inp = $('input', lab);
          if (on && (!pick || inp.value.startsWith(prevDim + ' x '))) pick = inp;
        });
        if (pick) pick.checked = true;
        if (thickLabel) thickLabel.textContent = t + ' cm';
        syncDimLabel();
        renderPrice();
      })
    );
    $$('input[name="size"]', pd).forEach((r) => r.addEventListener('change', () => { syncDimLabel(); renderPrice(); }));
    syncDimLabel();
    renderPrice();
    pd.addEventListener('click', (e) => {
      const q = e.target.closest('[data-qty-step]');
      if (q) qtyInput.value = Math.max(1, Math.min(99, (parseInt(qtyInput.value, 10) || 1) + Number(q.dataset.qtyStep)));
      const add = e.target.closest('[data-pd-add]');
      if (add) {
        Cart.add(data.id, currentSize(), parseInt(qtyInput.value, 10) || 1);
        if (add.dataset.pdAdd === 'buy') location.href = '/thanh-toan';
        else toast(`Đã thêm vào giỏ hàng <a href="/gio-hang" data-open="drawer-cart">Xem giỏ</a>`);
      }
    });
    $('[data-sticky-add]')?.addEventListener('click', () => {
      Cart.add(data.id, currentSize(), 1);
      location.href = '/thanh-toan';
    });
    // Gallery
    const main = $('[data-gallery-main]');
    const mainImg = $('img', main);
    $$('[data-thumb]').forEach((t) =>
      t.addEventListener('click', () => {
        $$('[data-thumb]').forEach((x) => x.classList.toggle('is-active', x === t));
        mainImg.style.opacity = 0;
        setTimeout(() => { mainImg.src = t.dataset.thumb; mainImg.style.opacity = 1; }, 150);
      })
    );
    if (matchMedia('(hover: hover)').matches) {
      main.addEventListener('mousemove', (e) => {
        const r = main.getBoundingClientRect();
        mainImg.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      });
      main.addEventListener('click', () => main.classList.toggle('is-zoom'));
      main.addEventListener('mouseleave', () => main.classList.remove('is-zoom'));
    }
    // Tabs
    $$('[data-pd-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        $$('[data-pd-tab]').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', String(x === b)); });
        $$('[data-pd-panel]').forEach((p) => (p.hidden = p.dataset.pdPanel !== b.dataset.pdTab));
      })
    );
    // Sticky buy bar (mobile)
    const sticky = $('.sticky-buy');
    const buyBox = $('.pd__buy');
    if (sticky && buyBox && 'IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => sticky.classList.toggle('is-show', !en.isIntersecting && en.boundingClientRect.top < 0)).observe(buyBox);
    }
  }

  /* ---------------- Listing filters (mobile drawer + auto submit sort) ---------------- */
  $('[data-open-filters]')?.addEventListener('click', () => {
    $('.filters').classList.add('is-open');
    scrim.hidden = false;
    document.body.style.overflow = 'hidden';
  });
  $('[data-sort]')?.addEventListener('change', (e) => {
    const u = new URL(location.href);
    u.searchParams.set('sort', e.target.value);
    u.searchParams.delete('page');
    location.href = u.toString();
  });

  /* ---------------- Cart page ---------------- */
  const cartPage = $('[data-cart-page]');
  if (cartPage) {
    const render = async () => {
      const data = await Cart.price().catch(() => ({ lines: [], subtotal: 0, shipping: 0, total: 0 }));
      const list = $('[data-cart-lines]');
      if (!data.lines.length) {
        cartPage.innerHTML = `<div class="card empty" style="grid-column:1/-1"><div class="empty__ico"><svg class="i"><use href="#i-cart"/></svg></div><b>Giỏ hàng của bạn đang trống</b><p>Hàng trăm mẫu đệm, chăn ga gối chính hãng đang chờ bạn.</p><a class="btn btn--navy btn--lg" href="/dem">Tiếp tục mua sắm</a></div>`;
        return;
      }
      list.innerHTML = data.lines
        .map(
          (l) => `<div class="cart-line">
          <a href="/san-pham/${esc(l.slug)}"><img src="${esc(l.image)}" alt="" width="110" height="84"></a>
          <div>
            <a class="cart-line__name" href="/san-pham/${esc(l.slug)}">${esc(l.name)}</a>
            <div class="cart-line__meta">${l.size ? 'Kích thước: ' + esc(l.size) + ' · ' : ''}Đơn giá: ${vnd(l.unit)}</div>
            <div class="cart-line__actions">
              <div class="qty qty--sm"><button type="button" data-cq="-1" data-id="${l.id}" data-size="${esc(l.size)}" aria-label="Giảm"><svg class="i"><use href="#i-minus"/></svg></button><input value="${l.qty}" inputmode="numeric" aria-label="Số lượng" data-cqi data-id="${l.id}" data-size="${esc(l.size)}"><button type="button" data-cq="1" data-id="${l.id}" data-size="${esc(l.size)}" aria-label="Tăng"><svg class="i"><use href="#i-plus"/></svg></button></div>
              <button class="link-rm" type="button" data-rm="${l.id}" data-rm-size="${esc(l.size)}"><svg class="i"><use href="#i-trash"/></svg>Xoá</button>
            </div>
          </div>
          <div class="cart-line__right"><span class="cart-line__total">${vnd(l.total)}</span>${l.price > l.unit ? `<s class="price__old">${vnd(l.price * l.qty)}</s>` : ''}</div>
        </div>`
        )
        .join('');
      $('[data-sum-sub]').textContent = vnd(data.subtotal);
      $('[data-sum-ship]').textContent = data.shipping ? vnd(data.shipping) : 'Miễn phí';
      $('[data-sum-total]').textContent = vnd(data.total);
      const saved = data.lines.reduce((a, l) => a + (l.price - l.unit) * l.qty, 0);
      const sv = $('[data-sum-save]');
      sv.parentElement.hidden = !saved;
      sv.textContent = '-' + vnd(saved);
    };
    cartPage.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cq]');
      if (!b) return;
      const item = Cart.read().find((i) => i.id === Number(b.dataset.id) && i.size === b.dataset.size);
      if (item) Cart.setQty(item.id, item.size, item.qty + Number(b.dataset.cq));
    });
    cartPage.addEventListener('change', (e) => {
      const i = e.target.closest('[data-cqi]');
      if (i) Cart.setQty(Number(i.dataset.id), i.dataset.size, parseInt(i.value, 10) || 1);
    });
    document.addEventListener('cart:priced', render);
    render();
  }

  /* ---------------- Checkout ---------------- */
  const co = $('[data-checkout]');
  if (co) {
    const itemsField = $('input[name="items"]', co);
    const render = async () => {
      itemsField.value = JSON.stringify(Cart.read());
      const data = await Cart.price().catch(() => ({ lines: [] }));
      const box = $('[data-co-lines]');
      if (!data.lines.length) {
        box.innerHTML = `<p class="empty">Giỏ hàng trống. <a class="link-arrow" href="/dem">Chọn sản phẩm</a></p>`;
        $('[data-co-submit]').disabled = true;
        return;
      }
      box.innerHTML = data.lines.map((l) => `<div class="sum-line"><img src="${esc(l.image)}" alt=""><div><b>${esc(l.name)}</b><small>${l.size ? esc(l.size) + ' · ' : ''}x${l.qty}</small></div><span>${vnd(l.total)}</span></div>`).join('');
      $('[data-sum-sub]').textContent = vnd(data.subtotal);
      $('[data-sum-ship]').textContent = data.shipping ? vnd(data.shipping) : 'Miễn phí';
      $('[data-sum-total]').textContent = vnd(data.total);
    };
    co.addEventListener('submit', (e) => {
      itemsField.value = JSON.stringify(Cart.read());
      if (!co.checkValidity()) return;
      const btn = $('[data-co-submit]');
      btn.disabled = true;
      btn.innerHTML = 'Đang gửi đơn…';
    });
    render();
  }
  if ($('[data-order-done]')) Cart.clear();

  Cart.sync();
})();
