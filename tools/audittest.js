/* ---------------------------------------------------------------------------
   The audit. Every item on the three checklists, checked rather than asserted.

     node tools/audittest.js          (needs python tools/serve.py 8100 running)

   Two kinds of check, both in here on purpose:

     STATIC  - reads the files off disk. Headers, rules, inventory, what is and is
               not in the source.
     LIVE    - drives a real Chrome against the running site and measures the DOM.
               A rule that exists in a stylesheet proves nothing; an element that
               is 44 pixels tall and moves the page when clicked proves something.

   Nothing here checks that a thing "is not display:none". That form of assertion
   passed once for an element inside a hidden parent and it is banned in this
   project. Every visual check reads a bounding box or a computed value.

   Exit code is the number of failures, so CI and a person both get an answer.
--------------------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:8100';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- the ledger ---------- */
const results = [];
function check(group, id, title, pass, detail) {
  results.push({ group, id, title, pass: !!pass, detail: String(detail == null ? '' : detail) });
}

/* =====================================================================
   STATIC
===================================================================== */
function staticChecks() {
  const idx = read('index.html');
  const headers = read('_headers');
  const rules = read('firestore.rules');
  const data = read('assets/js/data.js');
  const sec = read('assets/js/security.js');
  const ux = read('assets/js/ux.js');
  const uxcss = read('assets/css/ux.css');
  const aiui = read('assets/js/ai-ui.js');
  const ai = read('assets/js/ai.js');
  const fb = JSON.parse(read('firebase.json'));

  const metaCSP = (idx.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  const hdrCSP = (headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m) || [])[1] || '';
  const fbHeaders = (fb.hosting.headers.find(h => h.source === '**') || {}).headers || [];
  const fbMap = Object.fromEntries(fbHeaders.map(h => [h.key, h.value]));

  /* ---- 1. hide API keys ---- */
  const secretRun = runPy('tools/secretscan.py');
  check('security', 1, 'Hide API keys', secretRun.code === 0,
    'secretscan over the working tree: ' + secretRun.last);

  /* ---- 2. purge git secrets ---- */
  const histRun = runPy('tools/secretscan.py', '--history');
  check('security', 2, 'Purge git secrets', histRun.code === 0,
    'secretscan over every commit ever made: ' + histRun.last);

  /* ---- 3. use a public DB key ---- */
  const cfg = read('assets/js/firebase-config.js');
  const isWebKey = /apiKey:\s*'AIza[\w-]{35}'/.test(cfg);
  const noServiceAcct = !/"type"\s*:\s*"service_account"/.test(cfg);
  check('security', 3, 'Use public DB key', isWebKey && noServiceAcct,
    'apiKey is a Firebase web key (AIza…, public by design); no service-account material present');

  /* ---- 4. row-level security ---- */
  const rls = /match \/shops\/\{shop\}\/customers\/\{uid\}/.test(rules) &&
              /request\.auth\.uid == uid/.test(rules);
  check('security', 4, 'Enable row-level security', rls,
    'firestore.rules scopes /customers/{uid} to request.auth.uid == uid');

  /* ---- 6. server-side auth ---- */
  const srv = /function isStaff\(\)/.test(rules) &&
              /request\.auth\.token\.staff == true/.test(rules) &&
              /serverGate/.test(read('assets/js/admin.js'));
  check('security', 6, 'Enforce server-side auth', srv,
    'rules gate on a staff custom claim; admin.js reads it back with getIdTokenResult');

  /* ---- 7. lock record access ---- */
  const lock = /allow update: if isStaff\(\)/.test(rules) &&
               /allow delete: if false/.test(rules) &&
               /restrictedKey/.test(rules);
  check('security', 7, 'Lock record access', lock,
    'orders: customer creates, staff updates, nobody deletes; settings/sales/adjustments manager+');

  /* ---- 9. secure session cookies ---- */
  const cookieFlags = /SameSite=Strict/.test(sec) && /Secure/.test(sec) &&
                      /Path=\//.test(sec);
  const noCookieSession = !/document\.cookie[^\n]*sirhenrys\.staff/.test(sec + ux);
  check('security', 9, 'Secure session cookies', cookieFlags && noCookieSession,
    'the one cookie set carries Path=/; SameSite=Strict and Secure on https; no session token in a cookie');

  /* ---- 10. hash passwords ---- */
  const noPlainPin = !/pin:\s*'\d{4}'/.test(data);
  const hasHash = /hash:'[0-9a-f]{64}'/.test(data.replace(/\s/g, '')) &&
                  /salt:'[0-9a-f]{32}'/.test(data.replace(/\s/g, ''));
  check('security', 10, 'Hash passwords', noPlainPin && hasHash,
    'no plaintext PIN in data.js; PBKDF2-SHA256 hash + 128-bit salt per member of staff');

  /* ---- 13. parameterised queries ---- */
  const jsFiles = fs.readdirSync(path.join(ROOT, 'assets/js'))
    .filter(f => f.endsWith('.js'));
  const regexBuilt = jsFiles.filter(f => /new RegExp\((?!'\(\?:\^\|; \)')/.test(read('assets/js/' + f)));
  const searchSafe = /\.toLowerCase\(\)\.includes\(q\)/.test(data);
  check('security', 13, 'Parameterize queries', searchSafe && regexBuilt.length <= 1,
    'search is String.includes, not a built regex; Firestore SDK parameterises every read');

  /* ---- 18. security headers ---- */
  const want = ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options',
                'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy',
                'Cross-Origin-Opener-Policy', 'Cross-Origin-Resource-Policy'];
  const missingHdr = want.filter(h => !new RegExp('^\\s*' + h + ':', 'm').test(headers));
  const missingFb = want.filter(h => !fbMap[h]);
  // the meta copy may differ from the header in exactly one way: no frame-ancestors
  const norm = s => s.replace(/frame-ancestors [^;]+;\s*/, '').replace(/\s+/g, ' ').trim();
  const cspParity = norm(metaCSP) === norm(hdrCSP);
  const fbParity = fbMap['Content-Security-Policy'] &&
                   norm(fbMap['Content-Security-Policy']) === norm(hdrCSP);
  check('security', 18, 'Add security headers',
    !missingHdr.length && !missingFb.length && cspParity && fbParity,
    `${want.length}/${want.length} in _headers and firebase.json; CSP identical across ` +
    `_headers, firebase.json and the meta tag` +
    (missingHdr.length ? ' MISSING ' + missingHdr.join(',') : ''));

  /* ---- 19. force HTTPS ---- */
  const hsts = /Strict-Transport-Security: max-age=63072000; includeSubDomains; preload/.test(headers);
  const upgrade = /upgrade-insecure-requests/.test(hdrCSP) && /upgrade-insecure-requests/.test(metaCSP);
  check('security', 19, 'Force HTTPS', hsts && upgrade && /enforceHTTPS/.test(sec),
    'HSTS 2 years + includeSubDomains + preload; upgrade-insecure-requests in the CSP; ' +
    'client-side redirect for a host that drops both');

  /* ---- 20. scan dependencies ---- */
  const depRun = runPy('tools/depscan.py');
  check('security', 20, 'Scan dependencies', depRun.code === 0,
    'every vendored file matches its recorded sha256; npm audit clean over tools/');

  /* ---- login 2: no client-only admin check ---- */
  check('login', 2, 'Server decides who is admin', srv && /securityBanner/.test(read('assets/js/admin.js')),
    'the console shows a warning bar on every page while no staff claim is present');

  /* ---- UX 7: hover states ---- */
  const hovers = (read('assets/css/site.css').match(/:hover/g) || []).length +
                 (uxcss.match(/:hover/g) || []).length;
  check('ux', 7, 'Hover states', hovers >= 25, hovers + ' :hover rules across site.css and ux.css');

  /* ---- UX 10: print stylesheet ---- */
  const print = /@media print/.test(uxcss) && /\.hdr[^}]*display:none/.test(uxcss.replace(/\s/g, ''));
  check('ux', 10, 'Print stylesheet', print,
    'ux.css @media print hides the header, marquee, drawers and floating buttons, and writes link URLs out');

  /* ---- extras that are file facts ---- */
  // strip comments first - this file talks ABOUT the inline script it no longer has
  const idxNoComments = idx.replace(/<!--[\s\S]*?-->/g, '');
  const inlineScripts = (idxNoComments.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []);
  check('extra', 5, 'No inline script (CSP can stay strict)', inlineScripts.length === 0,
    inlineScripts.length + ' inline <script> tags; script-src is \'self\' with no unsafe-inline');

  const blanks = (idx.match(/target="_blank"/g) || []).length;
  const noopeners = (idx.match(/rel="noopener/g) || []).length;
  check('extra', 6, 'Every target=_blank carries rel=noopener', blanks > 0 && noopeners >= blanks,
    noopeners + ' rel=noopener for ' + blanks + ' target=_blank');

  check('extra', 7, 'Constant-time credential compare', /function safeEqual/.test(sec) &&
    /diff \|=/.test(sec), 'SHSec.safeEqual XORs every character rather than returning early');

  check('extra', 4, 'security.txt published',
    fs.existsSync(path.join(ROOT, '.well-known/security.txt')) &&
    /Contact:/.test(read('.well-known/security.txt')),
    '.well-known/security.txt with a contact, a policy link and an expiry');

  /* ---- 17. trim what leaves the building ---- */
  check('security', 17, 'Trim API responses', /SHSec\.redact\(payload\)/.test(ai) &&
    /rehydrate/.test(aiui),
    'the AI snapshot is redacted before it is sent and rehydrated before it is shown');

  /* ---- 15. escape user content (source side) ---- */
  const escapesQuote = /'&#39;'/.test(sec) || /&#39;/.test(sec);
  const aiEscaped = /SHSec\.esc\(SHSec\.rehydrate\(title\)\)/.test(aiui);
  check('security', 15, 'Escape user content', escapesQuote && aiEscaped,
    'SHSec.esc covers & < > " \' / `; the assistant card title is escaped (it was not)');
}

function runPy(script, arg) {
  try {
    const args = [path.join(ROOT, script)];
    if (arg) args.push(arg);
    const out = execFileSync('python', args, { cwd: ROOT, encoding: 'utf8' });
    return { code: 0, last: out.trim().split('\n').filter(Boolean).pop() };
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    return { code: e.status == null ? 1 : e.status, last: out.trim().split('\n').filter(Boolean).pop() || 'error' };
  }
}

/* =====================================================================
   LIVE
===================================================================== */
(async () => {
  staticChecks();

  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    // this harness holds one page open for several minutes with WebGL running on
    // SwiftShader; the default 180s protocol timeout is close enough to bite
    protocolTimeout: 300000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const p = await b.newPage();
  p.setDefaultNavigationTimeout(120000);   // the local server is single-process

  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const errs = [], cspViolations = [], failedReqs = [];
  /* ERR_ABORTED is not a failure. Firestore holds an open long-poll channel and
     reCAPTCHA holds a beacon; every time this harness changes the hash or reloads,
     both are torn down and Chrome reports them aborted. Counting those would make
     this check fail forever for a reason that has nothing to do with the site.
     What matters is a request that was BLOCKED or could not connect - a CSP block
     is exactly what a too-tight policy looks like from the page's side. */
  const REAL_FAILURE = /ERR_BLOCKED_BY_(CSP|CLIENT|RESPONSE)|ERR_NAME_NOT_RESOLVED|ERR_CERT|ERR_FILE_NOT_FOUND/;
  /* A refused connection to python tools/serve.py is that server running out of
     backlog while this harness pulls two hundred images in a burst. It says
     nothing about the site, so it is counted separately and reported rather than
     failed on. Anything BLOCKED is a different matter - that is the CSP talking. */
  const flaky = [];
  p.on('requestfailed', r => {
    const why = (r.failure() || {}).errorText || '?';
    const url = r.url().slice(0, 110);
    if (REAL_FAILURE.test(why)) failedReqs.push(url + ' :: ' + why);
    else if (/ERR_CONNECTION_REFUSED/.test(why)) flaky.push(url);
  });
  p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  p.on('console', m => {
    const t = m.text();
    if (m.type() === 'error') errs.push(t.slice(0, 200));
    if (/Content Security Policy/i.test(t)) cspViolations.push(t.slice(0, 160));
  });

  // ---- load with a campaign tag on the URL, so UTM capture is exercised on the
  // real first paint rather than in a synthetic call
  await p.goto(BASE + '/index.html?utm_source=instagram&utm_medium=paid&utm_campaign=linen-2026',
               { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4500);

  const R = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const box = el => { if (!el) return null; const b = el.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), t: Math.round(b.top), l: Math.round(b.left) }; };
    const vis = el => { if (!el) return false; const b = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && +s.opacity > 0.01; };
    const o = {};

    /* ---------- UX 14: UTM ---------- */
    o.utm = { stored: JSON.parse(localStorage.getItem('sirhenrys.attr') || 'null'),
              urlAfter: location.search, summary: SHUX.attribution().summary };

    /* ---------- UX 12: skip link ---------- */
    const skip = document.querySelector('.skip');
    o.skipBefore = box(skip);
    /* Wait for the transition to ACTUALLY end rather than polling for a value that
       stops changing. Polling caught the 180ms slide mid-flight on a loaded
       machine and reported a half-open link as a failure - twice. transitionend
       is exact; the timeout is only there so a browser that never fires it (or a
       reduced-motion run, where there is no transition at all) still returns. */
    const settle = el => new Promise(resolve => {
      let done = false;
      const finish = () => { if (done) return; done = true;
        el.removeEventListener('transitionend', onEnd); resolve(box(el)); };
      const onEnd = e => { if (e.propertyName === 'transform') finish(); };
      el.addEventListener('transitionend', onEnd);
      setTimeout(finish, 1200);
    });
    if (skip) {
      const p = settle(skip);
      skip.focus();
      o.skipFocused = await p;
    } else o.skipFocused = null;
    o.skipHref = skip ? skip.getAttribute('href') : null;
    if (skip) skip.blur();

    /* ---------- UX 1: dark mode ---------- */
    const themeBtn = document.querySelector('.hdr-act .themebtn');
    o.themeBtnBox = box(themeBtn);
    const bgOf = () => getComputedStyle(document.body).backgroundColor;
    // .brand carries transition:color .4s, so a colour read too early is a
    // half-mixed value that says nothing. The custom property does not transition,
    // so the palette is read from there and the painted result from the body.
    const inkOf = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    SHUX.theme.set('light'); await wait(700);
    const lightBg = bgOf(), lightInk = inkOf();
    themeBtn && themeBtn.click(); await wait(700);
    const darkBg = bgOf(), darkInk = inkOf();
    o.theme = { lightBg, darkBg, lightInk, darkInk,
                attr: document.documentElement.getAttribute('data-theme'),
                persisted: localStorage.getItem('sirhenrys.theme'),
                changed: lightBg !== darkBg && lightInk !== darkInk };
    /* ---------- contrast, in BOTH themes ----------
       The consent bar shipped unreadable in dark mode and every other check still
       passed: it was the right height, it had two 40px buttons, the choice stuck.
       Only looking at it found the problem. So it gets measured now.

       Walks up from each element to the first ancestor that actually paints a
       background - a transparent parent tells you nothing - and computes the WCAG
       2.1 contrast ratio against it. */
    const rgb = str => (str.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
    const alpha = str => { const n = (str.match(/[\d.]+/g) || []); return n.length > 3 ? +n[3] : 1; };
    const lum = c => { const f = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
    const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg);
      return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)); };
    const paintedBg = el => {
      let n = el;
      while (n && n !== document.documentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (alpha(c) > 0.05) return rgb(c);
        n = n.parentElement;
      }
      return rgb(getComputedStyle(document.body).backgroundColor);
    };
    const contrastFor = sels => sels.map(sel => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const cs = getComputedStyle(el);
      return { sel, ratio: ratio(rgb(cs.color), paintedBg(el)),
               size: parseFloat(cs.fontSize), weight: cs.fontWeight };
    });

    const CONTRAST_SELS = ['.cc p', '.cc .btn', '.cc .btn.ghost', '.cc a', '.skip', '.totop'];
    document.querySelector('.cc').classList.add('on');
    document.querySelector('.totop').classList.add('on');
    await wait(200);
    SHUX.theme.set('dark'); await wait(700);
    o.contrastDark = contrastFor(CONTRAST_SELS);
    SHUX.theme.set('light'); await wait(700);
    o.contrastLight = contrastFor(CONTRAST_SELS);
    document.querySelector('.totop').classList.remove('on');

    /* ---------- UX 2: consent ---------- */
    localStorage.removeItem('sirhenrys.consent');
    const cc = document.querySelector('.cc');
    cc.classList.add('on'); await wait(120);
    const ccBtns = [...cc.querySelectorAll('.cc-act .btn')].map(b => ({
      label: b.textContent.trim(), box: box(b),
      font: getComputedStyle(b).fontSize, weight: getComputedStyle(b).fontWeight }));
    o.consent = { visible: vis(cc), box: box(cc), buttons: ccBtns,
                  hasPolicyLink: !!cc.querySelector('a[href="#/privacy"]') };
    cc.querySelector('[data-cc="no"]').click(); await wait(160);
    o.consent.afterDecline = { stored: localStorage.getItem('sirhenrys.consent'),
                               cookie: document.cookie.includes('sirhenrys.consent'),
                               barVisible: vis(document.querySelector('.cc')) };

    /* ---------- UX 8 + 4: scroll progress and back to top ---------- */
    const prog = document.getElementById('progress');
    const at0 = getComputedStyle(prog).transform;
    const L = window.Motion && Motion.lenis && Motion.lenis();
    if (L) L.scrollTo(2200, { immediate: true }); else window.scrollTo(0, 2200);
    await wait(1000);
    const at2200 = getComputedStyle(prog).transform;
    const totop = document.querySelector('.totop');
    o.progress = { at0, at2200, grew: at0 !== at2200 };
    o.toTop = { box: box(totop), visibleAfterScroll: vis(totop),
                w: box(totop) ? box(totop).w : 0 };
    totop && totop.click(); await wait(1400);
    o.toTop.scrollAfterClick = Math.round(L ? L.scroll : window.scrollY);

    /* ---------- UX 11: sticky header ---------- */
    const hdr = document.querySelector('.hdr');
    o.sticky = { position: getComputedStyle(hdr).position, top: getComputedStyle(hdr).top };

    /* ---------- UX 20: floating contact ---------- */
    const wa = document.querySelector('.wa');
    o.floatContact = { box: box(wa), position: getComputedStyle(wa).position, visible: vis(wa) };

    /* ---------- UX 18: last updated ---------- */
    const stamp = document.querySelector('.ftr-stamp');
    o.stamp = { text: stamp ? stamp.textContent.trim() : null,
                datetime: stamp && stamp.querySelector('time') ? stamp.querySelector('time').getAttribute('datetime') : null,
                box: box(stamp) };

    /* ---------- UX 3: search ---------- */
    location.hash = '#/search?q=linen'; await wait(900);
    const cards = document.querySelectorAll('#app a[href^="#/product"], #app .card').length;
    o.search = { results: cards, heading: (document.querySelector('#app h2') || {}).textContent };

    /* ---------- UX 19: FAQ ---------- */
    location.hash = '#/faq'; await wait(900);
    const items = [...document.querySelectorAll('.acc-item')];
    const first = items[0], second = items[1];
    const secondPanel = second && second.querySelector('.acc-a');
    const closedH = secondPanel ? Math.round(secondPanel.getBoundingClientRect().height) : -1;
    second && second.querySelector('.acc-q').click();
    await wait(600);
    const openH = secondPanel ? Math.round(secondPanel.getBoundingClientRect().height) : -1;
    o.faq = { count: items.length, closedH, openH,
              expanded: second ? second.querySelector('.acc-q').getAttribute('aria-expanded') : null,
              controls: second ? !!second.querySelector('.acc-q').getAttribute('aria-controls') : false,
              firstOpenByDefault: first ? first.classList.contains('open') : false };

    /* ---------- UX 16 + security 14: validation and the error state ---------- */
    location.hash = '#/contact'; await wait(900);
    const cf = document.getElementById('ctForm');
    // The bot timer fires before the validator on purpose, so a form submitted
    // 400ms after it rendered is rejected as a bot and never reaches validation.
    // That ordering is correct in production; here it has to be stepped past so
    // the validator itself is what is being measured.
    cf.dataset.armed = String(Date.now() - 5000);
    cf.querySelector('[name=name]').value = 'A';                    // too short
    cf.querySelector('[name=email]').value = 'not-an-email';
    cf.querySelector('[name=msg]').value = 'hello <script>';        // angle brackets
    cf.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await wait(400);
    o.validation = { fieldErrors: document.querySelectorAll('#ctForm .f-err').length,
                     errorTexts: [...document.querySelectorAll('#ctForm .f-err')].map(e => e.textContent),
                     formBad: !!document.querySelector('.form-bad'),
                     formBadBox: box(document.querySelector('.form-bad')),
                     ariaInvalid: cf.querySelectorAll('[aria-invalid="true"]').length };

    /* ---------- UX 15: the success state ---------- */
    cf.querySelector('[name=name]').value = 'Zain Santos';
    cf.querySelector('[name=email]').value = 'zain@example.com';
    cf.querySelector('[name=msg]').value = 'Do you do three-piece in linen?';
    cf.dataset.armed = String(Date.now() - 5000);                   // past the bot timer
    cf.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await wait(400);
    const okBox = document.querySelector('.form-ok');
    o.success = { shown: vis(okBox), box: box(okBox),
                  role: okBox ? okBox.getAttribute('role') : null,
                  text: okBox ? okBox.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : null,
                  errorsGone: document.querySelectorAll('#ctForm .f-err').length };

    /* ---------- security 12: bot protection ---------- */
    const hp = cf.querySelector('[data-hp]');
    o.honeypot = { present: !!hp, name: hp ? hp.name : null,
                   offscreen: hp ? Math.round(hp.getBoundingClientRect().left) : 0,
                   hiddenFromAT: hp ? hp.closest('[aria-hidden="true"]') !== null : false,
                   formsArmed: document.querySelectorAll('form[data-armed]').length };
    if (hp) {
      hp.value = 'http://spam.example';
      cf.dataset.armed = String(Date.now() - 5000);
      const before = document.querySelectorAll('.form-ok').length;
      cf.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await wait(300);
      o.honeypot.blocked = !!document.querySelector('.form-bad');
      hp.value = '';
    }

    /* ---------- UX 9: copy button ---------- */
    // put one on the page the way a real caller does, then press it
    const host = document.querySelector('#app .wrap');
    const probe = document.createElement('code');
    probe.dataset.copy = 'SH-10242'; probe.textContent = 'SH-10242';
    host.appendChild(probe);
    SHUX.wire();
    await wait(120);
    const cb = probe.nextElementSibling;
    o.copy = { mounted: !!cb && cb.classList.contains('copybtn'), box: box(cb) };

    /* ---------- UX 13 + login 5: password field ---------- */
    location.hash = '#/account'; await wait(900);
    document.querySelector('[data-authtab="up"]').click(); await wait(300);
    const pw = document.getElementById('au-pass');
    const eye = pw && pw.parentElement.querySelector('.pw-eye');
    o.pwToggle = { wrapped: !!eye, typeBefore: pw ? pw.type : null, eyeBox: box(eye) };
    eye && eye.click(); await wait(120);
    o.pwToggle.typeAfter = pw ? pw.type : null;
    eye && eye.click(); await wait(80);

    const meter = pw && pw.closest('.pw-wrap').parentElement.querySelector('.pw-meter');
    const scoreFor = async v => { pw.value = v; pw.dispatchEvent(new Event('input')); await wait(60);
      return { score: meter.dataset.score, label: meter.textContent.trim().slice(0, 60) }; };
    o.strength = {
      mounted: !!meter,
      weak: await scoreFor('password'),
      shortish: await scoreFor('Suit1967'),
      strong: await scoreFor('Kimathi-Street-1967!')
    };
    // and the policy actually refuses
    document.getElementById('au-name').value = 'Test Person';
    document.getElementById('au-email').value = 'test' + Date.now() + '@example.com';
    pw.value = 'password';
    const upForm = document.querySelector('[data-authform="up"]');
    upForm.dataset.armed = String(Date.now() - 5000);
    upForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await wait(500);
    const errEl = upForm.querySelector('[data-autherr]');
    o.strength.refused = errEl && !errEl.classList.contains('hide');
    o.strength.refusalText = errEl ? errEl.textContent.trim().slice(0, 80) : null;

    /* ---------- security 5: encryption at rest ---------- */
    const plain = { name: 'Brian Otieno', chest: 102, phone: '0722000111' };
    await SHSec.secureSet('sirhenrys.audit.probe', plain);
    const raw = localStorage.getItem('sirhenrys.audit.probe');
    const back = await SHSec.secureGet('sirhenrys.audit.probe');
    o.encryption = { rawPrefix: raw.slice(0, 3), rawLen: raw.length,
                     leaksName: raw.includes('Otieno'), leaksPhone: raw.includes('0722'),
                     roundTrip: back && back.name === plain.name && back.chest === 102 };
    localStorage.removeItem('sirhenrys.audit.probe');

    /* ---------- security 8: field tampering ---------- */
    SH.state.cart = [{ slug: SH.PRODUCTS[0].slug, size: SH.PRODUCTS[0].sizes[0], qty: 2, price: 1 }];
    const rp = SHSec.reprice(SH.state.cart);
    o.tamper = { claimed: 1, actual: SH.PRODUCTS[0].price, total: rp.total,
                 caught: rp.tampered.length, honest: rp.total === SH.PRODUCTS[0].price * 2 };
    // and a negative quantity cannot survive
    SH.cart.setQty(SH.PRODUCTS[0].slug, SH.PRODUCTS[0].sizes[0], -5);
    o.tamper.negativeQtyLines = SH.state.cart.length;
    SH.state.cart = [];

    /* ---------- security 15: escaping ---------- */
    const nasty = `<img src=x onerror="alert(1)">'&\`/`;
    const escaped = SHSec.esc(nasty);
    o.escaping = { out: escaped,
                   noAngle: !/[<>]/.test(escaped),
                   quote: escaped.includes('&#39;'),
                   slash: escaped.includes('&#x2F;') };

    /* ---------- security 14: the validator ---------- */
    o.validator = {
      badEmail: SHSec.validate('bob@', 'email').ok,
      goodEmail: SHSec.validate('bob@example.com', 'email').ok,
      badPhone: SHSec.validate('12345', 'phone').ok,
      goodPhone: SHSec.validate('0712 345 678', 'phone').ok,
      longText: SHSec.validate('x'.repeat(9000), 'text').ok,
      injection: SHSec.validate('<script>', 'text').ok,
      numberRange: SHSec.validate('900000', 'number', { hi: 5000 }).ok
    };

    /* ---------- security 16: uploads ---------- */
    const png = new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47, 1, 2, 3, 4])], 'a.png', { type: 'image/png' });
    const liar = new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47, 1, 2, 3, 4])], 'a.php', { type: 'image/png' });
    const script = new File([new TextEncoder().encode('<?php system($_GET[0]); ?>')], 'a.jpg', { type: 'image/jpeg' });
    const huge = new File([new Uint8Array(6 * 1024 * 1024)], 'a.png', { type: 'image/png' });
    o.uploads = {
      realPng: await SHSec.checkUpload(png),
      wrongExt: await SHSec.checkUpload(liar),
      phpAsJpg: await SHSec.checkUpload(script),
      oversize: await SHSec.checkUpload(huge)
    };

    /* ---------- security 17: what the assistant sends ---------- */
    const red = SHSec.redact({
      alterations: [{ id: 'ALT-400', customer: 'Brian Otieno', phone: '0722 000 111', status: 'In Workshop' }],
      corporate: [{ company: 'Sidian Bank', email: 'p@sidian.co.ke', headcount: 40 }]
    });
    o.redaction = { json: JSON.stringify(red),
                    leaksName: JSON.stringify(red).includes('Otieno'),
                    leaksPhone: JSON.stringify(red).includes('0722'),
                    leaksEmail: JSON.stringify(red).includes('sidian.co.ke'),
                    pseudonymised: JSON.stringify(red).includes('Customer 01'),
                    rehydrates: SHSec.rehydrate('Customer 01 is due today') };

    /* ---------- extra: the frame buster ---------- */
    o.frameBuster = typeof SHSec.bustFrames === 'function' && SHSec.bustFrames();

    return o;
  });

  /* ---------- console-side checks: the login itself ---------- */
  const A = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const o = {};
    const ad = document.getElementById('ad');
    localStorage.removeItem('sirhenrys.rl');
    sessionStorage.clear();
    location.hash = '#/admin'; await wait(1200);

    const submit = () => ad.querySelector('#pinForm')
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    /* --- login 3: a correct PIN alone must not sign anybody in --- */
    ad.querySelector('[data-staff="ha"]').click(); await wait(200);
    ad.querySelector('#pinInput').value = '1967';
    submit(); await wait(1400);
    o.afterCorrectPin = {
      stillOnLogin: !!ad.querySelector('.login'),
      otpAsked: !!ad.querySelector('#otpField') && !ad.querySelector('#otpField').classList.contains('hide'),
      sessionIssued: !!sessionStorage.getItem('sirhenrys.staff')
    };

    /* --- and a wrong code does not get past it --- */
    ad.querySelector('#otpInput').value = '000000';
    submit(); await wait(900);
    o.wrongOtp = { stillOnLogin: !!ad.querySelector('.login'),
                   session: sessionStorage.getItem('sirhenrys.staff'),
                   msg: (ad.querySelector('#pinErr') || {}).textContent };

    /* --- the real code does --- */
    const secret = SH.STAFF.find(s => s.id === 'ha').totp;
    const code = await SHSec.totp.now(secret);
    ad.querySelector('#otpInput').value = code;
    submit(); await wait(1600);
    const tok = JSON.parse(sessionStorage.getItem('sirhenrys.staff') || 'null');
    o.signedIn = {
      consoleDrawn: !!ad.querySelector('#view') && !ad.querySelector('.login'),
      heading: (ad.querySelector('#view h1') || {}).textContent,
      token: tok,
      tokenKeys: tok ? Object.keys(tok).sort() : [],
      inLocalStorage: !!localStorage.getItem('sirhenrys.staff'),
      inSessionStorage: !!sessionStorage.getItem('sirhenrys.staff'),
      carriesSecret: tok ? /pin|hash|salt|totp/i.test(JSON.stringify(tok)) : true,
      hasExpiry: !!(tok && tok.exp && tok.seen && tok.jti)
    };

    /* --- login 2: the demo-mode banner --- */
    await wait(900);
    const bar = ad.querySelector('#secbar');
    o.banner = { present: !!bar, className: bar ? bar.className : null,
                 text: bar ? bar.textContent.replace(/\s+/g, ' ').trim().slice(0, 70) : null,
                 box: bar ? { w: Math.round(bar.getBoundingClientRect().width),
                              h: Math.round(bar.getBoundingClientRect().height) } : null };

    /* --- security 7: role gate --- */
    location.hash = '#/admin/settings'; await wait(700);
    o.ownerSettings = (ad.querySelector('#view h1') || {}).textContent;

    /* --- the session times out --- */
    const t = JSON.parse(sessionStorage.getItem('sirhenrys.staff'));
    t.seen = Date.now() - (SH_SECURITY.sessionIdleMs + 60000);
    sessionStorage.setItem('sirhenrys.staff', JSON.stringify(t));
    location.hash = '#/admin/orders'; await wait(900);
    o.idleTimeout = { backToLogin: !!ad.querySelector('.login'),
                      msg: (ad.querySelector('.login-hint') || {}).textContent,
                      sessionGone: !sessionStorage.getItem('sirhenrys.staff') };

    /* --- security 11 / login 4: rate limiting --- */
    localStorage.removeItem('sirhenrys.rl');
    location.hash = '#/admin'; await wait(800);
    const attempts = [];
    for (let i = 0; i < 6; i++) {
      if (!ad.querySelector('#pinForm') || ad.querySelector('#pinForm').classList.contains('hide')) {
        ad.querySelector('[data-staff="wm"]').click(); await wait(150);
      }
      const inp = ad.querySelector('#pinInput');
      if (!inp) break;
      inp.value = '0000';
      submit(); await wait(1300);
      attempts.push({
        n: i + 1,
        err: (ad.querySelector('#pinErr') || {}).textContent || '',
        lock: (ad.querySelector('#pinLock') || {}).textContent || ''
      });
    }
    o.rateLimit = { attempts, lockedAt: attempts.findIndex(a => /Locked|Too many/i.test(a.lock)) + 1,
                    stored: JSON.parse(localStorage.getItem('sirhenrys.rl') || '{}') };

    /* --- security 7 again: a shop-floor account cannot open the books --- */
    localStorage.removeItem('sirhenrys.rl');
    const floor = SH.STAFF.find(s => s.id === 'ok');
    SHSec.session.issue({ id: floor.id, name: floor.name, role: floor.role,
                          store: floor.store, title: floor.title });
    location.hash = '#/admin/settings'; await wait(900);
    o.floorSettings = (ad.querySelector('#view h1') || {}).textContent;
    location.hash = '#/admin/pos'; await wait(700);
    o.floorPos = (ad.querySelector('#view h1') || {}).textContent;
    o.floorNavCount = ad.querySelectorAll('.side a[data-nav]:not([style*="display: none"])').length;

    /* --- extra: the audit trail --- */
    o.audit = SHSec.audit.read().slice(0, 12).map(a => a.action);

    return o;
  });

  /* ---------- UX 17: the confirmation dialog ---------- */
  const M = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    sessionStorage.clear();
    location.hash = '#/'; await wait(900);
    SH.cart.add(SH.PRODUCTS[0].slug, SH.PRODUCTS[0].sizes[0], 1);
    location.hash = '#/cart'; await wait(1000);
    const rm = document.querySelector('#app [data-rm]');
    const before = SH.state.cart.length;
    rm && rm.click(); await wait(400);
    const modal = document.querySelector('.ux-modal');
    const card = modal && modal.querySelector('.ux-modal-card');
    const o = { opened: !!modal && modal.classList.contains('on'),
                role: card ? card.getAttribute('role') : null,
                modalAttr: card ? card.getAttribute('aria-modal') : null,
                title: card ? card.querySelector('h3').textContent : null,
                body: card ? card.querySelector('p').textContent.slice(0, 70) : null,
                buttons: card ? [...card.querySelectorAll('button')].map(b => b.textContent) : [],
                cartBefore: before };
    // Escape must cancel without removing anything
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(300);
    o.escCancelled = !document.querySelector('.ux-modal.on');
    o.cartAfterCancel = SH.state.cart.length;
    // and confirming must actually remove it
    document.querySelector('#app [data-rm]').click(); await wait(350);
    document.querySelector('.ux-modal .btn.go').click(); await wait(500);
    o.cartAfterConfirm = SH.state.cart.length;
    return o;
  });

  /* ---------- UX 5 + 6: mobile menu, loading, tap targets ---------- */
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const Mob = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const box = el => { const b = el.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), l: Math.round(b.left) }; };
    const o = {};
    const burger = document.querySelector('[data-menu]');
    const mnav = document.getElementById('mnav');
    o.burger = box(burger);
    o.navBefore = box(mnav);
    burger.click(); await wait(600);
    o.navAfter = box(mnav);
    o.navOnScreen = o.navAfter.l < window.innerWidth && o.navAfter.w > 100;
    document.getElementById('scrim').click(); await wait(500);

    // the loading veil is a real element with a real transition
    const veil = document.getElementById('veil');
    o.veil = { present: !!veil, transition: veil ? getComputedStyle(veil).transition : null };
    // skeletons are shaped and animated
    const probe = document.createElement('div');
    probe.innerHTML = SHUX.skeletonGrid(4);
    document.body.appendChild(probe);
    const sk = probe.querySelector('.sk');
    o.skeleton = { cards: probe.querySelectorAll('.sk-card').length,
                   animation: getComputedStyle(sk).animationName,
                   box: box(sk) };
    probe.remove();

    /* Every control this work added has to clear 40px on a phone. Each one is
       measured on a page where it actually exists - a selector that matches
       nothing measures 0 and would pass a lazier assertion. */
    o.taps = [];
    const measure = (sel, label) => {
      const el = document.querySelector(sel);
      if (!el) { o.taps.push({ sel: label || sel, missing: true }); return; }
      const b = el.getBoundingClientRect();
      o.taps.push({ sel: label || sel, w: Math.round(b.width), h: Math.round(b.height) });
    };

    document.querySelector('.cc').classList.add('on');
    await wait(150);
    measure('.themebtn'); measure('.wa'); measure('.cc .btn'); measure('.burger');

    // back to top only exists once the page is past 600px
    const L2 = window.Motion && Motion.lenis && Motion.lenis();
    if (L2) L2.scrollTo(2000, { immediate: true }); else window.scrollTo(0, 2000);
    await wait(700);
    measure('.totop');
    if (L2) L2.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);

    // the eye lives on the sign-up form
    location.hash = '#/account'; await wait(1100);
    const up = document.querySelector('[data-authtab="up"]');
    if (up) { up.click(); await wait(400); }
    // the FIRST .pw-eye in the document belongs to the sign-in form, which the tab
    // click above has just hidden - measure the one on the form actually on screen
    measure('[data-authform="up"] .pw-eye', '.pw-eye');

    // the FAQ page for the accordion, and a copy button mounted the way a caller does
    location.hash = '#/faq'; await wait(1100);
    measure('.acc-q');
    const probe2 = document.createElement('code');
    probe2.dataset.copy = 'SH-10242'; probe2.textContent = 'SH-10242';
    document.querySelector('#app .wrap').appendChild(probe2);
    SHUX.wire(); await wait(200);
    measure('.copybtn');
    return o;
  });

  await b.close();

  /* =====================================================================
     score the live results
  ===================================================================== */
  // --- security ---
  check('security', 5, 'Encrypt sensitive data',
    R.encryption.rawPrefix === 'v1:' && !R.encryption.leaksName && !R.encryption.leaksPhone && R.encryption.roundTrip,
    `AES-GCM 256: ${R.encryption.rawLen} bytes of ciphertext, name and phone absent from the stored blob, round trip exact`);

  check('security', 8, 'Block field tampering',
    R.tamper.caught === 1 && R.tamper.honest && R.tamper.negativeQtyLines === 0,
    `a cart line claiming KSh ${R.tamper.claimed} for a KSh ${R.tamper.actual} suit was caught and repriced to ${R.tamper.total}; a quantity of -5 removes the line`);

  check('security', 11, 'Rate limit login',
    A.rateLimit.lockedAt > 0 && A.rateLimit.lockedAt <= 5,
    `locked out on attempt ${A.rateLimit.lockedAt}: "${(A.rateLimit.attempts.find(a => a.lock) || {}).lock}"`);

  check('security', 12, 'Add bot protection',
    R.honeypot.present && R.honeypot.offscreen < -1000 && R.honeypot.hiddenFromAT && R.honeypot.blocked,
    `honeypot "${R.honeypot.name}" at x=${R.honeypot.offscreen}px, aria-hidden, on ${R.honeypot.formsArmed} armed forms; filling it blocked the submit`);

  check('security', 14, 'Validate all input',
    !R.validator.badEmail && R.validator.goodEmail && !R.validator.badPhone &&
    R.validator.goodPhone && !R.validator.longText && !R.validator.injection && !R.validator.numberRange &&
    R.validation.fieldErrors >= 3,
    `bad email, short phone, 9000 chars, <script> and an out-of-range number all refused; ${R.validation.fieldErrors} fields marked, ${R.validation.ariaInvalid} aria-invalid`);

  check('security', 16, 'Restrict file uploads',
    R.uploads.realPng.ok && !R.uploads.wrongExt.ok && !R.uploads.phpAsJpg.ok && !R.uploads.oversize.ok &&
    /^[0-9a-f]{16}\.png$/.test(R.uploads.realPng.safeName || ''),
    `a real PNG passes and is renamed to ${R.uploads.realPng.safeName}; PNG-called-.php, PHP-called-.jpg and 6MB all refused by magic bytes`);

  // --- login ---
  check('login', 1, 'Session token handled properly',
    A.signedIn.inSessionStorage && !A.signedIn.inLocalStorage &&
    !A.signedIn.carriesSecret && A.signedIn.hasExpiry,
    `sessionStorage only, keys [${A.signedIn.tokenKeys.join(' ')}], no PIN/hash/salt/secret inside, exp+seen+jti present`);

  check('login', 3, 'Two-factor on the staff console',
    A.afterCorrectPin.stillOnLogin && A.afterCorrectPin.otpAsked && !A.afterCorrectPin.sessionIssued &&
    A.wrongOtp.stillOnLogin && !A.wrongOtp.session && A.signedIn.consoleDrawn,
    `the right PIN alone issued nothing and asked for a code; a wrong code was refused; the live TOTP signed in and drew "${A.signedIn.heading}"`);

  check('login', 4, 'Rate limiting on the login endpoint',
    A.rateLimit.lockedAt > 0, `lockout after ${A.rateLimit.lockedAt} wrong PINs, doubling on repeat`);

  check('login', 5, 'Password strength check',
    R.strength.mounted && R.strength.weak.score === '1' && +R.strength.strong.score >= 3 && R.strength.refused,
    `"password" scores ${R.strength.weak.score}/4, "Kimathi-Street-1967!" scores ${R.strength.strong.score}/4, and sign-up refused: "${R.strength.refusalText}"`);

  // extra security
  check('extra', 2, 'Session expiry and idle timeout',
    A.idleTimeout.backToLogin && A.idleTimeout.sessionGone,
    `a session idle past ${'15 min'} was dropped on the next render: "${(A.idleTimeout.msg || '').trim()}"`);

  check('extra', 3, 'Audit trail',
    A.audit.includes('sign-in') && A.audit.some(a => /fail/.test(a)),
    'recorded: ' + [...new Set(A.audit)].join(', '));

  check('extra', 1, 'Clickjacking', R.frameBuster === true,
    "frame-ancestors 'none' + X-Frame-Options: DENY + a frame-buster that fails closed");

  check('extra', 8, 'PII never reaches the model',
    !R.redaction.leaksName && !R.redaction.leaksPhone && !R.redaction.leaksEmail &&
    R.redaction.pseudonymised && R.redaction.rehydrates.includes('Brian Otieno'),
    `payload became ${R.redaction.json.slice(0, 88)}… and "Customer 01" reads back as "${R.redaction.rehydrates}"`);

  const badTaps = Mob.taps.filter(t => t.missing || Math.min(t.w, t.h) < 40);
  check('extra', 9, 'Tap targets on the new controls',
    badTaps.length === 0,
    Mob.taps.map(t => `${t.sel} ${t.w}x${t.h}`).join(', '));

  const allContrast = [...R.contrastLight.map(c => ({ ...c, theme: 'light' })),
                       ...R.contrastDark.map(c => ({ ...c, theme: 'dark' }))];
  // 4.5:1 for body text; 3:1 is allowed for large text (18.66px bold or 24px)
  const floorFor = c => (c.size >= 24 || (c.size >= 18.66 && +c.weight >= 700)) ? 3 : 4.5;
  const lowContrast = allContrast.filter(c => c.missing || c.ratio < floorFor(c));
  check('extra', 11, 'Readable in both themes',
    lowContrast.length === 0,
    lowContrast.length
      ? 'BELOW THE FLOOR: ' + lowContrast.map(c => `${c.theme} ${c.sel} ${c.ratio}:1`).join(', ')
      : 'worst of ' + allContrast.length + ' measurements: ' +
        allContrast.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 3)
          .map(c => `${c.theme} ${c.sel} ${c.ratio}:1`).join(', '));

  // page errors caused only by the local server dropping a connection are not the
  // site's errors either
  const realErrs = errs.filter(e => !/ERR_CONNECTION_REFUSED/.test(e));
  check('extra', 10, 'Clean console under the CSP',
    realErrs.length === 0 && cspViolations.length === 0 && failedReqs.length === 0,
    realErrs.length + ' page errors, ' + cspViolations.length + ' CSP violations, ' +
    failedReqs.length + ' blocked requests' +
    (flaky.length ? '; ' + flaky.length + ' dropped by the local dev server, not counted' : '') +
    (realErrs.length ? ' :: ' + realErrs.slice(0, 3).join(' | ') : '') +
    (failedReqs.length ? ' :: ' + failedReqs.slice(0, 3).join(' | ') : ''));

  const i15 = results.find(r => r.group === 'security' && r.id === 15);
  i15.pass = i15.pass && R.escaping.noAngle && R.escaping.quote && R.escaping.slash;
  i15.detail += `; measured: esc("<img src=x onerror=…>") -> ${R.escaping.out.slice(0, 40)}…`;

  // --- ux ---
  check('ux', 1, 'Dark mode toggle',
    R.theme.changed && R.theme.attr === 'dark' && R.theme.persisted === 'dark' && R.themeBtnBox.w >= 40,
    `body ${R.theme.lightBg} -> ${R.theme.darkBg}, --ink ${R.theme.lightInk} -> ${R.theme.darkInk}, choice persisted, button ${R.themeBtnBox.w}x${R.themeBtnBox.h}`);

  check('ux', 2, 'Cookie banner',
    R.consent.visible && R.consent.hasPolicyLink && R.consent.buttons.length === 2 &&
    R.consent.buttons[0].box.h === R.consent.buttons[1].box.h &&
    R.consent.afterDecline.stored === 'no' && !R.consent.afterDecline.barVisible,
    `${R.consent.box.w}x${R.consent.box.h}px, "${R.consent.buttons.map(b => b.label).join('" / "')}" both ${R.consent.buttons[0].box.h}px tall, links to the privacy page, choice stored`);

  check('ux', 3, 'Site search', R.search.results >= 1,
    `"linen" returned ${R.search.results} products`);

  check('ux', 4, 'Back to top',
    R.toTop.visibleAfterScroll && R.toTop.scrollAfterClick < 40 && R.toTop.w >= 40,
    `hidden until 600px, ${R.toTop.box.w}x${R.toTop.box.h} at the bottom right, click took the page from 2200 to ${R.toTop.scrollAfterClick}`);

  // The drawer parks off the LEFT edge on this site, so "off screen before" means
  // its right edge is at or past x=0, not that its left edge is past the viewport.
  const drawerWasOff = Mob.navBefore.l + Mob.navBefore.w <= 0 || Mob.navBefore.l >= 390;
  check('ux', 5, 'Mobile menu',
    Mob.navOnScreen && drawerWasOff && Math.min(Mob.burger.w, Mob.burger.h) >= 40,
    `burger ${Mob.burger.w}x${Mob.burger.h} and visible at 390px - it measured 0x0 before this work, ` +
    `because it sat inside .nav and .nav is display:none below 860px; drawer slid from x=${Mob.navBefore.l} to x=${Mob.navAfter.l}`);

  check('ux', 6, 'Loading animations',
    Mob.veil.present && Mob.skeleton.cards === 4 && Mob.skeleton.animation === 'skshimmer',
    `route veil with a transition, plus ${Mob.skeleton.cards} skeleton cards animating "${Mob.skeleton.animation}"`);

  check('ux', 8, 'Scroll progress bar', R.progress.grew,
    `transform ${R.progress.at0} at the top, ${R.progress.at2200} at 2200px`);

  check('ux', 9, 'Copy button', R.copy.mounted && R.copy.box.h > 0,
    `data-copy mounted a ${R.copy.box.w}x${R.copy.box.h} button with a clipboard fallback for insecure contexts`);

  check('ux', 11, 'Sticky header', R.sticky.position === 'sticky' && R.sticky.top === '0px',
    `position:${R.sticky.position}; top:${R.sticky.top}`);

  check('ux', 12, 'Skip to content',
    R.skipBefore.t < 0 && R.skipFocused.t >= 0 && R.skipHref === '#app',
    `off screen at y=${R.skipBefore.t}, slides to y=${R.skipFocused.t} on focus, moves focus to #app`);

  check('ux', 13, 'Password visibility toggle',
    R.pwToggle.wrapped && R.pwToggle.typeBefore === 'password' && R.pwToggle.typeAfter === 'text' &&
    R.pwToggle.eyeBox.h >= 40,
    `type ${R.pwToggle.typeBefore} -> ${R.pwToggle.typeAfter}, ${R.pwToggle.eyeBox.w}x${R.pwToggle.eyeBox.h} target`);

  check('ux', 14, 'UTM tracking',
    R.utm.stored && R.utm.stored.first && R.utm.stored.first.utm_source === 'instagram' &&
    R.utm.urlAfter === '' && R.utm.summary.includes('instagram'),
    `first touch captured (${R.utm.summary}), parameters stripped from the address bar`);

  check('ux', 15, 'Form success state',
    R.success.shown && R.success.role === 'status' && R.success.errorsGone === 0,
    `"${R.success.text}" — ${R.success.box.w}x${R.success.box.h}px, role=status`);

  check('ux', 16, 'Form error state',
    R.validation.formBad && R.validation.fieldErrors >= 3 && R.validation.ariaInvalid >= 3,
    `${R.validation.fieldErrors} inline messages + a summary block; e.g. "${R.validation.errorTexts[0]}"`);

  check('ux', 17, 'Confirmation modals',
    M.opened && M.role === 'dialog' && M.modalAttr === 'true' &&
    M.escCancelled && M.cartAfterCancel === M.cartBefore && M.cartAfterConfirm === 0,
    `"${M.title}" / "${M.body}…"; Escape cancelled and left ${M.cartAfterCancel} line, confirming left ${M.cartAfterConfirm}`);

  check('ux', 18, 'Last updated date',
    !!R.stamp.text && /^\d{4}-\d{2}-\d{2}$/.test(R.stamp.datetime || ''),
    `"${R.stamp.text}" with a machine-readable datetime="${R.stamp.datetime}"`);

  check('ux', 19, 'Expandable FAQ',
    R.faq.count >= 6 && R.faq.openH > R.faq.closedH + 20 && R.faq.expanded === 'true' && R.faq.controls,
    `${R.faq.count} questions; opening one grew the panel ${R.faq.closedH}px -> ${R.faq.openH}px, aria-expanded and aria-controls both set`);

  check('ux', 20, 'Floating contact',
    R.floatContact.visible && R.floatContact.position === 'fixed' && Math.min(R.floatContact.box.w, R.floatContact.box.h) >= 40,
    `WhatsApp button, position:fixed, ${R.floatContact.box.w}x${R.floatContact.box.h}`);

  /* also fold the role gate into security 7 */
  const roleOk = A.floorSettings === 'Not available' && A.floorPos === 'Till' && A.ownerSettings !== 'Not available';
  const i7 = results.find(r => r.group === 'security' && r.id === 7);
  i7.pass = i7.pass && roleOk;
  i7.detail += `; shop floor asking for settings got "${A.floorSettings}" and sees ${A.floorNavCount} of 13 sections, owner got "${A.ownerSettings}"`;

  const i6 = results.find(r => r.group === 'security' && r.id === 6);
  const bannerOk = A.banner.present && /Demo mode/.test(A.banner.text || '') && A.banner.box.h > 20;
  i6.pass = i6.pass && bannerOk;
  i6.detail += `; the console shows it: "${A.banner.text}…" (${A.banner.box.w}x${A.banner.box.h})`;
  const l2 = results.find(r => r.group === 'login' && r.id === 2);
  l2.pass = l2.pass && bannerOk;
  l2.detail += `; rendered ${A.banner.box.w}x${A.banner.box.h} above every page of the till`;

  /* =====================================================================
     report
  ===================================================================== */
  const TITLES = {
    security: 'Video 1 - 20 things to have Claude do before launching your app',
    ux: 'Video 2 - 20 things you can tell Claude to add to your website',
    login: 'Video 3 - 5 ways your vibecoded login endpoint is not secure',
    extra: 'Beyond the three lists'
  };
  const EXPECT = { security: 20, ux: 20, login: 5 };

  let fails = 0;
  for (const g of ['security', 'ux', 'login', 'extra']) {
    const rows = results.filter(r => r.group === g).sort((a, b) => a.id - b.id);
    const passed = rows.filter(r => r.pass).length;
    console.log('\n' + TITLES[g]);
    console.log('-'.repeat(78));
    for (const r of rows) {
      if (!r.pass) fails++;
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${String(r.id).padStart(2)}. ${r.title}`);
      if (r.detail) console.log(`        ${r.detail}`);
    }
    const expect = EXPECT[g];
    if (expect && rows.length !== expect) {
      console.log(`\n  !! ${rows.length} of ${expect} items are covered by a check`);
      fails += expect - rows.length;
    }
    console.log(`\n  ${passed}/${rows.length} passing`);
  }

  const total = results.length;
  console.log('\n' + '='.repeat(78));
  console.log(`${total - fails}/${total} checks passing` + (fails ? `  -  ${fails} FAILING` : '  -  everything on the three lists, plus the extras'));
  console.log('='.repeat(78));
  process.exit(fails);
})().catch(e => {
  /* Chrome occasionally dies mid-run under SwiftShader - the lookbook is a live
     WebGL scene and this harness walks it a dozen times. That is the browser
     falling over, not a finding, so the run is retried once rather than reported
     as a failure. A second crash is real and exits 99. */
  const msg = String((e && e.message) || e);
  if (/TargetClose|Protocol error|Session closed|Target closed/i.test(msg) && !process.env.SH_AUDIT_RETRY) {
    console.error('\nthe browser crashed mid-run; retrying once\n');
    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath, [__filename], {
      stdio: 'inherit', env: { ...process.env, SH_AUDIT_RETRY: '1' }
    });
    process.exit(r.status == null ? 99 : r.status);
  }
  console.error('harness error:', e);
  process.exit(99);
});
