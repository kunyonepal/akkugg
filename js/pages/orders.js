/* Order confirmation, My Orders and Track Order.
   With the Akku.GG server (site.backend) orders come from the API; otherwise from orders saved in this browser. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  var API = !!A.site.backend;
  var STEPS = [
    ['placed', 'Order Placed', 'We have received your order.'],
    ['confirmed', 'Confirmed by Phone', 'We call you to confirm the order and delivery.'],
    ['packed', 'Packed', 'Your items are checked and packed.'],
    ['shipped', 'On the Way', 'Your order is with our rider or courier.'],
    ['delivered', 'Delivered', 'Your order arrives. Enjoy!']
  ];
  function stepIndex(o) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i][0] === o.status) return i; return o.status === 'pending_payment' ? -1 : 0; }
  function statusLabel(o) {
    if (o.status === 'pending_payment') return 'Awaiting payment';
    if (o.status === 'cancelled') return 'Cancelled';
    return STEPS[stepIndex(o)][1];
  }
  function when(iso) {
    try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kathmandu' }); }
    catch (e) { return iso; }
  }
  function stepDate(o, status, i) {
    var h = (o.history || []).filter(function (x) { return x.status === status; })[0];
    return h ? h.at : (i === 0 ? o.createdAt : null);
  }
  function timeline(o) {
    if (o.status === 'cancelled') {
      var last = (o.history || []).slice(-1)[0] || {};
      return '<div class="timeline-item completed akku-cancelled"><div class="timeline-marker"><i class="fas fa-times"></i></div><div class="timeline-content"><h4>Order Cancelled</h4><p>' + A.esc(last.note || 'This order was cancelled.') + '</p><span class="timeline-date">' + A.esc(when(last.at || o.createdAt)) + '</span></div></div>';
    }
    var at = stepIndex(o);
    return STEPS.map(function (s, i) {
      var cls = i <= at ? 'completed' : (i === at + 1 ? 'active' : ''), d = i <= at ? stepDate(o, s[0], i) : null;
      var notes = (o.history || []).filter(function (h) { return h.status === s[0] && h.note; }).map(function (h) { return '<p class="akku-step-note">' + A.esc(h.note) + '</p>'; }).join('');
      return '<div class="timeline-item ' + cls + '"><div class="timeline-marker">' + (i <= at ? '<i class="fas fa-check"></i>' : '') + '</div><div class="timeline-content"><h4>' + s[1] + '</h4><p>' + s[2] + '</p>' + notes + (d ? '<span class="timeline-date">' + A.esc(when(d)) + '</span>' : '') + '</div></div>';
    }).join('');
  }
  function itemsHtml(o) {
    return (o.items || []).map(function (it) {
      var m = A.lineMedia(it.custom ? { custom: true, parts: it.partIds, name: it.name } : { id: it.id, options: it.options }, 120, 120);
      return '<div class="akku-order-item"><span class="' + m.cls + ' akku-thumb">' + m.html + '</span><div class="akku-order-item__info"><a href="' + m.href + '">' + A.esc(it.name) + '</a><p>Qty: ' + it.qty +
        (it.optionsText ? ' · ' + A.esc(it.optionsText) : '') + (it.parts ? ' · ' + A.esc(it.parts.join(', ')) : '') + '</p></div><strong data-price="' + it.total + '">' + A.money(it.total) + '</strong></div>';
    }).join('');
  }
  function deliveryLabel(o) { return o.delivery.fee === null || o.delivery.fee === undefined ? 'Confirmed on call' : (o.delivery.fee ? A.money(o.delivery.fee) : 'FREE'); }
  function whatsappLink(o) {
    var num = String((A.site.contact && A.site.contact.whatsapp) || '').replace(/\D/g, '');
    return num ? 'https://wa.me/' + num + '?text=' + encodeURIComponent(o.message || ('Order ' + o.id)) : '';
  }
  function remember(o, key) {
    var keep = { id: o.id, key: key || o.key, createdAt: o.createdAt, status: o.status, paymentStatus: o.paymentStatus, mode: 'api', customer: { name: (o.customer || {}).name || '', phone: (o.customer || {}).phone || '' },
      delivery: o.delivery, payment: o.payment, items: o.items, subtotal: o.subtotal, discount: o.discount, total: o.total };
    A.orders.save(keep);
  }
  function payButtons(o, label) {
    return '<div class="akku-pay-panel__methods">' + (o.methods || []).map(function (m) {
      return '<button type="button" class="akku-pay-btn" data-pay-method="' + A.esc(m.id) + '">' + (m.logo ? '<img src="' + A.root + A.esc(m.logo) + '" alt="">' : '<i class="fas ' + A.esc(m.icon || 'fa-wallet') + '"></i>') +
        '<span>' + (m.id === 'cod' ? 'Pay on delivery instead' : A.esc(label) + ' ' + A.esc(m.name)) + '</span></button>';
    }).join('') + '</div>';
  }

  /* ---------- order confirmation ---------- */
  function render(view, o, pay) {
    $('[data-order-found]', view).hidden = false;
    var first = ((o.customer || {}).name || '').split(' ')[0], title = $('[data-o-title]', view), lead = $('[data-o-lead]', view), icon = $('.checkmark-circle i', view);
    var panel = $('[data-o-pay-panel]', view);
    $('[data-o-id]', view).textContent = '#' + o.id;
    if (o.status === 'pending_payment') {
      title.textContent = pay === 'failed' || pay === 'error' || o.paymentStatus === 'failed' ? 'Payment not completed' : 'Complete your payment';
      lead.textContent = pay === 'error' ? 'We could not open the payment page. Your order is saved: try again, or choose another way to pay.'
        : pay === 'failed' || o.paymentStatus === 'failed' ? 'The payment did not go through, so your order is not confirmed yet. If money left your account, contact us with your order number.'
        : 'Your order is saved. Pay now to confirm it' + (o.expiresAt ? ' (we hold it until ' + when(o.expiresAt) + ')' : '') + '.';
      if (icon) icon.className = 'fas fa-hourglass-half';
      view.classList.add('is-awaiting');
      panel.innerHTML = '<h3>Choose how to pay</h3>' + payButtons(o, 'Pay with') + (pay === 'pending' ? '<p class="akku-pay-panel__note">If you already paid, the payment may still be on its way. Refresh this page in a minute.</p>' : '');
      panel.hidden = false;
    } else if (o.status === 'cancelled') {
      title.textContent = 'Order cancelled'; lead.textContent = 'This order is cancelled. ' + (o.paymentStatus === 'paid' ? 'Your payment will be refunded; we will contact you.' : 'No payment was taken.');
      if (icon) icon.className = 'fas fa-times';
      view.classList.add('is-cancelled'); panel.hidden = true;
    } else {
      title.textContent = pay === 'paid' ? 'Payment received. Thank you!' : 'Order Placed Successfully!';
      lead.textContent = 'Thank you' + (first ? ', ' + first : '') + '! ' + (o.paymentStatus === 'paid' && o.payment.id !== 'cod' ? 'Your ' + o.payment.name + ' payment is confirmed. ' : '') +
        (o.status === 'placed' ? 'We will call ' + ((o.customer || {}).phone || 'you') + ' to confirm your order.' : 'Your order is ' + statusLabel(o).toLowerCase() + '.');
      panel.hidden = true;
    }
    if (o.payment && o.payment.test && o.paymentStatus === 'paid') lead.textContent += ' (Test payment: no real money was taken.)';
    if (o.canCancel && API) {
      panel.hidden = false;
      panel.insertAdjacentHTML('beforeend', '<p class="akku-pay-panel__cancel"><button type="button" class="akku-link-btn" data-cancel-order>Cancel this order</button></p>');
    }
    $('[data-o-items]', view).innerHTML = itemsHtml(o);
    $('[data-o-timeline]', view).innerHTML = o.status === 'pending_payment' ? '<div class="timeline-item active"><div class="timeline-marker"></div><div class="timeline-content"><h4>Waiting for payment</h4><p>Your order is confirmed once the payment goes through.</p></div></div>' : timeline(o);
    var c = o.customer || {};
    $('[data-o-ship-title]', view).textContent = o.delivery.method === 'pickup' ? 'Store Pickup' : 'Delivery Address';
    $('[data-o-ship]', view).innerHTML = '<p><strong>' + A.esc(c.name) + '</strong></p>' +
      (o.delivery.method === 'pickup' ? '<p>Collect from: ' + A.esc((A.site.contact && A.site.contact.address) || 'our store') + '</p>' : '<p>' + A.esc([c.street, c.city, c.province].filter(Boolean).join(', ')) + '</p>' + (c.landmark ? '<p>Near ' + A.esc(c.landmark) + '</p>' : '')) +
      '<p class="info-phone"><i class="fas fa-phone"></i> ' + A.esc(c.phone) + '</p>' + (c.email ? '<p><i class="fas fa-envelope"></i> ' + A.esc(c.email) + '</p>' : '');
    var payText = o.paymentStatus === 'paid' ? (o.payment.id === 'cod' ? 'Paid on delivery.' : 'Paid' + (o.payment.ref ? ' · ref ' + A.esc(o.payment.ref) : '') + '.')
      : o.paymentStatus === 'refunded' ? 'Refunded.' : o.payment.id === 'cod' ? 'Pay when your order arrives.' : o.status === 'pending_payment' ? 'Waiting for payment.' : API ? 'Payment not completed.' : 'We send the payment details when we confirm your order.';
    $('[data-o-pay]', view).innerHTML = '<p><strong>' + A.esc(o.payment.name) + '</strong></p><p>' + payText + '</p>';
    var count = o.items.reduce(function (n, i) { return n + i.qty; }, 0);
    $('[data-o-breakdown]', view).innerHTML = '<div class="summary-row"><span>Subtotal (' + count + ' item' + (count === 1 ? '' : 's') + ')</span><span data-price="' + o.subtotal + '">' + A.money(o.subtotal) + '</span></div>' +
      (o.discount ? '<div class="summary-row akku-discount-row"><span>Discount' + (o.coupon ? ' <small>(' + A.esc(o.coupon) + ')</small>' : '') + '</span><span>− ' + A.money(o.discount) + '</span></div>' : '') +
      '<div class="summary-row"><span>Delivery</span><span' + (o.delivery.fee > 0 ? ' data-price="' + o.delivery.fee + '"' : '') + '>' + deliveryLabel(o) + '</span></div>';
    $('[data-o-total]', view).setAttribute('data-price', o.total);
    var savings = o.items.reduce(function (n, i) { return n + (i.oldPrice > i.price ? (i.oldPrice - i.price) * i.qty : 0); }, 0) + (o.discount || 0);
    var sv = $('[data-o-savings]', view); sv.hidden = !savings; sv.innerHTML = '<i class="fas fa-tags"></i> You saved ' + A.money(savings) + ' on this order!';
    $('[data-o-track]', view).setAttribute('href', A.root + 'track-order.html#' + o.id);
    document.title = 'Order ' + o.id + ' | ' + A.site.brand.name;
    A.refresh(view);
  }

  function confirmation(view) {
    var qs = new URLSearchParams(location.search);
    var id = (qs.get('id') || decodeURIComponent(location.hash.replace(/^#/, '')) || A.store.get('lastOrder', '')).trim();
    var pay = qs.get('pay');
    var local = A.orders.get(id);
    if (!API || (local && local.mode !== 'api')) return localConfirmation(view, local);
    var key = qs.get('key') || (local && local.key);
    if (qs.get('key') && window.history.replaceState) window.history.replaceState(null, '', location.pathname + '#' + encodeURIComponent(id));
    if (!id || !key) { $('[data-order-missing]', view).hidden = false; return; }
    function load() {
      return A.api('GET', 'orders/' + encodeURIComponent(id) + '?key=' + encodeURIComponent(key)).then(function (o) { remember(o, key); render(view, o, pay); return o; },
        function () { $('[data-order-found]', view).hidden = true; $('[data-order-missing]', view).hidden = false; });
    }
    load();
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pay-method]');
      if (b) {
        $$('[data-pay-method]', view).forEach(function (x) { x.disabled = true; });
        b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Opening...</span>';
        A.api('POST', 'orders/' + encodeURIComponent(id) + '/pay', { key: key, method: b.getAttribute('data-pay-method') }).then(function (r) {
          if (r.next.type === 'done') { pay = null; load(); return; }
          if (r.next.type === 'error') { A.toast(r.next.message, { type: 'error', duration: 8000 }); load(); return; }
          A.goPay(r.next);
        }, function (err) { A.toast(err.message, { type: 'error' }); load(); });
      }
      var c = e.target.closest('[data-cancel-order]');
      if (c) {
        if (!c.hasAttribute('data-armed')) { c.setAttribute('data-armed', ''); c.textContent = 'Tap again to cancel the order'; setTimeout(function () { c.removeAttribute('data-armed'); c.textContent = 'Cancel this order'; }, 4000); return; }
        A.api('POST', 'orders/' + encodeURIComponent(id) + '/cancel', { key: key }).then(function () { pay = null; load(); A.toast('Your order is cancelled.', { type: 'info' }); }, function (err) { A.toast(err.message, { type: 'error' }); });
      }
    });
  }

  function localConfirmation(view, o) {
    if (!o) { $('[data-order-missing]', view).hidden = false; return; }
    render(view, o, null);
    if (o.mode === 'whatsapp') {
      var link = whatsappLink(o), box = $('[data-o-whatsapp]', view);
      $('[data-o-title]', view).textContent = 'One more step: send your order';
      $('[data-o-lead]', view).textContent = 'Your order reaches us when you send it on WhatsApp.';
      box.innerHTML = link ? '<a class="btn btn-primary akku-wa-btn" href="' + A.esc(link) + '" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Send Order on WhatsApp</a><p>Opens WhatsApp with your order details filled in.</p>'
        : '<p>WhatsApp ordering is not set up yet. Please contact us with your order number.</p>';
      box.hidden = false;
    } else if (o.mode !== 'endpoint') {
      $('[data-o-demo]', view).hidden = false;
    }
  }

  /* ---------- my orders ---------- */
  function orderCard(o) {
    var cls = o.status === 'cancelled' ? 'cancelled' : o.status === 'delivered' ? 'delivered' : o.status === 'pending_payment' ? 'pending' : 'processing';
    var link = A.root + 'order-confirmation.html#' + encodeURIComponent(o.id);
    return '<div class="order-card"><div class="order-card__header"><div class="order-info"><h3>Order #' + A.esc(o.id) + '</h3><p class="order-date">Placed on ' + A.esc(when(o.createdAt)) + '</p></div>' +
      '<div class="order-status"><span class="badge-status badge-status--' + cls + '">' + statusLabel(o) + '</span></div></div>' +
      '<div class="order-card__items">' + itemsHtml(o) + '</div>' +
      '<div class="order-card__footer"><div class="order-total"><span>Total Amount:</span> <strong data-price="' + o.total + '">' + A.money(o.total) + '</strong></div>' +
      '<div class="order-actions"><a class="btn-action btn-action--primary" href="' + link + '">' + (o.status === 'pending_payment' ? 'Pay now' : 'View Details') + '</a><a class="btn-action" href="' + A.root + 'track-order.html#' + A.esc(o.id) + '">Track</a></div></div></div>';
  }
  function myOrders(listEl) {
    var empty = $('[data-orders-empty]'), lead = $('[data-orders-lead]');
    function show(orders) {
      empty.hidden = orders.length > 0;
      listEl.innerHTML = orders.map(orderCard).join('');
      A.refresh(listEl);
    }
    var local = A.orders.all();
    show(local);
    if (!API) return;
    A.session().then(function (me) {
      if (me) {
        if (lead) lead.textContent = 'All orders on your account';
        return A.api('GET', 'account/orders').then(function (r) { r.orders.forEach(function (o) { remember(o, o.key); }); var ids = r.orders.map(function (o) { return o.id; });
          show(r.orders.concat(A.orders.all().filter(function (o) { return ids.indexOf(o.id) < 0; }))); });
      }
      if (lead) lead.innerHTML = 'Orders placed from this browser. <a href="' + A.root + 'login.html?next=my-orders.html">Sign in</a> to see every order on your account.';
      return Promise.all(local.filter(function (o) { return o.mode === 'api' && o.key; }).map(function (o) {
        return A.api('GET', 'orders/' + encodeURIComponent(o.id) + '?key=' + encodeURIComponent(o.key)).then(function (fresh) { remember(fresh, o.key); }, function () {});
      })).then(function () { show(A.orders.all()); });
    });
  }

  /* ---------- track order ---------- */
  function track(form) {
    var result = $('[data-track-result]'), details = $('#trackingDetails');
    var idEl = $('#orderNumber'), phoneEl = $('#trackPhone');
    var hashId = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (hashId) {
      idEl.value = hashId;
      var pre = A.orders.get(hashId);
      if (pre) phoneEl.value = pre.customer.phone;
    }
    function show(o) {
      var at = stepIndex(o), pct = o.status === 'cancelled' || at < 0 ? 0 : Math.round(at / (STEPS.length - 1) * 100);
      result.className = 'tracking-alert ' + (o.status === 'cancelled' ? 'error' : 'success'); result.hidden = false;
      result.innerHTML = '<i class="fas ' + (o.status === 'cancelled' ? 'fa-times-circle' : 'fa-check-circle') + '"></i><div><strong>Order found</strong><p>Status: ' + statusLabel(o) + '. We update this as your order moves.</p></div>';
      details.innerHTML = '<div class="order-info-card"><div class="order-header"><div class="order-number"><span>Order ID</span><strong>#' + A.esc(o.id) + '</strong></div><div class="order-status"><span class="status-badge status-processing">' + statusLabel(o) + '</span></div></div>' +
        '<div class="order-meta">' +
          '<div class="meta-item"><i class="fas fa-calendar"></i><div><span>Order Date</span><strong>' + A.esc(when(o.createdAt)) + '</strong></div></div>' +
          '<div class="meta-item"><i class="fas fa-box"></i><div><span>Items</span><strong>' + o.items.reduce(function (n, i) { return n + i.qty; }, 0) + '</strong></div></div>' +
          '<div class="meta-item"><i class="fas fa-wallet"></i><div><span>Total</span><strong data-price="' + o.total + '">' + A.money(o.total) + '</strong></div></div>' +
          '<div class="meta-item"><i class="fas fa-truck"></i><div><span>Delivery</span><strong>' + (o.delivery.method === 'pickup' ? 'Store pickup' : 'Home delivery') + '</strong></div></div>' +
        '</div><div class="delivery-progress"><div class="progress-header"><span>Progress</span><span class="progress-percentage">' + pct + '%</span></div><div class="progress-bar"><div class="progress-fill" style="width:' + Math.max(4, pct) + '%"></div></div></div></div>' +
        '<div class="tracking-timeline"><h2>Order Journey</h2><div class="timeline">' + (at < 0 && o.status !== 'cancelled' ? '<div class="timeline-item active"><div class="timeline-marker"></div><div class="timeline-content"><h4>Waiting for payment</h4><p>The order is confirmed once the payment goes through.</p></div></div>' : timeline(o)) + '</div></div>';
      details.hidden = false;
      A.refresh(details);
    }
    function notFound() {
      details.hidden = true;
      result.className = 'tracking-alert error'; result.hidden = false;
      result.innerHTML = API ? '<i class="fas fa-search"></i><div><strong>No order matches those details</strong><p>Check the order number (for example AKG-261121-1234) and use the phone number given at checkout. Still stuck? <a href="' + A.root + 'contact-us.html">Contact us</a>.</p></div>'
        : '<i class="fas fa-search"></i><div><strong>We could not find that order here</strong><p>This page can show orders placed from this browser. For any other order, <a href="' + A.root + 'contact-us.html">contact us</a> with your order number and we will check it for you.</p></div>';
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = idEl.value.trim().replace(/^#/, ''), phone = phoneEl.value.trim();
      if (!id || !phone) { result.className = 'tracking-alert error'; result.hidden = false; result.innerHTML = '<i class="fas fa-exclamation-circle"></i><div><strong>Fill in both fields</strong><p>We need the order number and the phone number used at checkout.</p></div>'; return; }
      if (API) { A.api('POST', 'orders/track', { id: id, phone: phone }).then(show, function (err) { if (err.status === 404) notFound(); else A.toast(err.message, { type: 'error' }); }); return; }
      var o = A.orders.get(id);
      if (o && A.normalizePhone(o.customer.phone) === A.normalizePhone(phone)) { show(o); return; }
      notFound();
    });
    if (hashId && A.orders.get(hashId)) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  function boot() {
    var view = $('[data-order-view]'); if (view) confirmation(view);
    var list = $('[data-orders-list]'); if (list) myOrders(list);
    var tf = $('#trackForm'); if (tf) track(tf);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
