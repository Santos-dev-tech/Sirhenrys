"""Builds the FEATURE LIST deck - a plain inventory of everything the app does.

Deliberately simpler than deck.py. That one makes an argument; this one answers
"what do I get", which a client reads rather than watches. So: no persuasion, no
demo script, no pricing. Short lines, grouped by who uses the thing.

Same palette and faces as the shop, and images embedded so it opens with no network.
"""
import json, io, os

IMG = json.load(open(os.path.join(os.path.dirname(__file__), '_img.json')))
S = []

def slide(html, cls=''):
    S.append(f'<section class="slide {cls}">{html}</section>')

def grid(items, cols=3):
    """items: (title, note) - note may be empty."""
    cells = ''.join(
        f'<div class="f"><h3>{t}</h3>{f"<p>{n}</p>" if n else ""}</div>' for t, n in items)
    return f'<div class="fgrid c{cols}">{cells}</div>'

def section(kicker, title, items, cols=3, foot=''):
    slide(f'''
      <div class="pad">
        <p class="eyebrow">{kicker}</p>
        <h2 class="display">{title}</h2>
        {grid(items, cols)}
        {f'<p class="foot">{foot}</p>' if foot else ''}
      </div>''')


# ---------------------------------------------------------------- 1. cover --
slide(f'''
  <img class="bleed" src="{IMG['hero']}" alt="">
  <div class="scrim"></div>
  <div class="pad cover-in">
    <p class="eyebrow">Sir Henry&rsquo;s Limited</p>
    <h1 class="display">Everything it does</h1>
    <p class="lede">A complete list of what the shop and the staff console can do today.</p>
    <p class="url">sirhenrys.pages.dev</p>
  </div>''', 'cover')

# ---------------------------------------------------------------- 2. shape --
slide(f'''
  <div class="pad">
    <p class="eyebrow">The shape of it</p>
    <h2 class="display">Two halves,<br>one system</h2>
    <div class="halves">
      <div class="half">
        <p class="half-k">For your customers</p>
        <p class="half-n">18</p>
        <p class="half-l">pages &mdash; browse, buy, book a fitting, follow an order</p>
      </div>
      <div class="half lit">
        <p class="half-k">For your staff</p>
        <p class="half-n">13</p>
        <p class="half-l">screens &mdash; the till, the books, the stock, the workshop</p>
      </div>
    </div>
    <p class="foot">They share one database. A sale on the till changes the stock a customer
      sees, immediately, in every branch.</p>
  </div>''')

# ------------------------------------------------------- 3-7. the storefront --
section('The shop &middot; browsing', 'Finding a garment', [
    ('The collection room', 'Every garment in one light. Drag to move through it'),
    ('Shop by category', 'Suits, shirts, casual, accessories &mdash; with filters and sorting'),
    ('Search', 'Across names, fabrics, descriptions and tags'),
    ('Lookbook', 'The full collection, presented as a lookbook'),
    ('Recently viewed', 'Picks up where they left off'),
    ('Wishlist', 'Save now, buy later'),
])

section('The shop &middot; the product page', 'Deciding on it', [
    ('Turn the garment', 'A full 360, seventy-two positions. Drag or let it turn'),
    ('Full-size photography', 'Shown at the size it is displayed, so nothing is soft'),
    ('Size finder', 'Chest and height in, the right size out'),
    ('Live stock by branch', 'Not &ldquo;in stock&rdquo; &mdash; which shop has a 52, today'),
    ('Fabric and cut detail', 'Cloth, construction, fit, care'),
    ('Ask on WhatsApp', 'Opens with the garment, size and price already written'),
])

section('The shop &middot; buying', 'Paying for it', [
    ('M-Pesa', 'Built in Safaricom&rsquo;s real Daraja shape'),
    ('Card', 'For customers who prefer it'),
    ('Pay on collection', 'Reserve now, pay in the shop'),
    ('The bag', 'Add, change quantity, remove &mdash; kept between visits'),
    ('Send a bag on WhatsApp', 'The whole basket as a message, to the right branch'),
    ('Free delivery threshold', 'Set by you, shown to them'),
])

