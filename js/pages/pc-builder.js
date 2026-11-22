/* Custom PC builder: pick a part per slot from the catalogue, check socket / memory compatibility,
   add the whole build to the cart as one line. The build is remembered on this device. */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$, $$ = A.$$;
  var SLOTS = [
    { id: 'cpu', sub: 'processors', label: 'Processor', icon: 'fa-microchip', required: true },
    { id: 'motherboard', sub: 'motherboards', label: 'Motherboard', icon: 'fa-server', required: true },
    { id: 'gpu', sub: 'graphics-cards', label: 'Graphics Card', icon: 'fa-tv', required: false },
    { id: 'ram', sub: 'memory', label: 'Memory (RAM)', icon: 'fa-memory', required: true },
    { id: 'storage', sub: 'storage', label: 'Storage', icon: 'fa-hdd', required: true },
    { id: 'psu', sub: 'power-supplies', label: 'Power Supply', icon: 'fa-plug', required: true },
    { id: 'case', sub: 'cases', label: 'PC Case', icon: 'fa-box', required: true },
    { id: 'cooling', sub: 'cooling', label: 'CPU Cooler', icon: 'fa-fan', required: false }
  ];
  function boot() {
    if (!$('.builder-interface')) return;
    var build = A.store.get('build', {});
    Object.keys(build).forEach(function (k) { if (!A.product(build[k])) delete build[k]; });
    var modal = $('#componentModal'), openSlot = null, modalBrand = 'all', lastFocus = null;

    function slot(id) { return SLOTS.filter(function (s) { return s.id === id; })[0]; }
    function part(id) { return build[id] ? A.product(build[id]) : null; }
    function save() { A.store.set('build', build); }

    /* compatibility: CPU socket vs board, memory type vs board */
    function problems() {
      var out = [], cpu = part('cpu'), mb = part('motherboard'), ram = part('ram');
      var c = function (p, k) { return p && p.compat ? p.compat[k] : null; };
      if (cpu && mb && c(cpu, 'socket') && c(mb, 'socket') && c(cpu, 'socket') !== c(mb, 'socket')) out.push(A.shortName(cpu) + ' (' + c(cpu, 'socket') + ') does not fit ' + A.shortName(mb) + ' (' + c(mb, 'socket') + ').');
      if (ram && mb && c(ram, 'ram') && c(mb, 'ram') && c(ram, 'ram') !== c(mb, 'ram')) out.push(A.shortName(mb) + ' takes ' + c(mb, 'ram') + ' memory; ' + A.shortName(ram) + ' is ' + c(ram, 'ram') + '.');
      return out;
    }
    /* would this option clash with what is already picked? */
    function clash(slotId, p) {
      var keep = build[slotId]; build[slotId] = p.id;
      var bad = problems().length > 0;
      if (keep) build[slotId] = keep; else delete build[slotId];
      return bad;
    }

    function render() {
      var picked = SLOTS.filter(function (s) { return part(s.id); });
      var total = picked.reduce(function (n, s) { return n + part(s.id).price; }, 0);
      var missing = SLOTS.filter(function (s) { return s.required && !part(s.id); });
      var issues = problems();
      SLOTS.forEach(function (s) {
        var card = $('.component-card[data-component="' + s.id + '"]'), p = part(s.id);
        card.classList.toggle('selected', !!p);
        $('.component-status', card).textContent = p ? A.shortName(p) : 'Not selected';
        var btn = $('.component-select-action', card);
        btn.innerHTML = p ? '<i class="fas fa-check"></i><span>' + A.esc(A.money(p.price)) + ' &middot; Change</span>' : '<i class="fas fa-plus"></i><span>Select ' + s.label.replace(/ \(.*/, '') + '</span>';
        btn.classList.toggle('is-picked', !!p);
        $('[data-clear-slot]', card).hidden = !p;
      });
      var pct = Math.round(picked.length / SLOTS.length * 100);
      $('[data-progress-fill]').style.width = pct + '%';
      $('[data-progress-count]').textContent = picked.length + '/' + SLOTS.length + ' Components';
      $('[data-progress-pct]').textContent = pct + '%';
      var lines = picked.map(function (s) { var p = part(s.id); return '<div class="price-row"><span><i class="fas ' + s.icon + '"></i> ' + A.esc(A.shortName(p)) + '</span><span class="price" data-price="' + p.price + '">' + A.money(p.price) + '</span></div>'; }).join('');
      var note = (A.site.builder && A.site.builder.assemblyNote) || '';
      $('[data-build-lines]').innerHTML = (lines || '<div class="price-row akku-muted"><span>No parts selected yet</span><span class="price">' + A.money(0) + '</span></div>') +
        '<div class="price-row akku-build-total"><span>Total</span><span class="price" data-price="' + total + '">' + A.money(total) + '</span></div>' + (note ? '<p class="akku-build-note">' + A.esc(note) + '</p>' : '');
      var tot = $('[data-build-total]'); tot.setAttribute('data-price', total); tot.textContent = A.money(total);
      var compatText = $('[data-compat-text]'), dot = $('[data-compat-dot]'), inline = $('[data-compat-inline]');
      dot.className = 'compatibility-status ' + (issues.length ? 'error' : (picked.length ? 'success' : 'pending'));
      if (issues.length) { compatText.textContent = issues[0]; inline.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>' + A.esc(issues.join(' ')) + '</span>'; }
      else if (missing.length) { compatText.textContent = picked.length ? 'No conflicts so far' : 'Select parts to check compatibility'; inline.innerHTML = '<i class="fas fa-info-circle"></i><span>Still needed: ' + A.esc(missing.map(function (s) { return s.label; }).join(', ')) + '</span>'; }
      else { compatText.textContent = 'All selected parts fit together'; inline.innerHTML = '<i class="fas fa-check-circle"></i><span>All components compatible</span>'; }
      inline.className = 'compatibility-status-inline' + (issues.length ? ' is-error' : missing.length ? ' is-pending' : ' is-ok');
      $('[data-build-cart]').disabled = !!(issues.length || missing.length);
      var kase = part('case'), img = $('#pcCaseBg');
      var want = kase && kase.image ? A.img(kase.image, 900, 900) : img.getAttribute('data-default');
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
      A.applyCurrency($('.builder-interface'));
    }

    /* ---------- modal ---------- */
    function options(s) {
      var list = A.productsIn('components', s.sub).slice();
      var sort = $('#modalSort').value;
      if (sort === 'price-low') list.sort(function (a, b) { return a.price - b.price; });
      else if (sort === 'price-high') list.sort(function (a, b) { return b.price - a.price; });
      else list.sort(function (a, b) { return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0) || a.price - b.price; });
      return list;
    }
    function renderModal() {
      var s = slot(openSlot), list = options(s);
      var brands = [];
      list.forEach(function (p) { if (brands.indexOf(p.brand) === -1) brands.push(p.brand); });
      if (modalBrand !== 'all' && brands.indexOf(modalBrand) === -1) modalBrand = 'all';
      $('[data-modal-brands]', modal).innerHTML = ['all'].concat(brands).map(function (b) {
        return '<label class="filter-chip' + (b === modalBrand ? ' filter-chip--active' : '') + '"><input type="radio" name="modalBrand" value="' + A.esc(b) + '"' + (b === modalBrand ? ' checked' : '') + '><span>' + (b === 'all' ? 'All' : A.esc(b)) + '</span></label>';
      }).join('');
      var shown = list.filter(function (p) { return modalBrand === 'all' || p.brand === modalBrand; });
      $('[data-modal-grid]', modal).innerHTML = shown.map(function (p) {
        var sel = build[openSlot] === p.id, bad = !sel && clash(openSlot, p);
        return '<div class="component-option-card' + (p.recommended ? ' recommended' : '') + (sel ? ' selected' : '') + (bad ? ' is-incompatible' : '') + '">' +
          '<div class="component-option-card__image ' + A.mediaClass(p) + '">' + (p.image ? A.media(p, 200, 200) : '<i class="fas ' + s.icon + '"></i>') + '</div>' +
          '<div class="component-option-card__info"><h4>' + A.esc(p.name) + '</h4><div class="specs">' + (p.specs && p.specs.Summary ? p.specs.Summary.split(', ') : p.chips || []).map(function (x) { return '<span>' + A.esc(x) + '</span>'; }).join('') + '</div>' +
          (p.recommended ? '<span class="akku-reco"><i class="fas fa-thumbs-up"></i> Recommended</span>' : '') + (bad ? '<span class="akku-clash"><i class="fas fa-exclamation-triangle"></i> Does not fit your other parts</span>' : '') + '</div>' +
          '<div class="component-option-card__footer"><div class="price" data-price="' + p.price + '">' + A.money(p.price) + '</div>' +
          '<button class="btn-select-component' + (sel ? ' selected-btn' : '') + '" type="button" data-pick="' + p.id + '"' + (p.stock === 'out' ? ' disabled' : '') + '>' + (sel ? '<i class="fas fa-check-circle"></i> Selected' : (p.stock === 'out' ? 'Out of stock' : '<i class="fas fa-check"></i> Select')) + '</button></div></div>';
      }).join('') || '<p class="akku-muted">No parts in this category yet.</p>';
      A.applyCurrency(modal);
    }
    function open(id) {
      var s = slot(id); if (!s) return;
      openSlot = id; modalBrand = 'all'; lastFocus = document.activeElement;
      $('#componentModalTitle').innerHTML = '<i class="fas ' + s.icon + '"></i> Select ' + A.esc(s.label);
      $('[data-modal-sub]', modal).textContent = s.required ? 'Required for your build' : 'Optional';
      renderModal();
      modal.hidden = false; modal.classList.add('active'); document.body.style.overflow = 'hidden';
      $('.component-modal-v2__close', modal).focus();
    }
    function close() { modal.hidden = true; modal.classList.remove('active'); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }

    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open-slot]'); if (o) { open(o.getAttribute('data-open-slot')); return; }
      var c = e.target.closest('[data-clear-slot]'); if (c) { delete build[c.getAttribute('data-clear-slot')]; save(); render(); return; }
      if (e.target.closest('[data-close-modal]')) { close(); return; }
      var pick = e.target.closest('[data-pick]');
      if (pick && openSlot) {
        var p = A.product(pick.getAttribute('data-pick'));
        build[openSlot] = p.id; save(); render(); close();
        var issues = problems();
        A.toast(issues.length ? issues[0] : A.shortName(p) + ' added to your build', { type: issues.length ? 'error' : 'success' });
        return;
      }
      var pre = e.target.closest('[data-load-preset]');
      if (pre) {
        var preset = (A.catalog.builderPresets || []).filter(function (x) { return x.id === pre.getAttribute('data-load-preset'); })[0];
        if (preset) { build = {}; Object.keys(preset.parts).forEach(function (k) { if (A.product(preset.parts[k])) build[k] = preset.parts[k]; }); save(); render(); switchTab('custom'); A.toast(preset.name + ' loaded. Swap any part you like.'); }
        return;
      }
      if (e.target.closest('[data-start-fresh]')) { build = {}; save(); render(); switchTab('custom'); }
    });
    modal.addEventListener('change', function (e) { if (e.target.name === 'modalBrand') { modalBrand = e.target.value; renderModal(); } });
    $('#modalSort').addEventListener('change', renderModal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });

    /* ---------- tabs ---------- */
    function switchTab(name) {
      $$('.builder-tab').forEach(function (t) { var on = t.getAttribute('data-tab') === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
      $$('.builder-tabs-content > .tab-content').forEach(function (c) { c.classList.toggle('active', c.getAttribute('data-content') === name); });
      if (name === 'custom') $('.builder-interface').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    $$('.builder-tab').forEach(function (t) { t.addEventListener('click', function () { switchTab(t.getAttribute('data-tab')); }); });

    /* ---------- actions ---------- */
    $('[data-build-cart]').addEventListener('click', function () {
      var ids = SLOTS.map(function (s) { return build[s.id]; }).filter(Boolean);
      if (A.cart.addBuild('Custom PC Build', ids)) A.toast('Your custom build was added to the cart', { href: A.root + 'cart.html', linkText: 'View cart' });
    });
    $('[data-build-reset]').addEventListener('click', function () {
      var kept = build; build = {}; save(); render();
      A.toast('Build cleared', { type: 'info', href: '#undo', linkText: 'Undo' });
      var host = $('#akkuToasts'), last = host && host.lastElementChild, link = last && $('.akku-toast__link', last);
      if (link) link.addEventListener('click', function (ev) { ev.preventDefault(); build = kept; save(); render(); last.remove(); });
    });
    $('[data-build-copy]').addEventListener('click', function () {
      var picked = SLOTS.filter(function (s) { return part(s.id); });
      if (!picked.length) { A.toast('Pick some parts first.', { type: 'info' }); return; }
      var total = picked.reduce(function (n, s) { return n + part(s.id).price; }, 0);
      var text = A.site.brand.name + ' custom PC build\n' + picked.map(function (s) { var p = part(s.id); return s.label + ': ' + p.name + ' - ' + A.money(p.price, 'NPR'); }).join('\n') + '\nTotal: ' + A.money(total, 'NPR');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { A.toast('Parts list copied'); }, function () { A.toast('Copy is blocked here. Select and copy the list from the summary instead.', { type: 'info' }); });
      else A.toast('Copy is not available in this browser.', { type: 'info' });
    });
    document.addEventListener('akku:prefs', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
