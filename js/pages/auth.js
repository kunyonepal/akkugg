/* Login, register and password reset. With the Akku.GG server these use the account API; without it they explain that accounts are not connected. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function nextUrl() {
    var n = new URLSearchParams(location.search).get('next') || '';
    return /^(product\/)?[a-z0-9-]+\.html(#[\w-]*)?$/i.test(n) ? A.root + n : A.root + 'my-orders.html';
  }
  function clearErrors(form) { $$('.is-invalid', form).forEach(function (el) { el.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); }); $$('[data-error-for]', form).forEach(function (s) { s.textContent = ''; s.style.display = 'none'; }); }
  function slot(el) {
    var s = el.parentNode.querySelector('[data-error-for="' + el.id + '"]');
    if (!s) { s = document.createElement('span'); s.className = 'error-message'; s.setAttribute('data-error-for', el.id); (el.closest('.form-group') || el.parentNode).appendChild(s); }
    return s;
  }
  function invalid(el, msg) { el.classList.add('is-invalid'); el.setAttribute('aria-invalid', 'true'); var s = slot(el); s.textContent = msg; s.style.display = 'block'; return false; }
  function busy(btn, on, text) { if (!btn) return; if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + text; } else if (btn.dataset.label) btn.innerHTML = btn.dataset.label; btn.disabled = on; }

  function login(form) {
    var btn = $('button[type="submit"]', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); clearErrors(form);
      var id = $('#emailPhone', form), pw = $('#password', form);
      var ok = (id.value.trim() ? true : invalid(id, 'Enter your email or phone number.')) & (pw.value ? true : invalid(pw, 'Enter your password.'));
      if (!ok) return;
      busy(btn, true, 'Signing in...');
      A.api('POST', 'auth/login', { email: id.value.trim(), password: pw.value }).then(function () { window.location.href = nextUrl(); },
        function (err) { busy(btn, false); invalid(pw, err.message); pw.focus(); });
    });
    /* forgot password: replace the "contact us" link with a reset flow */
    var link = $$('a', form).filter(function (a) { return /forgot/i.test(a.textContent); })[0];
    var box = document.createElement('div');
    box.className = 'akku-forgot'; box.hidden = true;
    box.innerHTML = '<h3>Reset your password</h3><p>We email you a 6-digit code.</p>' +
      '<form id="forgotForm" novalidate><div class="form-group"><label for="fEmail">Email</label><input id="fEmail" type="email" autocomplete="email" required></div><button class="btn-submit" type="submit">Send code</button></form>' +
      '<form id="resetForm" novalidate hidden><div class="form-group"><label for="fCode">6-digit code</label><input id="fCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>' +
      '<div class="form-group"><label for="fPassword">New password</label><input id="fPassword" type="password" autocomplete="new-password" minlength="8" required></div><button class="btn-submit" type="submit">Set new password</button></form>' +
      '<button type="button" class="akku-link-btn" data-forgot-close>Back to sign in</button>';
    form.parentNode.insertBefore(box, form.nextSibling);
    if (link) link.addEventListener('click', function (e) { e.preventDefault(); form.hidden = true; box.hidden = false; $('#fEmail').value = /@/.test($('#emailPhone', form).value) ? $('#emailPhone', form).value.trim() : ''; $('#fEmail').focus(); });
    $('[data-forgot-close]', box).addEventListener('click', function () { box.hidden = true; form.hidden = false; });
    var f1 = $('#forgotForm', box), f2 = $('#resetForm', box);
    f1.addEventListener('submit', function (e) {
      e.preventDefault(); clearErrors(f1);
      var em = $('#fEmail'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim())) return invalid(em, 'Enter a valid email address.');
      var b = $('button', f1); busy(b, true, 'Sending...');
      A.api('POST', 'auth/forgot', { email: em.value.trim() }).then(function (r) { busy(b, false); A.toast(r.message, { type: 'success', duration: 8000 }); f2.hidden = false; $('#fCode').focus(); },
        function (err) { busy(b, false); invalid(em, err.message); });
    });
    f2.addEventListener('submit', function (e) {
      e.preventDefault(); clearErrors(f2);
      var b = $('button', f2); busy(b, true, 'Saving...');
      A.api('POST', 'auth/reset', { email: $('#fEmail').value.trim(), code: $('#fCode').value.trim(), password: $('#fPassword').value }).then(function () { window.location.href = nextUrl(); },
        function (err) { busy(b, false); var f = (err.data && err.data.fields) || {}; invalid(f.password ? $('#fPassword') : $('#fCode'), err.message); });
    });
  }

  function register(form) {
    var btn = $('button[type="submit"]', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); clearErrors(form);
      var g = function (id) { return $('#' + id, form); }, ok = true;
      if (g('fullName').value.trim().length < 2) ok = invalid(g('fullName'), 'Please enter your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g('email').value.trim())) ok = invalid(g('email'), 'Enter a valid email address.');
      if (g('phone').value.trim() && !A.validPhone(g('phone').value)) ok = invalid(g('phone'), 'Enter a valid Nepali phone number.');
      if (g('password').value.length < 8) ok = invalid(g('password'), 'Use at least 8 characters.');
      else if (g('confirmPassword').value !== g('password').value) ok = invalid(g('confirmPassword'), 'The passwords do not match.');
      if (!g('agreeTerms').checked) ok = invalid(g('agreeTerms'), 'Please accept the terms to continue.');
      if (!ok) { var f = $('.is-invalid', form); if (f) f.focus(); return; }
      busy(btn, true, 'Creating account...');
      A.api('POST', 'auth/register', { name: g('fullName').value.trim(), email: g('email').value.trim(), phone: g('phone').value.trim(), password: g('password').value, marketing: g('newsletter').checked })
        .then(function () { window.location.href = nextUrl(); }, function (err) { busy(btn, false); A.formErrors(form, err, { name: 'fullName' }); });
    });
  }

  function boot() {
    if (A.site.backend) {
      A.session().then(function (me) { if (me && $('#loginForm, #registerForm')) window.location.replace(nextUrl()); });
      var lf = $('#loginForm'); if (lf) login(lf);
      var rf = $('#registerForm'); if (rf) register(rf);
      $$('.social-btn').forEach(function (b) { b.closest('.social-login, .social-buttons, .auth-divider') ? (b.closest('.social-login, .social-buttons') || b).setAttribute('hidden', '') : b.setAttribute('hidden', ''); });
      $$('.auth-divider, .divider').forEach(function (d) { if (/or/i.test(d.textContent)) d.hidden = true; });
    } else {
      var msg = 'Customer accounts are coming soon. You can place orders now as a guest.';
      $$('.auth-form').forEach(function (form) { form.addEventListener('submit', function (e) { e.preventDefault(); A.toast(msg, { type: 'info', href: A.root + 'products.html', linkText: 'Shop now', duration: 7000 }); }); });
      $$('.social-btn').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); A.toast(msg, { type: 'info', duration: 7000 }); }); });
    }
    $$('.toggle-password').forEach(function (b) {
      b.setAttribute('aria-label', 'Show password');
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var input = $('input', b.closest('.input-wrapper, .password-wrapper, .form-group')); if (!input) return;
        var show = input.type === 'password'; input.type = show ? 'text' : 'password';
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        var i = $('i', b); if (i) { i.classList.toggle('fa-eye', !show); i.classList.toggle('fa-eye-slash', show); }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
