/* Continue with Google, checked as far as a headless browser honestly can.

     node tools/googletest.js

   What this CAN prove: the button is there and reachable, it is wired, it calls
   Firebase's provider flow with the right provider and the account chooser asked
   for, the CSP allows the hosts that flow needs, COOP does not sever the popup's
   way home, and a failure surfaces a message AND the server's own words rather
   than doing nothing.

   What it CANNOT prove: that a real Google account signs in. That needs a human
   and a password, so the last step is a manual one - and the manual step is listed
   at the end of the run rather than left implied.
*/
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:8123';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

(async () => {
  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

  /* ---------------- the policy, before the browser ---------------- */
  const headers = read('_headers');
  const csp = (headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m) || [])[1] || '';
  const meta = (read('index.html').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  const fb = JSON.parse(read('firebase.json'));
  const fbMap = Object.fromEntries(
    ((fb.hosting.headers.find(h => h.source === '**') || {}).headers || []).map(h => [h.key, h.value]));

  const scriptSrc = (csp.match(/script-src ([^;]+)/) || [])[1] || '';
  const frameSrc = (csp.match(/frame-src ([^;]+)/) || [])[1] || '';

  check('CSP allows apis.google.com in script-src',
    scriptSrc.includes('https://apis.google.com'),
    'Firebase Auth loads gapi from there for the popup flow');

  check('CSP allows the account chooser in frame-src',
    frameSrc.includes('https://accounts.google.com') &&
    frameSrc.includes('https://sir-henrys.firebaseapp.com'),
    'accounts.google.com + the project authDomain, which serves /__/auth/iframe');

  check('COOP does not sever the popup',
    /Cross-Origin-Opener-Policy:\s*same-origin-allow-popups/.test(headers) &&
    fbMap['Cross-Origin-Opener-Policy'] === 'same-origin-allow-popups',
    'plain same-origin cuts window.opener, which is how signInWithPopup returns');

  const norm = s => s.replace(/frame-ancestors [^;]+;\s*/, '').replace(/\s+/g, ' ').trim();
  check('the three CSP copies still agree',
    norm(meta) === norm(csp) && norm(fbMap['Content-Security-Policy'] || '') === norm(csp),
    '_headers, firebase.json and the meta tag');

  /* ---------------- the page ---------------- */
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 200000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const p = await b.newPage();
  p.setDefaultNavigationTimeout(120000);
  const cspBlocks = [];
  p.on('console', m => { if (/Content Security Policy/i.test(m.text())) cspBlocks.push(m.text().slice(0, 120)); });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.SHAuth && !!window.SH);
  await sleep(4000);

  const out = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const res = {};
    location.hash = '#/account';
    await wait(1800);

    const btn = document.querySelector('[data-google]');
    if (!btn) return { missing: true };
    const r = btn.getBoundingClientRect();
    const cs = getComputedStyle(btn);
    res.button = {
      text: btn.textContent.replace(/\s+/g, ' ').trim(),
      w: Math.round(r.width), h: Math.round(r.height),
      bg: cs.backgroundColor, colour: cs.color,
      hasMark: btn.querySelectorAll('svg path').length,
      aboveEmail: r.top < document.querySelector('[data-authform="in"]').getBoundingClientRect().top
    };
    res.api = {
      hasMethod: typeof SHAuth.signInWithGoogle === 'function',
      hasProvider: typeof firebase !== 'undefined' && !!(firebase.auth && firebase.auth.GoogleAuthProvider),
      backend: SHAuth.hasBackend()
    };

    // Intercept the SDK call so the provider it builds can be inspected without a
    // real Google account: what scopes, and does it force the account chooser.
    const real = firebase.auth().signInWithPopup.bind(firebase.auth());
    let seen = null;
    firebase.auth().signInWithPopup = (prov) => {
      seen = {
        id: prov.providerId,
        scopes: (prov.scopes || []).slice(),
        params: prov.getCustomParameters ? prov.getCustomParameters() : (prov.customParameters || {})
      };
      const e = new Error('intercepted'); e.code = 'auth/popup-blocked-test';
      return Promise.reject(e);
    };
    const realRedirect = firebase.auth().signInWithRedirect.bind(firebase.auth());
    firebase.auth().signInWithRedirect = () => Promise.reject(
      Object.assign(new Error('no redirect in a test'), { code: 'auth/internal-error' }));

    // call the API directly first, so the return value is visible rather than inferred
    res.direct = await SHAuth.signInWithGoogle();
    res.provider = seen;

    document.querySelector('[data-google]').click();
    await wait(1600);

    const err = document.querySelector('[data-oautherr]');
    const raw = document.querySelector('[data-oauthraw]');
    res.failure = {
      messageShown: err && !err.classList.contains('hide') && err.textContent.trim().length > 0,
      message: err ? err.textContent.trim().slice(0, 80) : null,
      rawShown: raw && !raw.classList.contains('hide'),
      raw: raw ? raw.querySelector('pre').textContent.slice(0, 80) : null,
      buttonUsableAgain: !document.querySelector('[data-google]').disabled
    };

    firebase.auth().signInWithPopup = real;
    firebase.auth().signInWithRedirect = realRedirect;
    return res;
  });

  await b.close();

  if (out.missing) {
    console.log('FAIL - there is no [data-google] button on #/account');
    process.exit(1);
  }

  check('the button is on the account page, above the email form',
    out.button.w > 200 && out.button.h >= 44 && out.button.aboveEmail,
    `${out.button.w}x${out.button.h}, "${out.button.text}"`);

  check('it looks like a Google button rather than a house button',
    out.button.bg === 'rgb(255, 255, 255)' && out.button.hasMark === 4,
    `white ground, ${out.button.hasMark}-colour mark, text "${out.button.text}"`);

  check('SHAuth exposes the provider flow',
    out.api.hasMethod && out.api.hasProvider,
    `signInWithGoogle present, GoogleAuthProvider in the SDK, backend ${out.api.backend}`);

  check('it asks Google for the right thing',
    out.provider && out.provider.id === 'google.com' &&
    out.provider.scopes.includes('email') && out.provider.scopes.includes('profile') &&
    (out.provider.params || {}).prompt === 'select_account',
    out.provider
      ? `${out.provider.id}, scopes [${out.provider.scopes.join(' ')}], prompt=${(out.provider.params || {}).prompt}`
      : 'the SDK was never called');

  console.log('  direct call returned:', JSON.stringify(out.direct));

  check('a failure says something AND shows the raw error',
    out.failure.messageShown && out.failure.rawShown && out.failure.buttonUsableAgain,
    `"${out.failure.message}" with the server's words under a toggle: "${out.failure.raw}"`);

  check('nothing on the page is blocked by the CSP',
    cspBlocks.length === 0,
    cspBlocks.length ? cspBlocks.slice(0, 2).join(' | ') : 'no violations logged');

  let fails = 0;
  console.log('\nContinue with Google');
  console.log('-'.repeat(76));
  for (const c of checks) {
    if (!c.pass) fails++;
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}`);
    console.log(`      ${c.detail}`);
  }
  console.log('-'.repeat(76));
  console.log(`${checks.length - fails}/${checks.length} passing`);
  console.log('\nStill to do by hand, because it needs a real account:');
  console.log('  1. open ' + BASE + '/#/account and press Continue with Google');
  console.log('  2. the chooser should appear, and signing in should land on the account page');
  console.log('  3. if it says the domain is not authorised: Firebase console ->');
  console.log('     Authentication -> Settings -> Authorised domains -> add the host');
  process.exit(fails);
})().catch(e => { console.error('harness error:', e); process.exit(99); });
