/* Storefront checks: M-Pesa STK flow, WhatsApp links, corporate quote, live stock,
   and that a POS sale in the console is visible on the shop side. */
const puppeteer = require('puppeteer-core');
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
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);

  // ---- WhatsApp links carry the right message
  R.whatsapp = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    location.hash = '#/product/carlo-navy'; await wait(700);
    const a = document.querySelector('[data-wa]');
    const href = a ? a.getAttribute('href') : '';
    const msg = decodeURIComponent((href.split('text=')[1] || ''));
    SH.cart.clear();
    SH.cart.add('carlo-navy', '52'); SH.cart.add('black-tuxedo', '50');
    await wait(400);
    const wo = document.getElementById('waOrder');
    const basketMsg = decodeURIComponent(((wo ? wo.href : '').split('text=')[1] || ''));
    return {
      productLinkHost: href.split('?')[0],
      productMessage: msg.slice(0, 90),
      basketMessageLines: basketMsg.split('\n').filter(l => l.trim().startsWith('-')).length,
      basketHasTotal: /Total:/.test(basketMsg)
    };
  });

  // ---- corporate quote maths
  R.corporate = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    location.hash = '#/corporate'; await wait(800);
    const n = document.getElementById('corpN');
    const out = {};
    for (const v of [5, 20, 120]) {
      n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); await wait(120);
      out[v] = document.getElementById('corpQuote').textContent.replace(/\s+/g, ' ').trim().slice(0, 80);
    }
    const before = SH.state.corporate.length;
    const f = document.getElementById('corpForm');
    f.company.value = 'Test Ltd'; f.contact.value = 'A Tester'; f.email.value = 't@x.co.ke';
    f.phone.value = '0700000000'; f.headcount.value = 60; f.deadline.value = '2026-12-01';
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait(500);
    out.submitted = SH.state.corporate.length === before + 1;
    out.newest = SH.state.corporate[0].company + ' / ' + SH.state.corporate[0].status;
    return out;
  });

  // ---- M-Pesa checkout: STK screen then a real receipt on the order
  R.mpesa = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    SH.cart.clear(); SH.cart.add('carlo-navy', '52');
    location.hash = '#/checkout'; await wait(900);
    const f = document.getElementById('coForm');
    f.name.value = 'Test Buyer'; f.phone.value = '0722123456'; f.email.value = 'b@x.co.ke';
    const mp = f.querySelector('[name=mpesa]'); if (mp) mp.value = '0722123456';
    const ordersBefore = SH.state.orders.length;
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait(700);
    const stkVisible = !!document.querySelector('#stk.on');
    const stkText = (document.querySelector('.stk-card') || {}).textContent || '';
    await wait(2600);
    const o = SH.state.orders[0];
    return {
      stkScreenShown: stkVisible,
      stkMentionsPin: /PIN/i.test(stkText),
      orderCreated: SH.state.orders.length === ordersBefore + 1,
      receiptOnOrder: !!o.mpesaReceipt,
      receiptFormat: o.mpesaReceipt,
      landedOn: location.hash,
      cartCleared: SH.cart.count === 0
    };
  });

  // ---- live stock: a POS sale must show on the shop side
  R.liveStock = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const p = SH.byId('black-tuxedo'); const size = '50';
    const before = SH.branchTotal(p, size);
    SH.recordSale({ lines: [{ slug: p.slug, size, qty: 1, price: p.price }],
      branch: 'cbd', payment: 'Cash', staff: 'Test' });
    location.hash = '#/product/black-tuxedo'; await wait(800);
    const after = SH.branchTotal(p, size);
    const btn = [...document.querySelectorAll('.sizes button')].find(b => b.dataset.size === size);
    if (btn) btn.click(); await wait(300);
    return { storefrontBefore: before, storefrontAfter: after,
             droppedByOne: before - after === 1,
             stockLine: (document.querySelector('[data-stock]') || {}).textContent };
  });

  R.errors = [...new Set(errors)];
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})().catch(e => { console.error('STORE TEST FAILED:', e.message); process.exit(1); });
