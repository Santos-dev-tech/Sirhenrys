/* The console's toast, and the banner it used to collide with.

     node tools/toasttest.js

   Pressing Quoted in Corporate & Bulk left a message pinned to the bottom of the
   screen for ever. Two faults feeding each other:

     - `.ad .notice` is position:fixed - it IS the toast - and the corporate panel
       rendered its "became order" line with the same class, so a line that belongs
       inside a panel was a second toast nailed to the window;
     - toast() found its element with querySelector('.notice'), so it wrote into
       that banner, render() destroyed the node, and the 2.4s timer cleared
       something that was no longer on the page.

   This asserts the toast appears, clears itself, survives a re-render, and that
   nothing inside #view is position:fixed - which is the shape of the bug.
*/
const puppeteer = require('puppeteer-core');
const signInAs = require('./signin');

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
  await p.goto(BASE + '/index.html#/admin', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.SH && !!window.SHUX);
  await sleep(4000);
  await signInAs(p, 'ha');
  await sleep(1500);

  const out = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const res = {};
    const shown = () => {
      const t = document.querySelector('.ad-toast');
      if (!t) return { exists: false };
      const r = t.getBoundingClientRect();
      return { exists: true, on: t.classList.contains('on'),
               text: t.textContent.trim().slice(0, 50),
               onScreen: r.top < innerHeight - 10 && r.bottom > 0 };
    };
    // anything fixed inside the view is the shape of the original bug
    const fixedInView = () => [...document.querySelectorAll('#view *')]
      .filter(e => getComputedStyle(e).position === 'fixed')
      .map(e => e.className + ' "' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 30) + '"');

    location.hash = '#/admin/corporate';
    await wait(1800);
    res.atRest = shown();
    res.fixedBefore = fixedInView();

    // press Quoted, the way the shop does
    const chip = document.querySelector('[data-corpst="Quoted"]');
    res.chipFound = !!chip;
    if (chip) chip.click();
    await wait(500);
    res.raised = shown();

    await wait(3000);                    // it is meant to clear at 2.4s
    res.cleared = shown();

    // Won creates an order and renders the panel banner - the collision case
    const won = document.querySelector('[data-corpst="Won"]');
    if (won) won.click();
    await wait(600);
    res.afterWon = shown();
    res.wonbar = (() => {
      const w = document.querySelector('.wonbar');
      if (!w) return { exists: false };
      return { exists: true, position: getComputedStyle(w).position,
               inPanel: !!w.closest('.panel'),
               text: w.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) };
    })();
    res.fixedAfter = fixedInView();

    await wait(3200);
    res.clearedAgain = shown();

    // and it must survive a route change without leaving anything behind
    location.hash = '#/admin/orders';
    await wait(1400);
    res.afterRoute = shown();
    res.strayNotices = document.querySelectorAll('.notice.on').length;
    return res;
  });

  await b.close();

  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

  check('nothing is pinned to the screen before anything is pressed',
    out.fixedBefore.length === 0 && !out.atRest.on,
    out.fixedBefore.length ? out.fixedBefore.join(' | ') : 'no fixed element inside #view');

  check('pressing Quoted raises a toast',
    out.chipFound && out.raised.exists && out.raised.on && out.raised.onScreen,
    `"${out.raised.text}"`);

  check('the toast clears itself',
    out.cleared.exists && !out.cleared.on,
    'gone after 2.4s, which is the bug that was reported');

  check('the became-order line is a panel banner, not a toast',
    out.wonbar.exists && out.wonbar.position !== 'fixed' && out.wonbar.inPanel,
    out.wonbar.exists
      ? `.wonbar position:${out.wonbar.position}, inside the panel: "${out.wonbar.text}"`
      : 'no .wonbar rendered');

  check('nothing inside #view is position:fixed after Won',
    out.fixedAfter.length === 0,
    out.fixedAfter.length ? out.fixedAfter.join(' | ') : 'clean');

  check('the toast still clears after a re-render',
    out.clearedAgain.exists && !out.clearedAgain.on,
    'render() replaced the panel and the timer still found its own element');

  check('a route change leaves nothing behind',
    !out.afterRoute.on && out.strayNotices === 0,
    `${out.strayNotices} stray .notice.on`);

  let fails = 0;
  console.log('\nConsole toast — Corporate & Bulk');
  console.log('-'.repeat(72));
  for (const c of checks) {
    if (!c.pass) fails++;
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}`);
    console.log(`      ${c.detail}`);
  }
  console.log('-'.repeat(72));
  console.log(`${checks.length - fails}/${checks.length} passing`);
  process.exit(fails);
})().catch(e => { console.error('harness error:', e); process.exit(99); });
