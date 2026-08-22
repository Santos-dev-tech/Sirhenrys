# Sir Henry's Limited

A storefront and staff console for Sir Henry's Limited (Nairobi, est. 1967), built as a
pitch against their current Shopify site at `sirhenrys.co.ke`.

No build step, no framework, no backend. Open `index.html` and it runs.

---

## Run it

```bash
python tools/serve.py 8100
```

Then open `http://localhost:8100`.

Use this rather than opening `index.html` off the filesystem — `tools/serve.py` implements
HTTP Range, which `python -m http.server` does not. On Windows, `START-SIR-HENRYS.bat`
in the parent folder does the same thing with a double-click.

To deploy, drag this folder onto Netlify. Nothing to configure.

---

## The two set pieces

**The Anatomy of a Suit** — the opening section. A 97-frame image sequence, extracted from
a Seedance clip, scrubbed by scroll position: forward as you scroll down, backward as you
scroll up. Each of the five steps carries a camera (focal point + zoom) that interpolates
between steps, so the frame pushes onto the collar, pans to the lapel, then pulls back for
the finished suit.

It is an image sequence rather than a `<video>` on purpose. Scrubbing a video means seeking
a codec, and seeking fails in ways that are hard to predict — stalled seeks, `seekable.end(0)`
reporting `0` behind servers without Range support, unreliable seeking on `data:` URIs. Every
frame here is a plain `<img>`; if it renders at all, it moves.

**The Collection room** — a WebGL rail (Three.js). Garments stand in one shared white void:
the centred piece is sharp and full-colour, its neighbours recede on a ground plane, shrinking
and washing toward the page colour. The plates are photographs on a near-white studio ground,
so a per-plate chroma key plus an edge feather dissolves the rectangle and leaves the figure
and its baked floor shadow floating in the page. Drag it sideways.

---

## Storefront routes

| Route | What it does |
|---|---|
| `#/` | Anatomy sequence, hero, collection room, categories, made-to-measure, weddings, sale, reviews |
| `#/shop` | Catalogue with category filters and sorting |
| `#/product/:slug` | Size picker, live per-branch stock, size finder, accordion detail |
| `#/lookbook` | The full collection in the WebGL room |
| `#/bespoke` | Made-to-measure configurator with live price build-up |
| `#/wedding` | Wedding/group builder — discount scales to 20% |
| `#/appointments` | Book a fitting at any of the four stores |
| `#/search` | Full-text search over titles, fabrics, descriptions, tags |
| `#/cart` `#/checkout` | Bag and checkout with M-Pesa, card, or pay-on-collection |
| `#/order/:id` | Order tracking with a five-stage workshop timeline |
| `#/account` `#/wishlist` `#/stores` `#/about` `#/contact` | Supporting pages |

## Staff console (`admin.html`)

Dashboard with suggested inter-branch transfers, analytics, orders with editable status and
workshop notes, products with inline price editing, a per-store inventory matrix, customers
with lifetime value, fittings, made-to-measure commissions, and wedding groups.

---

## Things Shopify won't do

These are the parts worth demoing, because the current site can't do them:

1. **M-Pesa as a first-class checkout option.** Most Kenyan customers pay this way.
2. **Made-to-measure configurator** — cloth × cut × lapel × lining × buttons, priced live.
   Shopify variants cannot express this.
3. **Wedding and group ordering** — one organiser, a whole party, tiered discounts, cloth
   reserved from a single bolt so every jacket matches.
4. **Live stock by size *and* branch**, with transfer suggestions when a size is dead in one
   store and sitting in another.
5. **Alteration and workshop tracking** — "In Workshop" and "Ready for Fitting" are real
   stages for a tailor, and they show on the customer's order page.
6. **Size finder** from chest and height, which cuts returns on a 40,000/- purchase.

---

## Layout

```
index.html           storefront shell
admin.html           staff console shell
assets/css/          site.css, admin.css
assets/js/data.js    catalogue, stock model, cart, orders, persistence
assets/js/app.js     storefront router + views
assets/js/motion.js  Lenis, the WebGL room, scroll reveals, the anatomy camera
assets/js/admin.js   console router + views
assets/js/vendor/    lenis.min.js, three.min.js (both MIT, vendored - no CDN)
assets/img/          43 campaign plates at full resolution (1536px)
assets/img/card/     760px variants for grid cards and admin thumbnails
assets/seq/          97 frames of the dressing sequence
assets/video/        the source clip the sequence was extracted from
tools/serve.py       static server with Range support
tools/shoot.js       headless screenshot + health harness (needs puppeteer-core)
tools/seqtest.js     proves the sequence runs forward and reverse
tools/bundle.py      inlines everything into one portable .html
tools/gen.ps1        image generation runner (Higgsfield CLI)
```

**Images are served at the size they are displayed.** Full-resolution plates go to the
product page, the WebGL room and the editorial bands; 760px variants go to grid cards and
admin thumbnails. Serving 1536px into a 400px card cost roughly 17 MB on the shop page.

**State** lives in `localStorage` under `sirhenrys.v1`, shared between storefront and console
— place an order on one and it appears in the other. Reset from **Settings → Reset demo data**.

---

## Honest limitations

- **Front-end prototype.** No server, so orders, stock and accounts live in the browser and
  reset when you clear storage. Nothing is shared between devices.
- **M-Pesa is simulated.** The STK-push step waits ~1.4s and confirms. Real integration needs
  the Daraja API and a backend to hold credentials.
- **No authentication.** `admin.html` is reachable by anyone with the URL. It needs a staff
  login before this goes near the public internet.
- **The catalogue is 19 products**, not the full range. Prices are the real ones from
  `sirhenrys.co.ke`; the copy is written to match their voice, not lifted from them.
- **Imagery is AI-generated** (Higgsfield Soul 2.0 for stills, Seedance 2.0 for the dressing
  clip). For production these should be photographs of actual Sir Henry's stock — the garments
  shown are representative, not real inventory.
- **The dressing sequence is capped at 864×496**, the resolution of the source clip. Upscaling
  would need a pass through a video upscaler.
