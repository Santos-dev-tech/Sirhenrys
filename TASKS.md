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

Ten credits on a fresh account (a personal Higgsfield login, deliberately not recorded
here). Spent as instructed: 4K pro first,
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


## 16. A way in, and a way home  `[x]`

> "there is no page saying sign in where am i supposed to sign in from"
> "the home page is too hard to navigate just add a home icon instead of the text"
> "make the log in and sign up buttons obvious but still blends in"

The staff sign-in page **was** rendering correctly — measured it before changing anything:
a 420x451 card, three staff buttons, PINs printed on it. The problem was never that it was
missing, it was that the only door to it was a small text link in the footer.

And for customers there was no sign-in at all. `#/account` simply listed orders.

- [x] **Home icon**, first item in the nav. Home was previously reachable only through the
      wordmark, which nobody reads as a button
- [x] **Sign in** in the header: person icon plus the word, in the same type treatment as
      the nav, no fill and no colour. It earns a border only on hover — findable without
      becoming the loudest thing on a page whose job is to show campaign photography
- [x] The control **states what it knows**: "Sign in" when nobody is, the customer's first
      name in bronze when somebody is
- [x] **Customer accounts** on Firebase Auth, email and password. One card, two tabs, both
      forms mounted at once so switching never loses what has been typed
- [x] "Staff? Open the staff console" at the foot of that card - the console is now
      reachable from the storefront without hunting

### Decisions worth keeping
- Customer auth is **separate from the staff gate**. Who may open the till and who a shopper
  is are different questions; conflating them is how a shop-floor login ends up reading the
  books.
- Signing out returns to **anonymous** auth rather than to none. `sync.js` needs a signed-in
  user for the Firestore rules to pass, so signing out of nothing would silently stop every
  write.
- Auth changes repaint through a single `SHAuth.onChange` subscription rather than at each
  call site. Signing out from the account page does not change the route, so nothing
  route-driven would have caught it.
- Firebase error codes are translated. `auth/operation-not-allowed` in particular tells you
  exactly which console switch to flip instead of showing a raw code.
- It degrades: no SDK, no project, or `enabled:false` and it keeps a local profile so the
  demo still behaves like a shop - and says "signed in on this device only" rather than
  pretending.

**Verified** by `tools/authtest.js`: a real round trip against the live project - account
created (`ok: true, local: false`, real uid), header switches to the first name, account
page shows the full name, sign-out returns to the form, and `syncStillOn: true` afterwards,
which is the assertion that the anonymous fallback took over. Tab switching keeps typed
input. Email/Password is already enabled on the project.

## 17. The shaky shirt-to-waistcoat transition  `[x]`

> "transition from shirt to waistcoat is shaky check it out"

My regression, from task 15. I had used optical flow to spread the source clip's jump cut
across eight frames. Flow works by **moving pixels**, and a waistcoat appearing is an
occlusion with no motion to track - so it invented warps, and the warps wobbled.

A cross-dissolve is the right tool for an occlusion. Measured across the same eight frames:

| | mean step | variation between steps |
|---|---|---|
| optical flow | 3.07 | 0.13 |
| **cross-dissolve** | **1.83** | **0.07** |

Lower on both, and it warps nothing at all. Largest single-frame step across the whole
transition is now **3.07**, against the source cut's 10.3 - and better than the 4.55 the
flow version managed.

Flow is still the right tool for the 360, where the pose genuinely rotates - it just failed
there for the opposite reason, too *much* motion. Both results are recorded so neither gets
tried the wrong way round again.


## 18. The console would not scroll  `[x]`

Entering `#/admin` called `Motion.stopScroll()`. The intent was to stop Lenis hijacking
the wheel over a till screen; the effect was that nothing scrolled at all. **Lenis owns the
page's scrolling**, so stopping it does not hand control back to the browser - it removes
scrolling. The console has been frozen since the merge.

- [x] Lenis keeps running on the admin route and smooth-scrolls the console
- [x] `.side` and `.dw` carry `data-lenis-prevent`, so the panels with their own
      scrollbars are not fought over

**Verified** by `tools/scrolltest.js`, which dispatches a **real wheel gesture** rather than
calling `scrollTo` - `scrollTo` succeeds even when the wheel is dead, so it would have
reported this bug as fixed while it was not. Inventory and Products both move 540px.
Orders reports `scrollable:false` because that view is shorter than the viewport.

## 19. The shop assistant  `[x]`

> "can you add ai using firebase and what would it help with and how would it function
> can it open tabs by itself or does it just give advice"
> "before doing any task research and find out if it is the best and most efficient way"

**It can act, but only inside this app.** A model in a web page has no access to tabs, the
OS, or anything outside the document. What it can do is call functions written for it. So
the answer to "opens tabs or just advises" is: neither, exactly - it drives *this* app, and
only through three doors that were built for it.

### The research, before writing anything

