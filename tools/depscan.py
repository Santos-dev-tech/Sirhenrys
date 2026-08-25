# -*- coding: utf-8 -*-
"""Dependency scan.  python tools/depscan.py

Three questions, because "scan dependencies" usually only answers the first:

  1. Is anything we ship out of date?          -> version vs latest_known in deps.json
  2. Has anything we ship been MODIFIED?       -> sha256 vs deps.json
  3. Is anything in the build chain vulnerable? -> npm audit over tools/

Question 2 is the one a lockfile alone never answers. A vendored library is only
safer than a CDN if somebody notices when it changes, and nobody notices 600KB of
minified WebGL changing by eye.

Exit code 1 if a hash is wrong or a file is missing - that is a hard failure.
Being behind is reported and does not fail the run, because "upgrade three.js"
is a decision, not a build step.
"""
import hashlib
import io
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPS = os.path.join(ROOT, 'tools', 'deps.json')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    cfg = json.load(io.open(DEPS, encoding='utf-8'))
    libs = cfg['libraries']
    bad, stale, missing = [], [], []

    print('Dependency scan - %d vendored libraries, inventory checked %s\n'
          % (len(libs), cfg.get('checked', '?')))

    for lib in libs:
        p = os.path.join(ROOT, lib['file'].replace('/', os.sep))
        if not os.path.exists(p):
            missing.append(lib['file'])
            print('  MISSING  %-44s %s' % (lib['name'], lib['file']))
            continue
        got = sha256(p)
        ok = got == lib['sha256']
        behind = lib.get('latest_known') and lib['latest_known'] != lib['version']
        flag = 'MODIFIED' if not ok else ('behind' if behind else 'ok')
        if not ok:
            bad.append((lib['file'], lib['sha256'], got))
        elif behind:
            stale.append(lib)
        print('  %-9s %-34s %-8s %s' % (
            flag, lib['name'], lib['version'],
            ('-> %s available' % lib['latest_known']) if behind else ''))

    if bad:
        print('\nHASH MISMATCH - these files are not what the inventory says they are:')
        for f, want, got in bad:
            print('  %s\n    expected %s\n    got      %s' % (f, want, got))
        print('\n  Either somebody edited a vendored library, or the file was replaced.')
        print('  Both are worth finding out about before this ships.')

    if stale:
        print('\n%d librar%s behind the latest known version:' % (len(stale), 'y is' if len(stale) == 1 else 'ies are'))
        for lib in stale:
            print('  %-34s %-8s -> %s' % (lib['name'], lib['version'], lib['latest_known']))
            if lib.get('note'):
                print('      %s' % lib['note'])

    # ---- the build chain -----------------------------------------------------
    pkg = os.path.join(ROOT, 'tools', 'package.json')
    if os.path.exists(pkg):
        print('\nnpm audit over tools/ (build-time only - none of this is served):')
        try:
            out = subprocess.run(['npm', 'audit', '--json'], cwd=os.path.join(ROOT, 'tools'),
                                 capture_output=True, text=True, shell=True, timeout=180)
            data = json.loads(out.stdout or '{}')
            vulns = data.get('metadata', {}).get('vulnerabilities', {})
            total = sum(v for k, v in vulns.items() if k != 'total')
            if total == 0:
                print('  clean - 0 vulnerabilities')
            else:
                for k in ('critical', 'high', 'moderate', 'low', 'info'):
                    if vulns.get(k):
                        print('  %-9s %d' % (k, vulns[k]))
                print('  fix with: npm audit fix --prefix tools')
        except Exception as e:
            print('  could not run npm audit (%s)' % type(e).__name__)
            print('  run it by hand: npm audit --prefix tools')

    print('')
    if bad or missing:
        print('FAIL - %d modified, %d missing' % (len(bad), len(missing)))
        return 1
    print('PASS - every vendored file matches its recorded hash')
    if stale:
        print('       %d behind the latest version, listed above' % len(stale))
    return 0


if __name__ == '__main__':
    sys.exit(main())
