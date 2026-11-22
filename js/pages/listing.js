/* Listing pages: filters, sorting, pagination, grid/list view, search results. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  function boot() {
    var section = $('[data-listing]');
    if (!section) return;
    var mode = section.getAttribute('data-mode');
    var perPage = Number(section.getAttribute('data-per-page')) || 12;
    var grid = $('.product-grid', section);
    var cards = $$('.product-card', grid);
    var sidebar = $('#filtersSidebar');
    var sortSel = $('#sortBy');
    var info = $('.results-info', section);
    var empty = $('[data-empty]', section);
    var pager = $('.pagination', section);
    var chips = $('.active-filters', section);
    var h1 = $('.category-info h1');
    var baseTitle = h1 ? h1.textContent : '';
    var page = 1;
    var searchSet = null, searchRank = {};

    /* ---------- read filters ---------- */
    function checked(key) { return $$('.filter-group[data-filter="' + key + '"] input[type=checkbox]:checked', sidebar).map(function (i) { return i.value; }); }
    function groups() { return $$('.filter-group[data-filter]', sidebar).map(function (g) { return g.getAttribute('data-filter'); }); }
    var priceGroup = $('.filter-group[data-filter="price"]', sidebar);
    var priceMax = priceGroup ? Number(priceGroup.getAttribute('data-max')) : Infinity;
    var minNum = $('#minPrice'), maxNum = $('#maxPrice'), minRange = $('#priceRangeMin'), maxRange = $('#priceRangeMax'), track = $('.range-track', sidebar);
    function priceBounds() {
      var lo = minNum ? Number(minNum.value) || 0 : 0, hi = maxNum ? Number(maxNum.value) : priceMax;
      if (!hi && hi !== 0) hi = priceMax;
      return [Math.min(lo, hi), Math.max(lo, hi)];
    }
    function cardValue(card, key) {
      if (key === 'cat') return card.getAttribute('data-cat');
      if (key === 'sub') return card.getAttribute('data-sub');
      if (key === 'brand') return card.getAttribute('data-brand');
      return card.getAttribute('data-' + key);
    }
    function matches(card, skip) {
      if (searchSet && !searchSet[card.getAttribute('data-pid')]) return false;
      var gs = groups();
      for (var i = 0; i < gs.length; i++) {
        var key = gs[i];
        if (key === skip || key === 'price' || key === 'flags') continue;
        var vals = checked(key);
        if (vals.length && vals.indexOf(cardValue(card, key)) === -1) return false;
      }
      if (skip !== 'price') {
        var b = priceBounds(), price = Number(card.getAttribute('data-price'));
        if (price < b[0] || price > b[1]) return false;
      }
      var flags = checked('flags');
      if (flags.indexOf('in-stock') !== -1 && card.getAttribute('data-stock') === 'out') return false;
      if (flags.indexOf('on-sale') !== -1 && !(Number(card.getAttribute('data-discount')) > 0)) return false;
      return true;
    }
    function sortCards(list) {
      var n = function (c, k) { return Number(c.getAttribute('data-' + k)) || 0; };
      var s = sortSel ? sortSel.value : 'popular';
      var cmp = {
        relevance: function (a, b) { return (searchRank[a.getAttribute('data-pid')] || 0) - (searchRank[b.getAttribute('data-pid')] || 0); },
        popular: function (a, b) { return n(b, 'rank') - n(a, 'rank'); },
        newest: function (a, b) { return n(b, 'new') - n(a, 'new') || n(b, 'rank') - n(a, 'rank'); },
        'price-low': function (a, b) { return n(a, 'price') - n(b, 'price'); },
        'price-high': function (a, b) { return n(b, 'price') - n(a, 'price'); },
        discount: function (a, b) { return n(b, 'discount') - n(a, 'discount') || n(b, 'rank') - n(a, 'rank'); }
      }[s] || function () { return 0; };
      return list.slice().sort(cmp);
    }

    /* ---------- counts follow the other filters, options with nothing behind them hide ---------- */
    function refreshCounts() {
      $$('.filter-group[data-filter]', sidebar).forEach(function (g) {
        var key = g.getAttribute('data-filter');
        if (key === 'price') return;
        var base = cards.filter(function (c) { return matches(c, key === 'flags' ? null : key); });
        $$('.filter-checkbox', g).forEach(function (label) {
          var input = $('input', label), count = $('.count', label), n;
          if (key === 'flags') n = input.value === 'on-sale' ? base.filter(function (c) { return Number(c.getAttribute('data-discount')) > 0; }).length : null;
          else n = base.filter(function (c) { return cardValue(c, key) === input.value; }).length;
          if (count && n !== null) count.textContent = '(' + n + ')';
          label.hidden = label.getAttribute('data-search-hidden') === '1' || (n === 0 && !input.checked);
        });
      });
    }

    /* ---------- active filter chips ---------- */
    function renderChips() {
      var out = [];
      $$('.filter-group[data-filter] input[type=checkbox]:checked', sidebar).forEach(function (i) {
        var label = $('.label', i.closest('label'));
        out.push('<span class="filter-tag">' + A.esc(label ? label.textContent : i.value) + '<button type="button" aria-label="Remove filter" data-uncheck="' + A.esc(i.closest('.filter-group').getAttribute('data-filter')) + '|' + A.esc(i.value) + '"><i class="fas fa-times"></i></button></span>');
      });
      var b = priceBounds();
      if (b[0] > 0 || b[1] < priceMax) out.push('<span class="filter-tag">' + A.esc(A.money(b[0])) + ' – ' + A.esc(A.money(b[1])) + '<button type="button" aria-label="Remove price filter" data-uncheck="price|"><i class="fas fa-times"></i></button></span>');
      chips.innerHTML = out.join('') + (out.length > 1 ? '<button type="button" class="filter-tag filter-tag--clear" data-clear-filters>Clear all</button>' : '');
      chips.hidden = !out.length;
    }

    /* ---------- pagination ---------- */
    function renderPager(pages) {
      if (pages <= 1) { pager.innerHTML = ''; pager.hidden = true; return; }
      pager.hidden = false;
      var btn = function (p, label, opts) {
        opts = opts || {};
        return '<button type="button" class="page-btn' + (opts.active ? ' active' : '') + '" data-page="' + p + '"' + (opts.disabled ? ' disabled' : '') + (opts.aria ? ' aria-label="' + opts.aria + '"' : '') + (opts.active ? ' aria-current="page"' : '') + '>' + label + '</button>';
      };
      var html = btn(page - 1, '<i class="fas fa-chevron-left"></i>', { disabled: page === 1, aria: 'Previous page' });
      var shown = {};
      [1, pages, page - 1, page, page + 1].forEach(function (p) { if (p >= 1 && p <= pages) shown[p] = 1; });
      var last = 0;
      Object.keys(shown).map(Number).sort(function (a, b) { return a - b; }).forEach(function (p) {
        if (p - last > 1) html += '<span class="page-dots">...</span>';
        html += btn(p, p, { active: p === page });
        last = p;
      });
      html += btn(page + 1, '<i class="fas fa-chevron-right"></i>', { disabled: page === pages, aria: 'Next page' });
      pager.innerHTML = html;
    }

    /* ---------- render ---------- */
    function render(opts) {
      opts = opts || {};
      if (opts.reset) page = 1;
      var list = sortCards(cards.filter(function (c) { return matches(c); }));
      var total = list.length, pages = Math.max(1, Math.ceil(total / perPage));
      page = Math.min(Math.max(1, page), pages);
      var start = (page - 1) * perPage, slice = list.slice(start, start + perPage);
      cards.forEach(function (c) { c.hidden = true; });
      slice.forEach(function (c) { c.hidden = false; grid.appendChild(c); });
      if (info) info.innerHTML = total ? 'Showing <strong>' + (start + 1) + '-' + (start + slice.length) + '</strong> of <strong>' + total + '</strong> result' + (total === 1 ? '' : 's') : 'No results';
      $$('[data-result-count]').forEach(function (el) { el.textContent = total; });
      if (empty) empty.hidden = total > 0;
      grid.hidden = total === 0;
      renderPager(pages);
      renderChips();
      refreshCounts();
      updateTrack();
      var brands = checked('brand');
      $$('.brand-item[data-brand]').forEach(function (b) { var on = brands.indexOf(b.getAttribute('data-brand')) !== -1; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      var subs = checked('sub');
      if (h1 && mode !== 'search') {
        var sub = subs.length === 1 && A.subcategory(subs[0]);
        h1.textContent = sub ? sub.name : baseTitle;
      }
      if (opts.scroll) { var top = section.getBoundingClientRect().top + window.pageYOffset - 90; window.scrollTo({ top: top, behavior: 'smooth' }); }
    }

    /* ---------- price slider ---------- */
    function updateTrack() {
      if (!track) return;
      var b = priceBounds(), l = priceMax ? b[0] / priceMax * 100 : 0, r = priceMax ? b[1] / priceMax * 100 : 100;
      track.style.background = 'linear-gradient(90deg, rgba(255,255,255,.1) ' + l + '%, #ed3237 ' + l + '%, #ed3237 ' + r + '%, rgba(255,255,255,.1) ' + r + '%)';
    }
    function setPrice(lo, hi) {
      lo = Math.max(0, Math.min(priceMax, lo)); hi = Math.max(0, Math.min(priceMax, hi));
      if (lo > hi) { var t = lo; lo = hi; hi = t; }
      if (minNum) minNum.value = lo; if (maxNum) maxNum.value = hi;
      if (minRange) minRange.value = lo; if (maxRange) maxRange.value = hi;
    }
    var priceTimer;
    function priceChanged() { clearTimeout(priceTimer); priceTimer = setTimeout(function () { render({ reset: true }); }, 120); }
    if (minRange) minRange.addEventListener('input', function () { if (Number(minRange.value) > Number(maxRange.value)) minRange.value = maxRange.value; minNum.value = minRange.value; updateTrack(); priceChanged(); });
    if (maxRange) maxRange.addEventListener('input', function () { if (Number(maxRange.value) < Number(minRange.value)) maxRange.value = minRange.value; maxNum.value = maxRange.value; updateTrack(); priceChanged(); });
    [minNum, maxNum].forEach(function (el) { if (el) el.addEventListener('change', function () { setPrice(Number(minNum.value) || 0, maxNum.value === '' ? priceMax : Number(maxNum.value)); priceChanged(); }); });

    /* ---------- events ---------- */
    if (sidebar) {
      sidebar.addEventListener('change', function (e) { if (e.target.matches('input[type=checkbox]')) render({ reset: true }); });
      $$('.filter-title', sidebar).forEach(function (t) {
        t.setAttribute('role', 'button'); t.setAttribute('tabindex', '0');
        var g = t.parentNode; t.setAttribute('aria-expanded', g.classList.contains('collapsed') ? 'false' : 'true');
        var toggle = function () { var c = g.classList.toggle('collapsed'); t.setAttribute('aria-expanded', c ? 'false' : 'true'); };
        t.addEventListener('click', toggle);
        t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      });
      $$('[data-filter-search]', sidebar).forEach(function (input) {
        input.addEventListener('input', function () {
          var q = input.value.trim().toLowerCase();
          $$('.filter-checkbox', input.closest('.filter-group')).forEach(function (label) {
            var hit = !q || $('.label', label).textContent.toLowerCase().indexOf(q) !== -1;
            if (hit) label.removeAttribute('data-search-hidden'); else label.setAttribute('data-search-hidden', '1');
          });
          refreshCounts();
        });
      });
    }
    function clearAll() {
      $$('input[type=checkbox]', sidebar).forEach(function (i) { i.checked = false; });
      setPrice(0, priceMax);
      if (location.hash && !/^#(page|q)-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
      render({ reset: true });
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest('#clearFilters, [data-clear-filters]')) { clearAll(); return; }
      var un = e.target.closest('[data-uncheck]');
      if (un) {
        var parts = un.getAttribute('data-uncheck').split('|'), key = parts[0], val = parts.slice(1).join('|');
        if (key === 'price') setPrice(0, priceMax);
        else $$('.filter-group[data-filter="' + key + '"] input[type=checkbox]', sidebar).forEach(function (i) { if (i.value === val) i.checked = false; });
        render({ reset: true });
        return;
      }
      var pb = e.target.closest('.pagination [data-page]');
      if (pb && !pb.disabled) { page = Number(pb.getAttribute('data-page')); render({ scroll: true }); return; }
      var brand = e.target.closest('.brand-item[data-brand]');
      if (brand) {
        var name = brand.getAttribute('data-brand');
        $$('.filter-group[data-filter="brand"] input[type=checkbox]', sidebar).forEach(function (i) { if (i.value === name) i.checked = !i.checked; });
        render({ reset: true, scroll: true });
      }
    });
    if (sortSel) sortSel.addEventListener('change', function () { render({ reset: true }); });
    $$('.view-btn', section).forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.view-btn', section).forEach(function (b) { b.classList.toggle('active', b === btn); b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        grid.classList.toggle('list-view', btn.getAttribute('data-view') === 'list');
        A.store.set('view', btn.getAttribute('data-view'));
      });
    });
    if (A.store.get('view', 'grid') === 'list') { var lv = $('.view-btn[data-view="list"]', section); if (lv) lv.click(); }

    /* mobile filter drawer */
    var toggle = $('#filterToggle');
    function openFilters() { sidebar.classList.add('active'); document.body.classList.add('filters-open'); var c = $('.filters-close', sidebar); if (c) c.focus(); }
    function closeFilters() { sidebar.classList.remove('active'); document.body.classList.remove('filters-open'); if (toggle && window.innerWidth <= 968) toggle.focus(); }
    if (toggle && sidebar) toggle.addEventListener('click', openFilters);
    $$('[data-close-filters]').forEach(function (b) { b.addEventListener('click', closeFilters); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sidebar && sidebar.classList.contains('active')) closeFilters(); });

    /* ---------- deep links: laptops.html#gaming-laptops, products.html#brand-dell ---------- */
    function applyHash() {
      var h = decodeURIComponent(location.hash.replace(/^#/, ''));
      if (!h) return false;
      var hit = false;
      if (h.indexOf('brand-') === 0) {
        var slug = h.slice(6);
        $$('.filter-group[data-filter="brand"] input[type=checkbox]', sidebar).forEach(function (i) {
          var on = i.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug;
          i.checked = on; if (on) hit = true;
        });
      } else {
        ['sub', 'cat'].forEach(function (key) {
          var inputs = $$('.filter-group[data-filter="' + key + '"] input[type=checkbox]', sidebar);
          if (inputs.some(function (i) { return i.value === h; })) { inputs.forEach(function (i) { i.checked = i.value === h; }); hit = true; }
        });
      }
      return hit;
    }
    window.addEventListener('hashchange', function () { if (applyHash()) render({ reset: true, scroll: true }); });

    /* ---------- search page ---------- */
    if (mode === 'search') {
      var q = '';
      try { q = new URLSearchParams(location.search).get('q') || ''; } catch (e) { /* old browser */ }
      if (!q) { try { q = window.sessionStorage.getItem('akku.lastQuery') || ''; } catch (e) { /* storage blocked */ } }
      q = q.trim();
      var title = $('[data-search-title]'), summary = $('[data-search-summary]'), field = $('#searchInput');
      if (field) field.value = q;
      if (q) {
        var found = A.search(q);
        searchSet = {}; found.forEach(function (p, i) { searchSet[p.id] = true; searchRank[p.id] = i; });
        if (title) title.textContent = 'Results for "' + q + '"';
        if (summary) summary.textContent = found.length ? found.length + ' product' + (found.length === 1 ? '' : 's') + ' found' : 'Nothing matched. Check the spelling or try a more general word.';
        document.title = 'Search: ' + q + ' | ' + A.site.brand.name;
        if (sortSel) sortSel.value = 'relevance';
      } else if (sortSel) {
        var rel = $('option[value="relevance"]', sortSel); if (rel) rel.remove();
      }
    }

    applyHash();
    render();
    document.addEventListener('akku:prefs', function () { renderChips(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
