"""Builds the presentation deck as one self-contained HTML file.

Images are embedded as data URIs so the file opens from a USB stick, an email
attachment or a laptop with no signal - a client meeting is exactly the place a
network fails, and a deck that needs one is a deck that can fail in the room.

Single-theme on purpose. A lookbook should look identical on every screen, so
every colour is painted explicitly rather than inherited from the viewer.
"""
import json, io, os

IMG = json.load(open(os.path.join(os.path.dirname(__file__), '_img.json')))

# ---------------------------------------------------------------- slides ----
S = []

def slide(html, cls=''):
    S.append(f'<section class="slide {cls}">{html}</section>')


# 1 — cover. The most characteristic thing in their world, full bleed.
slide(f'''
  <img class="bleed" src="{IMG['hero']}" alt="">
  <div class="scrim"></div>
  <div class="pad cover-in">
    <p class="eyebrow">Sir Henry&rsquo;s Limited &middot; Nairobi &middot; Est. 1967</p>
    <h1 class="display">A shop that works<br>the way you <em>already do</em></h1>
    <p class="lede">A storefront and a staff console. Four branches, M-Pesa at the
      checkout, and a workshop that alters for life.</p>
    <p class="url">Live now &mdash; sirhenrys.pages.dev</p>
  </div>''', 'cover')

# 2 — the audit
stats = [
    ('KSh 67,000<span>&ndash;</span>110,000', 'Paid to Shopify every month, once POS&nbsp;Pro for five stores is counted'),
    ('0.6&ndash;2%', 'Added to every order, because Shopify Payments does not operate in Kenya'),
    ('0%', 'Of your catalogue carries a barcode. Nothing in any store can be scanned'),
    ('21<span class="of"> of </span>65', 'Collections are empty. A customer who clicks one finds nothing'),
]
cards = ''.join(f'<div class="stat"><p class="fig">{a}</p><p class="cap">{b}</p></div>' for a, b in stats)
slide(f'''
  <div class="pad">
    <p class="eyebrow">The audit</p>
    <h2 class="display">What your website<br>costs you today</h2>
    <p class="sub">I went through sirhenrys.co.ke page by page before writing a line of
      code. These are findings, not estimates.</p>
    <div class="grid-4">{cards}</div>
    <p class="foot">Shopify POS Pro is $89 per store per month. Five stores is $445 a month
      on its own &mdash; roughly KSh&nbsp;58,000 &mdash; before the platform fee.</p>
  </div>''')

# 3 — the argument
args = [
    ('M-Pesa is a bolt-on, not a checkout',
     'Most of your customers pay this way. On Shopify it is an app you rent by the month.'),
    ('Made-to-measure cannot be expressed',
     'Cloth &times; cut &times; lapel &times; lining &times; buttons is not a variant list. Shopify has no way to price it.'),
    ('Alterations for life is your differentiator',
     'It is the promise on your own homepage. Nothing on the site records a single one of them.'),
]
rows = ''.join(
    f'<li><span class="n">{i+1}</span><div><h3>{t}</h3><p>{d}</p></div></li>'
    for i, (t, d) in enumerate(args))
slide(f'''
  <div class="pad narrow">
    <p class="eyebrow">The argument</p>
    <h2 class="display big">You are paying a global<br>platform to <em>not understand<br>Kenya</em></h2>
    <ol class="numbered">{rows}</ol>
  </div>''')

# 4 — demo overview
steps = [
    ('The storefront', 'Opening sequence, the collection room, a garment turning'),
    ('Buying something', 'Size finder, M-Pesa checkout, order tracking'),
    ('The till', 'Scan, take payment, watch stock fall in one branch'),
    ('The workshop', 'An alteration moving through four stages'),
    ('Made to measure', 'Cloth, cut, lapel, lining &mdash; priced live'),
    ('Weddings &amp; corporate', 'A party of six, then a bank of one hundred and twenty'),
]
cells = ''.join(
    f'<div class="step"><span class="n">{i+1}</span><h3>{t}</h3><p>{d}</p></div>'
    for i, (t, d) in enumerate(steps))
