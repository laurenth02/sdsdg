# Restyles the public legal pages for the «Свайп» design (server/legal/legal.css + legal.js).
#   python tools/legal_restyle.py <docroot>
# 1) /terms/, /privacy/, /community-guidelines/ (output of _hoplite_scratch/legal_i18n/build.py): the same template changes
#    that build.py now makes — theme-color, Onest preload, a back-to-the-site button, a GDPR tab, new asset versions.
#    The result must be byte-identical to a fresh build.py run (checked on the server by hash).
# 2) The EU documents (hand-written pages with inline styles) move to the shared markup and stylesheet. Idempotent.
import hashlib, html, os, re, sys

ROOT = sys.argv[1]
BUILT = ['terms', 'privacy', 'community-guidelines']
EU = {'privacy-gdpr': 'GDPR Privacy Notice', 'terms-for-eu-residents': 'T&C for EU Residents',
      'right-of-withdrawal-for-eu-residents': 'Right of Withdrawal'}
BACK_ICON = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
             'aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>')
BACK = '<a class="back" href="/" title="На сайт · На сайт · Back to the site" aria-label="На сайт · На сайт · Back to the site">%s</a>\n' % BACK_ICON
PRELOAD = ('<link rel="preload" href="/app/assets/fonts/onest-cyrillic.woff2" as="font" type="font/woff2" crossorigin>\n'
           '<link rel="preload" href="/app/assets/fonts/onest-latin.woff2" as="font" type="font/woff2" crossorigin>\n')
THEME = '<meta name="theme-color" content="#F3F3F6">\n'
GDPR_TAB = '<a href="/privacy-gdpr/">GDPR</a>'


def rd(rel):
    with open(os.path.join(ROOT, *rel.split('/')), encoding='utf-8') as f:
        return f.read()


def wr(rel, data):
    with open(os.path.join(ROOT, *rel.split('/')), 'w', encoding='utf-8', newline='\n') as f:
        f.write(data)


def must(cond, msg):
    if not cond:
        sys.exit('legal_restyle: ' + msg)


V = {k: hashlib.md5(rd('legal/legal.' + k).encode('utf-8')).hexdigest()[:10] for k in ('css', 'js')}
ASSETS = '<link rel="stylesheet" href="/legal/legal.css?v=%s">\n<script src="/legal/legal.js?v=%s"></script>\n' % (V['css'], V['js'])

# 1) pages built by build.py
for folder in BUILT:
    rel = folder + '/index.html'
    t = rd(rel)
    if THEME not in t:
        t = t.replace('<meta name="color-scheme" content="light dark">\n', '<meta name="color-scheme" content="light dark">\n' + THEME, 1)
    if PRELOAD not in t:
        t = t.replace('<link rel="stylesheet" href="/legal/legal.css', PRELOAD + '<link rel="stylesheet" href="/legal/legal.css', 1)
    t, n = re.subn(r'<link rel="stylesheet" href="/legal/legal\.css\?v=[0-9a-f]+">\n<script src="/legal/legal\.js\?v=[0-9a-f]+"></script>\n', ASSETS, t)
    must(n == 1, rel + ': asset links')
    if BACK not in t:
        t = t.replace('<header class="top"><div class="top-in">\n<a class="brand"', '<header class="top"><div class="top-in">\n' + BACK + '<a class="brand"', 1)
    t = re.sub(r'(<nav class="tabs" aria-label="[^"]*">(?:(?!</nav>).)*?)(</nav>)', lambda m: m.group(1) + ('' if GDPR_TAB in m.group(1) else GDPR_TAB) + m.group(2), t)
    must(t.count(THEME) == 1 and t.count(PRELOAD) == 1 and t.count(BACK) == 1 and t.count(GDPR_TAB) == 3, rel + ': template markers')
    wr(rel, t)
    print('built page restyled: /%s/' % folder)


# 2) EU documents
ACRONYMS = {'gdpr', 'eu', 'eea', 'uk', 'us', 'usa', 'dpo', 'id', 'ip', 'it', 'sms'}


def sentence_case(s):
    letters = re.sub(r'[^A-Za-z]', '', s)
    if not letters or letters != letters.upper():
        return s
    words = [w.upper() if re.sub(r'[^a-z]', '', w) in ACRONYMS else w for w in s.lower().split(' ')]
    out = ' '.join(words)
    m = re.search(r'[a-z]', out)
    return out[:m.start()] + out[m.start()].upper() + out[m.start() + 1:] if m else out


def text_of(fragment):
    return html.unescape(re.sub(r'<[^>]+>', '', fragment)).strip()


