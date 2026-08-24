/* ---------------------------------------------------------------------------
   The shop assistant.

   WHY THIS SHAPE, because the obvious alternatives are worse:

   - Calling the Gemini REST API directly from the page needs an API key in the page.
     That key is billable and public the moment it ships. Rejected outright.
   - A Cloud Function proxy would keep the key server-side, but needs the Blaze plan,
     a deploy pipeline and another moving part - and buys nothing over the option
     below, which already keeps the key off the client.
   - Firebase AI Logic proxies every request through Firebase, so the Gemini key never
     reaches the browser, it needs no server, and it runs on the free tier.

   It is loaded as a module because Firebase AI Logic ships ESM only - there is no
   compat build at any version, checked. gstatic serves a browser-native ESM whose own
   imports are absolute URLs, so it runs from a plain <script type="module"> with no
   bundler, which is the whole point of this project having no build step.

   That does mean this one file is fetched at runtime rather than vendored. It is the
   only part of the site that is, and it costs nothing that was not already lost: an
   assistant that talks to a model cannot work offline anyway. tools/bundle.py strips
   it from the portable build for exactly that reason.

   WHAT IT MAY DO. It proposes; a person commits. It can read a summary of the shop and
   it can call the three functions declared below - open a screen, draft a transfer,
   draft a message. Every one of those either navigates or fills a form. None of them
   writes to stock, orders or money. That is deliberate and should stay that way: the
   model is occasionally wrong, and being wrong about which screen to open costs a
   click, while being wrong about stock costs a count.
--------------------------------------------------------------------------- */
/* 12.18.0, not 12.3.0. Probed: on 12.3.0 gemini-3.7-flash fails with an SDK-internal
   "reading 'some' of undefined" - the model answers, the old parser cannot read it. The
   newer SDK handles it. Worth knowing that a model failure and an SDK failure look
   nothing alike: a wrong name gives a clean 404 from the server. */
const SDK = 'https://www.gstatic.com/firebasejs/12.18.0/';

const state = { ready: false, error: null, model: null, busy: false, modelName: null, candidates: [], build: null };
const listeners = [];
const notify = () => listeners.forEach(fn => { try { fn({ ...state }); } catch (e) {} });

/* ---------- what the assistant is allowed to do ---------- */
const TOOLS = [{
  functionDeclarations: [
    {
      name: 'openScreen',
      description: 'Open a screen in the staff console so the user can act on what was just discussed. ' +
                   'Use this whenever the answer would have the user navigate somewhere.',
      parameters: {
        type: 'OBJECT',
        properties: {
          screen: {
            type: 'STRING',
            description: 'One of: dashboard, analytics, pos, orders, products, inventory, ' +
                         'customers, fittings, alterations, commissions, groups, corporate, settings'
          }
        },
        required: ['screen']
      }
    },
    {
      name: 'proposeTransfer',
      description: 'Propose moving stock of one size of one garment from one branch to another. ' +
                   'This only drafts the proposal for the user to confirm - it does not move anything.',
      parameters: {
        type: 'OBJECT',
        properties: {
          slug:   { type: 'STRING', description: 'The product slug, exactly as given in the shop summary' },
          size:   { type: 'STRING', description: 'The size to move' },
          from:   { type: 'STRING', description: 'Branch id to take stock from: cbd, west, rivers or msa' },
          to:     { type: 'STRING', description: 'Branch id to send stock to' },
          qty:    { type: 'NUMBER', description: 'How many units' },
          reason: { type: 'STRING', description: 'One short sentence on why this move is worth making' }
        },
        required: ['slug', 'size', 'from', 'to', 'qty', 'reason']
      }
    },
    {
      name: 'draftMessage',
      description: 'Draft a message to a customer or a corporate enquiry for the user to review, ' +
                   'edit and send themselves. It is never sent automatically.',
      parameters: {
        type: 'OBJECT',
        properties: {
          to:      { type: 'STRING', description: 'Who it is addressed to' },
          subject: { type: 'STRING', description: 'A short subject line' },
          body:    { type: 'STRING', description: "The message, in Sir Henry's voice: plain, warm, unfussy" }
        },
        required: ['to', 'body']
      }
    }
  ]
}];

