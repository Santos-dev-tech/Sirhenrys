/* ---------------------------------------------------------------------------
   Sir Henry's - the security layer.

   Loads before app.js, admin.js and ai.js, because all three call into it.

   WHAT THIS FILE CAN AND CANNOT DO, said plainly up front, because the difference
   matters more than the code:

   A browser cannot keep a secret from the person holding the browser. Anything in
   here that looks like enforcement - the PIN check, the role gate, the rate limit -
   is a *user interface* over the real enforcement, which lives in firestore.rules
   and runs on Google's servers. Someone who edits sessionStorage by hand can make
   this console draw itself. They still cannot read or write one byte of the shop's
   books, because the rules ask the server for a staff claim on the ID token and
   this page cannot mint one.

   So: read every function below as "stops the accident and the casual poke", and
   read firestore.rules as "stops the attacker". Both are needed. Only one of them
   is trustworthy.
--------------------------------------------------------------------------- */

window.SH_SECURITY = {
  // Show the demo PIN and the live TOTP code on the staff login card. This is what
  // makes the pitch demo usable by someone who is not holding a phone. Flip it to
  // false for a real deployment and the codes disappear from the page.
  demoHints: true,

  // Staff session lifetime. Absolute is a hard ceiling; idle logs out a till that
  // has been left unattended on a shop floor, which is the realistic threat here.
  sessionMaxMs: 8 * 60 * 60 * 1000,   // a shift
  sessionIdleMs: 15 * 60 * 1000,      // a tea break

  // Login throttling. Five tries, then a lockout that doubles each time it is hit.
  maxAttempts: 5,
  lockoutBaseMs: 30 * 1000,
  lockoutMaxMs: 15 * 60 * 1000,

  // PBKDF2 work factor. 210,000 is OWASP's 2023 floor for PBKDF2-HMAC-SHA256.
  pbkdf2Iterations: 210000,

  // Minimum customer password length. Firebase's own floor is six, which is too
  // low to be worth calling a policy, so the client asks for more before it will
  // even send the request.
  minPasswordLength: 10
};