TABS_EN = [('/terms/?lang=en', 'Terms'), ('/privacy/?lang=en', 'Privacy'), ('/community-guidelines/?lang=en', 'Community rules'), ('/privacy-gdpr/', 'GDPR')]
FOOT_EN = [('/terms/?lang=en', 'User Agreement'), ('/privacy/?lang=en', 'Privacy Policy'), ('/community-guidelines/?lang=en', 'Community Rules'),
           ('/terms-for-eu-residents/', 'T&amp;C for EU Residents'), ('/right-of-withdrawal-for-eu-residents/', 'Right of Withdrawal'),
           ('/privacy-gdpr/', 'GDPR Privacy Notice')]

for folder, short in EU.items():
    rel = folder + '/index.html'
    t = rd(rel)
    if 'class="legal-doc single"' in t:
        t, n = re.subn(r'<link rel="stylesheet" href="/legal/legal\.css\?v=[0-9a-f]+">\n<script src="/legal/legal\.js\?v=[0-9a-f]+"></script>\n', ASSETS, t)
        must(n == 1, rel + ': asset links')
        wr(rel, t)
        print('EU page already restyled, asset versions refreshed: /%s/' % folder)
        continue
    head = re.search(r'^(.*?)<style>.*?</style>\n</head>', t, re.S)
    must(head, rel + ': head')
    meta = head.group(1)
    must('<meta name="color-scheme" content="light dark">\n' in meta, rel + ': color-scheme meta')
    meta = meta.replace('<meta name="color-scheme" content="light dark">\n', '<meta name="color-scheme" content="light dark">\n' + THEME, 1)
    meta += ('<link rel="canonical" href="https://otkrovenno.online/%s/">\n' % folder
             + '<link rel="icon" type="image/png" href="/app/icons/favicon-64.png">\n<link rel="apple-touch-icon" href="/app/icons/apple-touch-icon.png">\n'
             + PRELOAD + ASSETS)
    art = re.search(r'<article>\s*(.*?)\s*</article>', t, re.S)
    must(art, rel + ': article')
    body = art.group(1)
    h1 = re.match(r'<h1>(.*?)</h1>\s*', body, re.S)
    must(h1, rel + ': h1')
    body = body[h1.end():]
    sub = re.match(r'<p class="sub">(.*?)</p>\s*', body, re.S)
    if sub:
        body = body[sub.end():]
    op = re.search(r'<p class="legal">(.*?)</p>', t, re.S)
    must(op, rel + ': operator line')
    toc, n = [], [0]

    def h2(m):
        attrs, inner = m.group(1), m.group(2)
        n[0] += 1
        hid = re.search(r'id="([^"]+)"', attrs)
        hid = hid.group(1) if hid else 'sec-%d' % n[0]
        inner = sentence_case(inner) if '<' not in inner else inner
        label = text_of(inner)
        if re.search(r'[A-Za-z]', label):  # number-only headings (sections 5 and 6 of the EU terms) stay out of the contents
            toc.append((hid, label))
        return '<h2 id="%s">%s</h2>' % (hid, inner)

    body = re.sub(r'<h2([^>]*)>(.*?)</h2>', h2, body, flags=re.S)
    tabs = ''.join('<a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == '/' + folder + '/' else '', l) for h, l in TABS_EN)
    foot = ''.join('<a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == '/' + folder + '/' else '', l) for h, l in FOOT_EN)
    layout = ('<div class="layout">\n<details class="toc" open><summary>Contents</summary><ol>%s</ol></details>\n' % ''.join(
        '<li><a href="#%s">%s</a></li>' % (hid, html.escape(lbl, quote=False)) for hid, lbl in toc)) if len(toc) >= 3 else '<div class="layout solo">\n'
    page = ''.join([
        meta, '</head>\n<body>\n',
        '<header class="top"><div class="top-in">\n', BACK, '<a class="brand" href="/">otkrovenno<span>.online</span></a>\n</div></header>\n',
        '<main class="wrap">\n<article class="legal-doc single" lang="en">\n<header class="hero">\n',
        '<nav class="tabs" aria-label="Documents">%s</nav>\n' % tabs,
        '<h1>%s</h1>\n' % h1.group(1).strip(),
        ('<p class="sub">%s</p>\n' % sub.group(1).strip()) if sub else '',
        '</header>\n', layout,
        '<div class="card doc-body">\n', body.strip(), '\n</div>\n</div>\n',
        '<footer class="foot">\n<nav aria-label="Documents">%s<a href="mailto:info@otkrovenno.online">info@otkrovenno.online</a></nav>\n' % foot,
        '<p class="op">%s</p>\n<p>© 2026 otkrovenno.online · 18+</p>\n</footer>\n' % op.group(1).strip(),
        '</article>\n</main>\n</body>\n</html>\n'])
    must('<style>' not in page and page.count('<h1>') == 1, rel + ': output shape')
    wr(rel, page)
    print('EU page restyled: /%s/  contents %d' % (folder, len(toc)))
print('legal.css v=%s  legal.js v=%s' % (V['css'], V['js']))
