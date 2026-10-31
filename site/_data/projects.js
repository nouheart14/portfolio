// Проекты из data/projects/*.json, по полю order. Добавить проект = добавить файл туда же (PDF и сайт обновятся оба).
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../../data/projects/', import.meta.url);
const STATUS = { live: 'в продакшене', dev: 'в работе', done: 'сдан', archive: 'архив' };

export default function () {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf-8')))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map((p, i) => ({
      ...p,
      n: String(i + 1).padStart(2, '0'),
      statusText: STATUS[p.statusKind] || 'в работе',
      tags: (p.stack || []).flatMap((g) => g.items),
      cover: (p.shots || [])[0] || null,
    }));
}
