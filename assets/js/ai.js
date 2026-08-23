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
const SDK = 'https://www.gstatic.com/firebasejs/12.3.0/';

const state = { ready: false, error: null, model: null, busy: false };
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
    const ai = getAI(app, { backend: new GoogleAIBackend() });

    const wanted = cfg.aiModel || 'gemini-2.5-flash';
    const build = m => getGenerativeModel(ai, {
      model: m, tools: TOOLS, systemInstruction: SYSTEM,
      generationConfig: { temperature: 0.3, maxOutputTokens: 700 }
    });
    try { state.model = build(wanted); }
    catch (e) { state.model = build('gemini-3.7-flash'); }

    state.ready = true; state.error = null;
  } catch (e) {
    state.error = readable(e);
  }
  notify();
}

function readable(e) {
  const m = (e && (e.message || String(e))) || '';
  if (/app-check|App Check/i.test(m))
    return 'Firebase App Check is blocking the request. Firebase console → App Check → ' +
           'register this app (reCAPTCHA Enterprise for web), or add a debug token for localhost.';
  if (/API key not valid|api-key/i.test(m))
    return 'The Firebase config in firebase-config.js is not accepted by this project.';
  if (/not found|404|model/i.test(m) && /model/i.test(m))
    return 'That Gemini model name was refused. Set aiModel in firebase-config.js to one this project can use.';
  if (/api-not-enabled|firebasevertexai\.googleapis\.com|PERMISSION_DENIED|403/.test(m))
    return 'Firebase AI Logic is not switched on for this project yet. Open ' +
           'console.firebase.google.com/project/' + ((window.SH_FIREBASE || {}).config || {}).projectId +
           '/genai and click Get started, then reload. It can take a couple of minutes to propagate.';
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
    const chat = state.model.startChat({ history });
    let res = await chat.sendMessage(
      'Shop summary (live):\n' + snapshot() + '\n\nStaff member asks: ' + text);

    const actions = [];
    // The model may want a function, then use its result to answer. Two rounds is
    // plenty for this and bounds the cost of a turn.
    for (let round = 0; round < 2; round++) {
      const calls = (res.response.functionCalls && res.response.functionCalls()) || [];
      if (!calls.length) break;
      const replies = [];
      for (const c of calls) {
        const fn = handlers[c.name];
        let out = 'That is not something I can do here.';
        if (fn) { try { out = await fn(c.args) || 'Done.'; } catch (e) { out = 'Failed: ' + e.message; } }
        actions.push({ name: c.name, args: c.args });
        replies.push({ functionResponse: { name: c.name, response: { result: out } } });
      }
      res = await chat.sendMessage(replies);
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
