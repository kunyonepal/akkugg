/* Complaints and privacy requests: send the form, show the reference number and the date we decide by. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function boot() {
    var form = $('[data-request-form]'); if (!form) return;
    var e = form.elements, done = $('[data-request-done]', form);
    var topic = $('[data-complaint-only]', form), topicGroup = topic && topic.closest('.form-group');
    function syncKind() { if (topicGroup) topicGroup.hidden = e.kind.value !== 'complaint'; }
    e.kind.addEventListener('change', syncKind); syncKind();
    var q = new URLSearchParams(location.search);
    if (q.get('order')) e.orderId.value = q.get('order').slice(0, 40);
    if (q.get('kind') && $('option[value="' + q.get('kind').replace(/[^a-z-]/g, '') + '"]', e.kind)) { e.kind.value = q.get('kind'); syncKind(); }
    if (A.site.backend && A.session) A.session().then(function (me) { if (!me) return; if (!e.name.value) e.name.value = me.name || ''; if (!e.email.value) e.email.value = me.email || ''; if (!e.phone.value) e.phone.value = me.phone || ''; });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      $$('.is-invalid', form).forEach(function (el) { el.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); });
      $$('[data-error-for]', form).forEach(function (s) { s.textContent = ''; s.style.display = 'none'; });
      var body = { kind: e.kind.value, topic: e.topic.value, orderId: e.orderId.value.trim(), name: e.name.value.trim(), phone: e.phone.value.trim(), email: e.email.value.trim(), message: e.message.value.trim(), website: e.website.value };
      if (!A.site.backend) {
        /* static preview: no server to receive it, so open an email instead */
        var to = form.getAttribute('data-email');
        if (!to) { A.toast('Please call or email us with your complaint.', { type: 'error' }); return; }
        location.href = 'mailto:' + to + '?subject=' + encodeURIComponent((body.kind === 'complaint' ? 'Complaint' : 'Privacy request') + (body.orderId ? ' (order ' + body.orderId + ')' : '')) +
          '&body=' + encodeURIComponent(body.message + '\n\n' + body.name + '\n' + body.phone + (body.email ? '\n' + body.email : ''));
        return;
      }
      var btn = $('button[type="submit"]', form); btn.disabled = true;
      A.api('POST', 'requests', body).then(function (r) {
        $$('.akku-form__grid, .form-group, .form-note, .akku-form__actions', form).forEach(function (x) { x.hidden = true; });
        done.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i><div><strong>' + A.esc(r.id || '') + '</strong><p>' + A.esc(r.message || 'Thank you.') + '</p></div>';
        done.hidden = false; done.focus();
      }, function (err) { A.formErrors(form, err, { orderId: 'rq_orderId', name: 'rq_name', phone: 'rq_phone', email: 'rq_email', message: 'rq_message' }); })
        .then(function () { btn.disabled = false; });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
