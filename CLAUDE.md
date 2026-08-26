# Working on Sir Henry's

Read `HANDOVER.md` first — it carries the live URLs, the Firebase state and the one open
problem. This file is the shorter thing: how to work in here without breaking something.

---

## Run it

```bash
python tools/serve.py 8100        # then http://localhost:8100
```

**Node is portable and not on PATH.** Nothing in `tools/` runs without it:

```powershell
$env:Path="C:\Users\ADMIN\nodejs-portable\node-v22.16.0-win-x64;$env:Path"
```

Python 3.13 with Pillow, NumPy and OpenCV **is** on PATH. LibreOffice is not, so the
`.pptx` cannot be rendered for visual QA on this machine.

---

## The gates

Run these before saying anything is finished. Each exits with its failure count.

| | |
|---|---|
| `node tools/audittest.js` | 56 checks — security, interface, the login |
| `node tools/darktest.js --light` | WCAG contrast, every route, both themes, two viewports |
| `node tools/watest.js` | 10 checks — the WhatsApp channel |
| `node tools/googletest.js` | 10 checks — Continue with Google, and the CSP/COOP it needs |
| `node tools/toasttest.js` | 7 checks — the console toast, and the banner it collided with |
| `node tools/vptest.js` | the layout viewport equals the phone's width, 5 widths, both halves |
| `node tools/stickytest.js` | the sticky header and the scroller survived `overflow-x:clip` |
| `node tools/tilltest.js` | the till stacks on a phone, 5 widths, signed in through `signin.js` |
| `python tools/secretscan.py --history` | credentials, working tree and every commit |
| `python tools/depscan.py` | vendored libraries against their recorded hashes |

And the ones that produce something to **look at**, because numbers do not catch a colour:

| | |
|---|---|
| `node tools/darkshot.js` | `_shots/dk-*.png`, both halves, dark |
| `node tools/roomkey.js` | the lookbook in both themes |
| `node tools/auditshot.js` | everything the security pass added |
| `node tools/phoneshot.js` | `_shots/ph-*.png`, header and drawer, 3 phone widths, both themes |
| `node tools/tillshot.js` | `_shots/till-*.png`, the till with a **filled** basket, both themes |

**A failing run is not evidence until it survives a clean re-run.** These drive a real
Chrome against a single-process Python server. On a loaded machine a stalled navigation
reads as a missing element and a mid-flight CSS transition reads as a contrast failure.
Three "regressions" chased on 2026-08-25 were all the machine. Clear stray instances first:

```powershell
Get-Process chrome | Stop-Process -Force
```

---

## How this is built

No framework, no build step. `index.html` holds **both** apps: `#shop` is the storefront,
`#ad` is the staff console at the route `#/admin`. Each router hides the other's subtree.
`admin.html` is only a redirect.

| file | what it owns |
|---|---|
| `assets/js/data.js` | the model — products, stock, orders, `SHARED`/`DEVICE` state split |
| `assets/js/app.js` | the storefront: views, router, forms |
| `assets/js/admin.js` | the console: till, orders, inventory, the staff gate |
| `assets/js/motion.js` | Lenis scroll, the WebGL room, the dressing sequence |
| `assets/js/security.js` | escaping, validation, hashing, TOTP, rate limits, redaction |
| `assets/js/ux.js` | page furniture: theme, consent, toasts, dialogs, accordions |
| `assets/js/sync.js` | Firestore, degrading to localStorage |
| `assets/css/site.css` | the storefront |
| `assets/css/admin.css` | the console — **every rule scoped under `.ad`** |
| `assets/css/ux.css` | what belongs to the page rather than to either app |

---

## Rules that exist because something broke

**Never write a literal colour in `site.css` or `admin.css`.** Dark mode is a swap of custom
properties, and a swap only reaches colours written as custom properties. Seventy hard-coded
ones produced 76 contrast failures and an unusable console. Know which token you want:

- `--paper` / `--bone` / `--surface` — the page and its raised surfaces
- `--ink` / `--ink-2` / `--ink-3` / `--ink-4` — the text ladder
- `--invert-bg` / `--invert-fg` — a **small filled control**: button, selected chip, tag.
  In dark this is a pale fill with dark text.
- `--panel-bg` / `--panel-fg` / `--panel-mute` — a **large inverted surface**: footer,
  announcement strip, console sidebar. In dark this is a lifted dark panel, *not* an
  inversion. A white slab across a dark page is a torch in the face.
- `--scrim-rgb` / `--glass-rgb` / `--room-rgb` — washes, as channels

The dark palette lives in `ux.css` in **two** blocks — `[data-theme="dark"]` and the
`prefers-color-scheme` media query. They must stay identical; a token added to one and not
the other is invisible until somebody with a dark laptop opens the site.

**`admin.css` is scoped under `.ad`. Never add an unscoped rule to it**, and never let
anything in the console touch `document.body` — that once deleted the storefront.

