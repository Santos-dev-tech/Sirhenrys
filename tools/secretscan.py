# -*- coding: utf-8 -*-
"""Secret scan.  python tools/secretscan.py [--history]

Answers two of the three questions people mean by "hide your API keys":

  * is there a real secret in the working tree?
  * is there a real secret anywhere in the git history?  (--history)

The third - "is the Firebase apiKey a secret?" - has an answer, and it is no. A
Firebase web apiKey identifies the project to Google and authorises nothing. It
is meant to be readable in page source; every Firebase site on the internet
ships one. Rotating it is not a security measure. firestore.rules is the
security measure. So this scanner knows about that key and does not cry wolf
over it, because a scanner that reports something harmless every run is a
scanner nobody reads.

What it does report is the material that actually ends a company's week: a
service-account private key, an OAuth client secret, an M-Pesa consumer secret,
an AWS key pair, a bearer token, a .env that got committed.

Exit code 1 on any finding.
"""
import io
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.firebase', 'assets/img',
             'assets/seq', 'assets/spin', 'assets/video', '_shots'}
SKIP_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.mp4', '.woff2', '.ico', '.pptx',
            '.pdf', '.zip', '.pyc'}

# Each rule is (name, regex, why it matters).
RULES = [
    ('private key block', re.compile(r'-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----'),
     'A private key in a repo is game over for whatever it signs.'),
    ('google service account', re.compile(r'"type"\s*:\s*"service_account"'),
     'Admin SDK credentials. Full read and write on Firestore, bypassing every rule.'),
    ('gcp oauth client secret', re.compile(r'GOCSPX-[A-Za-z0-9_\-]{20,}'),
     'Lets somebody impersonate this app in an OAuth flow.'),
    ('aws access key', re.compile(r'\b(AKIA|ASIA)[0-9A-Z]{16}\b'),
     'Half of an AWS key pair; the other half is usually three lines below.'),
    ('aws secret key', re.compile(r'aws_secret_access_key\s*=\s*\S{30,}', re.I),
     'The other half.'),
    ('slack token', re.compile(r'xox[abprs]-[A-Za-z0-9\-]{10,}'), 'Reads a workspace.'),
    ('github token', re.compile(r'\bgh[pousr]_[A-Za-z0-9]{30,}\b'), 'Pushes to this repo.'),
    ('stripe secret', re.compile(r'\bsk_(live|test)_[A-Za-z0-9]{20,}\b'), 'Moves money.'),
    ('bearer token', re.compile(r'[Aa]uthorization["\']?\s*[:=]\s*["\']Bearer\s+[A-Za-z0-9._\-]{20,}'),
     'A live session for something.'),
    # M-Pesa is the one that would actually hurt this shop
    ('mpesa consumer secret', re.compile(r'(consumer_?secret|CONSUMER_SECRET)["\']?\s*[:=]\s*["\'][A-Za-z0-9]{16,}'),
     'Daraja credentials. Somebody else pushes STK prompts to your customers.'),
    ('mpesa passkey', re.compile(r'(pass_?key|PASSKEY)["\']?\s*[:=]\s*["\'][A-Za-z0-9]{40,}'),
     'Signs STK Push requests as this till.'),
    ('generic api secret', re.compile(r'(api[_-]?secret|client[_-]?secret|private[_-]?key)'
                                      r'["\']?\s*[:=]\s*["\'][A-Za-z0-9/+=_\-]{24,}["\']', re.I),
     'Named like a secret and shaped like one.'),
]

# Not credentials. A personal address in a repo that is on GitHub is a phishing and
# credential-stuffing target and is worth removing - but it does not need rotating
# at four in the morning, and reporting it as a failure alongside a service-account
# key puts this gate permanently red. Reported loudly; does not fail the run.
PRIVACY_RULES = [
    ('personal email address',
     re.compile(r'[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo|icloud|protonmail|proton)\.[a-z]{2,}', re.I),
     'A personal inbox. Use a role address, or leave it out and ask.'),
]

# Things that look alarming and are not. Each one is here with a reason.
ALLOW = [
    (re.compile(r'AIzaSy[A-Za-z0-9_\-]{33}'),
     'Firebase web apiKey - public by design, see assets/js/firebase-config.js'),
    (re.compile(r'6L[A-Za-z0-9_\-]{38}'),
     'reCAPTCHA site key - public by design, bound to registered domains'),
    (re.compile(r'consumer_?secret.{0,40}(YOUR|REPLACE|xxxx|\.\.\.)', re.I),
     'placeholder in the M-Pesa go-live notes'),
    (re.compile(r'@(sirhenrys\.co\.ke|example\.(com|org)|test\.com)', re.I),
     "the shop's own addresses and test fixtures - meant to be findable"),
]


def allowed(line):
    return any(rx.search(line) for rx, _ in ALLOW)


