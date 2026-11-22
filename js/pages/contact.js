/* Contact form: opens the visitor's email app (or WhatsApp) with the message filled in. Nothing is sent from the page. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function boot() {
    var form = $('#contactForm');
    if (!form) return;
    var via = 'email';
    $$('[data-via]', form).forEach(function (b) { b.addEventListener('click', function () { via = b.getAttribute('data-via'); }); });
    function err(el, msg) { var slot = $('.error-message', el.closest('.form-group')); el.classList.toggle('is-invalid', !!msg); if (slot) slot.textContent = msg || ''; return !msg; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements, ok = true;
      ok = err(f.name, f.name.value.trim() ? '' : 'Please enter your name.') && ok;
      ok = err(f.subject, f.subject.value ? '' : 'Please choose a subject.') && ok;
      ok = err(f.message, f.message.value.trim().length >= 5 ? '' : 'Please write your message.') && ok;
      ok = err(f.phone, !f.phone.value.trim() || A.validPhone(f.phone.value) ? '' : 'Enter a valid phone number or leave it empty.') && ok;
      if (f.email) ok = err(f.email, !f.email.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim()) ? (f.email.value.trim() || f.phone.value.trim() ? '' : 'Add an email or a phone number so we can reply.') : 'Enter a valid email address.') && ok;
      if (!ok) { var first = $('.is-invalid', form); if (first) first.focus(); return; }
      if (A.site.backend) {
        var btn = $('button[type="submit"]', form); btn.disabled = true;
        A.api('POST', 'contact', { name: f.name.value, email: f.email.value, phone: f.phone.value, subject: f.subject.value, message: f.message.value, website: f.website ? f.website.value : '' })
          .then(function (r) { form.reset(); A.toast(r.message, { type: 'success', duration: 7000 }); }, function (e2) { A.formErrors(form, e2); })
          .then(function () { btn.disabled = false; });
        return;
      }
      var body = f.message.value.trim() + '\n\n' + f.name.value.trim() + (f.phone.value.trim() ? '\n' + f.phone.value.trim() : '');
      var url = via === 'whatsapp' && form.getAttribute('data-whatsapp')
        ? 'https://wa.me/' + form.getAttribute('data-whatsapp') + '?text=' + encodeURIComponent(f.subject.value + '\n\n' + body)
        : 'mailto:' + form.getAttribute('data-email') + '?subject=' + encodeURIComponent(f.subject.value + ' - ' + f.name.value.trim()) + '&body=' + encodeURIComponent(body);
      window.location.href = url;
      A.toast(via === 'whatsapp' ? 'Opening WhatsApp. Press send there to reach us.' : 'Opening your email app. Press send there to reach us. If nothing opens, email ' + form.getAttribute('data-email'), { type: 'info', duration: 9000 });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
