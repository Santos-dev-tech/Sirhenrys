/* ---------------------------------------------------------------------------
   Firebase App Check.

   WHAT IT IS FOR. The Firebase config in this page is public - it has to be, the browser
   needs it. So anyone can copy it into a script and call your project from anywhere.
   firestore.rules limits WHAT they can do; App Check limits WHETHER the request came
   from your site at all. It attests, invisibly, that the caller is really this app in a
   real browser, and rejects everything else.

   This is the thing standing between the assistant and the storefront. A staff console
   behind a PIN can only burn the Gemini quota three people at a time; a public page can
   be hit by a script until the free tier is gone, or - with billing on - until the bill
   is not. App Check is what makes a customer-facing assistant safe to switch on.

   IT MUST RUN FIRST. App Check attaches a token to requests made by Firestore, Auth and
   AI Logic, so it has to be activated before any of them makes one. That is why this
   file initialises the Firebase app itself and loads ahead of data.js, sync.js and
   auth.js, all of which reuse the app it created.

   TWO STEPS ARE YOURS, and neither can be done from here:

     1. Create a reCAPTCHA v3 site key at google.com/recaptcha/admin - register
        your real domain, and do NOT add localhost to it. Adding localhost would let
        anyone run a copy of this app from their own machine and pass attestation.
        Put the key in firebase-config.js as appCheckSiteKey.

     2. Firebase console -> App Check -> register this web app with that key, then
        ENFORCE it per service (Firestore, Authentication, AI Logic). Registering alone
        changes nothing: until you enforce, unattested requests are still served, which
        is deliberate so you can watch the metrics before you start rejecting traffic.

   For localhost there is a third step, which the console walks you through: this file
   turns on debug mode automatically when the host is local, the browser console prints a
   debug token, and you register that token under App Check -> Manage debug tokens. Keep
   it private - it bypasses attestation - and never commit it.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  const cfg = window.SH_FIREBASE;
  const st = { on: false, debug: false, error: null };
  window.SHAppCheck = { status: () => ({ ...st }) };

  if (!cfg || !cfg.enabled) return;
  if (typeof firebase === 'undefined' || !firebase.initializeApp) return;

  // the app has to exist before anything can be attached to it
  try {
    if (!(firebase.apps && firebase.apps.length)) firebase.initializeApp(cfg.config);
  } catch (e) {
    st.error = 'Could not initialise Firebase: ' + e.message;
    return;
  }

  if (!cfg.appCheckSiteKey) {
    st.error = 'No appCheckSiteKey in firebase-config.js - App Check is off, and this ' +
               'project is reachable by anyone holding the public config.';
    console.warn('[app-check] ' + st.error);
    return;
  }
  if (!firebase.appCheck) {
    st.error = 'The App Check SDK did not load.';
    console.warn('[app-check] ' + st.error);
    return;
  }

  // A local host cannot pass reCAPTCHA, and whitelisting it in reCAPTCHA would defeat
  // the point. Debug mode instead: the token printed below is registered once, by hand.
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/i.test(location.hostname) ||
                location.protocol === 'file:';
  if (local) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    st.debug = true;
    console.info('[app-check] debug mode: a token will be printed below. Register it at ' +
                 'Firebase console -> App Check -> Manage debug tokens. Do not commit it.');
  }

  try {
    firebase.appCheck().activate(
      new firebase.appCheck.ReCaptchaV3Provider(cfg.appCheckSiteKey),
      true   // refresh the token before it expires, so long sessions do not start failing
    );
    st.on = true;
  } catch (e) {
    st.error = e.message;
    console.warn('[app-check] ' + e.message + ' - continuing without attestation');
  }
})();
