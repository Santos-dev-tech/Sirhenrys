# Handover — state as of 2026-08-24 (security pass)

Read `TASKS.md` for how each thing was built and verified. This file is only what a new
session needs to pick up without re-deriving anything.

---

## What this is

A storefront **and** a staff console for **Sir Henry's Limited** (Nairobi menswear tailor,
est. 1967), built as a pitch against their current Shopify site. No build step, no
framework. `python tools/serve.py 8100`, then `http://localhost:8100`.

**One app, two halves.** `index.html` holds `#shop` (storefront) and `#ad` (console). The
console is the route **`#/admin`**; `admin.html` is only a redirect. Each router hides the
other's subtree.

---

## Live deployments

| URL | Notes |
|---|---|
| **sirhenrys.pages.dev** | **Cloudflare Pages — use this one.** Unlimited bandwidth |
| sir-henrys.web.app | Firebase Hosting. 360 MB/day. An older build |
| sirhenrysdemosite.netlify.app | Netlify, out of credits, deploys paused. Oldest build |

Deploy to Cloudflare: stage a copy, then
`wrangler pages deploy . --project-name=sirhenrys --branch=main --commit-dirty=true`.
Deploy to Firebase: `firebase deploy --only hosting` from `sirhenrys/`.

Repo: https://github.com/Santos-dev-tech/Sirhenrys — everything is pushed.

---

## Environment gotchas

- **Node is portable and not on PATH**: `C:\Users\ADMIN\nodejs-portable\node-v22.16.0-win-x64`.
  Nothing in `tools/` runs without prepending it.
- **LibreOffice is not installed**, so `.pptx` cannot be rendered for visual QA here.
- Higgsfield CLI lives at
  `%LOCALAPPDATA%\nodejs-portable\node-v24.19.0-win-x64\node_modules\@higgsfield\cli\vendor\hf.exe`.

---

## Firebase (project `sir-henrys`)

- **Firestore** syncs the shared half of state; `localStorage` keeps the per-device half.
  The split is in `data.js` as `SHARED` / `DEVICE` and is deliberate — carts and the
  signed-in till user must never sync.
- **Auth**: anonymous for everyone, plus email/password customer accounts (`auth.js`).
- **App Check**: reCAPTCHA Enterprise, key `6Lc0w5UtAAAAABh2HXN9j6ILI60zAlGTbC6Lbq9u`,
  four domains registered. **Off on localhost** unless `?appcheck=1` — enabling it there
  403s and cascades into Firestore auth dying.
- **AI Logic**: enabled. `gemini-3.7-flash`, with three fallbacks.

### Two things NOT done
1. **App Check is not enforced.** Deliberate — wait, watch the metrics, then enforce on
   **Firestore and Authentication only**. See the open problem below before enforcing AI Logic.
2. **`firestore.rules` is still in demo mode.** `DEMO()` at the top of that file returns
   `true`, so any signed-in user — and everyone is signed in anonymously — can write the
   books. Still deliberate for a pitch on invented data. What changed is that **the console
   now says so on screen**: an amber bar sits above every page of the till while there is no
   staff claim on the account. The four steps to turn it off are at the top of the rules
   file; `tools/set-staff-claims.js` does step 2.

---

## Security and interface pass — 45 items, 56 checks

Everything on three checklists (20 security, 20 interface, 5 login) plus twelve extras.
**56/56 passing.** Full write-up with the numbers is task 22 in `TASKS.md`.

    python tools/serve.py 8100
    node tools/audittest.js          # exits with the number of failures

**New files:** `assets/js/security.js` (the security layer), `assets/js/ux.js` (page
furniture), `assets/css/ux.css`, `assets/js/boot.js` (was an inline script — moving it out
is what lets `script-src` be `'self'` with no `unsafe-inline`), `assets/js/build.js`
(generated), `.well-known/security.txt`.

