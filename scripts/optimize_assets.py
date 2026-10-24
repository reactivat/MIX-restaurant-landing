"""Build responsive images and font subsets. Originals remain untouched."""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DEPS = ROOT / '.tools' / 'asset-deps'
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))

from PIL import Image, ImageOps
from fontTools import subset
from fontTools.ttLib import TTFont

DEST = ROOT / 'public' / 'assets' / 'optimized'
DEST.mkdir(parents=True, exist_ok=True)
manifest = {'images': {}, 'fonts': {}, 'icons': {}}


def write_asset(stem: str, data: bytes) -> str:
    name, extension = stem.rsplit('.', 1)
    digest = hashlib.sha256(data).hexdigest()[:10]
    target = DEST / f'{name}-{digest}.{extension}'
    target.write_bytes(data)
    return target.relative_to(ROOT).as_posix()


for source in sorted((ROOT / 'public' / 'assets' / 'mix').rglob('*.webp')):
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        widths = sorted({min(width, image.width) for width in (480, 800, 1200, 1600)})
        variants = []
        for width in widths:
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            resized.save(output, format='WEBP', quality=82, method=6)
            data = output.getvalue()
            variants.append({'width': width, 'height': height, 'bytes': len(data),
                'src': write_asset(f'{source.stem}-{width}.webp', data)})
        manifest['images'][source.relative_to(ROOT).as_posix()] = {
            'width': image.width, 'height': image.height, 'originalBytes': source.stat().st_size,
            'variants': variants}

# These are the original sprite's CSS crop windows, in source pixels.
crops = {'atmosphere': (26, 99, 298), 'bakery': (340, 136, 268),
    'ingredients': (642, 172, 226), 'coffee': (880, 108, 290), 'leaf': (1177, 166, 263),
    'phone': (364, 492, 203), 'pin': (623, 482, 213), 'clock': (890, 451, 270),
    'delivery': (1158, 473, 263), 'message': (1163, 767, 250)}
with Image.open(ROOT / 'public/assets/mix/decor/restaurant-icons.png') as sprite:
    for name, (x, y, size) in crops.items():
        icon = sprite.crop((x, y, x + size, y + size)).resize((192, 192), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        icon.save(output, format='WEBP', lossless=True, method=6, exact=True)
        data = output.getvalue()
        manifest['icons'][name] = {'src': write_asset(f'icon-{name}.webp', data), 'bytes': len(data)}

# Retain Latin, Cyrillic (including extended), punctuation, currency and arrows.
codepoints = set()
for first, last in ((0x0000, 0x024F), (0x0400, 0x052F), (0x1C80, 0x1C8F),
        (0x1E00, 0x1EFF), (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2116, 0x2116),
        (0x2190, 0x21FF), (0x2212, 0x2212), (0x2DE0, 0x2DFF), (0xA640, 0xA69F),
        (0xFEFF, 0xFEFF), (0xFFFD, 0xFFFD)):
    codepoints.update(range(first, last + 1))
for source in sorted((ROOT / 'public/fonts/Inter').glob('*.woff2')):
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.flavor = 'woff2'
    options.recalc_timestamp = False
    options.layout_features = ['*']
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    output = io.BytesIO()
    font.save(output)
    data = output.getvalue()
    manifest['fonts'][source.relative_to(ROOT).as_posix()] = {
        'src': write_asset(f'{source.stem}-latin-cyrillic.woff2', data),
        'originalBytes': source.stat().st_size, 'bytes': len(data)}
    font.close()

(DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'photos': len(manifest['images']),
    'originalPhotoBytes': sum(i['originalBytes'] for i in manifest['images'].values()),
    'photoBytesAt800': sum(next(v['bytes'] for v in i['variants'] if v['width'] == 800) for i in manifest['images'].values()),
    'originalFontBytes': sum(f['originalBytes'] for f in manifest['fonts'].values()),
    'subsetFontBytes': sum(f['bytes'] for f in manifest['fonts'].values()),
    'iconBytes': sum(i['bytes'] for i in manifest['icons'].values())}, indent=2))
