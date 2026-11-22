/* Product page: gallery + zoom, options, quantity, add to cart / buy now, tabs, share, recently viewed. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function boot() {
    var wrap = $('[data-product]');
    if (!wrap) return;
    var p = A.product(wrap.getAttribute('data-product'));
    if (!p) return;

    /* ---------- gallery ---------- */
    var thumbs = $$('.product-detail__thumbnails img'), main = $('#mainImage'), current = 0;
    function show(i) {
      if (!thumbs.length || !main) return;
      current = (i + thumbs.length) % thumbs.length;
      thumbs.forEach(function (t, n) { t.classList.toggle('active', n === current); });
      var box = main.closest('.akku-media'); if (box) box.classList.remove('is-broken');
      main.src = thumbs[current].getAttribute('data-large');
      if (zoom && zoom.classList.contains('active')) zoomImg.src = thumbs[current].getAttribute('data-zoom');
    }
    thumbs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i); });
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } });
    });
    $$('[data-gallery-step]').forEach(function (b) { b.addEventListener('click', function () { show(current + Number(b.getAttribute('data-gallery-step'))); }); });

    var zoom = $('#imageZoomModal'), zoomImg = $('#zoomImage');
    function openZoom() {
      if (!zoom || !main) return;
      zoomImg.src = thumbs.length ? thumbs[current].getAttribute('data-zoom') : main.src;
      zoom.classList.add('active'); document.body.style.overflow = 'hidden';
      $('.zoom-close-btn', zoom).focus();
    }
    function closeZoom() { zoom.classList.remove('active'); document.body.style.overflow = ''; }
    $$('[data-gallery-zoom]').forEach(function (b) { b.addEventListener('click', openZoom); });
    if (main) main.addEventListener('click', openZoom);
    if (zoom) {
      $('.zoom-close-btn', zoom).addEventListener('click', closeZoom);
      zoom.addEventListener('click', function (e) { if (e.target === zoom || e.target.classList.contains('zoom-image-container')) closeZoom(); });
      $$('[data-zoom-step]', zoom).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); show(current + Number(b.getAttribute('data-zoom-step'))); }); });
      document.addEventListener('keydown', function (e) {
        if (!zoom.classList.contains('active')) return;
        if (e.key === 'Escape') closeZoom();
        if (e.key === 'ArrowLeft') show(current - 1);
        if (e.key === 'ArrowRight') show(current + 1);
      });
    }
    /* swipe on the main photo */
    var sx = null;
    if (main) {
      main.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      main.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1)); sx = null; });
    }

    /* ---------- options ---------- */
    var options = A.defaultOptions(p);
    function updatePrice() {
      var v = A.variant(p, options), d = v.oldPrice > v.price ? Math.round((1 - v.price / v.oldPrice) * 100) : 0;
      $$('[data-buy-price]').forEach(function (el) { el.setAttribute('data-price', v.price); });
      $$('[data-buy-old]').forEach(function (el) { el.setAttribute('data-price', v.oldPrice); el.hidden = !d; });
      $$('[data-buy-saving]').forEach(function (el) { el.setAttribute('data-price', Math.max(0, v.oldPrice - v.price)); });
      $$('[data-buy-save]').forEach(function (el) { el.hidden = !d; });
      $$('[data-discount-badge]').forEach(function (el) { el.textContent = d + '% OFF'; el.hidden = !d; });
      A.applyCurrency();
    }
    $$('.option-group[data-option]').forEach(function (g) {
      var name = g.getAttribute('data-option');
      $$('.option-btn', g).forEach(function (btn) {
        btn.addEventListener('click', function () {
          $$('.option-btn', g).forEach(function (b) { var on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
          options[name] = btn.getAttribute('data-value');
          var cur = $('.option-current', g); if (cur) cur.textContent = options[name];
          updatePrice();
        });
      });
    });

    /* ---------- quantity ---------- */
    var qty = $('#buyQty');
    function getQty() { var n = Math.round(Number(qty && qty.value) || 1); n = Math.max(1, Math.min(10, n)); if (qty) qty.value = n; return n; }
    $$('[data-qty-step]').forEach(function (b) { b.addEventListener('click', function () { qty.value = getQty() + Number(b.getAttribute('data-qty-step')); getQty(); }); });
    if (qty) qty.addEventListener('change', getQty);

    /* ---------- buy ---------- */
    $$('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!A.cart.add(p.id, getQty(), options)) { A.toast('This item is not available right now.', { type: 'error' }); return; }
        if (b.getAttribute('data-buy') === 'now') { window.location.href = A.root + 'checkout.html'; return; }
        A.toast(A.shortName(p) + ' added to your cart', { href: A.root + 'cart.html', linkText: 'View cart' });
      });
    });

    /* ---------- tabs ---------- */
    /* reviews: signed-in customers can write one; it shows after staff approve it */
    var rf = $('#reviewForm'), ro = $('[data-review-open]');
    if (rf && ro) {
      ro.addEventListener('click', function () {
        A.session().then(function (me) {
          if (!me) { window.location.href = A.root + 'login.html?next=' + encodeURIComponent('product/' + $('[data-product]').getAttribute('data-product') + '.html#reviews'); return; }
          rf.hidden = !rf.hidden; if (!rf.hidden) $('input[name="rating"]', rf).focus();
        });
      });
      rf.addEventListener('submit', function (e) {
        e.preventDefault();
        var rating = $('input[name="rating"]:checked', rf), body = rf.elements.body.value.trim();
        if (!rating) { A.toast('Choose a star rating first.', { type: 'error' }); return; }
        if (body.length < 10) { A.toast('Please write a few words about the product.', { type: 'error' }); rf.elements.body.focus(); return; }
        var btn = $('button[type="submit"]', rf); btn.disabled = true;
        A.api('POST', 'reviews', { productId: $('[data-product]').getAttribute('data-product'), rating: Number(rating.value), title: rf.elements.title.value, body: body })
          .then(function (r) { rf.reset(); rf.hidden = true; ro.hidden = true; A.toast(r.message, { type: 'success', duration: 7000 }); }, function (err) { A.toast(err.message, { type: 'error', duration: 7000 }); })
          .then(function () { btn.disabled = false; });
      });
    }
    $$('.product-tabs .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.product-tabs .tab-btn').forEach(function (b) { var on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
        $$('.product-tabs__content').forEach(function (c) { c.classList.toggle('active', c.id === btn.getAttribute('data-tab')); });
      });
    });

    /* ---------- share ---------- */
    var share = $('[data-share]');
    if (share) share.addEventListener('click', function () {
      var url = (A.site.siteUrl || '').replace(/\/$/, '') + '/product/' + p.id + '.html';
      var copy = function () {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { A.toast('Link copied: ' + url); }, function () { A.toast('Share this link: ' + url, { type: 'info', duration: 8000 }); });
        else A.toast('Share this link: ' + url, { type: 'info', duration: 8000 });
      };
      if (navigator.share) navigator.share({ title: p.name, url: url }).catch(function (err) { if (!err || err.name !== 'AbortError') copy(); });
      else copy();
    });

    /* ---------- recently viewed ---------- */
    var seen = A.recent.all().filter(function (id) { return id !== p.id; }).slice(0, 4);
    A.recent.add(p.id);
    var rv = $('[data-recently-viewed]');
    if (rv && seen.length) {
      $('.recently-viewed__carousel', rv).innerHTML = seen.map(function (id) { return A.render.miniCard(A.product(id)); }).join('');
      rv.hidden = false;
      A.refresh(rv);
    }

    updatePrice();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