def files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT).replace('\\', '/')
        dirnames[:] = [d for d in dirnames
                       if d not in SKIP_DIRS and (rel + '/' + d).lstrip('./') not in SKIP_DIRS]
        if any(rel == s or rel.startswith(s + '/') for s in SKIP_DIRS):
            continue
        for n in filenames:
            if os.path.splitext(n)[1].lower() in SKIP_EXT:
                continue
            p = os.path.join(dirpath, n)
            if os.path.getsize(p) > 4 * 1024 * 1024:
                continue
            yield p


def scan_tree(rules=None):
    rules = rules or RULES
    hits = []
    for p in files():
        try:
            text = io.open(p, encoding='utf-8', errors='ignore').read()
        except Exception:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if len(line) > 2000 or allowed(line):
                continue
            for name, rx, why in rules:
                if rx.search(line):
                    hits.append((os.path.relpath(p, ROOT), i, name, why, line.strip()[:110]))
    return hits


def scan_history(rules=None):
    """Every blob that ever existed, not just the current tip. A secret removed in
    a later commit is still one `git log -p` away from anybody with the repo."""
    rules = rules or RULES
    hits = []
    try:
        out = subprocess.check_output(['git', 'log', '--all', '-p', '--no-color',
                                       '--diff-filter=AM', '-U0'],
                                      cwd=ROOT, stderr=subprocess.DEVNULL,
                                      errors='ignore')
    except Exception as e:
        return [('(git)', 0, 'unreadable', str(e), '')]

    # Somebody else's contributor list is not our leak. A vendored library's CHANGELOG
    # carries dozens of maintainer addresses; reporting those buries the two that
    # actually matter, and a scanner nobody reads is a scanner that stops working.
    THIRD_PARTY = ('node_modules/', '/vendor/', 'assets/js/vendor/', 'package-lock.json')

    commit, path = '', ''
    for line in out.splitlines():
        if line.startswith('commit '):
            commit = line.split()[1][:8]
        elif line.startswith('+++ b/'):
            path = line[6:]
        elif line.startswith('+') and not line.startswith('+++'):
            if any(t in path for t in THIRD_PARTY):
                continue
            body = line[1:]
            if len(body) > 2000 or allowed(body):
                continue
            for name, rx, why in rules:
                if rx.search(body):
                    hits.append((path, commit, name, why, body.strip()[:110]))
    return hits


def main():
    do_history = '--history' in sys.argv
    print('Secret scan - working tree%s\n' % (' and full git history' if do_history else ''))

    hits = scan_tree()
    if hits:
        print('WORKING TREE - %d finding%s:' % (len(hits), '' if len(hits) == 1 else 's'))
        for path, ln, name, why, snippet in hits:
            print('  %s:%d  [%s]' % (path, ln, name))
            print('      %s' % why)
            print('      %s' % snippet)
    else:
        print('Working tree: clean.')

    hhits = []
    if do_history:
        hhits = scan_history()
        if hhits:
            print('\nGIT HISTORY - %d finding%s:' % (len(hhits), '' if len(hhits) == 1 else 's'))
            for path, commit, name, why, snippet in hhits:
                print('  %s @ %s  [%s]' % (path, commit, name))
                print('      %s' % why)
                print('      %s' % snippet)
            print('\n  A secret in history is still live. Rotate it FIRST - rewriting')
            print('  history does not un-clone the repo. Then purge with git filter-repo')
            print('  and force push, and tell anyone holding a fork.')
        else:
            print('Git history: clean.')

    print('\nPublic by design, deliberately not reported:')
    for rx, why in ALLOW:
        print('  - %s' % why)

    # ---- privacy, reported separately and never fatal ----
    priv = scan_tree(PRIVACY_RULES)
    priv_hist = scan_history(PRIVACY_RULES) if do_history else []
    if priv or priv_hist:
        print('\nPRIVACY - not credentials, and not fatal, but worth removing:')
        for path, ln, name, why, snippet in priv:
            print('  %s:%s  [%s]  %s' % (path, ln, name, snippet))
        for path, commit, name, why, snippet in priv_hist:
            print('  %s @ %s  [%s]  %s' % (path, commit, name, snippet))
        if priv_hist and not priv:
            print('\n  These are only in HISTORY - the working tree is clean. Removing them')
            print('  means rewriting history and force-pushing, which breaks every existing')
            print('  clone. That is a decision, not a chore; it is not done automatically.')

    total = len(hits) + len(hhits)
    print('')
    if total:
        print('FAIL - %d credential finding%s' % (total, '' if total == 1 else 's'))
        return 1
    print('PASS - no credential material found'
          + (' (%d privacy note%s above)' % (len(priv) + len(priv_hist),
             '' if len(priv) + len(priv_hist) == 1 else 's') if (priv or priv_hist) else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
