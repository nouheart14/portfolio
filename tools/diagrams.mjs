// Схемы для портфолио: каждый assets/diagrams/*.html → assets/shots/diagrams/<имя>.png (размер берётся из body).
// Запуск: node tools/diagrams.mjs
import { readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'diagrams');
const OUT = join(ROOT, 'assets', 'shots', 'diagrams');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
for (const f of readdirSync(SRC).filter((x) => x.endsWith('.html'))) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 500 } });
  await page.goto(pathToFileURL(join(SRC, f)).href);
  await page.evaluate(() => document.fonts.ready);
  const size = await page.evaluate(() => ({ w: document.body.offsetWidth, h: document.body.offsetHeight }));
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.screenshot({ path: join(OUT, `${basename(f, '.html')}.png`) });
  console.log(`  diagrams/${basename(f, '.html')}.png (${size.w}×${size.h})`);
  await page.close();
}
await browser.close();
