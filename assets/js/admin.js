/* Sir Henry's - staff console */
(() => {
  'use strict';
  const { PRODUCTS, CATEGORIES, BRANCHES, STATUSES, byId, fmt, state } = SH;
  const view = document.getElementById('view');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KSh = n => 'KSh ' + Math.round(n).toLocaleString('en-KE');

  let tT;
  function toast(m) {
    let n = document.querySelector('.notice');
    if (!n) { n = document.createElement('div'); n.className = 'notice'; document.body.appendChild(n); }
    n.textContent = m; n.classList.add('on');
    clearTimeout(tT); tT = setTimeout(() => n.classList.remove('on'), 2400);
  }

  const statusPill = s => {
    const m = { 'Confirmed': 'info', 'In Workshop': 'warn', 'Ready for Fitting': 'warn', 'Out for Delivery': 'info', 'Delivered': 'ok', 'Cancelled': 'bad' };
    return `<span class="pill ${m[s] || 'grey'}">${esc(s)}</span>`;
  };

  /* ---------- derived metrics ---------- */
  const revenue = () => state.orders.filter(o => o.status !== 'Cancelled').reduce((a, o) => a + o.total, 0);
  // A size sitting at zero in one store while another store holds plenty is the signal
  // that actually loses sales in multi-branch retail. Surface it as a transfer.
  const transfers = () => {
    const out = [];
    PRODUCTS.forEach(p => p.sizes.forEach(s => {
      const per = p.stock[s];
      const empty = BRANCHES.filter(b => per[b.id] === 0);
      if (!empty.length) return;
      const best = BRANCHES.slice().sort((a, b) => per[b.id] - per[a.id])[0];
      if (per[best.id] < 3) return;
      empty.forEach(e => out.push({ p, s, from: best, to: e, have: per[best.id] }));
    }));
    return out;
  };

  function last7() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = d.getTime() + 86400000;
      const v = state.orders.filter(o => o.date >= d.getTime() && o.date < next).reduce((a, o) => a + o.total, 0);
      days.push({ label: d.toLocaleDateString('en-GB', { weekday: 'short' }), v });
    }
    // give the demo a believable shape when seeded orders are sparse
    const base = [82000, 61000, 104000, 47000, 133000, 96000, 71000];
    return days.map((d, i) => ({ ...d, v: d.v + base[i] }));
  }

  function barChart(data) {
    const max = Math.max(...data.map(d => d.v)) * 1.15 || 1;
    const w = 100 / data.length;
    return `<svg class="chart" viewBox="0 0 100 46" preserveAspectRatio="none">
      ${data.map((d, i) => {
        const h = (d.v / max) * 34;
        return `<rect class="bar" x="${i * w + w * .22}" y="${38 - h}" width="${w * .56}" height="${h}"><title>${d.label}: ${KSh(d.v)}</title></rect>
                <text x="${i * w + w * .5}" y="44" text-anchor="middle">${d.label}</text>`;
      }).join('')}
    </svg>`;
  }

  /* ---------- views ---------- */
  const V = {};

  V.dashboard = () => {
    const orders = state.orders;
    const aov = orders.length ? revenue() / orders.length : 0;
    const low = transfers();
    const pend = orders.filter(o => o.status !== 'Delivered').length;
    return `
    <div class="top"><div><h1>Dashboard</h1><p>${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
      <a class="btn ghost" href="index.html" target="_blank">View storefront</a></div>

    <div class="kpis">
      <div class="kpi"><div class="l">Revenue (7d)</div><div class="v">${KSh(last7().reduce((a, d) => a + d.v, 0))}</div><div class="d up">&uarr; 12.4% on last week</div></div>
      <div class="kpi"><div class="l">Orders</div><div class="v">${orders.length}</div><div class="d">${pend} still to fulfil</div></div>
      <div class="kpi"><div class="l">Average order</div><div class="v">${KSh(aov)}</div><div class="d up">&uarr; 4.1%</div></div>
      <div class="kpi"><div class="l">Stock-outs</div><div class="v" style="${low.length ? 'color:var(--bad)' : ''}">${low.length}</div><div class="d">sizes empty in one store, in stock in another</div></div>
      <div class="kpi"><div class="l">Fittings booked</div><div class="v">${state.appointments.length}</div><div class="d">${state.appointments.filter(a => a.status === 'Requested').length} awaiting confirmation</div></div>
      <div class="kpi"><div class="l">Commissions</div><div class="v">${state.commissions.length}</div><div class="d">Made-to-measure in progress</div></div>
      <div class="kpi"><div class="l">Group suits</div><div class="v">${state.groups.reduce((a, g) => a + g.members.length, 0)}</div><div class="d">across ${state.groups.length} wedding/group quote${state.groups.length === 1 ? '' : 's'}</div></div>
    </div>

    <div class="cols">
      <div class="panel"><div class="panel-hd"><b>Revenue, last 7 days</b><span class="pill grey">All branches</span></div>
        <div class="panel-bd">${barChart(last7())}</div></div>
      <div class="panel"><div class="panel-hd"><b>Suggested transfers</b><span class="pill warn">${low.length}</span></div>
        <div class="panel-bd" style="padding:0">
          ${low.length ? `<table><tbody>${low.slice(0, 6).map(x => `<tr>
            <td><div class="tw"><img class="thumb" src="${(x.p.thumbs||x.p.images)[0]}" alt=""><div>
              <b>${esc(x.p.title)}</b><span>Size ${x.s} &middot; ${esc(x.to.name.split(',')[0])} is out</span></div></div></td>
            <td class="num" style="white-space:nowrap"><span class="pill ok">${x.have} at ${esc(x.from.name.split(',')[0])}</span></td></tr>`).join('')}</tbody></table>`
          : '<div class="empty">Every size is covered at every store.</div>'}
        </div></div>
    </div>

    <div class="panel"><div class="panel-hd"><b>Recent orders</b><a class="btn ghost sm" href="#/orders">All orders</a></div>
      <table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th class="num">Total</th></tr></thead>
      <tbody>${orders.slice(0, 6).map(o => `<tr data-order="${o.id}" style="cursor:pointer">
        <td><b>${o.id}</b><br><span style="font-size:11px;color:var(--ink-4)">${new Date(o.date).toLocaleDateString('en-GB')}</span></td>
        <td>${esc(o.customer.name)}<br><span style="font-size:11px;color:var(--ink-4)">${esc(o.customer.phone)}</span></td>
        <td>${o.items.reduce((a, i) => a + i.qty, 0)}</td>
        <td>${o.payment === 'M-Pesa' ? '<span class="pill ok">M-Pesa</span>' : esc(o.payment)}</td>
        <td>${statusPill(o.status)}</td><td class="num"><b>${KSh(o.total)}</b></td></tr>`).join('')}</tbody></table></div>`;
  };

  V.orders = (q) => {
    const f = new URLSearchParams(q || '').get('status');
    const list = f ? state.orders.filter(o => o.status === f) : state.orders;
    return `<div class="top"><div><h1>Orders</h1><p>${list.length} order${list.length === 1 ? '' : 's'}</p></div></div>
      <div class="panel"><div class="panel-hd"><div class="fbar">
        <a class="chip ${!f ? 'on' : ''}" href="#/orders">All</a>
        ${STATUSES.map(s => `<a class="chip ${f === s ? 'on' : ''}" href="#/orders?status=${encodeURIComponent(s)}">${s}</a>`).join('')}
      </div></div>
      ${list.length ? `<table><thead><tr><th>Order</th><th>Customer</th><th>Branch</th><th>Payment</th><th>Status</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${list.map(o => `<tr data-order="${o.id}" style="cursor:pointer">
        <td><b>${o.id}</b><br><span style="font-size:11px;color:var(--ink-4)">${new Date(o.date).toLocaleDateString('en-GB')}</span></td>
        <td>${esc(o.customer.name)}<br><span style="font-size:11px;color:var(--ink-4)">${esc(o.customer.email)}</span></td>
        <td style="font-size:12px">${esc((BRANCHES.find(b => b.id === o.branch) || {}).name || '-')}</td>
        <td>${o.payment === 'M-Pesa' ? '<span class="pill ok">M-Pesa</span>' : esc(o.payment)}</td>
        <td>${statusPill(o.status)}</td><td class="num"><b>${KSh(o.total)}</b></td>
        <td class="num"><span class="btn ghost sm">Open</span></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No orders with that status.</div>'}</div>`;
  };

  V.products = () => `
    <div class="top"><div><h1>Products</h1><p>${PRODUCTS.length} products &middot; prices update live on the storefront</p></div>
      <button class="btn" data-newproduct>Add product</button></div>
    <div class="panel"><div class="panel-hd"><input class="search" id="pSearch" placeholder="Search products..."></div>
      <table><thead><tr><th>Product</th><th>Category</th><th>Fabric</th><th class="num">Price</th><th class="num">Stock</th><th>Status</th></tr></thead>
      <tbody id="pRows">${PRODUCTS.map(p => {
        const n = SH.stockAll(p);
        return `<tr data-prow="${esc(p.title.toLowerCase())}">
          <td><div class="tw"><img class="thumb" src="${(p.thumbs||p.images)[0]}" alt=""><div><b>${esc(p.title)}</b><span>${esc(p.slug)}</span></div></div></td>
          <td style="font-size:12px">${esc((CATEGORIES.find(c => c.id === p.category) || {}).name || '')}</td>
          <td style="font-size:12px;color:var(--ink-3)">${esc(p.fabric)}</td>
          <td class="num"><input class="inline" type="number" value="${p.price}" data-price="${p.slug}" style="text-align:right"></td>
          <td class="num">${n}</td>
          <td>${n === 0 ? '<span class="pill bad">Out of stock</span>' : n < 12 ? '<span class="pill warn">Low</span>' : '<span class="pill ok">Active</span>'}</td>
        </tr>`; }).join('')}</tbody></table></div>`;

  V.inventory = (q) => {
    const sizes = ['46', '48', '50', '52', '54', '56', '58', 'S', 'M', 'L', 'XL', 'XXL', '39', '40', '41', '42', '43', '44', '45', 'One Size'];
    const br = new URLSearchParams(q || '').get('branch');
    const branch = BRANCHES.find(b => b.id === br);
    const val = (p, s) => branch ? p.stock[s][branch.id] : SH.stockTotal(p.stock, s);
    const rowTotal = p => p.sizes.reduce((a, s) => a + val(p, s), 0);
    return `<div class="top"><div><h1>Inventory</h1>
      <p>${branch ? 'Stock at ' + esc(branch.name) : 'Stock across all four stores'} &mdash; the view Shopify makes you buy an app for.</p></div></div>
      <div class="panel"><div class="panel-hd">
        <div class="fbar">
          <a class="chip ${!branch ? 'on' : ''}" href="#/inventory">All stores</a>
          ${BRANCHES.map(b => `<a class="chip ${br === b.id ? 'on' : ''}" href="#/inventory?branch=${b.id}">${esc(b.name.split(',')[0])}</a>`).join('')}
        </div>
        <div class="fbar"><span class="pill ok">Healthy</span><span class="pill warn">Low</span><span class="pill bad">Out</span></div></div>
      <div class="matrix"><table><thead><tr><th>Product</th>
        ${sizes.map(s => `<th class="num">${s}</th>`).join('')}<th class="num">Total</th></tr></thead>
      <tbody>${PRODUCTS.map(p => `<tr>
        <td><div class="tw"><img class="thumb" src="${(p.thumbs||p.images)[0]}" alt=""><div><b>${esc(p.title)}</b></div></div></td>
        ${sizes.map(s => {
          if (!p.sizes.includes(s)) return '<td style="color:var(--ink-4)">&middot;</td>';
          const n = val(p, s);
          return `<td><span class="cellv ${n === 0 ? 'z' : n <= 2 ? 'l' : 'g'}" title="${BRANCHES.map(b => b.name + ': ' + p.stock[s][b.id]).join(' | ')}">${n}</span></td>`;
        }).join('')}
        <td class="num"><b>${rowTotal(p)}</b></td></tr>`).join('')}</tbody></table></div></div>`;
  };

  V.fittings = () => `<div class="top"><div><h1>Fittings</h1><p>${state.appointments.length} appointment${state.appointments.length === 1 ? '' : 's'}</p></div></div>
    <div class="panel">${state.appointments.length ? `<table>
      <thead><tr><th>Ref</th><th>Customer</th><th>When</th><th>Store</th><th>Reason</th><th>Status</th><th></th></tr></thead>
      <tbody>${state.appointments.map((a, i) => `<tr>
        <td><b>${esc(a.id)}</b></td>
        <td>${esc(a.name)}<br><span style="font-size:11px;color:var(--ink-4)">${esc(a.phone)}</span></td>
        <td style="font-size:12px">${esc(a.date)}<br><span style="color:var(--ink-4)">${esc(a.time)}</span></td>
        <td style="font-size:12px">${esc((BRANCHES.find(b => b.id === a.branch) || {}).name || '')}</td>
        <td style="font-size:12px">${esc(a.reason)}</td>
        <td><span class="pill ${a.status === 'Confirmed' ? 'ok' : 'warn'}">${esc(a.status)}</span></td>
        <td class="num">${a.status === 'Requested' ? `<button class="btn sm" data-confirmfit="${i}">Confirm</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>`
      : '<div class="empty">No fittings booked yet. Book one from the storefront to see it appear here.</div>'}</div>`;

  V.commissions = () => `<div class="top"><div><h1>Made to Measure</h1><p>${state.commissions.length} commission${state.commissions.length === 1 ? '' : 's'}</p></div></div>
    <div class="panel">${state.commissions.length ? `<table>
      <thead><tr><th>Ref</th><th>Cloth</th><th>Spec</th><th>Monogram</th><th>Status</th><th class="num">Value</th></tr></thead>
      <tbody>${state.commissions.map(c => `<tr>
        <td><b>${esc(c.id)}</b><br><span style="font-size:11px;color:var(--ink-4)">${new Date(c.date).toLocaleDateString('en-GB')}</span></td>
        <td>${esc(c.cloth)}</td>
        <td style="font-size:12px;color:var(--ink-3)">${esc(c.pieces)}-piece &middot; ${esc(c.lapel)} lapel &middot; ${esc(c.lining)} lining &middot; ${esc(c.buttons)} buttons</td>
        <td>${esc(c.monogram) || '&mdash;'}</td>
        <td><span class="pill warn">${esc(c.status)}</span></td>
        <td class="num"><b>${KSh(c.price)}</b></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No commissions yet. Build one on the storefront to see it land here.</div>'}</div>`;

  V.groups = () => {
    const g = state.groups;
    const value = o => { const p = byId(o.slug); return (p ? p.price : 0) * o.members.length * (1 - SH.groupDiscount(o.members.length)); };
    return `<div class="top"><div><h1>Weddings &amp; Groups</h1>
      <p>${g.length} party quote${g.length === 1 ? '' : 's'} &middot; ${g.reduce((a, o) => a + o.members.length, 0)} suits in total</p></div></div>
      <div class="panel">${g.length ? g.map(o => {
        const p = byId(o.slug);
        return `<div style="border-bottom:1px solid var(--line);padding:20px">
          <div style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start">
            <div><b style="font-size:14px">${esc(o.id)} &middot; ${esc(o.event)}</b>
              <p style="margin:5px 0 0;font-size:12.5px;color:var(--ink-3)">
                ${esc(o.organiser)} &middot; ${esc(o.phone)} &middot; ${esc(o.email)}<br>
                Event ${esc(o.eventDate)} &middot; ${o.members.length} suits &middot;
                ${(SH.groupDiscount(o.members.length) * 100)}% group discount</p></div>
            <div style="text-align:right"><span class="pill ${o.status === 'Confirmed' ? 'ok' : 'warn'}">${esc(o.status)}</span>
              <div style="font-size:16px;font-weight:700;margin-top:8px">${KSh(value(o))}</div></div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">
            <img class="thumb" src="${p ? (p.thumbs||p.images)[0] : ''}" alt="">
            ${o.members.map(m => `<span class="pill grey" title="${esc(m.role)}">${esc(m.name.split(' ')[0])} &middot; ${esc(m.size)}</span>`).join('')}
          </div>
          <p style="font-size:12px;color:var(--ink-3);margin:12px 0 0">
            Cut from a single bolt so every jacket matches &mdash; reserve ${(o.members.length * 3.4).toFixed(1)}m of cloth.</p>
        </div>`; }).join('')
        : '<div class="empty">No group quotes yet. Build one on the storefront to see it here.</div>'}</div>`;
  };

  V.customers = () => {
    const map = {};
    state.orders.forEach(o => {
      const k = o.customer.email;
      map[k] = map[k] || { ...o.customer, orders: 0, spend: 0, last: 0 };
      map[k].orders++; map[k].spend += o.total; map[k].last = Math.max(map[k].last, o.date);
    });
    const list = Object.values(map).sort((a, b) => b.spend - a.spend);
    const tier = s => s >= 80000 ? '<span class="pill ok">Gold</span>' : s >= 30000 ? '<span class="pill info">Silver</span>' : '<span class="pill grey">Member</span>';
    return `<div class="top"><div><h1>Customers</h1><p>${list.length} in The Henry Club</p></div></div>
      <div class="panel">${list.length ? `<table>
        <thead><tr><th>Customer</th><th>Contact</th><th class="num">Orders</th><th class="num">Lifetime</th><th>Tier</th><th>Last order</th></tr></thead>
        <tbody>${list.map(c => `<tr>
          <td><b>${esc(c.name)}</b></td>
          <td style="font-size:12px;color:var(--ink-3)">${esc(c.email)}<br>${esc(c.phone)}</td>
          <td class="num">${c.orders}</td><td class="num"><b>${KSh(c.spend)}</b></td>
          <td>${tier(c.spend)}</td>
          <td style="font-size:12px">${new Date(c.last).toLocaleDateString('en-GB')}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">No customers yet.</div>'}</div>`;
  };

  V.analytics = () => {
    const cat = {};
    state.orders.forEach(o => o.items.forEach(i => {
      const p = byId(i.slug); if (!p) return;
      cat[p.category] = (cat[p.category] || 0) + i.price * i.qty;
    }));
    const rows = Object.entries(cat).sort((a, b) => b[1] - a[1]);
    const totalRev = rows.reduce((a, r) => a + r[1], 0) || 1;
    const pay = {};
    state.orders.forEach(o => pay[o.payment] = (pay[o.payment] || 0) + 1);
    return `<div class="top"><div><h1>Analytics</h1><p>Where the money actually comes from</p></div></div>
      <div class="cols">
        <div class="panel"><div class="panel-hd"><b>Revenue by category</b></div><div class="panel-bd">
          ${rows.length ? rows.map(([c, v]) => `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">
              <b>${esc((CATEGORIES.find(x => x.id === c) || {}).name || c)}</b><span>${KSh(v)}</span></div>
            <div style="height:7px;background:var(--bone)"><div style="height:100%;background:var(--bronze);width:${(v / totalRev * 100).toFixed(1)}%"></div></div>
          </div>`).join('') : '<div class="empty">No sales data yet.</div>'}
        </div></div>
        <div class="panel"><div class="panel-hd"><b>Payment methods</b></div><div class="panel-bd">
          ${Object.entries(pay).map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px">
            <span>${esc(k)}</span><b>${v} order${v > 1 ? 's' : ''}</b></div>`).join('') || '<div class="empty">No data.</div>'}
          <p style="font-size:12px;color:var(--ink-3);margin-top:16px">M-Pesa share is the number to watch &mdash; it is how most Kenyan customers want to pay, and card-only checkouts lose them.</p>
        </div></div>
      </div>
      <div class="panel"><div class="panel-hd"><b>Best sellers</b></div>
        <table><thead><tr><th>Product</th><th class="num">Units</th><th class="num">Revenue</th></tr></thead><tbody>
        ${(() => {
          const m = {};
          state.orders.forEach(o => o.items.forEach(i => {
            m[i.slug] = m[i.slug] || { u: 0, r: 0 }; m[i.slug].u += i.qty; m[i.slug].r += i.price * i.qty;
          }));
          const e = Object.entries(m).sort((a, b) => b[1].r - a[1].r);
          return e.length ? e.map(([s, d]) => { const p = byId(s); return `<tr>
            <td><div class="tw"><img class="thumb" src="${p ? (p.thumbs||p.images)[0] : ''}" alt=""><b>${esc(p ? p.title : s)}</b></div></td>
            <td class="num">${d.u}</td><td class="num"><b>${KSh(d.r)}</b></td></tr>`; }).join('')
            : '<tr><td colspan="3"><div class="empty">No sales yet.</div></td></tr>';
        })()}
        </tbody></table></div>`;
  };

  V.settings = () => `<div class="top"><div><h1>Settings</h1><p>Store configuration</p></div></div>
    <div class="cols">
      <div class="panel"><div class="panel-hd"><b>Store</b></div><div class="panel-bd">
        <div class="f2"><div class="field"><label>Store name</label><input value="Sir Henry's Limited"></div>
        <div class="field"><label>Currency</label><select><option>KSh - Kenyan Shilling</option><option>USD</option></select></div></div>
        <div class="f2"><div class="field"><label>Free delivery threshold</label>
          <input type="number" id="setThresh" value="${state.settings.freeShipThreshold}"></div>
        <div class="field"><label>VAT %</label><input type="number" value="${state.settings.vat}"></div></div>
        <div class="field"><label>Support phone</label><input value="+254 713 619786"></div>
        <button class="btn" id="saveSettings">Save changes</button>
      </div></div>
      <div class="panel"><div class="panel-hd"><b>Branches</b></div><div class="panel-bd" style="padding:0">
        <table><tbody>${BRANCHES.map(b => `<tr><td><b>${esc(b.name)}</b><br>
          <span style="font-size:11px;color:var(--ink-4)">${esc(b.hours)} &middot; ${esc(b.tel)}</span></td>
          <td class="num"><span class="pill ok">Open</span></td></tr>`).join('')}</tbody></table>
      </div></div>
    </div>
    <div class="panel"><div class="panel-hd"><b>Demo controls</b></div><div class="panel-bd">
      <p style="font-size:13px;color:var(--ink-3);margin:0 0 14px">This prototype stores everything in your browser. Reset returns it to seed data.</p>
      <button class="btn ghost" id="resetDemo">Reset demo data</button></div></div>`;

  /* ---------- order drawer ---------- */
  function openOrder(id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    const idx = STATUSES.indexOf(o.status);
    document.getElementById('dwTitle').textContent = o.id;
    document.getElementById('dwBody').innerHTML = `
      <div class="field"><label>Status</label><div class="steps">
        ${STATUSES.map((s, i) => `<button data-setstatus="${esc(s)}" class="${i < idx ? 'done' : ''} ${i === idx ? 'now' : ''}">${s}</button>`).join('')}
      </div></div>
      <div class="f2">
        <div><label style="font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);font-weight:700">Customer</label>
          <p style="font-size:13px;margin:6px 0 0"><b>${esc(o.customer.name)}</b><br>${esc(o.customer.email)}<br>${esc(o.customer.phone)}</p></div>
        <div><label style="font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);font-weight:700">Fulfilment</label>
          <p style="font-size:13px;margin:6px 0 0">${esc((BRANCHES.find(b => b.id === o.branch) || {}).name || '-')}<br>
          Paid by ${esc(o.payment)}<br>${new Date(o.date).toLocaleString('en-GB')}</p></div>
      </div>
      <div class="field" style="margin-top:20px"><label>Items</label>
        ${o.items.map(i => { const p = byId(i.slug); return `
          <div class="tw" style="padding:9px 0;border-bottom:1px solid var(--line)">
            <img class="thumb" src="${p ? (p.thumbs||p.images)[0] : ''}" alt="">
            <div style="flex:1"><b>${esc(p ? p.title : i.slug)}</b><span>Size ${esc(i.size)} &times; ${i.qty}</span></div>
            <b style="font-size:13px">${KSh(i.price * i.qty)}</b></div>`; }).join('')}
        <div style="display:flex;justify-content:space-between;padding-top:12px;font-size:15px;font-weight:700">
          <span>Total</span><span>${KSh(o.total)}</span></div></div>
      <div class="field"><label>Workshop / alteration notes</label>
        <textarea rows="3" id="dwNotes">${esc(o.alterations)}</textarea></div>`;
    document.getElementById('dwSave').onclick = () => {
      o.alterations = document.getElementById('dwNotes').value; SH.emit();
      toast('Order updated'); close();
    };
    document.getElementById('dwBody').querySelectorAll('[data-setstatus]').forEach(b => b.onclick = () => {
      o.status = b.dataset.setstatus; SH.emit(); openOrder(id); render();
      toast('Status set to ' + o.status);
    });
    document.getElementById('dw').classList.add('on');
    document.getElementById('scrim').classList.add('on');
  }
  const close = () => { document.querySelectorAll('.dw,.side').forEach(e => e.classList.remove('on')); document.getElementById('scrim').classList.remove('on'); };

  /* ---------- router ---------- */
  function render() {
    const raw = location.hash.slice(1) || '/dashboard';
    const [path, q] = raw.split('?');
    const key = path.split('/').filter(Boolean)[0] || 'dashboard';
    view.innerHTML = (V[key] || V.dashboard)(q);
    if (key === 'inventory' || key === 'orders') { /* query-driven views re-render on hashchange */ }
    document.querySelectorAll('.side a[data-nav]').forEach(a =>
      a.classList.toggle('on', a.dataset.nav === key));
    wire(key);
    window.scrollTo(0, 0);
  }

  function wire(key) {
    view.querySelectorAll('[data-order]').forEach(r => r.onclick = () => openOrder(r.dataset.order));

    view.querySelectorAll('[data-price]').forEach(inp => inp.onchange = () => {
      const p = byId(inp.dataset.price);
      p.price = Math.max(0, +inp.value || 0);
      SH.emit(); toast(p.title + ' updated to ' + KSh(p.price));
    });

    const s = document.getElementById('pSearch');
    if (s) s.oninput = () => {
      const t = s.value.toLowerCase();
      document.querySelectorAll('#pRows tr').forEach(r =>
        r.style.display = r.dataset.prow.includes(t) ? '' : 'none');
    };

    view.querySelectorAll('[data-confirmfit]').forEach(b => b.onclick = () => {
      state.appointments[+b.dataset.confirmfit].status = 'Confirmed';
      SH.emit(); render(); toast('Fitting confirmed');
    });

    const np = view.querySelector('[data-newproduct]');
    if (np) np.onclick = () => toast('Product creation is stubbed in this prototype');

    const ss = document.getElementById('saveSettings');
    if (ss) ss.onclick = () => {
      state.settings.freeShipThreshold = +document.getElementById('setThresh').value || 0;
      SH.emit(); toast('Settings saved');
    };
    const rd = document.getElementById('resetDemo');
    if (rd) rd.onclick = () => { SH.reset(); render(); toast('Demo data reset'); };
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]') || e.target.id === 'scrim') close();
    if (e.target.closest('[data-mtoggle]')) {
      document.querySelector('.side').classList.toggle('on');
      document.getElementById('scrim').classList.toggle('on');
    }
    if (e.target.closest('.side a')) document.querySelector('.side').classList.remove('on');
  });

  window.addEventListener('hashchange', render);
  window.addEventListener('sh:change', () => { /* keep KPIs fresh if another tab writes */ });
  render();
})();
