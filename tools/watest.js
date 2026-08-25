/* The WhatsApp channel, checked.

     node tools/watest.js

   The research says this is the channel that matters in this market - a comparable
   Kenyan fashion brand reported 70% of orders arriving on it - so the prefilled
   messages are worth a test rather than a glance.

   Checks that the product link carries the size the customer actually chose, that
   the bag link carries every line with its size and the right total, and that both
   carry a reference the shop can look up.
*/
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:8123';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 200000,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars']
  });
  const p = await b.newPage();
  p.setDefaultNavigationTimeout(120000);
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.SH && !!window.SHUX);
  await sleep(3500);

  const out = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const decode = href => decodeURIComponent((href.split('?text=')[1] || ''));
    const res = {};

    const prod = SH.PRODUCTS.find(x => x.sizes && x.sizes.length > 1);
    res.product = prod.title;
    location.hash = '#/product/' + prod.slug;
    await wait(2200);

    const wa = document.querySelector('[data-wa]');
    res.beforeSize = decode(wa.getAttribute('href'));

    // choose a size the way a customer does, then read the link again
    const buttons = [...document.querySelectorAll('.sizes button')].filter(x => !x.disabled);
    res.chosen = buttons.length ? buttons[buttons.length - 1].dataset.size : null;
    if (buttons.length) { buttons[buttons.length - 1].click(); await wait(400); }
    res.afterSize = decode(document.querySelector('[data-wa]').getAttribute('href'));
    // read the routed number here, while the product page still exists
    res.number = (document.querySelector('[data-wa]').getAttribute('href').match(/wa\.me\/(\d+)/) || [])[1];
    res.cbdNumber = (SH.state.settings.whatsapp || {}).cbd;
    const best = SH.BRANCHES
      .map(x => ({ name: x.name, n: SH.stockAt(prod.slug, res.chosen, x.id) }))
      .sort((a, b) => b.n - a.n)[0];
    res.routedBranch = best && best.n > 0 ? best.name : null;

    // and the bag
    SH.state.cart = [];
    SH.cart.add(prod.slug, res.chosen, 2);
    await wait(300);
    location.hash = '#/cart';
    await wait(1500);
    document.querySelector('[data-opencart]').click();
    await wait(600);
    const bag = document.getElementById('waOrder');
    res.bag = decode(bag.getAttribute('href'));
    res.bagVisible = bag.style.display !== 'none';
    res.cartTotal = SH.fmt(SH.cart.total);
    res.bagNumber = (bag.getAttribute('href').match(/wa\.me\/(\d+)/) || [])[1];
    SH.state.cart = [];
    return res;
  });

  await b.close();

  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

  const REF = /Ref SH-W[0-9A-Z]{5}/;

  check('product link omits the size before one is chosen',
    !/size/i.test(out.beforeSize), out.beforeSize.replace(/\n+/g, ' / '));

  check('product link carries the size once chosen',
    out.chosen && out.afterSize.includes('size ' + out.chosen),
    `chose ${out.chosen} -> "${out.afterSize.replace(/\n+/g, ' / ')}"`);

  check('product link carries a reference', REF.test(out.afterSize),
    (out.afterSize.match(REF) || ['none'])[0]);

  check('bag link lists the line with size and quantity',
    out.bag.includes('size ' + out.chosen) && out.bag.includes('x2'),
    out.bag.replace(/\n+/g, ' / ').slice(0, 120));

  check('bag link carries the right total', out.bag.includes(out.cartTotal),
    'total in message matches ' + out.cartTotal);

  check('bag link carries a reference', REF.test(out.bag),
    (out.bag.match(REF) || ['none'])[0]);

  check('the two references differ',
    (out.afterSize.match(REF) || [''])[0] !== (out.bag.match(REF) || [''])[0],
    'a reference is per message, not per session');

  check('the link points at a real number', /^254\d{9}$/.test(out.number || ''),
    'wa.me/' + out.number);

  /* The enquiry should reach a shop that can answer it. settings.whatsapp holds a
     number per branch and every call site used to pass null, so "do you have a 52"
     went to the CBD whether or not the CBD had one. */
  check('the enquiry is routed to a branch holding that size',
    out.routedBranch && out.afterSize.includes(out.routedBranch),
    out.routedBranch
      ? `size ${out.chosen} is at ${out.routedBranch}; the message says so and the link uses that store's number`
      : 'no branch held the chosen size, so it fell back to the CBD - which is correct');

  check('a branch number differs from the CBD default',
    !out.routedBranch || out.number !== out.cbdNumber,
    out.routedBranch ? `routed ${out.number}, CBD is ${out.cbdNumber}` : 'fallback, same number expected');

  let fails = 0;
  console.log('\nWhatsApp channel — ' + out.product);
  console.log('-'.repeat(74));
  for (const c of checks) {
    if (!c.pass) fails++;
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}`);
    console.log(`      ${c.detail}`);
  }
  console.log('-'.repeat(74));
  console.log(`${checks.length - fails}/${checks.length} passing`);
  process.exit(fails);
})().catch(e => { console.error('harness error:', e); process.exit(99); });