slide(f'''
  <div class="pad">
    <p class="eyebrow">What happens next</p>
    <h2 class="display">The demonstration</h2>
    <p class="sub">Twelve minutes, in this order. Everything you are about to see is
      running live &mdash; none of it is a mock-up.</p>
    <div class="grid-6">{cells}</div>
  </div>''')

# 5-10 — the walkthrough
demo = [
  (1, 'The storefront', 'sirhenrys.pages.dev', 'suit', [
    ('Scroll slowly from the top', 'A suit assembles itself as you scroll &mdash; shirt, waistcoat, canvas, finished jacket. Ninety-seven frames, scrubbed by scroll position. It runs backwards if you scroll up.'),
    ('Keep going, to The Collection', 'Every garment stands in one shared light. Drag it sideways. This is the part people photograph.'),
    ('Open Carlo Calvino Navy', 'The suit turns on its own &mdash; seventy-two positions, a full revolution. Drag to take over.')],
    'Nothing here is stock photography of somebody else&rsquo;s shop.'),
  (2, 'Buying something', '#/product/carlo-navy', 'model', [
    ('Use the size finder', 'Chest and height in, size out. On a KSh&nbsp;40,000 purchase, that is the difference between a sale and a return.'),
    ('Check stock by branch', 'It does not say &ldquo;in stock&rdquo;. It says which of your four shops has a 52 today.'),
    ('Pay by M-Pesa', 'The STK push is built in Safaricom&rsquo;s real Daraja shape &mdash; the same fields, the same result codes.'),
    ('Track the order', 'Confirmed, In Workshop, Ready for Fitting, Out for Delivery, Delivered. A tailor&rsquo;s stages, not a warehouse&rsquo;s.')],
    'Ask them what share of their customers pay by M-Pesa. Let them say the number.'),
  (3, 'The till', '#/admin &rarr; Till (POS)', 'store', [
    ('Sign in as shop floor &mdash; PIN 1357', 'Ten sections disappear. A shop-floor account sees the till, stock and alterations. Nothing else.'),
    ('Scan or search a garment', 'Every variant carries a real EAN-13 barcode with a valid check digit. You can print the whole catalogue as tags.'),
    ('Take payment, print the receipt', 'M-Pesa, card or cash, with change calculated.'),
    ('Watch the stock', 'It falls at that branch only &mdash; and on the customer&rsquo;s phone, immediately.')],
    'This one screen is what replaces Shopify POS Pro at KSh 58,000 a month.'),
  (4, 'The workshop', '#/admin/alterations', 'atelier', [
    ('Open an alteration job', 'Sleeve, waist, hem, taper &mdash; captured against the order it came from.'),
    ('Move it a stage', 'Received, In Workshop, Ready, Collected. Each step writes a note the customer can read.'),
    ('Show the customer&rsquo;s view', 'They watch their own suit move through your workshop without telephoning anybody.')],
    'Free alterations for life is the promise on their homepage. Nothing currently records one.'),
  (5, 'Made to measure', '#/bespoke', 'fabric', [
    ('Build a suit in front of them', 'Cloth, pieces, lapel, lining, buttons, monogram &mdash; the price moves as you choose.'),
    ('Say plainly what this is', 'Shopify variants cannot express it. Five choices multiply into thousands of combinations; a variant list caps out long before.'),
    ('Send it to the workshop', 'It lands in the console as a commission with its own stages.')],
    'This is the highest-margin thing they sell, and the hardest for anyone to copy.'),
  (6, 'Weddings &amp; corporate', '#/wedding &nbsp;and&nbsp; #/corporate', 'db', [
    ('A wedding party of six', 'One organiser, a roster of names and sizes, discount scaling to 20%, cloth reserved from a single bolt so every jacket matches.'),
    ('A bank of one hundred and twenty', 'The enquiry arrives in a pipeline &mdash; New, Quoted, Won, Lost. Mark it Won and it becomes a real order.'),
    ('Show them the arithmetic', 'One hundred and twenty two-piece suits, less the 25% volume tier: KSh&nbsp;3,595,560, invoiced rather than charged to a card.')],
    'Shopify has no concept of an order that is not yet an order. A tender needs measuring and a quote first.'),
]
for n, title, url, img, lines, say in demo:
    ls = ''.join(f'<li><span class="n">{i+1}</span><div><h3>{t}</h3><p>{d}</p></div></li>'
                 for i, (t, d) in enumerate(lines))
    slide(f'''
      <div class="split">
        <div class="split-txt">
          <p class="eyebrow">Demo &middot; part {n} of 6</p>
          <h2 class="display">{title}</h2>
          <p class="route">{url}</p>
          <ol class="numbered tight">{ls}</ol>
          <p class="say"><span>Say this</span>{say}</p>
        </div>
        <div class="split-img"><img src="{IMG[img]}" alt=""></div>
      </div>''', 'nopad')