**New tools:** `audittest.js` (the audit), `auditshot.js` (screenshots of all of it),
`secretscan.py`, `depscan.py` + `deps.json`, `stamp.py`, `signin.js`.

**Things that changed behaviour, so nobody is surprised:**

- **The staff console has a second factor.** PIN, then a six-digit TOTP code. Demo PINs are
  unchanged (1967 / 2468 / 1357) and the live code is shown on the login card while
  `SH_SECURITY.demoHints` is `true` in `security.js`. Turn that off for a real deployment.
- **Staff PINs are no longer in the bundle** — `data.js` carries PBKDF2 hashes and TOTP
  secrets. Six older harnesses now sign in through `tools/signin.js`.
- **A staff session expires** after a shift and after 15 minutes idle.
- **Customer passwords have a policy** (10+ characters, must reach "Fair"), enforced inside
  `SHAuth.signUp` and not only on the form.
- **The assistant no longer sends customer names or phone numbers to Google.** Names go out
  as "Customer 01" and are put back before anyone reads the reply.
- **Run `python tools/stamp.py` before every deploy** or the footer's "last updated" date is
  the date of the deploy before.

**Two real bugs the measuring found, both now fixed:** the mobile menu button measured
**0×0** on a phone (it was inside `.nav`, which is `display:none` below 860px — clicking it
in a test still "worked", which is why clicking proves nothing), and the consent bar was
**unreadable in dark mode** (its background followed `--ink`, which inverts). The audit now
measures WCAG contrast in both themes.

**Still open, deliberately:** `style-src` keeps `'unsafe-inline'` because the storefront
writes `style=""` attributes on rendered cards and CSP cannot hash an attribute; three.js
r144 and Firebase 10.14.1 are behind, both recorded in `tools/deps.json` with reasons.

---

## Dark mode — and the rule that comes with it

There are now **two** standing gates. Run both:

    node tools/audittest.js          # 56 security/interface checks
    node tools/darktest.js --light   # contrast, every route, both themes, two viewports

`darktest.js` walks 17 storefront routes and 9 console routes at 1440px and 390px and
measures WCAG contrast on every element that paints text. It found 76 failures on its first
run; the console was unusable in dark. Both themes pass now.

**The rule, because it will come up again the first time anyone adds a colour:**

> A theme is only as deep as its tokens. Swapping custom properties reaches colours that
> were *written* as custom properties, and nothing else.

So: **never write a literal colour in site.css or admin.css.** The tokens to reach for:

- `--paper` / `--bone` / `--surface` — the page and its raised surfaces
- `--ink` / `--ink-2` / `--ink-3` / `--ink-4` — the text ladder
- `--invert-bg` / `--invert-fg` — a **small filled control** (button, selected chip, tag,
  toast). In dark this is a pale fill with dark text.
- `--panel-bg` / `--panel-fg` / `--panel-mute` — a **large inverted surface** (footer,
  announcement strip, console sidebar, login backdrop). In dark this is a lifted dark
  panel, *not* an inversion.
- `--scrim-rgb` / `--glass-rgb` — the hero wash and the frosted header, as channels
- `--room-bg` — the WebGL gallery. **motion.js reads the same property** for the shader
  uniform that distant figures dissolve into, and `Motion.retheme()` hands it over on a
  theme change. Change it in one place or the two drift.

Those last two token pairs were one pair to begin with, and one of the two jobs had to be
wrong whichever value it took. That is what put a white footer under a dark page.

**Three pre-existing light-theme failures came out of the same sweep** and are fixed:
`--ink-4` measured 2.92:1 on white (it carries breadcrumbs, strikethrough prices and table
headers), the console sidebar's section headings measured 3.6:1, and the warn pill 4.17:1.
The muted inks are darkened; the four steps of the ladder are kept.

Screenshots: `node tools/darkshot.js` writes `_shots/dk-*.png`. Look at them — the console
login backdrop was still a cream field with a dark card on it after every number passed.

