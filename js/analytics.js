/* Google Analytics 4 and Meta Pixel, only when their IDs are set in the admin (Settings → SEO & analytics). */
(function () {
  'use strict';
  var a = (window.Akku && window.Akku.site && window.Akku.site.analytics) || {};
  function load(src) { var s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); }
  if (/^G-[A-Z0-9]+$/i.test(a.ga4 || '')) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', a.ga4, { anonymize_ip: true });
    load('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(a.ga4));
  }
  if (/^\d{6,20}$/.test(a.metaPixel || '')) {
    var f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
    if (!window._fbq) window._fbq = f;
    f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
    load('https://connect.facebook.net/en_US/fbevents.js');
    f('init', a.metaPixel); f('track', 'PageView');
  }
  /* purchase events on the order confirmation page */
  document.addEventListener('akku:orders', function () {
    var id = window.Akku.store.get('lastOrder', ''), o = id && window.Akku.orders.get(id);
    if (!o || o.status === 'pending_payment' || o._tracked) return;
    if (window.gtag) window.gtag('event', 'purchase', { transaction_id: o.id, value: o.total, currency: 'NPR' });
    if (window.fbq) window.fbq('track', 'Purchase', { value: o.total, currency: 'NPR' });
    o._tracked = true; window.Akku.orders.save(o);
  });
})();
