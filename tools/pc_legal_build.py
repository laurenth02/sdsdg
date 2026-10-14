# Runs on the server (Windows): moves the restyled legal assets into _hoplite_scratch/legal_i18n, applies the same template
# changes to build.py that tools/legal_restyle.py made, builds into <here>/legal_build and checks the result byte-for-byte
# against this mirror (server/...). The redirect stubs under operator/ must stay identical to the live ones.
#   python tools/pc_legal_build.py            (from the sdsdg checkout)
import hashlib, os, shutil, subprocess, sys, time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(REPO)
L = r'D:\server-projects\_hoplite_scratch\legal_i18n'
LIVE = r'D:\server-projects\virtual.vibecods.xyz\PHP Engine (server)'
M = os.path.join(REPO, 'server')


def sha(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


EDITS = [
    (r"""# Builds the public legal pages into a docroot tree:   python build.py <docroot>
""", r"""# Builds the public legal pages into a docroot tree:   python build.py <docroot>
#   Design (2026-10-14): the «Свайп» design system in assets/legal.css; theme-color, Onest preload, back-to-the-site button, GDPR tab.
"""),
    (r"""def esc(s): return html.escape(s, quote=True)
""", r"""PRELOAD = ('<link rel="preload" href="/app/assets/fonts/onest-cyrillic.woff2" as="font" type="font/woff2" crossorigin>\n'
           '<link rel="preload" href="/app/assets/fonts/onest-latin.woff2" as="font" type="font/woff2" crossorigin>\n')
BACK = ('<a class="back" href="/" title="На сайт · На сайт · Back to the site" aria-label="На сайт · На сайт · Back to the site">'
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
        'aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></a>\n')
GDPR_TAB = '<a href="/privacy-gdpr/">GDPR</a>'

def esc(s): return html.escape(s, quote=True)
"""),
    (r"""        '<nav class="tabs" aria-label="%s">%s</nav>' % (esc(ui['docs']), tabs),""",
     r"""        '<nav class="tabs" aria-label="%s">%s%s</nav>' % (esc(ui['docs']), tabs, GDPR_TAB),"""),
    (r"""<meta name="color-scheme" content="light dark">\n',""", r"""<meta name="color-scheme" content="light dark">\n<meta name="theme-color" content="#F3F3F6">\n',"""),
    (r"""        '<link rel="stylesheet" href="/legal/legal.css?v=%s">""", r"""        PRELOAD + '<link rel="stylesheet" href="/legal/legal.css?v=%s">"""),
    (r"""        '<header class="top"><div class="top-in">\n<a class="brand" href="/">""", r"""        '<header class="top"><div class="top-in">\n', BACK, '<a class="brand" href="/">"""),
]

ts = time.strftime('%Y%m%d_%H%M%S')
bak = os.path.join(L, '_BACKUP_redesign_' + ts)
os.makedirs(bak)
for rel in ('build.py', 'assets/legal.css', 'assets/legal.js'):
    shutil.copy2(os.path.join(L, *rel.split('/')), os.path.join(bak, rel.replace('/', '_')))
print('backup:', bak)
for name in ('legal.css', 'legal.js'):
    shutil.copyfile(os.path.join(M, 'legal', name), os.path.join(L, 'assets', name))
with open(os.path.join(L, 'build.py'), encoding='utf-8') as f:
    src = f.read()
for old, new in EDITS:
    if new in src:
        continue
    if src.count(old) != 1:
        sys.exit('build.py: anchor not found once: ' + old[:70])
    src = src.replace(old, new)
with open(os.path.join(L, 'build.py'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(src)
out = os.path.join(HERE, 'legal_build')
shutil.rmtree(out, ignore_errors=True)
r = subprocess.run([sys.executable, os.path.join(L, 'build.py'), out], capture_output=True, text=True, encoding='utf-8')
print(r.stdout.strip(), r.stderr.strip())
bad = 0
for rel in ('legal/legal.css', 'legal/legal.js', 'terms/index.html', 'privacy/index.html', 'community-guidelines/index.html'):
    same = sha(os.path.join(out, *rel.split('/'))) == sha(os.path.join(M, *rel.split('/')))
    bad += not same
    print('SAME ' if same else 'DIFF ', rel)
for dp, dn, fn in os.walk(os.path.join(out, 'operator')):
    for f in fn:
        rel = os.path.relpath(os.path.join(dp, f), out)
        same = sha(os.path.join(dp, f)) == sha(os.path.join(LIVE, rel))
        bad += not same
        print('SAME ' if same else 'DIFF ', rel, '(stub vs live)')
print('RESULT', 'OK' if not bad else '%d differences' % bad)
