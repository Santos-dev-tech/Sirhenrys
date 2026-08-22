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
