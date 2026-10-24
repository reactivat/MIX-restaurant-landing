"""Refresh HTML/CSS references after optimize_assets.py (safe to run again)."""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
assets = json.loads((ROOT / 'public/assets/optimized/manifest.json').read_text(encoding='utf-8'))


def image_for_url(url):
    for original, image in assets['images'].items():
        stem = Path(original).stem
        if url == original or re.fullmatch(re.escape(stem) + r'-\d+-[a-f0-9]+\.webp', Path(url).name):
            return original, image
    raise ValueError(f'Unknown image: {url}')


def srcset(image):
    return ', '.join(f"{v['src']} {v['width']}w" for v in image['variants'])


def fallback(image, width=800):
    return next((v['src'] for v in image['variants'] if v['width'] >= width), image['variants'][-1]['src'])


def attribute(tag, key, value):
    pattern = rf'(?<![\w-]){re.escape(key)}="[^"]*"'
    if re.search(pattern, tag):
        return re.sub(pattern, f'{key}="{value}"', tag)
    return tag[:-1].rstrip() + f' {key}="{value}">'


def hero_sizes(original):
    if 'pasta' in original:
        return '(max-width: 600px) min(232vw, 1102px), (max-width: 800px) max(60vw, 747px), max(min(60vw, 888px), 996px)'
    return '(max-width: 600px) min(174vw, 827px), (max-width: 800px) max(60vw, 560px), max(min(60vw, 888px), 747px)'


def update_image(match):
    tag = match[0]
    source = re.search(r'(?<![\w-])(?:data-)?src="([^"]+\.webp)"', tag)
    if not source:
        if any(name in tag for name in ('footer__social-icon', 'contact__map-icon', 'footer__logo')):
            tag = attribute(tag, 'loading', 'lazy')
            tag = attribute(tag, 'decoding', 'async')
        return tag
    original, image = image_for_url(source[1])
    hidden_slide = 'hero__image' in tag and 'fetchpriority="high"' not in tag
    source_key = 'data-src' if hidden_slide else 'src'
    set_key = 'data-srcset' if hidden_slide else 'srcset'
    if hidden_slide:
        tag = re.sub(r'(?<![\w-])(?:src|srcset)="[^"]*"\s*', '', tag)
    tag = attribute(tag, source_key, fallback(image))
    tag = attribute(tag, set_key, srcset(image))
    if hidden_slide:
        tag = attribute(tag, 'src', 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=')
    if 'hero__image' in tag:
        sizes = hero_sizes(original)
    elif 'advantages__photo' in tag:
        sizes = '(max-width: 600px) 87vw, (max-width: 1160px) 46vw, max(23vw, 300px)'
    elif 'dish__image' in tag:
        sizes = '(max-width: 699px) 87vw, (max-width: 1100px) 40vw, 29vw'
    elif 'about__image' in tag:
        sizes = '(max-width: 600px) max(100vw, 462px), max(50vw, 711px)'
    else:
        sizes = '(max-width: 600px) 100vw, 50vw'
    tag = attribute(tag, 'sizes', sizes)
    tag = attribute(tag, 'width', str(image['width']))
    tag = attribute(tag, 'height', str(image['height']))
    tag = attribute(tag, 'decoding', 'async')
    tag = attribute(tag, 'fetchpriority', 'high' if 'fetchpriority="high"' in tag else 'low')
    if 'fetchpriority="high"' in tag:
        tag = attribute(tag, 'loading', 'eager')
    return tag


html = (ROOT / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<img\b[^>]*>', update_image, html)


def update_picture(match):
    picture = match[0]
    hidden = 'data-src=' in picture
    def update_source(source):
        tag = source[0]
        value = re.search(r'(?<![\w-])(?:data-)?srcset="([^" ,]+)', tag)[1]
        original, image = image_for_url(value)
        tag = re.sub(r'(?<![\w-])(?:srcset|data-srcset|sizes)="[^"]*"\s*', '', tag)
        tag = re.sub(r'\s+', ' ', tag)
        tag = attribute(tag, 'data-srcset' if hidden else 'srcset', srcset(image))
        return attribute(tag, 'sizes', hero_sizes(original))
    return re.sub(r'<source\b[^>]*>', update_source, picture)


html = re.sub(r'<picture\b[^>]*>[\s\S]*?</picture>', update_picture, html)
for original, font in assets['fonts'].items():
    pattern = r'public/(?:fonts/Inter|assets/optimized)/' + re.escape(Path(original).stem) + r'(?:-latin-cyrillic-[a-f0-9]+)?\.woff2'
    html = re.sub(pattern, font['src'], html)
(ROOT / 'index.html').write_text(html, encoding='utf-8')

css = (ROOT / 'css/style.css').read_text(encoding='utf-8')
for original, font in assets['fonts'].items():
    pattern = r'\.\./public/(?:fonts/Inter|assets/optimized)/' + re.escape(Path(original).stem) + r'(?:-latin-cyrillic-[a-f0-9]+)?\.woff2'
    css = re.sub(pattern, '../' + font['src'], css)
bar = assets['images']['public/assets/mix/interior/bar-detail.webp']
bar_pattern = r'url\([^)]*(?:bar-detail(?:-\d+-[a-f0-9]+)?\.webp)\)'
css = re.sub(bar_pattern, 'url(../' + fallback(bar, 1200) + ')', css)
# Use a smaller background on mobile at 1x; dense displays keep the larger variant.
start, end = '/* Responsive photo background: generated. */', '/* End responsive photo background. */'
css = re.sub(re.escape(start) + r'[\s\S]*?' + re.escape(end) + r'\n?', '', css)
css = css.rstrip() + '\n'
css += f'''\n{start}
@media (max-width: 800px) and (max-resolution: 1.49dppx) {{
    .photo-window--loaded,
    html:not(.js) .photo-window {{ --photo-window-image: url(../{fallback(bar, 800)}); }}
}}
@media (min-resolution: 1.5dppx) {{
    .photo-window--loaded,
    html:not(.js) .photo-window {{ --photo-window-image: url(../{bar['variants'][-1]['src']}); }}
}}
{end}
'''
(ROOT / 'css/style.css').write_text(css, encoding='utf-8')

icons_css = '/* Cropped from the original sprite; 192px assets retain sharpness up to 3x. */\n'
icons_css += '.restaurant-icon { display: inline-block; flex-shrink: 0; width: 64px; height: 64px; background: center / contain no-repeat; }\n'
for name, icon in assets['icons'].items():
    icons_css += f".restaurant-icon--{name} {{ background-image: url(../{icon['src']}); }}\n"
(ROOT / 'css/restaurant-icons.css').write_text(icons_css, encoding='utf-8')
print('Updated responsive HTML, font URLs, background variants and icon CSS.')
