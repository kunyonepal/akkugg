/* Account details: profile, saved delivery address, newsletter choice and password (needs the Akku.GG server). */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function clear(form) { $$('.is-invalid', form).forEach(function (el) { el.classList.remove('is-invalid'); }); $$('[data-error-for]', form).forEach(function (s) { s.textContent = ''; s.style.display = 'none'; }); }
  /* download my data, delete my account, sign out other devices */
  function privacyTools() {
    var rv = $('[data-revoke-others]');
    if (rv) rv.addEventListener('click', function () {
      rv.disabled = true;
      A.api('POST', 'account/sessions/revoke-others').then(function () { $('[data-revoke-msg]').textContent = 'Done. Every other device is signed out.'; },
        function (err) { $('[data-revoke-msg]').textContent = err.message; }).then(function () { rv.disabled = false; });
    });
    var xf = $('#exportForm');
    if (xf) xf.addEventListener('submit', function (ev) {
      ev.preventDefault(); clear(xf);
      var btn = $('button[type="submit"]', xf); btn.disabled = true;
      fetch(A.root + 'api/account/data', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: xf.elements.password.value }) })
        .then(function (res) {
          if (!res.ok) return res.json().catch(function () { return {}; }).then(function (d) { var e = new Error(d.error || 'Something went wrong.'); e.data = d; throw e; });
          return res.blob().then(function (blob) {
            var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-data.json'; document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
            xf.reset(); A.toast('Your data file is downloading.', { type: 'success' });
          });
        })
        .catch(function (err) { A.formErrors(xf, err, { password: 'p_xpassword' }); })
        .then(function () { btn.disabled = false; });
    });
    var df = $('#deleteForm');
    if (df) df.addEventListener('submit', function (ev) {
      ev.preventDefault(); clear(df);
      if (!df.elements.sure.checked) { A.toast('Tick the box to confirm that you want to delete your account.', { type: 'error' }); df.elements.sure.focus(); return; }
      var btn = $('button[type="submit"]', df); btn.disabled = true;
      A.api('POST', 'account/delete', { password: df.elements.password.value, forfeitCredit: df.elements.forfeitCredit.checked })
        .then(function (r) {
          ['customer', 'orders', 'lastOrder', 'wishlist'].forEach(function (k) { if (A.store.remove) A.store.remove(k); });
          A.me = null; document.querySelector('[data-account-panel]').innerHTML = '<div class="akku-empty"><h3>Your account has been deleted</h3><p>' + A.esc(r.message) + ' We have emailed you a confirmation.</p><a class="btn btn-primary" href="' + A.root + 'index.html">Back to the shop</a></div>';
        }, function (err) {
          if (err.data && err.data.code === 'credit') { var box = $('[data-forfeit]', df); box.hidden = false; $('[data-forfeit-amount]', df).textContent = A.money(err.data.credit, 'NPR'); }
          A.formErrors(df, err, { password: 'p_dpassword' });
        })
        .then(function () { btn.disabled = false; });
    });
  }
  function boot() {
    var guest = $('[data-account-guest]'), panel = $('[data-account-panel]');
    if (!guest) return;
    A.session().then(function (me) {
      if (!me) { guest.hidden = false; return; }
      panel.hidden = false;
      /* store credit (refunds or goodwill put on the account) and a customer group discount, when there are any */
      A.api('GET', 'account/credit').then(function (r) {
        if (!r.credit && !r.moves.length && !r.group) return;
        var sec = $('[data-credit-section]'), body = $('[data-credit-body]');
        var day = function (iso) { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kathmandu' }); };
        body.innerHTML = '<p>Balance: <strong data-price="' + r.credit + '">' + A.money(r.credit, 'NPR') + '</strong>' + (r.credit ? '. You can use it at checkout.' : '') + '</p>' +
          (r.group ? '<p>You are in our <strong>' + A.esc(r.group.name) + '</strong> group: ' + r.group.discount + '% off is taken at checkout while you are signed in.</p>' : '') +
          (r.moves.length ? '<div class="akku-credit-moves">' + r.moves.map(function (m) { return '<div><span>' + day(m.at) + '</span><span>' + A.esc(m.reason || '') + '</span><strong>' + (m.change > 0 ? '+' : '−') + A.money(Math.abs(m.change), 'NPR') + '</strong></div>'; }).join('') + '</div>' : '');
        sec.hidden = false;
      }).catch(function () { /* older server */ });
      var pf = $('#profileForm'), e = pf.elements, a = me.address || {};
      e.name.value = me.name; e.email.value = me.email; e.phone.value = me.phone || '';
      e.street.value = a.street || ''; e.city.value = a.city || ''; e.province.value = a.province || ''; e.landmark.value = a.landmark || ''; e.marketing.checked = !!me.marketing;
      pf.addEventListener('submit', function (ev) {
        ev.preventDefault(); clear(pf);
        var btn = $('button[type="submit"]', pf); btn.disabled = true;
        A.api('PUT', 'account', { name: e.name.value, phone: e.phone.value, marketing: e.marketing.checked, address: { street: e.street.value, city: e.city.value, province: e.province.value, landmark: e.landmark.value } })
          .then(function (r) { A.me = r.customer; A.toast('Your details are saved.', { type: 'success' }); $$('[data-account-name]').forEach(function (n) { n.textContent = r.customer.name.split(' ')[0]; }); },
            function (err) { A.formErrors(pf, err, { name: 'p_name', phone: 'p_phone' }); })
          .then(function () { btn.disabled = false; });
      });
      privacyTools();
      var wf = $('#passwordForm');
      wf.addEventListener('submit', function (ev) {
        ev.preventDefault(); clear(wf);
        var btn = $('button[type="submit"]', wf); btn.disabled = true;
        A.api('POST', 'account/password', { current: wf.elements.current.value, password: wf.elements.password.value })
          .then(function () { wf.reset(); A.toast('Password changed. Other devices are signed out.', { type: 'success', duration: 6000 }); },
            function (err) { A.formErrors(wf, err, { current: 'p_current', password: 'p_password' }); })
          .then(function () { btn.disabled = false; });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