const SYSTEM = `You are the shop assistant for Sir Henry's Limited, a menswear tailor in
Nairobi established 1967, with four stores. You are speaking to a member of staff inside
their own console.

How to behave:
- Answer from the shop summary you are given. It is live data. If the summary does not
  contain what is needed, say so plainly rather than guessing a number.
- Be brief. Staff are on a shop floor, not reading a report. Two or three sentences, and
  a short list only when a list is genuinely clearer.
- Money is Kenyan shillings, written like KSh 39,950.
- You propose, staff decide. Never claim to have moved stock, changed an order or sent
  anything. When you call a function, describe it as a suggestion waiting for them.
- If asked something outside this shop, say it is outside what you can see.`;

/* ---------- a compact picture of the shop ---------- */
/* Sent with each turn. Deliberately small: the whole catalogue and every order would be
   most of the context window and most of the bill, for questions that only ever concern
   what is short, what is late and what is waiting. */
function snapshot() {
  const S = window.SH;
  if (!S) return '{}';
  const st = S.state;

  const lowStock = [];
  S.PRODUCTS.forEach(p => {
    (p.sizes || []).forEach(size => {
      const per = S.BRANCHES.map(b => ({ b: b.id, n: S.stockAt(p, size, b.id) }));
      const total = per.reduce((a, x) => a + x.n, 0);
      const empty = per.filter(x => x.n === 0);
      const heavy = per.filter(x => x.n >= 4);
      // only the interesting case: dead in one store, sitting in another
      if (empty.length && heavy.length && total > 0) {
        lowStock.push({
          slug: p.slug, title: p.title, size,
          out: empty.map(x => x.b), spare: heavy.map(x => `${x.b}:${x.n}`)
        });
      }
    });
  });

  const recent = (st.orders || []).slice(0, 8).map(o => ({
    id: o.id, status: o.status, total: o.total, branch: o.branch,
    when: new Date(o.date).toISOString().slice(0, 10),
    items: o.items.map(i => `${i.slug} ${i.size} x${i.qty}`)
  }));

  const alterations = (st.alterations || []).map(a => ({
    id: a.id, customer: a.customer, garment: a.garment,
    status: a.status, promised: a.promised, branch: a.branch
  }));

  const corporate = (st.corporate || []).map(c => ({
    id: c.id, company: c.company, headcount: c.headcount,
    garment: c.garment, deadline: c.deadline, status: c.status
  }));

  const fittings = (st.appointments || []).map(f => ({
    id: f.id, name: f.name, date: f.date, time: f.time, branch: f.branch, status: f.status
  }));

  return JSON.stringify({
    today: new Date().toISOString().slice(0, 10),
    branches: S.BRANCHES.map(b => ({ id: b.id, name: b.name })),
    stockWorthMoving: lowStock.slice(0, 30),
    recentOrders: recent,
    alterations, corporate, fittings,
    sales: (st.sales || []).length
  });
}

/* ---------- boot ---------- */
async function start() {
  const cfg = window.SH_FIREBASE;
  if (!cfg || !cfg.enabled) { state.error = 'Firebase is switched off in firebase-config.js'; notify(); return; }
  if (cfg.ai === false)     { state.error = 'The assistant is switched off in firebase-config.js'; notify(); return; }

  try {
    const [{ initializeApp, getApps, getApp }, { getAI, getGenerativeModel, GoogleAIBackend }] =
      await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-ai.js')]);

    // The page already holds a compat app, but compat and ESM keep separate registries,
    // so getApp() here would not find it. A second client against the same project is
    // the least surprising fix - they do not share state and do not need to.
    const app = getApps().length ? getApp() : initializeApp(cfg.config);

    /* App Check, but ONLY if the compat side did not already do it.

       The two SDKs keep separate registries, so in principle this app needs its own
       token. In practice both providers render reCAPTCHA into the same container and the
       second one fails with "reCAPTCHA has already been rendered in this element",
       taking the first one's token down with it - which broke Firestore auth entirely.
       One attestation is worth more than two broken ones, and the compat app is the one
       carrying orders and stock.

       The cost is that AI Logic gets no App Check token, so App Check enforcement must
       stay OFF for AI Logic specifically until the assistant moves to the same SDK as
       everything else. Firestore and Authentication can be enforced normally. */
    const compatDone = window.SHAppCheck && window.SHAppCheck.status().on;
    if (cfg.appCheckSiteKey && !compatDone) {
      try {
        const ac = await import(SDK + 'firebase-app-check.js');
        const P = (cfg.appCheckProvider || 'enterprise').toLowerCase() === 'v3'
          ? ac.ReCaptchaV3Provider : ac.ReCaptchaEnterpriseProvider;
        ac.initializeAppCheck(app, {
          provider: new P(cfg.appCheckSiteKey),
          isTokenAutoRefreshEnabled: true
        });
      } catch (e) {
        // Already attested, or the provider refused. Neither is worth losing the
        // assistant over - if enforcement is on, the request will say so plainly.
        console.warn('[ai] app check: ' + (e && e.message));
      }
    }

    const ai = getAI(app, { backend: new GoogleAIBackend() });

    // Which model names a project accepts is not knowable up front - it depends on the
    // project, the region, and what Google retired this month. Rather than guess one and
    // fail, keep a list and fall through it on the first real request: constructing a
    // model never fails, only sending does.
    state.build = m => getGenerativeModel(ai, {
      model: m, tools: TOOLS, systemInstruction: SYSTEM,
      generationConfig: { temperature: 0.3, maxOutputTokens: 700 }
    });
    /* Probed against this project, August 2026. Every 2.x model is retired - the server
       says so itself: "models/gemini-2.5-flash is no longer available to new users,
       use models/gemini-3.6-flash". So the list holds only names that answered. */
    state.candidates = [cfg.aiModel, 'gemini-3.7-flash', 'gemini-3.6-flash',
                        'gemini-3.5-flash-lite', 'gemini-flash-latest']
      .filter((m, i, a) => m && a.indexOf(m) === i);
    state.modelName = state.candidates[0];
    state.model = state.build(state.modelName);

    state.ready = true; state.error = null;
  } catch (e) {
    state.error = readable(e);
  }
  notify();
}

