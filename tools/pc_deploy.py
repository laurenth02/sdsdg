# Runs on the server: copies files of this mirror (server/<rel>) into the live tree or the redesign worktree.
#   python tools/pc_deploy.py check|apply live|wt legal|app
# live = D:\server-projects\virtual.vibecods.xyz (production and QA containers bind-mount it, edits are live at once)
# wt   = D:\server-projects\virtual.vibecods.xyz-redesign (the redesign stand on 127.0.0.1:8098 mounts its app/)
# apply: backup of every replaced file into <project>\_BACKUP_redesign_finish_<ts>\, copy in the listed order (assets before
#        the pages and scripts that load them, the service worker last), then a SHA-256 check of every copied file.
# Files are copied with a fresh mtime on purpose: app/index.php versions the assets by filemtime (?v=).
import hashlib, os, shutil, sys, time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = {'live': r'D:\server-projects\virtual.vibecods.xyz', 'wt': r'D:\server-projects\virtual.vibecods.xyz-redesign'}
GROUPS = {
    'legal': ['legal/legal.css', 'legal/legal.js', 'terms/index.html', 'privacy/index.html', 'community-guidelines/index.html',
              'privacy-gdpr/index.html', 'terms-for-eu-residents/index.html', 'right-of-withdrawal-for-eu-residents/index.html'],
    'app': ['app/redesign.css', 'app/i18n-extra.js', 'app/boot.js', 'app/app.js', 'app/sw.js'],
}


def sha(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


mode, target, group = sys.argv[1:4]
proj = TARGETS[target]
root = os.path.join(proj, 'PHP Engine (server)')
changed = []
for rel in GROUPS[group]:
    src, dst = os.path.join(REPO, 'server', *rel.split('/')), os.path.join(root, *rel.split('/'))
    if not os.path.exists(src):
        sys.exit('missing in the mirror: ' + rel)
    if os.path.exists(dst) and sha(src) == sha(dst):
        print('same    ', rel)
        continue
    changed.append((rel, src, dst))
    print('changed ', rel, sha(dst)[:12] if os.path.exists(dst) else 'new', '->', sha(src)[:12])
if mode != 'apply' or not changed:
    print('RESULT', mode, target, group, len(changed), 'file(s) to copy')
    sys.exit(0)
bak = os.path.join(proj, '_BACKUP_redesign_finish_' + time.strftime('%Y%m%d_%H%M%S'))
for rel, src, dst in changed:
    if os.path.exists(dst):
        b = os.path.join(bak, *rel.split('/'))
        os.makedirs(os.path.dirname(b), exist_ok=True)
        shutil.copy2(dst, b)
print('backup:', bak)
bad = 0
for rel, src, dst in changed:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)
    ok = sha(src) == sha(dst)
    bad += not ok
    print('copied  ' if ok else 'MISMATCH', rel)
print('RESULT', 'OK' if not bad else 'FAILED', target, group, len(changed), 'file(s) copied')
