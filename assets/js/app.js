/* Sir Henry's Limited - storefront app */
(() => {
  'use strict';
  const { PRODUCTS, CATEGORIES, BRANCHES, STATUSES, byId, fmt, state, cart, wishlist } = SH;
  const app = document.getElementById('app');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const go = h => { location.hash = h; };

  /* ---------- toast ---------- */
  let tT;
  function toast(msg) {
    let n = document.querySelector('.notice');
    if (!n) { n = document.createElement('div'); n.className = 'notice'; document.body.appendChild(n); }
    n.textContent = msg; n.classList.add('on');
    clearTimeout(tT); tT = setTimeout(() => n.classList.remove('on'), 2600);
  }

  /* ---------- shared bits ---------- */
  const stars = r => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));

  const priceHTML = p => p.compareAt
    ? `<s>${fmt(p.compareAt)}</s><span class="now">${fmt(p.price)}</span>`
    : fmt(p.price);

  function cardHTML(p) {
    const t = [];
    if (p.tags.includes('new')) t.push('<span class="tag new">New</span>');
    if (p.compareAt) t.push('<span class="tag sale">Sale</span>');
    return `<article class="card">
      <a class="card-img" href="#/product/${p.slug}" aria-label="${esc(p.title)}">
        <img src="${(p.thumbs || p.images)[0]}" alt="${esc(p.title)}" loading="lazy" decoding="async">
        <img class="alt" src="${(p.thumbs || p.images)[1]}" alt="" loading="lazy" decoding="async">
      </a>
      <div class="card-tags">${t.join('')}</div>
      <button class="card-fav ${wishlist.has(p.slug) ? 'on' : ''}" data-fav="${p.slug}" aria-label="Save">
        <svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
      </button>
      <div class="card-sizes">${p.sizes.map(s => {
        const n = SH.branchTotal(p, s);
        return `<button data-quick="${p.slug}" data-size="${s}" ${n ? '' : 'disabled'}>${s}</button>`;
      }).join('')}</div>
      <a class="card-b" href="#/product/${p.slug}">
        <div class="bd">${esc(p.brand)}</div>
        <div class="ti">${esc(p.title)}</div>
        <div class="pr">${priceHTML(p)}</div>
      </a>
    </article>`;
  }

  const gridHTML = list => list.length
    ? `<div class="grid" data-stagger="0.06">${list.map(cardHTML).join('')}</div>`
    : `<div class="empty"><p>Nothing matches those filters yet.</p><a class="btn ghost" href="#/shop">View everything</a></div>`;

  /* ---------- WhatsApp ----------
     WhatsApp is the default channel in Kenya. These build wa.me links with the message
     already written, so a customer never has to describe what they are looking at. */
  const waNumber = (branch) => (SH.state.settings.whatsapp || {})[branch || 'cbd'] || '254713619786';
  const waLink = (text, branch) =>
    'https://wa.me/' + waNumber(branch) + '?text=' + encodeURIComponent(text);
  const waProduct = (p, size) =>
    waLink("Hello Sir Henry's, I am interested in the " + p.title +
           (size ? ' in size ' + size : '') + ' (' + fmt(p.price) + ').' +
           '\n\nIs it available?', null);
  const waBasket = () => {
    const lines = state.cart.map(l => {
      const p = byId(l.slug);
      return '- ' + p.title + ' - size ' + l.size + ' x' + l.qty + ' - ' + fmt(p.price * l.qty);
    }).join('\n');
    return waLink("Hello Sir Henry's, I would like to order:\n\n" + lines +
                  '\n\nTotal: ' + fmt(cart.total) + '\n\nCan you confirm availability?', null);
  };

  /* ---------- the anatomy sequence ----------
     Five layers laid onto one figure as you scroll. Plate scale is normalised
     per layer because the generated frames are not identically cropped. */
  const ANAT = [
    { at: 0.00, side: 'centre', cam: [50, 50, 1.00], eyebrow: "Sir Henry's &middot; Nairobi &middot; Since 1967",
      h: 'The Anatomy<br>of <em>a Suit</em>',
      p: 'Nineteen measurements, taken by hand on Kimathi Street. Watch one become a suit.',
      cap: 'Scroll to begin' },
    { at: 0.20, side: 'right',  cam: [50, 38, 1.16], eyebrow: 'The Foundation',
      h: 'A shirt of <em>pure cotton</em>',
      p: 'Two-ply Egyptian poplin, single-needle seams and a collar cut with enough body to hold its shape under a jacket all day.',
      cap: 'Cloth: 140/2 Egyptian cotton' },
    { at: 0.39, side: 'left',   cam: [50, 54, 1.14],  eyebrow: 'The Waistcoat',
      h: 'Structure, <em>held close</em>',
      p: 'The waistcoat draws the line of the body inward. Five buttons, a silk-backed rear, and a hem cut on the bias so the front falls true.',
      cap: 'Silk: mulberry, woven in Como' },
    { at: 0.63, side: 'right',  cam: [44, 50, 1.20], eyebrow: 'The Canvas',
      h: 'Built on <em>full canvas</em>',
      p: 'A hand-padded horsehair canvas floats between cloth and lining. It is the reason a Sir Henry’s jacket takes the shape of the man wearing it.',
      cap: 'Construction: hand-padded full canvas' },
    { at: 0.80, side: 'left',   cam: [50, 50, 1.02],  eyebrow: 'The Cut',
      h: 'The complete <em>silhouette</em>',
      p: 'Four weeks from chalk to hanger. One fitting, one bolt of cloth, and a suit that belongs to nobody else.',
      cap: 'Cloth: Super 150s merino, 240g' }
  ];

  window.__ANAT_AT = ANAT.map(a => a.at);
  window.__ANAT_CAM = ANAT.map(a => a.cam || [50, 50, 1]);

  const anatomyHTML = () => `
    <section class="anat" id="anatomy" style="height:${ANAT.length * 100}vh">
      <div class="anat-sticky">
        <div class="anat-stage-panel"></div>
        <div class="anat-stage" data-frames="97"><div class="anat-cam">
          ${Array.from({length: 97}, (_, i) =>
            `<img class="anat-f${i === 0 ? ' on' : ''}" src="assets/seq/d${String(i).padStart(3,'0')}.jpg"
              alt="${i === 0 ? "A Sir Henry's suit, assembled layer by layer" : ''}"
              decoding="async" fetchpriority="${i < 4 ? 'high' : 'low'}">`).join('')}
        </div></div>
        <div class="anat-copy">
          ${ANAT.map((a, i) => `<div class="anat-step ${a.side} ${i === 0 ? 'on' : ''}">
            <span class="anat-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="anat-eyebrow">${a.eyebrow}</span>
            <h3>${a.h}</h3><p>${a.p}</p>
            <span class="anat-cap">${a.cap}</span></div>`).join('')}
        </div>
        <div class="anat-count">01 / 0${ANAT.length}</div>
        <div class="anat-cue"><span>Keep scrolling &mdash; the suit builds itself</span>
          <svg viewBox="0 0 24 24"><path d="M12 4v14M6 13l6 6 6-6"/></svg></div>
        <div class="anat-rule"><i></i></div>
      </div>
    </section>`;

  /* ---------- the collection room (WebGL) ---------- */
  const roomHTML = (slugs, mark, sub) => `
    <section class="room" data-room='${JSON.stringify(slugs)}'>
      <canvas class="room-canvas"></canvas>
      <div class="room-hd"><div class="mark">${esc(mark)}</div><div class="sub">${esc(sub)}</div></div>
      <div class="room-meta"><b data-room-title>&nbsp;</b><span data-room-price>&nbsp;</span></div>
      <div class="room-hint">Drag to walk the room</div>
    </section>`;

  /* ---------- views ---------- */
  const V = {};

  V.home = () => {
    const nw = PRODUCTS.filter(p => p.tags.includes('new')).slice(0, 4);
    const best = PRODUCTS.filter(p => p.tags.includes('bestseller')).slice(0, 4);
    const look = ['carlo-navy', 'blush-pink-wool', 'charcoal-db', 'beige-linen', 'black-tuxedo', 'bomber-chocolate', 'camel-overcoat'];
    return `
    ${anatomyHTML()}

    <section class="hero">
      <img src="assets/img/ed-hero.jpg" alt="">
      <div class="wrap hero-c">
        <div class="eyebrow" data-reveal="0">Nairobi &middot; Since 1967</div>
        <h1 data-reveal="0.08">Crafted for the<br><em>Distinguished</em> Gentleman</h1>
        <p data-reveal="0.16">Three generations of tailoring on Kimathi Street. Ready-to-wear cut like it was made for you &mdash; because, if you ask, it will be.</p>
        <a class="btn" href="#/shop" data-reveal="0.24" data-magnet="0.18">Shop the collection</a>
        <a class="btn ghost" href="#/bespoke" style="margin-left:10px" data-reveal="0.3" data-magnet="0.18">Design your suit</a>
      </div>
    </section>

    <div class="props" data-stagger="0.08">
      ${[['M-Pesa &amp; card at checkout', 'Pay the way Kenya pays', 'M9 12l2 2 4-4M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6z'],
         ['Free delivery over KSh 20,000', 'Nationwide, 2-4 working days', 'M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM18 19a2 2 0 100-4 2 2 0 000 4z'],
         ['Complimentary alterations', 'On every suit, for life', 'M6 3v12M18 3v12M6 15a3 3 0 106 0M12 15a3 3 0 106 0'],
         ['Four Kenyan stores', 'Nairobi, Ruaka &amp; Mombasa', 'M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z M12 10a2 2 0 100-4 2 2 0 000 4z']]
        .map(([b, s, d]) => `<div class="prop"><svg viewBox="0 0 24 24"><path d="${d}"/></svg><b>${b}</b><span>${s}</span></div>`).join('')}
    </div>


    ${roomHTML(look, 'The Collection', 'Autumn/Winter 2026')}

    <section class="sec wrap">
      <div class="sec-hd" data-reveal>
        <div><div class="eyebrow">Fashion 2026</div><h2>New for you</h2>
        <p>The pieces that just landed in-store and online.</p></div>
        <a class="link-u" href="#/shop?sort=new">View all</a>
      </div>
      ${gridHTML(nw)}
    </section>


    <section class="sec wrap">
      <div class="sec-hd" data-reveal><div><div class="eyebrow">Shop by category</div><h2>The wardrobe</h2></div></div>
      <div class="cats" data-stagger="0.08">
        ${CATEGORIES.map(c => `<a class="cat" href="#/shop?cat=${c.id}">
          <img src="assets/img/${c.img}.jpg" alt="${c.name}" loading="lazy"><span>${c.name}</span></a>`).join('')}
      </div>
    </section>

    <section class="split">
      <img src="assets/img/ed-atelier.jpg" alt="Our master tailor at work" loading="lazy">
      <div class="split-c" data-reveal>
        <div class="eyebrow">Made to Measure</div>
        <h2>A suit cut to <em>one</em> man</h2>
        <p>Choose the cloth, the lapel, the lining, the buttons &mdash; then have it cut to your measurements in our Nairobi workshop. Four weeks, one fitting, and a suit nobody else owns.</p>
        <p class="muted" style="font-size:13px">From KSh 55,000 &middot; Includes two fittings and lifetime alterations.</p>
        <div><a class="btn" href="#/bespoke">Start your commission</a></div>
      </div>
    </section>

    <div class="band" aria-hidden="true">
      <div class="band-track">
        ${Array(2).fill(`<span>Cut on Kimathi Street<i>&#10022;</i>Fitted for life<i>&#10022;</i>Since 1967<i>&#10022;</i>Made to measure in four weeks<i>&#10022;</i></span>`).join('')}
      </div>
    </div>

    <section class="split" style="direction:rtl">
      <img src="assets/img/charcoal-db.jpg" alt="Wedding party tailoring" loading="lazy" style="direction:ltr">
      <div class="split-c" data-reveal style="direction:ltr;background:var(--paper)">
        <div class="eyebrow">Weddings &amp; Groups</div>
        <h2>Dress the <em>whole</em> party</h2>
        <p>Add the groom, the best man and every groomsman, and the discount grows with the party &mdash; up to 20%. We hold the cloth from a single bolt, so every jacket in your photographs is the same colour.</p>
        <p class="muted" style="font-size:13px">Free alterations for everyone &middot; On-site measuring for parties of six or more.</p>
        <div><a class="btn" href="#/wedding">Build your party quote</a></div>
      </div>
    </section>

    <section class="sec wrap">
      <div class="sec-hd" data-reveal><div><div class="eyebrow">Sales on menswear</div><h2>Up to 20% off</h2></div>
        <a class="link-u" href="#/shop?sort=sale">Shop sale</a></div>
      ${gridHTML(PRODUCTS.filter(p => p.compareAt).slice(0, 4))}
    </section>

    <section class="sec wrap">
      <div class="sec-hd center" style="justify-content:center;text-align:center">
        <div><div class="eyebrow">Here is what our customers have to say</div>
        <h2>Sixty years of shoulders</h2></div>
      </div>
      <div class="revs" data-stagger="0.07">
        ${[["Sir Henry's is the only place I trust for suits. The quality, the fit, and the attention to detail are unmatched.", 'Professor Winston'],
           ['The staff truly understand style. Warm, patient and professional &mdash; a rare experience in retail.', 'Mohammed Ali'],
           ['My father shopped here, and now I do too. It is more than a store &mdash; it is a tradition.', 'Ojok Robert'],
           ['The cuts are clean and flattering, and their tailoring service makes sure everything fits perfectly.', 'Albert']]
          .map(([q, n]) => `<figure class="rev"><div class="stars">★★★★★</div><q>${q}</q><b>${n}</b></figure>`).join('')}
      </div>
    </section>

    <section class="sec wrap">
      <div class="sec-hd" data-reveal><div><div class="eyebrow">Bestsellers</div><h2>Never out of style</h2></div>
      <a class="link-u" href="#/shop">Shop all</a></div>
      ${gridHTML(best)}
    </section>`;
  };

  V.shop = (q) => {
    const params = new URLSearchParams(q || '');
    const cat = params.get('cat'), sub = params.get('sub'), sort = params.get('sort');
    let list = PRODUCTS.slice();
    if (cat) list = list.filter(p => p.category === cat);
    if (sub) list = list.filter(p => p.sub === sub);
    if (sort === 'sale') list = list.filter(p => p.compareAt);
    if (sort === 'new') list = list.filter(p => p.tags.includes('new'));
    if (sort === 'low') list.sort((a, b) => a.price - b.price);
    if (sort === 'high') list.sort((a, b) => b.price - a.price);
    const c = CATEGORIES.find(x => x.id === cat);

    return `<div class="wrap">
      <div class="crumbs"><a href="#/">Home</a> / ${c ? esc(c.name) : 'All'}</div>
      <div class="sec-hd" data-reveal><div><h2>${c ? esc(c.name) : 'The Collection'}</h2>
        <p>${list.length} piece${list.length === 1 ? '' : 's'} &middot; every garment can be altered in-store, free.</p></div></div>
      <div class="filters">
        <a class="chip ${!cat ? 'on' : ''}" href="#/shop">All</a>
        ${CATEGORIES.map(x => `<a class="chip ${cat === x.id ? 'on' : ''}" href="#/shop?cat=${x.id}">${x.name}</a>`).join('')}
        ${c ? c.subs.map(s => `<a class="chip ${sub === s.id ? 'on' : ''}" href="#/shop?cat=${c.id}&sub=${s.id}">${s.name}</a>`).join('') : ''}
        <select id="sortSel" style="margin-left:auto;padding:9px 12px;border:1px solid var(--line);font-size:11px">
          <option value="">Sort: Featured</option>
          <option value="new" ${sort === 'new' ? 'selected' : ''}>New in</option>
          <option value="sale" ${sort === 'sale' ? 'selected' : ''}>On sale</option>
          <option value="low" ${sort === 'low' ? 'selected' : ''}>Price: low to high</option>
          <option value="high" ${sort === 'high' ? 'selected' : ''}>Price: high to low</option>
        </select>
      </div>
      ${gridHTML(list)}
    </div><div style="height:80px"></div>`;
  };

  V.product = (slug) => {
    const p = byId(slug);
    if (!p) return V.notfound();
    SH.markRecent(slug);
    const rel = PRODUCTS.filter(x => x.category === p.category && x.slug !== p.slug).slice(0, 4);
    return `<div class="wrap">
      <div class="crumbs"><a href="#/">Home</a> / <a href="#/shop?cat=${p.category}">${esc(CATEGORIES.find(c => c.id === p.category).name)}</a> / ${esc(p.title)}</div>
      <div class="pdp">
        <div class="pdp-gal">
          ${SH.hasSpin(p.slug) ? `
            <div class="spin" data-spin tabindex="0" role="img"
                 aria-label="${esc(p.title)}, turning through eight photographed angles; drag or use the arrow keys to steer">
              ${SH.spinFrames(p.slug).map((src, i) => `<img class="spin-f${i === 0 ? ' on' : ''}"
                src="${src}" alt="" decoding="async"
                fetchpriority="${i === 0 ? 'high' : 'low'}">`).join('')}
              <div class="spin-ui">
                <span class="spin-hint">Turning &mdash; drag to steer</span>
                <span class="spin-deg" data-spin-deg>0&deg;</span>
              </div>
            </div>` : `<img src="${p.images[0]}" alt="${esc(p.title)}">`}
          <img src="${p.images[1]}" alt="" loading="lazy">
        </div>
        <div class="pdp-info" data-pdp="${p.slug}">
          <div class="eyebrow">${esc(p.brand)}</div>
          <h1>${esc(p.title)}</h1>
          <div class="stars" style="margin-bottom:12px">${stars(p.rating)} <span class="muted" style="font-size:11px;letter-spacing:0">${p.rating.toFixed(1)} &middot; ${p.reviews} reviews</span></div>
          <div class="price">${priceHTML(p)}</div>
          <div class="muted" style="font-size:11.5px">Inclusive of VAT &middot; ${esc(p.fabric)}${p.fit ? ' &middot; ' + esc(p.fit) + ' fit' : ''}</div>

          <div class="row-lbl"><b>Size</b><a data-fit>Find my size</a></div>
          <div class="sizes">${p.sizes.map(s => {
            const n = SH.branchTotal(p, s);
            return `<button data-size="${s}" ${n ? '' : 'disabled'} title="${n ? n + ' in stock' : 'Out of stock'}">${s}</button>`;
          }).join('')}</div>
          <div class="stockline" data-stock>Select a size to see availability.</div>

          <button class="btn wide" data-add>Add to bag</button>
          <button class="btn ghost wide" style="margin-top:10px" data-fav2="${p.slug}">
            ${wishlist.has(p.slug) ? 'Saved to wishlist' : 'Save for later'}</button>
          <a class="btn wa-btn wide" style="margin-top:10px" data-wa="${p.slug}" target="_blank" rel="noopener"
             href="${waProduct(p, '')}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2z"/></svg>
            Ask about this on WhatsApp</a>
          <p class="muted" style="font-size:12px;margin-top:16px;text-align:center">
            Free delivery over KSh 20,000 &middot; <a href="#/appointments" style="color:var(--bronze);border-bottom:1px solid">Book a fitting instead</a></p>

          <div class="acc">
            <details open><summary>Description</summary><div class="body">${esc(p.desc)}</div></details>
            <details><summary>Fabric &amp; care</summary><div class="body">
              ${esc(p.fabric)}. Dry clean only. Rest the garment 24 hours between wears and hang on a broad wooden hanger.</div></details>
            <details><summary>Alterations &amp; fit</summary><div class="body">
              Every suit includes complimentary alterations for life at any Sir Henry's store. Sleeve, waist, hem and taper adjustments are done in our Nairobi workshop, usually within 5 working days.</div></details>
            <details><summary>Availability in store</summary><div class="body" data-branches>
              ${BRANCHES.map(b => `<div style="display:flex;justify-content:space-between;padding:5px 0">
                <span>${b.name}</span><b data-b="${b.id}">-</b></div>`).join('')}
              <p class="muted" style="font-size:12px;margin-top:10px">Select a size above to see live branch stock.</p></div></details>
          </div>
        </div>
      </div>
      <section class="sec"><div class="sec-hd" data-reveal><h2>Complete the look</h2></div>${gridHTML(rel)}</section>
    </div>`;
  };

  V.lookbook = () => {
    const list = PRODUCTS.filter(p => p.category === 'suits' || p.sub === 'jackets').map(p => p.slug);
    return roomHTML(list, "Sir Henry's", 'The Room &middot; every garment in one light');
  };

  /* ---- Made to measure configurator ---- */
  const CLOTHS = [
    { id: 'navy', name: 'Midnight Navy', hex: '#1f2a44', add: 0 },
    { id: 'charcoal', name: 'Charcoal Worsted', hex: '#3a3a3d', add: 0 },
    { id: 'grey', name: 'Mint Grey', hex: '#8d9192', add: 2000 },
    { id: 'blush', name: 'Blush Wool', hex: '#c2a3a0', add: 4000 },
    { id: 'linen', name: 'Sand Linen', hex: '#c9b79a', add: -3000 },
    { id: 'black', name: 'Dinner Black', hex: '#141414', add: 3000 }
  ];
  const LAPELS = [['notch', 'Notch', 0], ['peak', 'Peak', 2500], ['shawl', 'Shawl', 3500]];
  const PIECES = [['2', 'Two piece', 0], ['3', 'Three piece', 8000]];
  const LININGS = [['plain', 'Plain', 0], ['paisley', 'Paisley', 1500], ['house', 'House stripe', 2000]];
  const BUTTONS = [['horn', 'Horn', 0], ['pearl', 'Mother of pearl', 1800], ['covered', 'Covered satin', 2200]];
  const BASE = 55000;

  V.bespoke = () => `<div class="wrap">
    <div class="crumbs"><a href="#/">Home</a> / Made to Measure</div>
    <div class="sec-hd" data-reveal><div><div class="eyebrow">The Commission</div>
      <h2>Design your suit</h2><p>Build it here, then come in for one fitting. Four weeks from chalk to hanger.</p></div></div>
    <div class="mtm">
      <div class="mtm-stage">
        <img src="assets/img/carlo-navy.jpg" alt="Your commission" id="mtmImg">
        <div class="mtm-chip" id="mtmSwatch" style="background:#1f2a44"></div>
      </div>
      <div class="mtm-panel" id="mtmPanel">
        <div class="eyebrow" style="margin-bottom:10px">1. Cloth</div>
        <div class="opts">${CLOTHS.map((c, i) => `<button class="sw ${i === 0 ? 'on' : ''}" data-k="cloth" data-v="${c.id}"
          style="background:${c.hex}" title="${c.name}"></button>`).join('')}</div>
        <div class="muted" style="font-size:12px;margin:-10px 0 20px" id="clothName">Midnight Navy</div>

        <div class="eyebrow" style="margin-bottom:10px">2. Cut</div>
        <div class="opts">${PIECES.map(([v, n], i) => `<button class="opt ${i === 0 ? 'on' : ''}" data-k="pieces" data-v="${v}">${n}</button>`).join('')}</div>

        <div class="eyebrow" style="margin-bottom:10px">3. Lapel</div>
        <div class="opts">${LAPELS.map(([v, n], i) => `<button class="opt ${i === 0 ? 'on' : ''}" data-k="lapel" data-v="${v}">${n}</button>`).join('')}</div>

        <div class="eyebrow" style="margin-bottom:10px">4. Lining</div>
        <div class="opts">${LININGS.map(([v, n], i) => `<button class="opt ${i === 0 ? 'on' : ''}" data-k="lining" data-v="${v}">${n}</button>`).join('')}</div>

        <div class="eyebrow" style="margin-bottom:10px">5. Buttons</div>
        <div class="opts">${BUTTONS.map(([v, n], i) => `<button class="opt ${i === 0 ? 'on' : ''}" data-k="buttons" data-v="${v}">${n}</button>`).join('')}</div>

        <div class="field"><label>Monogram (optional)</label>
          <input id="mono" maxlength="3" placeholder="e.g. JKM" style="text-transform:uppercase"></div>

        <div class="build" id="mtmBuild"></div>
        <button class="btn wide bronze" style="margin-top:16px" id="mtmSubmit">Reserve this commission</button>
        <p class="muted" style="font-size:11.5px;margin-top:12px;text-align:center">
          No payment now. We will call to book your measurement.</p>
      </div>
    </div></div><div style="height:80px"></div>`;

  V.appointments = () => `<div class="wrap" style="max-width:820px">
    <div class="crumbs"><a href="#/">Home</a> / Book a fitting</div>
    <div class="sec-hd" data-reveal><div><div class="eyebrow">The Fitting Room</div><h2>Book a fitting</h2>
      <p>Thirty minutes with a Sir Henry's tailor. No charge, no obligation.</p></div></div>
    <form id="apptForm">
      <div class="f2"><div class="field"><label>Full name</label><input name="name" required></div>
      <div class="field"><label>Phone</label><input name="phone" required placeholder="07xx xxx xxx"></div></div>
      <div class="field"><label>Email</label><input name="email" type="email" required></div>
      <div class="field"><label>Store</label><select name="branch">
        ${BRANCHES.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div>
      <div class="f2"><div class="field"><label>Preferred date</label><input name="date" type="date" required></div>
      <div class="field"><label>Time</label><select name="time">
        ${['10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map(t => `<option>${t}</option>`).join('')}</select></div></div>
      <div class="field"><label>What are you coming in for?</label><select name="reason">
        <option>Made to measure consultation</option><option>Wedding party fitting</option>
        <option>Alterations on an existing suit</option><option>Corporate / bulk order</option>
        <option>Just browsing with help</option></select></div>
      <div class="field"><label>Anything we should know?</label><textarea name="notes" rows="3"></textarea></div>
      <button class="btn wide">Request this slot</button>
    </form></div><div style="height:80px"></div>`;

  V.cart = () => {
    if (!state.cart.length) return `<div class="empty" style="padding:140px 20px">
      <h2 style="margin-bottom:14px">Your bag is empty</h2>
      <p>Nothing in here yet.</p><a class="btn" href="#/shop">Start shopping</a></div>`;
    return `<div class="wrap" style="max-width:1000px">
      <div class="sec-hd" data-reveal><h2>Your bag</h2></div>
      <div style="display:grid;grid-template-columns:1fr 320px;gap:40px;align-items:start" class="cartgrid">
        <div>${state.cart.map(l => { const p = byId(l.slug); return `
          <div class="cl">
            <a href="#/product/${p.slug}"><img src="${p.images[0]}" alt=""></a>
            <div><div class="ti">${esc(p.title)}</div><div class="mt">Size ${l.size} &middot; ${fmt(p.price)}</div>
              <div class="qty"><button data-q="-" data-s="${l.slug}" data-z="${l.size}">-</button>
              <span>${l.qty}</span><button data-q="+" data-s="${l.slug}" data-z="${l.size}">+</button></div></div>
            <div style="text-align:right"><b>${fmt(p.price * l.qty)}</b><br>
              <button class="link-u" style="border:0;background:none;cursor:pointer;color:var(--ink-3);font-size:10px;margin-top:8px"
                data-rm="${l.slug}" data-z="${l.size}">Remove</button></div>
          </div>`; }).join('')}</div>
        <aside style="border:1px solid var(--line);padding:26px">
          <div class="tot"><span>Subtotal</span><b>${fmt(cart.subtotal)}</b></div>
          <div class="tot"><span>Delivery</span><b>${cart.shipping ? fmt(cart.shipping) : 'Free'}</b></div>
          <div class="tot big"><span>Total</span><b>${fmt(cart.total)}</b></div>
          <a class="btn wide" href="#/checkout" style="margin-top:16px">Checkout</a>
          <p class="muted" style="font-size:11.5px;margin-top:14px;text-align:center">M-Pesa, card, or pay in store.</p>
        </aside></div></div><div style="height:80px"></div>`;
  };

  V.checkout = () => {
    if (!state.cart.length) return V.cart();
    return `<div class="wrap" style="max-width:960px">
      <div class="sec-hd" data-reveal><h2>Checkout</h2></div>
      <form id="coForm" style="display:grid;grid-template-columns:1fr 320px;gap:40px;align-items:start" class="cartgrid">
        <div>
          <div class="eyebrow" style="margin-bottom:14px">Contact</div>
          <div class="f2"><div class="field"><label>Full name</label><input name="name" required></div>
          <div class="field"><label>Phone</label><input name="phone" required placeholder="07xx xxx xxx"></div></div>
          <div class="field"><label>Email</label><input name="email" type="email" required></div>

          <div class="eyebrow" style="margin:26px 0 14px">Delivery</div>
          <div class="radio-cards" id="shipOpts">
            <label class="rc on"><input type="radio" name="ship" value="deliver" checked>
              <span><b>Deliver to me</b><span>2-4 working days, nationwide</span></span></label>
            <label class="rc"><input type="radio" name="ship" value="pickup">
              <span><b>Collect in store</b><span>Ready in 2 hours during opening times</span></span></label>
          </div>
          <div id="shipFields">
            <div class="field" style="margin-top:14px"><label>Delivery address</label><input name="addr" placeholder="Street, building, apartment"></div>
            <div class="f2"><div class="field"><label>Town / City</label><input name="city" value="Nairobi"></div>
            <div class="field"><label>County</label><input name="county" value="Nairobi"></div></div>
          </div>
          <div class="field hide" id="pickupField"><label>Collect from</label><select name="branch">
            ${BRANCHES.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div>

          <div class="eyebrow" style="margin:26px 0 14px">Payment</div>
          <div class="radio-cards" id="payOpts">
            <label class="rc on"><input type="radio" name="pay" value="M-Pesa" checked>
              <span><b>M-Pesa</b><span>We send an STK push to your phone</span></span><span class="logo">M-PESA</span></label>
            <label class="rc"><input type="radio" name="pay" value="Card">
              <span><b>Card</b><span>Visa, Mastercard, Amex</span></span></label>
            <label class="rc"><input type="radio" name="pay" value="In store">
              <span><b>Pay on collection</b><span>Cash or card in store</span></span></label>
          </div>
          <div id="mpesaBox" style="border:1px solid var(--line);padding:18px;margin-top:14px;background:var(--bone)">
            <div class="field" style="margin:0"><label>M-Pesa number</label><input name="mpesa" placeholder="07xx xxx xxx"></div>
            <p class="muted" style="font-size:11.5px;margin:10px 0 0">You will get a prompt on your phone. Enter your PIN to confirm.</p>
          </div>

          <div class="field" style="margin-top:26px"><label>Alteration notes (optional)</label>
            <textarea name="alterations" rows="2" placeholder="e.g. sleeve shortened 1.5cm, trouser hem 31 inches"></textarea></div>
          <button class="btn wide" style="margin-top:10px">Place order &middot; ${fmt(cart.total)}</button>
        </div>
        <aside style="border:1px solid var(--line);padding:26px">
          <div class="eyebrow" style="margin-bottom:16px">Your order</div>
          ${state.cart.map(l => { const p = byId(l.slug); return `
            <div style="display:grid;grid-template-columns:52px 1fr auto;gap:12px;margin-bottom:14px;align-items:center">
              <img src="${p.images[0]}" style="aspect-ratio:3/4;object-fit:cover" alt="">
              <div style="font-size:12px"><b>${esc(p.title)}</b><br><span class="muted">Size ${l.size} &times; ${l.qty}</span></div>
              <b style="font-size:12px">${fmt(p.price * l.qty)}</b></div>`; }).join('')}
          <div class="tot" style="margin-top:18px"><span>Subtotal</span><b>${fmt(cart.subtotal)}</b></div>
          <div class="tot"><span>Delivery</span><b>${cart.shipping ? fmt(cart.shipping) : 'Free'}</b></div>
          <div class="tot big"><span>Total</span><b>${fmt(cart.total)}</b></div>
        </aside>
      </form></div><div style="height:80px"></div>`;
  };

  V.order = (id) => {
    const o = state.orders.find(x => x.id === id);
    if (!o) return V.notfound();
    const idx = STATUSES.indexOf(o.status);
    return `<div class="wrap" style="max-width:760px">
      <div class="sec-hd" data-reveal><div><div class="eyebrow">Order ${o.id}</div>
        <h2>Thank you, ${esc(o.customer.name.split(' ')[0])}.</h2>
        <p>We have sent a confirmation to ${esc(o.customer.email)}. ${o.payment === 'M-Pesa' ? 'Your M-Pesa payment was received.' : ''}</p></div></div>
      <div class="tl">${STATUSES.map((s, i) => `
        <div class="tl-s ${i < idx ? 'done' : ''} ${i === idx ? 'now' : ''}">
          <div class="dot">${i < idx ? '&check;' : i + 1}</div>
          <div><b>${s}</b><span>${i === idx ? 'Current stage' : i < idx ? 'Completed' : 'Pending'}</span></div>
        </div>`).join('')}</div>
      ${o.alterations ? `<div style="border:1px solid var(--line);padding:18px;margin-bottom:24px">
        <div class="eyebrow" style="margin-bottom:8px">Workshop notes</div>${esc(o.alterations)}</div>` : ''}
      ${(() => {
        const alt = state.alterations.filter(a => a.order === o.id);
        if (!alt.length) return '';
        return alt.map(a => `<div style="border:1px solid var(--line);padding:22px;margin-bottom:24px">
          <div class="eyebrow" style="margin-bottom:14px">Alterations &middot; ${esc(a.id)}</div>
          <div class="tl" style="margin:0">${SH.ALT_STAGES.map((st, i) => {
            const at = SH.ALT_STAGES.indexOf(a.status);
            return `<div class="tl-s ${i < at ? 'done' : ''} ${i === at ? 'now' : ''}">
              <div class="dot">${i < at ? '&check;' : i + 1}</div>
              <div><b>${st}</b><span>${i === at ? 'Current stage' : i < at ? 'Done' : 'Pending'}</span></div></div>`;
          }).join('')}</div>
          <p class="muted" style="font-size:12.5px;margin:12px 0 0">Promised ${esc(a.promised)}.</p>
        </div>`).join('');
      })()}
      <div style="border:1px solid var(--line);padding:24px">
        <div class="eyebrow" style="margin-bottom:14px">Items</div>
        ${o.items.map(l => { const p = byId(l.slug); return `
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px">
            <span>${esc(p ? p.title : l.slug)} &middot; ${l.size} &times; ${l.qty}</span><b>${fmt(l.price * l.qty)}</b></div>`; }).join('')}
        <div class="tot big"><span>Paid by ${o.payment}</span><b>${fmt(o.total)}</b></div>
        ${o.mpesaReceipt ? `<div class="muted" style="font-size:12px;text-align:right">
          M-Pesa receipt ${esc(o.mpesaReceipt)}</div>` : ''}
      </div>
      <div style="margin-top:26px"><a class="btn ghost" href="#/shop">Continue shopping</a>
        <a class="btn" href="#/account" style="margin-left:10px">My orders</a></div>
    </div><div style="height:80px"></div>`;
  };

  V.account = () => `<div class="wrap" style="max-width:900px">
    <div class="sec-hd" data-reveal><div><div class="eyebrow">The Henry Club</div><h2>My account</h2></div></div>
    <div class="eyebrow" style="margin-bottom:14px">Orders</div>
    ${state.orders.length ? state.orders.map(o => `
      <a href="#/order/${o.id}" style="display:grid;grid-template-columns:1fr auto auto;gap:20px;align-items:center;
        border:1px solid var(--line);padding:18px;margin-bottom:10px">
        <div><b style="font-size:13px">${o.id}</b><br><span class="muted" style="font-size:12px">
          ${new Date(o.date).toLocaleDateString('en-GB')} &middot; ${o.items.length} item${o.items.length > 1 ? 's' : ''}</span></div>
        <span class="tag" style="background:var(--bone)">${o.status}</span>
        <b style="font-size:13px">${fmt(o.total)}</b></a>`).join('')
      : '<p class="muted">No orders yet.</p>'}
    ${state.appointments.length ? `<div class="eyebrow" style="margin:34px 0 14px">Fittings</div>
      ${state.appointments.map(a => `<div style="border:1px solid var(--line);padding:18px;margin-bottom:10px">
        <b style="font-size:13px">${a.id}</b> &middot; ${esc(a.date)} at ${esc(a.time)}<br>
        <span class="muted" style="font-size:12px">${esc(BRANCHES.find(b => b.id === a.branch)?.name || '')} &middot; ${esc(a.reason)} &middot; ${a.status}</span></div>`).join('')}` : ''}
    ${state.groups.length ? `<div class="eyebrow" style="margin:34px 0 14px">Wedding &amp; group quotes</div>
      ${state.groups.map(g => { const p = byId(g.slug); const d = SH.groupDiscount(g.members.length);
        const tot = (p ? p.price : 0) * g.members.length * (1 - d);
        return `<div style="border:1px solid var(--line);padding:18px;margin-bottom:10px">
        <b style="font-size:13px">${g.id}</b> &middot; ${esc(g.event)} &middot; ${g.members.length} suits<br>
        <span class="muted" style="font-size:12px">${esc(p ? p.title : '')} &middot; ${fmt(tot)} after ${(d * 100)}% group discount &middot; ${g.status}</span></div>`; }).join('')}` : ''}
    ${state.commissions.length ? `<div class="eyebrow" style="margin:34px 0 14px">Commissions</div>
      ${state.commissions.map(c => `<div style="border:1px solid var(--line);padding:18px;margin-bottom:10px">
        <b style="font-size:13px">${c.id}</b> &middot; ${esc(c.cloth)} &middot; ${esc(c.pieces)}-piece<br>
        <span class="muted" style="font-size:12px">${fmt(c.price)} &middot; ${c.status}</span></div>`).join('')}` : ''}
  </div><div style="height:80px"></div>`;

  V.wishlist = () => {
    const list = state.wishlist.map(byId).filter(Boolean);
    return `<div class="wrap"><div class="sec-hd" data-reveal><div><div class="eyebrow">Saved</div><h2>Your wishlist</h2></div></div>
      ${list.length ? gridHTML(list) : `<div class="empty"><p>Nothing saved yet.</p><a class="btn ghost" href="#/shop">Browse the collection</a></div>`}
    </div><div style="height:80px"></div>`;
  };

  V.stores = () => `<div class="wrap">
    <div class="sec-hd" data-reveal><div><div class="eyebrow">Visit</div><h2>Our stores</h2>
      <p>Open Monday to Sunday. Walk in, or book a fitting and skip the wait.</p></div></div>
    <img src="assets/img/ed-store.jpg" alt="" style="width:100%;aspect-ratio:21/9;object-fit:cover;margin-bottom:40px">
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
      ${BRANCHES.map(b => `<div style="border:1px solid var(--line);padding:26px">
        <b style="font-size:13px;letter-spacing:.06em">${esc(b.name)}</b>
        <p class="muted" style="font-size:12.5px;margin:10px 0">${esc(b.hours)}<br>${esc(b.tel)}</p>
        <a class="link-u" href="#/appointments">Book a fitting</a></div>`).join('')}
    </div></div><div style="height:80px"></div>`;

  V.about = () => `<div>
    <div class="wrap"><div class="sec-hd" data-reveal style="margin-top:40px"><div><div class="eyebrow">Since 1967</div>
      <h2>Sixty years on Kimathi Street</h2></div></div></div>
    <img src="assets/img/ed-atelier.jpg" alt="" style="width:100%;aspect-ratio:21/9;object-fit:cover">
    <div class="wrap" style="max-width:720px;padding-block:60px">
      <p class="serif" style="font-size:22px;line-height:1.55">Sir Henry's opened its doors in Nairobi in 1967 with one cutting table and a conviction that a Kenyan man should never have to leave the country for a properly made suit.</p>
      <p>Three generations later we still cut on the same street. What began as a single tailoring room is now four stores, a workshop that turns out over two thousand garments a year, and a ready-to-wear collection built on the same patterns we draft by hand.</p>
      <p>We sell suits, but what we actually do is fit them. Every garment we sell carries free alterations for life &mdash; not as a promotion, but because a suit that does not fit is not finished.</p>
      <p>Our corporate service dresses banks, law firms and airlines across East Africa. Our charity programme has placed more than four thousand interview suits with young Kenyans entering the workforce.</p>
    </div>
    <div class="split"><img src="assets/img/ed-fabric.jpg" alt="" loading="lazy">
      <div class="split-c" data-reveal><div class="eyebrow">Corporate Service</div><h2>Dressing <em>teams</em></h2>
      <p>Uniform programmes, group discounts and on-site measuring for organisations of ten to a thousand. One point of contact, one consistent standard.</p>
      <div><a class="btn" href="#/contact">Talk to our corporate desk</a></div></div></div>
    <div style="height:80px"></div></div>`;

  V.contact = () => `<div class="wrap" style="max-width:720px">
    <div class="sec-hd" data-reveal><div><div class="eyebrow">Contact</div><h2>Talk to us</h2>
      <p>Tel (+254) 713 619786 &middot; Monday to Sunday, 10am - 8pm</p></div></div>
    <form id="ctForm">
      <div class="f2"><div class="field"><label>Name</label><input name="name" required></div>
      <div class="field"><label>Email</label><input name="email" type="email" required></div></div>
      <div class="field"><label>Subject</label><select name="subject">
        <option>General enquiry</option><option>Made to measure</option><option>Corporate service</option>
        <option>An existing order</option><option>Careers</option></select></div>
      <div class="field"><label>Message</label><textarea name="msg" rows="5" required></textarea></div>
      <button class="btn wide">Send message</button></form></div><div style="height:80px"></div>`;

  V.search = (q) => {
    const term = new URLSearchParams(q || '').get('q') || '';
    const list = SH.search(term);
    return `<div class="wrap">
      <div class="sec-hd" data-reveal style="margin-top:30px"><div><div class="eyebrow">Search</div>
        <h2>${term ? `${list.length} result${list.length === 1 ? '' : 's'} for &ldquo;${esc(term)}&rdquo;` : 'Search the collection'}</h2></div></div>
      <form id="searchPage" style="max-width:520px;margin-bottom:36px">
        <div class="field"><input name="q" value="${esc(term)}" placeholder="Try 'navy', 'linen', 'tuxedo'..." autofocus></div>
      </form>
      ${term ? gridHTML(list) : ''}
    </div><div style="height:80px"></div>`;
  };

  V.wedding = () => {
    const suits = PRODUCTS.filter(p => p.category === 'suits');
    return `<div class="wrap">
      <div class="crumbs"><a href="#/">Home</a> / Wedding &amp; Groups</div>
      <div class="sec-hd" data-reveal><div><div class="eyebrow">Groups &amp; Weddings</div>
        <h2>Dress the whole party</h2>
        <p>Add everyone, pick one suit, and the discount grows with the party. We hold the cloth from one bolt so every jacket matches exactly &mdash; the thing you cannot guarantee buying one at a time.</p></div></div>

      <div class="mtm">
        <div>
          <div class="panel-lite" style="border:1px solid var(--line);padding:24px;margin-bottom:20px">
            <div class="eyebrow" style="margin-bottom:14px">1. Choose the suit</div>
            <div class="opts" id="wSuits">
              ${suits.map((p, i) => `<button class="opt ${i === 1 ? 'on' : ''}" data-suit="${p.slug}">${esc(p.title.split(' - ')[0])}</button>`).join('')}
            </div>
          </div>

          <div style="border:1px solid var(--line);padding:24px">
            <div class="eyebrow" style="margin-bottom:14px">2. The party</div>
            <div id="wMembers"></div>
            <div class="f2" style="margin-top:16px">
              <div class="field" style="margin:0"><label>Name</label><input id="wName" placeholder="e.g. James Njoroge"></div>
              <div class="field" style="margin:0"><label>Role</label>
                <select id="wRole"><option>Groom</option><option>Best Man</option><option>Groomsman</option>
                <option>Father of the Bride</option><option>Usher</option><option>Guest</option></select></div>
            </div>
            <div class="f2" style="margin-top:12px;align-items:end">
              <div class="field" style="margin:0"><label>Jacket size</label>
                <select id="wSize">${['46','48','50','52','54','56','58'].map(s => `<option>${s}</option>`).join('')}
                <option value="?">Not sure - measure in store</option></select></div>
              <button class="btn ghost" id="wAdd" type="button" style="height:44px">Add to party</button>
            </div>
          </div>
        </div>

        <div class="mtm-panel">
          <div class="eyebrow" style="margin-bottom:14px">Your quote</div>
          <div id="wQuote"></div>
          <form id="wForm" style="margin-top:22px">
            <div class="field"><label>Organiser name</label><input name="organiser" required></div>
            <div class="field"><label>Phone</label><input name="phone" required placeholder="07xx xxx xxx"></div>
            <div class="field"><label>Email</label><input name="email" type="email" required></div>
            <div class="f2"><div class="field"><label>Occasion</label>
              <select name="event"><option>Wedding</option><option>Graduation</option><option>Corporate</option><option>Prom</option></select></div>
              <div class="field"><label>Event date</label><input name="eventDate" type="date" required></div></div>
            <button class="btn wide bronze">Request this quote</button>
            <p class="muted" style="font-size:11.5px;margin-top:12px;text-align:center">
              No payment now. We will call the organiser within one working day.</p>
          </form>
        </div>
      </div>
    </div><div style="height:80px"></div>`;
  };

  V.corporate = () => `<div class="wrap" style="max-width:900px">
    <div class="crumbs"><a href="#/">Home</a> / Corporate &amp; Bulk</div>
    <div class="sec-hd" data-reveal><div><div class="eyebrow">Corporate Service</div>
      <h2>Dressing your whole organisation</h2>
      <p>Sir Henry's has outfitted banks, law firms and airlines across East Africa since 1967.
      Tell us the headcount and the deadline, and we will come to you with cloth.</p></div></div>

    <div class="tiers" data-stagger="0.06">
      ${[[10,'10%'],[20,'15%'],[50,'20%'],[100,'25%'],[200,'30%']].map(t =>
        `<div class="tier"><b>${t[1]}</b><span>${t[0]}+ garments</span></div>`).join('')}
    </div>

    <form id="corpForm" style="margin-top:44px">
      <div class="f2">
        <div class="field"><label>Company</label><input name="company" required></div>
        <div class="field"><label>Your name</label><input name="contact" required></div>
      </div>
      <div class="f2">
        <div class="field"><label>Email</label><input name="email" type="email" required></div>
        <div class="field"><label>Phone</label><input name="phone" required placeholder="07xx xxx xxx"></div>
      </div>
      <div class="f2">
        <div class="field"><label>How many people?</label>
          <input name="headcount" type="number" min="1" value="50" required id="corpN"></div>
        <div class="field"><label>Needed by</label><input name="deadline" type="date" required></div>
      </div>
      <div class="field"><label>Garment</label><select name="garment">
        <option>Two-piece suit</option><option>Three-piece suit</option><option>Blazer and trousers</option>
        <option>Shirts only</option><option>Mixed uniform programme</option></select></div>
      <div class="field"><label>Anything else we should know?</label><textarea name="notes" rows="3"></textarea></div>
      <div class="corp-quote" id="corpQuote"></div>
      <button class="btn wide" style="margin-top:18px">Request a quote</button>
      <p class="muted" style="font-size:12px;margin-top:12px;text-align:center">
        On-site measuring included for orders over 20. We reply within one working day.</p>
    </form></div><div style="height:80px"></div>`;

  V.notfound = () => `<div class="empty" style="padding:160px 20px"><h2>Page not found</h2>
    <p>That page does not exist.</p><a class="btn" href="#/">Back home</a></div>`;

  /* ---------- router ---------- */
  const shop = document.getElementById('shop');

  function render() {
    const raw = location.hash.slice(1) || '/';

    /* #/admin belongs to the console, which lives in the same document. Yield the
       whole storefront subtree rather than just hiding a view: leaving it mounted
       would keep the WebGL rail rendering and Lenis hijacking the wheel behind a
       till screen. */
    if (/^\/admin(\/|\?|$)/.test(raw)) {
      if (shop) shop.hidden = true;
      if (window.Motion) { Motion.unmountRail(); Motion.unmountAnatomy(); Motion.stopScroll(); }
      document.title = "Sir Henry's — Staff Console";
      return;
    }
    if (shop && shop.hidden) { shop.hidden = false; if (window.Motion) Motion.startScroll(); }

    const [path, query] = raw.split('?');
    const seg = path.split('/').filter(Boolean);
    let html;
    switch (seg[0]) {
      case undefined: html = V.home(); break;
      case 'shop': html = V.shop(query); break;
      case 'product': html = V.product(seg[1]); break;
      case 'lookbook': html = V.lookbook(); break;
      case 'bespoke': html = V.bespoke(); break;
      case 'appointments': html = V.appointments(); break;
      case 'cart': html = V.cart(); break;
      case 'checkout': html = V.checkout(); break;
      case 'order': html = V.order(seg[1]); break;
      case 'account': html = V.account(); break;
      case 'wishlist': html = V.wishlist(); break;
      case 'search': html = V.search(query); break;
      case 'wedding': html = V.wedding(); break;
      case 'corporate': html = V.corporate(); break;
      case 'stores': html = V.stores(); break;
      case 'about': html = V.about(); break;
      case 'contact': html = V.contact(); break;
      default: html = V.notfound();
    }
    app.innerHTML = html;
    window.scrollTo(0, 0);
    afterRender(seg[0]);
    syncChrome();
  }

  /* ---------- per-view wiring ---------- */
  function afterRender(view) {
    // sort dropdown
    const sel = document.getElementById('sortSel');
    if (sel) sel.onchange = () => {
      const p = new URLSearchParams(location.hash.split('?')[1] || '');
      sel.value ? p.set('sort', sel.value) : p.delete('sort');
      go('/shop?' + p.toString());
    };

    if (view === 'product') wirePDP();
    if (view === 'bespoke') wireMTM();
    if (view === 'checkout') wireCheckout();
    if (view === 'wedding') wireWedding();

    const cf2 = document.getElementById('corpForm');
    if (cf2) {
      const n = document.getElementById('corpN');
      const q = document.getElementById('corpQuote');
      const paint = () => {
        const c = Math.max(1, +n.value || 1);
        const d = SH.corporateTier(c);
        q.innerHTML = `<div class="corp-line"><span>${c} garments</span>
          <b>${d ? (d * 100) + '% volume discount' : 'Discount starts at 10 garments'}</b></div>
          ${c >= 20 ? '<div class="corp-line"><span>On-site measuring</span><b>Included</b></div>' : ''}
          <div class="corp-line"><span>Alterations for every garment</span><b>Included</b></div>`;
      };
      n.oninput = paint; paint();
      cf2.onsubmit = e => {
        e.preventDefault();
        SH.addCorporate(Object.fromEntries(new FormData(cf2)));
        cf2.reset(); paint();
        toast('Quote requested - we will call within one working day');
      };
    }

    const sp = document.getElementById('searchPage');
    if (sp) sp.onsubmit = e => { e.preventDefault(); go('/search?q=' + encodeURIComponent(sp.q.value)); };

    const af = document.getElementById('apptForm');
    if (af) af.onsubmit = e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(af));
      SH.bookAppointment(d);
      toast('Fitting requested - we will call to confirm');
      go('/account');
    };
    const cf = document.getElementById('ctForm');
    if (cf) cf.onsubmit = e => { e.preventDefault(); cf.reset(); toast('Message sent - we reply within one working day'); };

    mountMotion();
  }

  /* ---------- hand the rendered view to the motion layer ---------- */
  function mountMotion() {
    if (!window.Motion) return;
    Motion.unmountRail();
    Motion.unmountAnatomy();

    const room = document.querySelector('.room');
    if (room) {
      const slugs = JSON.parse(room.dataset.room);
      const items = slugs.map(byId).filter(Boolean)
        .map(p => ({ src: p.images[0], slug: p.slug, title: p.title.split(' - ')[0], price: fmt(p.price),
                     spin: SH.hasSpin(p.slug) ? SH.spinFrames(p.slug) : null }));
      const titleEl = room.querySelector('[data-room-title]');
      const priceEl = room.querySelector('[data-room-price]');
      const canvas = room.querySelector('.room-canvas');
      const rail = Motion.mountRail(canvas, items, it => go('/product/' + it.slug));
      if (rail) {
        rail.onFocusChange = it => { titleEl.textContent = it.title; priceEl.textContent = it.price; };
        if (items[0]) { titleEl.textContent = items[0].title; priceEl.textContent = items[0].price; }
      } else {
        // no WebGL: fall back to a plain scroll-snap rail so the section still works
        canvas.remove();
        room.insertAdjacentHTML('afterbegin', `<div class="room-fallback">${items.map(it =>
          `<a href="#/product/${it.slug}"><img src="${it.src}" alt="${esc(it.title)}"></a>`).join('')}</div>`);
      }
    }

    Motion.mountAnatomy(document.getElementById('anatomy'));
    Motion.mountSpinners(document);
    Motion.refresh(document);
  }

  function wirePDP() {
    const box = document.querySelector('[data-pdp]'); // absent when the slug is unknown
    if (!box) return;
    const p = byId(box.dataset.pdp);
    let size = null;
    const stockEl = box.querySelector('[data-stock]');

    box.querySelectorAll('.sizes button').forEach(b => b.onclick = () => {
      if (b.disabled) return;
      box.querySelectorAll('.sizes button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); size = b.dataset.size;
      const n = SH.branchTotal(p, size);
      stockEl.innerHTML = `<span class="dot ${n > 3 ? '' : 'low'}"></span>${n > 3 ? 'In stock' : `Only ${n} left`} in size ${size}`;
      box.querySelectorAll('[data-b]').forEach(el => {
        const q = SH.stockAt(p.slug, size, el.dataset.b);
        el.textContent = q ? `${q} in stock` : 'None';
        el.style.color = q ? '' : 'var(--ink-4)';
      });
    });

    box.querySelector('[data-add]').onclick = () => {
      if (!size) { toast('Choose a size first'); return; }
      cart.add(p.slug, size); openCart(); toast('Added to your bag');
    };
    const fav = box.querySelector('[data-fav2]');
    fav.onclick = () => { wishlist.toggle(p.slug); fav.textContent = wishlist.has(p.slug) ? 'Saved to wishlist' : 'Save for later'; };
    const fit = box.querySelector('[data-fit]');
    if (fit) fit.onclick = openFit;
  }

  function wireMTM() {
    const panel = document.getElementById('mtmPanel');
    if (!panel) return;
    const sel = { cloth: 'navy', pieces: '2', lapel: 'notch', lining: 'plain', buttons: 'horn' };
    const sw = document.getElementById('mtmSwatch');
    const img = document.getElementById('mtmImg');
    const nameEl = document.getElementById('clothName');
    const buildEl = document.getElementById('mtmBuild');
    const IMGS = { navy: 'carlo-navy', charcoal: 'charcoal-db', grey: 'carlo-mint-grey', blush: 'blush-pink-wool', linen: 'beige-linen', black: 'black-tuxedo' };

    function price() {
      const c = CLOTHS.find(x => x.id === sel.cloth);
      const add = (arr, v) => (arr.find(a => a[0] === v) || [, , 0])[2];
      return BASE + c.add + add(PIECES, sel.pieces) + add(LAPELS, sel.lapel) + add(LININGS, sel.lining) + add(BUTTONS, sel.buttons);
    }
    function paint() {
      const c = CLOTHS.find(x => x.id === sel.cloth);
      sw.style.background = c.hex;
      img.src = `assets/img/${IMGS[sel.cloth]}.jpg`;
      nameEl.textContent = c.name;
      const nm = (arr, v) => (arr.find(a => a[0] === v) || [, v])[1];
      buildEl.innerHTML = `
        <div><span>Base commission</span><span>${fmt(BASE)}</span></div>
        <div><span>${esc(c.name)}</span><span>${c.add ? (c.add > 0 ? '+' : '') + fmt(c.add) : 'Included'}</span></div>
        <div><span>${nm(PIECES, sel.pieces)}</span><span>${sel.pieces === '3' ? '+' + fmt(8000) : 'Included'}</span></div>
        <div><span>${nm(LAPELS, sel.lapel)} lapel</span><span>${(LAPELS.find(a => a[0] === sel.lapel)[2]) ? '+' + fmt(LAPELS.find(a => a[0] === sel.lapel)[2]) : 'Included'}</span></div>
        <div><span>${nm(LININGS, sel.lining)} lining</span><span>${(LININGS.find(a => a[0] === sel.lining)[2]) ? '+' + fmt(LININGS.find(a => a[0] === sel.lining)[2]) : 'Included'}</span></div>
        <div><span>${nm(BUTTONS, sel.buttons)} buttons</span><span>${(BUTTONS.find(a => a[0] === sel.buttons)[2]) ? '+' + fmt(BUTTONS.find(a => a[0] === sel.buttons)[2]) : 'Included'}</span></div>
        <div class="t"><span>Your commission</span><span>${fmt(price())}</span></div>`;
    }
    panel.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      panel.querySelectorAll(`[data-k="${k}"]`).forEach(x => x.classList.remove('on'));
      b.classList.add('on'); sel[k] = b.dataset.v; paint();
    });
    document.getElementById('mtmSubmit').onclick = () => {
      SH.addCommission({ ...sel, cloth: CLOTHS.find(c => c.id === sel.cloth).name, price: price(), monogram: (document.getElementById('mono').value || '').toUpperCase() });
      toast('Commission reserved - we will call you');
      go('/account');
    };
    paint();
  }

  function wireCheckout() {
    const f = document.getElementById('coForm');
    if (!f) return; // empty bag: V.checkout falls back to the cart view, so there is nothing to wire
    const mark = (wrap) => wrap.querySelectorAll('.rc').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    const ship = document.getElementById('shipOpts'), pay = document.getElementById('payOpts');
    ship.onchange = () => {
      mark(ship);
      const pick = f.ship.value === 'pickup';
      document.getElementById('shipFields').classList.toggle('hide', pick);
      document.getElementById('pickupField').classList.toggle('hide', !pick);
    };
    pay.onchange = () => { mark(pay); document.getElementById('mpesaBox').classList.toggle('hide', f.pay.value !== 'M-Pesa'); };
    f.onsubmit = e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const btn = f.querySelector('button[type=submit],button:not([type])');
      if (d.pay === 'M-Pesa') {
        // Build the real Daraja STK Push body. Live mode POSTs this to Safaricom; demo mode
        // resolves it locally with the same result codes Safaricom returns.
        const phone = d.mpesa || d.phone;
        const push = SH.mpesaStkPush({
          phone: phone, amount: cart.total,
          reference: 'SH-' + Date.now().toString().slice(-6),
          description: "Sir Henry's online order"
        });
        btn.disabled = true;
        showStk(phone, cart.total);
        setTimeout(() => {
          const res = SH.mpesaResolve(push.checkoutId, 'success');
          if (res.ResultCode !== 0) {
            hideStk(); btn.disabled = false;
            toast(res.ResultDesc);
            return;
          }
          const o = SH.placeOrder({ customer: { name: d.name, email: d.email, phone: d.phone },
            payment: d.pay, branch: d.branch, alterations: d.alterations });
          o.mpesaReceipt = res.MpesaReceiptNumber;
          SH.emit();
          hideStk();
          go('/order/' + o.id);
        }, 2600);
        return;
      }
      const o = SH.placeOrder({ customer: { name: d.name, email: d.email, phone: d.phone }, payment: d.pay, branch: d.branch, alterations: d.alterations });
      go('/order/' + o.id);
    };
  }

  function wireWedding() {
    const mEl = document.getElementById('wMembers'), qEl = document.getElementById('wQuote');
    if (!mEl || !qEl) return;
    let slug = PRODUCTS.filter(p => p.category === 'suits')[1].slug;
    const members = [];

    function paint() {
      mEl.innerHTML = members.length ? members.map((m, i) => `
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;
          padding:9px 0;border-bottom:1px solid var(--line)">
          <div><b style="font-size:13px">${esc(m.name)}</b><br>
            <span class="muted" style="font-size:11.5px">${esc(m.role)}</span></div>
          <span class="tag" style="background:var(--bone)">${esc(m.size)}</span>
          <button type="button" data-del="${i}" style="border:0;background:none;cursor:pointer;
            color:var(--ink-4);font-size:16px;line-height:1">&times;</button>
        </div>`).join('')
        : '<p class="muted" style="font-size:13px;margin:0">Nobody added yet. Start with the groom.</p>';

      const p = byId(slug);
      const n = members.length;
      const d = SH.groupDiscount(n);
      const gross = p.price * n;
      const save = gross * d;
      qEl.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
          <img src="${p.images[0]}" style="width:56px;aspect-ratio:3/4;object-fit:cover" alt="">
          <div><b style="font-size:13px">${esc(p.title.split(' - ')[0])}</b><br>
            <span class="muted" style="font-size:12px">${fmt(p.price)} each</span></div></div>
        <div class="build" style="border-top:0;margin:0;padding:0">
          <div><span>${n} suit${n === 1 ? '' : 's'}</span><span>${fmt(gross)}</span></div>
          <div><span>Group discount${d ? ' (' + (d * 100) + '%)' : ''}</span>
            <span style="color:${d ? 'var(--bronze)' : ''}">${d ? '-' + fmt(save) : 'Add 2+ to unlock'}</span></div>
          <div><span>Alterations for all</span><span>Included</span></div>
          <div><span>Matched from one bolt</span><span>Included</span></div>
          <div class="t"><span>Party total</span><span>${fmt(gross - save)}</span></div>
        </div>
        ${n >= 2 && n < 8 ? `<p class="muted" style="font-size:11.5px;margin-top:10px">
          Add ${n < 4 ? 4 - n : n < 6 ? 6 - n : 8 - n} more to reach ${n < 4 ? '10' : n < 6 ? '15' : '20'}% off.</p>` : ''}`;

      mEl.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { members.splice(+b.dataset.del, 1); paint(); });
    }

    document.getElementById('wSuits').querySelectorAll('[data-suit]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-suit]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); slug = b.dataset.suit; paint();
    });

    document.getElementById('wAdd').onclick = () => {
      const name = document.getElementById('wName').value.trim();
      if (!name) { toast('Add a name first'); return; }
      members.push({ name, role: document.getElementById('wRole').value, size: document.getElementById('wSize').value });
      document.getElementById('wName').value = '';
      paint();
    };

    document.getElementById('wForm').onsubmit = e => {
      e.preventDefault();
      if (!members.length) { toast('Add at least one person to the party'); return; }
      const d = Object.fromEntries(new FormData(e.target));
      SH.addGroup({ ...d, slug, members: members.slice() });
      toast('Quote requested - we will call the organiser');
      go('/account');
    };
    paint();
  }

  /* The STK wait is the moment a Kenyan checkout either works or loses the sale, so it
     gets a real screen rather than a spinner: what to look for, and how to recover. */
  function showStk(phone, amount) {
    let el = document.getElementById('stk');
    if (!el) {
      el = document.createElement('div');
      el.id = 'stk';
      document.body.appendChild(el);
    }
    el.innerHTML = `<div class="stk-card">
      <div class="stk-pulse"><span></span><span></span><span></span></div>
      <h3>Check your phone</h3>
      <p>We have sent a payment request for <b>${fmt(amount)}</b> to <b>${esc(phone)}</b>.</p>
      <p class="stk-do">Enter your M-Pesa PIN to confirm.</p>
      <div class="stk-note">Did not get it? Dial <b>*334#</b> or tap Resend after 30 seconds.</div>
    </div>`;
    el.classList.add('on');
    if (window.Motion) Motion.stopScroll();
  }
  function hideStk() {
    const el = document.getElementById('stk');
    if (el) el.classList.remove('on');
    if (window.Motion) Motion.startScroll();
  }

  /* ---------- size finder ---------- */
  function openFit() {
    const m = document.getElementById('fitModal');
    m.classList.add('on');
    document.getElementById('scrim').classList.add('on');
    if (window.Motion) Motion.stopScroll();
  }

  /* ---------- chrome (header/cart drawer) ---------- */
  function syncChrome() {
    document.querySelectorAll('[data-cartcount]').forEach(e => {
      e.textContent = cart.count;
      e.style.display = cart.count ? '' : 'none';
    });
    const d = document.getElementById('cartBody');
    if (!d) return;
    d.innerHTML = state.cart.length ? state.cart.map(l => {
      const p = byId(l.slug);
      return `<div class="cl"><a href="#/product/${p.slug}"><img src="${p.images[0]}" alt=""></a>
        <div><div class="ti">${esc(p.title)}</div><div class="mt">Size ${l.size}</div>
          <div class="qty"><button data-q="-" data-s="${l.slug}" data-z="${l.size}">-</button>
          <span>${l.qty}</span><button data-q="+" data-s="${l.slug}" data-z="${l.size}">+</button></div></div>
        <div style="text-align:right"><b style="font-size:12.5px">${fmt(p.price * l.qty)}</b><br>
        <button data-rm="${l.slug}" data-z="${l.size}" style="border:0;background:none;cursor:pointer;
          color:var(--ink-4);font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-top:8px">Remove</button></div></div>`;
    }).join('') : '<p class="muted" style="padding:40px 0;text-align:center">Your bag is empty.</p>';
    document.getElementById('cartSub').textContent = fmt(cart.subtotal);
    document.getElementById('cartShip').textContent = cart.shipping ? fmt(cart.shipping) : 'Free';
    document.getElementById('cartTot').textContent = fmt(cart.total);
    const wa = document.getElementById('waOrder');
    if (wa) { wa.href = waBasket(); wa.style.display = state.cart.length ? '' : 'none'; }
  }

  const openCart = () => {
    document.getElementById('cartDrawer').classList.add('on');
    document.getElementById('scrim').classList.add('on');
    if (window.Motion) Motion.stopScroll();      // lock the page behind the drawer
  };
  const closeAll = () => {
    document.querySelectorAll('.drawer,.mnav,#fitModal').forEach(e => e.classList.remove('on'));
    document.getElementById('scrim').classList.remove('on');
    if (window.Motion) Motion.startScroll();
  };

  /* ---------- global delegated events ---------- */
  document.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) { e.preventDefault(); wishlist.toggle(fav.dataset.fav); fav.classList.toggle('on'); return; }

    const quick = e.target.closest('[data-quick]');
    if (quick) { e.preventDefault(); cart.add(quick.dataset.quick, quick.dataset.size); openCart(); toast('Added to your bag'); return; }

    const q = e.target.closest('[data-q]');
    if (q) {
      const line = state.cart.find(l => l.slug === q.dataset.s && l.size === q.dataset.z);
      if (line) cart.setQty(q.dataset.s, q.dataset.z, line.qty + (q.dataset.q === '+' ? 1 : -1));
      if (location.hash.startsWith('#/cart') || location.hash.startsWith('#/checkout')) render();
      return;
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      cart.remove(rm.dataset.rm, rm.dataset.z);
      if (location.hash.startsWith('#/cart') || location.hash.startsWith('#/checkout')) render();
      return;
    }
    if (e.target.closest('[data-opencart]')) { openCart(); return; }
    if (e.target.closest('[data-close]') || e.target.id === 'scrim') { closeAll(); return; }
    if (e.target.closest('[data-menu]')) { document.getElementById('mnav').classList.add('on'); document.getElementById('scrim').classList.add('on'); if (window.Motion) Motion.stopScroll(); return; }
    if (e.target.closest('.mnav a')) closeAll();
  });

  window.addEventListener('sh:change', syncChrome);
  window.addEventListener('hashchange', render);

  // newsletter + size finder live outside the router
  document.addEventListener('submit', e => {
    if (e.target.id === 'subForm') { e.preventDefault(); e.target.reset(); toast('Subscribed - welcome to the house'); }
    if (e.target.id === 'fitForm') {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      const chest = +d.chest, h = +d.height;
      let size = Math.min(58, Math.max(46, Math.round((chest + 4) / 2 / 2) * 2));
      const drop = h > 185 ? ' (ask for a Long)' : h < 170 ? ' (ask for a Short)' : '';
      document.getElementById('fitOut').innerHTML =
        `<div class="eyebrow" style="margin-bottom:8px">Your size</div>
         <div style="font-size:34px;font-weight:700">${size}${drop}</div>
         <p class="muted" style="font-size:12.5px;margin-top:10px">Based on a ${chest}cm chest and ${h}cm height.
         Alterations are free, so if you are between sizes take the larger one.</p>`;
    }
  });

  render();
})();
