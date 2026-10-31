// Сайт-визитка: site/ → _site/ (статические HTML). Данные — те же, что у PDF: data/profile.json и data/projects/*.json.
// Картинки готовит tools/site-images.py (site/img + site/_data/images.json).
import fs from 'node:fs';

export default function (cfg) {
  cfg.addPassthroughCopy({
    'site/css': 'css',
    'site/js': 'js',
    'site/img': 'img',
    'site/favicon.svg': 'favicon.svg',
    'site/robots.txt': 'robots.txt',
    'site/og.png': 'og.png',
    'assets/fonts': 'fonts',
  });
  // PDF-резюме кладём на сайт, если оно собрано (npm run pdf)
  if (fs.existsSync('out/Andrey-Bateev-portfolio.pdf')) {
    cfg.addPassthroughCopy({ 'out/Andrey-Bateev-portfolio.pdf': 'files/Andrey-Bateev-portfolio.pdf' });
  }
  cfg.addWatchTarget('data/');
  cfg.addWatchTarget('site/css/');
  cfg.addWatchTarget('site/js/');

  // {% img "ключ", "alt", "sizes", "класс", "eager" %} — адаптивная картинка из site/_data/images.json
  cfg.addShortcode('img', (key, alt = '', sizes = '100vw', cls = '', loading = 'lazy') => {
    const images = JSON.parse(fs.readFileSync('site/_data/images.json', 'utf-8'));
    const files = images[key];
    if (!files) throw new Error(`Нет картинки «${key}» — запустите py tools/site-images.py`);
    const big = files[files.length - 1];
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const eager = loading === 'eager';
    return `<img src="${big.url}" srcset="${files.map((f) => `${f.url} ${f.w}w`).join(', ')}" sizes="${sizes}"`
      + ` width="${big.w}" height="${big.h}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ''}`
      + ` loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}>`;
  });

  cfg.addFilter('limit', (arr, n) => (arr || []).slice(0, n));

  return {
    dir: { input: 'site', output: '_site', includes: '_includes', data: '_data' },
    templateFormats: ['njk'],
    htmlTemplateEngine: 'njk',
  };
}