Scoping is not only about leaking outward. An unscoped rule in here is usually a **dead**
rule, because almost everything it would override is already `.ad `-prefixed and therefore
more specific — and a media query adds no specificity. `@media(max-width:1000px){.pos{...}}`
lost to `.ad .pos{grid-template-columns:1fr 400px}` for as long as it existed, so the till
stayed two columns on a phone: measured on a 375px screen it computed to `102.609px 400px`,
the scan field 61px wide and the 400px basket hanging 162px off the side of the screen.
`tools/tilltest.js` reads the *computed* grid rather than trusting the stylesheet.

**`SHARED` syncs to Firestore, `DEVICE` stays local.** Carts and the signed-in till user
must never sync.

**Measure, do not eyeball — and then look anyway.** Every visual claim in `TASKS.md` has a
number behind it. Three traps this project has actually fallen into:

1. `display !== 'none'` passes for an element inside a hidden parent. Banned. Read a box.
2. `.click()` works on a `display:none` element. The mobile menu button "passed" for weeks
   while measuring **0×0** and no customer could open the menu.
3. Numbers alone missed a colour bug — the consent bar was the right size with the right
   buttons and unreadable. The contact sheet caught it.

**Print the raw error.** Show the server's own words alongside any friendly message, and
diagnose from the raw text. Three misdiagnoses in one session came from pattern-matching a
mapped message.

**`assets/img/room/*.webp` and `assets/spin/*/cut/*.webp` are generated.** Do not hand-edit
them; run `python tools/matte.py` and `python tools/matte.py --spin`. The head of that file
explains why the cut is done offline rather than in a shader.

**Never let the header stop shrinking.** It measured 575px wide on a 375px phone and
mobile Chrome answered by widening the *layout viewport* to 607px. Percentages then
resolve against 607, so `.mnav{inset:0 30% 0 0}` drew a 425px drawer on a 375px screen -
a nav wider than the page. `html`/`body` carry `overflow-x:clip` as a backstop (clip, not
hidden - hidden on one axis forces the other to `auto`, which makes the root a scroll
container and kills `position:sticky` and Lenis), but the backstop only hides a header
that has stopped fitting. `tools/vptest.js` is the gate, and it compares `innerWidth`
against the **device** width - comparing it against the document is what let this sit
unnoticed, because the viewport had already grown to match.

**Watch what goes in the `pointer:coarse` block.** `.ftr a,.mnav a{display:inline-block}`
was meant to enlarge tap targets and did the opposite to the drawer: it ran the menu into
one paragraph and made each target only as wide as its own text. A stacked list wants
`block`.

**Run `python tools/stamp.py` before every deploy** or the footer's date is one deploy stale.

---

## The staff console

The gate is two steps: a PIN checked against a PBKDF2 hash, then a TOTP code. **Any harness
that signs in must go through `tools/signin.js`** — typing a PIN into `#pinInput` is no
longer enough. Demo PINs are 1967 / 2468 / 1357 and the live code is shown on the login card
while `SH_SECURITY.demoHints` is true in `security.js`. Turn that off for a real deployment.

None of that is the security boundary. `firestore.rules` is, and it is still in demo mode on
purpose — the console shows an amber bar saying so on every page. The four steps to turn it
off are at the top of the rules file.

---

## Customer sign-in

Google first, email underneath. `SHAuth.signInWithGoogle()` opens a popup and falls back
to a full redirect where popups are refused; `getRedirectResult()` picks that up.

Three things will make that button **silently do nothing**. None of them is an auth error,
so none of them reaches an error handler — which is why they are worth knowing:

- `script-src` must allow `https://apis.google.com` (Firebase Auth loads gapi from there)
- `frame-src` must allow `https://accounts.google.com` and the project's authDomain, which
  serves `/__/auth/iframe`
- **COOP must be `same-origin-allow-popups`**, not plain `same-origin`. Plain same-origin
  severs `window.opener`, which is precisely how `signInWithPopup` hands the credential
  back: the window opens, the user signs in, and nothing ever returns.

If sign-in reports an unauthorised domain, add the host in Firebase console →
Authentication → Settings → Authorised domains.

## Deploying

```bash
wrangler pages deploy . --project-name=sirhenrys --branch=main --commit-dirty=true
firebase deploy --only hosting
```

Cloudflare is the one to use. Repo: https://github.com/Santos-dev-tech/Sirhenrys

---

## What the client actually is

`RESEARCH.md` has the sourced version, and the first section matters before any meeting:
**they were founded in 1960, not 1967**, and the demo says 1967 in twelve places including
the wordmark. The store list is wrong too. Neither has been changed — both are decisions
about a real company, not code.

---

## How Zain wants this worked on

- **Research before acting.** Check whether the approach is the best one, not just one that
  works. It has caught real things — Cloudflare over Firebase for bandwidth, Firebase AI
  Logic over a Cloud Function, cross-dissolve over optical flow.
- **Plain English, short.** UK spelling.
- **Do not quietly "fix" the open problem** in `HANDOVER.md`. It was a decision.