window.SHSec = (function () {
  'use strict';

  const CFG = window.SH_SECURITY;
  const enc = new TextEncoder();
  const subtle = (window.crypto && window.crypto.subtle) || null;

  /* =====================================================================
     1. Escaping user content
     ---------------------------------------------------------------------
     app.js and admin.js each had their own esc() that handled & < > " but not
     the single quote. Every attribute in those files is double-quoted so that
     was survivable, but "survivable given how the rest of the file happens to
     be written" is not a security property. This one is complete and shared.
  ===================================================================== */
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#96;' };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"'`/]/g, c => ESC_MAP[c]);
  }

  // For text that has to keep its shape (a model's reply, a note typed by staff)
  // but must never become markup. Escapes everything, then puts line breaks back.
  function escLines(s) {
    return esc(s).replace(/\r?\n/g, '<br>');
  }

  /* =====================================================================
     2. Input validation
     ---------------------------------------------------------------------
     One validator, used by every form, so that "what counts as a phone number"
     is answered in one place. The same shapes are re-checked in firestore.rules;
     these run first only so the person gets a sentence instead of a rejection.
  ===================================================================== */
  const RULES = {
    email:  { max: 254, re: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, msg: 'That does not look like an email address.' },
    // Kenyan mobile, written any of the four ways people actually write it
    phone:  { max: 20, re: /^(\+?254|0)?[17]\d{8}$/, strip: /[\s()-]/g, msg: 'Use a Kenyan mobile number, e.g. 0712 345 678.' },
    name:   { max: 80, re: /^[\p{L}\p{M}'\- .]{2,80}$/u, msg: 'Use letters, spaces, apostrophes and hyphens only.' },
    pin:    { max: 4, re: /^\d{4}$/, msg: 'A PIN is four digits.' },
    otp:    { max: 6, re: /^\d{6}$/, msg: 'A code is six digits.' },
    text:   { max: 500, re: /^[^<>]*$/, msg: 'Angle brackets are not allowed here.' },
    note:   { max: 2000, re: /^[^<>]*$/s, msg: 'Angle brackets are not allowed here.' },
    slug:   { max: 60, re: /^[a-z0-9-]+$/, msg: 'Unexpected characters.' },
    number: { max: 12, re: /^-?\d+(\.\d+)?$/, msg: 'Enter a number.' },
    date:   { max: 10, re: /^\d{4}-\d{2}-\d{2}$/, msg: 'Use the date picker.' }
  };

  function validate(value, type, opts) {
    opts = opts || {};
    let v = String(value == null ? '' : value);
    const r = RULES[type] || RULES.text;
    if (r.strip) v = v.replace(r.strip, '');
    v = v.trim();

    if (!v) return opts.required === false
      ? { ok: true, value: '' }
      : { ok: false, value: v, error: 'This is required.' };

    // Length first: a regex over an unbounded string is how you turn a form into
    // a denial of service.
    const max = opts.max || r.max;
    if (v.length > max) return { ok: false, value: v.slice(0, max), error: `Keep this under ${max} characters.` };
    if (opts.min && v.length < opts.min) return { ok: false, value: v, error: `At least ${opts.min} characters.` };
    if (!r.re.test(v)) return { ok: false, value: v, error: r.msg };

    if (type === 'number') {
      const n = parseFloat(v);
      if (opts.lo != null && n < opts.lo) return { ok: false, value: v, error: `Must be at least ${opts.lo}.` };
      if (opts.hi != null && n > opts.hi) return { ok: false, value: v, error: `Must be at most ${opts.hi}.` };
      return { ok: true, value: n };
    }
    return { ok: true, value: v };
  }

  // Walks a form and validates every field carrying data-v="<type>". Marks the bad
  // ones, returns the clean values. Nothing is submitted on a false.
  function validateForm(form) {
    const out = {};
    let firstBad = null;
    form.querySelectorAll('[data-v]').forEach(el => {
      const req = el.hasAttribute('required') || el.dataset.vreq === '1';
      const r = validate(el.value, el.dataset.v, {
        required: req, min: el.dataset.vmin ? +el.dataset.vmin : null,
        max: el.dataset.vmax ? +el.dataset.vmax : null,
        lo: el.dataset.vlo ? +el.dataset.vlo : null,
        hi: el.dataset.vhi ? +el.dataset.vhi : null
      });
      if (!req && !String(el.value || '').trim()) { out[el.name || el.id] = ''; fieldMsg(el, null); return; }
      if (!r.ok) { fieldMsg(el, r.error); firstBad = firstBad || el; }
      else { fieldMsg(el, null); out[el.name || el.id] = r.value; }
    });
    if (firstBad) { firstBad.focus(); return { ok: false, values: out }; }
    return { ok: true, values: out };
  }

  function fieldMsg(el, msg) {
    const field = el.closest('.field') || el.parentElement;
    if (!field) return;
    let p = field.querySelector('.f-err');
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (!msg) { if (p) p.remove(); field.classList.remove('bad'); return; }
    if (!p) { p = document.createElement('p'); p.className = 'f-err'; p.setAttribute('role', 'alert'); field.appendChild(p); }
    p.textContent = msg;
    field.classList.add('bad');
  }

  /* =====================================================================
     3. Password strength
     ---------------------------------------------------------------------
     Not an entropy estimate dressed up as one. It scores the four things that
     actually predict a cracked password in a real dump - length, variety,
     repetition, and whether it is a word from the top of every list - and it
     refuses rather than warns below a score of 2.
  ===================================================================== */
  const COMMON = ('password,123456,12345678,qwerty,abc123,111111,123123,letmein,welcome,monkey,' +
    'dragon,football,iloveyou,admin,login,princess,solo,starwars,sunshine,master,' +
    'sirhenrys,nairobi,kenya,tailor,suit,henry,1967,changeme,passw0rd,qwerty123').split(',');

  function passwordScore(pw) {
    pw = String(pw || '');
    const lower = pw.toLowerCase();
    if (!pw) return { score: 0, label: 'Empty', notes: ['Enter a password.'] };

    const notes = [];
    let score = 0;

    if (pw.length >= CFG.minPasswordLength) score += 2;
    else if (pw.length >= 8) { score += 1; notes.push(`Make it ${CFG.minPasswordLength} characters or more.`); }
    else notes.push(`Too short - use at least ${CFG.minPasswordLength} characters.`);
    if (pw.length >= 16) score += 1;

    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(pw)).length;
    score += Math.max(0, classes - 1);
    if (classes < 3) notes.push('Mix upper case, lower case, digits and a symbol.');

    // one character or one short pattern repeated is length without strength
    if (/^(.)\1+$/.test(pw)) { score = 0; notes.push('That is one character repeated.'); }
    if (/^(..?.?.?)\1+$/.test(pw)) { score = Math.min(score, 1); notes.push('That is a short pattern repeated.'); }
    if (/^\d+$/.test(pw)) { score = Math.min(score, 1); notes.push('Digits only is the first thing anyone tries.'); }
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(pw)) {
      score = Math.min(score, 1); notes.push('Keyboard runs are in every cracking list.');
    }
    if (COMMON.some(w => lower === w || (w.length > 4 && lower.includes(w)))) {
      score = Math.min(score, 1); notes.push('That contains a very common word.');
    }

    score = Math.max(0, Math.min(4, score));
    const label = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][score];
    return { score, label, notes, ok: score >= 2 && pw.length >= CFG.minPasswordLength };
  }

  /* =====================================================================
     4. Hashing
     ---------------------------------------------------------------------
     Staff PINs are no longer in the bundle. What ships is a PBKDF2-HMAC-SHA256
     hash at 210,000 iterations with a per-person salt.

     A four-digit PIN has ten thousand possibilities, so a hash does NOT make it
     safe against someone who downloads the page and grinds it - 210k iterations
     buys about a second per guess, so a full sweep is hours. It buys two real
     things: the PIN is not sitting in plain sight in view-source, and it is not
     reusable anywhere else if the same person used it on something that matters.
     The thing that actually stops the grinder is that a correct PIN alone opens
     nothing - see the server gate below.
  ===================================================================== */
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const unhex = s => new Uint8Array((s.match(/../g) || []).map(h => parseInt(h, 16)));

  async function sha256Hex(str) {
    if (!subtle) return 'nocrypto';
    return hex(await subtle.digest('SHA-256', enc.encode(str)));
  }

  async function pbkdf2(pass, saltHex, iterations) {
    if (!subtle) return 'nocrypto';
    const key = await subtle.importKey('raw', enc.encode(String(pass)), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: unhex(saltHex), iterations: iterations || CFG.pbkdf2Iterations, hash: 'SHA-256' },
      key, 256);
    return hex(bits);
  }

  // Compare in constant time. On a PIN check the timing leak is not the way in,
  // but writing === here teaches the next person the wrong habit.
  function safeEqual(a, b) {
    a = String(a); b = String(b);
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return diff === 0;
  }

  /* =====================================================================
     5. Rate limiting and lockout
     ---------------------------------------------------------------------
     Per identity, not per form, so trying every staff member in turn does not
     reset the counter. Held in localStorage, which an attacker can clear - see
     the note at the top of this file. Against the realistic case, a person on
     the shop floor guessing a colleague's PIN, it is exactly right.
  ===================================================================== */
  const RL_KEY = 'sirhenrys.rl';
  function rlAll() { try { return JSON.parse(localStorage.getItem(RL_KEY) || '{}'); } catch (e) { return {}; } }
  function rlSave(o) { try { localStorage.setItem(RL_KEY, JSON.stringify(o)); } catch (e) {} }

  function limiterCheck(key) {
    const all = rlAll();
    const r = all[key];
    if (!r) return { ok: true, left: CFG.maxAttempts };
    if (r.until && Date.now() < r.until) {
      return { ok: false, until: r.until, waitMs: r.until - Date.now(),
               error: `Too many attempts. Try again in ${Math.ceil((r.until - Date.now()) / 1000)}s.` };
    }
    return { ok: true, left: Math.max(0, CFG.maxAttempts - (r.n || 0)) };
  }

  function limiterFail(key) {
    const all = rlAll();
    const r = all[key] || { n: 0, streak: 0 };
    r.n = (r.n || 0) + 1;
    if (r.n >= CFG.maxAttempts) {
      r.streak = (r.streak || 0) + 1;
      // doubles each lockout, capped, so a persistent guesser hits a wall that grows
      const wait = Math.min(CFG.lockoutMaxMs, CFG.lockoutBaseMs * Math.pow(2, r.streak - 1));
      r.until = Date.now() + wait;
      r.n = 0;
      all[key] = r; rlSave(all);
      return { ok: false, until: r.until, waitMs: wait,
               error: `Too many attempts. Locked for ${Math.round(wait / 1000)}s.` };
    }
    all[key] = r; rlSave(all);
    return { ok: true, left: CFG.maxAttempts - r.n };
  }

  function limiterReset(key) { const all = rlAll(); delete all[key]; rlSave(all); }

  /* =====================================================================
     6. TOTP - the second factor
     ---------------------------------------------------------------------
     RFC 6238, six digits, thirty second step, HMAC-SHA1, built on WebCrypto so
     there is no library to keep patched. The same maths Google Authenticator,
     Authy and 1Password all speak, so a staff member scans the QR once and this
     never has to be explained again.
  ===================================================================== */
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function b32decode(s) {
    s = String(s).toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
    let bits = 0, value = 0, i = 0;
    const out = new Uint8Array(Math.floor(s.length * 5 / 8));
    for (const c of s) {
      const idx = B32.indexOf(c);
      if (idx < 0) continue;
      value = (value << 5) | idx; bits += 5;
      if (bits >= 8) { out[i++] = (value >>> (bits - 8)) & 255; bits -= 8; }
    }
    return out.subarray(0, i);
  }

  async function totpAt(secretB32, counter) {
    if (!subtle) return '000000';
    const key = await subtle.importKey('raw', b32decode(secretB32),
      { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    dv.setUint32(0, Math.floor(counter / 0x100000000));
    dv.setUint32(4, counter >>> 0);
    const mac = new Uint8Array(await subtle.sign('HMAC', key, buf));
    const off = mac[mac.length - 1] & 0x0f;
    const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
    return String(bin % 1000000).padStart(6, '0');
  }

  const totpNow = secret => totpAt(secret, Math.floor(Date.now() / 30000));

  // One step either side, because phone clocks drift and staff type slowly.
  async function totpVerify(secret, code) {
    if (!/^\d{6}$/.test(String(code || ''))) return false;
    const c = Math.floor(Date.now() / 30000);
    for (const d of [0, -1, 1]) {
      if (safeEqual(await totpAt(secret, c + d), String(code))) return true;
    }
    return false;
  }

  const totpUri = (secret, label) =>
    `otpauth://totp/Sir%20Henry's:${encodeURIComponent(label)}?secret=${secret}&issuer=Sir%20Henry's&period=30&digits=6`;

  const totpSecondsLeft = () => 30 - Math.floor((Date.now() / 1000) % 30);

  /* =====================================================================
     7. The staff session
     ---------------------------------------------------------------------
     Three deliberate choices:

     - sessionStorage, not localStorage. A token in localStorage outlives the tab,
       survives the shop closing, and is readable by any script that ever manages
       to run on this origin. sessionStorage dies with the tab, which for a till is
       the correct lifetime anyway.
     - It carries an expiry and a last-touched stamp, checked on every render, so
       a console left open on the counter locks itself.
     - It carries no PIN, no hash and no secret. It is an assertion about who this
       tab thinks it is, and it is treated as exactly that much.
  ===================================================================== */
  const SESSION_KEY = 'sirhenrys.staff';

  function sessionIssue(payload) {
    const now = Date.now();
    const tok = { ...payload, iat: now, exp: now + CFG.sessionMaxMs, seen: now,
                  jti: hex(crypto.getRandomValues(new Uint8Array(8))) };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(tok)); } catch (e) {}
    return tok;
  }

  function sessionRead() {
    let t;
    try { t = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
    if (!t || !t.exp) return null;
    const now = Date.now();
    if (now > t.exp) { sessionClear(); return null; }
    if (t.seen && now - t.seen > CFG.sessionIdleMs) { sessionClear(); return null; }
    return t;
  }

  function sessionTouch() {
    const t = sessionRead();
    if (!t) return null;
    t.seen = Date.now();
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(t)); } catch (e) {}
    return t;
  }

  function sessionClear() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }

  /* =====================================================================
     8. The server gate - the only check that is worth anything
     ---------------------------------------------------------------------
     Asks Firebase for the current ID token and reads its custom claims. A staff
     claim can only be set with the Admin SDK (tools/set-staff-claims.js), so this
     answer comes from Google, not from this page, and no amount of editing
     storage in a console produces one.

     Until those claims are set on real accounts this returns claimed:false, and
     the console shows a banner saying the server check is unavailable. That is
     the honest state, and it is visible rather than buried in a comment.
  ===================================================================== */
  async function serverGate() {
    try {
      if (typeof firebase === 'undefined' || !firebase.auth) return { available: false, staff: false, why: 'no-sdk' };
      const u = firebase.auth().currentUser;
      if (!u) return { available: false, staff: false, why: 'no-user' };
      const r = await u.getIdTokenResult();
      const c = r.claims || {};
      return { available: true, staff: c.staff === true, role: c.role || null,
               store: c.store || null, uid: u.uid, anonymous: !!u.isAnonymous };
    } catch (e) {
      return { available: false, staff: false, why: (e && e.code) || 'error' };
    }
  }

  /* =====================================================================
     9. Encryption at rest
     ---------------------------------------------------------------------
     Measurements, phone numbers and addresses sit in localStorage on whatever
     machine the shop uses, which is a shared counter PC as often as not. This
     puts AES-GCM 256 between a curious passer-by and that data.

     Be clear about what it is worth: the key is derived from a device secret
     stored beside the data, so it does not resist someone with the machine and
     intent. It resists the shoulder, the screenshot, the borrowed laptop and the
     backup that ends up somewhere it should not - which is how this data actually
     leaks in a small shop.
  ===================================================================== */
  const DEVKEY = 'sirhenrys.devkey';
  let keyPromise = null;

  function deviceSecret() {
    let s = null;
    try { s = localStorage.getItem(DEVKEY); } catch (e) {}
    if (!s) {
      s = hex(crypto.getRandomValues(new Uint8Array(32)));
      try { localStorage.setItem(DEVKEY, s); } catch (e) {}
    }
    return s;
  }

  function cryptoKey() {
    if (!keyPromise) {
      keyPromise = (async () => {
        if (!subtle) return null;
        const base = await subtle.importKey('raw', enc.encode(deviceSecret()), 'PBKDF2', false, ['deriveKey']);
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: enc.encode('sirhenrys.at-rest.v1'), iterations: 100000, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      })();
    }
    return keyPromise;
  }

  async function encryptJSON(obj) {
    const k = await cryptoKey();
    if (!k) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)));
    return 'v1:' + hex(iv) + ':' + hex(ct);
  }

  async function decryptJSON(str) {
    try {
      const [v, ivh, cth] = String(str || '').split(':');
      if (v !== 'v1') return null;
      const k = await cryptoKey();
      if (!k) return null;
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unhex(ivh) }, k, unhex(cth));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) { return null; }
  }

  // Convenience wrappers so a caller never has to think about the format.
  async function secureSet(key, obj) {
    const blob = await encryptJSON(obj);
    try { localStorage.setItem(key, blob == null ? JSON.stringify(obj) : blob); } catch (e) {}
  }
  async function secureGet(key) {
    let raw = null;
    try { raw = localStorage.getItem(key); } catch (e) {}
    if (!raw) return null;
    if (raw.startsWith('v1:')) return decryptJSON(raw);
    try { return JSON.parse(raw); } catch (e) { return null; }   // pre-encryption value
  }

  /* =====================================================================
     10. Bot protection
     ---------------------------------------------------------------------
     Two cheap signals that between them stop essentially all commodity form
     spam, and neither of them asks a human to identify a bus.

       - a honeypot field, off screen and hidden from screen readers, that only
         something filling every input will fill;
       - the time between the form appearing and being submitted. Nobody types an
         email address in under a second and a half.

     App Check (reCAPTCHA Enterprise) is the real defence and already sits in
     front of every Firebase call. This is for the forms that never reach Firebase.
  ===================================================================== */
  function botArm(form) {
    if (!form || form.querySelector('[data-hp]')) return;
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
    wrap.innerHTML = '<label>Leave this empty<input type="text" name="company_website" ' +
                     'data-hp tabindex="-1" autocomplete="off"></label>';
    form.appendChild(wrap);
    form.dataset.armed = String(Date.now());
  }

  function botCheck(form) {
    if (!form) return { ok: true };
    const hp = form.querySelector('[data-hp]');
    if (hp && hp.value) return { ok: false, error: 'Could not submit. Please try again.', reason: 'honeypot' };
    const armed = +(form.dataset.armed || 0);
    if (armed && Date.now() - armed < 1500) {
      return { ok: false, error: 'That was a little quick - please try again.', reason: 'timing' };
    }
    return { ok: true };
  }

  /* =====================================================================
     11. Cookies
     ---------------------------------------------------------------------
     This app stores almost nothing in cookies - the consent choice, and that is
     it. But the one cookie it does set is set properly, and it goes through here
     so that the next cookie anyone adds inherits the flags rather than inventing
     them. HttpOnly is impossible from JavaScript by definition; everything else
     that a Set-Cookie header can carry is here.
  ===================================================================== */
  function cookieSet(name, value, days) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    const exp = new Date(Date.now() + (days || 365) * 86400000).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}` +
      `; Expires=${exp}; Path=/; SameSite=Strict${secure}`;
  }
  function cookieGet(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function cookieDel(name) {
    document.cookie = `${encodeURIComponent(name)}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Strict`;
  }

  /* =====================================================================
     12. Field tampering
     ---------------------------------------------------------------------
     The cart holds slugs and quantities. It also holds a price per line, because
     the drawer has to render something. If an order is ever totalled from that
     stored price, editing localStorage buys a suit for one shilling.

     So the total is always recomputed here from the catalogue, and reprice()
     reports any line whose stored price disagrees. firestore.rules pins the same
     shape from the other side.
  ===================================================================== */
  function reprice(lines) {
    const S = window.SH;
    const out = { total: 0, lines: [], tampered: [] };
    (lines || []).forEach(l => {
      const p = S && S.byId ? S.byId(l.slug) : null;
      if (!p) { out.tampered.push({ ...l, why: 'unknown product' }); return; }
      const qty = Math.max(1, Math.min(50, parseInt(l.qty, 10) || 1));   // and no negative quantities
      const truth = p.price * qty;
      if (l.price != null && Math.abs(l.price * qty - truth) > 0.5) {
        out.tampered.push({ slug: l.slug, claimed: l.price, actual: p.price });
      }
      out.lines.push({ slug: l.slug, size: l.size, qty, price: p.price, line: truth });
      out.total += truth;
    });
    return out;
  }

  /* =====================================================================
     13. Trimming what leaves the building
     ---------------------------------------------------------------------
     The assistant sends a summary of the shop to Google on every question. It had
     no business sending customer names and phone numbers with it - the model is
     answering "what is late", and "Brian Otieno" adds nothing to that answer.

     So names are swapped for stable pseudonyms on the way out and swapped back on
     the way in. The staff member reads a real name; Google never sees one.
  ===================================================================== */
  const pseudo = new Map();
  const unpseudo = new Map();
  function pseudonym(real, prefix) {
    const k = String(real || '');
    if (!k) return '';
    if (pseudo.has(k)) return pseudo.get(k);
    const tag = (prefix || 'Customer') + ' ' + String(pseudo.size + 1).padStart(2, '0');
    pseudo.set(k, tag); unpseudo.set(tag, k);
    return tag;
  }
  // Put the real names back into a reply before it is shown.
  function rehydrate(text) {
    let s = String(text == null ? '' : text);
    unpseudo.forEach((real, tag) => { s = s.split(tag).join(real); });
    return s;
  }
  const PII_KEYS = /^(phone|mobile|tel|email|address|idnumber|kra|mpesaReceipt)$/i;
  // Drop anything that is a contact detail outright, pseudonymise anything that is
  // a person's name, and leave the rest alone.
  function redact(obj, nameKeys) {
    const names = nameKeys || ['customer', 'name', 'contact', 'company'];
    const walk = v => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        const o = {};
        Object.keys(v).forEach(k => {
          if (PII_KEYS.test(k)) return;                                  // never leaves
          if (names.includes(k) && typeof v[k] === 'string') {
            o[k] = pseudonym(v[k], k === 'company' ? 'Company' : 'Customer');
            return;
          }
          o[k] = walk(v[k]);
        });
        return o;
      }
      return v;
    };
    return walk(obj);
  }

  /* =====================================================================
     14. Transport
     ---------------------------------------------------------------------
     Strict-Transport-Security in _headers is what actually does this. The check
     here catches the one case a header cannot: a build opened over plain http on
     a hostname that is not localhost, which is somebody's staging box with the
     till on it.
  ===================================================================== */
  function enforceHTTPS() {
    const h = location.hostname;
    const localish = h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
                     h.endsWith('.local') || location.protocol === 'file:';
    if (location.protocol === 'http:' && !localish) {
      location.replace('https://' + location.host + location.pathname + location.search + location.hash);
      return false;
    }
    return true;
  }

  // Clickjacking. frame-ancestors in the CSP is the real control; this is the
  // fallback for a host that drops headers, and it fails closed rather than open.
  function bustFrames() {
    try { if (window.top !== window.self) { window.top.location = window.self.location; return false; } }
    catch (e) { document.documentElement.style.display = 'none'; return false; }
    return true;
  }

  /* =====================================================================
     15. Audit trail
     ---------------------------------------------------------------------
     Who did what, kept per device, capped so it cannot grow without bound. Not
     tamper proof - it is a client - but it answers "which till voided that sale"
     on a Monday morning, which is the question a shop actually asks.
  ===================================================================== */
  const AUDIT_KEY = 'sirhenrys.audit';
  const AUDIT_MAX = 500;
  function auditLog(action, detail) {
    try {
      const list = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      const who = sessionRead();
      list.unshift({ t: Date.now(), who: who ? who.id : null, action: String(action).slice(0, 60),
                     detail: String(detail == null ? '' : detail).slice(0, 200) });
      localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, AUDIT_MAX)));
    } catch (e) {}
  }
  function auditRead() {
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch (e) { return []; }
  }

  /* =====================================================================
     16. Uploads
     ---------------------------------------------------------------------
     Nothing in the app uploads a file today. When something does - a product
     photo, a signed corporate order - it goes through here, because the moment
     an upload is written in a hurry it trusts the extension and the MIME type,
     both of which the person uploading chooses. This reads the first bytes off
     the file instead and asks what it actually is.
  ===================================================================== */
  const MAGIC = [
    { type: 'image/jpeg', ext: ['jpg', 'jpeg'], bytes: [0xFF, 0xD8, 0xFF] },
    { type: 'image/png',  ext: ['png'],  bytes: [0x89, 0x50, 0x4E, 0x47] },
    { type: 'image/webp', ext: ['webp'], bytes: [0x52, 0x49, 0x46, 0x46] },
    { type: 'application/pdf', ext: ['pdf'], bytes: [0x25, 0x50, 0x44, 0x46] }
  ];

  async function checkUpload(file, opts) {
    opts = opts || {};
    const maxMB = opts.maxMB || 5;
    const allow = opts.allow || ['image/jpeg', 'image/png', 'image/webp'];
    if (!file) return { ok: false, error: 'No file chosen.' };
    if (file.size > maxMB * 1024 * 1024) return { ok: false, error: `Keep files under ${maxMB}MB.` };
    if (file.size === 0) return { ok: false, error: 'That file is empty.' };

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const hit = MAGIC.find(m => m.bytes.every((b, i) => head[i] === b));

    if (!hit) return { ok: false, error: 'That is not a file type we accept.' };
    if (!allow.includes(hit.type)) return { ok: false, error: `Accepted: ${allow.join(', ')}.` };
    // extension disagreeing with content is the classic double-extension trick
    if (!hit.ext.includes(ext)) return { ok: false, error: 'The file name does not match its contents.' };

    // never reuse the name the uploader chose
    return { ok: true, type: hit.type, size: file.size,
             safeName: hex(crypto.getRandomValues(new Uint8Array(8))) + '.' + hit.ext[0] };
  }

  /* =====================================================================
     boot
  ===================================================================== */
  enforceHTTPS();
  bustFrames();

  return {
    esc, escLines,
    validate, validateForm, fieldMsg, RULES,
    passwordScore,
    sha256Hex, pbkdf2, safeEqual,
    limiter: { check: limiterCheck, fail: limiterFail, reset: limiterReset },
    totp: { at: totpAt, now: totpNow, verify: totpVerify, uri: totpUri, secondsLeft: totpSecondsLeft },
    session: { issue: sessionIssue, read: sessionRead, touch: sessionTouch, clear: sessionClear, KEY: SESSION_KEY },
    serverGate,
    encryptJSON, decryptJSON, secureSet, secureGet,
    bot: { arm: botArm, check: botCheck },
    cookie: { set: cookieSet, get: cookieGet, del: cookieDel },
    reprice,
    redact, rehydrate, pseudonym,
    enforceHTTPS, bustFrames,
    audit: { log: auditLog, read: auditRead },
    checkUpload,
    config: CFG
  };
})();
