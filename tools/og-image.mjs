// Картинка для превью ссылки (Open Graph, 1200×630): node tools/og-image.mjs → site/og.png
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const profile = JSON.parse(readFileSync(join(ROOT, 'data', 'profile.json'), 'utf-8'));
// Шрифт кладём в страницу base64: из about:blank локальные файлы браузер не грузит
const font = 'data:font/woff2;base64,' + readFileSync(join(ROOT, 'assets', 'fonts', 'manrope-cyrillic.woff2')).toString('base64');
const photo = 'data:image/jpeg;base64,' + readFileSync(join(ROOT, 'assets', 'me.jpg')).toString('base64');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:M;src:url(${font});font-weight:200 800}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#0b0d11;color:#f2f4f8;font-family:M,sans-serif;display:flex;align-items:center;padding:0 80px;gap:64px;position:relative;overflow:hidden}
body::before{content:"";position:absolute;right:-200px;top:-200px;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,#2f6bff55,transparent 70%)}
.t{flex:1;position:relative}
.k{font-size:24px;font-weight:600;color:#7fa6ff;margin-bottom:24px}
h1{font-size:84px;line-height:1.02;font-weight:800;margin-bottom:28px}
p{font-size:32px;line-height:1.3;color:#b9c0cc;max-width:640px}
.d{position:absolute;bottom:56px;left:80px;font-size:26px;color:#7fa6ff;font-weight:600}
img{width:340px;height:420px;object-fit:cover;border-radius:28px;position:relative}
</style>
<div class="t"><div class="k">Портфолио</div><h1>${profile.name}</h1><p>Веб-приложения, сайты, автоматизация бизнеса с помощью ИИ</p></div>
<img src="${photo}"><div class="d">${profile.contacts.site}</div>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(ROOT, 'site', 'og.png') });
await browser.close();
console.log('site/og.png готов');