| Option | Verdict |
|---|---|
| Gemini REST from the page | **Rejected.** Needs an API key in the page. That key is billable and public the moment it ships. |
| Cloud Function proxy | **Rejected.** Blaze plan, deploy pipeline, another moving part - and no security gain over the option below, which already keeps the key off the client. |
| **Firebase AI Logic** | **Chosen.** Proxies through Firebase so the Gemini key never reaches the browser, needs no server, runs on the free tier. |

One constraint found the hard way and worth recording: **Firebase AI Logic ships ESM only.**
`firebase-ai-compat.js` returns 404 at every version checked (10.14.1, 11.10.0, 12.0.0,
12.3.0). But gstatic serves a browser-native ESM whose own imports are absolute URLs, so it
runs from a plain `<script type="module">` with no bundler - which is the whole point of
this project having no build step. That makes `ai.js` the only file fetched at runtime, and
it costs nothing that was not already lost: an assistant that talks to a model cannot work
offline. `bundle.py` strips it from the portable build.

### What it may do
Three functions, and the boundary is the point:
- `openScreen` - navigates the console, and refuses screens the signed-in role cannot open
- `proposeTransfer` - **drafts** a stock move as a card with a button. The write happens on
  the click, never on a model turn
- `draftMessage` - writes a reply for review. Nothing is ever sent

None of them touches money. The model is occasionally wrong, and being wrong about which
screen to open costs a click while being wrong about stock costs a count.

### Cost control
The snapshot sent each turn is deliberately small - only stock that is dead in one branch
and sitting in another, recent orders, alterations, corporate, fittings. The whole catalogue
would be most of the context window and most of the bill for questions that only ever
concern what is short, what is late and what is waiting. History is capped at 12 turns, the
function-call loop at 2 rounds, output at 700 tokens. `ai: false` in `firebase-config.js`
switches the whole thing off and nothing is billed.

**Verified** by `tools/aitest.js`: the launcher is **invisible on the storefront and visible
only in the console**, the SDK loads and builds `models/gemini-2.5-flash` with all three
tools registered, the panel opens with its suggestions, errors surface legibly in the log -
and the assertion that matters, **`stockUnchangedByModel: true`**: a full model turn changed
no stock.

### Blocked on one console switch
The Firebase AI API is not enabled on the project, so every question currently returns
`AI/api-not-enabled`. Open **console.firebase.google.com/project/sir-henrys/genai** and click
Get started. The error in the panel now names that exact URL rather than showing a raw code.

### 19a. Getting it to actually answer

Enabling AI Logic in the console was necessary but not sufficient. Three separate
problems, each of which looked like the previous one, and none of which was guessable:

**1. The SDK was too old.** On 12.3.0, `gemini-3.7-flash` fails with
`Cannot read properties of undefined (reading 'some')` - an internal parser crash. The
model answers; the old SDK cannot read the reply. On **12.18.0** the same call returns OK.
Worth knowing that an SDK failure and a model failure look nothing alike: a wrong model
name gives a clean 404 *from the server*.

**2. Every 2.x model is retired**, and the server says so itself:
`models/gemini-2.5-flash is no longer available to new users. Please update your code to
use models/gemini-3.6-flash`. `gemini-2.0-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`
and `gemini-1.5-flash` are all gone. Probed rather than assumed - `tools/modelprobe.js`
tries a list of names against the live project and prints each raw error.

**3. My own error mapping sent me the wrong way twice.** It matched on
`firebasevertexai.googleapis.com`, which is in the URL of **every** error, so a quota
refusal was reported as "the API is not switched on". Two rounds were spent chasing the
wrong fix. The patterns now match on status codes and reasons, never on the host, and
`state.lastRaw` keeps the untranslated text - a friendly message is worse than useless
when it is the wrong friendly message.

The real error, once visible: **HTTP 429**. The Gemini free tier allows **20 requests per
day, per model**. Probing had spent them.

- [x] SDK pinned to 12.18.0
- [x] Candidates are live names only: `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-flash-latest`
- [x] The request loop now falls through on **quota** as well as on a refused name - the
      20/day allowance is per model, so the next name is a fresh allowance rather than the
      same wall
- [x] The quota message states the actual limit and the retry delay, both parsed from the
      server's own reply, and the refused-model message surfaces the replacement the
      server names rather than guessing one

**Verified**: a real question answered from live shop data, having automatically fallen
through from `gemini-3.7-flash` (quota spent) to `gemini-3.6-flash`.

`tools/modelprobe.js`, `tools/toolprobe.js` and `tools/rawprobe.js` are kept. The second
isolates which *part* of a request a server objects to - model, tools, system instruction
or generation config - which is what proved the tools schema was innocent.

### 19b. "i dont see it"

The launcher existed, had `display:inline-flex`, had a click handler, and was invisible.
It had been inserted before `<div class="scrim" id="scrim">` - and there are **two** scrims
in this document, the storefront's and the console's. The replace matched the first, so the
whole assistant landed inside `#shop`, which the router hides on the admin route. Measured:
`parents: ["BUTTON#aiFab.ai-fab", "DIV#shop."]`, box `0x0` at `0,0`.

