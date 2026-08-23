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
    return (e && e.message) || 'Something went wrong.';
  }

  async function signUp(name, email, pass) {
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
    start, signUp, signIn, signOut,
    current: () => user,
    isReady: () => ready,
    hasBackend: () => backend,
    onChange(fn) { listeners.push(fn); fn(user); }
  };
})();
