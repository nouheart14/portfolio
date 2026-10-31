"""Картинки для сайта: снимки и схемы проектов + фото владельца → WebP (640 и 1280 px по ширине, без увеличения).

Запуск из корня проекта:  py tools/site-images.py
Берёт список из data/projects/*.json (shots и extra.diagram) и data/profile.json (photo).
Результат: site/img/*.webp и site/_data/images.json (размеры для шаблонов). Готовые файлы не пересоздаются, если исходник не новее.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / 'assets' / 'shots'
OUT = ROOT / 'site' / 'img'
DATA = ROOT / 'site' / '_data' / 'images.json'
WIDTHS = [640, 1280]


def sources():
    items = {}
    for f in sorted((ROOT / 'data' / 'projects').glob('*.json')):
        p = json.loads(f.read_text(encoding='utf-8'))
        for s in p.get('shots', []):
            items[s['file']] = SHOTS / s['file']
        diagram = (p.get('extra') or {}).get('diagram')
        if diagram:
            items[diagram] = SHOTS / diagram
    photo = json.loads((ROOT / 'data' / 'profile.json').read_text(encoding='utf-8')).get('photo')
    if photo:
        items['me'] = ROOT / 'assets' / photo
    return items


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    OUT.mkdir(parents=True, exist_ok=True)
    data, made = {}, 0
    for key, src in sources().items():
        if not src.exists():
            print(f'  нет файла {src.relative_to(ROOT)} — пропускаю')
            continue
        stem = key.rsplit('.', 1)[0].replace('/', '__')
        with Image.open(src) as im0:
            im = ImageOps.exif_transpose(im0).convert('RGB')
        files = []
        for w in sorted({min(w, im.width) for w in WIDTHS}):
            h = round(w * im.height / im.width)
            out = OUT / f'{stem}-{w}.webp'
            if not out.exists() or out.stat().st_mtime < src.stat().st_mtime:
                im.resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=82, method=6)
                made += 1
            files.append({'w': w, 'h': h, 'url': f'/img/{out.name}'})
        data[key] = files
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'Картинки сайта: {len(data)} шт., пересоздано файлов: {made}')


main()