**The test was complicit.** `aitest.js` asserted `getComputedStyle(f).display !== 'none'`,
which is true of an element inside a hidden ancestor. It reported a launcher nobody could
see as visible. It now measures a real on-screen box - non-zero size, inside the viewport,
not `visibility:hidden` - and separately asserts the button is **not** inside `#shop`.

A second bug the move exposed: `renderLogin()` replaces the console with
`AD.innerHTML = ...`, so after signing in every element is new and every directly-bound
handler is gone. All of `ai-ui.js` now looks elements up when it needs them and delegates
clicks from `document`, so it survives the shell being torn down and rebuilt.
`clickWorks: true` asserts that specifically, after a sign-in.

Verified: storefront `onScreen:false`, console `onScreen:true` at `x:1329 y:836 89x42`,
`inShop:false` in both.

### 19c. Three more, all found by printing the raw error instead of trusting the mapped one

**"Stuck at Thinking..."** — `SHAI.ask` refuses a concurrent call, but the UI removed its
"Thinking..." placeholder only on the path that then never ran, so a second click while the
first was in flight orphaned it permanently. And nothing in the SDK promises to settle: a
dropped connection left the promise pending for ever. Now every wire call is raced against
a **25s** timeout, the whole question against a **70s** budget across all models, the
placeholder is removed in a `finally`, and a second question while one is running says so.

**"This project refused: gemini-3.7-flash, gemini-3.6-flash..."** was wrong, and wrong in
the same way as before. The real error:

```
[400] Role 'function' is not supported.
      Please use a valid role: SYSTEM, SYSTEM_1, USER, ASSISTANT, DEVELOPER, CONTEXT...
```

`isModelRefused` matched on `not supported` and blamed the model. It now requires the
message to mention a **model** at all before it will call something a model problem.

**And the underlying 400 is real**: `gemini-3.6-flash` rejects the function-response turn.
That would be maddening, because by then the work has happened - the screen is open, the
draft is on screen - and only the model's phrasing of it is lost. So the follow-up is now
three-deep: send the proper `functionResponse`; if the model rejects the role, say the same
thing as an ordinary **user** turn, which every model accepts; and only if that fails too,
report the outcomes plainly. The turn never fails after the work is done.

- [x] Candidates extended to four working models. Probed, not assumed: `gemini-3.6-flash`
      and `gemini-3.5-flash-lite` both answer; `gemini-3.7-flash-lite` does not exist.
      The free tier's 20/day is **per model**, so four names is four allowances
- [x] The panel now shows **what the server actually said** under any error, in a
      collapsed `<details>`. Three separate misdiagnoses came from trusting a friendly
      message over the raw one; a confident wrong message is worse than a raw right one

Verified: both previously-failing questions return `ok:true` and perform their action;
a timeout now reports itself in 25s instead of hanging.

**Quota note:** debugging this spent a large share of today's free-tier requests. If the
panel says the allowance is used up, it resets daily - or add billing in Google Cloud.


## 20. Won becomes a real order  `[x]`

Marking a corporate enquiry **Won** used to set a label and nothing else. It now creates
the order.

### The research was domain, not API
The obvious implementation - 120 order lines - is wrong, and the catalogue says why.
**Nobody knows 120 people's sizes when the contract is agreed.** Measuring is the next
step, and that is the entire reason an enquiry pipeline exists ahead of an order. So Won
creates **one** order carrying the headcount as its quantity and a size of
`To be measured`, which then moves through the workshop stages that already exist rather
than needing a parallel system.

Two smaller decisions from the same reading:
- The five garment options on the enquiry form are prose, not products, so each maps to
  the catalogue item that prices it. Blazer-and-trousers prices on the blazer, because
  that is the piece being tailored; a mixed programme prices as a two-piece, which is what
  such a programme mostly is.
- Payment is **Invoice**, not M-Pesa. A bank does not pay for 120 suits by STK push.

- [x] `SH.winCorporate(id)` creates the order, links it both ways (`c.orderId`,
      `order.corporate`) and stamps the discount and deadline into the workshop note
- [x] **Idempotent.** Clicking Won twice must not bill a client twice, so a second click
      returns the existing order
- [x] Order ids are checked against the list rather than derived from its length, which
      would collide once any order had been removed
- [x] The enquiry panel shows the order it became, its total and its current status

**Verified** by `tools/corptest.js` against the seeded Sidian Bank enquiry: 120 two-piece
suits become order `SH-10245` at **KSh 3,595,560** - `priceCorrect: true`, matching
120 x 39,950 less the 25% tier the customer was shown on the storefront - `idempotent: true`
across a second click, and `visibleInOrders: true`.


## 21. App Check  `[x]`

The Firebase config in this page is public - it has to be, the browser needs it. So anyone
can copy it into a script and call the project from anywhere. `firestore.rules` limits
**what** they can do; App Check limits **whether the request came from this site at all**.

It is also the thing gating a customer-facing assistant. A console behind a PIN can only
burn the Gemini quota three people at a time; a public page can be scripted until the free
tier is gone, or - with billing on - until the bill is not.

