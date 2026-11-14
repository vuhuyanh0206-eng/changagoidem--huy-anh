(() => {
  'use strict';
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Xác nhận trước khi xoá
  document.addEventListener('submit', (e) => {
    const msg = e.target.dataset.confirm;
    if (msg && !confirm(msg)) e.preventDefault();
  });

  // Thêm / xoá dòng (kích thước, thông số)
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-row-add]');
    if (add) {
      const box = document.querySelector(`[data-rows="${add.dataset.rowAdd}"]`);
      const rows = $$('.sizes__row', box);
      const clone = rows[rows.length - 1].cloneNode(true);
      clone.querySelectorAll('input').forEach((i) => (i.value = ''));
      box.appendChild(clone);
      clone.querySelector('input').focus();
    }
    const del = e.target.closest('[data-row-del]');
    if (del) {
      const row = del.closest('.sizes__row');
      const box = row.parentElement;
      if ($$('.sizes__row', box).length > 1) row.remove();
      else row.querySelectorAll('input').forEach((i) => (i.value = ''));
    }
    const imgDel = e.target.closest('[data-img-del]');
    if (imgDel) imgDel.closest('.imgs__item').remove();
  });

  // Xem trước ảnh mới chọn
  $$('[data-img-input]').forEach((input) => {
    input.addEventListener('change', () => {
      const prev = document.querySelector('[data-img-preview]');
      prev.innerHTML = '';
      [...input.files].forEach((f) => {
        const d = document.createElement('div');
        d.className = 'imgs__item';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(f);
        d.appendChild(img);
        prev.appendChild(d);
      });
    });
  });

  // Kéo thả sắp xếp ảnh hiện có
  $$('[data-imgs]').forEach((box) => {
    let dragged = null;
    box.addEventListener('dragstart', (e) => {
      dragged = e.target.closest('.imgs__item');
      dragged?.classList.add('is-drag');
    });
    box.addEventListener('dragend', () => dragged?.classList.remove('is-drag'));
    box.addEventListener('dragover', (e) => {
      e.preventDefault();
      const over = e.target.closest('.imgs__item');
      if (!over || over === dragged) return;
      const r = over.getBoundingClientRect();
      box.insertBefore(dragged, e.clientX - r.left > r.width / 2 ? over.nextSibling : over);
    });
  });
})();
