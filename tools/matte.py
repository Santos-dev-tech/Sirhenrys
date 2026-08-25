# -*- coding: utf-8 -*-
"""Cut the studio ground off the lookbook plates, once, offline.

    python tools/matte.py            # write assets/img/room/*.webp
    python tools/matte.py --check    # report only, write nothing

WHY THIS IS NOT DONE IN THE SHADER

It was, and it never worked properly. The runtime key compares each pixel to a
sampled ground colour, and the ground is not a colour:

  - it is a vertical gradient, 15 to 30 levels darker at the floor than the top,
    and different on every plate;
  - the model casts a soft shadow that is DARKER than the ground (measured
    153,156,150 against 193,201,203), so a key that removes the ground keeps the
    shadow, and a key wide enough to take the shadow eats a navy trouser leg;
  - a light garment - the beige linen, the mint grey - sits within a few levels of
    the ground it was shot on, so any luminance threshold that clears the floor
    also clears the suit.

Three rounds of tuning produced either a grey rectangle or a missing garment, and a
gradient over the canvas hid the floor by hiding the bottom of the outfit with it.

WHAT THIS DOES INSTEAD

Region growing from the border. cv2.floodFill in neighbour-comparison mode walks
outward from every edge pixel and keeps going while each step is within a small
tolerance of the pixel it came from. A smooth gradient is exactly that - a sequence
of small steps - so the whole ground goes, gradient and cast shadow together, while
the sharp edge of a garment stops the fill dead no matter how light the cloth is.

The result is a real alpha channel, computed once, so the room composites onto any
background with no key at all and nothing to tune per theme.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'img')
OUT = os.path.join(ROOT, 'assets', 'img', 'room')

# the thirteen the collection room puts on the rail
SLUGS = ['carlo-mint-grey', 'carlo-navy', 'navy-pinstripe', 'blush-pink-wool',
         'charcoal-db', 'black-tuxedo', 'beige-linen', 'burgundy-velvet',
         'navy-blazer', 'camel-overcoat', 'bomber-navy', 'bomber-chocolate',
         'bomber-black']

W, H = 760, 1013          # what the rail actually renders; the card size
TOL = 3                   # per-step tolerance for the region grow
TOLS = [3, 4, 5, 7, 9, 12, 2]   # tried in order until a matte passes sane()
FEATHER = 1.2             # gaussian sigma on the matte edge, in output pixels
BLUR = 0.6                # pre-blur before the fill: enough to bridge JPEG noise,
                          # not enough to soften a garment edge into a ramp the
                          # fill can walk up. At 1.1 it walked into every suit.


def sane(alpha):
    """Is this matte plausibly a man standing on a floor?

    A bad matte is worse than no matte, so every candidate has to pass the same
    three questions before it is written: is the figure a believable share of the
    frame, does it reach the floor, and is it roughly centred rather than being the
    whole plate minus a border."""
    keep = alpha > 128
    kept = float(keep.mean())
    ys, xs = np.where(keep)
    if not len(xs):
        return False, kept, (0, 0, 0, 0)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    ok = (0.08 <= kept <= 0.45           # a man, not a rectangle and not a scrap
          and box[3] > H * 0.90          # he is standing on the floor
          and (box[2] - box[0]) < W * 0.80)   # and he is not the whole frame

    # And he is all there. carlo-mint-grey passed every test above with 23% kept and
    # NO TROUSERS: the fill walked up into the dark cloth from the floor, the
    # largest-component step kept the jacket, and the numbers looked perfect. So walk
    # down the figure in bands and insist each one holds something.
    if ok:
        top, bot = box[1], box[3]
        band = max(8, (bot - top) // 16)
        for y in range(top, bot - band, band):
            if keep[y:y + band].sum() < band * 2:      # an all-but-empty slice
                ok = False
                break
    return ok, kept, box


def trim_frame(img):
    """Crop a flat, near-white border if the plate has one.

    carlo-navy ships inside a pure white (255) frame several pixels wide, around a
    backdrop of 218-245. The region grow starts inside that frame, cannot make the
    ten-level step into the backdrop, and hands back 96% of the plate as "figure";
    every tolerance wide enough to cross it also ate the suit. Seeding a fixed
    distance in only works if you guessed the frame width, so measure it instead:
    walk in from each edge while the row or column is flat and bright, and crop.
    """
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = g.shape
    flat = lambda line: line.std() < 2.5 and line.mean() > 238

    top = 0
    while top < h // 8 and flat(g[top]):
        top += 1
    bot = h - 1
    while bot > h - h // 8 and flat(g[bot]):
        bot -= 1
    left = 0
    while left < w // 8 and flat(g[:, left]):
        left += 1
    right = w - 1
    while right > w - w // 8 and flat(g[:, right]):
        right -= 1

    if (top, left) == (0, 0) and (bot, right) == (h - 1, w - 1):
        return img, 0
    return img[top:bot + 1, left:right + 1], top + left + (h - 1 - bot) + (w - 1 - right)


def matte(path, tol=None):
    """Return (rgb, alpha, tol) for one plate.

    Tolerance is searched rather than fixed. Twelve of the thirteen plates cut
    cleanly at 3; carlo-navy is shot on a lit backdrop whose step from the border
    exceeds that, and sat at 96% kept until the fill was let out a little. Rather
    than hand-tune one file, the tolerances are tried in order and the first matte
    that passes sane() wins - so a new plate dropped into the folder is handled
    without anybody editing this."""
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        return None, None, None
    # a flat white frame has to go before anything else, or the fill starts inside it
    img, trimmed = trim_frame(img)
    # work at output size: the fill is about shape, and it is six times faster
    img = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)

    # A light blur before the fill stops JPEG noise from stopping the grow early.
    # The matte is taken from the blurred copy; the pixels that ship are not blurred.
    smooth = cv2.GaussianBlur(img, (0, 0), BLUR)

    best = None
    for t in ([tol] if tol else TOLS):
        a = cut(smooth, img, t)
        ok, kept, box = sane(a)
        if ok:
            return cv2.cvtColor(img, cv2.COLOR_BGR2RGB), a, t
        if best is None:
            best = (a, t)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB), best[0], best[1]


def cut(smooth, img, TOL):
    """One region-grow pass at a given tolerance."""

    # floodFill needs a mask two pixels larger than the image
    mask = np.zeros((H + 2, W + 2), np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)

    # Seed from every border pixel. One seed in a corner is enough for a clean
    # studio shot; every border pixel is enough for one with a vignette, a prop, or
    # a model whose shoulder touches the edge.
    # Seeded at the very edge AND a few pixels in. carlo-navy carries a pure white
    # (255) frame one or two pixels wide around a backdrop of 218-245: seeded only on
    # the border, the fill starts inside that frame, cannot make the ten-level step
    # into the backdrop, and returns 96% of the plate as "figure". Every tolerance
    # wide enough to cross it was also wide enough to eat the suit. Starting inside
    # as well costs nothing and removes the whole class of problem.
    INSET = 5
    seeds = []
    for inset in (0, INSET):
        seeds += ([(x, inset) for x in range(inset, W - inset, 4)] +
                  [(x, H - 1 - inset) for x in range(inset, W - inset, 4)] +
                  [(inset, y) for y in range(inset, H - inset, 4)] +
                  [(W - 1 - inset, y) for y in range(inset, H - inset, 4)])
    # A seed must land on the studio ground, not on the model. burgundy-velvet is
    # cropped at mid-calf, so his black trousers run off the bottom edge - a seed
    # there starts INSIDE the garment and floods it, and the plate came back as a
    # jacket with no legs. Only seed pixels that look like ground: bright, and near
    # neutral. Any figure touching any edge is covered by the same rule.
    hsv = cv2.cvtColor(smooth, cv2.COLOR_BGR2HSV)
    def groundish(x, y):
        v = int(hsv[y, x, 2])
        sat = int(hsv[y, x, 1])
        return v > 150 and sat < 60

    for sx, sy in seeds:
        if mask[sy + 1, sx + 1]:          # already part of the background
            continue
        if not groundish(sx, sy):
            continue
        cv2.floodFill(smooth, mask, (sx, sy), 0,
                      (TOL,) * 3, (TOL,) * 3, flags)

    # ---- second pass: pockets the border cannot see -----------------------------
    # The gap between a man's legs is studio floor, but it is walled off from the
    # border by his trousers, so a fill that starts at the edge never reaches it. It
    # is not an enclosed BACKGROUND region either - it comes out contiguous with the
    # legs - so no amount of component analysis afterwards finds it. Measured: the
    # pixel at (650,370) on carlo-mint-grey was solid straight out of the first pass,
    # and it rendered as a white strip from knee to floor.
    #
    # So seed a second round from inside. For each row, the ground colour is known -
    # it is the mean of the pixels the first pass DID reach on that row. Any pixel
    # the fill missed whose colour matches its own row's ground is floor, and gets a
    # seed. Matching per row rather than globally is what keeps a pale suit safe: the
    # mint grey is nowhere near the floor tone at its own height.
    reachable = mask[1:H + 1, 1:W + 1]
    for y in range(0, H, 3):
        known = (reachable[y] == 255)
        if known.sum() < 20:
            continue
        ground_row = smooth[y][known].mean(axis=0)
        d = np.abs(smooth[y].astype(int) - ground_row).sum(axis=1)
        for x in np.where((reachable[y] == 0) & (d < 18))[0][::6]:
            if mask[y + 1, x + 1]:
                continue
            cv2.floodFill(smooth, mask, (int(x), y), 0, (TOL,) * 3, (TOL,) * 3, flags)

    bg = mask[1:H + 1, 1:W + 1]           # 255 where the fill reached
    solid = (bg == 0).astype(np.uint8)    # everything the fill did NOT reach

    # ---- keep only the model -------------------------------------------------
    # The fill leaves wisps: fragments of cast shadow that a slightly out-of-
    # tolerance boundary cut off from the border, which then float around the
    # model's feet like scraps of paper. They are always small and always
    # disconnected from the figure, so taking the largest connected component
    # removes every one of them and nothing else.
    # Thin remnants of the cast shadow reach the figure through the shoes, so the
    # component step below cannot separate them - they arrive as wire-thin streaks
    # trailing off across the floor. An opening removes any structure narrower than
    # the kernel; a trouser leg is sixty pixels wide on a 760px plate and does not
    # notice, a three-pixel streak vanishes. At 9 it removed burgundy-velvet's body
    # entirely, which the sanity gate caught - the gate is why that is a note and not
    # a shipped plate.
    solid = cv2.morphologyEx(solid, cv2.MORPH_OPEN,
                             cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

    n, labels, stats, _ = cv2.connectedComponentsWithStats(solid, 8)
    if n > 1:
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        solid = (labels == biggest).astype(np.uint8)

    # ---- and all of the model --------------------------------------------------
    # The mirror of the same problem: where the fill squeezed through a gap - between
    # an arm and a torso, into a dark trouser leg - it leaves holes inside the figure
    # that show as speckle. Anything enclosed by the model is the model.
    inv = 1 - solid
    n2, lab2, stats2, _ = cv2.connectedComponentsWithStats(inv.astype(np.uint8), 4)
    if n2 > 1:
        border = set(lab2[0, :]) | set(lab2[-1, :]) | set(lab2[:, 0]) | set(lab2[:, -1])
        reached = (solid == 0)
        limit = 0.004 * W * H

        # An enclosed region is either a pin-hole in the figure or the studio ground
        # seen THROUGH the figure - the gap between a man's legs, the triangle under
        # a bent arm. The region grow cannot reach those from the border, so they
        # survived as opaque and painted a white panel between every pair of
        # trousers. Size does not separate the two cases; colour does. If it looks
        # like the ground at that height, it is the ground.
        for k in range(1, n2):
            if k in border:
                continue
            sel = (lab2 == k)
            y0 = stats2[k, cv2.CC_STAT_TOP]
            y1 = y0 + stats2[k, cv2.CC_STAT_HEIGHT]
            band = reached[y0:y1]
            if band.any():
                ground_m = smooth[y0:y1][band].mean(axis=0)
                region_m = smooth[sel].mean(axis=0)
                lum = lambda c: 0.114 * c[0] + 0.587 * c[1] + 0.299 * c[2]   # BGR
                sat = float(region_m.max() - region_m.min())
                # An enclosed region that is as bright as the ground, or brighter,
                # and near-neutral, IS the ground - the lit floor seen between a
                # man's legs is brighter than the ground at the side margins, which
                # is why a plain colour-distance test kept it and painted a white
                # strip from knee to floor. Brightness separates it; distance does not.
                if lum(region_m) >= lum(ground_m) - 25 and sat < 42:
                    continue                       # it is the ground; leave it cut out
            if stats2[k, cv2.CC_STAT_AREA] < limit:
                solid[sel] = 1                     # a genuine pin-hole

    # Pull the edge in by a pixel before feathering. The outermost pixel of a cut is
    # half studio ground by definition, and feathering it outward smears that light
    # ring onto a dark page as a halo.
    solid = cv2.erode(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))

    alpha = (solid * 255).astype(np.uint8)
    # feather so the cut does not alias against a dark page
    return cv2.GaussianBlur(alpha, (0, 0), FEATHER)


def do_spin():
    """Cut the turnaround frames too.

    The rail swaps a spin frame in for the plate as a garment travels past, and
    those frames are plain JPEGs with no alpha - so the one garment that has a
    turnaround rendered as a full grey rectangle in the middle of a room where
    everything else was cut. Same algorithm, smaller frames, written beside the
    originals.
    """
    import glob
    root = os.path.join(ROOT, 'assets', 'spin')
    total = bad = done = 0
    for slug in sorted(os.listdir(root)):
        d = os.path.join(root, slug)
        if not os.path.isdir(d) or slug == 'cut':
            continue
        out = os.path.join(d, 'cut')
        os.makedirs(out, exist_ok=True)
        frames = sorted(glob.glob(os.path.join(d, 'f*.jpg')))
        print('  %s: %d frames' % (slug, len(frames)))
        for f in frames:
            rgb, alpha, used = matte(f)
            if rgb is None:
                bad += 1
                continue
            ok, kept, box = sane(alpha)
            if not ok:
                bad += 1
            name = os.path.splitext(os.path.basename(f))[0] + '.webp'
            Image.fromarray(np.dstack([rgb, alpha])).save(
                os.path.join(out, name), 'WEBP', quality=86, method=4)
            total += os.path.getsize(os.path.join(out, name))
            done += 1
        print('    %d written, %d KB, %d flagged' % (done, total // 1024, bad))
    return 1 if bad > len(SLUGS) else 0


def main():
    global TOL, BLUR, FEATHER
    check_only = '--check' in sys.argv
    for a in sys.argv[1:]:
        if a.startswith('--tol='):     TOL = float(a.split('=')[1])
        if a.startswith('--blur='):    BLUR = float(a.split('=')[1])
        if a.startswith('--feather='): FEATHER = float(a.split('=')[1])
    only = [a.split('=')[1] for a in sys.argv[1:] if a.startswith('--only=')]
    slugs = only or SLUGS
    print('tol=%s blur=%s feather=%s' % (TOL, BLUR, FEATHER))
    if '--spin' in sys.argv:
        print('Cutting turnaround frames')
        return do_spin()
    if not check_only:
        os.makedirs(OUT, exist_ok=True)

    print('Cutting %d lookbook plates%s\n' % (len(SLUGS), ' (check only)' if check_only else ''))
    bad = 0
    total = 0
    for slug in slugs:
        src = os.path.join(SRC, slug + '.jpg')
        if not os.path.exists(src):
            print('  MISSING  %s' % slug)
            bad += 1
            continue

        rgb, alpha, used = matte(src, tol=TOL if '--tol=' in ' '.join(sys.argv) else None)
        if rgb is None:
            print('  UNREADABLE %s' % slug)
            bad += 1
            continue

        ok, kept, box = sane(alpha)
        if not ok:
            bad += 1

        line = '  %-8s %-18s tol %-3s kept %5.1f%%  figure %dx%d at (%d,%d)' % (
            'ok' if ok else 'CHECK', slug, used, kept * 100,
            box[2] - box[0], box[3] - box[1], box[0], box[1])

        if not check_only:
            out = os.path.join(OUT, slug + '.webp')
            Image.fromarray(np.dstack([rgb, alpha])).save(out, 'WEBP', quality=88, method=6)
            kb = os.path.getsize(out) // 1024
            total += kb
            line += '  ->  %dKB' % kb
        print(line)

    print('')
    if not check_only:
        print('%d files, %d KB total, in assets/img/room/' % (len(slugs) - bad, total))
    if bad:
        print('FAIL - %d plate(s) need looking at' % bad)
        return 1
    print('PASS - every plate cut cleanly')
    return 0


if __name__ == '__main__':
    sys.exit(main())
