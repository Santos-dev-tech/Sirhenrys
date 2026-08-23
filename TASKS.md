# Build tasks — everything proposed in the Shopify audit

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done and verified

---

## 1. POS — the till screen  `[x]`
Replaces Shopify POS Pro at **$89/store/month × 5 = $445/mo (~KSh 58,000)**.

- [x] Scan or search a product at the counter
- [x] Basket, quantity, line removal
- [x] Pay by M-Pesa (STK), card, or cash — with change calculation
- [x] Complete sale → **decrements stock for that branch only**
- [x] Sale appears in orders and on the dashboard immediately
- [x] Staff picks which store they are serving from

**Verify:** ring up a sale, confirm branch stock drops and the storefront reflects it.

## 2. Barcodes and SKUs  `[x]`
Their catalogue has **0% barcodes and 67% missing SKUs** — nothing can be scanned today.

- [x] Deterministic SKU per variant (`SH-<slug>-<size>`)
- [x] EAN-13 style barcode number per variant, with valid check digit
- [x] Render a real scannable barcode (SVG, no library)
- [x] Printable tag sheet for the whole catalogue

**Verify:** check digits validate; barcode scans back to the right variant in POS.

## 3. Staff authentication  `[x]`
`admin.html` is currently open to anyone with the URL.

- [x] Login gate before the console renders
- [x] Named staff accounts with roles (owner / manager / shop floor)
- [x] Role limits: shop floor sees POS + stock only
- [x] Session persists, with sign-out

**Verify:** console is unreachable until signed in; a shop-floor account cannot open Settings.

## 4. M-Pesa, shaped for real Daraja  `[x]`
Kenya has no Shopify Payments, so they pay Shopify **0.6–2% extra on every order** for nothing.

- [x] STK push request in Daraja's real shape (BusinessShortCode, Password, Timestamp, CallbackURL…)
- [x] Realistic pending → confirmed/failed lifecycle with receipt number
- [x] Handle the real failure cases: cancelled, wrong PIN, timeout, insufficient funds
- [x] One clearly-marked file to swap in live credentials

**Verify:** payload matches Daraja's documented field names; failures surface properly.

## 5. Alterations workflow  `[x]`
Free lifetime alterations is their differentiator and nothing tracks it.

- [x] Alteration job raised against an order or walk-in
- [x] Measurements captured (sleeve, waist, hem, taper)
- [x] Stages: Received → In Workshop → Ready → Collected
- [x] Notification log (SMS-shaped) at each stage
- [x] Customer sees progress on their order page

**Verify:** move a job through every stage; customer view tracks it.

## 6. Corporate / bulk portal  `[x]`
Their own contact page is dedicated to this, served by a plain form.

- [x] Proper enquiry form: company, headcount, garment, deadline
- [x] Indicative tiered pricing by volume
- [x] Enquiries land in an admin queue with status
- [x] Convert an enquiry into a quote

**Verify:** submit an enquiry, find it in admin, move it to quoted.

## 7. WhatsApp ordering  `[x]`
The float button is a placeholder; WhatsApp is Kenya's default channel.

- [x] Product-level "ask about this" with the item pre-filled
- [x] Send a whole basket as a formatted message
- [x] Store-specific numbers

**Verify:** links open with correct pre-filled text.

---

## Known limits that stay
- No server: state is in `localStorage` and does not sync across devices.
- M-Pesa is simulated until Safaricom credentials exist.
- Passwords are demo-only and not securely hashed — real deployment needs a backend.


---

## 8. 360 turnaround  `[x]`
Drag a garment to see it from every side. Asked for repeatedly; finally reachable.

- [x] Eight photographed positions, 45 degrees apart
- [x] Drag or arrow-keys, eased so a flick glides rather than snaps
- [x] Degree readout, and a hint that stops animating once you have used it
- [x] Products without a turnaround fall back to the flat image

**Verified** by `tools/spintest.js`: 4/4 frames load, rotates right (0→3) and left (3→1).

### What it cost to learn
Three models were tried before one could actually reorient a subject:

| Model | Result |
|---|---|
| Soul 2.0, plain prompt | rendered a literal wheeled turntable, and multi-panel contact sheets |
| Soul 2.0, image reference + fixed seed | garment and studio held perfectly, but the body never turned |
| Kling O1 | blocked, needs a paid plan |
| **Nano Banana Pro** | **true rotation, subject and studio preserved** |

Soul is text-to-image and its training is overwhelmingly front-facing fashion; an image
reference pulls it further toward copying the reference pose, not away from it. Nano Banana
Pro is an image-editing model, which is the right shape for "same subject, new angle".

Two lessons worth keeping:
- Naming apparatus in a prompt renders the apparatus. "Turntable" drew a turntable, exactly
  as "no magazine" once drew magazines.
- Measure the claim, do not eyeball it. Shoulder width as a fraction of frame width
  distinguishes a real profile (0.62) from a front view dressed up as one (1.07).


## 9. Anatomy section: readable layout, light ground, phone  `[x]`

The garment filled the screen, so the copy sat on top of it and could not be read while
scrolling, and the 480p-origin frames were stretched across the full viewport.

