// Поведение сайта: тема, счётчики, «живые» карточки и кнопки, параллакс, шапка, прогресс чтения, активный пункт меню.
// Всё отключается при «уменьшить движение»; эффекты наведения — только для мыши.
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
const motion = () => !reduce.matches;

// ---------- Тема: переключение «кругом» от кнопки ----------
const themeBtn = document.querySelector('[data-theme-toggle]');
const currentTheme = () => root.dataset.theme || (darkMedia.matches ? 'dark' : 'light');
function syncTheme() {
  if (!themeBtn) return;
  const dark = currentTheme() === 'dark';
  themeBtn.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  themeBtn.setAttribute('aria-pressed', String(dark));
}
themeBtn?.addEventListener('click', async () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const apply = () => {
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* тема просто не запомнится */ }
    syncTheme();
  };
  if (!document.startViewTransition || !motion()) { apply(); return; }
  const r = themeBtn.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('vt-theme');
  const t = document.startViewTransition(apply);
  try {
    await t.ready;
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 600, easing: 'cubic-bezier(.2,.75,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
    await t.finished;
  } catch { /* переход прерван — тема всё равно применена */ }
  root.classList.remove('vt-theme');
});
darkMedia.addEventListener?.('change', syncTheme);
syncTheme();

// ---------- Счётчики цифр ----------
const counters = document.querySelectorAll('[data-count]');
if (counters.length && motion() && 'IntersectionObserver' in window) {
  const fmt = new Intl.NumberFormat('ru-RU');
  const run = (el) => {
    const target = Number(el.dataset.count);
    const start = performance.now();
    const dur = Math.min(1400, 500 + target * 6);
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      el.textContent = fmt.format(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
  }), { threshold: 0.6 });
  counters.forEach((el) => { el.textContent = '0'; io.observe(el); });
}

// ---------- Карточки: наклон за курсором и подсветка ----------
if (fine.matches && motion()) {
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    const strength = card.classList.contains('featured') ? 2 : 5;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      card.style.setProperty('--rx', `${(0.5 - py) * strength}deg`);
      card.style.setProperty('--ry', `${(px - 0.5) * strength}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  // ---------- «Магнитные» кнопки ----------
  document.querySelectorAll('[data-magnet]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.translate = `${dx * 0.18}px ${dy * 0.28}px`;
    });
    el.addEventListener('pointerleave', () => { el.style.translate = ''; });
  });

  // ---------- Подсветка первого экрана за курсором ----------
  const hero = document.querySelector('[data-hero]');
  hero?.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--hx', `${e.clientX - r.left}px`);
    hero.style.setProperty('--hy', `${e.clientY - r.top}px`);
  });
}

// ---------- Прокрутка: параллакс фото, шапка, прогресс ----------
const header = document.querySelector('[data-header]');
const photo = document.querySelector('[data-parallax]');
const bar = document.querySelector('[data-progress]');
let lastY = window.scrollY;
let ticking = false;
function onScroll() {
  ticking = false;
  const y = window.scrollY;
  if (header) {
    header.classList.toggle('is-scrolled', y > 8);
    // Прячем шапку при прокрутке вниз, показываем при прокрутке вверх (но не когда в ней фокус)
    const down = y > lastY + 4;
    const up = y < lastY - 4;
    if (down && y > 160 && !header.contains(document.activeElement)) header.classList.add('is-hidden');
    else if (up || y < 160) header.classList.remove('is-hidden');
  }
  if (photo && motion() && window.innerWidth >= 900) photo.style.setProperty('--py', `${Math.min(y, 700) * 0.06}px`);
  if (bar) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  }
  lastY = y;
}
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
header?.addEventListener('focusin', () => header.classList.remove('is-hidden'));
onScroll();

// ---------- Активный пункт меню на главной ----------
if (document.body.dataset.page === 'home' && 'IntersectionObserver' in window) {
  const links = new Map([...document.querySelectorAll('[data-nav]')].map((a) => [a.dataset.nav, a]));
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const a = links.get(e.target.id);
    if (!a) return;
    if (e.isIntersecting) { links.forEach((l) => l.removeAttribute('aria-current')); a.setAttribute('aria-current', 'true'); }
    else if (a.getAttribute('aria-current')) a.removeAttribute('aria-current');
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}
