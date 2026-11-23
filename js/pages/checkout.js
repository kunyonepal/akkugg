/* Checkout: guest details, delivery, payment, place order (demo / WhatsApp / endpoint, see site.config.json "orders"). */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function boot() {
    var form = $('#checkoutForm');
    if (!form) return;
    var empty = $('#checkoutEmpty');
    var lines = A.cart.lines();
    if (!lines.length) { form.hidden = true; empty.hidden = false; return; }
    form.hidden = false;

    /* prefill from the last order on this device, then from the signed-in account */
    var saved = A.store.get('customer', null), remember = $('[data-remember]', form);
    if (remember) remember.checked = !!saved;   /* only kept on this device if the customer asks (it is off by default) */
    var fill = function (data) { Object.keys(data || {}).forEach(function (k) { var el = form.elements[k]; if (el && !el.value && data[k]) el.value = data[k]; }); };
    fill(saved);
    var api = !!A.site.backend, coupon = null;
    if (api) A.session().then(function (c) { if (c) fill({ fullName: c.name, email: c.email, phone: c.phone, street: c.address.street, city: c.address.city, province: c.address.province, landmark: c.address.landmark }); });
    function serverItems() {
      return A.cart.lines().map(function (l) { return l.custom ? { build: { name: l.name, parts: l.parts }, qty: l.qty } : { id: l.id, qty: l.qty, options: l.options || {} }; });
    }

    function method() { var r = $('input[name="delivery"]:checked', form); return r ? r.value : A.deliveryAreas()[0].id; }
    function render() {
      lines = A.cart.lines();
      if (!lines.length) { if (!busy) window.location.href = A.root + 'cart.html'; return; }
      var count = A.cart.count(), subtotal = A.cart.subtotal(), q = A.deliveryQuote(subtotal, method());
      var grp = A.me && A.me.group && A.me.group.discount > 0 ? Math.floor(subtotal * Math.min(90, A.me.group.discount) / 100) : 0;
      var discount = grp + (coupon && coupon.ok ? coupon.discount : 0);
      if (coupon && coupon.ok && coupon.freeDelivery && method() !== 'pickup') q = { fee: 0, label: 'FREE' };
      var dr = $('[data-co-discount-row]');
      if (dr) { dr.hidden = !discount; $('[data-co-coupon]', dr).textContent = [grp ? '(' + A.me.group.name + ' price, ' + A.me.group.discount + '%)' : '', coupon && coupon.ok ? '(' + coupon.code + ')' : ''].filter(Boolean).join(' '); $('[data-co-discount]', dr).textContent = '− ' + A.money(discount); }
      var cr = $('[data-credit]', form), totalNow = Math.max(0, subtotal - discount + (q.fee || 0));
      if (cr) { cr.hidden = !(api && A.me && A.me.credit > 0); }
      var crAmt = cr && !cr.hidden && form.elements.useCredit && form.elements.useCredit.checked ? Math.min(A.me.credit, totalNow) : 0, cn = $('[data-co-credit-note]');
      if (cn) { cn.hidden = !crAmt; cn.textContent = crAmt ? 'Store credit pays ' + A.money(crAmt) + (crAmt >= totalNow ? ', so there is nothing more to pay.' : '; ' + A.money(totalNow - crAmt) + ' is left to pay.') : ''; }
      if (cr && !cr.hidden) { $('[data-credit-amount]', cr).textContent = A.money(Math.min(A.me.credit, totalNow)) + (A.me.credit >= totalNow ? ' (pays the whole order)' : ' of ' + A.money(A.me.credit)); }
      var savings = lines.reduce(function (n, l) { return n + (l.oldPrice > l.price ? (l.oldPrice - l.price) * l.qty : 0); }, 0);
      $('[data-co-count]').textContent = count;
      var prev = lines.slice(0, 3).map(function (l) { var m = A.lineMedia(l, 120, 120); return '<span class="' + m.cls + ' akku-thumb">' + m.html + '</span>'; }).join('');
      if (lines.length > 3) prev += '<div class="more-items">+' + (lines.length - 3) + '</div>';
      $('[data-co-preview]').innerHTML = prev;
      $('#itemsDetail').innerHTML = lines.map(function (l) {
        var m = A.lineMedia(l, 120, 120);
        return '<div class="summary-item"><span class="' + m.cls + ' akku-thumb">' + m.html + '</span><div class="item-info"><p class="item-name">' + A.esc(l.name) + '</p><p class="item-qty">Qty: ' + l.qty + (A.optionsText(l.options) ? ' · ' + A.esc(A.optionsText(l.options)) : '') + '</p></div><p class="item-price" data-price="' + l.total + '">' + A.money(l.total) + '</p></div>';
      }).join('');
      $('[data-co-subtotal]').setAttribute('data-price', subtotal);
      var del = $('[data-co-delivery]'); del.textContent = q.label; del.removeAttribute('data-price'); if (q.fee > 0) del.setAttribute('data-price', q.fee);
      $('[data-co-total]').setAttribute('data-price', Math.max(0, subtotal - discount + (q.fee || 0)));
      updateDeposit();
      var note = $('[data-co-note]'); note.hidden = !q.note; note.textContent = q.note || '';
      var sv = $('[data-co-savings]'); sv.hidden = !savings; $('span', sv).textContent = 'You save ' + A.money(savings) + ' on this order';
      A.deliveryAreas().forEach(function (a) {
        var aq = A.deliveryQuote(subtotal, a.id), hp = $('[data-delivery-price="' + a.id + '"]');
        if (hp) { hp.textContent = aq.fee === null ? 'On call' : aq.label; hp.classList.toggle('free', aq.fee === 0); }
      });
      var pickup = method() === 'pickup', addr = $('[data-address-section]');
      addr.hidden = pickup;
      $$('input, select', addr).forEach(function (el) { if (el.hasAttribute('data-was-required') || el.required) { el.setAttribute('data-was-required', ''); el.required = !pickup; } });
      $('[data-pay-step]').textContent = pickup ? '3' : '4';
      A.refresh(form);
    }

    /* coupon (checked by the server) */
    var cbox = $('[data-coupon-box]');
    function quote(showMsg) {
      var code = $('#couponCode').value.trim(), msg = $('[data-coupon-msg]');
      if (!code) { coupon = null; msg.hidden = true; render(); return; }
      A.api('POST', 'checkout/quote', { items: serverItems(), coupon: code, delivery: { method: method() }, phone: (form.elements.phone || {}).value })
        .then(function (r) {
          coupon = r.coupon && r.coupon.ok ? r.coupon : null;
          if (showMsg !== false) { msg.hidden = false; msg.textContent = r.coupon.message; msg.className = 'akku-coupon__msg ' + (r.coupon.ok ? 'is-ok' : 'is-error'); }
          render();
        }, function (err) { coupon = null; msg.hidden = false; msg.textContent = err.message; msg.className = 'akku-coupon__msg is-error'; render(); });
    }
    if (cbox) {
      $('[data-coupon-apply]', cbox).addEventListener('click', function () { quote(); });
      $('#couponCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); quote(); } });
      doc_on('akku:cart', function () { if (coupon && !busy) quote(false); });
    }
    function doc_on(ev, fn) { document.addEventListener(ev, fn); }

    /* card-style radios */
    form.addEventListener('change', function (e) {
      if (e.target.name === 'delivery') { $$('.delivery-option-card', form).forEach(function (c) { c.classList.toggle('selected', $('input', c).checked); }); render(); if (coupon) quote(false); }
      if (e.target.name === 'payment') $$('.payment-option-compact', form).forEach(function (c) { c.classList.toggle('selected', $('input', c).checked); });
      if (e.target.classList.contains('is-invalid')) validateField(e.target);
    });
    var detailsBtn = $('#viewDetailsBtn');
    detailsBtn.addEventListener('click', function () {
      var box = $('#itemsDetail'), open = box.hidden;
      box.hidden = !open; detailsBtn.textContent = open ? 'Hide Details' : 'View Details'; detailsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    /* validation */
    function setError(el, msg) {
      el.classList.toggle('is-invalid', !!msg);
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      var slot = $('[data-error-for="' + el.id + '"]', form);
      if (slot) { slot.textContent = msg || ''; slot.style.display = msg ? 'block' : 'none'; }
    }
    function validateField(el) {
      var v = el.value.trim(), msg = '';
      if (el.required && !v) msg = 'Please fill this in.';
      else if (el.id === 'phone' && v && !A.validPhone(v)) msg = 'Enter a valid Nepali phone number, for example 98XXXXXXXX.';
      else if (el.id === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Enter a valid email address, or leave it empty.';
      else if (el.id === 'fullName' && v && v.length < 3) msg = 'Please enter your full name.';
      setError(el, msg);
      return !msg;
    }
    $$('input, select, textarea', form).forEach(function (el) { el.addEventListener('blur', function () { if (el.value || el.classList.contains('is-invalid')) validateField(el); }); });

    function orderText(o) {
      var t = 'New order ' + o.id + '\n\nName: ' + o.customer.name + '\nPhone: ' + o.customer.phone + (o.customer.email ? '\nEmail: ' + o.customer.email : '') +
        '\n' + (o.delivery.method === 'pickup' ? 'Delivery: Store pickup' : 'Delivery: ' + (o.delivery.area || 'Home delivery') + ', to ' + [o.customer.street, o.customer.city, o.customer.province].filter(Boolean).join(', ') + (o.customer.landmark ? ' (near ' + o.customer.landmark + ')' : '')) +
        '\nPayment: ' + o.payment.name + '\n\nItems:\n' +
        o.items.map(function (i) { return '- ' + i.qty + ' x ' + i.name + (i.optionsText ? ' [' + i.optionsText + ']' : '') + (i.parts ? ' [' + i.parts.join(', ') + ']' : '') + ' = ' + A.money(i.total, 'NPR'); }).join('\n') +
        '\n\nSubtotal: ' + A.money(o.subtotal, 'NPR') + '\nDelivery: ' + (o.delivery.fee === null ? 'to be confirmed' : A.money(o.delivery.fee, 'NPR')) + '\nTotal: ' + A.money(o.total, 'NPR') + (o.note ? '\n\nNote: ' + o.note : '');
      return t;
    }

    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var fields = $$('input, select, textarea', form).filter(function (el) { return el.id && !el.closest('[hidden]'); });
      var ok = fields.map(validateField).every(Boolean);
      if (!ok) {
        var first = $('.is-invalid', form);
        if (first) { first.focus(); first.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        A.toast('Please check the highlighted fields.', { type: 'error' });
        return;
      }
      var get = function (id) { var el = form.elements[id]; return el ? el.value.trim() : ''; };
      var m = method(), subtotal = A.cart.subtotal(), q = A.deliveryQuote(subtotal, m);
      var payId = ($('input[name="payment"]:checked', form) || {}).value;
      var pay = (A.site.payments.methods || []).filter(function (x) { return x.id === payId; })[0] || { id: payId, name: payId };
      var customer = { name: get('fullName'), phone: get('phone'), email: get('email'), street: m === 'pickup' ? '' : get('street'), city: m === 'pickup' ? '' : get('city'), province: m === 'pickup' ? '' : get('province'), landmark: m === 'pickup' ? '' : get('landmark') };
      var order = {
        id: A.orders.newId(), createdAt: new Date().toISOString(), status: 'placed', mode: (A.site.orders && A.site.orders.mode) || 'demo',
        customer: customer,
        delivery: { method: m, fee: q.fee, area: m === 'pickup' ? '' : (A.deliveryAreas().filter(function (a) { return a.id === m; })[0] || {}).title || '' },
        payment: { id: pay.id, name: pay.name },
        items: A.cart.lines().map(function (l) {
          return { id: l.id || null, name: l.name, qty: l.qty, price: l.price, oldPrice: l.oldPrice || 0, total: l.total, options: l.options || {}, optionsText: A.optionsText(l.options),
            parts: l.custom ? (l.parts || []).map(A.product).filter(Boolean).map(A.shortName) : null, partIds: l.custom ? l.parts : null, custom: !!l.custom };
        }),
        subtotal: subtotal, total: subtotal + (q.fee || 0), note: get('note')
      };
      order.message = orderText(order);
      if (!remember || remember.checked) A.store.set('customer', { fullName: customer.name, phone: customer.phone, email: customer.email, street: get('street'), city: get('city'), province: get('province'), landmark: get('landmark') });
      else A.store.remove ? A.store.remove('customer') : A.store.set('customer', null);

      if (api) {
        busy = true;
        var b = $('#placeOrderBtn'); b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (pay.id === 'cod' ? 'Placing order...' : 'Opening ' + A.esc(pay.name) + '...');
        var plan = ($('input[name="payPlan"]:checked', form) || {}).value === 'deposit' && depositBox && !depositBox.hidden ? 'deposit' : 'full';
        A.track('AddPaymentInfo', { value: subtotal, label: pay.name, items: A.cart.lines().map(function (l) { return { id: l.custom ? 'custom-build' : l.id, name: l.name, price: l.price, qty: l.qty }; }) });
        A.api('POST', 'orders', { items: serverItems(), customer: customer, delivery: { method: m }, payment: { id: pay.id, plan: plan }, coupon: coupon && coupon.ok ? coupon.code : '', note: get('note'),
          attribution: A.attribution(), analytics: A.trackingIds(), adConsent: A.adConsent(), useCredit: !!(form.elements.useCredit && form.elements.useCredit.checked && !$('[data-credit]', form).hidden) })
          .then(function (res) {
            var o = res.order; o.key = res.key; o.mode = 'api';
            A.orders.save(o); A.store.set('lastOrder', o.id); A.cart.clear();
            var page = A.root + 'order-confirmation.html?id=' + encodeURIComponent(o.id) + '&key=' + encodeURIComponent(res.key);
            if (res.next.type === 'error') { window.location.href = page + '&pay=error'; return; }
            A.goPay(res.next, page);
          }, function (err) {
            busy = false; b.disabled = false; b.innerHTML = '<i class="fas fa-check"></i> Place Order';
            if (err.data && err.data.fields) A.formErrors(form, err, { fullName: 'fullName', coupon: 'couponCode' });
            else A.toast(err.message, { type: 'error', duration: 9000, href: err.status === 409 ? A.root + 'cart.html' : '', linkText: err.status === 409 ? 'Review cart' : '' });
          });
        return;
      }

      var finish = function () {
        A.orders.save(order);
        A.store.set('lastOrder', order.id);
        A.cart.clear();
        window.location.href = A.root + 'order-confirmation.html#' + order.id;
      };
      if (order.mode === 'endpoint' && A.site.orders.endpoint) {
        busy = true;
        var btn = $('#placeOrderBtn'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing order...';
        fetch(A.site.orders.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json().catch(function () { return {}; }); })
          .then(function (res) { if (res && res.id) order.id = String(res.id); order.sent = true; finish(); })
          .catch(function () {
            busy = false; btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Place Order';
            A.toast('We could not send your order. Please try again, or contact us.', { type: 'error', duration: 8000, href: A.root + 'contact-us.html', linkText: 'Contact' });
          });
        return;
      }
      finish();
    });

    /* part payment: offered for online, bank and QR payments when it is switched on */
    var depositBox = $('[data-deposit]', form);
    function updateDeposit() {
      if (!depositBox) return;
      var dp = A.site.payments.deposit || {}, payId = ($('input[name="payment"]:checked', form) || {}).value, tEl = $('[data-co-total]'), total = Number(tEl && tEl.getAttribute('data-price')) || A.cart.subtotal();
      var credit = form.elements.useCredit && form.elements.useCredit.checked && !$('[data-credit]', form).hidden;   /* part payment is not combined with store credit */
      depositBox.hidden = !api || payId === 'cod' || !payId || credit || total < (Number(dp.minTotal) || 0);
      var amt = $('[data-deposit-amount]', depositBox); if (amt) amt.textContent = A.money(Math.max(1, Math.round(total * (Number(dp.percent) || 20) / 100)));
    }
    form.addEventListener('change', function (e) { if (e.target.name === 'payment') updateDeposit(); if (e.target.name === 'useCredit') { render(); updateDeposit(); } });
    updateDeposit();
    document.addEventListener('akku:prefs', render);
    document.addEventListener('akku:session', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
