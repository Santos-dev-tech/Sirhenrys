# Research — the real Sir Henry's, and what would make this sell

Living document. Started 2026-08-25. Everything here is sourced; where a claim is an
assumption it says so, because the pitch already turns on being straight about what is
known and what is not.

---

## 1. Four things in the demo that do not match the real business

These matter more than any feature. Walking into a meeting with the client's own founding
year wrong undermines every number that follows it.

### 1.1 The founding year is wrong — 1960, not 1967

Their own About page opens: *"Established in 1960, we have spent decades perfecting one
purpose."* The demo says **1967** in twelve places, including the wordmark in the header of
every page, the favicon, the deck and the .pptx.

    $ grep -ro "1967" assets/js index.html | wc -l

**This is the single highest-value fix before the next meeting.** It is also the cheapest.
Not changed unilaterally, because it is a factual claim about a real company and rebranding
their logo line is Zain's call, not mine — but it should be changed.

Where it lives: `index.html` (wordmark ×2, favicon `<title>`), `assets/js/app.js` (hero
eyebrow, about copy, footer), `pitch/deck.py`, `pitch/build.js`.

### 1.2 The store list is wrong

| Demo | Real |
|---|---|
| Kimathi Street, Nairobi CBD | ✅ Old Mutual Building, Kimathi Street |
| Westgate Mall, Westlands | ✅ Westgate Shopping Mall |
| Two Rivers Mall, Ruaka | ❌ does not exist |
| Nyali Centre, Mombasa | ❌ does not exist — they are Nairobi-area only |
| — | ❌ missing: Junction Mall |
| — | ❌ missing: Thika Road Mall |
| — | ❌ missing: The Beacon Mall |

Five stores, not four, and the demo invents a coastal branch. Note the pitch already
prices Shopify POS Pro at **five** stores — so the deck's own arithmetic assumes five while
the app shows four.

Not changed unilaterally either: branch ids (`cbd`, `west`, `rivers`, `msa`) are woven
through stock, transfers, orders and sales, so it is a small data migration rather than a
find-and-replace, and it changes every stock figure on screen.

### 1.3 The positioning may overstate what they do

The demo leans hard on bespoke: *"Three generations of tailoring on Kimathi Street"*,
*"we still cut on the same street"*, a made-to-measure configurator, *"four weeks from
chalk to hanger"*.

Their own copy says **"precision tailoring, premium fabrics"** on curated collections —
i.e. ready-to-wear, well cut, altered in store. Third-party listings describe them as
importing from European houses (Ungaro, Baumler, Odermark, Pecorari). No source found
claims they cut bespoke in house.

This is not fatal — made-to-measure is a plausible *proposal*, and the deck can pitch it as
new revenue rather than as something they already do. But it should be pitched as **"here
is a service you could add"**, not narrated as their history. Getting that wrong in the
room reads as not having done the homework.

### 1.4 The catalogue is narrower than theirs

The demo has suits, shirts, casual, accessories. Their site also carries **shoes, bags,
belts, socks, ties, cufflinks, underwear and perfume**, and merchandises by occasion
(prom, work, graduation, church) and by fit (regular/slim). The occasion navigation is
already mirrored in the demo's mega menu — the product range is not.

**What is right:** the prices. Carlo Calvino at **KSh 39,950** and free delivery over
**KSh 20,000** are both taken from their live site and both match.

---

## 2. What would sell the website more

Ordered by expected return, not by effort.

### 2.1 Social proof — the largest gap

Their own homepage carries **named customer testimonials**. The demo has none. In Kenyan
e-commerce specifically, sites that address the trust deficit explicitly — visible physical
address, a WhatsApp number, a clear returns policy, a delivery commitment, and real reviews
with photos — consistently outsell those that do not.

The demo has the address, WhatsApp and delivery. It has **no reviews anywhere**, and
review presence is the one trust signal a first-time buyer of a KSh 40,000 suit looks for
hardest.

**Build:** a review block on the product page and a testimonial rail on the home page,
fed from a `reviews` slice of state so staff can add them from the console. Photographs
optional but weighted first.

### 2.2 Fit — the highest-leverage feature in this category

Sizing is the number one cause of apparel returns, cited in about **52%** of them, and
size/fit issues account for around **67%** of fashion returns overall. Automated size
recommendation reduces size-related returns by roughly **30%** and lifts conversion
**15–20%**; one custom menswear brand reported an **80%** drop in fit-related issues after
putting a digital fitting flow in.

The demo already has "Find my size" (chest + height → a suit size). That is the right idea
and it is **buried in a drawer**. It should be:

