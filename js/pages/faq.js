/* FAQ and warranty pages: accordion, category filter, search. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function boot() {
    $$('.faq-question').forEach(function (q, i) {
      var item = q.closest('.faq-item'), ans = item && $('.faq-answer', item);
      if (ans && !ans.id) ans.id = 'faq-answer-' + i;
      q.setAttribute('aria-expanded', 'false'); if (ans) q.setAttribute('aria-controls', ans.id);
      if (q.tagName !== 'BUTTON') { q.setAttribute('role', 'button'); q.setAttribute('tabindex', '0'); }
      var toggle = function () {
        var open = !item.classList.contains('active');
        $$('.faq-item.active').forEach(function (x) { x.classList.remove('active'); var b = $('.faq-question', x); if (b) b.setAttribute('aria-expanded', 'false'); });
        item.classList.toggle('active', open); q.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      q.addEventListener('click', toggle);
      q.addEventListener('keydown', function (e) { if (q.tagName !== 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } });
    });
    $$('.category-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.category-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
        var cat = btn.getAttribute('data-category');
        $$('.faq-section').forEach(function (s) { s.hidden = !(cat === 'all' || s.getAttribute('data-category') === cat); });
      });
    });
    var search = $('#faqSearchInput');
    if (search) search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      $$('.faq-item').forEach(function (item) { item.hidden = !!q && item.textContent.toLowerCase().indexOf(q) === -1; });
      $$('.faq-section').forEach(function (s) { s.hidden = !!q && !$$('.faq-item', s).some(function (i) { return !i.hidden; }); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