- [x] `firebase-app-check-compat.js` vendored, so this fits the existing pattern with no
      ESM gymnastics (checked: a compat build exists at every version, unlike AI Logic)
- [x] `appcheck.js` loads **before** data.js, sync.js and auth.js, and creates the Firebase
      app they reuse. App Check attaches a token to Firestore, Auth and AI Logic requests,
      so it has to be activated before any of them makes one
- [x] The assistant's ESM app is attested **separately**. Compat and ESM keep separate
      registries, so a token on one is invisible to the other - and Firebase enforces App
      Check on AI Logic, so without it the assistant would be the one service still
      rejected after everything else passed
- [x] Debug mode turns itself on for localhost. A local host cannot pass reCAPTCHA, and
      whitelisting localhost in reCAPTCHA would let anyone run a copy of the app from
      their own machine and pass attestation - so a per-machine debug token instead
- [x] Off by default and harmless when off: with no site key it says so in the console and
      changes nothing

### The two steps that are yours
1. **A reCAPTCHA key.** The link I first gave was dead, and the reason is worth recording:
   Google **retired** the old `google.com/recaptcha/admin` console and required every key
   to move to Google Cloud by the end of 2025. New keys are made at
   `console.cloud.google.com/security/recaptcha` -> Create key -> type **Website**. In that
   console the **"Key ID" is the site key**. Register the real domain, **not** localhost.

   A Cloud-made key is a reCAPTCHA **Enterprise** key, which needs a different SDK provider
   from a legacy v3 one - so `appCheckProvider` in `firebase-config.js` selects it, and
   defaults to `enterprise` because that is all anyone can make today. The wrong one fails
   loudly at activation rather than silently passing requests through unattested.
2. **Firebase console → App Check** → register this web app with that key, then **enforce**
   it per service (Firestore, Authentication, AI Logic). Registering alone changes nothing:
   until you enforce, unattested requests are still served. That is deliberate - it lets
   you watch the metrics before you start rejecting traffic.

**Verified** by `tools/appchecktest.js` in the unconfigured state, which is what ships:
SDK loaded, status explains itself, and nothing downstream is harmed - `syncOn: true` with
a real uid, auth ready, 72 products rendered, no errors.

That test also caught itself lying. A fixed 5s sleep reported `syncOn: false`, because
anonymous auth had not finished - a slow boot read as a broken one, the same mistake as
asserting on `display` in task 19b. It now waits on a condition.

### 21b. The key is in, and two things it broke

Key `6Lc0w5Ut...` for `sirhenrysdemosite.netlify.app`, provider `enterprise`. It activated
first try - `on:true, provider:enterprise` - and immediately broke two things that only
showed up because the test looks at the whole page rather than at App Check alone.

**`reCAPTCHA has already been rendered in this element`.** `appcheck.js` attests the compat
app and `ai.js` attested the ESM one, and both render reCAPTCHA into the same container.
The second render failed and took the first one's token with it, which killed Firestore
auth. Now only the compat app attests - it is the one carrying orders and stock - and
`ai.js` stands down when it sees `SHAppCheck.status().on`.

  *The cost, stated plainly:* AI Logic gets no App Check token, so **enforcement must stay
  OFF for AI Logic** until the assistant moves onto the same SDK as everything else.
  Firestore and Authentication enforce normally.

**A 403 that killed local development.** The debug token has to be registered by hand
before Firebase will accept it; until then the exchange 403s, and that cascades - Auth
cannot get a token, anonymous sign-in fails with `auth/network-request-failed`, and sync
dies with it. Trading a working local shop for attestation nobody outside the machine can
reach is a bad bargain, so **App Check is now off on localhost unless asked for**:
`?appcheck=1`, or `appCheckLocal:true`. It still activates automatically on the live
domain, which is the only place it does anything.

Verified after both fixes, on localhost: `syncOn:true` with a real uid, assistant ready,
72 products, **no errors**.

---

## 22. The launch checklist — 45 items, measured  `[x]`

Three videos, taken as a specification: twenty security items to do before launching,
twenty interface items to add to a website, five ways a hand-rolled login is not secure.
Everything below is verified by `tools/audittest.js`, which measures rather than asserts
and exits with the number of failures. **56/56 passing.**

    python tools/serve.py 8100
    node tools/audittest.js

### The one thing worth reading first

A browser cannot keep a secret from the person holding the browser. The PIN gate, the role
menu and the rate limiter are a **user interface** over the real enforcement, which is
`firestore.rules` running on Google's servers against a custom claim this page cannot mint.
Both are needed; only one is trustworthy, and `assets/js/security.js` says so at the top of
the file rather than implying otherwise.

The previous version's real failing was not that the rules were permissive. It was that
nothing on the running site admitted it. **The console now shows a warning bar on every
page while there is no staff claim on the account** — measured at 1144×63 above the till.

### Security — the twenty