- on the product page, next to the size selector, not behind a link;
- remembered — a returning customer should never re-enter their chest;
- honest about the free-alterations promise, which is the shop's actual answer to fit and
  is a genuine competitive advantage over any online-only seller.

**This is the strongest thing the demo has and it is under-sold.** "Free alterations for
life" plus a size finder plus four (five) stores to walk into is an argument no
international menswear site can make in Nairobi.

### 2.3 M-Pesa placement

M-Pesa STK Push is the primary checkout method for most Kenyan consumer stores — used by
**70%+** of customers — and produces materially lower abandonment than redirect-based
methods. Kenyan checkout conversion improves when M-Pesa is the **first and most visible**
option.

The demo already does this correctly: M-Pesa is the default radio and the STK screen is a
real screen rather than a spinner. **Worth saying out loud in the meeting** — their current
site does not name a payment method anywhere on the homepage.

### 2.4 Photography

Product photography is the single most impactful variable on conversion in most categories;
a clean, well-lit shot outperforms a phone snap by **30–80%**. The demo's imagery is
generated, which the deck already admits. The honest pitch: **the layout is built to make
good photography pay off**, and a day with a photographer is the cheapest conversion work
they will ever buy.

### 2.5 Their social presence is fragmented

Two Instagram accounts: **@sirhenrysofficial** (~3,127 followers, 239 posts) and
**@sirhenrys1967** (~101 followers, 76 posts). Also on Facebook, TikTok, YouTube and X.
The demo links to none of them.

Cheap wins: link the real accounts in the footer; add UTM tags so the console can show
which channel actually sells (the attribution capture is already built — see
`SHUX.attribution()`); put a shoppable feed on the home page.

### 2.6 Occasion is how this customer actually shops

Nobody wakes up wanting "a two-piece suit". They want *a suit for my brother's wedding in
November*. Their navigation already knows this — prom, work, graduation, church. The demo
mirrors the menu but has no **occasion landing pages**, and those are exactly the pages
that rank in search and convert on intent.

**Build:** `#/occasion/wedding`, `/graduation`, `/interview` — each a short editorial page
with three looks, the alterations promise, the fitting-booking button, and a delivery
deadline calculator ("order by the 14th to have it for the 28th").

---

## 3. What would make the app better

### 3.1 Weight — the thing that actually breaks it

Found while fixing the lookbook, and it was breaking the site in a way no one had
attributed correctly:

- the dressing sequence is **97 frames, 1920×1101, 123KB each — 11.7MB**, and every one
  was a plain `<img src>` in the markup;
- browsers open six connections per host, so those 97 requests formed a queue that
  everything else on the site sat behind;
- **measured**: with the sequence in flight, a plain `new Image()` for a 68KB plate
  **timed out after 8 seconds on localhost**. The lookbook's thirteen textures never
  arrived, so the room drew un-textured rectangles — the "whitish backgrounds".

Fixed: eight frames eager, the rest promoted a few at a time, and a needed frame jumps the
queue. The room now loads its plates from the **card variants** (760×1013, 68KB) instead of
the full plates (1536×2048, 450KB) — 880KB instead of 5.7MB for the set.

**Still to do:** the same audit on the shop grid, and `srcset` so a phone never downloads a
1536px plate at all. On a Nairobi mobile connection this is the difference between a site
that works and one that does not.

### 3.2 The shop assistant

Still timing out; still the right call to sell it as a paid extra rather than fix it
blind. `tools/abtest.js` settles which of the two causes it is in one run.

### 3.3 Real staff accounts

`firestore.rules` is still in demo mode. The console says so on screen now, which was the
actual defect. The four steps are in the rules file's header.

### 3.4 Things worth building next, in order

1. **Reviews** — biggest trust gap, small build. (2.1)
2. **Size finder on the product page** — biggest category lever, mostly moving what exists. (2.2)
3. **Occasion pages** — intent traffic, editorial not engineering. (2.6)
4. **`srcset` everywhere** — the phone experience. (3.1)
5. **Stock notifications** — "tell me when a 52 is back" captures demand the shop currently
   loses silently; the inventory data is already per-branch and live.
6. **Click and collect** — they have four (five) stores and free alterations. "Buy online,
   fitted in store on Saturday" is the offer no online-only competitor can match, and it
   turns delivery cost into a shop visit.

---

## Sources