const isQuota = e => /\[429|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(
  (e && (e.message || String(e))) || '');

/* Nothing in the SDK promises to settle. A dropped connection mid-request leaves the
   promise pending and the panel sits on "Thinking..." with no way back. */
const TIMEOUT_MS = 25000;      // one request
const BUDGET_MS = 70000;      // the whole question, across every model tried
function withTimeout(p, what) {
  let t;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(
      'Timed out after ' + (TIMEOUT_MS / 1000) + 's waiting for ' + what + '.')), TIMEOUT_MS); })
  ]);
}

// Is this "no such model" rather than something that would fail for every model?
function isModelRefused(e) {
  const m = (e && (e.message || String(e))) || '';
  // Must be about a MODEL. "not supported" on its own also matches a 400 complaining
  // about a message role, which sent the last diagnosis off after the wrong thing.
  if (!/model/i.test(m)) return false;
  return /\[404|NOT_FOUND|not found|is no longer available|is not available|unsupported|invalid model|does not exist/i.test(m);
}

function readable(e) {
  const m = (e && (e.message || String(e))) || '';
  // keep the untranslated text: a friendly message is useless when it is the wrong one
  state.lastRaw = m;

  /* Order matters, and the patterns have to be narrow. An earlier version matched on
     "firebasevertexai.googleapis.com" - which appears in the URL of EVERY error - so a
     quota refusal was reported as "the API is not switched on", and the wrong fix got
     chased for two rounds. Match on the status and the reason, never on the host. */

  const quota = m.match(/Please retry in ([\d.]+)s/);
  if (/\[429|RESOURCE_EXHAUSTED|exceeded your current quota|rate.?limit/i.test(m)) {
    const per = m.match(/limit:\s*(\d+)/);
    return 'Gemini’s free tier is used up for now' +
      (per ? ' (' + per[1] + ' requests a day for this model)' : '') + '. ' +
      (quota ? 'Try again in about ' + Math.ceil(+quota[1] / 60) + ' minute(s), or ' : '') +
      'switch aiModel in firebase-config.js to another model, or add billing in the ' +
      'Google Cloud console to raise the limit.';
  }
  if (/api-not-enabled|SERVICE_DISABLED|has not been used in project/i.test(m))
    return 'Firebase AI Logic is not switched on for this project yet. Open ' +
           'console.firebase.google.com/project/' + ((window.SH_FIREBASE || {}).config || {}).projectId +
           '/genai and click Get started, then reload.';
  if (/app-check|App Check/i.test(m))
    return 'Firebase App Check is blocking the request. Firebase console → App Check → ' +
           'register this app, or add a debug token for localhost.';
  if (isModelRefused(e)) {
    // the server usually names its own replacement - surface that rather than a guess
    const hint = m.match(/use\s+(models\/[\w.-]+)/);
    return 'This project refused: ' + (state.candidates || []).join(', ') + '.' +
           (hint ? ' The server suggests ' + hint[1].replace('models/', '') + '.' : '') +
           ' Set aiModel in firebase-config.js.';
  }
  if (/API key not valid|api-key-not-valid/i.test(m))
    return 'The Firebase config in firebase-config.js is not accepted by this project.';
  if (/\[403|PERMISSION_DENIED/.test(m))
    return 'This project is not permitted to call that model. Check Firebase console → AI Logic.';
  if (/Timed out after/i.test(m)) return m + ' Ask again.';
  if (/Failed to fetch|NetworkError|dynamically imported/i.test(m))
    return 'Could not reach the Firebase AI SDK. Check the connection.';
  return m || 'The assistant could not start.';
}

/* ---------- one turn ---------- */
/* handlers maps a function name to something that performs it locally and returns a short
   result string, which goes back to the model so it can describe what it set up. */
async function ask(history, text, handlers) {
  if (!state.ready) return { ok: false, error: state.error || 'The assistant is not ready.' };
  if (state.busy)   return { ok: false, error: 'Still working on the last question.' };
  state.busy = true; notify();
  try {
    /* Walk the candidate list until one is accepted, then stay on it for the session.
       Bounded by a wall-clock budget as well as by the list: four models each allowed a
       full timeout is over two minutes of a staff member watching "Thinking...". */
    const deadline = Date.now() + BUDGET_MS;
    let res, chat, lastErr = null;
    for (let i = Math.max(0, state.candidates.indexOf(state.modelName)); i < state.candidates.length; i++) {
      if (Date.now() > deadline) break;
      state.modelName = state.candidates[i];
      state.model = state.build(state.modelName);
      chat = state.model.startChat({ history });
      try {
        res = await withTimeout(chat.sendMessage(
          'Shop summary (live):\n' + snapshot() + '\n\nStaff member asks: ' + text), 'a reply');
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        // Fall through on a refused name, and on a quota refusal too: the free tier
        // counts 20 requests a day PER MODEL, so the next name in the list is a fresh
        // allowance rather than the same wall.
        if (/Timed out after/.test(e.message || '')) throw e;   // not a wrong name
        if (!isModelRefused(e) && !isQuota(e)) throw e;
      }
    }
    if (lastErr) throw lastErr;

    const actions = [];
    const done = [];
    /* The model may want a function, then use its result to phrase an answer. Two rounds
       bounds the cost of a turn.

       The second round is BEST EFFORT, and that matters. Some models reject the
       function-response turn outright - gemini-3.6-flash answers
       "[400] Role 'function' is not supported" - and losing the whole answer to that
       would be absurd, because by then the work has already happened: the screen is
       open, the draft is on screen. So a failed follow-up falls back to reporting what
       was actually done rather than throwing it all away. */
    for (let round = 0; round < 2; round++) {
      const calls = (res.response.functionCalls && res.response.functionCalls()) || [];
      if (!calls.length) break;
      const replies = [];
      for (const c of calls) {
        const fn = handlers[c.name];
        let out = 'That is not something I can do here.';
        if (fn) { try { out = await fn(c.args) || 'Done.'; } catch (e) { out = 'Failed: ' + e.message; } }
        actions.push({ name: c.name, args: c.args });
        done.push(out);
        replies.push({ functionResponse: { name: c.name, response: { result: out } } });
      }
      try {
        res = await withTimeout(chat.sendMessage(replies), 'the follow-up');
      } catch (e) {
        state.lastRaw = (e && e.message) || String(e);
        /* Some models reject a function-response turn outright - gemini-3.6-flash says
           "[400] Role 'function' is not supported". The results are still worth handing
           back, so say the same thing as an ordinary user turn, which every model
           accepts. Only if THAT fails do we fall back to reporting the bare outcomes. */
        try {
          res = await withTimeout(chat.sendMessage(
            'Those actions are done. Results: ' +
            actions.map((a, i) => a.name + ' -> ' + done[i]).join('; ') +
            '. Tell the staff member briefly what is now in front of them. ' +
            'Do not call another function.'), 'the follow-up');
        } catch (e2) {
          state.lastRaw = (e2 && e2.message) || String(e2);
          return { ok: true, text: done.join(' '), actions, partial: true };
        }
      }
    }
    return { ok: true, text: res.response.text(), actions };
  } catch (e) {
    return { ok: false, error: readable(e) };
  } finally {
    state.busy = false; notify();
  }
}

window.SHAI = {
  start, ask,
  status: () => ({ ...state }),
  onStatus(fn) { listeners.push(fn); fn({ ...state }); }
};
start();
