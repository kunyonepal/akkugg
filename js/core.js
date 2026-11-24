/* Akku.GG core — shared by the build (Node) and the browser.
   Formatting, catalogue lookups, search, and the product-card templates. No DOM access here. */
(function (root) {
  'use strict';
  var A = root.Akku = root.Akku || {};
  A.site = A.site || {};
  A.catalog = A.catalog || { categories: [], products: [], builderPresets: [] };
  if (typeof A.root !== 'string') A.root = '';

  /* ---------- small helpers ---------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  A.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  A.url = function (path) { return /^(https?:|data:|#|mailto:|tel:)/.test(path) ? path : A.root + path; };

  /* ---------- catalogue lookups ---------- */
  var idx = null;
  function index() {
    if (idx) return idx;
    idx = { p: {}, c: {}, s: {} };
    A.catalog.products.forEach(function (p) { idx.p[p.id] = p; });
    A.catalog.categories.forEach(function (c) {
      idx.c[c.id] = c;
      (c.subcategories || []).forEach(function (s) { idx.s[s.id] = { sub: s, cat: c }; });
    });
    return idx;
  }
  A.reindex = function () { idx = null; };
  A.product = function (id) { return index().p[id] || null; };
  A.category = function (id) { return index().c[id] || null; };
  A.subcategory = function (id) { var e = index().s[id]; return e ? e.sub : null; };
  A.subcategoryParent = function (id) { var e = index().s[id]; return e ? e.cat : null; };
  A.productsIn = function (catId, subId) {
    return A.catalog.products.filter(function (p) { return (!catId || p.category === catId) && (!subId || p.subcategory === subId); });
  };
  A.collection = function (name) {
    return A.catalog.products.filter(function (p) { return (p.collections || []).indexOf(name) !== -1; });
  };
  A.discount = function (p) {
    return p && p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  };
  A.deals = function () {
    return A.catalog.products.filter(function (p) { return A.discount(p) > 0; });
  };
  A.icon = function (p) {
    var s = A.subcategory(p.subcategory), c = A.category(p.category);
    return (s && s.icon) || (c && c.icon) || 'fa-box';
  };
  A.categoryName = function (p) {
    var s = A.subcategory(p.subcategory), c = A.category(p.category);
    return (s && s.name) || (c && c.name) || '';
  };
  A.shortName = function (p) { return String(p.name).split(' - ')[0]; };

  /* ---------- URLs ---------- */
  A.productUrl = function (p) { return A.root + 'product/' + (p.id || p) + '.html'; };
  A.categoryUrl = function (catId, subId) { return A.root + catId + '.html' + (subId ? '#' + subId : ''); };

  /* ---------- money ---------- */
  A.deliveryAreas = function (site) {
    var d = (site || A.site || {}).delivery || {};
    return d.areas && d.areas.length ? d.areas : [{ id: 'home', title: d.homeTitle || 'Home Delivery', note: d.homeNote || '', fee: d.fee }];
  };
  A.currency = function () { return (A.prefs && A.prefs.currency) || 'NPR'; };
  A.money = function (amount, cur) {
    cur = cur || A.currency();
    var c = A.site.currency || {};
    var n = Math.round(Number(amount) || 0);
    if (cur === 'USD' && c.usdRate > 0) {
      return '≈ $' + Math.round(n / c.usdRate).toLocaleString('en-US');
    }
    return (c.symbol || 'Rs.') + ' ' + n.toLocaleString('en-US');
  };
  /* price span the browser can re-render when the currency preference changes */
  A.priceSpan = function (cls, amount) {
    return '<span class="' + cls + '" data-price="' + Math.round(amount) + '">' + A.money(amount, 'NPR') + '</span>';
  };

  /* ---------- images ---------- */
  A.img = function (src, w, h) {
    if (!src) return '';
    if (/^https:\/\/images\.unsplash\.com\//.test(src)) {
      return src.split('?')[0] + '?w=' + w + '&h=' + (h || w) + '&fit=crop&q=80&auto=format';
    }
    return A.url(src);
  };
  /* <img> plus an icon that shows when the product has no photo (or the photo fails to load) */
  A.media = function (p, w, h, alt) {
    var src = A.img(p.image, w, h);
    var ph = '<i class="akku-ph fas ' + A.icon(p) + '" aria-hidden="true"></i>';
    if (!src) return ph;
    return ph + '<img src="' + A.esc(src) + '" alt="' + A.esc(alt || A.shortName(p)) + '" loading="lazy" decoding="async" width="' + w + '" height="' + (h || w) + '">';
  };
  A.mediaClass = function (p) { return 'akku-media' + (p.image ? '' : ' is-empty'); };

  /* ---------- facets: values the listing filters work on ---------- */
  function specOf(p, key) { return (p.specs && p.specs[key]) || ''; }
  A.facetDefs = [
    { key: 'proc', label: 'Processor', get: function (p) {
      if (p.category !== 'laptops' && p.category !== 'desktops') return '';
      var s = specOf(p, 'Processor'), m;
      if ((m = /Ultra\s*(\d)/i.exec(s))) return 'Intel Core Ultra ' + m[1];
      if ((m = /\bi([3579])\b|\bi([3579])-/i.exec(s))) return 'Intel Core i' + (m[1] || m[2]);
      if ((m = /Ryzen\s*(\d)/i.exec(s))) return 'AMD Ryzen ' + m[1];
      if (/\bM\d/i.test(s)) return 'Apple M-series';
      return '';
    } },
    { key: 'ram', label: 'RAM', numeric: true, get: function (p) {
      if (p.category !== 'laptops' && p.category !== 'desktops') return '';
      var m = /(\d+)\s*GB/i.exec(specOf(p, 'Memory')); return m ? m[1] + 'GB' : '';
    } },
    { key: 'storage', label: 'Storage', numeric: true, get: function (p) {
      if (['laptops', 'desktops', 'mobiles'].indexOf(p.category) === -1) return '';
      var m = /(\d+)\s*(TB|GB)/i.exec(specOf(p, 'Storage')); return m ? m[1] + m[2].toUpperCase() : '';
    } },
    { key: 'conn', label: 'Connectivity', get: function (p) {
      var s = specOf(p, 'Connectivity');
      if (!s) return '';
      if (/wireless|bluetooth/i.test(s)) return 'Wireless';
      if (/wired/i.test(s)) return 'Wired';
      if (/usb/i.test(s)) return 'USB';
      return '';
    } }
  ];
  /* filters a category defines in its settings ("filters": [{ key, label, unit }]); products hold the values in "facets" */
  A.categoryFacets = function () {
    var out = [];
    ((A.catalog && A.catalog.categories) || []).forEach(function (c) {
      (c.filters || []).forEach(function (f) {
        if (!f || !f.key) return;
        out.push({ key: 'x-' + String(f.key).replace(/[^a-z0-9-]/gi, '').toLowerCase(), label: f.label || f.key, numeric: !!f.unit, get: function (p) {
          var v = p.category === c.id && p.facets ? p.facets[f.key] : '';
          return v ? String(v) + (f.unit && /\d$/.test(String(v)) ? ' ' + f.unit : '') : '';
        } });
      });
    });
    return out;
  };
  A.allFacets = function () { return A.facetDefs.concat(A.categoryFacets()); };
  A.facets = function (p) {
    var out = {};
    A.allFacets().forEach(function (f) { var v = f.get(p); if (v) out[f.key] = v; });
    return out;
  };
  A.sizeInGb = function (s) { var m = /(\d+)\s*(TB|GB)/i.exec(s || ''); return m ? Number(m[1]) * (m[2].toUpperCase() === 'TB' ? 1024 : 1) : 0; };

  /* ---------- badges ---------- */
  var BADGES = { 'new': ['badge-new', 'New'], hot: ['badge-hot', 'Hot'], gaming: ['badge-gaming', 'Gaming'], bestseller: ['badge-bestseller', 'Bestseller'], trending: ['badge-trending', 'Trending'] };

  /* ---------- search ---------- */
  A.search = function (query, limit) {
    var words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var scored = [];
    A.catalog.products.forEach(function (p) {
      var name = p.name.toLowerCase(), brand = (p.brand || '').toLowerCase(), cat = (A.categoryName(p) + ' ' + ((A.category(p.category) || {}).name || '')).toLowerCase();
      var extra = ((p.chips || []).join(' ') + ' ' + Object.keys(p.specs || {}).map(function (k) { return p.specs[k]; }).join(' ')).toLowerCase();
      var score = 0, all = true;
      words.forEach(function (w) {
        var s = 0;
        if (name.indexOf(w) === 0) s = 12;
        else if (new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(name)) s = 9;
        else if (name.indexOf(w) !== -1) s = 6;
        else if (brand.indexOf(w) !== -1) s = 6;
        else if (cat.indexOf(w) !== -1 || cat.indexOf(w.replace(/s$/, '')) !== -1) s = 4;
        else if (extra.indexOf(w) !== -1) s = 2;
        if (!s) all = false;
        score += s;
      });
      if (all) scored.push([score, p]);
    });
    scored.sort(function (a, b) { return b[0] - a[0] || a[1].price - b[1].price; });
    var out = scored.map(function (x) { return x[1]; });
    return limit ? out.slice(0, limit) : out;
  };

  /* ---------- templates ---------- */
  var R = A.render = {};

  R.prices = function (p, curCls, oldCls) {
    if (p.ask) return '<span class="' + (curCls || 'price__current') + ' price-ask">Ask for price</span>';
    return A.priceSpan(curCls || 'price__current', p.price) + (A.discount(p) ? A.priceSpan(oldCls || 'price__old', p.oldPrice) : '');
  };

  R.stars = function (rating) {
    var full = Math.floor(rating), half = rating - full >= 0.5, out = '';
    for (var i = 0; i < 5; i++) out += i < full ? '<i class="fas fa-star"></i>' : (i === full && half ? '<i class="fas fa-star-half-alt"></i>' : '<i class="far fa-star"></i>');
    return out;
  };

  /* Home: "Deals of the Week" card */
  R.dealCard = function (p) {
    var d = A.discount(p), tags = (p.chips || []).slice(0, 4);
    return '<a href="' + A.productUrl(p) + '" class="deal__card" data-pid="' + p.id + '">' +
      (d ? '<div class="deal__badge">-' + d + '%</div>' : '') +
      '<div class="deal__image ' + A.mediaClass(p) + '">' + A.media(p, 400, 400) +
        (tags.length ? '<div class="deal__specs">' + tags.map(function (t) { return '<span class="spec__tag">' + A.esc(t) + '</span>'; }).join('') + '</div>' : '') +
      '</div>' +
      '<div class="deal__info"><p class="deal__category">' + A.esc(A.categoryName(p)) + '</p>' +
        '<h3 class="deal__title">' + A.esc(A.shortName(p)) + '</h3>' +
        '<div class="deal__price">' + R.prices(p) + '</div></div></a>';
  };

  /* Home: "Top Selling" card */
  R.topSellingCard = function (p) {
    var d = A.discount(p);
    return '<a href="' + A.productUrl(p) + '" class="top-selling__card" data-pid="' + p.id + '">' +
      (d ? '<div class="top-selling__badge">-' + d + '%</div>' : '') +
      '<div class="top-selling__image ' + A.mediaClass(p) + '">' + A.media(p, 400, 400) + '</div>' +
      '<div class="top-selling__info"><p class="top-selling__category">' + A.esc(A.categoryName(p)) + '</p>' +
        '<h3 class="top-selling__product-title">' + A.esc(A.shortName(p)) + '</h3>' +
        '<div class="top-selling__price">' + R.prices(p) + '</div></div></a>';
  };

  /* Home: "Gaming Essentials" card */
  R.gamingCard = function (p) {
    var d = A.discount(p);
    return '<a href="' + A.productUrl(p) + '" class="gaming-product__card" data-pid="' + p.id + '">' +
      (d ? '<div class="gaming-product__badge">-' + d + '%</div>' : '') +
      '<div class="gaming-product__image ' + A.mediaClass(p) + '">' + A.media(p, 300, 300) + '</div>' +
      '<div class="gaming-product__info"><p class="gaming-product__category">' + A.esc(A.categoryName(p)) + '</p>' +
        '<h3 class="gaming-product__title">' + A.esc(A.shortName(p)) + '</h3>' +
        '<div class="gaming-product__price">' + R.prices(p) + '</div></div></a>';
  };

  /* Home: smartphone deal row */
  R.smartphoneCard = function (p) {
    var d = A.discount(p);
    return '<a href="' + A.productUrl(p) + '" class="smartphone-deal__card" data-pid="' + p.id + '">' +
      '<div class="smartphone-deal__image ' + A.mediaClass(p) + '">' + A.media(p, 200, 200) + '</div>' +
      '<div class="smartphone-deal__info"><p class="smartphone-deal__category">' + A.esc(A.categoryName(p)) + '</p>' +
        '<h3 class="smartphone-deal__title">' + A.esc(A.shortName(p)) + '</h3>' +
        '<div class="smartphone-deal__price">' + R.prices(p) + '</div>' +
        '<div class="smartphone-deal__badges">' + R.stockPill(p) + (d ? '<span class="badge-discount">-' + d + '% off</span>' : '') + '</div>' +
      '</div></a>';
  };
  R.stockPill = function (p) {
    return p.stock === 'out' ? '<span class="badge-btn badge-btn--muted">Out of stock</span>' : '<span class="badge-btn badge-btn--primary">' + (p.stock === 'low' ? 'Few left' : 'In stock') + '</span>';
  };

  /* Home: featured sidebar row */
  R.sidebarProduct = function (p) {
    return '<a href="' + A.productUrl(p) + '" class="sidebar__product" data-pid="' + p.id + '">' +
      '<div class="sidebar__product-image ' + A.mediaClass(p) + '">' + A.media(p, 200, 200) + '</div>' +
      '<div class="sidebar__product-info"><p class="sidebar__product-category">' + A.esc(A.categoryName(p)) + '</p>' +
        '<h3 class="sidebar__product-title h4">' + A.esc(A.shortName(p)) + '</h3>' +
        '<div class="sidebar__product-price">' + R.prices(p, 'price-current', 'price-old') + '</div></div></a>';
  };

  /* Listing pages: product card (grid / list view) */
  R.listingCard = function (p) {
    var d = A.discount(p), cat = A.category(p.category) || {};
    var icons = p.chipIcons || cat.chipIcons || [];
    var badges = (p.badges || []).map(function (b) { var def = BADGES[b]; return def ? '<span class="badge ' + def[0] + '">' + def[1] + '</span>' : ''; }).join('') +
      (d ? '<span class="badge badge-discount">-' + d + '%</span>' : '') + (p.stock === 'out' ? '<span class="badge badge-out">Sold out</span>' : '');
    var chips = (p.chips || []).slice(0, 3).map(function (c, i) { return '<span>' + (icons[i] ? '<i class="fas ' + icons[i] + '"></i> ' : '') + A.esc(c) + '</span>'; }).join('');
    var data = ' data-pid="' + p.id + '" data-price="' + p.price + '" data-brand="' + A.esc(p.brand) + '" data-sub="' + p.subcategory + '" data-cat="' + p.category + '" data-discount="' + d + '" data-stock="' + p.stock + '"' +
      ' data-new="' + ((p.badges || []).indexOf('new') !== -1 ? 1 : 0) + '" data-rank="' + (p.rank || 0) + '"';
    var f = A.facets(p);
    Object.keys(f).forEach(function (k) { data += ' data-f-' + k + '="' + A.esc(f[k]) + '"'; });
    return '<div class="product-card"' + data + '>' +
      '<div class="product-image ' + A.mediaClass(p) + '">' +
        '<a href="' + A.productUrl(p) + '" class="product-image__link" tabindex="-1" aria-hidden="true">' + A.media(p, 400, 300) + '</a>' +
        (badges ? '<div class="product-badges">' + badges + '</div>' : '') +
        '<div class="product-actions">' +
          '<button type="button" class="action-btn" data-action="wishlist" data-pid="' + p.id + '" title="Add to Wishlist" aria-label="Add to wishlist"><i class="far fa-heart"></i></button>' +
          '<button type="button" class="action-btn" data-action="quickview" data-pid="' + p.id + '" title="Quick View" aria-label="Quick view"><i class="fas fa-eye"></i></button>' +
          '<button type="button" class="action-btn" data-action="compare" data-pid="' + p.id + '" title="Compare" aria-label="Compare"><i class="fas fa-exchange-alt"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="product-content">' +
        '<div class="product-category">' + A.esc(p.brand) + '</div>' +
        '<h3 class="product-title"><a href="' + A.productUrl(p) + '">' + A.esc(p.name) + '</a></h3>' +
        (chips ? '<div class="product-specs">' + chips + '</div>' : '') +
        '<div class="product-price">' + R.prices(p, 'price-current', 'price-original') + '</div>' +
        '<button type="button" class="product-card__cart" data-action="add-to-cart" data-pid="' + p.id + '"' + (p.stock === 'out' && !p.ask ? ' disabled' : '') + '><i class="fas ' + (p.ask ? 'fa-comment-dollar' : 'fa-shopping-cart') + '"></i> ' + (p.ask ? 'Ask for price' : p.stock === 'out' ? 'Sold out' : 'Add to Cart') + '</button>' +
      '</div></div>';
  };

  /* Product page: related / recently viewed card */
  R.miniCard = function (p) {
    var d = A.discount(p);
    return '<div class="product-card" data-pid="' + p.id + '">' +
      '<div class="product-card__image ' + A.mediaClass(p) + '">' +
        '<a href="' + A.productUrl(p) + '" tabindex="-1" aria-hidden="true">' + A.media(p, 400, 300) + '</a>' +
        (d ? '<span class="badge-discount">' + d + '% OFF</span>' : '') +
        '<button class="btn-wishlist" type="button" data-action="wishlist" data-pid="' + p.id + '" aria-label="Add to wishlist"><i class="far fa-heart"></i></button>' +
      '</div>' +
      '<div class="product-card__content">' +
        '<h4 class="h5"><a href="' + A.productUrl(p) + '">' + A.esc(A.shortName(p)) + '</a></h4>' +
        ((p.chips || []).length ? '<p class="product-specs">' + p.chips.slice(0, 3).map(A.esc).join(' • ') + '</p>' : '') +
        '<div class="product-price">' + R.prices(p, 'current-price', 'original-price') + '</div>' +
      '</div></div>';
  };

  /* Search overlay result */
  R.searchResult = function (p) {
    return '<a href="' + A.productUrl(p) + '" class="result-card">' +
      '<span class="result-image ' + A.mediaClass(p) + '">' + A.media(p, 160, 160) + '</span>' +
      '<div class="result-content"><h4 class="result-title">' + A.esc(A.shortName(p)) + '</h4>' +
      (p.ask ? '<div class="result-price">Ask for price</div>' : '<div class="result-price" data-price="' + p.price + '">' + A.money(p.price, 'NPR') + '</div>') +
      '<div class="result-rating"><span class="count">' + A.esc(p.brand) + ' · ' + A.esc(A.categoryName(p)) + '</span></div></div></a>';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);
