/* Account details: profile, saved delivery address, newsletter choice and password (needs the Akku.GG server). */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function clear(form) { $$('.is-invalid', form).forEach(function (el) { el.classList.remove('is-invalid'); }); $$('[data-error-for]', form).forEach(function (s) { s.textContent = ''; s.style.display = 'none'; }); }
  function boot() {
    var guest = $('[data-account-guest]'), panel = $('[data-account-panel]');
    if (!guest) return;
    A.session().then(function (me) {
      if (!me) { guest.hidden = false; return; }
      panel.hidden = false;
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
