// Локальный просмотр сайта-визитки. Запускается из start-site.bat.
// 1) ставит зависимости при первом запуске, 2) готовит картинки (Python + Pillow), 3) собирает 11ty в _site/,
// 4) следит за правками в site/ и data/, 5) отдаёт _site/, открывает браузер, показывает ссылку для телефона.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, '_site');
const ELEVENTY = path.join(ROOT, 'node_modules', '@11ty', 'eleventy', 'cmd.cjs');
const START_PORT = Number(process.env.PORT) || 5180;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.ico': 'image/x-icon',
};

function ensureDeps() {
  if (fs.existsSync(ELEVENTY)) return;
  console.log('  Первый запуск: устанавливаю зависимости (npm install)…');
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) { console.error('  Не удалось установить зависимости.'); process.exit(1); }
}

function images() {
  const r = spawnSync('py', ['tools/site-images.py'], { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) console.error('  Картинки не обновлены (нужен Python с Pillow) — беру уже готовые.');
}

function buildOnce() {
  console.log('  Собираю сайт…');
  const r = spawnSync(process.execPath, [ELEVENTY, '--quiet'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { console.error('  Сборка не удалась — ошибка выше.'); process.exit(1); }
}

function watch() {
  const child = spawn(process.execPath, [ELEVENTY, '--watch', '--quiet'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let first = true;
  child.stdout.on('data', (b) => {
    if (/Wrote|Copied/.test(b.toString())) { if (!first) console.log(`  ${new Date().toLocaleTimeString('ru-RU')} — пересобрано`); first = false; }
  });
  child.stderr.on('data', (b) => process.stderr.write(b));
  process.on('exit', () => child.kill());
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(sig, () => process.exit(0));
}

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (urlPath.includes('\0')) { res.writeHead(400).end(); return; }
  const file0 = path.normalize(path.join(SITE, urlPath));
  if (file0 !== SITE && !file0.startsWith(SITE + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file0, (err, stat) => {
    const file = !err && stat.isDirectory() ? path.join(file0, 'index.html') : file0;
    fs.access(file, fs.constants.R_OK, (missing) => {
      if (!missing && TYPES[path.extname(file).toLowerCase()]) return send(res, 200, file);
      const nf = path.join(SITE, '404.html');
      if (fs.existsSync(nf)) return send(res, 404, nf);
      res.writeHead(404).end('404');
    });
  });
});

function lanAddress() {
  const virtual = /vEthernet|WSL|Hyper-V|VirtualBox|VMware|Docker|tun|tap|vpn|happ/i;
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (virtual.test(name)) continue;
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) found.push(a.address);
  }
  return found.find((ip) => ip.startsWith('192.168.')) || found.find((ip) => ip.startsWith('10.')) || found[0] || null;
}

function listen(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < START_PORT + 20) listen(port + 1);
    else { console.error('Не удалось запустить сервер:', err.message); process.exit(1); }
  });
  server.listen(port, '0.0.0.0', () => {
    const local = `http://localhost:${port}/`;
    const lan = lanAddress();
    console.log(`\n  Сайт-визитка запущен\n\n  На этом компьютере:   ${local}`);
    if (lan) console.log(`  С телефона (та же Wi-Fi сеть): http://${lan}:${port}/`);
    console.log('\n  Правки в site/ и data/ подхватываются сами — обновите страницу.\n  Остановить — закрыть окно или Ctrl+C.\n');
    if (!process.env.NO_OPEN) exec(`start "" "${local}"`);
  });
}

ensureDeps();
images();
buildOnce();
if (!process.env.NO_WATCH) watch();
listen(START_PORT);
