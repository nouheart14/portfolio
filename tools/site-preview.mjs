// Проверка сайта: node tools/site-preview.mjs → out/site-preview/*.png и отчёт в консоли.
// 1) нет горизонтальной прокрутки на всех размерах экрана; 2) снимки ключевых экранов; 3) кадр посреди перехода между проектами.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out', 'site-preview');
mkdirSync(OUT, { recursive: true });
const PORT = 5390;
const base = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = spawn(process.execPath, ['tools/site-server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), NO_OPEN: '1', NO_WATCH: '1' }, stdio: 'ignore', windowsHide: true });
let ok = false;
for (let i = 0; i < 80 && !ok; i++) { try { ok = (await fetch(base + '/')).ok; } catch { await wait(500); } }
if (!ok) { console.log('Сервер не поднялся'); srv.kill(); process.exit(1); }

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];

async function open(url, { w, h, scheme = 'light', mobile = false, reduced = true }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(`${url} ${w}px: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${url} ${w}px: ${m.text()}`); });
  await page.goto(base + url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Прокручиваем страницу, чтобы «ленивые» картинки и появление блоков отработали
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
    await Promise.race([Promise.all([...document.images].map((i) => (i.complete && i.naturalWidth ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))), new Promise((r) => setTimeout(r, 4000))]);
    window.scrollTo(0, 0);
  });
  await wait(reduced ? 100 : 1300);
  return { ctx, page };
}

// 1. Горизонтальная прокрутка
const sizes = [[320, 640, 1], [360, 760, 1], [375, 812, 1], [390, 844, 1], [414, 896, 1], [844, 390, 1], [768, 1024, 0], [1024, 768, 0], [1280, 800, 0], [1920, 1080, 0]];
const pages = ['/', '/projects/fpv62/', '/projects/tgbot-psymay/', '/projects/psymay/', '/projects/video-fpv/'];
let bad = 0;
for (const [w, h, m] of sizes) {
  for (const url of pages) {
    const { ctx, page } = await open(url, { w, h, mobile: !!m });
    const over = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1; }).slice(0, 3).map((el) => el.className || el.tagName);
      return { scroll: document.documentElement.scrollWidth - vw, wide };
    });
    if (over.scroll > 0 || over.wide.length) { bad++; console.log(`  ПЕРЕПОЛНЕНИЕ ${w}×${h} ${url}: +${over.scroll}px ${over.wide.join(', ')}`); }
    await ctx.close();
  }
}
console.log(`Размеров: ${sizes.length}, страниц: ${pages.length}, переполнений: ${bad}`);

// 2. Снимки (анимации включены — проверяем, что всё проявилось)
const shots = [
  { name: 'home-light', url: '/', w: 1440, h: 900, full: true, reduced: false },
  { name: 'home-dark', url: '/', w: 1440, h: 900, scheme: 'dark', full: false, reduced: false },
  { name: 'home-320', url: '/', w: 320, h: 640, mobile: true, full: true },
  { name: 'home-768', url: '/', w: 768, h: 1024, full: false },
  { name: 'home-1920', url: '/', w: 1920, h: 1080, full: false },
  { name: 'fpv62-375', url: '/projects/fpv62/', w: 375, h: 812, mobile: true, full: true, scheme: 'dark' },
];
for (const s of shots) {
  const { ctx, page } = await open(s.url, s);
  await page.screenshot({ path: join(OUT, `${s.name}.png`), fullPage: !!s.full });
  console.log(`  ${s.name}.png`);
  await ctx.close();
}

// 3. Переход «Следующий» посреди анимации
{
  const { ctx, page } = await open('/projects/fpv62/', { w: 1280, h: 800, reduced: false });
  const vt = await page.evaluate(() => 'onpagereveal' in window && CSS.supports('view-transition-name: a'));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(500);
  await page.click('a[data-dir="next"]');
  await wait(220);
  await page.screenshot({ path: join(OUT, 'vt-next-mid.png') });
  await page.waitForURL('**/projects/plan-sgx/');
  await wait(900);
  await page.screenshot({ path: join(OUT, 'vt-next-end.png') });
  console.log(`  переход между проектами: браузер поддерживает View Transitions — ${vt ? 'да' : 'нет'}`);
  await ctx.close();
}

await browser.close();
spawn('taskkill', ['/PID', String(srv.pid), '/T', '/F'], { stdio: 'ignore' });
console.log(errors.length ? `ОШИБКИ В КОНСОЛИ (${errors.length}):\n  ${[...new Set(errors)].slice(0, 10).join('\n  ')}` : 'Ошибок в консоли нет');
