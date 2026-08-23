"""Inline the whole storefront into a single portable .html file.

CSS, JS and every image become inline text / data: URIs, so the result opens from a
USB stick, an email attachment, or a phone with no server and no network.

Usage:  python tools/bundle.py [index|admin]
Output: ../SirHenrys-<name>-standalone.html
"""
import base64, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))

MIME = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.svg': 'image/svg+xml', '.webp': 'image/webp'}
VIDEO_MIME = {'.mp4': 'video/mp4', '.webm': 'video/webm'}


# The project keeps full-resolution plates (1536px) for real deployment. Inlining those
# as base64 would make the portable single file ~30 MB, so images are re-encoded smaller
# for the bundle ONLY. Nothing on disk is touched.
# A 12 MB single file is valid HTML but too large for many previewers to open at all.
# LEAN=1 produces a light copy for emailing/previewing; the default stays high quality.
LEAN = os.environ.get('LEAN') == '1'
BUNDLE_MAX_W = 720 if LEAN else 900
JPEG_Q = 72 if LEAN else 80
SEQ_STRIDE = 2 if LEAN else 1        # LEAN keeps every 2nd dressing frame
_cv2 = None
def _shrink(path):
    global _cv2
    if _cv2 is None:
        try:
            import cv2 as c; _cv2 = c
        except ImportError:
            _cv2 = False
    if not _cv2:
        return None
    im = _cv2.imread(path)
    if im is None:
        return None
    h, w = im.shape[:2]
    if w <= BUNDLE_MAX_W:
        return None                      # already small enough, use the file as-is
    tw = BUNDLE_MAX_W
    im = _cv2.resize(im, (tw, int(h * tw / w)), interpolation=_cv2.INTER_AREA)
    ok, buf = _cv2.imencode('.jpg', im, [_cv2.IMWRITE_JPEG_QUALITY, JPEG_Q])
    return buf.tobytes() if ok else None