| # | Item | Where | Measured |
|---|---|---|---|
| 1 | Hide API keys | `tools/secretscan.py` | working tree clean |
| 2 | Purge git secrets | `tools/secretscan.py --history` | every commit ever made, clean |
| 3 | Public DB key | `firebase-config.js` | it is an `AIza…` web key; no service account anywhere |
| 4 | Row-level security | `firestore.rules` | `/customers/{uid}` gated on `request.auth.uid == uid` |
| 5 | Encrypt sensitive data | `SHSec.secureSet` | AES-GCM 256; name and phone absent from the stored blob, round trip exact |
| 6 | Server-side auth | `firestore.rules` + `SHSec.serverGate` | staff custom claim, read back with `getIdTokenResult` |
| 7 | Lock record access | rules + `ROLE_VIEWS` | shop floor asking for settings gets "Not available" and sees 3 of 13 sections |
| 8 | Block field tampering | `SHSec.reprice` | a line claiming KSh 1 for a KSh 39,950 suit was caught and repriced; qty −5 removes the line |
| 9 | Secure session cookies | `SHSec.cookie` | `Path=/; SameSite=Strict`, `Secure` on https; no session token in a cookie |
| 10 | Hash passwords | `data.js` | no plaintext PIN ships; PBKDF2-SHA256 ×210,000 with a 128-bit salt each |
| 11 | Rate limit login | `SHSec.limiter` | locked out on attempt 5, lockout doubles each time |
| 12 | Bot protection | `SHSec.bot` | honeypot at x=−9999, aria-hidden, on 4 forms; filling it blocks the submit |
| 13 | Parameterise queries | `data.js` | search is `String.includes`; no regex built from input |
| 14 | Validate all input | `SHSec.validate` | bad email, short phone, 9,000 chars, `<script>` and an out-of-range number all refused |
| 15 | Escape user content | `SHSec.esc` | now covers `' / \`` too, and the assistant's card title — which was raw |
| 16 | Restrict file uploads | `SHSec.checkUpload` | magic bytes, not the extension: PNG-called-.php and PHP-called-.jpg both refused |
| 17 | Trim API responses | `ai.js` + `SHSec.redact` | Google no longer receives a customer name or phone number |
| 18 | Security headers | `_headers`, `firebase.json`, meta | 8 headers on both hosts; the CSP is identical in all three places |
| 19 | Force HTTPS | HSTS + CSP | 2 years, subdomains, preload-eligible, plus `upgrade-insecure-requests` |
| 20 | Scan dependencies | `tools/depscan.py` | every vendored file matches its recorded sha256; npm audit clean |

### The login — the five

1. **Session token.** `sessionStorage`, not `localStorage`. Keys are `exp iat id jti name
   role seen store title` — no PIN, hash, salt or secret inside. Expires after a shift,
   and after 15 minutes idle, checked on every render rather than on a timer.
2. **Client-side admin checks.** Still draws the console; no longer decides anything. The
   banner says which is in force.
3. **No second factor.** TOTP now — RFC 6238, six digits, thirty second step, built on
   WebCrypto. Measured: the right PIN alone issued nothing and asked for a code; a wrong
   code was refused; the live code signed in.
4. **No rate limiting.** Five tries per person, then a doubling lockout.
5. **No strength check.** A four-digit PIN cannot have one, so it is backed by the factor
   above instead of pretended at. Customer passwords get a real one, in `SHAuth.signUp`
   itself and not only on the form: `"password"` scores 1/4 and is refused.

### Interface — the twenty

Nine were already here and are now measured: search, mobile menu, loading, hover states,
scroll progress, sticky header, floating contact, form errors, print (console only).
Eleven are new: **dark mode** (three states — dark, light, and follow the system),
**consent banner** with two buttons of genuinely equal weight, **back to top**, **skip to
content**, **password visibility**, **UTM capture** (first touch *and* last touch, stripped
from the address bar), **form success states**, **confirmation dialogs**, **last updated**,
**FAQ accordions**, **copy buttons**, and a **print stylesheet for the storefront**.

### Two real bugs the measuring found

**The menu button did not exist on a phone.** `<button class="burger">` sat inside
`<nav class="nav">`, and `.nav` is `display:none` below 860px. Measured at 390px: **0×0**.
Clicking it in a test worked, because `.click()` works on a hidden element — which is
exactly why a test that only clicks proves nothing. It is a sibling of `.nav` now, 44×44.

**The consent bar was unreadable in dark mode.** Its background was `var(--ink)`, which
inverts to near-white, and its text was hard-coded light grey. Every number passed: right
height, two 40px buttons, choice persisted. Only looking at the screenshot found it. It has
its own four tokens now — and `tools/audittest.js` measures WCAG contrast in both themes so
the next one fails a build instead of a customer. Worst of twelve measurements: 4.93:1.

### Beyond the three lists

Clickjacking (frame-ancestors + X-Frame-Options + a frame-buster that fails closed),
session expiry and idle timeout, an audit trail, `.well-known/security.txt`, **zero inline
scripts** so `script-src` can stay `'self'` with no `unsafe-inline`, constant-time
credential comparison, PII redaction on the way to the model with rehydration on the way
back, 40px tap targets on every new control, a clean console under the CSP, and contrast
measured in both themes.

