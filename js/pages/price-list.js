/* Price list: filter rows as you type, print the list. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function boot() {
    var input = $('[data-pl-filter]'), empty = $('[data-pl-empty]');
    if (input) input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(), shown = 0;
      $$('[data-pl-text]').forEach(function (tr) { var on = !q || tr.getAttribute('data-pl-text').indexOf(q) !== -1; tr.hidden = !on; if (on) shown++; });
      $$('.akku-pricelist h2').forEach(function (h) { var t = h.nextElementSibling; h.hidden = t && !$$('tr[data-pl-text]:not([hidden])', t).length; if (t) t.hidden = h.hidden; });
      if (empty) empty.hidden = shown > 0;
    });
    var pr = $('[data-pl-print]'); if (pr) pr.addEventListener('click', function () { window.print(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
