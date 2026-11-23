/* Akku.GG storefront runtime: cart / wishlist / compare state, header, search, carousels, toasts.
   Loaded on every page after data.js and core.js. */
(function () {
  'use strict';
  var A = window.Akku;
  var doc = document;
  A.root = doc.documentElement.getAttribute('data-root') || '';
  var $ = function (sel, el) { return (el || doc).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(sel)); };
  A.$ = $; A.$$ = $$;

  /* ------------------------------------------------------------------ storage */
  var mem = {};
  var store = A.store = {
    get: function (key, fallback) {
      var v;
      try { v = window.localStorage.getItem('akku.' + key); } catch (e) { v = null; }
      if (v == null) return key in mem ? mem[key] : fallback;
      try { return JSON.parse(v); } catch (e) { return v; }
    },
    set: function (key, value) {
      mem[key] = value;
      try { window.localStorage.setItem('akku.' + key, JSON.stringify(value)); } catch (e) { /* private mode or sandbox: keep in memory */ }
    }
  };
  function emit(name, detail) { doc.dispatchEvent(new CustomEvent('akku:' + name, { detail: detail || {} })); }

  /* ------------------------------------------------------------------ preferences */
  A.prefs = store.get('prefs', { currency: 'NPR', language: 'en' });
  if (!(A.site.currency && A.site.currency.usdRate > 0)) A.prefs.currency = 'NPR';
  A.applyCurrency = function (scope) {
    $$('[data-price]', scope).forEach(function (el) {
      if (el.children.length) return;
      el.textContent = A.money(Number(el.getAttribute('data-price')));
    });
    $$('[data-pref-label]').forEach(function (el) { el.textContent = 'EN / ' + A.currency(); });
  };

  /* ------------------------------------------------------------------ cart */
  A.variant = function (p, options) {
    var price = p.price, old = p.oldPrice || 0;
    (p.options || []).forEach(function (o) {
      var v = (o.values || []).filter(function (x) { return options && x.label === options[o.name]; })[0];
      if (v && v.price) { price = v.price; old = v.oldPrice || 0; }
    });
    return { price: price, oldPrice: old };
  };
  A.defaultOptions = function (p) {
    var out = {};
    (p.options || []).forEach(function (o) { if (o.values && o.values.length) out[o.name] = o.values[0].label; });
    return out;
  };
  function lineKey(id, options) {
    var keys = Object.keys(options || {}).sort();
    return id + (keys.length ? '|' + keys.map(function (k) { return k + '=' + options[k]; }).join(';') : '');
  }
  var MAX_QTY = 10;
  var cart = A.cart = {
    raw: function () { return store.get('cart', []).filter(function (l) { return l && (l.custom || A.product(l.id)); }); },
    save: function (lines) { store.set('cart', lines); emit('cart'); },
    /* lines enriched with product + current price */
    lines: function () {
      return cart.raw().map(function (l) {
        if (l.custom) return { key: l.key, custom: true, name: l.name, parts: l.parts || [], qty: l.qty, price: l.price, oldPrice: 0, total: l.price * l.qty, options: {} };
        var p = A.product(l.id), v = A.variant(p, l.options);
        return { key: l.key, id: l.id, product: p, name: p.name, options: l.options || {}, qty: l.qty, price: v.price, oldPrice: v.oldPrice, total: v.price * l.qty };
      });
    },
    count: function () { return cart.raw().reduce(function (n, l) { return n + l.qty; }, 0); },
    subtotal: function () { return cart.lines().reduce(function (n, l) { return n + l.total; }, 0); },
    add: function (id, qty, options) {
      var p = A.product(id);
      if (!p || p.stock === 'out' || p.ask) return false;
      options = options || A.defaultOptions(p);
      var lines = cart.raw(), key = lineKey(id, options), hit = lines.filter(function (l) { return l.key === key; })[0];
      if (hit) hit.qty = Math.min(MAX_QTY, hit.qty + (qty || 1));
      else lines.push({ key: key, id: id, qty: Math.min(MAX_QTY, qty || 1), options: options });
      cart.save(lines);
      A.track('AddToCart', { items: [{ id: p.id, name: p.name, price: A.variant ? A.variant(p, options).price : p.price, brand: p.brand, qty: qty || 1 }] });
      return true;
    },
    /* a configured PC from the builder goes in as one line made of catalogue parts */
    addBuild: function (name, partIds) {
      var parts = partIds.map(A.product).filter(Boolean);
      if (!parts.length || parts.some(function (p) { return p.ask; })) return false;
      var lines = cart.raw();
      lines.push({ key: 'build-' + Date.now(), custom: true, name: name, parts: parts.map(function (p) { return p.id; }), qty: 1, price: parts.reduce(function (n, p) { return n + p.price; }, 0) });
      cart.save(lines);
      A.track('AddToCart', { items: [{ id: 'custom-build', name: name, price: parts.reduce(function (n, p) { return n + p.price; }, 0), qty: 1 }] });
      return true;
    },
    setQty: function (key, qty) {
      var lines = cart.raw();
      lines.forEach(function (l) { if (l.key === key) l.qty = Math.max(1, Math.min(MAX_QTY, qty)); });
      cart.save(lines);
    },
    remove: function (key) { cart.save(cart.raw().filter(function (l) { return l.key !== key; })); },
    clear: function () { cart.save([]); }
  };

  /* ------------------------------------------------------------------ id lists: wishlist, compare, recently viewed */
  function idList(name, max) {
    return {
      all: function () { return store.get(name, []).filter(function (id) { return A.product(id); }); },
      has: function (id) { return this.all().indexOf(id) !== -1; },
      add: function (id) {
        var list = this.all().filter(function (x) { return x !== id; });
        list.unshift(id);
        if (max && list.length > max) list = list.slice(0, max);
        store.set(name, list); emit(name);
      },
      remove: function (id) { store.set(name, this.all().filter(function (x) { return x !== id; })); emit(name); },
      toggle: function (id) { var had = this.has(id); if (had) this.remove(id); else this.add(id); return !had; },
      clear: function () { store.set(name, []); emit(name); }
    };
  }
  A.wishlist = idList('wishlist', 100);
  A.compare = idList('compare', 4);
  A.recent = idList('recent', 12);

  /* ------------------------------------------------------------------ orders (kept on this device until a backend receives them) */
  A.orders = {
    all: function () { return store.get('orders', []); },
    get: function (id) { id = String(id || '').trim().toUpperCase(); return A.orders.all().filter(function (o) { return o.id.toUpperCase() === id; })[0] || null; },
    save: function (order) { var list = A.orders.all().filter(function (o) { return o.id !== order.id; }); list.unshift(order); store.set('orders', list.slice(0, 50)); emit('orders'); },
    newId: function () {
      var nepal = new Date(Date.now() + 345 * 60000), p = function (n) { return (n < 10 ? '0' : '') + n; };
      return (A.site.orders && A.site.orders.prefix || 'AKG') + '-' + String(nepal.getUTCFullYear()).slice(2) + p(nepal.getUTCMonth() + 1) + p(nepal.getUTCDate()) + '-' + Math.floor(1000 + Math.random() * 9000);
    }
  };
  A.normalizePhone = function (s) { var d = String(s || '').replace(/\D/g, ''); if (d.indexOf('977') === 0 && d.length > 10) d = d.slice(3); return d; };
  A.validPhone = function (s) { var d = A.normalizePhone(s); return /^9[678]\d{8}$/.test(d) || /^0\d{8,9}$/.test(d); };
  /* delivery charge: fee null/empty in site.config.json means "confirmed when we call" */
  /* delivery areas (e.g. inside / outside Kathmandu Valley); older settings have a single home-delivery fee */
  A.deliveryQuote = function (subtotal, method) {
    var d = A.site.delivery || {};
    if (method === 'pickup') return { fee: 0, label: 'FREE' };
    var areas = A.deliveryAreas(), area = areas.filter(function (a) { return a.id === method; })[0] || areas[0];
    if (area.fee === null || area.fee === undefined || area.fee === '') return { fee: null, label: 'Confirmed on call', note: d.feeNote || '' };
    var fee = Number(area.fee) || 0;
    if (d.freeOver > 0 && subtotal >= d.freeOver) fee = 0;
    return { fee: fee, label: fee ? A.money(fee) : 'FREE' };
  };
  A.optionsText = function (options) { return Object.keys(options || {}).map(function (k) { return k + ': ' + options[k]; }).join(' · '); };

  /* shared by cart, checkout and orders: an image + link for a cart / order line */
  A.lineMedia = function (line, w, h) {
    if (line.custom) {
      var kase = (line.parts || []).map(A.product).filter(function (p) { return p && p.subcategory === 'cases' && p.image; })[0];
      return { href: A.root + 'pc-builder.html', html: kase ? A.media(kase, w, h, line.name) : '<i class="akku-ph fas fa-desktop" aria-hidden="true"></i>', cls: 'akku-media' + (kase ? '' : ' is-empty') };
    }
    var p = A.product(line.id);
    if (!p) return { href: '#', html: '<i class="akku-ph fas fa-box" aria-hidden="true"></i>', cls: 'akku-media is-empty' };
    return { href: A.productUrl(p), html: A.media(p, w, h), cls: A.mediaClass(p) };
  };
  A.lineDetail = function (line) {
    if (line.custom) return (line.parts || []).map(A.product).filter(Boolean).map(A.shortName).join(' | ');
    var opts = A.optionsText(line.options);
    if (opts) return opts;
    var p = A.product(line.id);
    return p && p.chips ? p.chips.join(' | ') : '';
  };


  /* ------------------------------------------------------------------ toasts */
  A.toast = function (message, opts) {
    opts = opts || {};
    var host = $('#akkuToasts');
    if (!host) return;
    var t = doc.createElement('div');
    t.className = 'akku-toast akku-toast--' + (opts.type || 'success');
    var icon = { success: 'fa-check-circle', info: 'fa-info-circle', error: 'fa-exclamation-circle' }[opts.type || 'success'];
    t.innerHTML = '<i class="fas ' + icon + '"></i><span class="akku-toast__text"></span>' +
      (opts.href ? '<a class="akku-toast__link" href="' + A.esc(opts.href) + '">' + A.esc(opts.linkText || 'View') + '</a>' : '') +
      '<button type="button" class="akku-toast__close" aria-label="Dismiss"><i class="fas fa-times"></i></button>';
    $('.akku-toast__text', t).textContent = message;
    host.appendChild(t);
    var kill = function () { t.classList.add('is-leaving'); setTimeout(function () { t.remove(); }, 250); };
    $('.akku-toast__close', t).addEventListener('click', kill);
    setTimeout(kill, opts.duration || 4200);
    while (host.children.length > 3) host.firstChild.remove();
  };
  /* scripts carried over from the prototype call alert(); show those as toasts instead of blocking dialogs */
  window.alert = function (msg) { A.toast(String(msg), { type: 'info' }); };

  /* ------------------------------------------------------------------ header */
  function updateBadges() {
    var counts = { cart: cart.count(), wishlist: A.wishlist.all().length, orders: A.orders.all().length };
    $$('[data-stat]').forEach(function (el) { el.textContent = counts[el.getAttribute('data-stat')] || 0; });
    $$('[data-count]').forEach(function (el) {
      var n = counts[el.getAttribute('data-count')] || 0;
      el.textContent = n > 99 ? '99+' : n;
      if (el.getAttribute('data-count') === 'wishlist') el.hidden = n === 0;
    });
  }
  function markStates(scope) {
    $$('[data-action="wishlist"]', scope).forEach(function (btn) {
      var on = A.wishlist.has(btn.getAttribute('data-pid'));
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var i = $('i', btn);
      if (i) { i.classList.toggle('fas', on); i.classList.toggle('far', !on); }
    });
    $$('[data-action="compare"]', scope).forEach(function (btn) {
      var on = A.compare.has(btn.getAttribute('data-pid'));
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  A.refresh = function (scope) { A.applyCurrency(scope); markStates(scope); watchImages(scope); };

  function initHeader() {
    var toggle = $('#menuToggle'), nav = $('#mainNav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('active');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        var i = $('i', toggle);
        if (i) { i.classList.toggle('fa-bars', !open); i.classList.toggle('fa-times', open); }
      });
    }
    var closeMenus = function (except) {
      $$('.header__nav .dropdown-menu.show').forEach(function (m) {
        if (m === except) return;
        m.classList.remove('show');
        var b = $('.dropdown-toggle', m.parentNode);
        if (b) { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); }
      });
    };
    $$('.header__nav .dropdown-toggle').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var menu = $('.dropdown-menu', btn.parentNode);
        closeMenus(menu);
        var open = menu.classList.toggle('show');
        btn.classList.toggle('active', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    /* desktop: open on hover as well, so sub-categories are one move away */
    if (window.matchMedia && window.matchMedia('(hover: hover) and (min-width: 577px)').matches) {
      $$('.header__nav li.has-dropdown').forEach(function (li) {
        var timer;
        li.addEventListener('mouseenter', function () { clearTimeout(timer); var m = $('.dropdown-menu', li); closeMenus(m); m.classList.add('show'); $('.dropdown-toggle', li).classList.add('active'); });
        li.addEventListener('mouseleave', function () { timer = setTimeout(function () { $('.dropdown-menu', li).classList.remove('show'); $('.dropdown-toggle', li).classList.remove('active'); }, 160); });
      });
    }
    doc.addEventListener('click', function (e) { if (!e.target.closest('.has-dropdown')) closeMenus(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(); });
  }

  /* ------------------------------------------------------------------ preferences modal */
  function initSettings() {
    var modal = $('#settingsModal');
    if (!modal) return;
    var lastFocus = null;
    var sync = function () {
      $$('input[name="currency"]', modal).forEach(function (r) { r.checked = r.value === A.currency(); });
      $$('.settings-option', modal).forEach(function (l) { var r = $('input', l); l.classList.toggle('active', !!(r && r.checked)); });
    };
    var open = function () { lastFocus = doc.activeElement; sync(); modal.classList.add('active'); doc.body.style.overflow = 'hidden'; var b = $('.close-btn', modal); if (b) b.focus(); };
    var close = function () { modal.classList.remove('active'); doc.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); };
    $$('#openSettingsModal, [data-open-settings]').forEach(function (b) { b.addEventListener('click', open); });
    $$('[data-close-settings]', modal).forEach(function (b) { b.addEventListener('click', close); });
    modal.addEventListener('change', function () { $$('.settings-option', modal).forEach(function (l) { var r = $('input', l); l.classList.toggle('active', !!(r && r.checked)); }); });
    var apply = $('[data-apply-settings]', modal);
    if (apply) apply.addEventListener('click', function () {
      var cur = $('input[name="currency"]:checked', modal);
      A.prefs.currency = cur ? cur.value : 'NPR';
      store.set('prefs', A.prefs);
      A.applyCurrency();
      emit('prefs');
      close();
      A.toast('Preferences saved. Prices now show in ' + A.prefs.currency + '.');
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('active')) close(); });
  }

  /* ------------------------------------------------------------------ search overlay */
  function goSearch(q) {
    q = String(q || '').trim();
    if (!q) return;
    var recent = store.get('searches', []).filter(function (s) { return s.toLowerCase() !== q.toLowerCase(); });
    recent.unshift(q); store.set('searches', recent.slice(0, 6));
    try { window.sessionStorage.setItem('akku.lastQuery', q); } catch (e) { /* ignore */ }
    window.location.href = A.root + 'search-results.html?q=' + encodeURIComponent(q);
  }
  A.goSearch = goSearch;
  function initSearch() {
    var forms = $$('.header__search');
    if (!forms.length) return;
    var overlay = doc.createElement('div');
    overlay.className = 'search-overlay'; overlay.id = 'searchOverlay';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Search products');
    var quick = A.catalog.categories.slice(0, 4).map(function (c) { return '<a href="' + A.categoryUrl(c.id) + '" class="quick-link"><i class="fas ' + c.icon + '"></i> ' + A.esc(c.name) + '</a>'; }).join('') +
      '<a href="' + A.root + 'deals.html" class="quick-link"><i class="fas fa-tags"></i> Deals</a>';
    overlay.innerHTML =
      '<div class="search-overlay__container">' +
        '<div class="search-overlay__header">' +
          '<form class="search-overlay__input-wrapper" role="search"><i class="fas fa-search search-icon"></i>' +
          '<input type="text" id="overlaySearchInput" placeholder="Search for products, brands and more..." autocomplete="off" aria-label="Search products">' +
          '<button class="clear-search" type="button" id="clearSearch" aria-label="Clear search"><i class="fas fa-times"></i></button></form>' +
          '<button class="search-overlay__close" type="button" id="closeSearchOverlay" aria-label="Close search"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="search-overlay__content">' +
          '<div class="search-initial" id="searchInitial">' +
            '<div class="search-quick-links"><h3>Quick Access</h3><div class="quick-links-grid">' + quick + '</div></div>' +
            '<div class="search-recent" id="searchRecentSection" hidden><h3>Recent Searches</h3><div class="recent-tags" id="recentSearchesContainer"></div></div>' +
            '<div class="search-trending"><h3><i class="fas fa-fire"></i> Popular Searches</h3><div class="trending-items" id="trendingSearchesContainer"></div></div>' +
          '</div>' +
          '<div class="search-results" id="searchResults" hidden><h3>Results for "<span id="searchQueryText"></span>"</h3><div class="results-grid" id="resultsGrid"></div>' +
            '<div class="view-all-results" id="viewAllResults" hidden><button class="btn-view-all" type="button">View All Results <i class="fas fa-arrow-right"></i></button></div></div>' +
        '</div>' +
      '</div>';
    doc.body.appendChild(overlay);
    var input = $('#overlaySearchInput', overlay), initial = $('#searchInitial', overlay), results = $('#searchResults', overlay), grid = $('#resultsGrid', overlay);
    var popular = (A.site.search && A.site.search.popular) || [];
    $('#trendingSearchesContainer', overlay).innerHTML = popular.map(function (s, i) {
      return '<button type="button" class="trending-item" data-term="' + A.esc(s) + '"><span class="trending-number">#' + (i + 1) + '</span><span class="trending-text">' + A.esc(s) + '</span></button>';
    }).join('');
    function renderRecent() {
      var list = store.get('searches', []), sec = $('#searchRecentSection', overlay);
      sec.hidden = !list.length; sec.classList.toggle('has-items', !!list.length);
      $('#recentSearchesContainer', overlay).innerHTML = list.map(function (s) {
        return '<span class="recent-tag" role="button" tabindex="0" data-term="' + A.esc(s) + '"><i class="fas fa-clock"></i> ' + A.esc(s) +
          ' <span class="remove-recent" role="button" aria-label="Remove ' + A.esc(s) + '" data-remove="' + A.esc(s) + '"><i class="fas fa-times"></i></span></span>';
      }).join('');
    }
    function showInitial() { initial.hidden = false; initial.style.display = ''; results.hidden = true; results.style.display = 'none'; $('#clearSearch', overlay).classList.remove('active'); }
    function run(q) {
      q = q.trim();
      if (q.length < 2) { showInitial(); return; }
      var found = A.search(q);
      initial.hidden = true; initial.style.display = 'none'; results.hidden = false; results.style.display = 'block';
      $('#clearSearch', overlay).classList.add('active');
      $('#searchQueryText', overlay).textContent = q;
      grid.innerHTML = found.length ? found.slice(0, 8).map(A.render.searchResult).join('') :
        '<div class="no-results"><div class="no-results-icon"><i class="fas fa-search"></i></div><h4>No products found</h4><p>Try different keywords or browse our categories</p></div>';
      $('#viewAllResults', overlay).hidden = found.length <= 8;
      A.refresh(grid);
    }
    var opener = null;
    function open(prefill) {
      opener = doc.activeElement;
      overlay.classList.add('active'); doc.body.classList.add('search-overlay-open');
      renderRecent();
      input.value = prefill || '';
      if (prefill) run(prefill); else showInitial();
      setTimeout(function () { input.focus(); }, 60);
    }
    function close() {
      overlay.classList.remove('active'); doc.body.classList.remove('search-overlay-open');
      if (opener && opener.blur) opener.blur();
    }
    var timer;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { run(input.value); }, 140); });
    $('.search-overlay__input-wrapper', overlay).addEventListener('submit', function (e) { e.preventDefault(); goSearch(input.value); });
    $('#clearSearch', overlay).addEventListener('click', function () { input.value = ''; showInitial(); input.focus(); });
    $('#closeSearchOverlay', overlay).addEventListener('click', close);
    $('.btn-view-all', overlay).addEventListener('click', function () { goSearch(input.value); });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) return close();
      var rm = e.target.closest('[data-remove]');
      if (rm) { e.stopPropagation(); store.set('searches', store.get('searches', []).filter(function (s) { return s !== rm.getAttribute('data-remove'); })); renderRecent(); return; }
      var term = e.target.closest('[data-term]');
      if (term) { input.value = term.getAttribute('data-term'); run(input.value); input.focus(); }
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('active')) close(); });
    forms.forEach(function (form) {
      var field = $('input[type="text"]', form);
      form.addEventListener('submit', function (e) { e.preventDefault(); if (field && field.value.trim()) goSearch(field.value); else open(''); });
      if (field) {
        field.addEventListener('focus', function () { if (!overlay.classList.contains('active')) open(field.value); });
        field.addEventListener('click', function () { if (!overlay.classList.contains('active')) open(field.value); });
      }
    });
  }

  /* ------------------------------------------------------------------ carousel (same DOM as Owl Carousel, so the prototype's styles apply) */
  function Carousel(el) {
    var opts = {};
    try { opts = JSON.parse(el.getAttribute('data-carousel') || '{}'); } catch (e) { /* defaults */ }
    var margin = opts.margin || 0, responsive = opts.responsive || { 0: 1 };
    var items = Array.prototype.slice.call(el.children);
    if (!items.length) return;
    var outer = doc.createElement('div'); outer.className = 'owl-stage-outer';
    var stage = doc.createElement('div'); stage.className = 'owl-stage';
    items.forEach(function (child) { var w = doc.createElement('div'); w.className = 'owl-item'; w.appendChild(child); stage.appendChild(w); });
    outer.appendChild(stage); el.appendChild(outer);
    var nav = doc.createElement('div'); nav.className = 'owl-nav';
    nav.innerHTML = '<button type="button" class="owl-prev" aria-label="Previous"><i class="fas fa-chevron-left"></i></button><button type="button" class="owl-next" aria-label="Next"><i class="fas fa-chevron-right"></i></button>';
    var dots = doc.createElement('div'); dots.className = 'owl-dots';
    el.appendChild(nav); el.appendChild(dots);
    el.classList.add('owl-loaded', 'owl-drag');
    var prev = $('.owl-prev', nav), next = $('.owl-next', nav);
    var index = 0, per = 1, step = 0, max = 0, wraps = Array.prototype.slice.call(stage.children);

    function perView() {
      var w = window.innerWidth, best = 1, bp = -1;
      Object.keys(responsive).forEach(function (k) { if (w >= Number(k) && Number(k) > bp) { bp = Number(k); best = responsive[k]; } });
      return Math.max(1, best);
    }
    function go(i, instant) {
      index = Math.max(0, Math.min(max, i));
      stage.style.transition = instant ? 'none' : 'transform .35s ease';
      stage.style.transform = 'translate3d(' + (-index * step) + 'px,0,0)';
      prev.classList.toggle('disabled', index === 0); prev.disabled = index === 0;
      next.classList.toggle('disabled', index >= max); next.disabled = index >= max;
      wraps.forEach(function (w, n) { var on = n >= index && n < index + per; w.classList.toggle('active', on); });
      var starts = pageStarts(), cur = 0;
      starts.forEach(function (s, n) { if (s <= index) cur = n; });
      Array.prototype.forEach.call(dots.children, function (d, n) { d.classList.toggle('active', n === cur); });
    }
    function pageStarts() {
      var out = [];
      for (var s = 0; s < wraps.length; s += per) { var v = Math.min(s, max); if (out.indexOf(v) === -1) out.push(v); }
      return out;
    }
    function layout() {
      var width = outer.clientWidth;
      if (!width) return;
      per = perView();
      var w = (width - margin * (per - 1)) / per;
      step = w + margin;
      wraps.forEach(function (wr) { wr.style.width = w.toFixed(3) + 'px'; wr.style.marginRight = margin + 'px'; });
      stage.style.width = Math.ceil(step * wraps.length) + 'px';
      max = Math.max(0, wraps.length - per);
      var starts = pageStarts();
      dots.innerHTML = starts.map(function (s, n) { return '<button type="button" class="owl-dot" aria-label="Go to slide group ' + (n + 1) + '" data-start="' + s + '"><span></span></button>'; }).join('');
      var single = wraps.length <= per;
      nav.classList.toggle('disabled', single); dots.classList.toggle('disabled', single);
      go(Math.min(index, max), true);
    }
    prev.addEventListener('click', function () { go(index - 1); });
    next.addEventListener('click', function () { go(index + 1); });
    dots.addEventListener('click', function (e) { var d = e.target.closest('.owl-dot'); if (d) go(Number(d.getAttribute('data-start'))); });

    /* drag / swipe */
    var startX = 0, startY = 0, base = 0, dragging = false, moved = 0, locked = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; moved = 0; locked = null; startX = e.clientX; startY = e.clientY; base = -index * step;
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (locked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (locked !== 'x') return;
      moved = dx;
      el.classList.add('owl-grab');
      stage.style.transition = 'none';
      var x = base + dx, min = -max * step;
      if (x > 0) x = x / 3; else if (x < min) x = min + (x - min) / 3;
      stage.style.transform = 'translate3d(' + x + 'px,0,0)';
    });
    var end = function () {
      if (!dragging) return;
      dragging = false; el.classList.remove('owl-grab');
      var delta = step ? moved / step : 0, shift = 0;
      if (locked === 'x' && Math.abs(delta) > 0.15) shift = (delta > 0 ? -1 : 1) * Math.max(1, Math.round(Math.abs(delta)));
      go(index + shift);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    stage.addEventListener('click', function (e) { if (Math.abs(moved) > 10) { e.preventDefault(); e.stopPropagation(); moved = 0; } }, true);
    stage.addEventListener('dragstart', function (e) { e.preventDefault(); });

    if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(outer);
    else window.addEventListener('resize', layout);
    layout();
  }
  A.initCarousels = function (scope) { $$('[data-carousel]:not(.owl-loaded)', scope).forEach(Carousel); };

  /* horizontal scrollers with prev/next buttons (brand strip, related products) */
  function initScrollers() {
    $$('[data-scroller]').forEach(function (wrap) {
      var track = $('[data-scroller-track]', wrap) || wrap;
      $$('[data-scroll]', wrap).forEach(function (btn) {
        btn.addEventListener('click', function () { track.scrollBy({ left: Number(btn.getAttribute('data-scroll')) * Math.max(240, track.clientWidth * 0.8), behavior: 'smooth' }); });
      });
    });
  }

  /* ------------------------------------------------------------------ countdown */
  function weekEnd() {
    /* end of the current week, Saturday 23:59:59 Nepal time (UTC+5:45) */
    var off = 345 * 60000, now = Date.now(), nepal = new Date(now + off);
    var end = Date.UTC(nepal.getUTCFullYear(), nepal.getUTCMonth(), nepal.getUTCDate() + (6 - nepal.getUTCDay()), 23, 59, 59);
    return end - off;
  }
  function initCountdowns() {
    $$('[data-countdown]').forEach(function (el) {
      var raw = el.getAttribute('data-countdown'), target = raw === 'week' ? weekEnd() : Date.parse(raw);
      if (!target || isNaN(target)) return;
      var section = el.closest('section') || doc;
      var dateEl = $('[data-countdown-date]', section);
      if (dateEl) {
        var d = new Date(target + 345 * 60000), pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
        dateEl.innerHTML = '<small>ENDS</small>' + pad2(d.getUTCDate()) + '.' + pad2(d.getUTCMonth() + 1);
      }
      var unit = function (u) { return $('[data-unit="' + u + '"]', el); };
      var tick = function () {
        var left = Math.max(0, target - Date.now());
        if (left <= 0) { el.hidden = true; return false; }
        var s = Math.floor(left / 1000), dd = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        var de = unit('d');
        if (de) {
          de.textContent = dd + 'd';
          var box = de.closest('[data-unit-box]');
          if (box) box.hidden = dd === 0;
          else { de.hidden = dd === 0; if (de.nextElementSibling) de.nextElementSibling.hidden = dd === 0; }
        }
        if (unit('h')) unit('h').textContent = p(hh);
        if (unit('m')) unit('m').textContent = p(mm);
        if (unit('s')) unit('s').textContent = p(ss);
        el.hidden = false;
        return true;
      };
      if (tick()) var iv = setInterval(function () { if (!tick()) clearInterval(iv); }, 1000);
    });
  }

  /* ------------------------------------------------------------------ images: show the category icon when a photo is missing */
  function markBroken(img) { var m = img.closest('.akku-media'); if (m && !img.closest('.featured-bundle__products-grid')) m.classList.add('is-broken'); else img.style.visibility = 'hidden'; }
  function watchImages(scope) {
    $$('img', scope).forEach(function (img) { if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) markBroken(img); });
  }
  doc.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'IMG') markBroken(e.target); }, true);

  /* ------------------------------------------------------------------ quick view */
  function quickView(p) {
    var old = $('#akkuQuickView'); if (old) old.remove();
    var d = A.discount(p), wrap = doc.createElement('div');
    wrap.className = 'akku-modal'; wrap.id = 'akkuQuickView';
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', A.shortName(p));
    wrap.innerHTML = '<div class="akku-modal__backdrop" data-close></div><div class="akku-modal__panel akku-quickview">' +
      '<button type="button" class="akku-modal__close" data-close aria-label="Close"><i class="fas fa-times"></i></button>' +
      '<div class="akku-quickview__media ' + A.mediaClass(p) + '">' + A.media(p, 600, 500) + (d ? '<span class="akku-quickview__badge">-' + d + '%</span>' : '') + '</div>' +
      '<div class="akku-quickview__body"><p class="akku-quickview__brand">' + A.esc(p.brand) + ' &middot; ' + A.esc(A.categoryName(p)) + '</p>' +
      '<h3>' + A.esc(p.name) + '</h3>' +
      ((p.chips || []).length ? '<ul class="akku-quickview__chips">' + p.chips.map(function (c) { return '<li>' + A.esc(c) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="akku-quickview__price">' + A.render.prices(p, 'price-current', 'price-original') + '</div>' +
      '<div class="akku-quickview__actions"><button type="button" class="btn btn-primary" data-action="add-to-cart" data-pid="' + p.id + '"' + (p.stock === 'out' && !p.ask ? ' disabled' : '') + '><i class="fas ' + (p.ask ? 'fa-comment-dollar' : 'fa-shopping-cart') + '"></i> ' + (p.ask ? 'Ask for price' : p.stock === 'out' ? 'Sold out' : 'Add to Cart') + '</button>' +
      '<a class="btn btn-secondary" href="' + A.productUrl(p) + '">View Details</a></div></div></div>';
    doc.body.appendChild(wrap);
    doc.body.style.overflow = 'hidden';
    A.refresh(wrap);
    var close = function () { wrap.remove(); doc.body.style.overflow = ''; doc.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    doc.addEventListener('keydown', onKey);
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    $('.akku-modal__close', wrap).focus();
  }
  A.quickView = quickView;

  /* ------------------------------------------------------------------ product actions (delegated) */
  doc.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action'), id = btn.getAttribute('data-pid'), p = id && A.product(id);
    if (action === 'add-to-cart' && p) {
      e.preventDefault();
      if (p.ask) { window.location.href = A.productUrl(p) + '#ask'; return; }
      if (p.options && p.options.length && !btn.hasAttribute('data-options')) { window.location.href = A.productUrl(p); return; }
      if (cart.add(id, Number(btn.getAttribute('data-qty')) || 1)) A.toast(A.shortName(p) + ' added to your cart', { href: A.root + 'cart.html', linkText: 'View cart' });
    } else if (action === 'wishlist' && p) {
      e.preventDefault();
      var on = A.wishlist.toggle(id);
      if (on) A.track('AddToWishlist', { items: [{ id: p.id, name: p.name, price: p.ask ? 0 : p.price, brand: p.brand }] });
      A.toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist', { type: on ? 'success' : 'info', href: on ? A.root + 'wishlist.html' : '', linkText: 'View' });
    } else if (action === 'compare' && p) {
      e.preventDefault();
      if (!A.compare.has(id) && A.compare.all().length >= 4) { A.toast('You can compare up to 4 products. Remove one first.', { type: 'info', href: A.root + 'compare.html', linkText: 'Open compare' }); return; }
      var added = A.compare.toggle(id);
      A.toast(added ? 'Added to compare (' + A.compare.all().length + '/4)' : 'Removed from compare', { type: added ? 'success' : 'info', href: added ? A.root + 'compare.html' : '', linkText: 'Compare' });
    } else if (action === 'quickview' && p) {
      e.preventDefault(); quickView(p);
    }
  });

  /* ------------------------------------------------------------------ marketing: where visitors came from, and events for the ad tags */
  /* first and latest arrival from an ad, a link or another site (utm tags, ad click ids, referrer); sent with orders and quotes */
  (function rememberArrival() {
    try {
      var qs = new URLSearchParams(location.search), t = {}, has = false;
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid'].forEach(function (k) { var v = qs.get(k); if (v) { t[k] = v.slice(0, 300); has = true; } });
      var ref = doc.referrer && doc.referrer.indexOf(location.origin) !== 0 ? doc.referrer.slice(0, 300) : '';
      if (!has && !ref) return;
      if (ref) t.referrer = ref;
      t.landing = (location.pathname + location.search).slice(0, 300); t.at = new Date().toISOString();
      var a = store.get('attr', {}) || {};
      if (!a.first) a.first = t;
      a.last = t; store.set('attr', a);
    } catch (e) {}
  })();
  A.attribution = function () { return store.get('attr', null); };
  /* the ids the ad tags keep in cookies, so the server can match its events to this visitor */
  A.trackingIds = function () {
    var c = {}, out = {};
    String(doc.cookie || '').split(';').forEach(function (x) { var i = x.indexOf('='); if (i > 0) c[x.slice(0, i).trim()] = decodeURIComponent(x.slice(i + 1).trim()); });
    var g = /^GA\d\.\d\.(\d+\.\d+)$/.exec(c._ga || ''); if (g) out.ga = g[1];
    if (c._fbp) out.fbp = c._fbp;
    var last = (store.get('attr', {}) || {}).last || {};
    if (c._fbc) out.fbc = c._fbc; else if (last.fbclid) out.fbc = 'fb.1.' + (Date.parse(last.at) || Date.now()) + '.' + last.fbclid;
    if (c._ttp) out.ttp = c._ttp;
    if (last.ttclid) out.ttclid = last.ttclid;
    return out;
  };
  /* replaced by js/analytics.js when an ad or analytics tag is set up */
  A.track = function () {};

  /* ------------------------------------------------------------------ server API (when the store runs on the Akku.GG server) */
  A.api = function (method, path, body) {
    return fetch(A.root + 'api/' + path, {
      method: method, credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var err = new Error(data.error || 'Something went wrong. Please try again.'); err.status = res.status; err.data = data; throw err; }
        return data;
      });
    }, function () { var err = new Error('We could not reach the store. Check your connection and try again.'); err.status = 0; err.data = {}; throw err; });
  };
  /* show a server error on a form: field messages next to inputs, the main message as a toast */
  A.formErrors = function (form, err, map) {
    var fields = (err.data && err.data.fields) || {}, first = null;
    Object.keys(fields).forEach(function (k) {
      var el = form.elements[(map && map[k]) || k] || form.querySelector('#' + ((map && map[k]) || k));
      if (!el || !el.classList) return;
      el.classList.add('is-invalid'); el.setAttribute('aria-invalid', 'true');
      var slot = form.querySelector('[data-error-for="' + el.id + '"]') || (el.closest('.form-group') && el.closest('.form-group').querySelector('.error-message'));
      if (slot) { slot.textContent = fields[k]; slot.style.display = 'block'; }
      first = first || el;
    });
    if (first) first.focus();
    A.toast(err.message, { type: 'error', duration: 7000 });
  };
  /* hand the customer to the payment provider: a signed form POST (eSewa, connectIPS) or a redirect (Khalti, Fonepay) */
  A.goPay = function (next, fallback) {
    if (next && next.type === 'redirect' && next.url) { window.location.href = next.url; return true; }
    if (next && next.type === 'form' && next.action) {
      var f = doc.createElement('form'); f.method = 'POST'; f.action = next.action; f.hidden = true;
      Object.keys(next.fields || {}).forEach(function (k) { var i = doc.createElement('input'); i.type = 'hidden'; i.name = k; i.value = next.fields[k]; f.appendChild(i); });
      doc.body.appendChild(f); f.submit(); return true;
    }
    if (fallback) window.location.href = fallback;
    return false;
  };
  A.me = null;
  A.session = function () {
    if (!A.site.backend) return Promise.resolve(null);
    if (A._session) return A._session;
    A._session = A.api('GET', 'session').then(function (r) { A.me = r.customer || null; applySession(); emit('session'); return A.me; }, function () { return null; });
    return A._session;
  };
  function applySession() {
    var c = A.me;
    $$('[data-account-link]').forEach(function (a) { a.setAttribute('href', A.root + (c ? 'account.html' : 'login.html')); var i = $('i', a); if (i) i.className = c ? 'fas fa-user-circle' : 'fas fa-sign-in-alt'; });
    $$('[data-account-name]').forEach(function (el) { el.textContent = c ? c.name.split(' ')[0] : (el.closest('.profile-card') ? 'Guest' : 'Login'); });
    $$('[data-account-email]').forEach(function (el) { el.textContent = c ? c.email : 'Saved on this device'; });
    $$('[data-signout]').forEach(function (b) { b.hidden = !c; });
    $$('[data-guest-note]').forEach(function (n) { n.hidden = !!c; });
  }
  A.signOut = function () {
    return A.api('POST', 'auth/logout', {}).then(function () { A.me = null; A._session = null; window.location.href = A.root + 'index.html'; });
  };
  /* keep the wishlist on the account, so it follows the customer to other devices */
  function syncWishlist() {
    if (!A.me) return;
    var local = A.wishlist.ids ? A.wishlist.ids() : store.get('wishlist', []);
    A.api('GET', 'account/wishlist').then(function (r) {
      var merged = local.slice(); (r.ids || []).forEach(function (id) { if (merged.indexOf(id) < 0 && A.product(id)) merged.push(id); });
      if (merged.length !== local.length) { store.set('wishlist', merged); emit('wishlist'); }
      if (merged.length !== (r.ids || []).length) A.api('PUT', 'account/wishlist', { ids: merged }).catch(function () {});
      var t = null;
      doc.addEventListener('akku:wishlist', function () { clearTimeout(t); t = setTimeout(function () { A.api('PUT', 'account/wishlist', { ids: store.get('wishlist', []) }).catch(function () {}); }, 800); });
    }).catch(function () {});
  }

  /* ------------------------------------------------------------------ newsletter */
  function initNewsletter() {
    $$('[data-newsletter]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('input[type="email"]', form), ok = input && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
        if (!ok) { A.toast('Please enter a valid email address.', { type: 'error' }); if (input) input.focus(); return; }
        if (!A.site.backend) { A.toast('Newsletter sign-up is not connected yet, so this address was not saved.', { type: 'info', duration: 6000 }); return; }
        var btn = $('button', form); if (btn) btn.disabled = true;
        A.api('POST', 'newsletter', { email: input.value.trim(), source: 'footer' })
          .then(function (r) { A.toast(r.message, { type: 'success' }); form.reset(); }, function (err) { A.toast(err.message, { type: 'error' }); })
          .then(function () { if (btn) btn.disabled = false; });
      });
    });
  }

  /* ------------------------------------------------------------------ quotation and back-in-stock requests */
  function formMsg(form, text, ok) { var m = $('[data-form-msg]', form); if (m) { m.textContent = text; m.className = 'akku-form-msg ' + (ok ? 'is-ok' : 'is-error'); } }
  A.formMsg = formMsg;
  A.whatsappLink = function (text) { var n = String((A.site.contact || {}).whatsapp || '').replace(/\D/g, ''); return n ? 'https://wa.me/' + (n.length === 10 ? '977' + n : n) + '?text=' + encodeURIComponent(text) : ''; };
  /* body: { items: [{ id, qty }] } or { build: { name, parts } }; waText: the same request as a WhatsApp message (used when there is no server) */
  A.requestQuote = function (form, body, waText) {
    var get = function (n) { var el = form.elements[n]; return el ? el.value.trim() : ''; };
    if (get('website')) return Promise.resolve(null);
    body.name = get('name'); body.phone = get('phone'); body.email = get('email'); body.note = get('note');
    if (body.name.length < 2) { formMsg(form, 'Please enter your name.'); form.elements.name.focus(); return Promise.resolve(null); }
    if (!A.validPhone(body.phone)) { formMsg(form, 'Enter a valid phone number, for example 98XXXXXXXX.'); form.elements.phone.focus(); return Promise.resolve(null); }
    if (!A.site.backend) {
      var link = A.whatsappLink(waText + '\nName: ' + body.name + '\nPhone: ' + body.phone + (body.note ? '\nNote: ' + body.note : ''));
      if (link) { window.open(link, '_blank', 'noopener'); formMsg(form, 'WhatsApp opened with your request. Send the message to reach us.', true); }
      else formMsg(form, 'Quotation requests are not connected yet. Please call or message us.');
      return Promise.resolve(null);
    }
    body.attribution = A.attribution(); body.analytics = A.trackingIds(); body.url = location.href;
    var btn = $('[type="submit"]', form); if (btn) btn.disabled = true;
    return A.api('POST', 'quotes', body).then(function (r) {
      form.reset(); formMsg(form, r.message, true);
      if (r.whatsapp) $('[data-form-msg]', form).insertAdjacentHTML('beforeend', ' <a href="' + A.esc(r.whatsapp) + '" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Send it on WhatsApp too</a>');
      A.track('Lead', { eventId: 'lead-' + r.id, value: 0, label: 'quotation' });
      return r;
    }, function (err) { formMsg(form, err.message); return null; }).then(function (r) { if (btn) btn.disabled = false; return r; });
  };
  function initForms() {
    /* "Pairs well with": add the product and its partners in one go */
    doc.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-bundle]');
      if (!b) return;
      var ids = b.getAttribute('data-bundle').split(','), added = ids.filter(function (id) { return cart.add(id, 1); });
      A.toast(added.length ? added.length + ' products added to your cart' : 'These products are not available right now.', { type: added.length ? 'success' : 'info', href: A.root + 'cart.html', linkText: 'View cart' });
    });
    doc.addEventListener('submit', function (e) {
      var f = e.target;
      if (f.matches && f.matches('[data-question-form]')) {
        e.preventDefault();
        var name = f.elements.name.value.trim(), q = f.elements.question.value.trim(), contact = f.elements.contact.value.trim();
        if (f.elements.website.value) return;
        if (name.length < 2) { formMsg(f, 'Please enter your name.'); f.elements.name.focus(); return; }
        if (q.length < 8) { formMsg(f, 'Write your question (a sentence is enough).'); f.elements.question.focus(); return; }
        if (!A.site.backend) {
          var link = A.whatsappLink('Hi ' + A.site.brand.name + ', a question about ' + ((A.product(f.getAttribute('data-pid')) || {}).name || 'a product') + ': ' + q);
          if (link) { window.open(link, '_blank', 'noopener'); formMsg(f, 'WhatsApp opened with your question.', true); } else formMsg(f, 'Questions are not connected yet. Please contact us.');
          return;
        }
        var qb = $('[type="submit"]', f); qb.disabled = true;
        A.api('POST', 'questions', { productId: f.getAttribute('data-pid'), name: name, contact: contact, question: q })
          .then(function (r) { f.reset(); formMsg(f, r.message, true); }, function (err) { formMsg(f, err.message); })
          .then(function () { qb.disabled = false; });
        return;
      }
      if (f.matches && f.matches('[data-quote-form]')) {
        e.preventDefault();
        var p = A.product(f.getAttribute('data-pid'));
        A.requestQuote(f, { items: [{ id: f.getAttribute('data-pid'), qty: 1 }] }, 'Hi ' + A.site.brand.name + ', what is the price of ' + (p ? p.name : 'this product') + '?\n' + location.href);
      }
      if (f.matches && f.matches('[data-booking-form]')) {
        e.preventDefault();
        var bd = {}; ['name', 'phone', 'address', 'area', 'day', 'slot', 'pcs', 'problem', 'website'].forEach(function (k) { if (f.elements[k]) bd[k] = f.elements[k].value.trim(); });
        if (bd.website) return;
        if (bd.name.length < 2) { formMsg(f, 'Please enter your name.'); f.elements.name.focus(); return; }
        if (!A.validPhone(bd.phone)) { formMsg(f, 'Enter a valid phone number, for example 98XXXXXXXX.'); f.elements.phone.focus(); return; }
        if (!bd.day) { formMsg(f, 'Choose a day.'); f.elements.day.focus(); return; }
        if (!A.site.backend) { var wl = A.whatsappLink('Hi ' + A.site.brand.name + ', I would like a home servicing visit on ' + bd.day + ' (' + bd.slot + ').\nName: ' + bd.name + '\nAddress: ' + bd.address + '\n' + bd.problem); if (wl) window.open(wl, '_blank', 'noopener'); formMsg(f, wl ? 'WhatsApp opened with your request.' : 'Bookings are not connected yet. Please call us.', !!wl); return; }
        var bb = $('[type="submit"]', f); bb.disabled = true;
        A.api('POST', 'bookings', bd).then(function (r) { f.reset(); formMsg(f, r.message, true); A.track('Lead', { eventId: 'lead-' + r.id, value: 0, label: 'home servicing' }); }, function (err) { formMsg(f, err.message); })
          .then(function () { bb.disabled = false; });
        return;
      }
      if (f.matches && f.matches('[data-warranty-form]')) {
        e.preventDefault();
        var sn = f.elements.serial.value.trim();
        if (sn.length < 3) { formMsg(f, 'Type the serial number.'); return; }
        if (!A.site.backend) { formMsg(f, 'The warranty check is not connected yet. Please contact us with your serial number.'); return; }
        A.api('GET', 'warranty/' + encodeURIComponent(sn)).then(function (r) {
          var m = $('[data-form-msg]', f);
          if (!r.found) { formMsg(f, 'We could not find that serial number. Check it, or contact us with your invoice.'); return; }
          var day = function (d) { return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
          m.className = 'akku-form-msg akku-warranty-result';
          m.innerHTML = '<strong>' + A.esc(r.product) + '</strong><br>' + (r.status === 'sold' ? (r.soldOn ? 'Sold on ' + day(r.soldOn) + (r.deliveredOn && r.deliveredOn !== r.soldOn ? ', delivered on ' + day(r.deliveredOn) : '') + '. ' : '') +
            (r.until ? (r.covered ? 'Covered by our warranty until <strong>' + day(r.until) + '</strong>.' : 'Our warranty ended on ' + day(r.until) + '.') : r.deliveredOn ? 'Contact us about its warranty.' : 'Its warranty starts when it is delivered.') : r.status === 'in_stock' ? 'This unit has not been sold yet.' : 'Contact us about this unit.');
        }, function (err) { formMsg(f, err.message); });
        return;
      }
      if (f.matches && f.matches('[data-stock-alert]')) {
        e.preventDefault();
        var v = f.elements.contact.value.trim(), email = v.indexOf('@') > 0, pr = A.product(f.getAttribute('data-pid'));
        if (!v || (email ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : !A.validPhone(v))) { formMsg(f, 'Enter your phone number (98XXXXXXXX) or email.'); f.elements.contact.focus(); return; }
        if (!A.site.backend) {
          var link = A.whatsappLink('Hi ' + A.site.brand.name + ', please tell me when ' + (pr ? pr.name : 'this product') + ' is back in stock.\n' + location.href);
          if (link) { window.open(link, '_blank', 'noopener'); formMsg(f, 'WhatsApp opened with your request.', true); } else formMsg(f, 'Stock alerts are not connected yet. Please call us.');
          return;
        }
        var b = $('[type="submit"]', f); b.disabled = true;
        A.api('POST', 'stock-alerts', { productId: f.getAttribute('data-pid'), email: email ? v : '', phone: email ? '' : v })
          .then(function (r) { formMsg(f, r.message, true); f.elements.contact.value = ''; }, function (err) { formMsg(f, err.message); })
          .then(function () { b.disabled = false; });
      }
    });
  }

  /* ------------------------------------------------------------------ floating WhatsApp button (Settings → Shop) */
  function initWhatsAppButton() {
    if (!(A.site.features && A.site.features.whatsappButton)) return;
    var page = doc.body.getAttribute('data-page') || '';
    if (['checkout', 'cart'].indexOf(page) !== -1) return;
    var h1 = doc.querySelector('h1'), name = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
    var link = A.whatsappLink('Hi ' + A.site.brand.name + (page === 'product' && name ? ', I have a question about ' + name + ': ' + location.href.split('#')[0] : ', I have a question.'));
    if (!link) return;
    var a = doc.createElement('a'); a.className = 'akku-wa'; a.href = link; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Chat with us on WhatsApp'); a.title = 'Chat with us on WhatsApp';
    a.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i>';
    doc.body.appendChild(a);
  }

  /* ------------------------------------------------------------------ promo popup: once per campaign (Settings → Promo popup) */
  function initPromo() {
    var p = A.site.promo;
    if (!p || !p.enabled || !(p.title || p.image)) return;
    var page = doc.body.getAttribute('data-page') || '';
    if (p.where === 'home' && page !== 'home') return;
    if (['checkout', 'cart', 'order', 'account'].indexOf(page) !== -1) return;
    var seenKey = 'promo:' + (p.campaign || p.title || 'x');
    if (store.get(seenKey, false)) return;
    setTimeout(function () {
      var el = doc.createElement('div'); el.className = 'akku-promo'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', p.title || 'Offer');
      el.innerHTML = '<div class="akku-promo__box"><button type="button" class="akku-promo__close" data-promo-close aria-label="Close">&times;</button>' + (p.image ? '<img src="' + A.esc(A.url(p.image)) + '" alt="">' : '') +
        '<div class="akku-promo__body">' + (p.title ? '<h2>' + A.esc(p.title) + '</h2>' : '') + (p.text ? '<p>' + A.esc(p.text) + '</p>' : '') + (p.link ? '<a class="btn btn-primary" data-promo-go href="' + A.esc(A.url(p.link)) + '">' + A.esc(p.button || 'See the offer') + '</a>' : '') + '</div></div>';
      doc.body.appendChild(el);
      store.set(seenKey, true);
      var close = function () { el.remove(); };
      el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-promo-close]')) close(); });
      doc.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); doc.removeEventListener('keydown', k); } });
      var b = $('[data-promo-close]', el); if (b) b.focus();
    }, (p.delay === '' || p.delay == null || !isFinite(Number(p.delay)) || Number(p.delay) < 0 ? 4 : Math.min(60, Number(p.delay))) * 1000);
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    initHeader(); initSettings(); initSearch(); initNewsletter(); initForms(); initPromo(); initWhatsAppButton();
    var dayIn = $('[data-booking-form] [name="day"]');
    if (dayIn) { var t0 = new Date(Date.now() + 345 * 60000), days = (A.site.servicing && A.site.servicing.daysAhead) || 30; dayIn.min = t0.toISOString().slice(0, 10); dayIn.max = new Date(t0.getTime() + days * 864e5).toISOString().slice(0, 10); }
    A.initCarousels(); initScrollers(); initCountdowns();
    updateBadges(); A.refresh();
    ['cart', 'wishlist', 'compare', 'orders'].forEach(function (n) { doc.addEventListener('akku:' + n, function () { updateBadges(); markStates(); }); });
    window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('akku.') === 0) { updateBadges(); markStates(); emit('sync'); } });
    if (A.site.backend) {
      A.session().then(syncWishlist);
      doc.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-signout]'); if (b) { e.preventDefault(); A.signOut(); } });
    }
    doc.documentElement.classList.add('akku-ready');
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
