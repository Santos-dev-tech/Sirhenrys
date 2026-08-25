/* Sir Henry's - staff console */
(() => {
  'use strict';
  const { PRODUCTS, CATEGORIES, BRANCHES, STATUSES, byId, fmt, state } = SH;
  /* The console shares a document with the storefront now, so everything here is
     addressed inside #ad. Nothing may touch document.body: this used to replace it
     outright to draw the login gate, which in a merged page would delete the shop. */
  const BASE = '/admin';
  const AD = document.getElementById('ad');
  // #view is replaced wholesale whenever the login gate tears the shell down and puts
  // it back, so this is re-resolved at those two points rather than cached forever.
  let view = AD.querySelector('#view');
  const reshell = () => { AD.innerHTML = SHELL; AD.classList.remove('locked');
                          view = AD.querySelector('#view'); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KSh = n => 'KSh ' + Math.round(n).toLocaleString('en-KE');

  /* The toast owns one element and holds a reference to it.

     It used to look itself up with querySelector('.notice'), which is the first
     element with that class anywhere in the document - and the corporate panel
     renders a banner with the same class. So the toast wrote into the banner,
     render() then destroyed that node, and the 2.4s timer cleared something that
     was no longer on the page while a fresh copy sat there permanently. Pressing
     Quoted left a message stuck at the bottom of the screen.

     Kept on AD rather than inside #view, because #view is replaced wholesale on
     every route change and a toast should outlive the render that raised it. */
  let tT, toastEl = null;
  function toast(m) {
    if (!toastEl || !AD.contains(toastEl)) {
      toastEl = document.createElement('div');
      toastEl.className = 'ad-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      AD.appendChild(toastEl);
    }
    toastEl.textContent = m;
    toastEl.classList.add('on');
    clearTimeout(tT);
    tT = setTimeout(() => toastEl && toastEl.classList.remove('on'), 2400);
  }

  const statusPill = s => {
    const m = { 'Confirmed': 'info', 'In Workshop': 'warn', 'Ready for Fitting': 'warn', 'Out for Delivery': 'info', 'Delivered': 'ok', 'Cancelled': 'bad' };
    return `<span class="pill ${m[s] || 'grey'}">${esc(s)}</span>`;
  };

  /* ---------- derived metrics ---------- */
  const revenue = () => state.orders.filter(o => o.status !== 'Cancelled').reduce((a, o) => a + o.total, 0);
  // A size sitting at zero in one store while another store holds plenty is the signal
  // that actually loses sales in multi-branch retail. Surface it as a transfer.
  const transfers = () => {
    const out = [];
    PRODUCTS.forEach(p => p.sizes.forEach(s => {
      const per = p.stock[s];
      const empty = BRANCHES.filter(b => per[b.id] === 0);
      if (!empty.length) return;
      const best = BRANCHES.slice().sort((a, b) => per[b.id] - per[a.id])[0];
      if (per[best.id] < 3) return;
      empty.forEach(e => out.push({ p, s, from: best, to: e, have: per[best.id] }));
    }));
    return out;
  };

  function last7() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = d.getTime() + 86400000;
      const v = state.orders.filter(o => o.date >= d.getTime() && o.date < next).reduce((a, o) => a + o.total, 0);
      days.push({ label: d.toLocaleDateString('en-GB', { weekday: 'short' }), v });
    }
    // give the demo a believable shape when seeded orders are sparse
    const base = [82000, 61000, 104000, 47000, 133000, 96000, 71000];
    return days.map((d, i) => ({ ...d, v: d.v + base[i] }));
  }

  function barChart(data) {
    const max = Math.max(...data.map(d => d.v)) * 1.15 || 1;
    const w = 100 / data.length;
    return `<svg class="chart" viewBox="0 0 100 46" preserveAspectRatio="none">
      ${data.map((d, i) => {
        const h = (d.v / max) * 34;
        return `<rect class="bar" x="${i * w + w * .22}" y="${38 - h}" width="${w * .56}" height="${h}"><title>${d.label}: ${KSh(d.v)}</title></rect>
                <text x="${i * w + w * .5}" y="44" text-anchor="middle">${d.label}</text>`;
      }).join('')}
    </svg>`;
  }

  /* ================= staff authentication =================
     Rewritten against the five things a login usually gets wrong. Each is named
     where it is handled, so the next person can see what is deliberate:

       1. the session token           -> sessionStorage, no secret inside it, an
                                         expiry and an idle timeout checked on
                                         every render
       2. client-side admin checks    -> this gate only DRAWS the console;
                                         firestore.rules decides whether it can
                                         read a thing. The banner says which of
                                         the two is actually in force right now.
       3. no second factor            -> TOTP, six digits, thirty second step
       4. no rate limiting            -> five tries per person, then a lockout
                                         that doubles each time it is hit
       5. no strength check           -> a four-digit PIN cannot have one, so it
                                         is backed by the factor above rather
                                         than pretended at

     Everything here is a user interface over the server rule. It stops the
     accident and the casual poke. It is not the security boundary and does not
     claim to be. */

  function currentStaff() { return SHSec.session.read(); }

  // Verify a PIN against the stored PBKDF2 hash. Returns the staff record on a
  // match so the caller can move on to the second factor. Nothing is issued here.
  async function checkPin(id, pin) {
    const m = SH.STAFF.find(s => s.id === id);
    if (!m) return null;
    const v = SHSec.validate(pin, 'pin');
    if (!v.ok) return null;
    const got = await SHSec.pbkdf2(v.value, m.salt);
    return SHSec.safeEqual(got, m.hash) ? m : null;
  }

  function startSession(m) {
    const { salt, hash, totp, ...safe } = m;      // no credential material in the token
    const tok = SHSec.session.issue(safe);
    SHSec.limiter.reset('staff:' + m.id);
    SHSec.audit.log('sign-in', m.id);
    return tok;
  }

  function signOut() {
    const s = currentStaff();
    SHSec.audit.log('sign-out', s ? s.id : '');
    SHSec.session.clear();
    location.hash = '#/'; location.reload();
  }

  const can = (view) => {
    const s = currentStaff();
    return !!s && (SH.ROLE_VIEWS[s.role] || []).includes(view);
  };

  /* The one check here that is not theatre. Asks Google what claims sit on this
     ID token; a staff claim can only be written with the Admin SDK. Cached for
     the life of the page because it costs a network round trip. */
  let gatePromise = null;
  const serverGate = () => (gatePromise = gatePromise || SHSec.serverGate());

  async function securityBanner() {
    const g = await serverGate();
    const box = document.getElementById('secbar');
    if (!box) return g;
    if (g.available && g.staff) { box.remove(); return g; }
    box.className = 'secbar';
    box.innerHTML = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 8v5M12 17h.01M10.3 3.9L2.6 17.4A2 2 0 004.3 20.4h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>' +
      '<span><b>Demo mode.</b> There is no staff claim on this account, so the server ' +
      'is not enforcing who you are and this gate is the only thing standing here. Run ' +
      '<code>tools/set-staff-claims.js</code>, then swap <code>isSignedIn()</code> for ' +
      '<code>isStaff()</code> in firestore.rules before this holds real orders.</span>';
    return g;
  }

  function renderLogin(msg) {
    AD.classList.add('locked');
    const demo = SH_SECURITY.demoHints;
    AD.innerHTML =
      '<div class="login"><div class="login-card">' +
        '<div class="login-mark">SIR HENRY\'S<small>Staff Console</small></div>' +
        '<p class="login-hint">' + esc(msg || 'Sign in to continue.') + '</p>' +
        '<div class="login-list">' +
          SH.STAFF.map(s => '<button class="login-who" data-staff="' + esc(s.id) + '">' +
            '<b>' + esc(s.name) + '</b><span>' + esc(s.title) + '</span></button>').join('') +
        '</div>' +
        '<form id="pinForm" class="hide" autocomplete="off">' +
          '<div class="field"><label id="pinWho" for="pinInput">PIN</label>' +
            '<input id="pinInput" type="password" inputmode="numeric" maxlength="4" ' +
                   'autocomplete="off" spellcheck="false" data-v="pin" placeholder="4-digit PIN"></div>' +
          '<div class="field hide" id="otpField"><label for="otpInput">Authenticator code</label>' +
            '<input id="otpInput" type="text" inputmode="numeric" maxlength="6" ' +
                   'autocomplete="one-time-code" spellcheck="false" data-v="otp" placeholder="6-digit code">' +
            (demo ? '<div class="otp-row"><span class="otp-left" id="otpDemo"></span></div>' : '') +
          '</div>' +
          '<button class="btn" style="width:100%" id="pinGo">Continue</button>' +
          '<p class="login-err hide" id="pinErr">That PIN is not right.</p>' +
          '<p class="login-lock hide" id="pinLock"></p>' +
          '<button type="button" class="login-back" id="pinBack">Choose someone else</button>' +
        '</form>' +
        (demo ? '<p class="login-demo">Demo PINs &mdash; Owner 1967 &middot; Manager 2468 &middot; ' +
          'Shop floor 1357. The authenticator code appears above the button while ' +
          '<code>SH_SECURITY.demoHints</code> is on.</p>' : '') +
      '</div></div>';

    let who = null, stage = 'pin', verified = null, otpTimer = 0;
    const err = m => { const e = AD.querySelector('#pinErr'); e.textContent = m; e.classList.remove('hide'); };
    const lock = m => { const e = AD.querySelector('#pinLock'); e.textContent = m || ''; e.classList.toggle('hide', !m); };

    AD.querySelectorAll('[data-staff]').forEach(b => b.onclick = () => {
      who = b.dataset.staff;
      AD.querySelector('.login-list').classList.add('hide');
      AD.querySelector('#pinForm').classList.remove('hide');
      AD.querySelector('#pinWho').textContent = 'PIN for ' + SH.STAFF.find(s => s.id === who).name;
      AD.querySelector('#pinInput').focus();
      const st = SHSec.limiter.check('staff:' + who);
      if (!st.ok) lock(st.error);
    });

    AD.querySelector('#pinBack').onclick = () => { clearInterval(otpTimer); reshell(); renderLogin(); };

    AD.querySelector('#pinForm').onsubmit = async e => {
      e.preventDefault();
      const btn = AD.querySelector('#pinGo');
      const gate = SHSec.limiter.check('staff:' + who);
      if (!gate.ok) { lock(gate.error); return; }

      btn.disabled = true;
      try {
        if (stage === 'pin') {
          const m = await checkPin(who, AD.querySelector('#pinInput').value);
          if (!m) {
            const r = SHSec.limiter.fail('staff:' + who);
            SHSec.audit.log('sign-in-fail', who);
            AD.querySelector('#pinInput').value = '';
            AD.querySelector('#pinInput').focus();
            if (!r.ok) { err('That PIN is not right.'); lock(r.error); }
            else { err('That PIN is not right. ' + r.left + ' attempt' + (r.left === 1 ? '' : 's') + ' left.'); lock(''); }
            return;
          }
          // The PIN was right. Nothing is issued until the second factor is in.
          verified = m; stage = 'otp';
          AD.querySelector('#pinErr').classList.add('hide');
          AD.querySelector('#pinInput').closest('.field').classList.add('hide');
          AD.querySelector('#otpField').classList.remove('hide');
          AD.querySelector('#pinWho').textContent = 'Authenticator code for ' + m.name;
          btn.textContent = 'Sign in';
          AD.querySelector('#otpInput').focus();
          if (SH_SECURITY.demoHints) {
            const paint = async () => {
              const el = AD.querySelector('#otpDemo');
              if (!el) { clearInterval(otpTimer); return; }
              const code = await SHSec.totp.now(m.totp);
              el.textContent = 'Demo code ' + code + ' - ' + SHSec.totp.secondsLeft() + 's left';
            };
            paint(); otpTimer = setInterval(paint, 1000);
          }
          return;
        }

        const code = AD.querySelector('#otpInput').value;
        if (!(await SHSec.totp.verify(verified.totp, code))) {
          const r = SHSec.limiter.fail('staff:' + who);
          SHSec.audit.log('otp-fail', who);
          AD.querySelector('#otpInput').value = '';
          AD.querySelector('#otpInput').focus();
          if (!r.ok) { err('That code is not right.'); lock(r.error); }
          else { err('That code is not right. ' + r.left + ' attempt' + (r.left === 1 ? '' : 's') + ' left.'); }
          return;
        }
        clearInterval(otpTimer);
        startSession(verified);
        reshell(); render();
      } finally { btn.disabled = false; }
    };
  }

  /* ================= barcode rendering =================
     EAN-13 drawn as SVG bars from the encoding tables - no library, and it scans. */
  const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1101110','1100010','1110100'];
  const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  function barcodeSVG(code, h = 46) {
    if (!/^\d{13}$/.test(code)) return '';
    let bits = '101';
    const par = PARITY[+code[0]];
    for (let i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? EAN_L : EAN_G)[+code[i]];
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += EAN_R[+code[i]];
    bits += '101';
    let x = 0, rects = '';
    for (const b of bits) { if (b === '1') rects += `<rect x="${x}" y="0" width="1" height="${h}"/>`; x++; }
    return `<svg class="bc" viewBox="0 0 ${bits.length} ${h + 11}" preserveAspectRatio="none" role="img"
      aria-label="Barcode ${code}"><g fill="#151515">${rects}</g>
      <text x="${bits.length / 2}" y="${h + 9}" text-anchor="middle" font-size="8"
        font-family="monospace" fill="#151515">${code}</text></svg>`;
  }

  /* ---------- views ---------- */
  const V = {};

  /* ================= POS - the till =================
     Replaces Shopify POS Pro at $89/store/month x 5. Scan or search, take payment,
     complete - and the branch stock and the storefront both update from that one action. */
  let posBasket = [], posBranch = null, posPay = 'M-Pesa';

  V.pos = () => {
    const staff = currentStaff();
    posBranch = posBranch || (staff && staff.store) || BRANCHES[0].id;
    const b = BRANCHES.find(x => x.id === posBranch) || BRANCHES[0];
    const total = posBasket.reduce((a, l) => a + l.price * l.qty, 0);
    const count = posBasket.reduce((a, l) => a + l.qty, 0);
    return `
    <div class="top"><div><h1>Till</h1><p>Serving from ${esc(b.name)} &middot; ${esc(staff ? staff.name : '')}</p></div>
      <div class="fbar">${BRANCHES.map(x => `<button class="chip ${x.id === posBranch ? 'on' : ''}"
        data-posbranch="${x.id}">${esc(x.name.split(',')[0])}</button>`).join('')}</div></div>

    <div class="pos">
      <div class="pos-left">
        <div class="panel"><div class="panel-bd">
          <div class="field" style="margin:0">
            <label>Scan a barcode or search</label>
            <input id="posScan" class="pos-scan" autocomplete="off"
              placeholder="Scan tag, or type a name / SKU..." autofocus>
          </div>
          <div id="posResults" class="pos-results"></div>
        </div></div>
      </div>

      <div class="pos-right">
        <div class="panel pos-basket"><div class="panel-hd"><b>Basket</b>
          <span class="pill grey">${count} item${count === 1 ? '' : 's'}</span></div>
          <div class="panel-bd" style="padding:0" id="posLines">
            ${posBasket.length ? posBasket.map((l, i) => {
              const p = byId(l.slug);
              return `<div class="pos-line">
                <img class="thumb" src="${(p.thumbs || p.images)[0]}" alt="">
                <div><b>${esc(p.title)}</b><span>Size ${esc(l.size)} &middot; ${KSh(l.price)}</span></div>
                <div class="pos-qty">
                  <button data-posq="-1" data-i="${i}">&minus;</button><span>${l.qty}</span>
                  <button data-posq="1" data-i="${i}">+</button>
                </div>
                <b class="pos-lt">${KSh(l.price * l.qty)}</b>
                <button class="pos-x" data-posrm="${i}" aria-label="Remove">&times;</button>
              </div>`; }).join('')
              : '<div class="empty">Scan a tag to begin.</div>'}
          </div>
          <div class="pos-foot">
            <div class="pos-total"><span>Total</span><b>${KSh(total)}</b></div>
            <div class="fbar" style="margin:12px 0">
              ${['M-Pesa', 'Card', 'Cash'].map(m => `<button class="chip ${posPay === m ? 'on' : ''}" data-pospay="${m}">${m}</button>`).join('')}
            </div>
            <div id="posPayBox">${posPayBox(total)}</div>
          </div>
        </div>
      </div>
    </div>`;
  };

  function posPayBox(total) {
    if (!total) return '';
    if (posPay === 'M-Pesa') return `
      <div class="field" style="margin:0 0 10px"><label>Customer phone</label>
        <input id="posPhone" placeholder="07xx xxx xxx" inputmode="tel"></div>
      <button class="btn" style="width:100%" id="posComplete">Send STK push &middot; ${KSh(total)}</button>
      <p class="pos-note">A prompt goes to the customer phone. They enter their M-Pesa PIN.</p>`;
    if (posPay === 'Cash') return `
      <div class="field" style="margin:0 0 10px"><label>Cash received</label>
        <input id="posCash" type="number" inputmode="numeric" placeholder="${Math.ceil(total / 100) * 100}"></div>
      <div class="pos-change" id="posChange">Change: &mdash;</div>
      <button class="btn" style="width:100%" id="posComplete">Complete sale &middot; ${KSh(total)}</button>`;
    return `<button class="btn" style="width:100%" id="posComplete">Charge card &middot; ${KSh(total)}</button>`;
  }

  function wirePos() {
    const scan = document.getElementById('posScan');
    const results = document.getElementById('posResults');
    if (!scan) return;

    const draw = (list) => {
      results.innerHTML = list.length ? list.map(h => `
        <button class="pos-hit" data-add="${h.p.slug}" data-size="${esc(h.size)}" ${h.n ? '' : 'disabled'}>
          <img class="thumb" src="${(h.p.thumbs || h.p.images)[0]}" alt="">
          <div><b>${esc(h.p.title)}</b><span>Size ${esc(h.size)} &middot; ${SH.skuFor(h.p.slug, h.size)}</span></div>
          <span class="pill ${h.n ? (h.n <= 2 ? 'warn' : 'ok') : 'bad'}">${h.n ? h.n + ' here' : 'none here'}</span>
          <b>${KSh(h.p.price)}</b>
        </button>`).join('') : '<div class="empty">Nothing matches.</div>';
      results.querySelectorAll('[data-add]').forEach(b =>
        b.onclick = () => addToBasket(b.dataset.add, b.dataset.size));
    };

    const runSearch = (q) => {
      q = q.trim();
      if (!q) { results.innerHTML = ''; return; }
      // a scanner types the whole code then hits Enter, so try an exact code match first
      const hit = SH.lookupCode(q);
      if (hit) { addToBasket(hit.product.slug, hit.size); scan.value = ''; results.innerHTML = ''; return; }
      const ql = q.toLowerCase();
      const list = [];
      PRODUCTS.forEach(p => {
        if (!(p.title + ' ' + p.slug).toLowerCase().includes(ql)) return;
        p.sizes.forEach(size => list.push({ p: p, size: size, n: SH.stockAt(p.slug, size, posBranch) }));
      });
      draw(list.slice(0, 24));
    };

    scan.oninput = () => runSearch(scan.value);
    scan.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); runSearch(scan.value); } };

    view.querySelectorAll('[data-posbranch]').forEach(b => b.onclick = () => { posBranch = b.dataset.posbranch; render(); });
    view.querySelectorAll('[data-pospay]').forEach(b => b.onclick = () => { posPay = b.dataset.pospay; render(); });
    view.querySelectorAll('[data-posq]').forEach(b => b.onclick = () => {
      const l = posBasket[+b.dataset.i];
      const max = SH.stockAt(l.slug, l.size, posBranch);
      l.qty = Math.max(1, Math.min(max, l.qty + (+b.dataset.posq)));
      render();
    });
    view.querySelectorAll('[data-posrm]').forEach(b => b.onclick = () => { posBasket.splice(+b.dataset.posrm, 1); render(); });

    const cash = document.getElementById('posCash');
    if (cash) cash.oninput = () => {
      const t = posBasket.reduce((a, l) => a + l.price * l.qty, 0);
      const c = +cash.value || 0;
      document.getElementById('posChange').textContent =
        c >= t ? 'Change: ' + KSh(c - t) : 'Short by ' + KSh(t - c);
    };

    const done = document.getElementById('posComplete');
    if (done) done.onclick = () => completeSale(done);
  }

  function addToBasket(slug, size) {
    const have = SH.stockAt(slug, size, posBranch);
    if (!have) { toast('None of that size at this store'); return; }
    const line = posBasket.find(l => l.slug === slug && l.size === size);
    if (line) {
      if (line.qty >= have) { toast('Only ' + have + ' in stock here'); return; }
      line.qty++;
    } else {
      posBasket.push({ slug: slug, size: size, qty: 1, price: byId(slug).price });
    }
    render();
    const s = document.getElementById('posScan'); if (s) { s.value = ''; s.focus(); }
  }

  function completeSale(btn) {
    const total = posBasket.reduce((a, l) => a + l.price * l.qty, 0);
    if (!total) return;
    const staff = currentStaff();
    const finish = (receipt) => {
      const sale = SH.recordSale({ lines: posBasket.slice(), branch: posBranch,
        payment: posPay, staff: staff ? staff.name : 'Staff', mpesaReceipt: receipt });
      posBasket = [];
      showReceipt(sale);
      render();
    };

    if (posPay === 'M-Pesa') {
      const el = document.getElementById('posPhone');
      const phone = el ? el.value : '';
      if (String(phone).replace(/\D/g, '').length < 9) { toast('Enter the customer phone number'); return; }
      const push = SH.mpesaStkPush({ phone: phone, amount: total, reference: 'SH-TILL', description: 'In-store purchase' });
      btn.disabled = true; btn.textContent = 'Waiting for PIN...';
      setTimeout(() => {
        const res = SH.mpesaResolve(push.checkoutId, 'success');
        if (res.ResultCode === 0) finish(res.MpesaReceiptNumber);
        else { btn.disabled = false; toast(res.ResultDesc); }
      }, 1600);
      return;
    }
    if (posPay === 'Cash') {
      const el = document.getElementById('posCash');
      const c = el ? (+el.value || 0) : 0;
      if (c < total) { toast('Cash received is less than the total'); return; }
    }
    finish(null);
  }

  function showReceipt(sale) {
    const b = BRANCHES.find(x => x.id === sale.branch);
    document.getElementById('dwTitle').textContent = sale.id;
    document.getElementById('dwBody').innerHTML = `
      <div class="receipt">
        <div class="r-mark">SIR HENRY&rsquo;S</div>
        <div class="r-sub">${esc(b ? b.name : '')}<br>${esc(b ? b.tel : '')}</div>
        <div class="r-rule"></div>
        ${sale.lines.map(l => { const p = byId(l.slug); return `
          <div class="r-line"><span>${esc(p.title)}<br><i>Size ${esc(l.size)} &times; ${l.qty}</i></span>
          <b>${KSh(l.price * l.qty)}</b></div>`; }).join('')}
        <div class="r-rule"></div>
        <div class="r-line r-total"><span>Total</span><b>${KSh(sale.total)}</b></div>
        <div class="r-line"><span>Paid by ${esc(sale.payment)}</span>
          <b>${sale.mpesaReceipt ? esc(sale.mpesaReceipt) : ''}</b></div>
        <div class="r-rule"></div>
        <div class="r-foot">Served by ${esc(sale.staff)}<br>
          ${new Date(sale.date).toLocaleString('en-GB')}<br><br>
          Complimentary alterations on all suits, for life.<br>Thank you.</div>
      </div>`;
    const save = document.getElementById('dwSave');
    save.textContent = 'Print';
    save.onclick = () => window.print();
    document.getElementById('dw').classList.add('on');
    AD.querySelector('#scrim').classList.add('on');
  }

  V.dashboard = () => {
    const orders = state.orders;
    const aov = orders.length ? revenue() / orders.length : 0;
    const low = transfers();
    const pend = orders.filter(o => o.status !== 'Delivered').length;
    return `
    <div class="top"><div><h1>Dashboard</h1><p>${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
      <a class="btn ghost" href="#/">View storefront</a></div>

    <div class="kpis">
      <div class="kpi"><div class="l">Revenue (7d)</div><div class="v">${KSh(last7().reduce((a, d) => a + d.v, 0))}</div><div class="d up">&uarr; 12.4% on last week</div></div>
      <div class="kpi"><div class="l">Orders</div><div class="v">${orders.length}</div><div class="d">${pend} still to fulfil</div></div>
      <div class="kpi"><div class="l">Average order</div><div class="v">${KSh(aov)}</div><div class="d up">&uarr; 4.1%</div></div>
      <div class="kpi"><div class="l">Stock-outs</div><div class="v" style="${low.length ? 'color:var(--bad)' : ''}">${low.length}</div><div class="d">sizes empty in one store, in stock in another</div></div>
      <div class="kpi"><div class="l">Fittings booked</div><div class="v">${state.appointments.length}</div><div class="d">${state.appointments.filter(a => a.status === 'Requested').length} awaiting confirmation</div></div>
      <div class="kpi"><div class="l">Commissions</div><div class="v">${state.commissions.length}</div><div class="d">Made-to-measure in progress</div></div>
      <div class="kpi"><div class="l">Group suits</div><div class="v">${state.groups.reduce((a, g) => a + g.members.length, 0)}</div><div class="d">across ${state.groups.length} wedding/group quote${state.groups.length === 1 ? '' : 's'}</div></div>
    </div>

    <div class="cols">
      <div class="panel"><div class="panel-hd"><b>Revenue, last 7 days</b><span class="pill grey">All branches</span></div>
        <div class="panel-bd">${barChart(last7())}</div></div>
      <div class="panel"><div class="panel-hd"><b>Suggested transfers</b><span class="pill warn">${low.length}</span></div>
        <div class="panel-bd" style="padding:0">
          ${low.length ? `<table><tbody>${low.slice(0, 6).map(x => `<tr>
            <td><div class="tw"><img class="thumb" src="${(x.p.thumbs||x.p.images)[0]}" alt=""><div>
              <b>${esc(x.p.title)}</b><span>Size ${x.s} &middot; ${esc(x.to.name.split(',')[0])} is out</span></div></div></td>
            <td class="num" style="white-space:nowrap"><span class="pill ok">${x.have} at ${esc(x.from.name.split(',')[0])}</span></td></tr>`).join('')}</tbody></table>`
          : '<div class="empty">Every size is covered at every store.</div>'}
        </div></div>
    </div>

    <div class="panel"><div class="panel-hd"><b>Recent orders</b><a class="btn ghost sm" href="#/admin/orders">All orders</a></div>
      <table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th class="num">Total</th></tr></thead>
      <tbody>${orders.slice(0, 6).map(o => `<tr data-order="${o.id}" style="cursor:pointer">
        <td><b>${o.id}</b><br><span style="font-size:11px;color:var(--ink-4)">${new Date(o.date).toLocaleDateString('en-GB')}</span></td>
        <td>${esc(o.customer.name)}<br><span style="font-size:11px;color:var(--ink-4)">${esc(o.customer.phone)}</span></td>
        <td>${o.items.reduce((a, i) => a + i.qty, 0)}</td>
        <td>${o.payment === 'M-Pesa' ? '<span class="pill ok">M-Pesa</span>' : esc(o.payment)}</td>
        <td>${statusPill(o.status)}</td><td class="num"><b>${KSh(o.total)}</b></td></tr>`).join('')}</tbody></table></div>`;
  };

  V.orders = (q) => {
    const f = new URLSearchParams(q || '').get('status');
    const list = f ? state.orders.filter(o => o.status === f) : state.orders;
    return `<div class="top"><div><h1>Orders</h1><p>${list.length} order${list.length === 1 ? '' : 's'}</p></div></div>
      <div class="panel"><div class="panel-hd"><div class="fbar">
        <a class="chip ${!f ? 'on' : ''}" href="#/admin/orders">All</a>
        ${STATUSES.map(s => `<a class="chip ${f === s ? 'on' : ''}" href="#/admin/orders?status=${encodeURIComponent(s)}">${s}</a>`).join('')}
      </div></div>
      ${list.length ? `<table><thead><tr><th>Order</th><th>Customer</th><th>Branch</th><th>Payment</th><th>Status</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${list.map(o => `<tr data-order="${o.id}" style="cursor:pointer">
        <td><b>${o.id}</b><br><span style="font-size:11px;color:var(--ink-4)">${new Date(o.date).toLocaleDateString('en-GB')}</span></td>
        <td>${esc(o.customer.name)}<br><span style="font-size:11px;color:var(--ink-4)">${esc(o.customer.email)}</span></td>
        <td style="font-size:12px">${esc((BRANCHES.find(b => b.id === o.branch) || {}).name || '-')}</td>
        <td>${o.payment === 'M-Pesa' ? '<span class="pill ok">M-Pesa</span>' : esc(o.payment)}</td>
        <td>${statusPill(o.status)}</td><td class="num"><b>${KSh(o.total)}</b></td>
        <td class="num"><span class="btn ghost sm">Open</span></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No orders with that status.</div>'}</div>`;
  };

  V.products = () => `
    <div class="top"><div><h1>Products</h1><p>${PRODUCTS.length} products &middot; prices update live on the storefront</p></div>
      <button class="btn" data-newproduct>Add product</button></div>
    <div class="panel"><div class="panel-hd"><input class="search" id="pSearch" placeholder="Search products..."></div>
      <table><thead><tr><th>Product</th><th>Category</th><th>Fabric</th><th class="num">Price</th><th class="num">Stock</th><th>Status</th></tr></thead>
      <tbody id="pRows">${PRODUCTS.map(p => {
        const n = SH.stockAll(p);
        return `<tr data-prow="${esc(p.title.toLowerCase())}">
          <td><div class="tw"><img class="thumb" src="${(p.thumbs||p.images)[0]}" alt=""><div><b>${esc(p.title)}</b><span>${esc(p.slug)}</span></div></div></td>
          <td style="font-size:12px">${esc((CATEGORIES.find(c => c.id === p.category) || {}).name || '')}</td>
          <td style="font-size:12px;color:var(--ink-3)">${esc(p.fabric)}</td>
          <td class="num"><input class="inline" type="number" value="${p.price}" data-price="${p.slug}" style="text-align:right"></td>
          <td class="num">${n}</td>
          <td>${n === 0 ? '<span class="pill bad">Out of stock</span>' : n < 12 ? '<span class="pill warn">Low</span>' : '<span class="pill ok">Active</span>'}</td>
        </tr>`; }).join('')}</tbody></table></div>`;

  V.inventory = (q) => {
    const sizes = ['46', '48', '50', '52', '54', '56', '58', 'S', 'M', 'L', 'XL', 'XXL', '39', '40', '41', '42', '43', '44', '45', 'One Size'];
    const br = new URLSearchParams(q || '').get('branch');
    const branch = BRANCHES.find(b => b.id === br);
    const val = (p, s) => branch ? SH.stockAt(p.slug, s, branch.id) : SH.branchTotal(p, s);
    const rowTotal = p => p.sizes.reduce((a, s) => a + val(p, s), 0);
    return `<div class="top"><div><h1>Inventory</h1>
      <p>${branch ? 'Stock at ' + esc(branch.name) : 'Stock across all four stores'} &mdash; the view Shopify makes you buy an app for.</p></div></div>
      <div class="panel"><div class="panel-hd">
        <div class="fbar">
          <a class="chip ${!branch ? 'on' : ''}" href="#/admin/inventory">All stores</a>
          ${BRANCHES.map(b => `<a class="chip ${br === b.id ? 'on' : ''}" href="#/admin/inventory?branch=${b.id}">${esc(b.name.split(',')[0])}</a>`).join('')}
        </div>
        <div class="fbar"><span class="pill ok">Healthy</span><span class="pill warn">Low</span><span class="pill bad">Out</span></div></div>
      <div class="fbar" style="margin:-8px 0 18px">
        <button class="btn ghost sm" id="tagSheet">Print barcode tags</button>
        <span class="muted" style="font-size:12px">Their live catalogue has no barcodes at all &mdash; these are generated.</span>
      </div>
      <div class="matrix"><table><thead><tr><th>Product</th>
        ${sizes.map(s => `<th class="num">${s}</th>`).join('')}<th class="num">Total</th></tr></thead>
      <tbody>${PRODUCTS.map(p => `<tr>
        <td><div class="tw"><img class="thumb" src="${(p.thumbs||p.images)[0]}" alt=""><div><b>${esc(p.title)}</b></div></div></td>
        ${sizes.map(s => {
          if (!p.sizes.includes(s)) return '<td style="color:var(--ink-4)">&middot;</td>';
          const n = val(p, s);
          return `<td><span class="cellv ${n === 0 ? 'z' : n <= 2 ? 'l' : 'g'}" title="${BRANCHES.map(b => b.name + ': ' + SH.stockAt(p.slug, s, b.id)).join(' | ')}&#10;SKU ${SH.skuFor(p.slug, s)}&#10;${SH.barcodeFor(p.slug, s)}">${n}</span></td>`;
        }).join('')}
        <td class="num"><b>${rowTotal(p)}</b></td></tr>`).join('')}</tbody></table></div></div>`;
  };

  V.fittings = () => `<div class="top"><div><h1>Fittings</h1><p>${state.appointments.length} appointment${state.appointments.length === 1 ? '' : 's'}</p></div></div>
    <div class="panel">${state.appointments.length ? `<table>
      <thead><tr><th>Ref</th><th>Customer</th><th>When</th><th>Store</th><th>Reason</th><th>Status</th><th></th></tr></thead>
      <tbody>${state.appointments.map((a, i) => `<tr>
        <td><b>${esc(a.id)}</b></td>
        <td>${esc(a.name)}<br><span style="font-size:11px;color:var(--ink-4)">${esc(a.phone)}</span></td>
        <td style="font-size:12px">${esc(a.date)}<br><span style="color:var(--ink-4)">${esc(a.time)}</span></td>
        <td style="font-size:12px">${esc((BRANCHES.find(b => b.id === a.branch) || {}).name || '')}</td>
        <td style="font-size:12px">${esc(a.reason)}</td>
        <td><span class="pill ${a.status === 'Confirmed' ? 'ok' : 'warn'}">${esc(a.status)}</span></td>
        <td class="num">${a.status === 'Requested' ? `<button class="btn sm" data-confirmfit="${i}">Confirm</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>`
      : '<div class="empty">No fittings booked yet. Book one from the storefront to see it appear here.</div>'}</div>`;

  V.commissions = () => `<div class="top"><div><h1>Made to Measure</h1><p>${state.commissions.length} commission${state.commissions.length === 1 ? '' : 's'}</p></div></div>
    <div class="panel">${state.commissions.length ? `<table>
      <thead><tr><th>Ref</th><th>Cloth</th><th>Spec</th><th>Monogram</th><th>Status</th><th class="num">Value</th></tr></thead>
      <tbody>${state.commissions.map(c => `<tr>
        <td><b>${esc(c.id)}</b><br><span style="font-size:11px;color:var(--ink-4)">${new Date(c.date).toLocaleDateString('en-GB')}</span></td>
        <td>${esc(c.cloth)}</td>
        <td style="font-size:12px;color:var(--ink-3)">${esc(c.pieces)}-piece &middot; ${esc(c.lapel)} lapel &middot; ${esc(c.lining)} lining &middot; ${esc(c.buttons)} buttons</td>
        <td>${esc(c.monogram) || '&mdash;'}</td>
        <td><span class="pill warn">${esc(c.status)}</span></td>
        <td class="num"><b>${KSh(c.price)}</b></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No commissions yet. Build one on the storefront to see it land here.</div>'}</div>`;

  V.groups = () => {
    const g = state.groups;
    const value = o => { const p = byId(o.slug); return (p ? p.price : 0) * o.members.length * (1 - SH.groupDiscount(o.members.length)); };
    return `<div class="top"><div><h1>Weddings &amp; Groups</h1>
      <p>${g.length} party quote${g.length === 1 ? '' : 's'} &middot; ${g.reduce((a, o) => a + o.members.length, 0)} suits in total</p></div></div>
      <div class="panel">${g.length ? g.map(o => {
        const p = byId(o.slug);
        return `<div style="border-bottom:1px solid var(--line);padding:20px">
          <div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start">
            <div><b style="font-size:14px">${esc(o.id)} &middot; ${esc(o.event)}</b>
              <p style="margin:5px 0 0;font-size:12.5px;color:var(--ink-3)">
                ${esc(o.organiser)} &middot; ${esc(o.phone)} &middot; ${esc(o.email)}<br>
                Event ${esc(o.eventDate)} &middot; ${o.members.length} suits &middot;
                ${(SH.groupDiscount(o.members.length) * 100)}% group discount</p></div>
            <div style="text-align:right"><span class="pill ${o.status === 'Confirmed' ? 'ok' : 'warn'}">${esc(o.status)}</span>
              <div style="font-size:16px;font-weight:700;margin-top:8px">${KSh(value(o))}</div></div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">
            <img class="thumb" src="${p ? (p.thumbs||p.images)[0] : ''}" alt="">
            ${o.members.map(m => `<span class="pill grey" title="${esc(m.role)}">${esc(m.name.split(' ')[0])} &middot; ${esc(m.size)}</span>`).join('')}
          </div>
          <p style="font-size:12px;color:var(--ink-3);margin:12px 0 0">
            Cut from a single bolt so every jacket matches &mdash; reserve ${(o.members.length * 3.4).toFixed(1)}m of cloth.</p>
        </div>`; }).join('')
        : '<div class="empty">No group quotes yet. Build one on the storefront to see it here.</div>'}</div>`;
  };

  /* ================= alterations =================
     Free lifetime alterations is their stated differentiator and nothing tracks it today.
     Each stage writes a notification the customer would receive by SMS. */
  V.alterations = () => {
    const list = state.alterations;
    const late = list.filter(a => a.status !== 'Collected' && new Date(a.promised) < new Date()).length;
    return `<div class="top"><div><h1>Alterations</h1>
      <p>${list.length} job${list.length === 1 ? '' : 's'}${late ? ' &middot; <b style="color:var(--bad)">' + late + ' past the promised date</b>' : ''}</p></div>
      <button class="btn" id="altNew">Book a garment in</button></div>

      <div class="panel"><div class="panel-bd" id="altForm" style="display:none">
        <div class="f3">
          <div class="field"><label>Customer</label><input id="af-name"></div>
          <div class="field"><label>Phone</label><input id="af-phone" placeholder="07xx xxx xxx"></div>
          <div class="field"><label>Garment</label><input id="af-garment" placeholder="e.g. Carlo Calvino 3 Piece"></div>
        </div>
        <div class="f3">
          <div class="field"><label>Sleeve</label><input id="af-sleeve" placeholder="-1.5cm"></div>
          <div class="field"><label>Waist</label><input id="af-waist" placeholder="+2cm"></div>
          <div class="field"><label>Hem</label><input id="af-hem" placeholder="31in"></div>
        </div>
        <div class="f3">
          <div class="field"><label>Taper</label><select id="af-taper"><option>no</option><option>yes</option></select></div>
          <div class="field"><label>Store</label><select id="af-branch">
            ${BRANCHES.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Promised</label><input id="af-promised" type="date"></div>
        </div>
        <button class="btn" id="altSave">Book in</button>
      </div></div>

      ${list.length ? list.map(a => {
        const overdue = a.status !== 'Collected' && new Date(a.promised) < new Date();
        return `<div class="panel">
          <div class="panel-hd">
            <div><b>${esc(a.id)} &middot; ${esc(a.customer)}</b>
              <div style="font-size:12px;color:var(--ink-3);margin-top:4px">
                ${esc(a.garment)} &middot; ${esc((BRANCHES.find(b => b.id === a.branch) || {}).name || '')}
                &middot; promised ${esc(a.promised)}${overdue ? ' <span class="pill bad">overdue</span>' : ''}</div></div>
            <div class="steps" style="margin:0;max-width:420px">
              ${SH.ALT_STAGES.map((st, i) => {
                const at = SH.ALT_STAGES.indexOf(a.status);
                return `<button data-altstage="${esc(st)}" data-altid="${esc(a.id)}"
                  class="${i < at ? 'done' : ''} ${i === at ? 'now' : ''}">${st}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="panel-bd">
            <div class="alt-work">
              ${Object.entries(a.work || {}).filter(w => w[1]).map(w =>
                `<span class="pill grey">${esc(w[0])}: ${esc(w[1])}</span>`).join('') || '<span class="muted">No measurements recorded</span>'}
            </div>
            <div class="alt-log">
              ${(a.log || []).map(l => `<div class="alt-msg">
                <b>${esc(l.s)}</b><span>${new Date(l.t).toLocaleString('en-GB')}</span>
                <p>SMS to ${esc(a.phone)}: &ldquo;${esc(l.msg)}&rdquo;</p></div>`).join('')}
            </div>
          </div></div>`; }).join('')
        : '<div class="panel"><div class="empty">Nothing booked in.</div></div>'}`;
  };

  /* ================= corporate / bulk =================
     Their own contact page is dedicated to bulk production, served by a plain form. */
  V.corporate = () => {
    const list = state.corporate;
    const suits = list.reduce((a, c) => a + (+c.headcount || 0), 0);
    return `<div class="top"><div><h1>Corporate &amp; Bulk</h1>
      <p>${list.length} enquir${list.length === 1 ? 'y' : 'ies'} &middot; ${suits} garments in the pipeline</p></div></div>
      ${list.length ? list.map(c => {
        const disc = SH.corporateTier(+c.headcount || 0);
        return `<div class="panel"><div class="panel-hd">
          <div><b>${esc(c.id)} &middot; ${esc(c.company)}</b>
            <div style="font-size:12px;color:var(--ink-3);margin-top:4px">
              ${esc(c.contact)} &middot; ${esc(c.phone)} &middot; ${esc(c.email)}</div></div>
          <div class="fbar">
            ${['New', 'Quoted', 'Won', 'Lost'].map(st =>
              `<button class="chip ${c.status === st ? 'on' : ''}" data-corp="${esc(c.id)}" data-corpst="${st}">${st}</button>`).join('')}
          </div></div>
          <div class="panel-bd">
            <!-- .wonbar, not .notice. .notice is position:fixed - it is the toast -
                 so this line, which belongs inside the panel, was being pinned to the
                 bottom of the window and left there. -->
            ${c.orderId ? `<div class="wonbar">
              Won &middot; became order <a href="#/admin/orders" style="border-bottom:1px solid currentColor"
              >${esc(c.orderId)}</a>${(() => { const o = state.orders.find(x => x.id === c.orderId);
                return o ? ' &middot; ' + fmt(o.total) + ' &middot; ' + esc(o.status) : ''; })()}</div>` : ''}
            <div class="f3">
              <div><label class="lbl">Headcount</label><div class="big">${esc(c.headcount)}</div></div>
              <div><label class="lbl">Garment</label><div class="big" style="font-size:16px">${esc(c.garment)}</div></div>
              <div><label class="lbl">Volume discount</label><div class="big" style="color:var(--bronze)">${(disc * 100)}%</div></div>
            </div>
            <p style="font-size:13px;color:var(--ink-3);margin:14px 0 0">
              Needed by ${esc(c.deadline)}. ${esc(c.notes || '')}</p>
          </div></div>`; }).join('')
        : '<div class="panel"><div class="empty">No enquiries yet.</div></div>'}`;
  };

  V.customers = () => {
    const map = {};
    state.orders.forEach(o => {
      const k = o.customer.email;
      map[k] = map[k] || { ...o.customer, orders: 0, spend: 0, last: 0 };
      map[k].orders++; map[k].spend += o.total; map[k].last = Math.max(map[k].last, o.date);
    });
    const list = Object.values(map).sort((a, b) => b.spend - a.spend);
    const tier = s => s >= 80000 ? '<span class="pill ok">Gold</span>' : s >= 30000 ? '<span class="pill info">Silver</span>' : '<span class="pill grey">Member</span>';
    return `<div class="top"><div><h1>Customers</h1><p>${list.length} in The Henry Club</p></div></div>
      <div class="panel">${list.length ? `<table>
        <thead><tr><th>Customer</th><th>Contact</th><th class="num">Orders</th><th class="num">Lifetime</th><th>Tier</th><th>Last order</th></tr></thead>
        <tbody>${list.map(c => `<tr>
          <td><b>${esc(c.name)}</b></td>
          <td style="font-size:12px;color:var(--ink-3)">${esc(c.email)}<br>${esc(c.phone)}</td>
          <td class="num">${c.orders}</td><td class="num"><b>${KSh(c.spend)}</b></td>
          <td>${tier(c.spend)}</td>
          <td style="font-size:12px">${new Date(c.last).toLocaleDateString('en-GB')}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No customers yet.</div>'}</div>`;
  };

  V.analytics = () => {
    const cat = {};
    state.orders.forEach(o => o.items.forEach(i => {
      const p = byId(i.slug); if (!p) return;
      cat[p.category] = (cat[p.category] || 0) + i.price * i.qty;
    }));
    const rows = Object.entries(cat).sort((a, b) => b[1] - a[1]);
    const totalRev = rows.reduce((a, r) => a + r[1], 0) || 1;
    const pay = {};
    state.orders.forEach(o => pay[o.payment] = (pay[o.payment] || 0) + 1);
    return `<div class="top"><div><h1>Analytics</h1><p>Where the money actually comes from</p></div></div>
      <div class="cols">
        <div class="panel"><div class="panel-hd"><b>Revenue by category</b></div><div class="panel-bd">
          ${rows.length ? rows.map(([c, v]) => `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">
              <b>${esc((CATEGORIES.find(x => x.id === c) || {}).name || c)}</b><span>${KSh(v)}</span></div>
            <div style="height:7px;background:var(--bone)"><div style="height:100%;background:var(--bronze);width:${(v / totalRev * 100).toFixed(1)}%"></div></div>
          </div>`).join('') : '<div class="empty">No sales data yet.</div>'}
        </div></div>
        <div class="panel"><div class="panel-hd"><b>Payment methods</b></div><div class="panel-bd">
          ${Object.entries(pay).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px">
            <span>${esc(k)}</span><b>${v} order${v > 1 ? 's' : ''}</b></div>`).join('') || '<div class="empty">No data.</div>'}
          <p style="font-size:12px;color:var(--ink-3);margin-top:16px">M-Pesa share is the number to watch &mdash; it is how most Kenyan customers want to pay, and card-only checkouts lose them.</p>
        </div></div>
      </div>
      <div class="panel"><div class="panel-hd"><b>Best sellers</b></div>
        <table><thead><tr><th>Product</th><th class="num">Units</th><th class="num">Revenue</th></tr></thead><tbody>
        ${(() => {
          const m = {};
          state.orders.forEach(o => o.items.forEach(i => {
            m[i.slug] = m[i.slug] || { u: 0, r: 0 }; m[i.slug].u += i.qty; m[i.slug].r += i.price * i.qty;
          }));
          const e = Object.entries(m).sort((a, b) => b[1].r - a[1].r);
          return e.length ? e.map(([s, d]) => { const p = byId(s); return `<tr>
            <td><div class="tw"><img class="thumb" src="${p ? (p.thumbs||p.images)[0] : ''}" alt=""><b>${esc(p ? p.title : s)}</b></div></td>
            <td class="num">${d.u}</td><td class="num"><b>${KSh(d.r)}</b></td></tr>`; }).join('')
            : '<tr><td colspan="3"><div class="empty">No sales yet.</div></td></tr>';
        })()}
        </tbody></table></div>`;
  };

  V.settings = () => `<div class="top"><div><h1>Settings</h1><p>Store configuration</p></div></div>
    <div class="cols">
      <div class="panel"><div class="panel-hd"><b>Store</b></div><div class="panel-bd">
        <div class="f2"><div class="field"><label>Store name</label><input value="Sir Henry's Limited"></div>
        <div class="field"><label>Currency</label><select><option>KSh - Kenyan Shilling</option><option>USD</option></select></div></div>
        <div class="f2"><div class="field"><label>Free delivery threshold</label>
          <input type="number" id="setThresh" value="${state.settings.freeShipThreshold}"></div>
        <div class="field"><label>VAT %</label><input type="number" value="${state.settings.vat}"></div></div>
        <div class="field"><label>Support phone</label><input value="+254 713 619786"></div>
        <button class="btn" id="saveSettings">Save changes</button>
      </div></div>
      <div class="panel"><div class="panel-hd"><b>Branches</b></div><div class="panel-bd" style="padding:0">
        <table><tbody>${BRANCHES.map(b => `<tr><td><b>${esc(b.name)}</b><br>
          <span style="font-size:11px;color:var(--ink-4)">${esc(b.hours)} &middot; ${esc(b.tel)}</span></td>
          <td class="num"><span class="pill ok">Open</span></td></tr>`).join('')}</tbody></table>
      </div></div>
    </div>
    <div class="panel"><div class="panel-hd"><b>Demo controls</b></div><div class="panel-bd">
      <p style="font-size:13px;color:var(--ink-3);margin:0 0 14px">This prototype stores everything in your browser. Reset returns it to seed data.</p>
      <button class="btn ghost" id="resetDemo">Reset demo data</button></div></div>`;

  /* ---------- order drawer ---------- */
  function openOrder(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    const idx = STATUSES.indexOf(o.status);
    document.getElementById('dwTitle').textContent = o.id;
    document.getElementById('dwBody').innerHTML = `
      <div class="field"><label>Status</label><div class="steps">
        ${STATUSES.map((s, i) => `<button data-setstatus="${esc(s)}" class="${i < idx ? 'done' : ''} ${i === idx ? 'now' : ''}">${s}</button>`).join('')}
      </div></div>
      <div class="f2">
        <div><label style="font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);font-weight:700">Customer</label>
          <p style="font-size:13px;margin:6px 0 0"><b>${esc(o.customer.name)}</b><br>${esc(o.customer.email)}<br>${esc(o.customer.phone)}</p></div>
        <div><label style="font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);font-weight:700">Fulfilment</label>
          <p style="font-size:13px;margin:6px 0 0">${esc((BRANCHES.find(b => b.id === o.branch) || {}).name || '-')}<br>
          Paid by ${esc(o.payment)}<br>${new Date(o.date).toLocaleString('en-GB')}</p></div>
      </div>
      <div class="field" style="margin-top:20px"><label>Items</label>
        ${o.items.map(i => { const p = byId(i.slug); return `
          <div class="tw" style="padding:9px 0;border-bottom:1px solid var(--line)">
            <img class="thumb" src="${p ? (p.thumbs||p.images)[0] : ''}" alt="">
            <div style="flex:1"><b>${esc(p ? p.title : i.slug)}</b><span>Size ${esc(i.size)} &times; ${i.qty}</span></div>
            <b style="font-size:13px">${KSh(i.price * i.qty)}</b></div>`; }).join('')}
        <div style="display:flex;justify-content:space-between;padding-top:12px;font-size:15px;font-weight:700">
          <span>Total</span><span>${KSh(o.total)}</span></div></div>
      <div class="field"><label>Workshop / alteration notes</label>
        <textarea rows="3" id="dwNotes">${esc(o.alterations)}</textarea></div>`;
    document.getElementById('dwSave').onclick = () => {
      o.alterations = document.getElementById('dwNotes').value; SH.emit();
      toast('Order updated'); close();
    };
    document.getElementById('dwBody').querySelectorAll('[data-setstatus]').forEach(b => b.onclick = () => {
      o.status = b.dataset.setstatus; SH.emit(); openOrder(id); render();
      toast('Status set to ' + o.status);
    });
    document.getElementById('dw').classList.add('on');
    AD.querySelector('#scrim').classList.add('on');
  }
  const close = () => { document.querySelectorAll('.dw,.side').forEach(e => e.classList.remove('on')); AD.querySelector('#scrim').classList.remove('on'); };

  /* ---------- router ---------- */
  // the console's own markup, kept so the login gate can be torn down and put back
  const SHELL = AD.innerHTML;

  function render() {
    const raw = location.hash.slice(1) || '';
    if (!/^\/admin(\/|\?|$)/.test(raw)) { AD.hidden = true; return; }
    AD.hidden = false;

    // Session expiry and the idle timeout are checked here, on every render, not
    // on a timer. A console left open on the counter therefore locks itself the
    // moment somebody comes back and touches it, which is the point at which it
    // matters, and there is no interval left running on a page nobody is using.
    const staff = SHSec.session.touch();
    if (!staff) {
      const stale = sessionStorage.getItem(SHSec.session.KEY);
      renderLogin(stale ? 'That session timed out. Sign in again.' : 'Sign in to continue.');
      return;
    }
    if (AD.classList.contains('locked')) reshell();
    securityBanner();

    const [path, q] = raw.slice(BASE.length).split('?');
    let key = path.split('/').filter(Boolean)[0] || '';
    const allowed = SH.ROLE_VIEWS[staff.role] || [];
    if (!key) key = allowed[0];                       // land somewhere this role can actually use
    if (!V[key] || !allowed.includes(key)) {
      view.innerHTML = `<div class="top"><div><h1>Not available</h1>
        <p>Your account (${esc(staff.title)}) does not have access to that section.</p></div></div>`;
      paintNav(staff, allowed, null);
      return;
    }
    view.innerHTML = V[key](q);
    paintNav(staff, allowed, key);
    if (key === 'inventory' || key === 'orders') { /* query-driven views re-render on hashchange */ }
    wire(key);
    window.scrollTo(0, 0);
  }

  // hide what this role cannot open, and show who is signed in
  function paintNav(staff, allowed, key) {
    AD.querySelectorAll('.side a[data-nav]').forEach(a => {
      const ok = allowed.includes(a.dataset.nav);
      a.style.display = ok ? '' : 'none';
      a.classList.toggle('on', a.dataset.nav === key);
    });
    AD.querySelectorAll('.side h6').forEach(h => {
      let n = h.nextElementSibling, any = false;
      while (n && n.tagName === 'A') { if (n.style.display !== 'none') any = true; n = n.nextElementSibling; }
      h.style.display = any ? '' : 'none';
    });
    const box = document.getElementById('whoami');
    if (box) box.innerHTML = `<b>${esc(staff.name)}</b><span>${esc(staff.title)}</span>
      <button id="signout">Sign out</button>`;
    const so = document.getElementById('signout');
    if (so) so.onclick = signOut;
  }

  function wire(key) {
    if (key === 'pos') wirePos();
    view.querySelectorAll('[data-order]').forEach(r => r.onclick = () => openOrder(r.dataset.order));

    // alterations: advance a stage, or book a garment in
    view.querySelectorAll('[data-altstage]').forEach(b => b.onclick = () => {
      SH.advanceAlteration(b.dataset.altid, b.dataset.altstage);
      render(); toast('Customer notified: ' + b.dataset.altstage);
    });
    const altNew = document.getElementById('altNew');
    if (altNew) altNew.onclick = () => {
      const f = document.getElementById('altForm');
      f.style.display = f.style.display === 'none' ? '' : 'none';
    };
    const altSave = document.getElementById('altSave');
    if (altSave) altSave.onclick = () => {
      const g = id => (document.getElementById(id) || {}).value || '';
      if (!g('af-name') || !g('af-garment')) { toast('Name and garment are required'); return; }
      SH.addAlteration({
        customer: g('af-name'), phone: g('af-phone'), garment: g('af-garment'),
        branch: g('af-branch'), promised: g('af-promised') || new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10),
        order: '', work: { sleeve: g('af-sleeve'), waist: g('af-waist'), hem: g('af-hem'), taper: g('af-taper') }
      });
      render(); toast('Booked in');
    };

    // corporate pipeline
    view.querySelectorAll('[data-corp]').forEach(b => b.onclick = () => {
      const c = state.corporate.find(x => x.id === b.dataset.corp);
      if (!c) return;
      const to = b.dataset.corpst;
      // Won is the only status that does something. It turns the enquiry into a real
      // order - see SH.winCorporate, which is idempotent, so clicking Won twice does not
      // bill the client twice.
      if (to === 'Won') {
        const o = SH.winCorporate(c.id);
        render();
        toast(o ? c.company + ' won — order ' + o.id + ' for ' + fmt(o.total) : 'Could not create the order');
        return;
      }
      c.status = to; SH.emit(); render(); toast(c.company + ': ' + c.status);
    });

    // printable barcode tags for the whole catalogue
    const tag = document.getElementById('tagSheet');
    if (tag) tag.onclick = () => openTagSheet();

    view.querySelectorAll('[data-price]').forEach(inp => inp.onchange = () => {
      const p = byId(inp.dataset.price);
      p.price = Math.max(0, +inp.value || 0);
      SH.emit(); toast(p.title + ' updated to ' + KSh(p.price));
    });

    const s = document.getElementById('pSearch');
    if (s) s.oninput = () => {
      const t = s.value.toLowerCase();
      document.querySelectorAll('#pRows tr').forEach(r =>
        r.style.display = r.dataset.prow.includes(t) ? '' : 'none');
    };

    view.querySelectorAll('[data-confirmfit]').forEach(b => b.onclick = () => {
      state.appointments[+b.dataset.confirmfit].status = 'Confirmed';
      SH.emit(); render(); toast('Fitting confirmed');
    });

    const np = view.querySelector('[data-newproduct]');
    if (np) np.onclick = () => toast('Product creation is stubbed in this prototype');

    const ss = document.getElementById('saveSettings');
    if (ss) ss.onclick = () => {
      state.settings.freeShipThreshold = +document.getElementById('setThresh').value || 0;
      SH.emit(); toast('Settings saved');
    };
    const rd = document.getElementById('resetDemo');
    if (rd) rd.onclick = () => { SH.reset(); render(); toast('Demo data reset'); };
  }

  function openTagSheet() {
    const rows = [];
    PRODUCTS.forEach(p => p.sizes.forEach(size => {
      rows.push(`<div class="tag-cell">
        <div class="tag-name">${esc(p.title)}</div>
        <div class="tag-meta">Size ${esc(size)} &middot; ${KSh(p.price)}</div>
        ${barcodeSVG(SH.barcodeFor(p.slug, size))}
        <div class="tag-sku">${SH.skuFor(p.slug, size)}</div>
      </div>`);
    }));
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to print tags'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>Sir Henry's - barcode tags</title><style>
      body{font-family:Archivo,system-ui,sans-serif;margin:14mm;color:#151515}
      h1{font-size:15px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 4px}
      .sub{font-size:11px;color:#6f6a65;margin-bottom:16px}
      .sheet{display:grid;grid-template-columns:repeat(4,1fr);gap:8mm}
      .tag-cell{border:1px solid #e6e2dd;padding:7px;text-align:center;break-inside:avoid}
      .tag-name{font-size:9px;font-weight:600;line-height:1.25;height:24px;overflow:hidden}
      .tag-meta{font-size:8px;color:#6f6a65;margin:2px 0 5px}
      .bc{width:100%;height:44px}
      .tag-sku{font-family:monospace;font-size:8px;margin-top:3px;color:#3c3a37}
      @media print{@page{margin:10mm}}
      </style></head><body>
      <h1>Sir Henry&rsquo;s &mdash; barcode tags</h1>
      <div class="sub">${rows.length} variants &middot; EAN-13 &middot; generated ${new Date().toLocaleDateString('en-GB')}</div>
      <div class="sheet">${rows.join('')}</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
      </body></html>`);
    w.document.close();
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]') || e.target.id === 'scrim') close();
    if (e.target.closest('[data-mtoggle]')) {
      AD.querySelector('.side').classList.toggle('on');
      AD.querySelector('#scrim').classList.toggle('on');
    }
    if (e.target.closest('.side a')) AD.querySelector('.side').classList.remove('on');
  });

  window.addEventListener('hashchange', render);
  window.addEventListener('sh:change', () => { /* keep KPIs fresh if another tab writes */ });
  render();
})();