### What is still open, said plainly

- **`style-src` still carries `'unsafe-inline'`.** The storefront writes `style=""`
  attributes on rendered cards in a few dozen places and CSP cannot hash an attribute. It
  cannot execute anything, but it is the weakest line in the policy and it is the next one
  to fix.
- **`DEMO()` in `firestore.rules` is still `true`.** Deliberate, documented at the top of
  that file with the four steps to turn it off, and now visible on screen in the console.
- **three.js r144 and Firebase 10.14.1 are behind.** Both recorded in `tools/deps.json`
  with the reasoning; neither has a known exploit path in how this site uses them.
- **A four-digit PIN is ten thousand possibilities.** Hashing slows a grinder; it is the
  server claim that stops one.

---

## 23. Dark mode, done properly  `[x]`

The first pass at dark mode swapped six custom properties and shipped. Reported by the
user, in this order: the hero headline was invisible, then the nav was invisible, then
"just do a whole sweep and do better."

Both reports were the same bug. **A theme is only as deep as your tokens.** Swapping
custom properties reaches colours that were *written* as custom properties, and site.css
and admin.css hard-coded about seventy between them — a cream wash over the hero, a white
bar behind the sticky header, `#fff` on every filled button, `#fff` on every card in the
console. All of it invisible to the swap and invisible to a spot check.

### The tool first

`tools/darktest.js` walks **every route of both halves, in both themes, at 1440px and
390px**, and measures the WCAG 2.1 contrast of every element that paints text against the
first ancestor that paints a background. It composites translucent layers and `::before` /
`::after` scrims the way the eye sees them, and reports one line per unique signature so a
bad rule in ninety cards is one finding, not ninety.

    node tools/darktest.js            # dark only
    node tools/darktest.js --light    # both themes

**First run: 76 distinct failures.** The console was essentially unusable — white cards
with near-white text on every page of the till.

### What the fix actually was

Not more overrides. Both stylesheets were made **token-driven for every surface that has
to flip**, and the tokens were split by *what a surface is for*:

| token | what it is | light | dark |
|---|---|---|---|
| `--invert-bg/fg` | a small **filled control** — primary button, selected chip, tag, toast | dark fill, pale text | **pale fill, dark text** — a true inversion, because a dark-grey button on a dark-grey page reads as disabled |
| `--panel-bg/fg/mute` | a large **inverted surface** — footer, announcement strip, console sidebar, login backdrop | dark slab | **lifted dark panel** — a white footer across a dark page is a torch in the face |
| `--scrim-rgb` | the gradient that keeps the hero headline legible over the models | cream | near-black |
| `--glass-rgb` | the frosted bar the header becomes off the hero | white | near-black |
| `--surface` (console) | every card, panel, table, drawer and input | `#fff` | `#17150f` |
| `--room-bg` | the WebGL gallery — **and the shader's dissolve colour** | `#f2f0ec` | `#141210` |

Those were one token to begin with, and one of the two jobs had to be wrong whichever
value it took. That is what put a white footer under a dark page.

The room needed motion.js as well: distant figures are mixed into the page colour by a
shader uniform, so the CSS and the WebGL scene read the same custom property and
`Motion.retheme()` hands the new value over when the theme changes. Two literals had
already drifted.

### Three things it found that were never dark-mode bugs

- **`--ink-4` measured 2.92:1 on white.** It carries breadcrumbs, strikethrough prices,
  table headers and the brand line on every card — the smallest text on the site was the
  least readable, in the theme that has shipped for months. The muted end of the ladder is
  darkened: `--ink-3` `#6f6a65 → #5f5a55`, `--ink-4` `#9c9691 → #726c66`. Four distinct
  steps kept, all clearing 4.5:1 on white, on bone and on the gallery ground.
- **The console sidebar's section headings** were `#6d6862` on `#151515` — 3.6:1, in both
  themes.
- **The warn pill** was 4.17:1 on its own background.

### And three bugs in the tool itself, all found by it reporting things that were fine

1. It broke out of the ancestor walk on the first opaque background *before* checking that
   same element's `::after` and its `<img>` — so a category tile (opaque bone, photograph,
   dark gradient) reported as white text on bone.
2. It counted any absolutely-positioned pseudo-element as the backdrop. The nav's hover
   underline is a 1px `::after` filled with bronze, so every nav link came back at 2:1. A
   pseudo now only counts if it actually covers the text.
3. Text over photography has no single background colour. Where the site's answer is a
   gradient or a text-shadow, it is listed for the contact sheet rather than counted.

**Now: `PASS — every text element measured clears WCAG AA in dark and light`,** across 17
storefront routes, 9 console routes, two viewports, both themes. Screenshots via
`node tools/darkshot.js`, and they were looked at — the console login backdrop was still a
cream field with a dark card on it, which no number would ever have caught.

## 24. Two footer links that went nowhere  `[x]`

