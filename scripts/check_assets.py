"""Check deployed image/font references, variants and preserved text metrics."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
if (ROOT / '.tools/asset-deps').exists():
    sys.path.insert(0, str(ROOT / '.tools/asset-deps'))
from PIL import Image
from fontTools.ttLib import TTFont

manifest = json.loads((ROOT / 'public/assets/optimized/manifest.json').read_text(encoding='utf-8'))
checked = set()


def exists(url, parent=ROOT):
    if url.startswith(('#', 'data:', 'http:', 'https:', 'mailto:', 'tel:')):
        return
    file = (parent / url.split('#')[0].split('?')[0]).resolve()
    assert file.is_file(), f'Missing local resource: {url}'
    if '?v=' in url:
        assert hashlib.sha256(file.read_bytes()).hexdigest()[:10] == url.split('?v=')[1], f'Stale cache version: {url}'
    checked.add(file)


class References(HTMLParser):
    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        assert len(attrs) == len(attributes), f'Duplicate attributes: {tag} {attributes}'
        for key in ('src', 'data-src', 'href'):
            if attrs.get(key):
                exists(attrs[key])
        for key in ('srcset', 'data-srcset'):
            for candidate in attrs.get(key, '').split(', '):
                if not candidate:
                    continue
                url, width = candidate.rsplit(' ', 1)
                exists(url)
                with Image.open(ROOT / url) as image:
                    assert image.width == int(width[:-1]), f'Wrong width descriptor: {candidate}'


text = ''
for html in ROOT.glob('*.html'):
    source = html.read_text(encoding='utf-8')
    References().feed(source)
    text += source
for css in (ROOT / 'css').glob('*.css'):
    for url in re.findall(r'url\([\'"]?([^\)\'"\s]+)', css.read_text(encoding='utf-8')):
        exists(url, css.parent)
for entry in manifest['images'].values():
    for variant in entry['variants']:
        file = ROOT / variant['src']
        assert file.stat().st_size == variant['bytes']
        with Image.open(file) as image:
            assert image.size == (variant['width'], variant['height'])
        assert variant['width'] <= entry['width'], f'Upscaled image: {file}'
        assert hashlib.sha256(file.read_bytes()).hexdigest()[:10] in file.stem
    medium = next(v for v in entry['variants'] if v['width'] == 800)
    assert medium['bytes'] < entry['originalBytes'], '800px variant did not reduce download size'

required = set(map(ord, text)) | set(range(0x20, 0x7F)) | set(range(0x410, 0x450)) | {0x401, 0x451, 0x20BD}
for original, entry in manifest['fonts'].items():
    with TTFont(ROOT / original) as old, TTFont(ROOT / entry['src']) as new:
        old_map, new_map = old.getBestCmap(), new.getBestCmap()
        for code in required & old_map.keys():
            assert code in new_map, f'Missing font character: U+{code:04X}'
            assert old['hmtx'].metrics[old_map[code]][0] == new['hmtx'].metrics[new_map[code]][0], 'Changed text metrics'
        assert entry['bytes'] < entry['originalBytes']

print(f'OK: {len(checked)} local resource references, {len(manifest["images"])} responsive photos, 4 fonts and their text metrics.')
