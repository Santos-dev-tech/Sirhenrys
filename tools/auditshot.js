/* Screenshots of everything this pass added, into _shots/audit-*.png.

     node tools/auditshot.js

   The numbers in tools/audittest.js prove each thing exists and behaves. These
   are for the other half of the job: looking at it. A consent bar can be 96px
   tall, present, and still ugly enough that nobody would ship it.
*/
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const signInAs = require('./signin');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_shots');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:8100';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'] });
  const p = await b.newPage();
  const shots = [];
  const shot = async name => {
    const f = path.join(OUT, 'audit-' + name + '.png');
    await p.screenshot({ path: f });
    shots.push(name);
    console.log('  ' + name);
  };
  const go = async (hash, ms) => { await p.evaluate(h => { location.hash = h; }, hash); await sleep(ms || 1400); };

  /* ---------- desktop ---------- */
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await sleep(4500);

  await p.evaluate(() => { SHUX.theme.set('light'); localStorage.removeItem('sirhenrys.consent');
                           document.querySelector('.cc').classList.add('on'); });
  await sleep(900);
  await shot('01-home-light-consent');

  await p.evaluate(() => { SHUX.theme.set('dark'); });
  await sleep(1200);
  await shot('02-home-dark');

  await go('#/faq');
  await p.evaluate(() => { const i = document.querySelectorAll('.acc-item')[2];
                           if (i) i.querySelector('.acc-q').click(); });
  await sleep(700);
  await shot('03-faq-dark');

  await p.evaluate(() => { SHUX.theme.set('light'); });
  await go('#/account');
  await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    document.querySelector('[data-authtab="up"]').click(); await wait(300);
    const pw = document.getElementById('au-pass');
    document.getElementById('au-name').value = 'Zain Santos';
    document.getElementById('au-email').value = 'zain@example.com';
    pw.value = 'suit1967'; pw.dispatchEvent(new Event('input'));
    const eye = pw.parentElement.querySelector('.pw-eye'); if (eye) eye.click();
  });
  await sleep(700);
  await shot('04-signup-strength');

  await go('#/contact');
  await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const f = document.getElementById('ctForm');
    f.dataset.armed = String(Date.now() - 5000);
    f.querySelector('[name=name]').value = 'A';
    f.querySelector('[name=email]').value = 'not-an-email';
    f.querySelector('[name=msg]').value = 'hi';
    f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await wait(400);
  });
  await sleep(600);
  await shot('05-form-errors');

  await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const f = document.getElementById('ctForm');
    f.dataset.armed = String(Date.now() - 5000);
    f.querySelector('[name=name]').value = 'Zain Santos';
    f.querySelector('[name=email]').value = 'zain@example.com';
    f.querySelector('[name=msg]').value = 'Do you do three-piece in linen?';
    f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await wait(400);
  });
  await sleep(600);
  await shot('06-form-success');

  // the confirm dialog
  await p.evaluate(() => { SH.cart.add(SH.PRODUCTS[0].slug, SH.PRODUCTS[0].sizes[0], 1); });
  await go('#/cart');
  await p.evaluate(() => { const r = document.querySelector('#app [data-rm]'); if (r) r.click(); });
  await sleep(700);
  await shot('07-confirm-dialog');
  await p.evaluate(() => { const c = document.querySelector('.ux-modal [data-x]'); if (c) c.click(); });

  /* ---------- the staff gate ---------- */
  await p.evaluate(() => { sessionStorage.clear(); localStorage.removeItem('sirhenrys.rl'); });
  await go('#/admin', 1600);
  await shot('08-console-who');

  await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const ad = document.getElementById('ad');
    ad.querySelector('[data-staff="ha"]').click(); await wait(300);
    ad.querySelector('#pinInput').value = '1967';
    ad.querySelector('#pinForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });
  await sleep(2000);
  await shot('09-console-otp');

  // wrong PIN five times, to photograph the lockout
  await p.evaluate(() => { location.reload(); });
  await sleep(4500);
  await go('#/admin', 1600);
  await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const ad = document.getElementById('ad');
    ad.querySelector('[data-staff="wm"]').click(); await wait(250);
    for (let i = 0; i < 5; i++) {
      ad.querySelector('#pinInput').value = '0000';
      ad.querySelector('#pinForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await wait(1200);
    }
  });
  await sleep(800);
  await shot('10-console-lockout');

  // signed in, with the demo-mode banner
  await p.evaluate(() => { localStorage.removeItem('sirhenrys.rl'); location.reload(); });
  await sleep(4500);
  await go('#/admin', 1600);
  await signInAs(p, 'ha');
  await sleep(1400);
  await shot('11-console-banner');

  /* ---------- phone ---------- */
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await sleep(4500);
  await p.evaluate(() => { SHUX.theme.set('light'); localStorage.removeItem('sirhenrys.consent');
                           document.querySelector('.cc').classList.add('on'); });
  await sleep(800);
  await shot('12-phone-consent');

  await p.evaluate(() => { const b = document.querySelector('[data-menu]'); if (b) b.click(); });
  await sleep(900);
  await shot('13-phone-menu');

  await p.evaluate(() => { document.getElementById('scrim').click(); SHUX.theme.set('dark'); });
  await sleep(900);
  await go('#/faq', 1600);
  await shot('14-phone-faq-dark');

  await b.close();
  console.log('\n' + shots.length + ' shots in _shots/');
})().catch(e => { console.error(e); process.exit(1); });