# 11 — six things
six = [
    ('M-Pesa as a real checkout', 'Not an app you rent by the month'),
    ('Made-to-measure, priced live', 'Variants cannot express five multiplying choices'),
    ('Group and corporate ordering', 'One organiser, a whole party, one bolt of cloth'),
    ('Stock by size <em>and</em> branch', 'With transfer suggestions between shops'),
    ('Alterations the customer can follow', 'In Workshop and Ready for Fitting are real stages'),
    ('A size finder that cuts returns', 'Chest and height, on a KSh 40,000 purchase'),
]
cells = ''.join(f'<div class="six"><h3>{t}</h3><p>{d}</p></div>' for t, d in six)
slide(f'''
  <div class="pad">
    <p class="eyebrow">The comparison</p>
    <h2 class="display">Six things Shopify<br>will <em>not</em> do</h2>
    <div class="grid-six">{cells}</div>
    <p class="foot accent">Every one of these is built and running today. Not one is a roadmap item.</p>
  </div>''')

# 12 — the money
slide(f'''
  <div class="pad">
    <p class="eyebrow">The numbers</p>
    <h2 class="display">What it costs</h2>
    <div class="money">
      <div class="col dim">
        <p class="col-h">Shopify, today</p>
        <p class="col-fig">KSh 67,000&ndash;110,000</p>
        <p class="col-sub">per month</p>
        <ul>
          <li><span>Platform subscription</span></li>
          <li><span>POS Pro, five stores</span><b>$445/mo</b></li>
          <li><span>Payment penalty, no Shopify Payments in Kenya</span><b>0.6&ndash;2%</b></li>
          <li><span>Apps for anything above</span><b>extra</b></li>
        </ul>
      </div>
      <div class="col lit">
        <p class="col-h">This</p>
        <p class="col-fig">KSh 50,000</p>
        <p class="col-sub">per month, everything included</p>
        <ul>
          <li><span>Storefront, staff console and till</span></li>
          <li><span>Hosting, updates and support</span></li>
          <li><span>No per-store charge &mdash; four shops or fourteen</span></li>
          <li><span>No payment penalty</span></li>
        </ul>
      </div>
    </div>
    <div class="setup">
      <h3>Plus KSh 50,000 once, to go live</h3>
      <p>Your real catalogue photographed and loaded, four branches configured, staff
        accounts created, Safaricom credentials connected, and your team trained on the till.</p>
    </div>
    <p class="foot accent">You save between KSh 17,000 and KSh 60,000 every month, and gain
      six things you cannot currently buy.</p>
  </div>''')

# 13 — year one
bars = [
    ('Shopify, low estimate', 894000, 'dim'),
    ('This', 650000, 'lit'),
]
mx = max(v for _, v, _ in bars)
bh = ''.join(
    f'<div class="bar-row"><p class="bar-l">{n}</p>'
    f'<div class="bar-t"><div class="bar {c}" style="width:{v/mx*100:.1f}%"></div></div>'
    f'<p class="bar-v">KSh {v:,}</p></div>' for n, v, c in bars)
slide(f'''
  <div class="pad narrow">
    <p class="eyebrow">The maths</p>
    <h2 class="display">Year one, side by side</h2>
    <div class="bars">{bh}</div>
    <p class="foot">Shopify uses the <em>low</em> end of the audited range &mdash; the honest
      comparison, not the flattering one. It includes a payment penalty of 1% on an assumed
      KSh&nbsp;9m of annual card and mobile volume; ours includes the KSh&nbsp;50,000 setup.
      Tell me your real volume and I will redo this with it.</p>
    <p class="saving">You keep <em>KSh 244,000</em> in the first year, and more in every year after.</p>
  </div>''')

