"""Optical-flow frame interpolation.

Used for two things, both of which are the same problem - not enough frames:

  1. The dressing sequence has a jump cut at frame 37->38: the waistcoat appears in
     a single frame, which reads as a chop. Real in-betweens soften it.
  2. The 360 turnarounds are 8 (or 4) stills 45 (or 90) degrees apart. Crossfading
     two poses that far apart is a double exposure, not a rotation. Warping one
     into the other along the flow field is an actual turn.

Method: dense flow both ways, warp each side toward the middle by its share of the
motion, then blend. Warping both ways and blending - rather than warping one and
fading - is what stops the ghosting, because both images arrive at the same
geometry before they are mixed.
"""
import cv2, numpy as np


def _flow(a, b):
    d = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    d.setFinestScale(0)
    d.setPatchSize(8)
    d.setUseSpatialPropagation(True)
    return d.calc(a, b, None)


def _warp(img, flow, t):
    """Push img along t of the flow field."""
    h, w = flow.shape[:2]
    gx, gy = np.meshgrid(np.arange(w), np.arange(h))
    mx = (gx + flow[..., 0] * t).astype(np.float32)
    my = (gy + flow[..., 1] * t).astype(np.float32)
    return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def between(a_bgr, b_bgr, ts):
    """Frames between a and b at fractions ts (0<t<1)."""
    # Generated plates are not always pixel-identical in size - the carlo-navy set has
    # one frame 7px shorter than the rest - and dense flow asserts on a mismatch.
    if a_bgr.shape[:2] != b_bgr.shape[:2]:
        h, w = a_bgr.shape[:2]
        b_bgr = cv2.resize(b_bgr, (w, h), interpolation=cv2.INTER_LANCZOS4)
    ga = cv2.cvtColor(a_bgr, cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(b_bgr, cv2.COLOR_BGR2GRAY)
    fab = _flow(ga, gb)
    fba = _flow(gb, ga)
    out = []
    for t in ts:
        # a moves forward by t, b moves backward by (1-t): both land on the same
        # intermediate geometry, so the blend is a pose, not two overlaid poses
        wa = _warp(a_bgr, fab, t)
        wb = _warp(b_bgr, fba, 1.0 - t)
        out.append(cv2.addWeighted(wa, 1.0 - t, wb, t, 0))
    return out