- [Sir Henry's Limited — About us](https://sirhenrys.co.ke/pages/about-us)
- [Sir Henry's Limited — homepage](https://sirhenrys.co.ke/)
- [Sir Henry's Limited on Wanderlog (reviews, locations)](https://wanderlog.com/place/details/3934175/sir-henrys-ltd)
- [Sir Henry's at Thika Road Mall](https://trm.co.ke/sir-henrys/)
- [@sirhenrysofficial on Instagram](https://www.instagram.com/sirhenrysofficial/)
- [@sirhenrys1967 on Instagram](https://www.instagram.com/sirhenrys1967/)
- [Why Kenyan checkout conversion depends on mobile money placement](https://www.mctaba.com/learn/paystack/why-kenyan-checkout-conversion-depends-on-mobile-money-placement)
- [eCommerce payment gateways in Kenya compared](https://neliumsystems.com/ecommerce-payment-gateways-kenya-2026/)
- [Fit and sizing: the core of apparel ecommerce success](https://blog.boldmetrics.com/fit-and-sizing-the-core-of-apparel-ecommerce-success-in-2026)
- [Fashion ecommerce conversion guide: size and fit](https://www.immerss.live/content/fashion-ecommerce-conversion-guide-fix-size-fit-issues/)
- [AI size recommendations and returns — statistics](https://www.fitezapp.com/blog/ai-size-recommendations.html)
- [Custom checkout statistics 2025](https://www.swell.is/content/custom-checkout-statistics)

---

# Suggestions, ordered by what they are worth

Added 2026-08-25. Each says what the evidence is and what it would actually take.

## A. Split the price — buy now, pay later

**The single biggest lever in this price band.** A KSh 39,950 suit is a considered purchase
for most of this market, and the objection is rarely "I don't want it" — it is "not this
month".

Kenya's BNPL market reached about **US$1.18bn in 2025**, growing ~13.6% a year, and GMV is
forecast to climb from $51.6m in 2020 to roughly **$589.5m by 2028** — a 30.8% annual rate.
The players a Nairobi retailer would actually integrate: **M-PESA Faraja** (Safaricom's own,
and the least friction for a shop already taking STK Push), **Lipa Later**, **Aspira**
(over KSh 1bn financed since 2017, 500+ brands) and **Flexpay**.

**What to build:** a price line reading *"KSh 39,950 — or KSh 13,317 × 3 with M-PESA
Faraja"* on the product card and the product page, not only at checkout. The number has to
appear where the objection forms, which is on the grid.

**Effort:** the display and the arithmetic are an afternoon. The integration is a real
project needing a merchant account. **Show the display now; sell the integration.**

## B. Make WhatsApp a real channel, not a link

The strongest local evidence in this document. **Kings Collection**, a Kenyan fashion brand,
moved to WhatsApp commerce and reported **400% sales growth with 70% of all orders
processed on WhatsApp**. Darling Hair, also Kenyan, reported 300%. Meta's own figures:
**64%** of online adults would rather message a business than visit a shop, and **66%** say
messaging makes them more confident to place an order.

**Correction to an earlier draft of this file:** I wrote that these were static links.
They are not. `waBasket()` already writes the whole bag into the message — every line with
its size, quantity and price, and the total. That was already right.

What was actually wrong, found by looking rather than assuming, and **now fixed**:

- **The product page's "Ask about this on WhatsApp" was built once at render with an empty
  size.** A customer who chose a 52 and tapped it sent a message that did not mention 52,
  so the shop had to ask — the exact friction the prefilled message exists to remove. It
  follows the size selection now.
- **Neither message carried a reference.** An assistant reading "I would like to order" had
  nothing to type into the console to find that person again. Both carry `Ref SH-Wxxxxx`.

Verified by `node tools/watest.js` — 8/8, including that the two references differ, so a
reference is per message rather than per session.

**Still to build, in order:**
1. **A WhatsApp thread per order in the console**, so the shop floor answers "where is my
   suit" in the same place it sees the order. The reference above is what makes this
   possible.
2. **A WhatsApp Business catalogue.** Free, and it is the storefront much of this audience
   will actually browse.
3. **Per-branch routing.** `settings.whatsapp` already holds a number per store; the links
   all pass `null` and fall back to the CBD number. A customer near Westgate should reach
   Westgate.

## C. Corporate is a tender business — build for procurement, not for a form

Banks, insurers, law firms, NGOs and government in Kenya buy staff suiting through
**procurement and published tenders with deadlines**. The demo has an enquiry form and a
volume-discount calculator — good, and it stops exactly where the buyer's real work starts.

**What a procurement officer needs and the demo does not produce:**

- a **quotation as a PDF**: reference number, validity date, unit price, volume tier, VAT
  and delivery terms — something that attaches to a tender response;
- a **specification sheet**: fabric composition, weight, construction, care, sizes carried;
- **repeat-order memory** — every employee's size on file, so year two is a reorder rather
  than a re-measure. That is what makes a uniform supplier impossible to displace.

The data is already in the console. It needs a print stylesheet and a reference number.
**Best commercial return per hour of work in this document.**

## D. Click and collect, and be fitted

They have four (five) stores and free alterations for life. **No online-only competitor can
match "buy tonight, fitted on Saturday"** — and it turns a delivery cost into a shop visit,
where the basket is bigger.

The demo already books fittings and already knows stock per branch. It does not offer
collection at checkout, and the two are the same idea.

## E. Tell me when it is back

A size that is out of stock is demand the shop loses in silence. Inventory is already
per-branch and live, and the transfer suggestion already knows when Westgate holds a 52
that Kimathi Street does not.

An email or WhatsApp capture on a disabled size button, and a queue in the console. It also
produces the one report a buyer actually wants: **which sizes we keep failing to have.**

## F. Occasion pages with a deadline calculator

Nobody searches for "two-piece suit". They search for *suit for a wedding*, *graduation
suit Nairobi*, *interview suit*. Their own menu merchandises this way; the demo mirrors the
menu and has nothing behind it.

Each page: three looks, the alterations promise, a fitting button, and the part that
converts — **"order by the 14th to have it altered for the 28th"**, computed from the
alteration turnaround the console already tracks.

## G. What will break at scale

Not urgent, but it is the difference between a demo and a system.

- **Search is a client-side substring match** over the whole catalogue. Fine at 19 products,
  useless at 500, and impossible to rank.
- **No `srcset` anywhere.** A phone on a Nairobi mobile connection downloads the same
  1536×2048 plate a desktop does. After the sequence fix this is the largest remaining
  weight problem, and it is mechanical work.
- **The console is desktop-shaped.** Shop floor staff carry phones. The till works on one;
  the tables do not.
- **No offline.** A till that stops when the connection drops is a till that stops the
  queue. The state layer already degrades to localStorage — a service worker finishes it.

## H. What I would cut

Saying this buys credibility for everything else.

- **The WebGL lookbook is 608KB of unmaintained three.js (r144)** for one gallery. It looks
  extraordinary and it is the heaviest thing on the site. Keep it for the pitch; if it ever
  costs a sale on a slow connection, a CSS scroll gallery does 80% of the job for 2% of the
  weight.
- **The made-to-measure configurator** is the best-looking screen in the build and, per
  section 1.3, may be selling a service they do not currently run. Pitch it as the new
  revenue line it is, not as their history.

## If there is time for three things

| | Why |
|---|---|
| 1. **Reviews on the product page** | Biggest trust gap, smallest build, and their own site already has testimonials to seed it |
| 2. **WhatsApp threads in the console** | The links now carry a reference; the console cannot yet look one up, and the local comparable did 70% of its orders on that channel |
| 3. **Corporate quotation PDF** | Turns a form into a document a procurement officer can act on |

All of it assumes the corrections in section 1 land first. A deck that says 1967 to a
company founded in 1960 does not get to the third slide.

## Further sources

- [BNPL: the new force behind Kenya's online shopping surge — DHL](https://www.dhl.com/discover/en-ke/e-commerce-advice/e-commerce-trends/bnpl--the-new-force-behind-kenya-s-online-shopping-surge)
- [Kenya Buy Now Pay Later report 2025–2030](https://www.businesswire.com/news/home/20250221583930/en)
- [Africa BNPL business report 2026 — M-PESA Faraja, Lipa Later](https://uk.finance.yahoo.com/news/africa-buy-now-pay-later-154400093.html)
- [All the buy now pay later options available in Kenya](https://techweez.com/2023/08/05/buy-now-pay-later-options-kenya/)
- [Aspira](https://aspira.co.ke/)
- [WhatsApp commerce guide — carries the Kings Collection and Darling Hair figures](https://www.flowcart.ai/blog/whatsapp-commerce)
- [WhatsApp Business API in Kenya — 2026 growth playbook](https://helloduty.com/blogs/how-whatsapp-is-transforming-business-communication-in-kenya)
- [Custom men's corporate suits, Kenya — B2B uniform supply](https://staffuniformsupplier.co.ke/product/custom-mens-corporate-suits-kenya/)
- [Kenya uniform tenders](https://www.tendersontime.com/kenya-tenders/uniform-tenders/)
