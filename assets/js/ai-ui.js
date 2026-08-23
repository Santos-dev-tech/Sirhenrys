/* ---------------------------------------------------------------------------
   The assistant's panel, and the handlers for the three things it may do.

   This file is where "propose, do not commit" is actually enforced. ai.js declares the
   functions to the model; nothing here writes to stock, orders or payments. openScreen
   navigates. proposeTransfer and draftMessage put a card in the log with a button on it,
   and the button is the human's.

   Plain script, not a module: it only needs window.SHAI, which ai.js sets, and keeping
   it non-module means it loads and parses in the normal order with everything else.
--------------------------------------------------------------------------- */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  let panel, log, input, form, fab, stateEl, sugg;
  let history = [];
  let pending = null;          // a proposal waiting for a person

  const SUGGESTIONS = [
    'What should I move between branches this week?',
    'Which alterations are due or overdue?',
    'Draft a reply to the Sidian Bank enquiry',
    'What sold recently and where?'
  ];

  function ready() {
    panel = $('aiPanel'); log = $('aiLog'); input = $('aiInput');
    form = $('aiForm'); fab = $('aiFab'); stateEl = $('aiState'); sugg = $('aiSugg');
    if (!panel || !window.SHAI) return false;
    return true;
  }

  function say(cls, text) {
    const d = document.createElement('div');
    d.className = 'ai-msg ' + cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function note(text) {
    const d = document.createElement('div');
    d.className = 'ai-did';
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  /* ---- a proposal, with the commit button belonging to the human ---- */
  function card(title, lines, actionLabel, onAct) {
    const d = document.createElement('div');
    d.className = 'ai-did';
    d.innerHTML = '<b>' + title + '</b><br>' + lines.map(l =>
      String(l).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))).join('<br>');
    if (actionLabel) {
      const b = document.createElement('button');
      b.className = 'btn sm';
      b.style.marginTop = '10px';
      b.textContent = actionLabel;
      b.onclick = () => { onAct(); b.disabled = true; b.textContent = 'Done'; };
      d.appendChild(b);
    }
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  /* ---- what the model is allowed to actually do ---- */
  const handlers = {
    openScreen(a) {
      const ok = (SH.ROLE_VIEWS[(SH.state.staff || {}).role] || []);
      if (!ok.includes(a.screen)) return 'That screen is not open to this account.';
      location.hash = '#/admin/' + a.screen;
      note('Opened ' + a.screen + '.');
      return 'Opened the ' + a.screen + ' screen.';
    },

    proposeTransfer(a) {
      const p = SH.byId(a.slug);
      if (!p) return 'No such product: ' + a.slug;
      const nameOf = id => (SH.BRANCHES.find(b => b.id === id) || {}).name || id;
      const have = SH.stockAt(p, a.size, a.from);
      if (have < a.qty) return 'Only ' + have + ' in ' + nameOf(a.from) + ', so that move is not possible.';

      pending = a;
      card('Suggested transfer',
        [p.title,
         'Size ' + a.size + ' — ' + a.qty + ' unit' + (a.qty > 1 ? 's' : ''),
         nameOf(a.from) + ' → ' + nameOf(a.to),
         a.reason],
        'Apply this transfer',
        () => {
          // The only write in this file, and it happens on a click, never on a model turn.
          SH.adjustStock(p.slug, a.size, a.from, -a.qty);
          SH.adjustStock(p.slug, a.size, a.to, +a.qty);
          note('Transfer applied. Stock updated at both branches.');
        });
      return 'Drafted the transfer and put it in front of the user to confirm.';
    },

    draftMessage(a) {
      card('Draft — ' + (a.subject || 'message') + (a.to ? ' to ' + a.to : ''),
        [a.body],
        'Copy',
        () => { try { navigator.clipboard.writeText(a.body); } catch (e) {} });
      return 'Drafted the message for the user to review and send.';
    }
  };

  async function send(text) {
    if (!text.trim()) return;
    say('me', text);
    input.value = '';
    const thinking = say('it', 'Thinking...');

    const r = await SHAI.ask(history, text, handlers);
    thinking.remove();

    if (!r.ok) { say('err', r.error); return; }
    say('it', r.text || 'Done.');
    history.push({ role: 'user', parts: [{ text }] });
    history.push({ role: 'model', parts: [{ text: r.text || '' }] });
    if (history.length > 12) history = history.slice(-12);   // keep the bill bounded
  }

  function paintState(s) {
    if (!stateEl) return;
    stateEl.classList.remove('on', 'bad');
    if (s.busy) { stateEl.textContent = 'thinking'; return; }
    if (s.ready) { stateEl.textContent = 'ready'; stateEl.classList.add('on'); return; }
    stateEl.textContent = s.error ? 'unavailable' : 'starting';
    if (s.error) stateEl.classList.add('bad');
  }

  function open() {
    panel.hidden = false;
    if (!log.childElementCount) {
      const s = SHAI.status();
      if (s.error) say('err', s.error);
      else say('it', "Ask me about stock, orders, alterations or a corporate enquiry. " +
                     "I can open a screen or draft something for you - you decide whether it happens.");
    }
    input.focus();
  }
  function close() { panel.hidden = true; }

  function boot() {
    if (!ready()) return;
    SHAI.onStatus(paintState);

    SUGGESTIONS.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t;
      b.onclick = () => { open(); send(t); };
      sugg.appendChild(b);
    });

    fab.onclick = open;
    $('aiClose').onclick = close;
    form.onsubmit = e => { e.preventDefault(); send(input.value); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });

    // The launcher belongs to the console. .ad-showing is set by the router, so the
    // storefront can never surface a staff tool even though both share this document.
    const sync = () => {
      const onAdmin = /^#\/admin(\/|\?|$)/.test(location.hash);
      document.body.classList.toggle('ad-showing', onAdmin);
      if (!onAdmin) close();
    };
    addEventListener('hashchange', sync);
    sync();
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
  else boot();
})();
