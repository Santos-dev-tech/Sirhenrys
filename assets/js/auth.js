/* ---------------------------------------------------------------------------
   Customer accounts.

   Separate from the staff console on purpose. The console gate in admin.js decides
   who may open the till; this decides who a shopper is. They are different questions
   and conflating them is how a shop floor account ends up able to read the books.

   Firebase Auth, email and password. Two things worth knowing:

   - sync.js signs everyone in anonymously so the Firestore rules have something to
     check. When a customer signs in for real, that anonymous credential is REPLACED,
     which is fine - the rules only ask for a signed-in user. But signing out would
     leave none at all and every write would start failing, so signing out drops
     straight back to anonymous rather than to nothing.

   - Everything degrades. If the SDK is missing, the project is misconfigured, or
     Email/Password is not enabled in the Firebase console, this falls back to a
     local-only profile held in localStorage. The demo still behaves like a shop; it
     just is not really authenticating anyone, and says so.
--------------------------------------------------------------------------- */
window.SHAuth = (function () {
  'use strict';

  const LOCAL_KEY = 'sirhenrys.customer';
  const listeners = [];
  let user = null;          // { uid, email, name, local? }
  let ready = false;
  let backend = false;      // true once Firebase Auth is actually usable
  let redirectError = null; // anything that went wrong coming back from a redirect

  const notify = () => listeners.forEach(fn => { try { fn(user); } catch (e) {} });

  function setLocal(u) {
    user = u;
    try {
      if (u) localStorage.setItem(LOCAL_KEY, JSON.stringify(u));
      else localStorage.removeItem(LOCAL_KEY);
    } catch (e) {}
    // data.js keeps the shopper on the device, never in the synced half
    if (window.SH) { SH.state.customer = u; SH.save(); }
    notify();
  }

  function fbUser(u) {
    return { uid: u.uid, email: u.email || '', name: u.displayName || (u.email || '').split('@')[0] };
  }

  function start() {
    try { user = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { user = null; }

    const cfg = window.SH_FIREBASE;
    if (!cfg || !cfg.enabled || typeof firebase === 'undefined' || !firebase.auth) {
      ready = true; notify(); return;
    }
    try {
      if (!(firebase.apps && firebase.apps.length)) firebase.initializeApp(cfg.config);
      backend = true;
    } catch (e) { ready = true; notify(); return; }

    /* Coming back from a full-page redirect. This resolves with a null user on a
       normal load, so it costs nothing when it did not happen. */
    firebase.auth().getRedirectResult()
      .then(r => { if (r && r.user) setLocal(fbUser(r.user)); })
      .catch(e => { redirectError = readable(e); notify(); });

    firebase.auth().onAuthStateChanged(u => {
      ready = true;
      // an anonymous credential is not a customer - it is the key sync.js holds
      if (u && !u.isAnonymous) setLocal(fbUser(u));
      else if (user && !user.local) setLocal(null);
      else notify();
    });
  }

  // Turn Firebase's error codes into something a person can act on.
  function readable(e) {
    const c = (e && e.code) || '';
    if (c === 'auth/operation-not-allowed')
      return 'Email sign-in is not switched on for this project yet. ' +
             'Firebase console → Authentication → Sign-in method → Email/Password → Enable.';
    if (c === 'auth/email-already-in-use')   return 'There is already an account with that email. Try signing in.';
    if (c === 'auth/invalid-email')          return 'That does not look like an email address.';
    if (c === 'auth/weak-password')          return 'Use at least six characters.';
    if (c === 'auth/invalid-credential' ||
        c === 'auth/wrong-password' ||
        c === 'auth/user-not-found')         return 'That email and password do not match an account.';
    if (c === 'auth/too-many-requests')      return 'Too many attempts. Wait a minute and try again.';
    if (c === 'auth/network-request-failed') return 'No connection to the server.';

    // ---- the provider flows ----
    if (c === 'auth/popup-closed-by-user' ||
        c === 'auth/cancelled-popup-request')  return '';   // they changed their mind; say nothing
    if (c === 'auth/popup-blocked')
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site, or try again.';
    if (c === 'auth/unauthorized-domain')
      return 'This address is not on the project\'s authorised list. ' +
             'Firebase console → Authentication → Settings → Authorised domains → add ' + location.hostname + '.';
    if (c === 'auth/account-exists-with-different-credential')
      return 'You already have an account with that email, made a different way. ' +
             'Sign in the way you did the first time, and you can link Google afterwards.';
    return (e && e.message) || 'Something went wrong.';
  }

  /* The password policy lives HERE as well as on the form.

     The form checks it so a person gets a sentence before they press anything.
     This checks it because a policy that only exists in one view is a policy that
     the next view forgets - and because Firebase's own floor is six characters,
     which is not a policy, it is a shrug. */
  function policy(email, pass) {
    const e = SHSec.validate(email, 'email');
    if (!e.ok) return e.error;
    const s = SHSec.passwordScore(pass);
    if (!s.ok) return 'That password is ' + s.label.toLowerCase() + '. ' + (s.notes[0] || '');
    // a password that is the email address is the oldest trick in every dump
    if (String(pass).toLowerCase().includes(String(email).split('@')[0].toLowerCase()))
      return 'Do not use your email address in your password.';
    return null;
  }

  /* ---------- Continue with Google ----------

     Popup first, because a popup keeps the page - and the bag - exactly where it
     was. Some browsers refuse popups outright and every in-app browser (Instagram,
     Facebook) refuses them silently, so a refusal falls back to a full redirect
     rather than dead-ending. getRedirectResult below picks that up on the way back.

     The provider is asked for the account chooser every time. Without it a shared
     laptop signs the second person in as the first, which in a shop is not
     hypothetical. */
  function googleProvider() {
    const p = new firebase.auth.GoogleAuthProvider();
    p.addScope('email');
    p.addScope('profile');
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  }

  async function signInWithGoogle() {
    if (!backend) {
      return { ok: false, error: 'Google sign-in needs the Firebase connection, which is off in this build.' };
    }
    try {
      const cred = await firebase.auth().signInWithPopup(googleProvider());
      setLocal(fbUser(cred.user));
      return { ok: true };
    } catch (e) {
      const c = (e && e.code) || '';
      if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment' ||
          c === 'auth/web-storage-unsupported') {
        try {
          await firebase.auth().signInWithRedirect(googleProvider());
          return { ok: true, redirecting: true };
        } catch (e2) { return { ok: false, error: readable(e2), raw: rawOf(e2) }; }
      }
      return { ok: false, error: readable(e), raw: rawOf(e) };
    }
  }

  // The server's own words, kept beside the friendly version. Three misdiagnoses on
  // this project came from trusting a mapped message over the raw one.
  const rawOf = e => (e && (e.code ? e.code + ': ' : '') + (e.message || '')) || String(e);

  async function signUp(name, email, pass) {
    const bad = policy(email, pass);
    if (bad) return { ok: false, error: bad };
    if (!backend) { setLocal({ uid: 'local', email, name, local: true }); return { ok: true, local: true }; }
    try {
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
      if (name) { try { await cred.user.updateProfile({ displayName: name }); } catch (e) {} }
      setLocal({ uid: cred.user.uid, email: cred.user.email, name: name || email.split('@')[0] });
      return { ok: true };
    } catch (e) { return { ok: false, error: readable(e) }; }
  }

  async function signIn(email, pass) {
    if (!backend) { setLocal({ uid: 'local', email, name: email.split('@')[0], local: true }); return { ok: true, local: true }; }
    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(email, pass);
      setLocal(fbUser(cred.user));
      return { ok: true };
    } catch (e) { return { ok: false, error: readable(e) }; }
  }

  async function signOut() {
    setLocal(null);
    if (!backend) return;
    try {
      await firebase.auth().signOut();
      // straight back to anonymous, or Firestore writes start failing
      await firebase.auth().signInAnonymously();
    } catch (e) { /* offline: the local profile is already cleared */ }
  }

  return {
    start, signUp, signIn, signOut, signInWithGoogle,
    lastRedirectError: () => redirectError,
    current: () => user,
    isReady: () => ready,
    hasBackend: () => backend,
    onChange(fn) { listeners.push(fn); fn(user); }
  };
})();
