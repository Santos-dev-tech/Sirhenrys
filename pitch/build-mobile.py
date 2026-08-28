"""Build the mobile deck into one self-contained file.

`mobile-deck.src.html` is the thing to edit. It carries {{IMG:name}} placeholders;
this substitutes each one for the matching screenshot in ../_shots/deck as a base64
JPEG, so the deck is a single file that works with no network and can be handed to
anyone. Nothing here touches the screenshots themselves - regenerate those with
`node tools/deckshots.js`, which needs both servers up (see pitch/README.md).

    python build-mobile.py
"""
import base64
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "mobile-deck.src.html")
OUT = os.path.join(HERE, "Sir-Henrys-Mobile.html")
SHOTS = os.path.join(HERE, "..", "_shots", "deck")

# the deck is presented on a laptop and printed to nobody; 760px wide at q82 is
# indistinguishable from the 1170px original at the size these are shown
TARGET_W = 760
QUALITY = 82


def encoded(name):
    """Return the screenshot as a base64 JPEG data URI, downscaled."""
    png = os.path.join(SHOTS, name + ".png")
    if not os.path.exists(png):
        sys.exit(
            "missing screenshot: %s\n"
            "Regenerate them with:  node tools/deckshots.js\n"
            "(needs :8100 on the working tree and :8200 on a worktree at 95077f1)" % png
        )
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Pillow is needed to build the deck:  python -m pip install pillow")

    im = Image.open(png).convert("RGB")
    if im.width > TARGET_W:
        im = im.resize((TARGET_W, round(im.height * TARGET_W / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    src = io.open(SRC, encoding="utf-8").read()
    used = []

    def sub(m):
        used.append(m.group(1))
        return encoded(m.group(1))

    out = re.sub(r"\{\{IMG:([a-z0-9-]+)\}\}", sub, src)
    if "{{IMG:" in out:
        sys.exit("a placeholder was left unsubstituted")

    io.open(OUT, "w", encoding="utf-8", newline="\n").write(out)
    kb = os.path.getsize(OUT) / 1024
    print("wrote %s" % os.path.relpath(OUT, HERE))
    print("  %d slides, %d screenshots, %.0f KB" % (out.count('<section class="slide'), len(used), kb))
    for n in used:
        print("    " + n)


if __name__ == "__main__":
    main()
