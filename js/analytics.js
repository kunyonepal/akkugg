/* Ad and analytics tags, loaded only when their IDs are set (admin → Marketing & Google): Google Analytics 4, Google Tag
   Manager, Google Ads (conversions, enhanced conversions, dynamic remarketing), Meta Pixel and TikTok Pixel.
   Shop events (Akku.track) go to every tag that is set up. Conversions and product views also go to the store's server,
   which forwards them to the platforms' server APIs with the same event id, so each platform counts the event once. */
(function () {
  'use strict';
  var A = window.Akku, doc = document, a = (A.site && A.site.analytics) || {};
  var page = doc.body.getAttribute('data-page') || '';
  var ga = /^G-[A-Z0-9]+$/i.test(a.ga4 || '') ? a.ga4 : '', gtm = /^GTM-[A-Z0-9]+$/i.test(a.gtm || '') ? a.gtm : '';
  var aw = /^AW-\d+$/i.test(a.googleAds || '') ? a.googleAds : '', meta = /^\d{6,20}$/.test(a.metaPixel || '') ? a.metaPixel : '';
  var tt = /^[A-Z0-9]{8,40}$/i.test(a.tiktokPixel || '') ? a.tiktokPixel : '', labels = a.adsLabels || {}, enhanced = a.enhancedConversions !== false;
  var saved = A.store.get('customer', {}) || {};
  function load(src) { var s = doc.createElement('script'); s.async = true; s.src = src; doc.head.appendChild(s); }
  function phone977(p) { var d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.indexOf('977') === 0) return d; if (d.charAt(0) === '0') d = d.slice(1); return '977' + d; }

  /* ---------- cookie notice: off, a notice, or tags only after the visitor agrees (Settings → Cookie notice) ---------- */
  var mode = (A.site.consent && A.site.consent.mode) || 'off', started = false;
  function choice() { return A.store.get('consent', ''); }
  function allowed() { return mode !== 'optin' || choice() === 'yes'; }
  function banner() {
    if (doc.querySelector('.akku-consent')) return;
    var el = doc.createElement('div'); el.className = 'akku-consent'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Cookies');
    el.innerHTML = '<p>' + A.esc((A.site.consent && A.site.consent.text) || (mode === 'optin' ? 'We would like to use cookies from Google, Meta and TikTok to count visits and measure our ads.' : 'This site uses cookies from Google, Meta and TikTok to count visits and measure our ads.')) +
      ' <a href="' + A.root + 'cookie-policy.html">Cookie policy</a></p><div class="akku-consent__buttons">' +
      (mode === 'optin' ? '<button type="button" class="btn btn-primary" data-consent="yes">Accept</button><button type="button" class="btn btn-secondary" data-consent="no">No, thanks</button>' : '<button type="button" class="btn btn-primary" data-consent="ok">OK</button>') + '</div>';
    doc.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]'); if (!b) return;
      A.store.set('consent', b.getAttribute('data-consent')); el.remove();
      if (allowed()) startTags();
    });
  }
  doc.addEventListener('click', function (e) { var l = e.target.closest && e.target.closest('a[href$="#cookie-settings"]'); if (l && mode !== 'off') { e.preventDefault(); A.store.set('consent', ''); banner(); } });

  /* ---------- the tags ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  function startTags() {
  if (started) return;
  started = true;
  if (ga || aw) {
    window.gtag = gtag;
    gtag('js', new Date());
    if (ga) gtag('config', ga, { anonymize_ip: true });
    if (aw) gtag('config', aw, enhanced ? { allow_enhanced_conversions: true } : {});
    load('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga || aw));
    if (aw && enhanced && (saved.email || saved.phone)) gtag('set', 'user_data', { email: saved.email || undefined, phone_number: saved.phone ? '+' + phone977(saved.phone) : undefined });
  }
  if (gtm) { window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' }); load('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(gtm)); }
  if (meta) {
    var f = window.fbq = function () { if (f.callMethod) f.callMethod.apply(f, arguments); else f.queue.push(arguments); };
    if (!window._fbq) window._fbq = f;
    f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
    load('https://connect.facebook.net/en_US/fbevents.js');
    var match = { country: 'np' }, names = String(saved.fullName || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (saved.email) match.em = String(saved.email).trim().toLowerCase();
    if (saved.phone) match.ph = phone977(saved.phone);
    if (names.length) { match.fn = names[0]; if (names.length > 1) match.ln = names.slice(1).join(' '); }
    if (saved.city) match.ct = String(saved.city).toLowerCase().replace(/\s+/g, '');
    f('init', meta, match);
    f('track', 'PageView');
  }
  if (tt) {
    /* TikTok's loader, written out (the usual snippet is inline script, which this site's security policy blocks) */
    window.TiktokAnalyticsObject = 'ttq';
    var q = window.ttq = window.ttq || [];
    q.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
    q.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
    for (var i = 0; i < q.methods.length; i++) q.setAndDefer(q, q.methods[i]);
    q.instance = function (t) { for (var e = q._i[t] || [], n = 0; n < q.methods.length; n++) q.setAndDefer(e, q.methods[n]); return e; };
    q.load = function (id, opts) {
      var u = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      q._i = q._i || {}; q._i[id] = []; q._i[id]._u = u; q._t = q._t || {}; q._t[id] = +new Date(); q._o = q._o || {}; q._o[id] = opts || {};
      load(u + '?sdkid=' + encodeURIComponent(id) + '&lib=ttq');
    };
    q.load(tt);
    if (saved.email || saved.phone) q.identify({ email: saved.email || undefined, phone_number: saved.phone ? '+' + phone977(saved.phone) : undefined });
    q.page();
  }
  }
  if (allowed()) startTags();
  if (mode !== 'off' && !choice()) { if (doc.body) banner(); else doc.addEventListener('DOMContentLoaded', banner); }

  /* ---------- one shop event to every tag ---------- */
  var GA = { ViewContent: 'view_item', ViewCategory: 'view_item_list', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', AddPaymentInfo: 'add_payment_info', Purchase: 'purchase', Lead: 'generate_lead', Contact: 'contact', Search: 'search', AddToWishlist: 'add_to_wishlist', ShareBuild: 'share' };
  var TT = { ViewContent: 'ViewContent', AddToCart: 'AddToCart', InitiateCheckout: 'InitiateCheckout', AddPaymentInfo: 'AddPaymentInfo', Purchase: 'CompletePayment', Lead: 'SubmitForm', Contact: 'Contact', Search: 'Search', AddToWishlist: 'AddToWishlist' };
  var ADS = { Purchase: 'purchase', Lead: 'lead', Contact: 'contact', AddToCart: 'addToCart', InitiateCheckout: 'beginCheckout' };
  var META_STANDARD = { ViewContent: 1, AddToCart: 1, InitiateCheckout: 1, AddPaymentInfo: 1, Purchase: 1, Lead: 1, Contact: 1, Search: 1, AddToWishlist: 1 };
  var TO_SERVER = { ViewContent: 1, AddToCart: 1, InitiateCheckout: 1, AddPaymentInfo: 1, Contact: 1, Search: 1 };
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function fire(name, d) {
    if (!allowed()) return;
    d = d || {};
    var items = (d.items || []).filter(Boolean), cur = 'NPR', id = d.eventId || (name.toLowerCase() + '-' + uid());
    var value = d.value != null ? d.value : items.reduce(function (n, i) { return n + (i.price || 0) * (i.qty || 1); }, 0);
    var gaItems = items.map(function (i) { return { item_id: i.id, item_name: i.name, item_brand: i.brand, item_category: i.category, price: i.price, quantity: i.qty || 1 }; });
    try {
      if (ga) gtag('event', GA[name] || name.replace(/[A-Z]/g, function (c, k) { return (k ? '_' : '') + c.toLowerCase(); }), { currency: cur, value: value, transaction_id: d.orderId, search_term: d.search, items: gaItems, send_to: ga });
      if (gtm) { window.dataLayer.push({ ecommerce: null }); window.dataLayer.push({ event: GA[name] || name, event_id: id, ecommerce: { currency: cur, value: value, transaction_id: d.orderId, items: gaItems } }); }
      if (aw) {
        if (ADS[name] && labels[ADS[name]]) gtag('event', 'conversion', { send_to: aw + '/' + labels[ADS[name]], value: value, currency: cur, transaction_id: d.orderId || '' });
        if (GA[name] && items.length) gtag('event', GA[name], { send_to: aw, value: value, items: items.map(function (i) { return { id: i.id, google_business_vertical: 'retail' }; }) });
      }
      if (meta && window.fbq) {
        var md = { currency: cur, value: value };
        if (items.length) { md.content_type = 'product'; md.content_ids = items.map(function (i) { return i.id; }); md.contents = items.map(function (i) { return { id: i.id, quantity: i.qty || 1, item_price: i.price }; }); md.num_items = items.reduce(function (n, i) { return n + (i.qty || 1); }, 0); }
        if (d.search) md.search_string = d.search;
        if (d.label) md.content_name = d.label;
        window.fbq(META_STANDARD[name] ? 'track' : 'trackCustom', name, md, { eventID: id });
      }
      if (tt && window.ttq && TT[name]) window.ttq.track(TT[name], { currency: cur, value: value, query: d.search, content_type: items.length ? 'product' : undefined,
        contents: items.map(function (i) { return { content_id: i.id, content_name: i.name, quantity: i.qty || 1, price: i.price }; }) }, { event_id: id });
    } catch (e) { /* a tag that failed to load must not break the shop */ }
    if (A.site.backend && a.serverEvents && TO_SERVER[name]) {
      try { fetch(A.root + 'api/events', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, eventId: id, url: location.href, value: value, items: items.map(function (i) { return { id: i.id, name: i.name, price: i.price, qty: i.qty || 1 }; }), search: d.search, analytics: A.trackingIds() }) }).catch(function () {}); } catch (e) {}
    }
  }
  A.track = fire;
  doc.addEventListener('akku:track', function (e) { fire(e.detail.name, e.detail.data); });
  var item = function (p, qty) { return p ? { id: p.id, name: p.name, price: p.ask ? 0 : p.price, brand: p.brand, category: A.categoryName ? A.categoryName(p) : p.category, qty: qty || 1 } : null; };
  A.trackItem = item;

  /* ---------- what each page sends on its own ---------- */
  function onReady() {
    if (page === 'product') { var box = doc.querySelector('[data-buy-box][data-pid]'), p = box && A.product(box.getAttribute('data-pid')); if (p) fire('ViewContent', { items: [item(p)] }); }
    if (page === 'category' || page === 'products' || page === 'deals') {
      var ids = Array.prototype.slice.call(doc.querySelectorAll('.product-card[data-pid]'), 0, 10).map(function (el) { return item(A.product(el.getAttribute('data-pid'))); }).filter(Boolean);
      fire('ViewCategory', { items: ids, label: (doc.querySelector('h1') || {}).textContent || page, value: 0 });
    }
    if (page === 'search') { var s = new URLSearchParams(location.search).get('q'); if (s) fire('Search', { search: s.slice(0, 100), value: 0 }); }
    if (page === 'checkout' && A.cart.count()) fire('InitiateCheckout', { items: A.cart.lines().map(function (l) { return { id: l.custom ? 'custom-build' : l.id, name: l.name, price: l.price, qty: l.qty }; }) });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', onReady); else onReady();

  /* calls, WhatsApp, email and Viber buttons anywhere on the site */
  doc.addEventListener('click', function (e) {
    var l = e.target.closest && e.target.closest('a[href]');
    if (!l) return;
    var h = l.getAttribute('href') || '', kind = /^tel:/.test(h) ? 'call' : /wa\.me|whatsapp/.test(h) ? 'whatsapp' : /^mailto:/.test(h) ? 'email' : /^viber:/.test(h) ? 'viber' : '';
    if (kind) fire('Contact', { label: kind + (page ? ' · ' + page : ''), value: 0 });
  });

  /* the purchase, once per order, on the order confirmation page */
  doc.addEventListener('akku:orders', function () {
    var id = A.store.get('lastOrder', ''), o = id && A.orders.get(id);
    if (!o || o.status === 'pending_payment' || o.status === 'cancelled' || o._tracked) return;
    var c = o.customer || {};
    if (aw && enhanced && (c.email || c.phone)) gtag('set', 'user_data', { email: c.email || undefined, phone_number: c.phone ? '+' + phone977(c.phone) : undefined });
    fire('Purchase', { eventId: 'purchase-' + o.id, orderId: o.id, value: o.total, items: (o.items || []).map(function (i) { return { id: i.custom ? 'custom-build' : i.id, name: i.name, price: i.price, qty: i.qty }; }) });
    o._tracked = true; A.orders.save(o);
  });
})();
