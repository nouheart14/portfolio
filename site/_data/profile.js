// Профиль из data/profile.json + вычисляемое: ключевые цифры (как на обложке PDF) и ссылки контактов.
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('../../data/', import.meta.url);
const plural = (n, one, few, many) =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;

export default function () {
  const p = JSON.parse(readFileSync(new URL('profile.json', ROOT), 'utf-8'));
  const dir = new URL('projects/', ROOT);
  const projects = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf-8')));
  const live = projects.filter((x) => x.statusKind === 'live').length;
  const c = p.contacts || {};
  return {
    ...p,
    // Боевой адрес сайта — для canonical, Open Graph и sitemap
    url: c.site ? `https://${c.site}` : '',
    numbers: [
      { value: String(projects.length), label: plural(projects.length, 'проект в портфолио', 'проекта в портфолио', 'проектов в портфолио') },
      { value: String(live), label: plural(live, 'проект в продакшене', 'проекта в продакшене', 'проектов в продакшене') },
      ...(p.keyNumbers || []),
    ],
    links: {
      email: c.email ? `mailto:${c.email}` : null,
      telegram: c.telegram ? `https://t.me/${c.telegram.replace(/^@/, '')}` : null,
      phone: c.phone ? `tel:+${c.phone.replace(/\D/g, '')}` : null,
      github: c.github || null,
    },
  };
}
