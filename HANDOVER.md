# Handover — state as of 2026-08-24

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
2. **`firestore.rules` is demo-grade.** It only requires *a* signed-in user, and everyone
   is anonymous, so anyone who loads the site can write to the books. The three steps to
   fix it are in that file's header; `tools/set-staff-claims.js` does step 2.

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

**~0.77 left** on `nuts17615@gmail.com`. Two hard-won facts:
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