def data_uri(path):
    ext = os.path.splitext(path)[1].lower()
    mime = MIME.get(ext) or VIDEO_MIME.get(ext) or 'application/octet-stream'
    raw = None
    if ext in ('.jpg', '.jpeg'):
        raw = _shrink(path)
    if raw is None:
        with open(path, 'rb') as f:
            raw = f.read()
    return 'data:%s;base64,%s' % (mime, base64.b64encode(raw).decode('ascii'))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def main():
    # There is one app now: index.html carries the storefront and the staff console,
    # and admin.html is only a redirect into it. The old 'admin' target is gone.
    if len(sys.argv) > 1 and sys.argv[1].replace('.html', '') == 'admin':
        print('There is no separate admin bundle any more - the console is a route at '
              '#/admin inside the single file. Run: python tools/bundle.py')
        return
    html = read('index.html')

    # 0. Firebase comes out of the portable build, and it has to come out HERE - before
    # step 2 inlines every <script src>, or the SDK is already embedded and removing the
    # tag achieves nothing. A file:// page has no authorised origin, so the SDK could
    # only ever fail; sync.js is built to degrade, which is what switching it off does,
    # minus half a megabyte that cannot run.
    html = re.sub(r'<script src="assets/js/vendor/firebase-[^"]+"></script>\s*', '', html)
    html = html.replace('  enabled: true,', '  enabled: false,   // portable build: no backend')
    html = html.replace('SHSync.start();', '/* no backend in the portable build */')

    # 1. inline stylesheets
    def css_sub(m):
        href = m.group(1)
        if href.startswith('http'):
            return m.group(0)          # leave Google Fonts alone
        return '<style>\n%s\n</style>' % read(href)
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css_sub, html)

    # 2. inline scripts, rewriting every image path to resolve from the inline map.
    #    Doing this at build time (rather than patching src after the fact) means the
    #    browser never fires a request for a file that is not there.
    DYNAMIC = [
        # whole-expression forms (the path is the entire template literal)
        ('`assets/img/card/${slug}.jpg`',         "__C(slug)"),
        ('`assets/img/card/${slug}-alt.jpg`',     "__C(slug+'-alt')"),
        ('`assets/img/${slug}.jpg`',              "__I(slug)"),
        ('`assets/img/${slug}-alt.jpg`',          "__I(slug+'-alt')"),
        ('`assets/img/${IMGS[sel.cloth]}.jpg`',   "__I(IMGS[sel.cloth])"),
        # embedded forms (the path sits inside a bigger template literal)
        ('assets/img/${c.img}.jpg',               "${__I(c.img)}"),
        ('assets/img/${IMGS[sel.cloth]}.jpg',     "${__I(IMGS[sel.cloth])}"),
        ('assets/img/${slug}.jpg',                "${__I(slug)}"),
        ("assets/seq/d${String(i).padStart(3,'0')}.jpg",
         "${__S('d'+String(i).padStart(3,'0'))}"),
    ]

    # the scroll-scrubbed clip must become a data: URI too, or the single file cannot play it
    viddir = os.path.join(ROOT, 'assets', 'video')
    videos = {}
    if os.path.isdir(viddir):
        for f in sorted(os.listdir(viddir)):
            if os.path.splitext(f)[1].lower() in VIDEO_MIME:
                videos['assets/video/' + f] = data_uri(os.path.join(viddir, f))

    def js_sub(m):
        src = read(m.group(1))
        for a, b in DYNAMIC:
            src = src.replace(a, b)
        # remaining paths are literal names sitting inside template literals
        src = re.sub(r'assets/img/([\w-]+)\.jpg', lambda mm: "${__I('%s')}" % mm.group(1), src)
        for rel, uri in videos.items():
            src = src.replace(rel, uri)
        return '<script>\n%s\n</script>' % src
    html = re.sub(r'<script src="([^"]+)"></script>', js_sub, html)

    # 3. build a lookup of every image, then rewrite each reference.
    #    JS builds paths by template literal, so patch the map at runtime instead
    #    of trying to rewrite every string.
    imgdir = os.path.join(ROOT, 'assets', 'img')
    files = sorted(os.listdir(imgdir))
    entries = []
    for f in files:
        if os.path.splitext(f)[1].lower() not in MIME:
            continue
        entries.append('%s:"%s"' % (repr('assets/img/' + f).replace("'", '"'), data_uri(os.path.join(imgdir, f))))

    # the scroll-scrubbed dressing sequence lives in assets/seq and must inline too,
    # otherwise the standalone file shows a single frozen frame
    # card-size variants live in assets/img/card and must inline too
    carddir = os.path.join(imgdir, 'card')
    if os.path.isdir(carddir):
        for f in sorted(os.listdir(carddir)):
            if os.path.splitext(f)[1].lower() not in MIME:
                continue
            entries.append('%s:"%s"' % (repr('assets/img/card/' + f).replace("'", '"'),
                                        data_uri(os.path.join(carddir, f))))

    seqdir = os.path.join(ROOT, 'assets', 'seq')
    seqfiles = sorted(os.listdir(seqdir)) if os.path.isdir(seqdir) else []
    for f in seqfiles:
        if os.path.splitext(f)[1].lower() not in MIME:
            continue
        entries.append('%s:"%s"' % (repr('assets/seq/' + f).replace("'", '"'), data_uri(os.path.join(seqdir, f))))
    if SEQ_STRIDE > 1:
        # drop every other frame from the map and let the page fall back to the nearest kept one
        keep = set(seqfiles[::SEQ_STRIDE])
        entries = [e for e in entries
                   if 'assets/seq/' not in e or any(('assets/seq/' + k) in e for k in keep)]
    lookup = ('<script>window.__IMG__={%s};'
              "window.__I=function(n){return window.__IMG__['assets/img/'+n+'.jpg']||'';};"
              # LEAN drops every other frame to halve the file, so a missing frame must
              # resolve to its nearest neighbour rather than to an empty src (which would
              # render as a blank flash every other frame).
              "window.__S=function(n){var m=window.__IMG__,k='assets/seq/'+n+'.jpg';"
              "if(m[k])return m[k];var i=parseInt(n.slice(1),10);"
              "for(var d=1;d<8;d++){var a='assets/seq/d'+String(i-d).padStart(3,'0')+'.jpg';"
              "if(m[a])return m[a];var b='assets/seq/d'+String(i+d).padStart(3,'0')+'.jpg';"
              "if(m[b])return m[b];}return '';};"
              "window.__C=function(n){return window.__IMG__['assets/img/card/'+n+'.jpg']||'';};</script>"
              % ','.join(entries))

    # Static <img> tags in the shell markup point at real paths; swap them for a marker.
    # This MUST happen before the lookup map is inserted, or it rewrites the map's own keys.
    for f in files:
        rel = 'assets/img/' + f
        if ('"%s"' % rel) in html:
            name = os.path.splitext(f)[0]
            html = html.replace('"%s"' % rel, '"" data-img="%s"' % name)

    # the map must exist before the app scripts run
    html = html.replace('<body>', '<body>\n' + lookup, 1)

    html = html.replace('</body>', """<script>
document.querySelectorAll('img[data-img]').forEach(function(i){ i.src = window.__I(i.dataset.img); });
</script>
</body>""", 1)

    # NB: static <img src> tags in the shell markup are handled by the resolver above.
    # Inlining them here as well would embed those images twice and roughly double the file.

    # The cross-file links are gone: the console is a route in this same document, so
    # href="#/admin" and href="#/" both work inside the bundle with no rewriting.

    # The boot line no longer calls SHSync.start(), so this flag is already inert - but
    # leaving it reading "true" in a build with no SDK would mislead anyone reading the
    # file. It is flipped here, after inlining, because it lives in firebase-config.js
    # rather than in index.html.
    html = html.replace('  enabled: true,', '  enabled: false,  // portable build: no backend')

    out = os.path.join(ROOT, '..', 'SirHenrys-%s.html' % ('lite' if LEAN else 'standalone'))
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('%s  ->  %.1f MB' % (os.path.normpath(out), os.path.getsize(out) / 1e6))


if __name__ == '__main__':
    main()
