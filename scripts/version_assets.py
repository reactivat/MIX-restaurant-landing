"""Version CSS/JS URLs so cached old scripts cannot break new image markup."""
import hashlib
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def version(url):
    path = url.split('?')[0]
    digest = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:10]
    return f'{path}?v={digest}'


main = ROOT / 'js/main.js'
source = main.read_text(encoding='utf-8')
source = re.sub(r"js/(?:photo-window|favorites)\.js(?:\?v=[a-f0-9]+)?", lambda m: version(m[0]), source)
main.write_text(source, encoding='utf-8')
for html in ROOT.glob('*.html'):
    source = html.read_text(encoding='utf-8')
    source = re.sub(r'(?<=["\'])(?:css|js)/[^"\'<>?]+\.(?:css|js)(?:\?v=[a-f0-9]+)?',
        lambda m: version(m[0]), source)
    html.write_text(source, encoding='utf-8')
print('Updated CSS/JS cache versions.')