section('The shop &middot; after the sale', 'Following it through', [
    ('Order tracking', 'Confirmed, In Workshop, Ready for Fitting, Out for Delivery, Delivered'),
    ('Alteration progress', 'They watch their own suit move through your workshop'),
    ('Book a fitting', 'At any of the four branches, with a reason and notes'),
    ('An account', 'Orders, fittings, commissions and group quotes in one place'),
    ('Sign in with email', 'Or continue with Google, one tap'),
    ('Their measurements kept', 'So the next suit is quicker'),
])

section('The shop &middot; the bigger orders', 'Bespoke, weddings, corporate', [
    ('Made to measure', 'Cloth, pieces, lapel, lining, buttons, monogram &mdash; priced as they choose'),
    ('Wedding and group builder', 'One organiser, a whole party, discount scaling to 20%'),
    ('One bolt of cloth', 'So every jacket in the party matches'),
    ('Corporate enquiries', 'Company, headcount, garment, deadline'),
    ('Volume pricing shown up front', '10% at ten garments, rising to 30% at two hundred'),
    ('It becomes a real order', 'Marked Won, it turns into an order in the workshop'),
])

# --------------------------------------------------------- 8-11. the console --
section('The console &middot; selling', 'The till', [
    ('Scan a barcode', 'Every variant has a real EAN-13 with a valid check digit'),
    ('Or search by name', 'For anything without a tag to hand'),
    ('M-Pesa, card or cash', 'With change calculated'),
    ('Print a receipt', 'Or send it'),
    ('Stock falls at that branch', 'Only that branch, and on every other screen at once'),
    ('Print tags for the catalogue', 'The whole range as a barcode sheet'),
], foot='This one screen is what replaces Shopify POS Pro at $89 per store, per month.')

section('The console &middot; the books', 'Orders and customers', [
    ('Every order', 'With an editable status and workshop notes'),
    ('Customers', 'What they have bought, and what it is worth'),
    ('Fittings', 'Confirm, reschedule, add notes'),
    ('Made-to-measure commissions', 'Each with its own stages'),
    ('Wedding and group quotes', 'The roster, the sizes, the discount'),
    ('Corporate pipeline', 'New, Quoted, Won, Lost'),
])

section('The console &middot; the stock', 'Knowing what you have', [
    ('Stock by size and by branch', 'The whole matrix, on one screen'),
    ('Suggested transfers', 'Dead in one shop, sitting in another &mdash; it tells you'),
    ('Adjust a count', 'When the shelf and the screen disagree'),
    ('Inline price editing', 'Change a price without leaving the list'),
    ('Sales history', 'Every till sale, by branch'),
    ('Barcodes and SKUs', 'Generated for every variant, valid and printable'),
])

section('The console &middot; the workshop', 'Alterations and fittings', [
    ('Raise a job', 'Against an order, or for a walk-in'),
    ('Capture the work', 'Sleeve, waist, hem, taper'),
    ('Four stages', 'Received, In Workshop, Ready, Collected'),
    ('A note at every step', 'Which the customer can read'),
    ('Promised dates', 'So nothing quietly slips'),
    ('Per branch', 'Each shop sees its own bench'),
])

section('The console &middot; running it', 'Insight and control', [
    ('Dashboard', 'Revenue, orders, average order, stock-outs, fittings booked'),
    ('Revenue chart', 'Last seven days, all branches or one'),
    ('Analytics', 'What is selling, where, and for how much'),
    ('Three staff roles', 'Owner, manager, shop floor &mdash; each sees only its own work'),
    ('Settings', 'Delivery threshold, VAT, M-Pesa details, WhatsApp numbers per branch'),
    ('A shop assistant', 'Ask it what to move, or to draft a reply. Optional extra'),
])

# --------------------------------------------------------------- 12. under --
section('Underneath', 'The things nobody demonstrates', [
    ('Works on a phone', 'Every page, both halves, including the till'),
    ('Light and dark', 'Follows the phone&rsquo;s own setting, or a switch'),
    ('Live across devices', 'Ring up a sale here, the number changes there'),
    ('Keeps selling offline', 'The till works through an outage and catches up after'),
    ('Two-factor for staff', 'A PIN, then a six-digit code'),
    ('Built to be handed over', 'Plain HTML, CSS and JavaScript. No framework to learn'),
], foot='Hosted, updated and supported. Your data lives in an account in your name.')