# 14 — honest limits
limits = [
    ('M-Pesa is built, but not connected',
     'The request is Safaricom&rsquo;s real shape and the real failure codes are handled. Connecting it needs your Daraja credentials and a short piece of server work. Part of the setup fee.'),
    ('The imagery is generated, not photographed',
     'The garments shown are representative, not your stock. Going live means photographing what you actually sell &mdash; also part of setup.'),
    ('Nineteen products are loaded, not the full range',
     'The prices are your real ones. The rest of the catalogue loads during setup.'),
    ('Staff sign-in is demo-grade today',
     'Real accounts and server-side security are part of going live. Nothing here should hold real customer data until that is done.'),
]
ls = ''.join(f'<li><span class="n">{i+1}</span><div><h3>{t}</h3><p>{d}</p></div></li>'
             for i, (t, d) in enumerate(limits))
slide(f'''
  <div class="pad narrow">
    <p class="eyebrow">Straight answers</p>
    <h2 class="display">What is not finished</h2>
    <p class="sub">You will ask this eventually, so here it is first.</p>
    <ol class="numbered tight">{ls}</ol>
    <p class="foot accent">Anyone who tells you a system is finished has not built one.</p>
  </div>''')

# 15 — four weeks
weeks = [
    ('Week one', 'Photograph the real catalogue. Load every product, price and size.'),
    ('Week two', 'Configure four branches, create staff accounts, connect Safaricom.'),
    ('Week three', 'Train the shop floor on the till. Run both systems side by side.'),
    ('Week four', 'Point sirhenrys.co.ke at the new shop. Switch Shopify off.'),
]
cells = ''.join(f'<div class="week"><span class="n">{i+1}</span><h3>{t}</h3><p>{d}</p></div>'
                for i, (t, d) in enumerate(weeks))
slide(f'''
  <div class="pad">
    <p class="eyebrow">Going live</p>
    <h2 class="display">If you say yes today</h2>
    <div class="grid-4 weeks">{cells}</div>
    <p class="closing">One month, and the Shopify bill stops.</p>
    <p class="foot">Run both together for the final fortnight. Nothing switches off until your
      staff are comfortable and you have watched a full week of real orders come through.</p>
  </div>''')

# 16 — close
slide(f'''
  <img class="bleed dimmer" src="{IMG['hero']}" alt="">
  <div class="scrim heavy"></div>
  <div class="pad cover-in">
    <p class="eyebrow">Open it yourself</p>
    <h1 class="display url-big">sirhenrys.pages.dev</h1>
    <p class="lede">It is live. Open it on your phone in this meeting, ring up a sale on the
      till, and watch the stock change on the screen in front of you.</p>
    <div class="terms">
      <div><p class="t-fig">KSh 50,000</p><p class="t-cap">once, to go live</p></div>
      <div><p class="t-fig">KSh 50,000</p><p class="t-cap">per month, everything included</p></div>
      <div><p class="t-fig">Four weeks</p><p class="t-cap">from yes to switched over</p></div>
    </div>
    <p class="url">Staff console &mdash; sirhenrys.pages.dev/#/admin &nbsp;&middot;&nbsp; demo PIN 1967</p>
  </div>''', 'cover')