- [x] Garment moved into its own column; copy sits in a fixed column beside it
- [x] A smaller display area means fewer upscaled pixels per screen pixel, so the frames read sharper
- [x] Light section with the garment on a dark stage panel
- [x] Frame edges feathered and the section colour sampled from the frames (#11120d) so no rectangle shows
- [x] Phone: stage and copy stack, stage given an explicit height
- [x] Every tappable control at least 40px on coarse pointers

### Why the frames are not keyed onto white
Measured before attempting it: background luma 17, suit luma 31 with its darkest decile at
19. They overlap, so any threshold that removes the backdrop also dissolves the garment -
tested at 26, 38 and 52, all of which left a ghost with floating sleeves. The dark stage
panel achieves a light section without destroying the subject.

### Phone bugs found by measuring
- The stage collapsed to **34px tall**: the frames are absolutely positioned, so the
  container had no intrinsic height. Fixed with an explicit height.
- **35 controls were under 40px**. Now 0.


## 10. The light section, fixed where it was actually broken  `[x]`

The light-background version shipped with two defects that only showed at desktop width,
both found by measuring the layout rather than looking at it.

- [x] **The camera zoom escaped the panel.** The per-step zoom (up to 1.20x) was applied to
      `.anat-stage` itself, so at full push the frames grew *past* the dark panel and their
      own pale letterbox showed as a grey rectangle sitting on the bone page. Measured:
      stage `x:539 w:940 right:1479` against panel `x:576 w:864 right:1440` — 39px past the
      viewport edge. The transform now lives on an inner `.anat-cam` layer that
      `.anat-stage` clips. Stage and panel are now identical at every scroll position.
- [x] **The opening title sat on top of the garment.** `.anat-step.centre` was still
      `position:fixed; left:50%` in white type with a radial scrim — correct for the old
      full-bleed layout, wrong once the garment moved into its own column. Measured: title
      right edge `996px` against panel left edge `576px`. It now sits in the copy column
      like every other step, dark on bone, only larger.
- [x] **The feather was cutting the sleeves off on a phone.** The radial mask
      (`ellipse 78% 82%`, transparent by 97%) reached transparency before the frame edge,
      which is invisible on desktop where the frame is letterboxed, but on a phone the
      frame spans the full stage width and the outstretched sleeves fell in the fade.
      Widened to `ellipse 124% 94%`, opaque to 74% — the feather only has to soften top and
      bottom now that the stage clips to a colour-matched panel.

**Verified** by `tools/anattest.js` at 1440x900: stage box == panel box, and the copy box
clears the panel at all nine sampled scroll positions, with no console errors.
`tools/anatshot.js` renders the section at five scroll marks, desktop and phone.


## 11. The garment turns on its own, and the dark ground stops being a rectangle  `[x]`

Reviewed the SIREN reference at 0.1-second granularity, cropped to the laptop screen. The
pattern is unambiguous: **the centred figure rotates continuously in place, on its own** —
green outfit 4.4-6.8s, denim 8.4-9.6s, black 14.4-16.4s — while its neighbours stand still
as ghosts. Nobody drags anything.

- [x] The product-page 360 turns by itself, roughly one revolution every 14s, and hands
      control over the moment you touch it — resuming 2.6s after you let go
- [x] Adjacent angles **crossfade** by a fractional position, so the 45-degree step between
      eight stills reads as a dissolve rather than a slideshow
- [x] The collection room turns too, on a shared clock, one revolution every 10s. The
      fragment shader gained a second sampler (`uTex2`/`uMix`) so the dissolve happens in
      WebGL, not by swapping a texture outright
- [x] Off-screen spinners stop their rAF entirely (IntersectionObserver)
- [x] `prefers-reduced-motion` suppresses the idle turn in both places; drag still works

**Verified** by `tools/roomtest.js`: `spinsUntouched: true` with `railMoved: false` —
it turns without anybody moving the rail — and `crossfades: true`. `tools/spintest.js`
adds `idleAdvanced` and `crossfades` on the product page.

### The dark ground
It read as "just out there" because it was a hard-edged rectangle floating on the bone.
Three measurements decided the fix:

| | |
|---|---|
| Frame background at its very edge | luma **17** |
| Panel colour `#11120d` | luma **17.5** |
| Garment extent on the widest frame | x = **0.03 → 0.97** |

The frame's edge was already invisible *against the panel* — half a luma step apart. The
rectangle was the panel's own edge against the page. It cannot be feathered on all sides,
because the sleeves reach to 3% from the frame edge, so instead it became a **column**:
three sides run off the page and the fourth dissolves. The dissolve is fitted between two
fixed things — the copy's right edge at x=418 and the frame's left edge at x=634 — and the
copy column carries 13vw of right padding so no type can ever land on the ramp.

**Verified**: max single-pixel luma jump across the whole dissolve is **4.7** (a hard edge
measures 200+), and `anattest.js` reports `allStepsClearOfDissolve: true` at nine scroll
positions. The frame mask was dropped entirely — the frames now sit wholly inside the
column, so the feather had nothing left to hide, and losing it returned the sleeve tips
and one per-pixel alpha composite.

### Still true
Only **one** garment has eight photographed angles. The other twelve in the room are flat
plates and stay flat rather than fake it. Turning all of them is a credit problem, not a
code one — see the note in `README.md`.
