# The pitch

`Sir-Henrys-Proposal.pptx` — 16 slides, speaker notes on every one.
Rebuild with: `node build.js`

The palette is the shop's own (ink #151515, bone #F7F5F2, bronze #846144, from
`assets/css/site.css`), so the deck and the thing it is selling look like one object.

## Before the meeting
- Open **sirhenrys.pages.dev** in a browser tab and leave it on the home page. The
  anatomy sequence should be scrubbing while you introduce yourself.
- Open a second tab on **sirhenrys.pages.dev/#/admin**, signed in as the owner (1967).
- Have a phone ready on the same site. The stock-drops-live moment needs two screens.

## Figures used, and where they came from
| | |
|---|---|
| KSh 67,000–110,000/mo | Audited: Shopify plan + POS Pro across five stores |
| $89/store/month | Shopify POS Pro list price; five stores = $445/mo |
| 0.6–2% per order | Shopify Payments does not operate in Kenya |
| 0% barcodes, 67% missing SKUs | Counted from their live catalogue |
| 21 of 65 collections empty | Counted from their live catalogue |
| KSh 3,595,560 | 120 two-piece suits less the 25% volume tier - the app computes it |

The year-one chart deliberately uses the **low** end of the Shopify range. If they check
the maths, it should come out in their favour, not yours.

The KSh 9m annual card/M-Pesa volume behind the payment-penalty bar is an **assumption**.
Slide 13's note says to admit that and ask for their real figure - the question is a
buying signal.

## The one slide not to skip
Slide 14, "What is not finished". Volunteering the four honest limits - simulated M-Pesa,
generated imagery, 19 of the products, demo-grade staff login - buys more trust than any
feature slide. Anyone who claims a system is finished has not built one.

---

## The browser deck — `Sir-Henrys-Proposal.html`

One self-contained file, 1.5 MB, sixteen slides. Rebuild with `python deck.py`
(regenerate the embedded imagery first with the snippet that writes `_img.json`).

Images are embedded as data URIs on purpose. A client meeting is exactly the place a
network drops out, and a deck that needs one is a deck that can fail in the room. This
opens from a USB stick, an email attachment, or a laptop in flight mode.

**Presenting it**
- Arrow keys, space, or PageUp/PageDown to move. Home and End jump to the ends.
- **F** for full screen.
- Tap the right half of the screen to advance, the left half to go back — for a phone.
- The rule along the bottom is progress; the counter is bottom right.

**Single theme on purpose.** A lookbook should look identical on every screen, so every
colour is painted explicitly rather than inherited from the viewer's light or dark setting.

The palette and both typefaces are the shop's own, lifted from `assets/css/site.css`, so
the deck and the thing it is selling look like one object rather than a template with a
logo dropped on it. The bronze is raised from #846144 to #A67C52 — the brand value goes
muddy on a dark ground.
