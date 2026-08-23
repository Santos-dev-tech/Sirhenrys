/* ---------------------------------------------------------------------------
   Firestore sync.

   Before this file existed the honest limitation in the README was: "no server, so
   orders, stock and accounts live in the browser and reset when you clear storage.
   Nothing is shared between devices." That is the thing this fixes - ring up a sale
   on the till at Kimathi Street and the stock drops on the phone in Westgate.

   Shape: one document per shared key, at shops/<shop>/state/<key>, holding the value
   as a JSON string.

   Why a string rather than native Firestore fields: the state carries arrays of
   objects that themselves carry arrays - an order has items, an alteration has a log,
   a wedding group has members - and the moment any of those nests one array directly
   inside another, Firestore rejects the write. A string has no schema to violate, and
   nothing here queries server-side anyway; every view already filters in the client.
   The cost is the 1MB per-document ceiling, which at roughly 400 bytes an order is
   somewhere north of two thousand orders per key. Past that, orders want splitting
   into a real collection.

   Everything degrades: if Firebase is unreachable, misconfigured, or switched off in
   firebase-config.js, the app runs exactly as it did before, on localStorage.
--------------------------------------------------------------------------- */
window.SHSync = (function () {
  'use strict';

  const cfg = window.SH_FIREBASE;
  const st = { on: false, ready: false, error: null, user: null, writes: 0, reads: 0 };

  const listeners = [];
  const notify = () => listeners.forEach(fn => { try { fn(status()); } catch (e) {} });
  const status = () => Object.assign({}, st);

  function fail(where, e) {
    st.error = where + ': ' + (e && e.message ? e.message : String(e));
    st.on = false;
    console.warn('[sync] ' + st.error + ' - continuing on localStorage');
    notify();
  }

  function start() {
    if (!cfg || !cfg.enabled) { st.error = 'disabled in firebase-config.js'; notify(); return; }
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
      st.error = 'Firebase SDK not loaded'; notify(); return;
    }

    let db, app;
    try {
      app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg.config);
      db = firebase.firestore();
    } catch (e) { return fail('init', e); }

    if (cfg.analytics && firebase.analytics) {
      try { firebase.analytics(); } catch (e) { /* analytics is never worth breaking a page over */ }
    }

    // Offline persistence means the till keeps taking sales through a Safaricom outage
    // and reconciles when the line comes back. It throws if two tabs both claim it,
    // which is not an error worth surfacing - the second tab just works without a cache.
    try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}

    const root = db.collection('shops').doc(cfg.shop).collection('state');

    // Anonymous auth exists so the rules have something to check. It is not an identity
    // and it is not staff authentication - see firestore.rules for what it does buy.
    firebase.auth().signInAnonymously().catch(e => fail('auth', e));
    firebase.auth().onAuthStateChanged(u => {
      if (!u) return;
      st.user = u.uid; st.on = true; notify();
      subscribe(root);
    });

    // ---- remote -> local ----------------------------------------------------
    let subscribed = false;
    function subscribe(col) {
      if (subscribed) return;
      subscribed = true;
      col.onSnapshot(snap => {
        const patch = {};
        snap.docChanges().forEach(ch => {
          if (ch.type === 'removed') return;
          // Skip our own writes on their way out: they are already in local state, and
          // folding them back in would fight anything the user typed in the meantime.
          if (ch.doc.metadata.hasPendingWrites) return;
          const d = ch.doc.data() || {};
          if (typeof d.json !== 'string') return;
          try { patch[ch.doc.id] = JSON.parse(d.json); } catch (e) {}
        });
        if (!Object.keys(patch).length) return;
        Object.keys(patch).forEach(k => { last[k] = JSON.stringify(patch[k]); });
        st.reads += Object.keys(patch).length;
        SH.applyRemote(patch);
        notify();
      }, e => fail('snapshot', e));
    }

    // ---- local -> remote ----------------------------------------------------
    // Keyed on the serialised value, so a save that touched only the cart writes nothing,
    // and a burst of edits inside the debounce window collapses into one write each.
    const last = {};
    let timer = null, pending = null;

    SH.onChange((state, SHARED) => {
      if (!st.on) return;
      pending = { state, SHARED };
      clearTimeout(timer);
      timer = setTimeout(flush, 400);
    });

    function flush() {
      if (!pending || !st.on) return;
      const { state, SHARED } = pending; pending = null;
      const batch = db.batch();
      let n = 0;
      SHARED.forEach(k => {
        let json;
        try { json = JSON.stringify(state[k]); } catch (e) { return; }
        if (json === undefined || json === last[k]) return;
        last[k] = json;
        batch.set(root.doc(k), { json, at: firebase.firestore.FieldValue.serverTimestamp() });
        n++;
      });
      if (!n) return;
      st.writes += n;
      batch.commit().catch(e => fail('write', e));
      notify();
    }
  }

  return {
    start,
    status,
    onStatus(fn) { listeners.push(fn); fn(status()); }
  };
})();
