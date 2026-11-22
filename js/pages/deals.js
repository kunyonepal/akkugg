/* Deals page: category tabs, search, quick filters and sorting. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function boot() {
    var grid = $('#dealsGrid');
    if (!grid) return;
    var cards = $$('.deal-card', grid), state = { cat: 'all', quick: 'all', q: '' };
    var search = $('#dealSearch'), sort = $('#dealSort'), count = $('#dealCount'), empty = $('#dealsEmpty');
    function render() {
      var n = function (c, k) { return Number(c.getAttribute('data-' + k)) || 0; };
      var list = cards.filter(function (c) {
        if (state.cat !== 'all' && c.getAttribute('data-cat') !== state.cat) return false;
        if (state.q && c.getAttribute('data-name').indexOf(state.q) === -1) return false;
        if (state.quick === '20' && n(c, 'discount') < 20) return false;
        if (state.quick === 'under-25k' && n(c, 'price') > 25000) return false;
        if (state.quick === 'under-100k' && n(c, 'price') > 100000) return false;
        return true;
      });
      var s = sort ? sort.value : 'discount';
      list.sort(function (a, b) {
        if (s === 'price-low') return n(a, 'price') - n(b, 'price');
        if (s === 'price-high') return n(b, 'price') - n(a, 'price');
        return n(b, 'discount') - n(a, 'discount');
      });
      cards.forEach(function (c) { c.hidden = true; });
      list.forEach(function (c) { c.hidden = false; grid.appendChild(c); });
      if (count) count.textContent = list.length;
      if (empty) empty.hidden = list.length > 0;
    }
    $$('.deal-categories__tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('.deal-categories__tab').forEach(function (t) { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
        state.cat = tab.getAttribute('data-category'); render();
      });
    });
    $$('.quick-filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.quick-filter-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
        state.quick = btn.getAttribute('data-quick'); render();
      });
    });
    if (search) search.addEventListener('input', function () { state.q = search.value.trim().toLowerCase(); render(); });
    if (sort) sort.addEventListener('change', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
