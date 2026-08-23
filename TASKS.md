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


## 12. One app, and a backend behind it  `[x]`

Storefront and staff console were two pages sharing a `localStorage` key. They are now one
document with a real database behind them, so there is a single thing to deploy.

### The merge
- [x] `index.html` carries both: `#shop` and `#ad`, each router hiding the other's subtree
- [x] The console is at **`#/admin`**; `admin.html` is now just a redirect for old bookmarks
- [x] Entering `#/admin` unmounts the WebGL rail and stops Lenis — leaving them running
      behind a till screen would burn GPU and hijack the wheel
- [x] `tools/bundle.py` builds **one** file instead of four

**The problem worth recording** was CSS, not routing. Measured before touching anything: the
two stylesheets shared **36 identical selectors** and **16 class names**, and `admin.css`
carried **22 rules on bare elements** — including `:root`, `body` and `*`. Concatenated, each
would have rewritten the other. So every rule in `admin.css` is now scoped under `.ad`, with
`:root` and `body` both becoming `.ad` so the console's palette cascades over its own subtree
and nowhere else. `@media print` deliberately stays global: printing a receipt has to hide the
storefront behind it too.

Two bugs found doing it, both by running the thing rather than reading it:
- The `@import` strip matched `@import[^;]+;` — and the font URL contains semicolons
  (`wght@300;400;…`), so it cut mid-URL and left `400;500;…swap');` as a stray selector.
  Matching `url(...)` to its closing paren fixed it.
- `renderLogin()` did `document.body.innerHTML = …`. In a merged page that deletes the shop.

### The backend
- [x] Firestore at `shops/<shop>/state/<key>`, one document per shared key
- [x] **Shared vs per-device is a deliberate split.** Orders, adjustments, alterations,
      corporate, fittings, commissions, groups and settings sync. Carts, wishlists,
      recently-viewed and the signed-in till user do **not** — sharing them would put one
      customer's basket on another customer's phone and sign the POS in at four branches
      at once
- [x] Values are stored as JSON strings: the state nests arrays inside arrays (an order has
      items, an alteration has a log), which Firestore rejects natively
- [x] Offline persistence on, so the till keeps selling through an outage and reconciles after
- [x] Writes are debounced 400ms and diffed against last-known-remote, so a save that touched
      only the cart writes nothing
- [x] `hasPendingWrites` snapshots are skipped, and an `applying` flag stops a remote change
      echoing back out as a write — without it the two loop forever
- [x] **Everything degrades.** SDK missing, project misconfigured, or `enabled:false` in
      `firebase-config.js` → the app runs on `localStorage` exactly as before
- [x] `firestore.rules` written, with the three steps to real staff accounts in its header

**Verified** by `tools/mergetest.js`: both subtrees present, each hides the other, the console
signs in and routes (`#/admin/inventory` → Inventory), 114 product cards still render on
return, and `.btn` padding stays `14px 30px` (site.css) rather than `10px 18px` (admin.css) —
which is the assertion that the console's stylesheet is not leaking. `admintest.js` and
`storetest.js` both pass unchanged in behaviour against the merged app.

### Blocked on one console setting
Anonymous sign-in is **not enabled** on the Firebase project, so auth returns
`auth/admin-restricted-operation` and sync stays off — the app is running on `localStorage`.
Firebase console → Authentication → Sign-in method → Anonymous → Enable. Nothing in the code
changes; sync comes up on the next load.


## 13. 4K pro, and what the research bought  `[x]`

Ten credits on a fresh account (`bintiinurii@gmail.com`). Spent as instructed: 4K pro first,
then research before touching the rest.

### 4K pro on the dressing clip
The 480p original is gone — not on disk, no URL logged, and it belonged to the account we
signed out of. So pro ran over the standard upscale, which compounds. Worth saying plainly
before the numbers, because it means this is a restoration pass, not a clean pro-from-source.

It worked anyway. Laplacian variance, normalised to a common 1920px width so frame size
cannot flatter the result:

| | standard | pro | change |
|---|---|---|---|
| video, mean of 9 frames | 40.6 | 90.8 | **+124%** |
| **delivered frames**, as the browser loads them | 33.4 | 99.2 | **+197%** |

Checked at 1:1 pixels before trusting the number, because Laplacian variance rewards
sharpening halos as readily as detail: the lapel weave is now texture where it was smooth
plastic, the buttonhole resolves as stitching, the tie knot has folds rather than a smear.
No ringing at the edges. All 97 frames re-extracted at 1920x1101 through a staging
directory — overwriting in place and failing halfway would leave the sequence half-old.

### What the research found
Probed every image model's price for free before spending anything:

| model | cost | free plan |
|---|---|---|
| `kling_omni_image` | 0.5 | **gated** |
| `nano_banana`, `seedream_v4_5`, `seedream_v5_lite` | 1 | **gated** |
| `nano_banana_flash` (Nano Banana 2) | 1.5 | **allowed** |
| `nano_banana_pro` | 2 | allowed |
| `gpt_image_2` | 7 | — |

Two things worth keeping:
- **The free plan gates the cheap models, not the expensive one.** The 0.5 and 1-credit
  tiers all refuse with `job_minimum_basic_plan_required`. A failed create costs nothing,
  so mapping this was free.
- **Nano Banana Pro is not the only model that can reorient a subject.** Task 8 concluded it
  was. Nano Banana 2 does it too, at 1.5 instead of 2 — a true side profile holding the man,
  the suit, the studio and the shadow direction. It defaults to 1:1 at 1k, which is what
  makes it look worse than it is; `--aspect-ratio 3:4` fixes that.

