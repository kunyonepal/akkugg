/* Cart page. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;

  function boot() {
    var list = $('#cartItemsList');
    if (!list) return;
    var full = $('#cartWithItems'), empty = $('#emptyCart');

    function render() {
      var lines = A.cart.lines();
      full.hidden = !lines.length; empty.hidden = !!lines.length;
      if (!lines.length) { A.refresh(empty); return; }
      list.innerHTML = lines.map(function (l) {
        var m = A.lineMedia(l, 400, 400), p = l.product;
        var stock = p && p.stock === 'low' ? '<span class="stock-status low-stock"><i class="fas fa-exclamation-circle"></i> Few left</span>' : '<span class="stock-status in-stock"><i class="fas fa-check-circle"></i> In Stock</span>';
        return '<div class="cart-item" data-key="' + A.esc(l.key) + '">' +
          '<div class="cart-item__image ' + m.cls + '"><a href="' + m.href + '" tabindex="-1" aria-hidden="true">' + m.html + '</a></div>' +
          '<div class="cart-item__details">' +
            '<a class="cart-item__name" href="' + m.href + '">' + A.esc(l.custom ? l.name : l.name) + '</a>' +
            '<p class="cart-item__specs">' + A.esc(A.lineDetail(l)) + '</p>' +
            '<div class="cart-item__meta">' + stock + (l.custom ? '<span class="delivery-info"><i class="fas fa-tools"></i> ' + (l.parts || []).length + ' parts</span>' : '') + '</div>' +
          '</div>' +
          '<div class="cart-item__sidebar">' +
            '<div class="cart-item__actions">' +
              (l.custom ? '' : '<button class="action-btn" type="button" data-move title="Move to wishlist" aria-label="Move to wishlist"><i class="fas fa-heart"></i></button>') +
              '<button class="action-btn" type="button" data-remove title="Remove" aria-label="Remove ' + A.esc(l.name) + '"><i class="fas fa-trash-alt"></i></button>' +
            '</div>' +
            '<div class="cart-item__quantity"><label for="qty-' + A.esc(l.key) + '">Qty:</label><div class="quantity-selector">' +
              '<button class="qty-btn" type="button" data-step="-1" aria-label="Decrease quantity"' + (l.qty <= 1 ? ' disabled' : '') + '><i class="fas fa-minus"></i></button>' +
              '<input type="number" id="qty-' + A.esc(l.key) + '" min="1" max="10" value="' + l.qty + '" inputmode="numeric">' +
              '<button class="qty-btn" type="button" data-step="1" aria-label="Increase quantity"' + (l.qty >= 10 ? ' disabled' : '') + '><i class="fas fa-plus"></i></button>' +
            '</div></div>' +
            '<div class="cart-item__price"><div class="price-info">' +
              (l.qty > 1 ? '<p class="item-price"><span data-price="' + l.price + '">' + A.money(l.price) + '</span> each</p>' : (l.oldPrice > l.price ? '<p class="item-price item-price--old" data-price="' + l.oldPrice + '">' + A.money(l.oldPrice) + '</p>' : '')) +
              '<p class="item-total" data-price="' + l.total + '">' + A.money(l.total) + '</p>' +
            '</div></div>' +
          '</div></div>';
      }).join('');

      var count = A.cart.count(), subtotal = A.cart.subtotal();
      var savings = lines.reduce(function (n, l) { return n + (l.oldPrice > l.price ? (l.oldPrice - l.price) * l.qty : 0); }, 0);
      var q = A.deliveryQuote(subtotal, 'home');
      $('#itemCount').textContent = count; $('#summaryItemCount').textContent = count;
      $('#subtotalAmount').setAttribute('data-price', subtotal);
      var ship = $('#shippingAmount');
      ship.textContent = q.label; ship.classList.toggle('free-badge', q.fee === 0); ship.removeAttribute('data-price');
      if (q.fee > 0) ship.setAttribute('data-price', q.fee);
      $('#totalAmount').setAttribute('data-price', subtotal + (q.fee || 0));
      $('#savingsRow').hidden = !savings; $('#totalSavings').setAttribute('data-price', savings);
      var note = $('#deliveryNote'); note.hidden = !q.note; note.textContent = q.note || '';
      A.refresh(full);
    }

    list.addEventListener('click', function (e) {
      var row = e.target.closest('.cart-item'); if (!row) return;
      var key = row.getAttribute('data-key'), line = A.cart.lines().filter(function (l) { return l.key === key; })[0];
      if (!line) return;
      if (e.target.closest('[data-remove]')) { A.cart.remove(key); A.toast(line.name + ' removed from your cart', { type: 'info' }); }
      else if (e.target.closest('[data-move]')) { A.wishlist.add(line.id); A.cart.remove(key); A.toast('Moved to your wishlist', { href: A.root + 'wishlist.html', linkText: 'View' }); }
      else if (e.target.closest('[data-step]')) { A.cart.setQty(key, line.qty + Number(e.target.closest('[data-step]').getAttribute('data-step'))); }
    });
    list.addEventListener('change', function (e) {
      if (!e.target.matches('input[type=number]')) return;
      var row = e.target.closest('.cart-item');
      A.cart.setQty(row.getAttribute('data-key'), Math.round(Number(e.target.value) || 1));
    });
    $('#clearCartBtn').addEventListener('click', function () {
      var kept = A.cart.raw();
      A.cart.clear();
      var host = $('#akkuToasts');
      A.toast('Cart cleared', { type: 'info', href: '#undo', linkText: 'Undo' });
      var last = host && host.lastElementChild, link = last && $('.akku-toast__link', last);
      if (link) link.addEventListener('click', function (ev) { ev.preventDefault(); A.cart.save(kept); last.remove(); });
    });
    document.addEventListener('akku:cart', render);
    document.addEventListener('akku:sync', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
