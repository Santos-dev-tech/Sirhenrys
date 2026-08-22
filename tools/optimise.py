"""Convert the generated PNG plates into web-weight JPEGs.

The raw Higgsfield output is ~3.6 MB per plate, which is fine as a master but hopeless
as a website payload. This resizes each plate to the largest size the layout actually
uses (allowing for 2x retina) and re-encodes as progressive JPEG.

Masters are moved to ../../_original-plates/ rather than deleted.
"""
import os, glob, shutil, sys
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'assets', 'img')
MASTERS = os.path.join(HERE, '..', '..', '_original-plates')

# widest the layout ever paints each class of plate, doubled for retina
WIDTHS = {
    'ed-hero': 2200,
    'ed-': 1800,          # ed-atelier / ed-fabric / ed-store: full-bleed editorial bands
    'cat-': 1000,         # category tiles
    'acc-': 1000,         # still lifes
    '_default': 1100,     # product portraits in a 3:4 card
}
QUALITY = 82


def target_width(name):
    for prefix, w in WIDTHS.items():
        if prefix != '_default' and name.startswith(prefix):
            return w
    return WIDTHS['_default']


def main():
    os.makedirs(MASTERS, exist_ok=True)
    pngs = sorted(glob.glob(os.path.join(IMG, '*.png')))
    if not pngs:
        print('nothing to do')
        return
    before = after = 0
    for p in pngs:
        name = os.path.splitext(os.path.basename(p))[0]
        if '__v' in name:                      # unpicked variants: archive, do not ship
            shutil.move(p, os.path.join(MASTERS, os.path.basename(p)))
            continue
        im = cv2.imread(p)
        if im is None:
            print('SKIP unreadable', name)
            continue
        h, w = im.shape[:2]
        tw = min(target_width(name), w)
        if tw < w:
            im = cv2.resize(im, (tw, int(h * tw / w)), interpolation=cv2.INTER_AREA)
        out = os.path.join(IMG, name + '.jpg')
        cv2.imwrite(out, im, [cv2.IMWRITE_JPEG_QUALITY, QUALITY, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
        before += os.path.getsize(p)
        after += os.path.getsize(out)
        shutil.move(p, os.path.join(MASTERS, os.path.basename(p)))
        print('%-26s %5.2f MB -> %6.0f KB  (%dpx)' % (name, os.path.getsize(p) / 1e6 if os.path.exists(p) else 0, os.path.getsize(out) / 1024, tw))
    print('\nTOTAL  %.1f MB -> %.1f MB  (%.0f%% smaller)' % (
        before / 1e6, after / 1e6, 100 * (1 - after / before) if before else 0))
    print('masters archived to', os.path.normpath(MASTERS))


if __name__ == '__main__':
    main()
