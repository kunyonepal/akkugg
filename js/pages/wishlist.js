/* Wishlist page. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function boot() {
    var grid = $('#wishlistGrid');
    if (!grid) return;
    var sort = $('#sortWishlist'), empty = $('#wishlistEmpty');
    function render() {
      var ids = A.wishlist.all(), items = ids.map(A.product).filter(Boolean);
      var s = sort.value;
      if (s === 'price-low') items.sort(function (a, b) { return a.price - b.price; });
      if (s === 'price-high') items.sort(function (a, b) { return b.price - a.price; });
      if (s === 'discount') items.sort(function (a, b) { return A.discount(b) - A.discount(a); });
      $('[data-w-total]').textContent = items.length;
      $('[data-w-stock]').textContent = items.filter(function (p) { return p.stock !== 'out'; }).length;
      $('[data-w-sale]').textContent = items.filter(function (p) { return A.discount(p) > 0; }).length;
      var value = items.reduce(function (n, p) { return n + p.price; }, 0), v = $('[data-w-value]');
      v.setAttribute('data-price', value); v.textContent = A.money(value);
      empty.hidden = items.length > 0; grid.hidden = !items.length;
      $('#addAllToCart').disabled = !items.some(function (p) { return p.stock !== 'out'; });
      $('#clearWishlist').disabled = !items.length;
      grid.innerHTML = items.map(function (p) {
        var d = A.discount(p), out = p.stock === 'out';
        return '<div class="wishlist-item' + (out ? ' out-of-stock' : '') + '" data-pid="' + p.id + '">' +
          '<button class="wishlist-remove" type="button" data-w-remove aria-label="Remove ' + A.esc(A.shortName(p)) + ' from wishlist"><i class="fas fa-times"></i></button>' +
          '<a class="wishlist-item__image ' + A.mediaClass(p) + '" href="' + A.productUrl(p) + '" tabindex="-1" aria-hidden="true">' + A.media(p, 400, 300) +
            '<span class="stock-badge ' + (out ? 'stock-badge--out">Out of Stock' : 'stock-badge--in">In Stock') + '</span></a>' +
          '<div class="wishlist-item__content">' +
            '<h3><a href="' + A.productUrl(p) + '">' + A.esc(A.shortName(p)) + '</a></h3>' +
            '<p class="wishlist-item__desc">' + A.esc((p.chips || []).join(' | ')) + '</p>' +
            '<div class="wishlist-item__price">' + (d ? A.priceSpan('original-price', p.oldPrice) : '') + A.priceSpan('current-price', p.price) + (d ? ' <span class="price-discount">-' + d + '%</span>' : '') + '</div>' +
            '<button class="btn-add-to-cart" type="button" data-action="add-to-cart" data-pid="' + p.id + '"' + (out ? ' disabled' : '') + '><i class="fas fa-shopping-cart"></i> ' + (out ? 'Out of Stock' : 'Add to Cart') + '</button>' +
          '</div></div>';
      }).join('');
      A.refresh(grid);
    }
    grid.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-w-remove]');
      if (rm) { var id = rm.closest('[data-pid]').getAttribute('data-pid'); A.wishlist.remove(id); A.toast('Removed from your wishlist', { type: 'info' }); }
    });
    sort.addEventListener('change', render);
    $('#addAllToCart').addEventListener('click', function () {
      var n = 0;
      A.wishlist.all().map(A.product).forEach(function (p) { if (p && p.stock !== 'out' && A.cart.add(p.id, 1)) n++; });
      if (n) A.toast(n + ' item' + (n === 1 ? '' : 's') + ' added to your cart', { href: A.root + 'cart.html', linkText: 'View cart' });
    });
    $('#clearWishlist').addEventListener('click', function () { A.wishlist.clear(); A.toast('Wishlist cleared', { type: 'info' }); });
    document.addEventListener('akku:wishlist', render);
    document.addEventListener('akku:sync', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