"Charity Programme" pointed at the top of `/about`, where the programme was one sentence in
the fourth paragraph. "Careers" pointed at the top of `/contact`, where the only careers
content was an option in a dropdown nobody scrolls to. Both technically worked. Neither
answered the question.

Rather than invent pages — inventing detail about a real Nairobi business's charity work or
hiring would be worse than a weak link — both now land on what already exists, in the state
that answers it:

- **Charity Programme** → `#/about?s=charity`, a real section with an id, built from the
  claim the page already made. A hash router cannot also use the hash for an anchor, so the
  section is named in the query and scrolled to after render. Measured: lands with the
  heading 147px into the viewport, just clear of the sticky header.
- **Careers** → `#/contact?subject=Careers`. The page retitles itself "Work with us",
  preselects the subject, and shows a short note about how the workshop actually hires.

---

## 25. The lookbook — and the reason it looked broken  `[x]`

Reported as "the background of the models is whitish and it looks confusing and bad".
The chroma key was the obvious suspect and it was not the cause.

### What was actually wrong

The dressing sequence on the home page is **97 frames of 1920×1101, 123KB each — 11.7MB** —
and every one was a plain `<img src>` in the markup. A browser opens six connections per
host, so those 97 requests formed a queue that everything else on the site sat behind.

**Measured**: with the sequence in flight, a plain `new Image()` for a 68KB plate
**timed out after 8 seconds, on localhost**. The lookbook's thirteen textures never
arrived, so the room drew un-textured planes. The "whitish backgrounds" were bare
rectangles, not a failed key.

Probing `Motion.rail()` showed all thirteen meshes with no image and `uKey` still at its
default. That was the moment it stopped being a shader problem.

### Four changes

1. **The sequence loads progressively.** Eight frames eager, the rest promoted from
   `data-src` three at a time, and a frame the scroll needs jumps the queue. While a needed
   frame is still coming the last one that arrived stays on screen, so the sequence
   degrades to a lower frame rate rather than to an empty stage. **11.7MB → ~1MB** on first
   paint.
2. **The room loads the card variants.** 760×1013 at 68KB rather than 1536×2048 at 450KB —
   **880KB for the set instead of 5.7MB**, and still more pixels than the plane uses.
3. **The key follows the ground gradient.** Measured across the plates, the studio ground
   runs 15–30 levels darker at the floor than the top and differs per plate. One sampled
   colour left the bottom of the rectangle at about 19% opacity — invisible on white, a
   grey slab on black. It samples a top and a bottom colour now and interpolates, and
   whatever survives is pushed toward the page colour so residue is correct in either theme.
4. **The floor falls into the room.** The cast shadow is *darker* than the ground
   (measured 153,156,150 against 193,201,203), so no colour key removes it — it is a
   gradient sitting between ground and garment, and keying it leaves a dithered fringe. A
   gradient over the canvas removes it outright, at any plate size or camera position, and
   it is the section's own idea: it is called "every garment in one light".

**Both themes gained.** Before this, one model rendered in either theme; now the whole rail
does. `node tools/roomkey.js` renders it in both and writes `_shots/roomkey-*.png`.

### Three bugs found on the way

- **`&middot;` was double-escaped** — `roomHTML` runs its subtitle through `esc()`, so the
  page read `THE ROOM &MIDDOT; EVERY GARMENT IN ONE LIGHT`.
- **The media-query dark block was missing `--room-bg`.** A visitor whose system is dark and
  who never touched the toggle got a white gallery in a black page. Two blocks that have to
  stay identical is a standing hazard.
- **`color-mix()` silently killed the whole rule.** The first floor gradient used
  `color-mix(in srgb, …)`. An unsupported CSS function does not degrade — it invalidates the
  entire declaration, so the fade did not exist and nothing changed on screen through three
  rounds of tuning. Written as `rgba(var(--room-rgb), …)` now.

## 26. WhatsApp — the channel that matters here  `[x]`

The research is unambiguous: a comparable Kenyan fashion brand reported **70% of all orders
arriving on WhatsApp**, and 64% of online adults say they would rather message a business
than visit a shop. See `RESEARCH.md` section B.

The bag message was already right — `waBasket()` writes every line with its size, quantity
and price, and the total. Three things were not:

1. **The product page's link was built once at render with an empty size.** A customer who
   chose a 52 and tapped "Ask about this on WhatsApp" sent a message that did not mention
   52, so the shop had to ask — the exact friction a prefilled message exists to remove.
   It follows the size selection now.
2. **Neither message carried a reference.** An assistant reading "I would like to order" had
   nothing to type into the console to find that person again. Both carry `Ref SH-Wxxxxx`,
   fresh per message.
3. **Every enquiry went to the CBD number.** `settings.whatsapp` holds a number per branch
   and every call site passed `null`. Meanwhile the app already knows, live and per branch,
   which store is holding a 52. The link now goes to the branch with the most stock in the
   chosen size and the message names it: *"I can see it at Westgate Mall. Could you hold
   one?"*

**Verified**: `node tools/watest.js` — 10/10, including that the routed number differs from
the CBD default and that two messages never share a reference.

