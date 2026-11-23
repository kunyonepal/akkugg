/* Print buttons on invoices and warranty cards (inline scripts are blocked by the security policy). */
document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-print]')) window.print(); });