# ----------------------------------------------------------------- shell ----
HEAD = '''<title>Sir Henry&rsquo;s Proposal</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap">
<style>
/* Single theme on purpose: a lookbook should look identical on every screen, so every
   colour is painted here rather than inherited from whatever ground the viewer paints. */
:root{
  --ink:#121210;          /* near-black, warmed toward the bronze rather than neutral */
  --ink-2:#1B1A17;
  --bone:#F4F1EC;
  --dust:#9A948B;         /* grey biased toward the accent, so it reads as chosen */
  --dust-2:#6E6962;
  --bronze:#A67C52;       /* the shop's #846144, lifted so it holds on a dark ground */
  --line:rgba(244,241,236,.13);
  --serif:'Cormorant Garamond',Georgia,'Times New Roman',serif;
  --sans:'Archivo',system-ui,-apple-system,'Segoe UI',sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--ink);color:var(--bone);font-family:var(--sans);
  font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow:hidden}

.deck{height:100%;position:relative}
.slide{position:absolute;inset:0;display:grid;place-items:center;opacity:0;
  visibility:hidden;transition:opacity .5s ease;overflow:hidden;background:var(--ink)}
.slide.on{opacity:1;visibility:visible}
@media (prefers-reduced-motion:reduce){.slide{transition:none}}

.pad{width:min(1180px,88vw);padding:4vh 0}
.pad.narrow{width:min(960px,88vw)}
.slide.nopad{place-items:stretch}

/* ---------- type ---------- */
.eyebrow{font-size:10.5px;letter-spacing:.34em;text-transform:uppercase;font-weight:600;
  color:var(--bronze);margin:0 0 18px}
.display{font-family:var(--serif);font-weight:300;letter-spacing:-.015em;line-height:1.02;
  font-size:clamp(34px,5.1vw,68px);margin:0 0 20px;text-wrap:balance}
.display.big{font-size:clamp(36px,5.8vw,78px);margin-bottom:44px}
.display em{font-style:italic;color:var(--bronze)}
.sub{color:var(--dust);font-size:clamp(14px,1.25vw,17px);max-width:62ch;margin:0 0 40px}
.foot{color:var(--dust-2);font-size:13px;line-height:1.65;margin:32px 0 0;max-width:78ch}
.foot em{font-style:italic;color:var(--dust)}
.foot.accent{color:var(--bronze)}
.lede{color:var(--dust);font-size:clamp(15px,1.4vw,19px);max-width:56ch;margin:0 0 34px}
.url{font-size:11px;letter-spacing:.24em;text-transform:uppercase;font-weight:600;
  color:var(--bronze);margin:0}

/* ---------- cover ---------- */
.cover{place-items:stretch}
.bleed{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.bleed.dimmer{filter:grayscale(.35)}
.scrim{position:absolute;inset:0;
  background:linear-gradient(100deg,rgba(18,18,16,.96) 0%,rgba(18,18,16,.88) 42%,rgba(18,18,16,.35) 100%)}
.scrim.heavy{background:linear-gradient(100deg,rgba(18,18,16,.97) 0%,rgba(18,18,16,.93) 55%,rgba(18,18,16,.6) 100%)}
.cover-in{position:relative;align-self:center;justify-self:start;
  width:min(1180px,88vw);margin:0 auto;padding:0 6vw}
.cover .display{font-size:clamp(38px,6.4vw,86px);margin-bottom:26px}
.url-big{font-size:clamp(32px,5.4vw,72px);letter-spacing:-.02em}

/* ---------- stat grid ---------- */
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.stat{background:var(--ink-2);border:1px solid var(--line);padding:26px 22px 24px}
.fig{font-family:var(--serif);font-size:clamp(22px,2.5vw,36px);font-weight:400;
  color:var(--bronze);margin:0 0 14px;line-height:1.05;font-variant-numeric:tabular-nums}
.fig span{color:var(--dust-2)}
.fig .of{font-size:.5em;font-style:italic}
.cap{font-size:13px;color:var(--dust);margin:0;line-height:1.55}

/* ---------- numbered lists ---------- */
.numbered{list-style:none;margin:0;padding:0;display:grid;gap:26px}
.numbered.tight{gap:18px}
.numbered li{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:start}
.n{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;
  background:var(--bronze);color:#16150F;font-size:12px;font-weight:700;
  font-variant-numeric:tabular-nums}
.numbered h3{font-family:var(--sans);font-size:clamp(15px,1.35vw,18px);font-weight:600;
  margin:3px 0 5px;color:var(--bone);letter-spacing:-.005em}
.numbered p{margin:0;font-size:13.5px;color:var(--dust);line-height:1.6;max-width:70ch}

/* ---------- demo overview ---------- */
.grid-6{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.step{background:var(--ink-2);border:1px solid var(--line);padding:24px 22px}
.step .n{margin-bottom:16px}
.step h3{font-size:16px;font-weight:600;margin:0 0 6px}
.step p{margin:0;font-size:13px;color:var(--dust)}

/* ---------- split demo slides ---------- */
.split{display:grid;grid-template-columns:1fr 38%;height:100%}
.split-txt{align-self:center;padding:6vh 4vw 6vh 6vw;min-width:0}
.split-img{position:relative;overflow:hidden}
.split-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.split-img::after{content:'';position:absolute;inset:0;
  background:linear-gradient(90deg,var(--ink) 0%,rgba(18,18,16,0) 28%)}
.route{font-family:ui-monospace,'Courier New',monospace;font-size:12.5px;
  color:var(--bronze);margin:0 0 30px;letter-spacing:.02em}
.say{margin:34px 0 0;font-size:13.5px;color:var(--bone);font-style:italic;
  border-top:1px solid var(--line);padding-top:18px;max-width:70ch}
.say span{display:block;font-style:normal;font-size:10px;letter-spacing:.28em;
  text-transform:uppercase;color:var(--bronze);font-weight:600;margin-bottom:8px}

/* ---------- six things ---------- */
.grid-six{display:grid;grid-template-columns:repeat(2,1fr);gap:22px 44px;margin-top:12px}
.six{border-top:1px solid var(--line);padding-top:16px}
.six h3{font-size:clamp(15px,1.4vw,19px);font-weight:600;margin:0 0 5px}
.six h3 em{font-style:italic;color:var(--bronze)}
.six p{margin:0;font-size:13px;color:var(--dust)}

/* ---------- money ---------- */
.money{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px}
.col{padding:30px 28px;border:1px solid var(--line)}
.col.dim{background:transparent}
.col.lit{background:var(--ink-2);border-color:rgba(166,124,82,.42)}
.col-h{font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;
  color:var(--dust-2);margin:0 0 14px}
.col.lit .col-h{color:var(--bronze)}
.col-fig{font-family:var(--serif);font-size:clamp(26px,3.1vw,44px);margin:0;
  line-height:1;color:var(--bone);font-variant-numeric:tabular-nums}
.col-sub{font-size:12.5px;color:var(--dust);margin:10px 0 22px}
.col ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.col li{display:flex;justify-content:space-between;gap:16px;font-size:13px;
  color:var(--dust);border-top:1px solid var(--line);padding-top:10px}
.col li b{color:var(--bone);font-weight:600;white-space:nowrap}
.setup{margin-top:26px;border-top:1px solid var(--line);padding-top:22px}
.setup h3{font-family:var(--serif);font-size:clamp(20px,2.2vw,30px);font-weight:400;margin:0 0 8px}
.setup p{margin:0;font-size:13.5px;color:var(--dust);max-width:82ch}

/* ---------- bars ---------- */
.bars{display:grid;gap:26px;margin:16px 0 8px}
.bar-row{display:grid;grid-template-columns:220px 1fr auto;gap:22px;align-items:center}
.bar-l{margin:0;font-size:13.5px;color:var(--dust)}
.bar-t{height:46px;background:rgba(244,241,236,.05);position:relative}
.bar{height:100%;transition:width .9s cubic-bezier(.16,1,.3,1)}
.bar.dim{background:#3A372F}
.bar.lit{background:var(--bronze)}
.bar-v{margin:0;font-family:var(--serif);font-size:clamp(17px,1.9vw,26px);
  color:var(--bone);font-variant-numeric:tabular-nums;white-space:nowrap}
.saving{margin:30px 0 0;font-family:var(--serif);font-size:clamp(20px,2.4vw,32px);
  font-weight:300;color:var(--bone)}
.saving em{font-style:italic;color:var(--bronze)}

/* ---------- weeks ---------- */
.weeks .week{background:var(--ink-2);border:1px solid var(--line);padding:24px 22px}
.week .n{margin-bottom:16px}
.week h3{font-size:12px;letter-spacing:.24em;text-transform:uppercase;font-weight:600;
  color:var(--bronze);margin:0 0 10px}
.week p{margin:0;font-size:13px;color:var(--dust)}
.closing{font-family:var(--serif);font-size:clamp(22px,2.8vw,38px);font-weight:300;
  margin:34px 0 0;color:var(--bone)}

/* ---------- close ---------- */
.terms{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin:0 0 36px;
  max-width:820px}
.t-fig{font-family:var(--serif);font-size:clamp(20px,2.4vw,32px);margin:0 0 4px;
  color:var(--bronze);font-variant-numeric:tabular-nums}
.t-cap{margin:0;font-size:12.5px;color:var(--dust)}

/* ---------- chrome ---------- */
.rule{position:fixed;left:0;bottom:0;height:2px;background:var(--bronze);width:0;
  transition:width .5s ease;z-index:20}
.count{position:fixed;right:26px;bottom:22px;font-size:11px;letter-spacing:.2em;
  color:var(--dust-2);font-variant-numeric:tabular-nums;z-index:20}
.count b{color:var(--bone);font-weight:600}
.nav{position:fixed;left:26px;bottom:18px;display:flex;gap:8px;z-index:20}
.nav button{background:transparent;border:1px solid var(--line);color:var(--dust);
  width:34px;height:30px;cursor:pointer;font-size:13px;line-height:1;transition:.18s}
.nav button:hover{border-color:var(--bronze);color:var(--bone)}
.nav button:focus-visible{outline:2px solid var(--bronze);outline-offset:2px}
.hint{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);font-size:10.5px;
  letter-spacing:.2em;text-transform:uppercase;color:var(--dust-2);z-index:20;
  transition:opacity .5s}
.hint.gone{opacity:0}

@media(max-width:900px){
  .grid-4,.grid-6,.grid-six,.money,.terms{grid-template-columns:1fr}
  .grid-6{grid-template-columns:1fr 1fr}
  .split{grid-template-columns:1fr}
  .split-img{display:none}
  .split-txt{padding:5vh 7vw}
  .bar-row{grid-template-columns:1fr;gap:8px}
  .slide{overflow-y:auto;place-items:start}
  .pad{padding:6vh 0}
}
</style>'''

