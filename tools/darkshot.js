/* Dark-mode screenshots, both halves, for the contact sheet.

     node tools/darkshot.js

   tools/darktest.js proves the numbers. This is the other half of the job: a page
   can clear 4.5:1 everywhere and still look like a spreadsheet at midnight.
*/
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const signInAs = require('./signin');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:8100';
const OUT = path.join(__dirname, '..', '_shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const p = await b.newPage();
  const shot = async n => { await p.screenshot({ path: path.join(OUT, 'dk-' + n + '.png') }); console.log('  ' + n); };

  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.SHUX);
  await sleep(4200);
  await p.evaluate(() => { SHUX.theme.set('dark'); localStorage.setItem('sirhenrys.consent', 'no'); });
  await sleep(900);

  const go = async (hash, ms) => { await p.evaluate(h => { location.hash = h; }, hash); await sleep(ms || 1800); };
  const scrollTo = async y => {
    await p.evaluate(v => { const L = window.Motion && Motion.lenis && Motion.lenis();
      if (L) L.scrollTo(v, { immediate: true }); else window.scrollTo(0, v); }, y);
    await sleep(900);
  };

  await go('/', 2400);            await shot('01-home-hero');
  await scrollTo(1500);           await shot('02-home-scrolled');
  await go('/shop', 2200);        await shot('03-shop-grid');
  await scrollTo(900);            await shot('04-shop-scrolled');
  await go('/lookbook', 3200);    await shot('05-lookbook-room');
  await go('/bespoke', 2200);     await shot('06-bespoke');
  await go('/faq', 1800);         await shot('07-faq');
  await go('/contact', 1800);     await shot('08-contact');
  await go('/shop', 2000); await scrollTo(99999); await sleep(900);
                                  await shot('09-footer');
  await go('/checkout', 2200);    await shot('10-checkout');

  // the console
  await p.evaluate(() => sessionStorage.clear());
  await go('/admin', 2200);       await shot('11-console-login');
  await signInAs(p, 'ha');
  await sleep(1600);              await shot('12-console-dashboard');
  await go('/admin/pos', 2000);   await shot('13-console-till');
  await go('/admin/orders', 2000); await shot('14-console-orders');
  await go('/admin/inventory', 2000); await shot('15-console-inventory');
  await go('/admin/analytics', 2200); await shot('16-console-analytics');

  // phone
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.SHUX);
  await sleep(4200);
  await p.evaluate(() => { SHUX.theme.set('dark'); localStorage.setItem('sirhenrys.consent', 'no'); });
  await sleep(700);
  await go('/', 2400);            await shot('17-phone-home');
  await p.evaluate(() => document.querySelector('[data-menu]').click());
  await sleep(900);               await shot('18-phone-menu');
  await p.evaluate(() => document.getElementById('scrim').click());
  await go('/shop', 2200);        await shot('19-phone-shop');

  await b.close();
  console.log('\ndone');
})().catch(e => { console.error(e); process.exit(1); });
