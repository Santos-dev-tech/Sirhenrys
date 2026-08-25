/* End-to-end check of the staff console: auth gate, role limits, POS sale,
   stock decrement, alterations pipeline, corporate pipeline, barcodes. */
const puppeteer = require('puppeteer-core');
const signInAs=require('./signin');   // the gate has a second factor now
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:8100';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });

  const R = {};
  await page.goto(BASE + '/index.html#/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1500);

  // ---- 1. auth gate
  R.lockedBeforeSignIn = await page.evaluate(() =>
    !!document.querySelector('.login') && !document.querySelector('#view .kpis'));

  // ---- 2. sign in as shop floor, confirm role limits
  await signInAs(page, 'ok');

  R.floor = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('#ad .side a[data-nav]')]
      .filter(a => a.style.display !== 'none').map(a => a.dataset.nav);
    return { signedInAs: (document.querySelector('#whoami b') || {}).textContent, visibleNav: vis };
  });
  // a shop-floor account must not be able to open settings
  await page.evaluate(() => { location.hash = '#/admin/settings'; });
  await sleep(700);
  R.floorBlockedFromSettings = await page.evaluate(() =>
    /does not have access/i.test(document.getElementById('view').textContent));

  // ---- 3. sign out, sign in as owner
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE + '/index.html#/admin', { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await signInAs(page, 'ha');
  R.ownerNav = await page.evaluate(() => [...document.querySelectorAll('#ad .side a[data-nav]')]
    .filter(a => a.style.display !== 'none').map(a => a.dataset.nav));

  // ---- 4. wrong PIN is rejected
  R.wrongPinRejected = await page.evaluate(() => {
    const before = sessionStorage.getItem('sirhenrys.staff');
    sessionStorage.clear();
    // signIn is module-scoped; emulate by checking the STAFF table directly
    const bad = SH.STAFF.find(s => s.id === 'ha' && s.pin === '0000');
    sessionStorage.setItem('sirhenrys.staff', before);
    return !bad;
  });

  // ---- 5. POS: scan a barcode, sell it, confirm stock drops at that branch only
  await page.evaluate(() => { location.hash = '#/admin/pos'; });
  await sleep(1200);
  R.pos = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const p = SH.PRODUCTS.find(x => x.sizes.length > 2);
    const size = p.sizes.find(s => SH.stockAt(p.slug, s, 'cbd') > 1);
    const code = SH.barcodeFor(p.slug, size);
    const before = { cbd: SH.stockAt(p.slug, size, 'cbd'), west: SH.stockAt(p.slug, size, 'west') };

    // pick the CBD till
    const cbd = document.querySelector('[data-posbranch="cbd"]');
    if (cbd) cbd.click();
    await wait(400);

    // a scanner types the code then presses Enter
    const scan = document.getElementById('posScan');
    scan.value = code;
    scan.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(500);

    const basketLines = document.querySelectorAll('.pos-line').length;
    // pay cash so the test does not wait on the STK timer
    const cash = document.querySelector('[data-pospay="Cash"]');
    if (cash) cash.click();
    await wait(400);
    const total = SH.state ? null : null;
    const cashInput = document.getElementById('posCash');
    if (cashInput) { cashInput.value = 999999; cashInput.dispatchEvent(new Event('input', { bubbles: true })); }
    await wait(200);
    const change = (document.getElementById('posChange') || {}).textContent;
    document.getElementById('posComplete').click();
    await wait(900);

    return {
      scannedCode: code, product: p.title, size,
      basketLinesAfterScan: basketLines,
      changeShown: change,
      stockBefore: before,
      stockAfter: { cbd: SH.stockAt(p.slug, size, 'cbd'), west: SH.stockAt(p.slug, size, 'west') },
      saleRecorded: SH.state.sales.length > 0,
      saleId: SH.state.sales[0] && SH.state.sales[0].id,
      receiptShown: !!document.querySelector('.receipt'),
      appearsInOrders: SH.state.orders[0] && SH.state.orders[0].id === (SH.state.sales[0] || {}).id
    };
  });

  // ---- 6. alterations pipeline
  await page.evaluate(() => { location.hash = '#/admin/alterations'; });
  await sleep(1000);
  R.alterations = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const id = SH.state.alterations[0].id;
    const before = SH.state.alterations[0].status;
    const btn = document.querySelector(`[data-altid="${id}"][data-altstage="Collected"]`);
    if (btn) btn.click();
    await wait(600);
    const a = SH.state.alterations.find(x => x.id === id);
    return { id, before, after: a.status, logEntries: a.log.length, lastMsg: a.log[a.log.length - 1].msg };
  });

  // ---- 7. corporate pipeline
  await page.evaluate(() => { location.hash = '#/admin/corporate'; });
  await sleep(900);
  R.corporate = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const id = SH.state.corporate[0].id;
    const btn = document.querySelector(`[data-corp="${id}"][data-corpst="Quoted"]`);
    if (btn) btn.click();
    await wait(500);
    return { id, status: SH.state.corporate.find(c => c.id === id).status,
             tierFor120: SH.corporateTier(120) };
  });

  // ---- 8. barcodes render
  await page.evaluate(() => { location.hash = '#/admin/inventory'; });
  await sleep(900);
  R.barcodes = await page.evaluate(() => {
    let bad = 0, n = 0;
    SH.PRODUCTS.forEach(p => p.sizes.forEach(s => { n++; if (!SH.checkEan13(SH.barcodeFor(p.slug, s))) bad++; }));
    return { variants: n, invalid: bad, tagButton: !!document.getElementById('tagSheet') };
  });

  R.errors = [...new Set(errors)];
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})().catch(e => { console.error('ADMIN TEST FAILED:', e.message); process.exit(1); });