BODY = f'''<div class="deck">{''.join(S)}</div>
<div class="rule" id="rule"></div>
<div class="nav">
  <button id="prev" aria-label="Previous slide">&larr;</button>
  <button id="next" aria-label="Next slide">&rarr;</button>
</div>
<p class="hint" id="hint">Arrow keys to move &middot; F for full screen</p>
<p class="count"><b id="cur">1</b> / <span id="tot"></span></p>
<script>
(function(){{
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  var i=0, rule=document.getElementById('rule'), cur=document.getElementById('cur');
  var hint=document.getElementById('hint');
  document.getElementById('tot').textContent=slides.length;

  function show(n){{
    i=Math.max(0,Math.min(slides.length-1,n));
    slides.forEach(function(s,k){{ s.classList.toggle('on',k===i); }});
    rule.style.width=((i+1)/slides.length*100)+'%';
    cur.textContent=i+1;
    if(i>0) hint.classList.add('gone');
    // the bars only mean anything once they grow, so let them
    var b=slides[i].querySelectorAll('.bar');
    if(b.length){{ b.forEach(function(el){{ var w=el.style.width; el.style.width='0';
      requestAnimationFrame(function(){{ requestAnimationFrame(function(){{ el.style.width=w; }}); }}); }}); }}
  }}
  show(0);

  document.getElementById('next').onclick=function(){{ show(i+1); }};
  document.getElementById('prev').onclick=function(){{ show(i-1); }};

  addEventListener('keydown',function(e){{
    if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){{ show(i+1); e.preventDefault(); }}
    if(e.key==='ArrowLeft'||e.key==='PageUp'){{ show(i-1); e.preventDefault(); }}
    if(e.key==='Home'){{ show(0); }}
    if(e.key==='End'){{ show(slides.length-1); }}
    if(e.key==='f'||e.key==='F'){{
      if(document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();
    }}
  }});

  // a tap on the right half advances, on the left half goes back - for a phone in a meeting
  addEventListener('click',function(e){{
    if(e.target.closest('.nav')) return;
    show(e.clientX > innerWidth*0.5 ? i+1 : i-1);
  }});
}})();
</script>'''

out = os.path.join(os.path.dirname(__file__), 'Sir-Henrys-Proposal.html')
with io.open(out, 'w', encoding='utf-8') as f:
    f.write(HEAD + '\n' + BODY + '\n')
print('written', out, round(os.path.getsize(out)/1e6, 2), 'MB', '·', len(S), 'slides')