### A second garment that turns  `[x]`
- [x] `charcoal-db` now has a four-position turnaround (0/90/180/270) at 896x1200
- [x] Angle sets are **per garment** now (`SPIN_SETS`), not one global array — carlo-navy has
      eight, charcoal-db has four, and the viewer derives its degree labels from the length
- [x] Normalised by downscaling the 1536x2048 plate to match the generated 896x1200, rather
      than upscaling three images and inventing pixels

**Verified** by `tools/roomtest.js`: `withTurnaround: [carlo-navy, charcoal-db]`,
`anglesEach: [8, 4]`, both `spinsUntouched` and `crossfades`.

`spintest.js` was counting distinct angle indices to decide whether the idle turn was
running, which fails under headless swiftshader — the dt clamp throttles the clock, so
something plainly moving reports as still. It now reconstructs the fractional position from
the two visible opacities and sums the advance, which is frame-rate independent.

### Credits
0.77 left. Eleven of thirteen room garments are still flat plates. At 1.5 a frame that is
~16 credits for one more eight-angle garment, or ~6 for another four-angle one.


## 14. A turnaround that actually turns  `[x]`

> "the 360 turn is so bad, it looks confusing and it doesnt even go round just random
> angles make it actually spin like in the video"

Right on every count, and the fault was mine, not the images'.

**It was not an ordering bug.** Measured body width across each set — it peaks at 0/180 and
narrows at both profiles, on both garments — so the frames were in correct rotational
sequence. **The fault was the crossfade.** Dissolving two poses 45 degrees apart does not
blend into a turn; it puts two overlapping people on screen. At charcoal-db's 90-degree
steps it was worse. The thing I added to make eight stills look smooth is what made them
look random.

**Interpolation could not save it.** Tried optical flow between adjacent angles first,
because it is free: the result is a ghost with a translucent duplicate offset sideways.
A 45-degree body rotation reveals surfaces that do not exist in the previous frame, so
there is nothing for the flow field to track them to. Recorded because it is worth not
trying twice.

The fix was never in the code. It was **more frames**.

- [x] An 8-second video of the man turning once on the spot (Veo 3.1 Lite, 8 credits),
      with `start_image` **and** `end_image` both set to the front plate, which forces a
      closed loop rather than a turn that drifts
- [x] 192 frames, pillarboxed 3:4 inside 16:9 — cropped to the measured content box and
      sampled to **72 frames, five degrees apart**, 1.68 MB total at 22 KB a frame
- [x] Crossfade removed. `spintest.js` now asserts `singleFrameOnly` — exactly one frame
      lit at every sample. Any overlap is a regression now, not a feature
- [x] Turn rates are stated in **seconds per revolution**, not frames per second, so a
      72-frame set and the room's 24-frame subsample turn at the same speed
- [x] The room takes a 24-frame subsample: it holds every frame as a live GPU texture

`charcoal-db` is no longer spinnable. Four stills at 90 degrees was exactly the thing being
complained about, and one garment turning properly beats two turning badly. Its four plates
stay on disk for when there are credits for a real turntable.

**Verified:** `spintest.js` — 72 frames, all loaded, `singleFrameOnly: true`,
`maxVisible: 1`, idle advancing untouched, drag working both ways. `tools/spinshot.js`
captures the sequence at eight even points and it reads front → profile → back → other
profile → front.

### Model availability, which is not what the price list suggests
The free plan gates the **cheap** models, not the expensive ones. Failed creates cost
nothing, so mapping it was free:

| | |
|---|---|
| gated | `kling3_0_turbo` (7.5), `grok_video` (7.5), `kling2_6`, `seedance_2_0_mini` (12.5), `nano_banana` (1), `seedream_v4_5` (1), `kling_omni_image` (0.5) |
| allowed | `veo3_1_lite` (8 for 8s), `minimax_hailuo`, `nano_banana_flash` (1.5), `nano_banana_pro` (2) |

`veo3_1_lite` is the one that matters: it is the only affordable video model on the free
plan that accepts **both** a start and an end image, which is what makes a seamless loop
possible at all.

## 15. The chop, and the black  `[x]`

> "it goes black at the end for too long ... i feel there is a part of the animation you chop"

Both real, and both measurable.

**The chop is in the source clip, not the code.** `d037 -> d038` is a jump cut: the
waistcoat appears in a single frame, a **10.3** step against a 1.3 baseline. Seedance cut
instead of dressing him.
Fixed by spending frames that were doing nothing — d033 to d037 move by 0.5-1.3 each, so
d034..d041 are now flow interpolations from d033 to d042. Optical flow works here, where it
failed on the 360, because the pose barely moves; it is an occlusion, not a rotation.
**Largest single-frame step: 10.3 -> 4.55.**

**The black was not a frozen tail.** Checked that first — the sequence keeps moving to
d095. The real cause: once the white shirt is covered, the garment region drops from ~74 to
~44 mean luma, so the **whole back half** of the scroll reads as black against a bone page.
A gamma lift ramped in over the interpolated stretch raises mid-tones without moving the
black point or clipping highlights, so the lighting stays low-key rather than going flat.
**Back half: 44 -> 63.5.** Darkest frame in the sequence: **36.9 -> 54.9.**

**And the column stopped ending on a hard edge.** The horizontal dissolve killed the
rectangle's inner edge, but the column still finished as a hard horizontal band when the
section scrolled past. A vertical mask now fades the whole thing, dissolve included, at top
and bottom. The opaque stretch (5%-92%) is set to clear the frames at top:6vh / bottom:8vh,
so no frame edge is ever left hanging over a transparent part of its own ground.
Very-dark pixels across the section tail: **54.7% -> 50.7%, 50.0% -> 39.8%, 49.2% -> 38.7%,
27.0% -> 20.6%.**
