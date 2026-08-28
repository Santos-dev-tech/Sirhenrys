/* deckshots.js - matched before/after phone screenshots for the client deck.
 *
 * "Before" is served from a git worktree at 95077f1 on :8200, which is the commit
 * immediately before the phone work. "After" is the working tree on :8100. Same
 * viewport, same routes, same basket, same theme - so the only difference in the
 * pair is the change being presented.
 *
 * Writes _shots/deck/{before,after}-*.png.
 *
 * Run both servers first:
 *   python tools/serve.py 8100        (in the repo)
 *   python tools/serve.py 8200        (in the worktree)
 */
const puppeteer = require('puppeteer-core');
const signInAs = require('./signin');
const fs = require('fs');
const path = require('path');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '..', '_shots', 'deck');
const W = 390, H = 760;

async function newPhone(b, port, hash) {
	const p = await b.newPage();
	await p.setViewport({ width: W, height: H, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
	await p.goto(`http://localhost:${port}/index.html${hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
	await sleep(3600);
	/* the consent bar is fixed to the bottom of every page and would sit in the middle
	   of every screenshot; answer it the way a visitor would */
	await p.evaluate(() => {
		const b = [...document.querySelectorAll('.cc button, .cc .btn')].find(x => /decline/i.test(x.textContent || ''));
		if (b) b.click();
	});
	await sleep(500);
	return p;
}

async function fillBasket(p) {
	for (const t of ['suit', 'shirt', 'blazer']) {
		await p.evaluate(x => {
			const i = document.querySelector('#posScan');
			if (!i) return;
			i.value = x;
			i.dispatchEvent(new Event('input', { bubbles: true }));
		}, t);
		await sleep(600);
		await p.evaluate(() => { const h = document.querySelector('.pos-hit:not(:disabled)'); if (h) h.click(); });
		await sleep(450);
	}
	return p.evaluate(() => document.querySelectorAll('.pos-line').length);
}

/* draw the true device edge so a viewer can see what is off the screen */
async function edge(p) {
	await p.evaluate(w => {
		const d = document.createElement('div');
		d.style.cssText = 'position:fixed;top:0;bottom:0;left:' + (w - 2) + 'px;width:2px;background:#b4442f;z-index:99999;pointer-events:none';
		document.body.appendChild(d);
	}, W);
	await sleep(200);
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const b = await puppeteer.launch({
		executablePath: CHROME, headless: 'new',
		args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
	});
	const made = [];
	const shot = async (p, name, full = false) => {
		const f = path.join(OUT, name + '.png');
		await p.screenshot({ path: f, fullPage: full });
		made.push(name);
	};

	for (const [label, port] of [['before', 8200], ['after', 8100]]) {
		/* 1 - the storefront header */
		let p = await newPhone(b, port, '#/');
		await edge(p);
		await shot(p, label + '-home');

		/* 2 - the nav drawer, open */
		await p.evaluate(() => document.querySelector('.burger').click());
		await sleep(750);
		await shot(p, label + '-drawer');
		await p.close();

		/* 3 - the till, signed in, with a real basket */
		p = await newPhone(b, port, '#/admin');
		/* PBKDF2 at 210k iterations plus a TOTP step is slow, and a cold page on a
		   loaded machine loses the race. Retry rather than report a false failure. */
		let who = null;
		for (let i = 0; i < 3 && !(who && who.ok); i++) {
			await sleep(1200);
			who = await signInAs(p, 'ha');
		}
		if (!who.ok) { console.log(label + ': sign-in failed ' + JSON.stringify(who)); await p.close(); continue; }
		await p.evaluate(() => { location.hash = '/admin/pos'; });
		await sleep(1600);
		const lines = await fillBasket(p);
		await p.evaluate(() => window.scrollTo(0, 0));
		await sleep(400);
		await edge(p);
		await shot(p, label + '-till');
		await shot(p, label + '-till-full', true);
		console.log(label + ' till: ' + lines + ' basket lines');
		await p.close();
	}

	console.log('\n' + made.join('\n'));
	await b.close();
})();
