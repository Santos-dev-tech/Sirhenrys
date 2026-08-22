/* Sir Henry's Limited - catalogue + client-side store
   Everything persists to localStorage so the demo behaves like a real shop. */

const SH = (() => {
  'use strict';

  const BRANCHES = [
    { id: 'cbd',   name: "Kimathi Street, Nairobi CBD", hours: "Mon-Sun 10:00-20:00", tel: "+254 713 619786" },
    { id: 'west',  name: "Westgate Mall, Westlands",    hours: "Mon-Sun 10:00-20:00", tel: "+254 713 619787" },
    { id: 'rivers',name: "Two Rivers Mall, Ruaka",      hours: "Mon-Sun 10:00-20:00", tel: "+254 713 619788" },
    { id: 'msa',   name: "Nyali Centre, Mombasa",       hours: "Mon-Sun 10:00-19:00", tel: "+254 713 619789" }
  ];

  const SUIT_SIZES  = ['46','48','50','52','54','56','58'];
  const SHIRT_SIZES = ['S','M','L','XL','XXL'];
  const SHOE_SIZES  = ['39','40','41','42','43','44','45'];
  const ONE_SIZE    = ['One Size'];

  // deterministic pseudo-stock so the demo is stable across reloads
  function stockFor(slug, sizes) {
    let h = 0; for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const out = {};
    sizes.forEach((s, i) => {
      const per = {};
      BRANCHES.forEach((b, j) => {
        // healthy spread, with the occasional genuine stock-out to make the matrix useful.
        // NB: >>> not >> - h is unsigned, and a signed shift here yields negative stock.
        const v = ((h >>> ((i + j) % 12)) % 9) + 2;
        per[b.id] = ((h + i * 5 + j * 3) % 19 === 0) ? 0 : v;
      });
      out[s] = per;
    });
    return out;
  }
  const total = (stock, size) => Object.values(stock[size] || {}).reduce((a, b) => a + b, 0);
  const totalAll = (p) => Object.keys(p.stock).reduce((a, s) => a + total(p.stock, s), 0);

  const CATEGORIES = [
    { id: 'suits', name: 'Suits', img: 'cat-suits', subs: [
      { id: 'two-piece', name: 'Two Piece Suits' }, { id: 'three-piece', name: 'Three Piece Suits' },
      { id: 'tuxedo', name: 'Tuxedo' }, { id: 'double-breasted', name: 'Double Breasted' },
      { id: 'blazers', name: 'Blazers' }, { id: 'wool', name: 'Wool Suits' }, { id: 'linen', name: 'Linen Suits' },
      { id: 'prom', name: 'Prom Suits' }, { id: 'work', name: 'Work Suits' }, { id: 'graduation', name: 'Graduation Suits' }
    ]},
    { id: 'shirts', name: 'Shirts', img: 'cat-shirts', subs: [
      { id: 'formal', name: 'Formal Shirts' }, { id: 'patterned', name: 'Patterned' },
      { id: 'evening', name: 'Evening Shirts' }
    ]},
    { id: 'casual', name: 'Casual', img: 'cat-casual', subs: [
      { id: 'polo', name: 'Polo Shirts' }, { id: 'chinos', name: 'Chinos' },
      { id: 'jackets', name: 'Coats & Jackets' }, { id: 'smart-casual', name: 'Smart Casual' }
    ]},
    { id: 'accessories', name: 'Accessories', img: 'cat-accessories', subs: [
      { id: 'ties', name: 'Ties' }, { id: 'cufflinks', name: 'Cufflinks' },
      { id: 'shoes', name: 'Shoes' }, { id: 'belts', name: 'Belts' }
    ]}
  ];

  const RAW = [
    ['carlo-mint-grey', "Carlo Calvino 3 Piece Suit - Mint Grey", 39950, null, 'suits', 'three-piece', 'Slim', 'Super 130s Wool',
     'A refined mint grey three-piece cut close to the body, with a softly structured shoulder and a waistcoat that holds its line all day.', SUIT_SIZES, ['new']],
    ['carlo-navy', "Carlo Calvino 3 Piece Suit Set - Navy Blue", 39950, null, 'suits', 'three-piece', 'Slim', 'Super 130s Wool',
     'The house navy. Peak lapels, a clean chest and a trouser that breaks exactly once. The suit we are asked for most.', SUIT_SIZES, ['new','bestseller']],
    ['navy-pinstripe', "Navy Pinstripe Slim Fit 2-Piece Suit", 39950, 44950, 'suits', 'two-piece', 'Slim', 'Wool Blend',
     'A chalk pinstripe on deep navy - boardroom authority without shouting. Half-canvassed and fully lined.', SUIT_SIZES, ['sale','work']],
    ['blush-pink-wool', "Blush Pink Wool Three-Piece Suit", 39950, null, 'suits', 'three-piece', 'Slim', 'Pure Wool',
     'For the man who is not afraid of a room turning. Dusty blush wool, notch lapel, mother-of-pearl buttons.', SUIT_SIZES, ['new','prom']],
    ['charcoal-db', "Charcoal Double Breasted Suit", 42950, null, 'suits', 'double-breasted', 'Regular', 'Super 150s Wool',
     'Six-on-two double breasted with a wide peak lapel. Heavier cloth, stronger shoulder, unmistakable presence.', SUIT_SIZES, ['work']],
    ['black-tuxedo', "Classic Black Tuxedo", 45950, null, 'suits', 'tuxedo', 'Slim', 'Wool & Satin',
     'Satin shawl collar, covered buttons, satin-taped trouser. Black tie, done exactly as it should be.', SUIT_SIZES, ['bestseller']],
    ['beige-linen', "Beige Linen Summer Suit", 34950, 38950, 'suits', 'linen', 'Regular', 'Irish Linen',
     'Unlined and unstructured for the coast. Creases are not a flaw in linen - they are the point.', SUIT_SIZES, ['sale']],
    ['burgundy-velvet', "Burgundy Velvet Dinner Jacket", 38950, null, 'suits', 'blazers', 'Slim', 'Cotton Velvet',
     'Deep burgundy velvet with black satin lapels. Reserved for the evenings that matter.', SUIT_SIZES, ['new','prom']],
    ['navy-blazer', "Navy Wool Blazer", 22950, null, 'suits', 'blazers', 'Regular', 'Pure Wool',
     'Gold buttons, patch pockets, unstructured chest. The single most useful jacket a man can own.', SUIT_SIZES, []],
    ['camel-overcoat', "Camel Wool Overcoat", 32950, null, 'casual', 'jackets', 'Regular', 'Wool & Cashmere',
     'A full-length camel overcoat with a wool-cashmere handle. Cut to sit cleanly over a suit.', SUIT_SIZES, ['new']],
    ['bomber-navy', "Navy Blue Knit Bomber Jacket with Leather-Trim Pockets", 25950, null, 'casual', 'jackets', 'Regular', 'Knit & Leather',
     'A knitted bomber with leather-trimmed pockets and a ribbed collar. Smart enough for the office, easy enough for Saturday.', SUIT_SIZES, ['bestseller']],
    ['bomber-chocolate', "Chocolate Knit Bomber Jacket with Leather-Trim Pockets", 25950, null, 'casual', 'jackets', 'Regular', 'Knit & Leather',
     'The same bomber in a deep chocolate. Wears beautifully with cream, stone and denim.', SUIT_SIZES, []],
    ['bomber-black', "Black Knit Bomber Jacket with Leather-Trim Pockets", 25950, 28950, 'casual', 'jackets', 'Regular', 'Knit & Leather',
     'Black on black, leather-trimmed. The quietest thing in the collection and the hardest working.', SUIT_SIZES, ['sale']],
    ['polo-premium', "Premium Polo T-Shirt", 7000, null, 'casual', 'polo', 'Regular', 'Cotton Pique',
     'Heavyweight cotton pique with a collar that stays up. Cut slightly longer in the body.', SHIRT_SIZES, ['bestseller']],
    ['shirt-white-oxford', "White Oxford Dress Shirt", 5950, null, 'shirts', 'formal', 'Regular', '140/2 Egyptian Cotton',
     'The white oxford. Button-down collar, single-needle seams, mother-of-pearl buttons.', SHIRT_SIZES, ['bestseller']],
    ['shirt-sky-poplin', "Sky Blue Poplin Dress Shirt", 5950, null, 'shirts', 'formal', 'Slim', '120s Poplin',
     'A crisp sky poplin with a spread collar, cut close through the body for wear under a suit.', SHIRT_SIZES, []],
    ['acc-ties', "Silk Necktie Collection", 3500, null, 'accessories', 'ties', null, 'Pure Silk',
     'Woven silk ties in the five house colours. Seven-fold construction, hand-rolled edges.', ONE_SIZE, []],
    ['acc-shoes', "Leather Oxford Dress Shoes", 12950, 14950, 'accessories', 'shoes', null, 'Calf Leather',
     'Goodyear-welted oxfords in polished calf. Resoleable, and worth resoling.', SHOE_SIZES, ['sale']],
    ['acc-cufflinks', "Silver Cufflink & Pocket Square Set", 4500, null, 'accessories', 'cufflinks', null, 'Sterling Silver & Silk',
     'Sterling cufflinks with a hand-rolled silk pocket square. Presented in a Sir Henry\'s box.', ONE_SIZE, ['new']]
  ];

  const PRODUCTS = RAW.map(r => {
    const [slug, title, price, compareAt, cat, sub, fit, fabric, desc, sizes, tags] = r;
    return {
      slug, title, price, compareAt, category: cat, sub, fit, fabric, desc, sizes, tags,
      brand: slug.startsWith('carlo') ? "SIR HENRY'S" : "SIR HENRY'S LIMITED",
      // Full-resolution plates for the big displays (PDP, room, editorial bands) and
      // 760px variants for grid cards. Serving 1536px into a 400px card was costing
      // ~17 MB on the shop page and the images simply had not arrived.
      images: [`assets/img/${slug}.jpg`,
               slug.startsWith('acc-') ? `assets/img/${slug}.jpg` : `assets/img/${slug}-alt.jpg`],
      thumbs: [`assets/img/card/${slug}.jpg`,
               slug.startsWith('acc-') ? `assets/img/card/${slug}.jpg` : `assets/img/card/${slug}-alt.jpg`],
      stock: stockFor(slug, sizes),
      rating: 4 + ((slug.length * 7) % 10) / 10,
      reviews: 6 + (slug.length * 3) % 40
    };
  });

  const byId = s => PRODUCTS.find(p => p.slug === s);
  const fmt = n => 'KSh ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- persistent state ---------- */
  const KEY = 'sirhenrys.v1';
  const seedOrders = () => ([
    { id:'SH-10241', date:Date.now()-86400000*2, customer:{name:'Brian Otieno', email:'brian@example.co.ke', phone:'0722000111'},
      items:[{slug:'carlo-navy', size:'52', qty:1, price:39950}], total:39950, status:'In Workshop',
      payment:'M-Pesa', branch:'cbd', alterations:'Sleeve -1.5cm, trouser hem 31"' },
    { id:'SH-10240', date:Date.now()-86400000*5, customer:{name:'Kevin Mwangi', email:'kevin@example.co.ke', phone:'0733222444'},
      items:[{slug:'polo-premium', size:'L', qty:2, price:7000}], total:14000, status:'Delivered', payment:'Card', branch:'west', alterations:'' },
    { id:'SH-10239', date:Date.now()-86400000*9, customer:{name:'Samuel Kariuki', email:'sam@example.co.ke', phone:'0710555888'},
      items:[{slug:'black-tuxedo', size:'50', qty:1, price:45950}, {slug:'acc-cufflinks', size:'One Size', qty:1, price:4500}],
      total:50450, status:'Ready for Fitting', payment:'M-Pesa', branch:'cbd', alterations:'Waist +2cm' }
  ]);

  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const seedAppointments = () => ([
    { id:'FIT-200', name:'Daniel Kimani', phone:'0720 445 112', email:'daniel@example.co.ke',
      branch:'cbd', date:day(1), time:'11:00', reason:'Made to measure consultation', notes:'Wants a navy 3-piece for a September wedding.', status:'Confirmed' },
    { id:'FIT-201', name:'Peter Njoroge', phone:'0711 908 233', email:'peter@example.co.ke',
      branch:'west', date:day(2), time:'15:00', reason:'Wedding party fitting', notes:'Six groomsmen, needs group pricing.', status:'Requested' },
    { id:'FIT-202', name:'Alex Wanjala', phone:'0733 671 540', email:'alex@example.co.ke',
      branch:'rivers', date:day(4), time:'17:00', reason:'Alterations on an existing suit', notes:'Trouser taper and sleeve shorten.', status:'Requested' }
  ]);
  const seedCommissions = () => ([
    { id:'MTM-500', date:Date.now()-86400000*3, cloth:'Midnight Navy', pieces:'3', lapel:'peak',
      lining:'paisley', buttons:'pearl', monogram:'DKM', price:71300, status:'In Workshop' },
    { id:'MTM-501', date:Date.now()-86400000*6, cloth:'Charcoal Worsted', pieces:'2', lapel:'notch',
      lining:'house', buttons:'horn', monogram:'', price:57000, status:'Awaiting Measurement' }
  ]);

  const seedGroups = () => ([
    { id:'GRP-300', date:Date.now()-86400000*4, organiser:'Peter Njoroge', phone:'0711 908 233',
      email:'peter@example.co.ke', event:'Wedding', eventDate:day(38), slug:'charcoal-db',
      members:[{name:'Peter Njoroge',role:'Groom',size:'52'},{name:'James Njoroge',role:'Best Man',size:'50'},
               {name:'Eric Otieno',role:'Groomsman',size:'54'},{name:'Victor Sang',role:'Groomsman',size:'50'},
               {name:'Brian Cheruiyot',role:'Groomsman',size:'48'},{name:'Kelvin Maina',role:'Groomsman',size:'52'}],
      status:'Quoted' }
  ]);

  const blank = () => ({
    cart: [], wishlist: [], orders: seedOrders(), appointments: seedAppointments(), commissions: seedCommissions(),
    groups: seedGroups(), customer: null, recent: [],
    settings: { freeShipThreshold: 20000, currency: 'KSh', vat: 16 }
  });

  let state;
  try { state = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { state = blank(); }

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const emit = () => { save(); window.dispatchEvent(new CustomEvent('sh:change')); };

  /* ---------- cart ---------- */
  const cart = {
    add(slug, size, qty = 1) {
      const line = state.cart.find(l => l.slug === slug && l.size === size);
      if (line) line.qty += qty; else state.cart.push({ slug, size, qty });
      emit();
    },
    setQty(slug, size, qty) {
      const l = state.cart.find(x => x.slug === slug && x.size === size);
      if (!l) return;
      l.qty = Math.max(0, qty);
      if (!l.qty) state.cart = state.cart.filter(x => x !== l);
      emit();
    },
    remove(slug, size) { state.cart = state.cart.filter(l => !(l.slug === slug && l.size === size)); emit(); },
    clear() { state.cart = []; emit(); },
    get count() { return state.cart.reduce((a, l) => a + l.qty, 0); },
    get subtotal() { return state.cart.reduce((a, l) => a + (byId(l.slug)?.price || 0) * l.qty, 0); },
    get shipping() { return this.subtotal === 0 || this.subtotal >= state.settings.freeShipThreshold ? 0 : 500; },
    get total() { return this.subtotal + this.shipping; }
  };

  const wishlist = {
    has: s => state.wishlist.includes(s),
    toggle(s) {
      const i = state.wishlist.indexOf(s);
      if (i < 0) state.wishlist.push(s); else state.wishlist.splice(i, 1);
      emit();
    }
  };

  function placeOrder(details) {
    const id = 'SH-' + (10242 + state.orders.length);
    const order = {
      id, date: Date.now(), customer: details.customer,
      items: state.cart.map(l => ({ ...l, price: byId(l.slug).price })),
      total: cart.total, payment: details.payment, branch: details.branch || 'cbd',
      status: 'Confirmed', alterations: details.alterations || ''
    };
    state.orders.unshift(order);
    state.cart = [];
    emit();
    return order;
  }

  const STATUSES = ['Confirmed', 'In Workshop', 'Ready for Fitting', 'Out for Delivery', 'Delivered'];

  function bookAppointment(a) {
    state.appointments.unshift({ id: 'FIT-' + (200 + state.appointments.length), status: 'Requested', ...a });
    emit();
  }
  function addCommission(c) {
    state.commissions.unshift({ id: 'MTM-' + (500 + state.commissions.length), date: Date.now(), status: 'Draft', ...c });
    emit();
  }
  // group / wedding-party pricing: the more of the party you dress, the better the rate
  function groupDiscount(n) { return n >= 8 ? 0.20 : n >= 6 ? 0.15 : n >= 4 ? 0.10 : n >= 2 ? 0.05 : 0; }
  function addGroup(g) {
    state.groups.unshift({ id: 'GRP-' + (301 + state.groups.length), date: Date.now(), status: 'Requested', ...g });
    emit();
  }

  function search(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return [];
    return PRODUCTS.filter(p =>
      (p.title + ' ' + p.fabric + ' ' + p.desc + ' ' + p.category + ' ' + p.sub + ' ' + p.tags.join(' '))
        .toLowerCase().includes(q));
  }

  function markRecent(slug) {
    state.recent = [slug, ...state.recent.filter(s => s !== slug)].slice(0, 8);
    save();
  }

  return { BRANCHES, CATEGORIES, PRODUCTS, STATUSES, byId, fmt, state, save, emit,
           cart, wishlist, placeOrder, bookAppointment, addCommission, markRecent,
           addGroup, groupDiscount, search,
           stockTotal: total, stockAll: totalAll, reset(){ state = blank(); emit(); } };
})();

window.SH = SH;
