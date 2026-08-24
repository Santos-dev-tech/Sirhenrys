/* ---------------------------------------------------------------------------
   The one file to edit when this moves to a different Firebase project.

   A Firebase web apiKey is NOT a secret. It identifies the project to Google's
   servers; it does not authorise anything. What actually protects the data is
   firestore.rules, which ships alongside this file. Anyone can read this key out
   of the page source, on this site or on any other Firebase site, and that is by
   design - so do not treat rotating it as a security measure. Getting the rules
   right is the security measure.

   Set enabled:false to run the whole app off localStorage again, exactly as it
   behaved before there was a backend. Nothing else has to change.
--------------------------------------------------------------------------- */
window.SH_FIREBASE = {
  enabled: true,

  // Which shop's books this build is looking at. One Firebase project can carry
  // several - a live one and a demo one - without them seeing each other.
  shop: 'sirhenrys',

  // Analytics is optional and off by default: it loads another 26KB, sets
  // cookies, and a staff till has no business reporting page views.
  analytics: false,

  // The staff assistant. Costs money per question - Gemini 3.7 Flash is roughly
  // $0.75 per million input tokens and $3.75 per million output - so it is a switch,
  // not an assumption. Set false and the panel says it is off and nothing is billed.
  ai: true,
  // Probed against this project: every 2.x model is retired. ai.js falls through a
  // list of live alternatives if this one is ever refused.
  aiModel: 'gemini-3.7-flash',

  /* reCAPTCHA key for App Check. Google retired the old google.com/recaptcha/admin
     console - every key had to move to Google Cloud by the end of 2025 - so make one at
     console.cloud.google.com/security/recaptcha, "Create key", type Website. There, the
     "Key ID" IS the site key. Register your real domain and NOT localhost: whitelisting
     it would let anyone run a copy of this app from their own machine and pass
     attestation. Localhost uses a debug token instead - see assets/js/appcheck.js.

     Leave it empty and App Check stays off, which is the current state: the public
     config below is then all anyone needs to call this project directly.

     Like the apiKey, this one is public by design. What protects you is that reCAPTCHA
     only issues tokens to the domains you registered. */
  appCheckSiteKey: '6Lc0w5UtAAAAABh2HXN9j6ILI60zAlGTbC6Lbq9u',

  // 'enterprise' for a key made in Google Cloud (all new ones), 'v3' for a legacy key
  // from the old admin console. They need different providers; the wrong one fails loudly
  // at activation rather than silently letting requests through unattested.
  appCheckProvider: 'enterprise',

  config: {
    apiKey: 'AIzaSyDSfC8bn2GXlBPDQ9DRQZRaV-5ntV0TaCU',
    authDomain: 'sir-henrys.firebaseapp.com',
    projectId: 'sir-henrys',
    storageBucket: 'sir-henrys.firebasestorage.app',
    messagingSenderId: '481284120072',
    appId: '1:481284120072:web:6feb47ce3bc381969dfbbd',
    measurementId: 'G-YFVXK0KV75'
  }
};
