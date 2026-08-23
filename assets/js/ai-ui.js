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

  /* Every element is looked up when it is needed, never cached. The login gate replaces
     the whole console with AD.innerHTML = ..., and signing in puts it back - so any
     reference held across that is stale, and any handler bound to it is lost. Lazy
     lookups plus delegated clicks survive it. */
  const $ = id => document.getElementById(id);
  const panelEl = () => $('aiPanel');
  const logEl   = () => $('aiLog');
  let history = [];
  let pending = null;          // a proposal waiting for a person

  const SUGGESTIONS = [
    'What should I move between branches this week?',
    'Which alterations are due or overdue?',
    'Draft a reply to the Sidian Bank enquiry',
    'What sold recently and where?'
  ];

  function say(cls, text) {
    const log = logEl(); if (!log) return { remove() {} };
    const d = document.createElement('div');
    d.className = 'ai-msg ' + cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function note(text) {
    const log = logEl(); if (!log) return;
    const d = document.createElement('div');
    d.className = 'ai-did';
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  /* ---- a proposal, with the commit button belonging to the human ---- */
  function card(title, lines, actionLabel, onAct) {
    const log = logEl(); if (!log) return;
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
    const input = $('aiInput'); if (input) input.value = '';
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
    const stateEl = $('aiState');
    if (!stateEl) return;
    stateEl.classList.remove('on', 'bad');
    if (s.busy) { stateEl.textContent = 'thinking'; return; }
    if (s.ready) { stateEl.textContent = 'ready'; stateEl.classList.add('on'); return; }
    stateEl.textContent = s.error ? 'unavailable' : 'starting';
    if (s.error) stateEl.classList.add('bad');
  }

  function open() {
    const panel = panelEl(); if (!panel) return;
    panel.hidden = false;
    fillSuggestions();
    const log = logEl();
    if (log && !log.childElementCount) {
      const s = SHAI.status();
      if (s.error) say('err', s.error);
      else say('it', "Ask me about stock, orders, alterations or a corporate enquiry. " +
                     "I can open a screen or draft something for you - you decide whether it happens.");
    }
    const input = $('aiInput'); if (input) input.focus();
  }
  function close() { const p = panelEl(); if (p) p.hidden = true; }

  function fillSuggestions() {
    const sugg = $('aiSugg');
    if (!sugg || sugg.childElementCount) return;
    SUGGESTIONS.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t; b.dataset.aisugg = t;
      sugg.appendChild(b);
    });
  }

  function boot() {
    if (!window.SHAI) return;
    SHAI.onStatus(paintState);
    fillSuggestions();

    // Delegated, so none of this breaks when the login gate rebuilds the console.
    document.addEventListener('click', e => {
      if (e.target.closest('#aiFab'))   { open(); return; }
      if (e.target.closest('#aiClose')) { close(); return; }
      const sg = e.target.closest('[data-aisugg]');
      if (sg) { open(); send(sg.dataset.aisugg); }
    });
    document.addEventListener('submit', e => {
      if (!e.target.closest('#aiForm')) return;
      e.preventDefault();
      const input = $('aiInput');
      send(input ? input.value : '');
    });
    document.addEventListener('keydown', e => {
      const p = panelEl();
      if (e.key === 'Escape' && p && !p.hidden) close();
    });

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
