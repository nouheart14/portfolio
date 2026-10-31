// Сборка PDF-портфолио: data/profile.json + data/projects/*.json → out/portfolio.html → out/Andrey-Bateev-portfolio.pdf
// Запуск: node tools/build-pdf.mjs            (PDF)
//         node tools/build-pdf.mjs --preview  (+ PNG каждой страницы в out/preview/ для проверки глазами)
// Новый проект = новый файл в data/projects/ (поле order задаёт порядок). Шаблон трогать не нужно.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const read = (p) => JSON.parse(readFileSync(p, 'utf-8'));
const profile = read(join(ROOT, 'data', 'profile.json'));
const projects = readdirSync(join(ROOT, 'data', 'projects'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => read(join(ROOT, 'data', 'projects', f)))
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const todo = (v, text = 'уточнить') => (v ? esc(v) : `<span class="todo">${text}</span>`);
const nn = (n) => String(n).padStart(2, '0');

const STATUS = { live: 'в продакшене', dev: 'в работе', done: 'сдан', archive: 'архив' };
const total = projects.length;
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many);
const live = projects.filter((p) => p.statusKind === 'live').length;
const keyNumbers = [
  { value: String(total), label: total === 1 ? 'проект' : 'проектов в портфолио' },
  { value: String(live), label: plural(live, 'проект в продакшене', 'проекта в продакшене', 'проектов в продакшене') },
  ...(profile.keyNumbers || []),
];

// Номера страниц: проект с полем extra занимает две страницы
const pageNo = [];
let _n = 2;
for (const p of projects) { pageNo.push(_n); _n += p.extra ? 2 : 1; }
const aboutNo = _n;

// ---------- Страницы ----------
const footer = (n) => `<footer class="foot"><span>${esc(profile.name)} · портфолио</span><span>${n}</span></footer>`;

function cover() {
  const c = profile.contacts || {};
  return `
<section class="page page--cover${profile.photo ? ' page--photo' : ''}">
  <div class="cover__bar"></div>
  ${profile.photo ? `<img class="cover__photo" src="../assets/${esc(profile.photo)}" alt="${esc(profile.name)}">` : ''}
  <header class="cover__head">
    <p class="kicker">Портфолио</p>
    <h1>${esc(profile.name)}</h1>
    <p class="cover__title">${esc(profile.title)}</p>
  </header>
  <p class="cover__summary">${esc(profile.summary)}</p>
  <ul class="numbers">
    ${keyNumbers.map((k) => `<li><b>${esc(k.value)}</b><span>${esc(k.label)}</span></li>`).join('')}
  </ul>
  <h2 class="sect">Проекты</h2>
  <ol class="toc">
    ${projects.map((p, i) => `
    <li>
      <span class="toc__n">${nn(i + 1)}</span>
      <span class="toc__t"><b>${esc(p.title)}</b><i>${esc(p.category)}</i></span>
      <span class="chip chip--${esc(p.statusKind || 'dev')}">${STATUS[p.statusKind] || 'в работе'}</span>
      <span class="toc__p">${pageNo[i]}</span>
    </li>`).join('')}
  </ol>
  <p class="cover__contact">
    ${['email', 'telegram', 'phone', 'github', 'site'].map((k) => (c[k] ? `<span>${esc(c[k])}</span>` : '')).join('') || `<span class="todo">контакты: добавить в data/profile.json</span>`}
  </p>
</section>`;
}

function shotsRow(p) {
  const items = (p.shots || []).map((s) => {
    const src = `../assets/shots/${s.file}`;
    const cls = s.kind === 'mobile' ? 'shot shot--m' : s.kind === 'diagram' ? 'shot shot--w' : 'shot shot--d';
    return `<figure class="${cls}"><img src="${esc(src)}" alt="${esc(s.caption || p.title)}"><figcaption>${esc(s.caption || '')}</figcaption></figure>`;
  });
  // Схема (diagram) показывается целиком, без обрезки, и сама задаёт высоту ряда
  const auto = (p.shots || []).length === 1 && p.shots[0].kind === 'diagram';
  return `<div class="shots${auto ? ' shots--auto' : ''}">${items.join('')}</div>`;
}

function projectPage(p, i) {
  const meta = [
    ['Роль', todo(p.role)],
    ['Заказчик', esc(p.client)],
    ['Статус', `<span class="chip chip--${esc(p.statusKind || 'dev')}">${STATUS[p.statusKind] || 'в работе'}</span> ${esc(p.status)}`],
  ];
  if (p.link) meta.push(['Ссылка', `<a href="${esc(p.link.url)}">${esc(p.link.text)}</a>`]);
  return `
<section class="page page--project">
  <div class="top"><span>Проект ${nn(i + 1)} / ${nn(total)}</span><span>${esc(p.category)}</span></div>
  <h2 class="ptitle">${esc(p.title)}</h2>
  <p class="ptag">${esc(p.tagline)}</p>
  <dl class="meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  ${shotsRow(p)}
  <div class="cols">
    <div class="col col--main">
      <p class="lead">${esc(p.summary)}</p>
      <h3>Что сделано</h3>
      <ul class="bul">${(p.highlights || []).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
    </div>
    <aside class="col col--side">
      <ul class="metrics">${(p.metrics || []).map((m) => `<li><b>${esc(m.value)}</b><span>${esc(m.label)}</span></li>`).join('')}</ul>
      <h3>Стек и технологии</h3>
      ${(p.stack || []).map((g) => `<div class="sg"><span class="sg__n">${esc(g.name)}</span><span class="sg__i">${g.items.map((x) => `<i>${esc(x)}</i>`).join('')}</span></div>`).join('')}
      ${p.footnote ? `<p class="fn">${esc(p.footnote)}</p>` : ''}
    </aside>
  </div>
  ${footer(pageNo[i])}
</section>`;
}

