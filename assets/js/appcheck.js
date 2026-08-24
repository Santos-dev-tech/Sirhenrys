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

     1. Create a reCAPTCHA key and put it in firebase-config.js as appCheckSiteKey.
        Google retired the old google.com/recaptcha/admin console and required every key
        to move to Google Cloud by the end of 2025, so new keys are made at
        console.cloud.google.com/security/recaptcha - "Create key", type Website. In that
        console the "Key ID" IS the site key.
        Register your real domain and do NOT add localhost: whitelisting it would let
        anyone run a copy of this app from their own machine and pass attestation.

        A Cloud-made key is a reCAPTCHA ENTERPRISE key and needs a different provider
        from a legacy v3 one, so set appCheckProvider to match - 'enterprise' for a key
        made in Cloud, 'v3' for an older one that still works. Getting this wrong fails
        at activation with a provider error rather than silently.

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
  const st = { on: false, debug: false, error: null, provider: null };
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

  /* On localhost App Check is OFF unless you ask for it, and that is a deliberate
     trade rather than laziness.

     A local host cannot pass reCAPTCHA - the key is bound to the live domain, and
     whitelisting localhost would let anyone run a copy of this app from their own
     machine and pass attestation. So localhost needs a debug token, which has to be
     registered by hand in the console. Until it is, the token exchange 403s, and that
     failure cascades: Firebase Auth cannot get a token, anonymous sign-in fails with
     auth/network-request-failed, and Firestore sync dies with it. Measured, not guessed.

     Trading a working local shop for attestation nobody can reach is a bad bargain, so:
     turn it on deliberately with ?appcheck=1 (or appCheckLocal:true) when you want to
     test the real path, and register the debug token it prints. */
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/i.test(location.hostname) ||
                location.protocol === 'file:';
  const wantLocal = cfg.appCheckLocal === true ||
                    /[?&]appcheck=1/.test(location.search);
  if (local && !wantLocal) {
    st.error = 'off on localhost - add ?appcheck=1 to test it, and register the debug ' +
               'token it prints under Firebase console -> App Check -> Manage debug tokens';
    console.info('[app-check] ' + st.error);
    return;
  }
  if (local) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    st.debug = true;
    console.info('[app-check] debug mode: a token is printed below. Register it at ' +
                 'Firebase console -> App Check -> Manage debug tokens, or every request ' +
                 'will 403 and take Firestore auth down with it. Do not commit it.');
  }

  /* Which provider depends on where the key came from. Keys made in Google Cloud - which
     is now the only place to make them - are Enterprise keys; a legacy v3 key from the
     retired admin console uses the other provider. Default to enterprise, because that is
     what anyone setting this up today will have. */
  const kind = (cfg.appCheckProvider || 'enterprise').toLowerCase();
  const Provider = kind === 'v3'
    ? firebase.appCheck.ReCaptchaV3Provider
    : firebase.appCheck.ReCaptchaEnterpriseProvider;
  if (!Provider) {
    st.error = 'This SDK has no ' + kind + ' provider.';
    console.warn('[app-check] ' + st.error);
    return;
  }

  try {
    firebase.appCheck().activate(
      new Provider(cfg.appCheckSiteKey),
      true   // refresh the token before it expires, so long sessions do not start failing
    );
    st.on = true;
    st.provider = kind;
  } catch (e) {
    st.error = e.message + ' (provider: ' + kind + ' - if the key was made in Google ' +
               'Cloud it is an Enterprise key; set appCheckProvider accordingly)';
    console.warn('[app-check] ' + st.error + ' - continuing without attestation');
  }
})();
