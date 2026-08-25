/* Sign a puppeteer page into the staff console.

   The gate is two steps now - PIN, then a TOTP code - so six harnesses that each
   typed '1967' into #pinInput and submitted would each have had to grow the same
   second step. They call this instead.

   The code is computed the same way the authenticator app does, from the secret
   in SH.STAFF, so this is a real second factor being satisfied rather than a test
   hook that skips it. If the TOTP maths ever breaks, every one of these harnesses
   fails, which is the correct blast radius.

     const signInAs = require('./signin');
     await signInAs(page, 'ha');       // -> { ok, heading }
*/
const DEMO_PINS = { ha: '1967', wm: '2468', ok: '1357' };

module.exports = async function signInAs(page, id) {
  const pin = DEMO_PINS[id];
  if (!pin) throw new Error('signin.js: no demo PIN for staff id "' + id + '"');

  return page.evaluate(async (id, pin) => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const ad = document.getElementById('ad');
    if (!ad) return { ok: false, why: 'no #ad in the document' };

    // a stale lockout from an earlier run would refuse a correct PIN
    try { localStorage.removeItem('sirhenrys.rl'); } catch (e) {}

    const who = ad.querySelector('[data-staff="' + id + '"]');
    if (!who) return { ok: false, why: 'no login card - already signed in?' };
    who.click(); await wait(320);

    const submit = () => ad.querySelector('#pinForm')
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    ad.querySelector('#pinInput').value = pin;
    submit();
    // PBKDF2 at 210,000 iterations is deliberately slow; give it room
    await wait(1500);

    const otp = ad.querySelector('#otpInput');
    if (!otp) return { ok: false, why: 'the console never asked for a second factor' };
    const member = SH.STAFF.find(s => s.id === id);
    otp.value = await SHSec.totp.now(member.totp);
    submit();
    await wait(1700);

    return { ok: !ad.querySelector('.login'),
             heading: (ad.querySelector('#view h1') || {}).textContent || null };
  }, id, pin);
};