// Вторая страница проекта (поле extra): схема и два столбца «интеграции / инженерные решения»
function extraPage(p, i) {
  const x = p.extra;
  return `
<section class="page page--project page--extra">
  <div class="top"><span>Проект ${nn(i + 1)} / ${nn(total)} · продолжение</span><span>${esc(p.category)}</span></div>
  <h2 class="ptitle">${esc(x.title)}</h2>
  ${x.lead ? `<p class="ptag">${esc(x.lead)}</p>` : ''}
  ${x.diagram ? `<figure class="xdiag"><img src="../assets/shots/${esc(x.diagram)}" alt="${esc(x.diagramCaption || x.title)}"><figcaption>${esc(x.diagramCaption || '')}</figcaption></figure>` : ''}
  <div class="xcols">
    ${(x.blocks || []).map((b) => `<div class="xblock"><h3>${esc(b.title)}</h3>${b.rows.map((r) => `<div class="xrow"><b>${esc(r.name)}</b><span>${esc(r.text)}</span></div>`).join('')}</div>`).join('')}
  </div>
  ${footer(pageNo[i] + 1)}
</section>`;
}

function aboutPage() {
  const c = profile.contacts || {};
  const labels = { email: 'Почта', telegram: 'Telegram', phone: 'Телефон', github: 'GitHub', site: 'Сайт' };
  return `
<section class="page page--about">
  <div class="top"><span>Навыки и контакты</span><span>${esc(profile.name)}</span></div>
  <h2 class="ptitle">Технологии, с которыми я работаю</h2>
  <p class="ptag">Список собран из реальных проектов этого портфолио.</p>
  <div class="skills">
    ${(profile.skills || []).map((g) => `<div class="sk"><h3>${esc(g.name)}</h3><p>${g.items.map((x) => `<i>${esc(x)}</i>`).join('')}</p></div>`).join('')}
  </div>
  ${(profile.experience || []).length ? `<h3 class="h3b">Опыт</h3>${profile.experience.map((e) => `<div class="exp"><b>${esc(e.title)}</b>${e.confirm ? ' <span class="todo">подтвердить формулировку</span>' : ''}<p>${esc(e.text)}</p></div>`).join('')}` : ''}
  ${profile.aiTools?.show ? `<h3 class="h3b">Как я работаю</h3><p class="exp-p">${esc(profile.aiTools.text)}</p>` : ''}
  <h3 class="h3b">Контакты</h3>
  <dl class="contacts">${Object.keys(labels).map((k) => `<div><dt>${labels[k]}</dt><dd>${todo(c[k], 'добавить')}</dd></div>`).join('')}</dl>
  ${footer(aboutNo)}
</section>`;
}

const css = readFileSync(join(ROOT, 'tools', 'pdf.css'), 'utf-8');
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(profile.name)} — портфолио</title><style>${css}</style></head><body>
${cover()}
${projects.map((p, i) => projectPage(p, i) + (p.extra ? extraPage(p, i) : '')).join('\n')}
${aboutPage()}
</body></html>`;
const htmlPath = join(OUT, 'portfolio.html');
writeFileSync(htmlPath, html, 'utf-8');

// ---------- PDF ----------
const preview = process.argv.includes('--preview');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.goto(pathToFileURL(htmlPath).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => [...document.images].every((i) => i.complete));

// Страница не должна «вылезать»: сравниваем высоту содержимого с высотой листа
const overflow = await page.evaluate(() => [...document.querySelectorAll('.page')].map((el, i) => {
  // Низ содержимого (без подвала и абсолютных украшений) должен быть выше линии подвала
  const top0 = el.getBoundingClientRect().top;
  const foot = el.querySelector('.foot');
  const limit = foot ? foot.getBoundingClientRect().top - top0 : el.clientHeight;
  let content = 0;
  for (const c of el.children) {
    if (c.classList.contains('foot') || getComputedStyle(c).position === 'absolute') continue;
    content = Math.max(content, c.getBoundingClientRect().bottom - top0);
  }
  return { page: i + 1, content: Math.round(content), sheet: Math.round(limit) };
}));
for (const o of overflow) if (o.content > o.sheet + 1) console.log(`  ВНИМАНИЕ: страница ${o.page} не помещается (${o.content} > ${o.sheet} px)`);

if (preview) {
  const dir = join(OUT, 'preview'); mkdirSync(dir, { recursive: true });
  const els = await page.$$('.page');
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: join(dir, `page-${i + 1}.png`) });
}
const pdf = join(OUT, 'Andrey-Bateev-portfolio.pdf');
await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`Страниц: ${overflow.length}. PDF: ${pdf}`);