## A note on running these harnesses

They drive a real Chrome against a single-process Python server and pull a few hundred
images per run. **On a loaded machine they produce failures that are not real** — a stalled
navigation reads as a missing element, and a mid-flight CSS transition reads as a contrast
failure. Three separate "regressions" during this work were the machine, not the code.

If a run fails, before believing it:

    Get-Process chrome | Stop-Process -Force      # stray instances from earlier runs
    # restart python tools/serve.py
    # then run it again

`audittest.js` retries itself once if the browser crashes. All the navigation timeouts are
raised to 120s. A failure that survives a clean re-run is real; one that moves between runs
is not.

---

## 27. Continue with Google  `[x]`

The providers were switched on in the Firebase console and nothing in the app ever
called them. `auth.js` knew `createUserWithEmailAndPassword` and
`signInWithEmailAndPassword` and nothing else, so the only way into an account was
to invent a password.

**The card now leads with Google** and offers email underneath, because one tap with
an account you already have beats a password you have to make up — and this audience
signs in to everything else that way.

### What went in

- `SHAuth.signInWithGoogle()` — **popup first**, because a popup keeps the page and
  the bag exactly where they are. A browser that refuses popups, or any in-app
  browser (Instagram, Facebook) that refuses them silently, falls back to a full
  redirect rather than dead-ending. `getRedirectResult()` picks that up on the way
  back, and anything that failed there surfaces on the card.
- `prompt: 'select_account'` every time. Without it a shared counter laptop signs the
  second person in as the first, which in a shop is not hypothetical.
- Provider-specific errors in `readable()`: popup blocked, unauthorised domain (with
  the exact console path and the hostname to add), and
  `account-exists-with-different-credential`, which is the one that confuses people.
  A cancelled popup says **nothing** — they changed their mind, that is not an error.
- The server's own words under a collapsed toggle beside the friendly message, the
  same as the assistant panel does, for the same reason.

### Three things that would have made the button silently do nothing

None of these are auth errors, and none reach an error handler — which is why they
are the ones worth writing down:

1. **`script-src` did not allow `apis.google.com`.** Firebase Auth loads gapi from
   there for the popup flow.
2. **`frame-src` did not allow `accounts.google.com`.** The account chooser is an
   iframe; the project's own authDomain was already allowed and serves
   `/__/auth/iframe`.
3. **`Cross-Origin-Opener-Policy: same-origin` severs `window.opener`** — which is
   precisely the channel `signInWithPopup` uses to hand the credential back. Set
   strictly, the window opens, the user signs in, and nothing ever returns. It is
   `same-origin-allow-popups` now: still no other origin can open us and keep a
   handle, but a popup we opened can answer.

All three CSP copies (`_headers`, `firebase.json`, the meta tag) were edited from the
header's value, and `tools/audittest.js` still confirms they agree.

**Verified:** `node tools/googletest.js` — 10/10. It intercepts the SDK call to read
the provider the app builds (`google.com`, scopes `profile email`,
`prompt=select_account`), checks the policy from the files, and asserts a failure
produces both a message and the raw error rather than a dead button.

**The last step is manual and the harness says so** rather than implying it is
covered: open `#/account`, press the button, and sign in with a real account. If it
reports an unauthorised domain, add the host in Firebase console → Authentication →
Settings → Authorised domains.

---

## 28. The Quoted chip left a message on the screen  `[x]`

Reported: pressing **Quoted** in Corporate & Bulk put a message at the bottom of the
window and it never went away.

Two faults feeding each other, and neither was in the button:

1. **`.ad .notice` is `position:fixed` — it IS the toast.** The corporate panel
   rendered its "Won · became order SH-xxxxx" line with that same class, so a line
   that reads in the markup as part of the panel was a second toast nailed to the
   window, re-rendered with `on` every repaint.
2. **`toast()` found its element with `document.querySelector('.notice')`** — the
   first one anywhere in the document. Once that banner existed it won, so the toast
   wrote its text into the banner, `render()` then destroyed that node, and the 2.4s
   timer cleared something no longer on the page while a fresh copy sat there.

**Measured before:** after pressing Won, two `position:fixed` `.notice` elements at
y=881 and y=897, one of them inside `#view`.

Fixed: `toast()` owns one element (`.ad-toast`) and **holds a reference to it**
rather than looking it up by class, kept on `AD` so it outlives the render that
raised it. The banner became `.wonbar` — a static line inside the panel, which is
what it always meant to be.

**Verified:** `node tools/toasttest.js` — 7/7, including that nothing inside `#view`
is `position:fixed`, which is the shape of the bug rather than this instance of it.

### And the scanner learned a severity

Adding a personal-email rule to `secretscan.py` turned the audit's "purge git
secrets" check permanently red over two Gmail addresses in *history*. A leaked
service-account key and a personal address are not the same problem — one ends your
week, the other needs a decision about rewriting history — and this file's own
docstring says a scanner nobody reads has stopped working. Credentials fail the run
now; privacy findings are reported loudly and do not.
