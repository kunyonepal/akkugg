/* Our builds: open a build's photos in a viewer (arrow keys, swipe-free buttons, Escape to close). */
(function () {
  'use strict';
  var A = window.Akku, $ = A.$;
  function boot() {
    var box = $('[data-lightbox-view]'); if (!box) return;
    var img = $('img', box), count = $('.akku-lightbox__count', box), list = [], i = 0, last = null;
    function show() { img.src = list[i]; count.textContent = list.length > 1 ? (i + 1) + ' / ' + list.length : ''; $('.prev', box).hidden = $('.next', box).hidden = list.length < 2; }
    function close() { box.hidden = true; document.body.style.overflow = ''; if (last) last.focus(); }
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lightbox]');
      if (b) { try { list = JSON.parse(b.getAttribute('data-lightbox')); } catch (x) { list = []; } if (!list.length) return; i = 0; last = b; show(); box.hidden = false; document.body.style.overflow = 'hidden'; $('[data-lb-close]', box).focus(); return; }
      if (e.target.closest('[data-lb-close]') || e.target === box) { close(); return; }
      var s = e.target.closest('[data-lb-step]'); if (s) { i = (i + Number(s.getAttribute('data-lb-step')) + list.length) % list.length; show(); }
    });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { i = (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length; show(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
