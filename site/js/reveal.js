// Появление блоков при прокрутке. Подключён в конце <body> обычным скриптом:
// блоки, видимые сразу, показываются до первой отрисовки (без мигания), остальные — когда доходит прокрутка.
(function () {
  var els = [].slice.call(document.querySelectorAll('[data-reveal]'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var vh = window.innerHeight;
  var rest = [];
  els.forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.top < vh * 0.94 && r.bottom > 0) el.classList.add('is-in', 'is-instant');
    else rest.push(el);
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  rest.forEach(function (el) { io.observe(el); });
})();