# ---------------------------------------------------------------- 13. close --
slide(f'''
  <img class="bleed dimmer" src="{IMG['store']}" alt="">
  <div class="scrim heavy"></div>
  <div class="pad cover-in">
    <p class="eyebrow">See it working</p>
    <h1 class="display url-big">sirhenrys.pages.dev</h1>
    <p class="lede">Open it on your phone. Everything listed here is running on it now.</p>
    <div class="terms">
      <div><p class="t-fig">18</p><p class="t-cap">pages for your customers</p></div>
      <div><p class="t-fig">13</p><p class="t-cap">screens for your staff</p></div>
      <div><p class="t-fig">4</p><p class="t-cap">branches, one system</p></div>
    </div>
    <p class="url">Staff console &mdash; sirhenrys.pages.dev/#/admin</p>
  </div>''', 'cover')

# ----------------------------------------------------------------- shell ----
HEAD = '''<title>Sir Henry&rsquo;s Features</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&display=swap">
<style>
:root{
  --ink:#121210; --ink-2:#1B1A17; --bone:#F4F1EC; --dust:#9A948B; --dust-2:#6E6962;
  --bronze:#A67C52; --line:rgba(244,241,236,.13);
  --serif:'Cormorant Garamond',Georgia,'Times New Roman',serif;
  --sans:'Archivo',system-ui,-apple-system,'Segoe UI',sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--ink);color:var(--bone);font-family:var(--sans);font-size:16px;
  line-height:1.6;-webkit-font-smoothing:antialiased;overflow:hidden}
.deck{height:100%;position:relative}
.slide{position:absolute;inset:0;display:grid;place-items:center;opacity:0;visibility:hidden;
  transition:opacity .45s ease;overflow:hidden;background:var(--ink)}
.slide.on{opacity:1;visibility:visible}
@media (prefers-reduced-motion:reduce){.slide{transition:none}}
.pad{width:min(1180px,88vw);padding:4vh 0}

.eyebrow{font-size:10.5px;letter-spacing:.34em;text-transform:uppercase;font-weight:600;
  color:var(--bronze);margin:0 0 16px}
.display{font-family:var(--serif);font-weight:300;letter-spacing:-.015em;line-height:1.02;
  font-size:clamp(32px,4.6vw,60px);margin:0 0 34px;text-wrap:balance}
.display em{font-style:italic;color:var(--bronze)}
.lede{color:var(--dust);font-size:clamp(15px,1.4vw,19px);max-width:56ch;margin:0 0 34px}
.foot{color:var(--dust-2);font-size:13px;margin:30px 0 0;max-width:82ch}
.url{font-size:11px;letter-spacing:.24em;text-transform:uppercase;font-weight:600;
  color:var(--bronze);margin:0}

/* the feature grid - the whole deck is basically this */
.fgrid{display:grid;gap:26px 40px}
.fgrid.c3{grid-template-columns:repeat(3,1fr)}
.fgrid.c2{grid-template-columns:repeat(2,1fr)}
.f{border-top:1px solid var(--line);padding-top:14px}
.f h3{font-size:clamp(14px,1.3vw,17px);font-weight:600;margin:0 0 5px;color:var(--bone);
  letter-spacing:-.005em}
.f p{margin:0;font-size:12.5px;color:var(--dust);line-height:1.55}

/* two halves */
.halves{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.half{border:1px solid var(--line);padding:34px 30px}
.half.lit{background:var(--ink-2);border-color:rgba(166,124,82,.4)}
.half-k{font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;
  color:var(--dust-2);margin:0 0 18px}
.half.lit .half-k{color:var(--bronze)}
.half-n{font-family:var(--serif);font-size:clamp(48px,7vw,92px);line-height:.9;margin:0 0 14px;
  color:var(--bronze);font-variant-numeric:tabular-nums}
.half-l{margin:0;font-size:14px;color:var(--dust)}

/* cover */
.cover{place-items:stretch}
.bleed{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.bleed.dimmer{filter:grayscale(.35)}
.scrim{position:absolute;inset:0;
  background:linear-gradient(100deg,rgba(18,18,16,.96) 0%,rgba(18,18,16,.88) 42%,rgba(18,18,16,.35) 100%)}
.scrim.heavy{background:linear-gradient(100deg,rgba(18,18,16,.97) 0%,rgba(18,18,16,.93) 55%,rgba(18,18,16,.6) 100%)}
.cover-in{position:relative;align-self:center;justify-self:start;width:min(1180px,88vw);
  margin:0 auto;padding:0 6vw}
.cover .display{font-size:clamp(38px,6.2vw,84px);margin-bottom:24px}
.url-big{font-size:clamp(30px,5vw,68px);letter-spacing:-.02em}
.terms{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin:0 0 34px;max-width:780px}
.t-fig{font-family:var(--serif);font-size:clamp(30px,3.6vw,48px);margin:0 0 4px;color:var(--bronze);
  font-variant-numeric:tabular-nums;line-height:1}
.t-cap{margin:0;font-size:12.5px;color:var(--dust)}

/* chrome */
.rule{position:fixed;left:0;bottom:0;height:2px;background:var(--bronze);width:0;
  transition:width .45s ease;z-index:20}
.count{position:fixed;right:26px;bottom:22px;font-size:11px;letter-spacing:.2em;
  color:var(--dust-2);font-variant-numeric:tabular-nums;z-index:20}
.count b{color:var(--bone);font-weight:600}
.nav{position:fixed;left:26px;bottom:18px;display:flex;gap:8px;z-index:20}
.nav button{background:transparent;border:1px solid var(--line);color:var(--dust);width:34px;
  height:30px;cursor:pointer;font-size:13px;line-height:1;transition:.18s}
.nav button:hover{border-color:var(--bronze);color:var(--bone)}
.nav button:focus-visible{outline:2px solid var(--bronze);outline-offset:2px}
.hint{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);font-size:10.5px;
  letter-spacing:.2em;text-transform:uppercase;color:var(--dust-2);z-index:20;transition:opacity .5s}
.hint.gone{opacity:0}

@media(max-width:900px){
  .fgrid.c3,.fgrid.c2,.halves,.terms{grid-template-columns:1fr}
  .fgrid{gap:18px}
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
  var s=[].slice.call(document.querySelectorAll('.slide')), i=0;
  var rule=document.getElementById('rule'), cur=document.getElementById('cur');
  var hint=document.getElementById('hint');
  document.getElementById('tot').textContent=s.length;
  function show(n){{
    i=Math.max(0,Math.min(s.length-1,n));
    s.forEach(function(el,k){{ el.classList.toggle('on',k===i); }});
    rule.style.width=((i+1)/s.length*100)+'%'; cur.textContent=i+1;
    if(i>0) hint.classList.add('gone');
  }}
  show(0);
  document.getElementById('next').onclick=function(){{ show(i+1); }};
  document.getElementById('prev').onclick=function(){{ show(i-1); }};
  addEventListener('keydown',function(e){{
    if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){{ show(i+1); e.preventDefault(); }}
    if(e.key==='ArrowLeft'||e.key==='PageUp'){{ show(i-1); e.preventDefault(); }}
    if(e.key==='Home') show(0);
    if(e.key==='End') show(s.length-1);
    if(e.key==='f'||e.key==='F'){{
      if(document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();
    }}
  }});
  addEventListener('click',function(e){{
    if(e.target.closest('.nav')) return;
    show(e.clientX > innerWidth*0.5 ? i+1 : i-1);
  }});
}})();
</script>'''

out = os.path.join(os.path.dirname(__file__), 'Sir-Henrys-Features.html')
with io.open(out, 'w', encoding='utf-8') as f:
    f.write(HEAD + '\n' + BODY + '\n')
print('written', out, round(os.path.getsize(out)/1e6, 2), 'MB ·', len(S), 'slides')
