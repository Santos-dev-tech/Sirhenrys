/* ---------------------------------------------------------------------------
   Sir Henry's - the interface layer.

   Everything in here is page furniture: the theme, the consent banner, back to
   top, skip to content, toasts, the confirm dialog, accordions, copy buttons,
   password fields, campaign attribution.

   It works by delegation and by watching for renders, not by being called from
   app.js and admin.js. That is deliberate. Both of those replace whole subtrees
   with innerHTML on every route change, so anything that attaches a handler to a
   specific element at boot is gone by the second page. Delegated listeners on the
   document survive that; a small observer re-runs the handful of things that
   genuinely need to touch elements, once per render, debounced.
--------------------------------------------------------------------------- */
window.SHUX = (function () {
  'use strict';

  const esc = (window.SHSec && SHSec.esc) || (s => String(s == null ? '' : s));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICON = {
    sun:  '<path class="sun" d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4"/><circle class="sun" cx="12" cy="12" r="4"/>',
    moon: '<path class="moon" d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
    up:   '<path d="M12 19V5M5 12l7-7 7 7"/>',
    eyeOn:  '<g class="on"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></g>',
    eyeOff: '<g class="off"><path d="M4 4l16 16"/><path d="M9.9 5.7A10.6 10.6 0 0112 5.5c6.4 0 10 6.5 10 6.5a17 17 0 01-3.6 4.3M6.5 7.7A17 17 0 002 12s3.6 6.5 10 6.5a10.7 10.7 0 003.3-.5"/></g>',
    copy: '<g class="ic"><rect x="9" y="9" width="12" height="12" rx="1"/><path d="M5 15V4a1 1 0 011-1h9"/></g><path class="tick" d="M5 13l4.5 4.5L19 8" style="display:none"/>',
    ok:   '<path d="M20 6L9 17l-5-5"/>',
    warn: '<path d="M12 8v5M12 17h.01M10.3 3.9L2.6 17.4A2 2 0 004.3 20.4h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>'
  };
  const svg = (body, cls) =>
    `<svg viewBox="0 0 24 24" ${cls ? `class="${cls}" ` : ''}aria-hidden="true" ` +
    `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

  /* =====================================================================
     1. Theme
     ---------------------------------------------------------------------
     Three states, not two. "Dark", "light" and "whatever this machine is set
     to", because a visitor who has never touched the toggle should get the
     system answer and a visitor who has should get theirs, on every visit.

     The class is written onto <html>, never <body>. The console once deleted the
     storefront by writing to document.body, and that is not a mistake worth
     making twice.
  ===================================================================== */
  const THEME_KEY = 'sirhenrys.theme';
  const sysDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

  function readTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    const on = t === 'dark' || (!t && sysDark());
    $$('.themebtn').forEach(b => {
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('title', on ? 'Switch to light' : 'Switch to dark');
      b.setAttribute('aria-label', on ? 'Switch to light theme' : 'Switch to dark theme');
    });
    return on;
  }
  function setTheme(t) {
    try { t ? localStorage.setItem(THEME_KEY, t) : localStorage.removeItem(THEME_KEY); } catch (e) {}
    applyTheme(t);
    // The WebGL room cannot re-read CSS on a repaint - its dissolve colour is a
    // uniform, so it has to be told.
    if (window.Motion && Motion.retheme) { try { Motion.retheme(); } catch (e) {} }
  }
  const currentTheme = () => readTheme() || (sysDark() ? 'dark' : 'light');
  function toggleTheme() { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }

  function mountThemeButtons() {
    const mk = () => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'themebtn'; b.dataset.theme = '1';
      b.innerHTML = svg(ICON.sun + ICON.moon);
      b.addEventListener('click', toggleTheme);
      return b;
    };
    const act = $('.hdr-act');
    if (act && !act.querySelector('.themebtn')) act.insertBefore(mk(), act.querySelector('.signin'));
    // the console gets its own, next to the mobile menu button in the main column
    const mt = $('#ad .mtoggle');
    if (mt && mt.parentElement && !mt.parentElement.querySelector('.themebtn')) {
      const b = mk();
      b.style.cssText = 'vertical-align:middle;margin-left:6px';
      mt.insertAdjacentElement('afterend', b);
    }
  }

  /* =====================================================================
     2. Skip to content
  ===================================================================== */
  function mountSkip() {
    if ($('.skip')) return;
    const a = document.createElement('a');
    a.className = 'skip'; a.href = '#app'; a.textContent = 'Skip to content';
    a.addEventListener('click', e => {
      e.preventDefault();
      // a heading is not focusable by default, so it is made focusable for one
      // keypress and then put back - otherwise it collects tab stops forever
      const t = $('#app') || $('#view');
      if (!t) return;
      t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: false });
      t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      t.addEventListener('blur', () => t.removeAttribute('tabindex'), { once: true });
    });
    document.body.insertBefore(a, document.body.firstChild);
  }

  /* =====================================================================
     3. Back to top
     ---------------------------------------------------------------------
     Lenis drives the scroll on this site, so listening to window scroll gives a
     stale number. It reports its own position; fall back to the native one only
     when Lenis is not there (the console, and any build with motion off).
  ===================================================================== */
  let toTopEl = null;
  function mountToTop() {
    if (toTopEl && document.body.contains(toTopEl)) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'totop'; b.setAttribute('aria-label', 'Back to top');
    b.innerHTML = svg(ICON.up);
    b.addEventListener('click', () => {
      const L = window.Motion && Motion.lenis && Motion.lenis();
      if (L && L.scrollTo) L.scrollTo(0, { duration: reduced ? 0 : 1.1 });
      else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      const t = $('#app') || $('#view');
      if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true });
               t.addEventListener('blur', () => t.removeAttribute('tabindex'), { once: true }); }
    });
    document.body.appendChild(b);
    toTopEl = b;

    const read = () => {
      const L = window.Motion && Motion.lenis && Motion.lenis();
      return (L && typeof L.scroll === 'number') ? L.scroll : (window.scrollY || document.documentElement.scrollTop || 0);
    };
    let raf = 0;
    const tick = () => {
      raf = 0;
      b.classList.toggle('on', read() > 600 && !document.documentElement.hasAttribute('data-modal'));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', onScroll, { passive: true });
    setInterval(tick, 400);   // Lenis does not fire window scroll events
    tick();
  }

  /* =====================================================================
     4. Consent
     ---------------------------------------------------------------------
     There is one thing to consent to and the banner says what it is. No
     categories, no "legitimate interest", no pre-ticked anything: analytics is
     off in firebase-config.js until somebody presses accept, and declining is a
     button of exactly the same weight as accepting.

     The choice goes in a cookie set through SHSec, so it carries SameSite=Strict
     and Secure, and in localStorage so it survives a cookie clear-out.
  ===================================================================== */
  const CONSENT_KEY = 'sirhenrys.consent';
  function consent() {
    try {
      return localStorage.getItem(CONSENT_KEY) ||
             (window.SHSec ? SHSec.cookie.get(CONSENT_KEY) : null);
    } catch (e) { return null; }
  }
  function setConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {}
    if (window.SHSec) SHSec.cookie.set(CONSENT_KEY, v, 180);
    const bar = $('.cc'); if (bar) bar.classList.remove('on');
    if (v === 'yes' && window.SH_FIREBASE) SH_FIREBASE.analyticsAllowed = true;
    if (window.SHSec) SHSec.audit.log('consent', v);
  }

  function mountConsent() {
    if ($('.cc')) return;
    const bar = document.createElement('div');
    bar.className = 'cc';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie choice');
    bar.innerHTML =
      '<p>We use one cookie to remember this choice. Nothing else is set unless you ' +
      'say yes to measurement, which tells us which pages people actually read. ' +
      'Say no and the site behaves exactly the same. ' +
      '<a href="#/privacy">How we handle your data</a></p>' +
      '<div class="cc-act">' +
        '<button class="btn ghost" data-cc="no">Decline</button>' +
        '<button class="btn" data-cc="yes">Accept</button>' +
      '</div>';
    document.body.appendChild(bar);
    if (!consent()) setTimeout(() => bar.classList.add('on'), 900);
  }

  /* =====================================================================
     5. Toasts and the confirm dialog
     ---------------------------------------------------------------------
     window.confirm blocks the whole page, cannot be styled, cannot say more than
     one line, and on a phone it looks like the browser is warning you about the
     site. This one is a promise, so a caller reads top to bottom.
  ===================================================================== */
  let toastEl = null, toastT = 0;
  function toast(msg, kind) {
    if (!toastEl || !document.body.contains(toastEl)) {
      toastEl = document.createElement('div');
      toastEl.className = 'ux-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = 'ux-toast on' + (kind ? ' ' + kind : '');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('on'), 3200);
  }

  let modalEl = null;
  function confirmDialog(opts) {
    opts = typeof opts === 'string' ? { body: opts } : (opts || {});
    return new Promise(resolve => {
      if (!modalEl || !document.body.contains(modalEl)) {
        modalEl = document.createElement('div');
        modalEl.className = 'ux-modal';
        modalEl.innerHTML = '<div class="ux-modal-bg" data-x></div>' +
          '<div class="ux-modal-card" role="dialog" aria-modal="true" aria-labelledby="uxmT">' +
          '<h3 id="uxmT"></h3><p></p><div class="ux-modal-act">' +
          '<button class="btn ghost" data-x>Cancel</button>' +
          '<button class="btn go"></button></div></div>';
        document.body.appendChild(modalEl);
      }
      const card = $('.ux-modal-card', modalEl);
      $('#uxmT', modalEl).textContent = opts.title || 'Are you sure?';
      $('p', card).textContent = opts.body || '';
      const go = $('.btn.go', card);
      go.textContent = opts.confirm || 'Confirm';
      $('.btn.ghost', card).textContent = opts.cancel || 'Cancel';
      card.classList.toggle('danger', !!opts.danger);

      const prev = document.activeElement;
      modalEl.classList.add('on');
      document.documentElement.setAttribute('data-modal', '1');
      go.focus();

      const done = v => {
        modalEl.classList.remove('on');
        document.documentElement.removeAttribute('data-modal');
        modalEl.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey);
        if (prev && prev.focus) try { prev.focus(); } catch (e) {}
        resolve(v);
      };
      const onClick = e => {
        if (e.target.closest('[data-x]')) done(false);
        else if (e.target === go) done(true);
      };
      // Escape cancels, and Tab is trapped inside the dialog while it is open
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); done(false); return; }
        if (e.key !== 'Tab') return;
        const f = $$('button', card);
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      modalEl.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    });
  }

  /* =====================================================================
     6. Form result states
     ---------------------------------------------------------------------
     Every form in the app now ends in one of exactly two blocks, so a person
     never has to work out whether something worked. Both carry role="alert" so a
     screen reader says it without being asked.
  ===================================================================== */
  function formResult(form, ok, title, detail) {
    if (!form) return null;
    const old = form.parentElement && form.parentElement.querySelector('.form-ok,.form-bad');
    if (old) old.remove();
    const box = document.createElement('div');
    box.className = ok ? 'form-ok' : 'form-bad';
    box.setAttribute('role', ok ? 'status' : 'alert');
    box.innerHTML = svg(ok ? ICON.ok : ICON.warn) +
      `<div><b>${esc(title)}</b>${detail ? `<p>${esc(detail)}</p>` : ''}</div>`;
    form.parentElement.insertBefore(box, form);
    box.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    return box;
  }
  const formOk  = (f, t, d) => formResult(f, true, t, d);
  const formBad = (f, t, d) => formResult(f, false, t, d);

  /* =====================================================================
     7. Password fields
     ---------------------------------------------------------------------
     Every input[type=password] gets an eye. The ones marked data-strength get a
     meter as well. Both are added once per render and skipped if already there.

     The eye matters more than it looks: on a phone, in a shop, a person who
     cannot see what they typed types it three times, and the third attempt is
     what trips the rate limiter.
  ===================================================================== */
  function mountPasswords(root) {
    $$('input[type="password"]', root || document).forEach(inp => {
      if (inp.dataset.pwWired) return;
      inp.dataset.pwWired = '1';

      const wrap = document.createElement('div');
      wrap.className = 'pw-wrap';
      inp.parentElement.insertBefore(wrap, inp);
      wrap.appendChild(inp);

      const eye = document.createElement('button');
      eye.type = 'button'; eye.className = 'pw-eye';
      eye.setAttribute('aria-label', 'Show password');
      eye.innerHTML = svg(ICON.eyeOn + ICON.eyeOff);
      eye.addEventListener('click', () => {
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        eye.classList.toggle('shown', show);
        eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        inp.focus();
        // put the caret back at the end rather than at the start
        const v = inp.value; try { inp.setSelectionRange(v.length, v.length); } catch (e) {}
      });
      wrap.appendChild(eye);

      if (inp.dataset.strength === '1' && window.SHSec) {
        const m = document.createElement('div');
        m.className = 'pw-meter'; m.dataset.score = '0';
        m.innerHTML = '<div class="pw-bars"><i></i><i></i><i></i><i></i></div>' +
                      '<span class="pw-label" aria-live="polite"></span>';
        wrap.parentElement.appendChild(m);
        const label = $('.pw-label', m);
        const paint = () => {
          if (!inp.value) { m.dataset.score = '0'; label.textContent = ''; return; }
          const r = SHSec.passwordScore(inp.value);
          m.dataset.score = String(r.score);
          label.innerHTML = `<b>${esc(r.label)}</b>${r.notes.length ? ' &middot; ' + esc(r.notes[0]) : ''}`;
        };
        inp.addEventListener('input', paint);
        paint();
      }
    });
  }

  /* =====================================================================
     8. Campaign attribution
     ---------------------------------------------------------------------
     First touch and last touch, both kept. First touch is what tells you which
     campaign found the customer; last touch is what tells you which one closed
     them. Keeping only one of the two is the usual mistake and it makes every
     number afterwards an argument.

     The parameters are stripped from the address bar once read, so a shared link
     does not carry somebody else's campaign tag into a friend's session.
  ===================================================================== */
  const ATTR_KEY = 'sirhenrys.attr';
  const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid'];

  function readAttr() { try { return JSON.parse(localStorage.getItem(ATTR_KEY) || 'null'); } catch (e) { return null; } }
  function saveAttr(a) { try { localStorage.setItem(ATTR_KEY, JSON.stringify(a)); } catch (e) {} }

  function captureUTM() {
    const sp = new URLSearchParams(location.search);
    const hit = {};
    let found = false;
    UTM.forEach(k => {
      const v = sp.get(k);
      if (!v) return;
      // never trust a query parameter into storage unvalidated
      const r = SHSec.validate(v, 'text', { max: 80, required: false });
      hit[k] = String(r.value || '').slice(0, 80);
      found = true;
    });

    const ref = document.referrer || '';
    let refHost = '';
    try { refHost = ref ? new URL(ref).hostname : ''; } catch (e) {}
    if (refHost && refHost !== location.hostname) { hit.referrer = refHost; found = true; }

    const store = readAttr() || { first: null, last: null, visits: 0 };
    store.visits = (store.visits || 0) + 1;
    if (found) {
      const touch = { ...hit, at: Date.now(), landing: location.hash || '#/' };
      if (!store.first) store.first = touch;
      store.last = touch;
    }
    saveAttr(store);

    if (found) {
      // clear the parameters out of the address bar without adding a history entry
      UTM.forEach(k => sp.delete(k));
      const q = sp.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    }
    return store;
  }

  function attribution() {
    const a = readAttr() || {};
    const src = t => t ? (t.utm_source || t.referrer || 'direct') : 'direct';
    return {
      first: a.first || null, last: a.last || null, visits: a.visits || 1,
      firstSource: src(a.first), lastSource: src(a.last),
      // one flat string, which is what an order record and a report both want
      summary: `${src(a.first)} → ${src(a.last)}` +
               (a.last && a.last.utm_campaign ? ` (${a.last.utm_campaign})` : '')
    };
  }

  /* =====================================================================
     9. Accordions
     ---------------------------------------------------------------------
     Animated to a measured height rather than to max-height:9999px, because the
     second one gives every panel the same wrong duration and a visible lag on
     the short ones. Height is set to the scroll height, then released to auto
     when the transition ends, so a panel that reflows afterwards still fits.
  ===================================================================== */
  function accToggle(item, open) {
    const panel = $('.acc-a', item);
    const btn = $('.acc-q', item);
    if (!panel || !btn) return;
    const inner = panel.firstElementChild;
    const want = open == null ? !item.classList.contains('open') : open;

    if (want) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      panel.style.height = inner.offsetHeight + 'px';
      if (reduced) { panel.style.height = 'auto'; return; }
      panel.addEventListener('transitionend', function done(e) {
        if (e.propertyName !== 'height') return;
        panel.style.height = 'auto';
        panel.removeEventListener('transitionend', done);
      });
    } else {
      panel.style.height = inner.offsetHeight + 'px';
      requestAnimationFrame(() => {
        item.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        panel.style.height = '0px';
      });
    }
  }

  function mountAcc(root) {
    $$('.acc-item', root || document).forEach((item, i) => {
      const btn = $('.acc-q', item);
      const panel = $('.acc-a', item);
      if (!btn || !panel || btn.dataset.accWired) return;
      btn.dataset.accWired = '1';
      const id = 'acc-p-' + Math.random().toString(36).slice(2, 8);
      panel.id = id;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', id);
      panel.setAttribute('role', 'region');
      panel.style.height = '0px';
      if (item.dataset.open === '1') accToggle(item, true);
    });
  }

  /* =====================================================================
     10. Copy buttons
     ---------------------------------------------------------------------
     Anything with data-copy gets one. The clipboard API needs a secure context,
     so there is a fallback for a demo opened over plain http on a laptop.
  ===================================================================== */
  function mountCopy(root) {
    $$('[data-copy]', root || document).forEach(el => {
      if (el.dataset.copyWired) return;
      el.dataset.copyWired = '1';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'copybtn';
      b.innerHTML = svg(ICON.copy) + '<span>Copy</span>';
      b.setAttribute('aria-label', 'Copy ' + (el.dataset.copyLabel || 'to clipboard'));
      b.addEventListener('click', async () => {
        const text = el.dataset.copy === 'self' ? el.textContent.trim() : el.dataset.copy;
        let ok = false;
        try {
          if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
        } catch (e) {}
        if (!ok) {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px';
          document.body.appendChild(ta); ta.select();
          try { ok = document.execCommand('copy'); } catch (e) {}
          ta.remove();
        }
        b.classList.toggle('done', ok);
        $('span', b).textContent = ok ? 'Copied' : 'Press Ctrl+C';
        toast(ok ? 'Copied to the clipboard' : 'Could not copy - select it and press Ctrl+C', ok ? 'ok' : 'bad');
        setTimeout(() => { b.classList.remove('done'); $('span', b).textContent = 'Copy'; }, 2200);
      });
      el.insertAdjacentElement('afterend', b);
    });
  }

  /* =====================================================================
     11. Skeletons
     ---------------------------------------------------------------------
     A grid of the right shape while a view builds. Only shown if the build takes
     longer than 120ms - below that a flash of skeleton reads as a glitch, not as
     loading.
  ===================================================================== */
  function skeletonGrid(n) {
    return `<div class="wrap"><div class="sk-grid">${
      Array.from({ length: n || 8 }, () =>
        '<div class="sk-card"><div class="sk sk-img"></div><div class="sk sk-line"></div>' +
        '<div class="sk sk-line s"></div></div>').join('')
    }</div></div>`;
  }

  /* =====================================================================
     12. Build stamp
     ---------------------------------------------------------------------
     A date the visitor can see, in the footer, next to the copyright. Written by
     tools/stamp.py at build time so it is the date this build was made rather
     than a hand-typed number that goes stale the first week.
  ===================================================================== */
  function mountStamp() {
    const bot = $('.ftr-bot');
    if (!bot || $('.ftr-stamp')) return;
    const b = window.SH_BUILD || {};
    const d = b.date ? new Date(b.date) : new Date(document.lastModified);
    const s = document.createElement('span');
    s.className = 'ftr-stamp';
    s.innerHTML = 'Last updated <time datetime="' + esc(d.toISOString().slice(0, 10)) + '">' +
      esc(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) + '</time>' +
      (b.rev ? ' &middot; build ' + esc(b.rev) : '');
    bot.insertBefore(s, bot.firstChild);
  }

  /* =====================================================================
     wiring
     ---------------------------------------------------------------------
     One pass, debounced, re-run whenever either app replaces its subtree. An
     observer rather than a hook into app.js because there are two routers and
     one of them tears its whole shell down on sign-out.
  ===================================================================== */
  function wire(root) {
    mountThemeButtons();
    mountPasswords(root);
    mountAcc(root);
    mountCopy(root);
    mountStamp();
    // every form in the app gets bot protection armed the moment it appears
    $$('form', root || document).forEach(f => { if (window.SHSec) SHSec.bot.arm(f); });
  }

  let wireT = 0;
  function schedule() { clearTimeout(wireT); wireT = setTimeout(() => wire(), 40); }

  function boot() {
    applyTheme(readTheme());
    // follow the system if the visitor has never chosen
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => { if (!readTheme()) applyTheme(null); });

    mountSkip();
    mountToTop();
    mountConsent();
    captureUTM();
    wire();

    // delegated handlers: these survive every innerHTML replacement
    document.addEventListener('click', e => {
      const cc = e.target.closest('[data-cc]');
      if (cc) { setConsent(cc.dataset.cc); return; }
      const q = e.target.closest('.acc-q');
      if (q) { e.preventDefault(); accToggle(q.closest('.acc-item')); return; }
      const th = e.target.closest('[data-theme-toggle]');
      if (th) { e.preventDefault(); toggleTheme(); }
      // app.js opens and closes the mobile drawer; this keeps the button's
      // aria-expanded honest about it, which is the whole of what a screen reader
      // has to go on.
      const burger = document.querySelector('[data-menu]');
      if (burger) setTimeout(() => {
        const nav = document.getElementById('mnav');
        burger.setAttribute('aria-expanded', String(!!nav && nav.classList.contains('on')));
      }, 60);
    });

    const app = $('#app'), view = $('#view'), ad = $('#ad');
    const obs = new MutationObserver(schedule);
    [app, view, ad].forEach(n => n && obs.observe(n, { childList: true, subtree: false }));
    window.addEventListener('hashchange', schedule);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return {
    theme: { set: setTheme, get: currentTheme, toggle: toggleTheme, apply: applyTheme },
    consent, setConsent,
    toast, confirm: confirmDialog,
    formOk, formBad, formResult,
    attribution, captureUTM,
    accToggle, skeletonGrid,
    wire, mountPasswords
  };
})();