**Two footer links** that pointed at pages which did not answer them now land properly:
Charity Programme goes to `#/about?s=charity` (a real section, scrolled to after render,
because a hash router cannot also use the hash for an anchor) and Careers to
`#/contact?subject=Careers` (retitles the page and preselects the subject).

---

## Obsidian

Installed 2026-08-25 via winget at `%LOCALAPPDATA%\Programs\Obsidian\Obsidian.exe`.
Claude's memory folder is registered as a vault, so it appears in the vault list on first
launch: **Start Menu → Claude Brain (Obsidian)**. Nothing in this repo depends on it.

---

## THE OPEN PROBLEM — the shop assistant times out

`SHAI.ask()` returns *"Timed out after 25s"* on the live site. Diagnosed this far:

- App Check `on`, AI ready, model resolves. Not a quota or model-name problem.
- The network trace shows `generateContent` returning **HTTP 200** — the server answers.
- Timed directly: a bare "say ok" took **180s** then failed; with thinking turned down,
  **55s** then a **500**.

Two candidate causes, not yet separated:

1. **My timeout is too short.** I lowered `TIMEOUT_MS` 45s → 25s to bound the four-model
   fallback. That alone makes a slow-but-working request look broken.
2. **App Check.** When I fixed a double-reCAPTCHA bug, `ai.js` was made to *stop* attesting
   its own ESM app when the compat app already had a token — the two SDKs keep separate
   registries and both providers render reCAPTCHA into the same container, and the second
   render was killing the first one's token and taking Firestore auth with it. The cost,
   flagged at the time: **AI Logic gets no App Check token.**

**The test that settles it** (`tools/abtest.js`, written but never run — the user stopped it):
ask the same question on `sir-henrys.web.app`, which predates `appcheck.js`, and on
`sirhenrys.pages.dev`, which has it. If one answers and the other does not, App Check is
the cause. Alternatively just look at **Firebase console → App Check → APIs**: if AI Logic
says *Enforced*, that is the answer.

The user's instruction was to **leave it** and present the assistant as a paid extra. The
deck already does exactly that, honestly. Do not quietly "fix" this by raising the timeout
without establishing which cause it is.

---

## The pitch (`pitch/`)

- `Sir-Henrys-Proposal.html` — **21 slides**, one self-contained file, images embedded so
  it works with no network. Arrow keys, F for full screen. Rebuild: `python deck.py`.
  Published at https://claude.ai/code/artifact/5f1c3123-4342-4457-ba60-2758c0ca1350
- `Sir-Henrys-Proposal.pptx` — same argument in PowerPoint. Rebuild: `node build.js`.
  **Never visually checked** — no LibreOffice on this machine.
- Pricing pitched: **KSh 50,000 setup + KSh 50,000/month**.
- Audit figures behind it are in `pitch/README.md`, with where each came from.

---

## Higgsfield credits

**~0.77 left.** The account is a personal Higgsfield login - deliberately not written
down here; ask Zain. Two hard-won facts:
- The free plan gates the **cheap** models, not the expensive ones.
- A turnaround costs **8 credits** (veo3_1_lite, 8s, start *and* end image to force a loop).
  Eleven of thirteen room garments are still flat plates.

---

## Working agreements this user has made explicit

- **Research before acting.** Check whether the approach is the best one, not just one
  that works. This was asked for repeatedly and it caught real things — Cloudflare over
  Firebase for bandwidth, Firebase AI Logic over a Cloud Function, cross-dissolve over
  optical flow.
- **Measure, don't eyeball.** Every visual claim in `TASKS.md` has a number behind it.
- **Print the raw error.** Three separate misdiagnoses this session came from trusting a
  friendly mapped message over the server's own words. The assistant panel now shows the
  raw text under every error for exactly this reason.
- **Plain English, short.** The user found long explanations hard to follow and said so.
  UK spelling.
