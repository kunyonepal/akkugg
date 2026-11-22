/* Compare page: up to 4 products, add by search, specification table with "differences only". */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  var SLOTS = 4;
  function boot() {
    var grid = $('#comparisonGrid');
    if (!grid) return;
    var specs = $('#specsSection'), table = $('#specsTable'), diffOnly = false;

    function render() {
      var items = A.compare.all().map(A.product).filter(Boolean);
      var html = items.map(function (p) {
        return '<div class="compare-slot has-product" data-pid="' + p.id + '">' +
          '<button class="remove-product-btn" type="button" data-c-remove aria-label="Remove ' + A.esc(A.shortName(p)) + '"><i class="fas fa-times"></i></button>' +
          '<div class="slot-content"><div class="product-image-wrapper ' + A.mediaClass(p) + '">' + A.media(p, 300, 300) + '</div>' +
          '<div class="product-info"><div class="product-brand">' + A.esc(p.brand) + '</div><div class="product-name">' + A.esc(p.name) + '</div>' +
          '<div class="product-price" data-price="' + p.price + '">' + A.money(p.price) + '</div>' +
          '<a class="view-product-btn" href="' + A.productUrl(p) + '">View Product</a>' +
          '<button class="view-product-btn akku-compare-cart" type="button" data-action="add-to-cart" data-pid="' + p.id + '"' + (p.stock === 'out' ? ' disabled' : '') + '><i class="fas fa-shopping-cart"></i> Add to Cart</button></div></div></div>';
      }).join('');
      for (var i = items.length; i < SLOTS; i++) {
        html += '<div class="compare-slot"><div class="empty-slot-content"><div class="add-icon"><i class="fas fa-plus"></i></div><div class="add-label">Add to Compare</div>' +
          '<div class="search-box akku-compare-search"><i class="fas fa-search"></i><input type="text" placeholder="Search products..." aria-label="Search for a product to compare" autocomplete="off"><div class="akku-compare-suggest" hidden></div></div></div></div>';
      }
      grid.innerHTML = html;
      $('#clearAllBtn').disabled = !items.length;
      renderTable(items);
      A.refresh(grid);
    }

    function renderTable(items) {
      specs.hidden = items.length < 1;
      if (!items.length) { table.innerHTML = ''; return; }
      var rows = [['Overview', [['Brand', function (p) { return p.brand; }], ['Category', function (p) { return A.categoryName(p); }], ['Price', function (p) { return A.money(p.price); }], ['Discount', function (p) { var d = A.discount(p); return d ? d + '% off' : ''; }], ['Availability', function (p) { return p.stock === 'out' ? 'Out of stock' : 'In stock'; }]]]];
      var keys = [];
      items.forEach(function (p) { Object.keys(p.specs || {}).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); }); });
      if (keys.length) rows.push(['Specifications', keys.map(function (k) { return [k, function (p) { return (p.specs || {})[k] || ''; }]; })]);
      var html = '<thead><tr><th class="spec-label">Specification</th>' + items.map(function (p) { return '<th class="spec-value">' + A.esc(A.shortName(p)) + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.forEach(function (group) {
        var body = group[1].map(function (r) {
          var vals = items.map(r[1]);
          var differs = vals.some(function (v) { return v !== vals[0]; });
          if (diffOnly && !differs && items.length > 1) return '';
          return '<tr class="spec-row' + (differs ? ' is-different' : '') + '"><td class="spec-label">' + A.esc(r[0]) + '</td>' + vals.map(function (v) { return '<td class="spec-value' + (v ? '' : ' empty') + '">' + (v ? A.esc(v) : '-') + '</td>'; }).join('') + '</tr>';
        }).join('');
        if (body) html += '<tr class="specs-category"><td colspan="' + (items.length + 1) + '">' + group[0] + '</td></tr>' + body;
      });
      table.innerHTML = html + '</tbody>';
    }

    grid.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-c-remove]');
      if (rm) { A.compare.remove(rm.closest('[data-pid]').getAttribute('data-pid')); return; }
      var pick = e.target.closest('[data-c-add]');
      if (pick) { A.compare.add(pick.getAttribute('data-c-add')); }
    });
    grid.addEventListener('input', function (e) {
      if (!e.target.matches('.akku-compare-search input')) return;
      var box = e.target.parentNode.querySelector('.akku-compare-suggest'), q = e.target.value.trim();
      var have = A.compare.all();
      var found = q.length < 2 ? [] : A.search(q, 12).filter(function (p) { return have.indexOf(p.id) === -1; }).slice(0, 6);
      box.hidden = q.length < 2;
      box.innerHTML = found.length ? found.map(function (p) { return '<button type="button" data-c-add="' + p.id + '"><span>' + A.esc(A.shortName(p)) + '</span><small data-price="' + p.price + '">' + A.money(p.price) + '</small></button>'; }).join('') : '<p>No matching products</p>';
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.akku-compare-search')) $$('.akku-compare-suggest', grid).forEach(function (b) { b.hidden = true; }); });
    $('#clearAllBtn').addEventListener('click', function () { A.compare.clear(); });
    $$('.specs-filter .filter-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.specs-filter .filter-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
        diffOnly = b.getAttribute('data-diff') === 'diff';
        renderTable(A.compare.all().map(A.product).filter(Boolean));
      });
    });
    document.addEventListener('akku:compare', render);
    document.addEventListener('akku:sync', render);
    document.addEventListener('akku:prefs', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
