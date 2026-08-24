/* Sir Henry's pitch deck.
   Palette is the shop's own - ink, bone, bronze - taken from assets/css/site.css, so the
   deck and the thing it is selling look like one object. */
const pptx = require('pptxgenjs');
const p = new pptx();
p.layout = 'LAYOUT_WIDE';                 // 13.3 x 7.5

const INK = '151515', BONE = 'F7F5F2', BRONZE = '846144', BRONZE_LT = 'A47D5C';
const MUTED = '6F6A65', LINE = 'E6E2DD', WHITE = 'FFFFFF', PALE = '9C9691';
const SERIF = 'Cambria', SANS = 'Calibri';

const W = 13.3, M = 0.7;

/* ---------- helpers ---------- */
function darkSlide() {
  const s = p.addSlide();
  s.background = { color: INK };
  return s;
}
function lightSlide(title, kicker) {
  const s = p.addSlide();
  s.background = { color: WHITE };
  if (kicker) s.addText(kicker.toUpperCase(), {
    x: M, y: 0.45, w: 11, h: 0.3, fontFace: SANS, fontSize: 11, bold: true,
    charSpacing: 3, color: BRONZE, margin: 0
  });
  if (title) s.addText(title, {
    x: M, y: 0.8, w: 11.9, h: 0.85, fontFace: SERIF, fontSize: 38, bold: true,
    color: INK, margin: 0
  });
  return s;
}
// the one repeated motif: a bronze number in a circle
function numDot(s, n, x, y, d = 0.5) {
  s.addShape(p.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: BRONZE } });
  s.addText(String(n), {
    x, y, w: d, h: d, align: 'center', valign: 'middle',
    fontFace: SANS, fontSize: 13, bold: true, color: WHITE, margin: 0
  });
}
function card(s, x, y, w, h, fill) {
  s.addShape(p.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.04,
    fill: { color: fill || BONE }, line: { color: LINE, width: 0.75 }
  });
}
function stat(s, x, y, w, big, label, colour) {
  s.addText(big, { x, y, w, h: 0.85, fontFace: SERIF, fontSize: 40, bold: true,
    color: colour || INK, margin: 0 });
  s.addText(label, { x, y: y + 0.85, w, h: 0.75, fontFace: SANS, fontSize: 12,
    color: MUTED, margin: 0 });
}

/* ============================ 1. COVER ============================ */
{
  const s = darkSlide();
  s.addText("SIR HENRY'S LIMITED", { x: M, y: 2.0, w: 11.9, h: 0.4, fontFace: SANS,
    fontSize: 13, bold: true, charSpacing: 6, color: BRONZE_LT, margin: 0 });
  s.addText('A shop that works\nthe way you already do', { x: M, y: 2.5, w: 11.9, h: 2.0,
    fontFace: SERIF, fontSize: 48, bold: true, color: BONE, lineSpacing: 52, margin: 0 });
  s.addText('A storefront and a staff console, built for four branches, M-Pesa, and a workshop that alters for life.',
    { x: M, y: 4.6, w: 9.5, h: 0.6, fontFace: SANS, fontSize: 15, color: PALE, margin: 0 });
  s.addText('Live now  ·  sirhenrys.pages.dev', { x: M, y: 6.3, w: 11.9, h: 0.4,
    fontFace: SANS, fontSize: 12, bold: true, charSpacing: 2, color: BRONZE_LT, margin: 0 });
  s.addNotes('Open on the live site already loaded in a browser tab. Do not read this slide aloud - let them see the anatomy sequence scrub while you introduce yourself.');
}

/* ============================ 2. TODAY ============================ */
{
  const s = lightSlide('What your website costs you today', 'The audit');
  s.addText('I went through sirhenrys.co.ke page by page before writing a line of code. These are the findings, not estimates.',
    { x: M, y: 1.75, w: 11.9, h: 0.5, fontFace: SANS, fontSize: 14, color: MUTED, margin: 0 });

  const items = [
    ['KSh 67,000–110,000', 'Paid to Shopify every month, once POS Pro for five stores is counted'],
    ['0.6–2%', 'Extra on every single order, because Shopify Payments does not operate in Kenya'],
    ['0%', 'Of your catalogue has a barcode. Nothing in any store can be scanned'],
    ['21 of 65', 'Collections are empty. A customer clicking them finds nothing']
  ];
  items.forEach((it, i) => {
    const x = M + i * 3.05;
    card(s, x, 2.55, 2.8, 2.9);
    s.addText(it[0], { x: x + 0.25, y: 2.8, w: 2.3, h: 0.9, fontFace: SERIF,
      fontSize: it[0].length > 12 ? 20 : 30, bold: true, color: BRONZE, margin: 0 });
    s.addText(it[1], { x: x + 0.25, y: 3.75, w: 2.35, h: 1.5, fontFace: SANS,
      fontSize: 12, color: INK, margin: 0 });
  });
  s.addText('Shopify POS Pro is $89 per store per month. Five stores is $445 a month on its own — roughly KSh 58,000 — before the platform fee.',
    { x: M, y: 5.75, w: 11.9, h: 0.5, fontFace: SANS, fontSize: 12, italic: true, color: MUTED, margin: 0 });
  s.addNotes('Do not rush these four numbers. The 0% barcodes one usually lands hardest with whoever runs the shop floor - ask them how they count stock today.');
}

/* ============================ 3. THE ARGUMENT ============================ */
{
  const s = darkSlide();
  s.addText('The argument', { x: M, y: 0.45, w: 11, h: 0.3, fontFace: SANS, fontSize: 11,
    bold: true, charSpacing: 3, color: BRONZE_LT, margin: 0 });
  s.addText('You are paying a global platform\nto not understand Kenya.', { x: M, y: 1.4, w: 11.9,
    h: 1.8, fontFace: SERIF, fontSize: 40, bold: true, color: BONE, lineSpacing: 46, margin: 0 });
  const pts = [
    ['M-Pesa is a bolt-on, not a checkout.', 'Most of your customers pay this way. On Shopify it is an app you rent.'],
    ['Made-to-measure cannot be expressed.', 'Cloth x cut x lapel x lining x buttons is not a variant list. Shopify has no way to price it.'],
    ['Alterations for life is your differentiator.', 'Nothing on your current site tracks a single one of them.']
  ];
  pts.forEach((t, i) => {
    const y = 3.5 + i * 1.05;
    numDot(s, i + 1, M, y, 0.42);
    s.addText(t[0], { x: M + 0.68, y: y - 0.06, w: 11, h: 0.35, fontFace: SANS,
      fontSize: 15, bold: true, color: BONE, margin: 0 });
    s.addText(t[1], { x: M + 0.68, y: y + 0.3, w: 11, h: 0.4, fontFace: SANS,
      fontSize: 12.5, color: PALE, margin: 0 });
  });
  s.addNotes('This is the emotional centre of the pitch. Pause after the headline.');
}

/* ============================ 4. DEMO OVERVIEW ============================ */
{
  const s = lightSlide('The demonstration', 'What happens next');
  s.addText('Twelve minutes, in this order. Everything you are about to see is running live — nothing is a mock-up.',
    { x: M, y: 1.75, w: 11.9, h: 0.5, fontFace: SANS, fontSize: 14, color: MUTED, margin: 0 });
  const steps = [
    ['The storefront', 'Opening sequence, the collection room, a garment turning'],
    ['Buying something', 'Size finder, M-Pesa checkout, order tracking'],
    ['The till', 'Scan, take payment, watch stock fall in one branch'],
    ['The workshop', 'An alteration moving through four stages'],
    ['Made to measure', 'Cloth, cut, lapel, lining — priced live'],
    ['Weddings and corporate', 'A group of six, then a bank of 120']
  ];
  steps.forEach((st, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = M + col * 4.05, y = 2.55 + row * 2.05;
    card(s, x, y, 3.8, 1.8);
    numDot(s, i + 1, x + 0.28, y + 0.28, 0.42);
    s.addText(st[0], { x: x + 0.28, y: y + 0.82, w: 3.2, h: 0.32, fontFace: SANS,
      fontSize: 14, bold: true, color: INK, margin: 0 });
    s.addText(st[1], { x: x + 0.28, y: y + 1.14, w: 3.3, h: 0.6, fontFace: SANS,
      fontSize: 11.5, color: MUTED, margin: 0 });
  });
  s.addNotes('Say the twelve minutes out loud. It signals you respect their time and it stops them interrupting to ask how long this will take.');
}

/* ============================ 5-10. THE WALKTHROUGH ============================ */
const demo = [
  {
    n: 1, kicker: 'Demo · part one', title: 'The storefront',
    url: 'sirhenrys.pages.dev',
    lines: [
      ['Scroll slowly from the top', 'A suit assembles itself as you scroll — shirt, waistcoat, canvas, finished jacket. Ninety-seven frames, scrubbed by scroll position. It runs backwards if you scroll up.'],
      ['Keep going to The Collection', 'Every garment stands in one shared light. Drag it sideways. This is the part people photograph.'],
      ['Open Carlo Calvino Navy', 'The suit turns on its own — seventy-two positions, a full revolution. Drag to take over.']
    ],
    say: 'Nothing here is stock photography of somebody else’s shop.'
  },
  {
    n: 2, kicker: 'Demo · part two', title: 'Buying something',
    url: '#/product/carlo-navy',
    lines: [
      ['Use the size finder', 'Chest and height in, size out. On a KSh 40,000 purchase this is the difference between a sale and a return.'],
      ['Check stock by branch', 'It does not say "in stock". It says which of your four shops has size 52 today.'],
      ['Pay by M-Pesa', 'The STK push is built in Safaricom’s real Daraja shape — the same fields, the same result codes.'],
      ['Track the order', 'Confirmed, In Workshop, Ready for Fitting, Out for Delivery, Delivered. A tailor’s stages, not a warehouse’s.']
    ],
    say: 'Ask them what percentage of their customers pay by M-Pesa. Let them say the number.'
  },
  {
    n: 3, kicker: 'Demo · part three', title: 'The till',
    url: '#/admin → Till (POS)',
    lines: [
      ['Sign in as shop floor — PIN 1357', 'Ten sections disappear. A shop-floor account sees the till, stock and alterations. Nothing else.'],
      ['Scan or search a garment', 'Every variant has a real EAN-13 barcode with a valid check digit. You can print the whole catalogue as tags.'],
      ['Take payment and print', 'M-Pesa, card or cash, with change calculated.'],
      ['Watch the stock', 'It falls at that branch only — and on the customer’s phone, immediately.']
    ],
    say: 'This one screen is what replaces Shopify POS Pro at KSh 58,000 a month.'
  },
  {
    n: 4, kicker: 'Demo · part four', title: 'The workshop',
    url: '#/admin/alterations',
    lines: [
      ['Open an alteration job', 'Sleeve, waist, hem, taper — captured against the order it came from.'],
      ['Move it a stage', 'Received → In Workshop → Ready → Collected. Each step writes a note the customer can see.'],
      ['Show the customer’s view', 'They watch their own suit move through your workshop without telephoning anybody.']
    ],
    say: 'Free alterations for life is the promise on their homepage. Nothing currently records one.'
  },
  {
    n: 5, kicker: 'Demo · part five', title: 'Made to measure',
    url: '#/bespoke',
    lines: [
      ['Build a suit in front of them', 'Cloth, number of pieces, lapel, lining, buttons, monogram — the price moves as you choose.'],
      ['Say what this is', 'Shopify variants cannot express this. Five choices multiply into thousands of combinations; a variant list caps out long before.'],
      ['Send it to the workshop', 'It lands in the console as a commission with its own stages.']
    ],
    say: 'This is the highest-margin thing they sell and the hardest for a competitor to copy.'
  },
  {
    n: 6, kicker: 'Demo · part six', title: 'Weddings and corporate',
    url: '#/wedding  and  #/corporate',
    lines: [
      ['A wedding party of six', 'One organiser, a roster of names and sizes, discount scaling to 20%, cloth reserved from one bolt so every jacket matches.'],
      ['A bank of one hundred and twenty', 'The enquiry arrives in a pipeline: New, Quoted, Won, Lost. Mark it Won and it becomes a real order.'],
      ['Show the arithmetic', 'One hundred and twenty two-piece suits, less the 25% volume tier — KSh 3,595,560, invoiced, not charged to a card.']
    ],
    say: 'Shopify has no concept of an order that is not yet an order. A tender needs measuring and a quote first.'
  }
];

demo.forEach(d => {
  const s = lightSlide(d.title, d.kicker);
  s.addText(d.url, { x: M, y: 1.75, w: 11.9, h: 0.35, fontFace: 'Courier New',
    fontSize: 12, bold: true, color: BRONZE, margin: 0 });

  let y = 2.35;
  d.lines.forEach((l, i) => {
    numDot(s, i + 1, M, y + 0.04, 0.4);
    s.addText(l[0], { x: M + 0.62, y: y, w: 11.4, h: 0.32, fontFace: SANS,
      fontSize: 15, bold: true, color: INK, margin: 0 });
    s.addText(l[1], { x: M + 0.62, y: y + 0.34, w: 11.3, h: 0.62, fontFace: SANS,
      fontSize: 12.5, color: MUTED, margin: 0 });
    y += 1.06;
  });

  card(s, M, 6.15, 11.9, 0.85, BONE);
  s.addText([
    { text: 'Say this:  ', options: { bold: true, color: BRONZE } },
    { text: d.say, options: { color: INK } }
  ], { x: M + 0.3, y: 6.32, w: 11.3, h: 0.5, fontFace: SANS, fontSize: 12.5, italic: true, margin: 0 });
  s.addNotes('Part ' + d.n + ' of 6. ' + d.say);
});

/* ============================ 11. SIX THINGS ============================ */
{
  const s = lightSlide('Six things Shopify will not do', 'The comparison');
  const six = [
    ['M-Pesa as a real checkout', 'Not an app you rent monthly'],
    ['Made-to-measure, priced live', 'Variants cannot express five multiplying choices'],
    ['Group and corporate ordering', 'One organiser, a whole party, one bolt of cloth'],
    ['Stock by size AND branch', 'With transfer suggestions between shops'],
    ['Alterations tracked to the customer', 'In Workshop and Ready for Fitting are real stages'],
    ['A size finder that cuts returns', 'Chest and height, on a KSh 40,000 purchase']
  ];
  six.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.05, y = 1.95 + row * 1.55;
    numDot(s, i + 1, x, y + 0.06, 0.44);
    s.addText(t[0], { x: x + 0.66, y: y, w: 5.2, h: 0.35, fontFace: SANS,
      fontSize: 15, bold: true, color: INK, margin: 0 });
    s.addText(t[1], { x: x + 0.66, y: y + 0.38, w: 5.2, h: 0.55, fontFace: SANS,
      fontSize: 12, color: MUTED, margin: 0 });
  });
  s.addText('Every one of these is built and running today. None of them is a roadmap item.',
    { x: M, y: 6.7, w: 11.9, h: 0.4, fontFace: SANS, fontSize: 13, italic: true, color: BRONZE, margin: 0 });
  s.addNotes('If they push back on any single row, offer to demonstrate it there and then. All six are live.');
}

/* ============================ 12. THE MONEY ============================ */
{
  const s = lightSlide('What it costs', 'The numbers');

  card(s, M, 1.9, 5.75, 3.2, BONE);
  s.addText('Shopify today', { x: M + 0.35, y: 2.15, w: 5, h: 0.35, fontFace: SANS,
    fontSize: 13, bold: true, charSpacing: 2, color: MUTED, margin: 0 });
  s.addText('KSh 67,000–110,000', { x: M + 0.35, y: 2.55, w: 5.2, h: 0.7,
    fontFace: SERIF, fontSize: 30, bold: true, color: INK, margin: 0 });
  s.addText('per month', { x: M + 0.35, y: 3.2, w: 5, h: 0.3, fontFace: SANS,
    fontSize: 12, color: MUTED, margin: 0 });
  [['Platform subscription', ''], ['POS Pro, five stores', '$445/mo'],
   ['Payment penalty, no Shopify Payments in Kenya', '0.6–2% per order'],
   ['Apps for anything above', 'extra']].forEach((r, i) => {
    s.addText(r[0], { x: M + 0.35, y: 3.65 + i * 0.33, w: 4.1, h: 0.3, fontFace: SANS,
      fontSize: 11, color: INK, margin: 0 });
    s.addText(r[1], { x: M + 4.4, y: 3.65 + i * 0.33, w: 1.25, h: 0.3, fontFace: SANS,
      fontSize: 11, bold: true, color: MUTED, align: 'right', margin: 0 });
  });

  card(s, M + 6.15, 1.9, 5.75, 3.2, INK);
  s.addText('This', { x: M + 6.5, y: 2.15, w: 5, h: 0.35, fontFace: SANS,
    fontSize: 13, bold: true, charSpacing: 2, color: BRONZE_LT, margin: 0 });
  s.addText('KSh 50,000', { x: M + 6.5, y: 2.55, w: 5.2, h: 0.7, fontFace: SERIF,
    fontSize: 34, bold: true, color: BONE, margin: 0 });
  s.addText('per month, everything included', { x: M + 6.5, y: 3.2, w: 5, h: 0.3,
    fontFace: SANS, fontSize: 12, color: PALE, margin: 0 });
  ['Storefront, staff console and till', 'Hosting, updates and support',
   'No per-store charge — four shops or fourteen', 'No payment penalty'].forEach((t, i) => {
    s.addText('—   ' + t, { x: M + 6.5, y: 3.65 + i * 0.33, w: 5.2, h: 0.3,
      fontFace: SANS, fontSize: 11, color: BONE, margin: 0 });
  });

  s.addText('Plus KSh 50,000 once, to go live', { x: M, y: 5.4, w: 7, h: 0.45,
    fontFace: SERIF, fontSize: 21, bold: true, color: INK, margin: 0 });
  s.addText('Your real catalogue photographed and loaded, four branches configured, staff accounts created, Safaricom credentials connected, and your team trained on the till.',
    { x: M, y: 5.85, w: 11.9, h: 0.6, fontFace: SANS, fontSize: 12.5, color: MUTED, margin: 0 });
  s.addText('You are saving between KSh 17,000 and KSh 60,000 every month, and getting six things you cannot currently buy.',
    { x: M, y: 6.55, w: 11.9, h: 0.45, fontFace: SANS, fontSize: 13, bold: true, color: BRONZE, margin: 0 });
  s.addNotes('Do not apologise for the number. Lead with the saving, then the setup fee. If they negotiate, the setup fee is the flexible half - the monthly is not.');
}

/* ============================ 13. YEAR ONE CHART ============================ */
{
  const s = lightSlide('Year one, side by side', 'The maths');
  s.addChart(p.ChartType.bar, [
    { name: 'Shopify (low estimate)', labels: ['Platform + POS', 'Payment penalty', 'Setup'], values: [804000, 90000, 0] },
    { name: "Sir Henry's own system", labels: ['Platform + POS', 'Payment penalty', 'Setup'], values: [600000, 0, 50000] }
  ], {
    x: M, y: 1.9, w: 11.9, h: 3.9, barDir: 'col', barGrouping: 'clustered',
    chartColors: [PALE, BRONZE],
    showTitle: false, showLegend: true, legendPos: 'b', legendFontSize: 11,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 10,
    dataLabelFormatCode: '#,##0',
    catAxisLabelColor: MUTED, valAxisLabelColor: MUTED,
    catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
    valGridLine: { color: LINE, size: 0.75 }, catGridLine: { style: 'none' },
    valAxisLabelFormatCode: '#,##0'
  });
  s.addText('Figures in Kenyan shillings. Shopify uses the LOW end of the audited range — the honest comparison, not the flattering one. Payment penalty assumes 1% on KSh 9m of annual card and mobile volume.',
    { x: M, y: 6.0, w: 11.9, h: 0.6, fontFace: SANS, fontSize: 11, italic: true, color: MUTED, margin: 0 });
  s.addNotes('If asked where 9m comes from, say it is an assumption and you would rather use their real figure - then ask for it. That question is a buying signal.');
}

/* ============================ 14. HONEST LIMITS ============================ */
{
  const s = lightSlide('What is not finished', 'Straight answers');
  s.addText('You will ask this eventually, so here it is first.',
    { x: M, y: 1.75, w: 11.9, h: 0.4, fontFace: SANS, fontSize: 14, color: MUTED, margin: 0 });
  const limits = [
    ['M-Pesa is built but not connected', 'The request is Safaricom’s real shape and the real failure codes are handled. Connecting it needs your Daraja credentials and a short server piece. Part of the setup fee.'],
    ['The imagery is generated, not photographed', 'The garments shown are representative. Going live means photographing your actual stock — also part of setup.'],
    ['Nineteen products are loaded, not the full range', 'The prices are your real ones. The rest of the catalogue loads during setup.'],
    ['Staff sign-in is demo-grade today', 'Real accounts and server-side security are part of going live. Nothing here should hold real customer data until that is done.']
  ];
  limits.forEach((l, i) => {
    const y = 2.4 + i * 1.1;
    numDot(s, i + 1, M, y + 0.02, 0.4);
    s.addText(l[0], { x: M + 0.62, y: y, w: 11.4, h: 0.32, fontFace: SANS,
      fontSize: 14.5, bold: true, color: INK, margin: 0 });
    s.addText(l[1], { x: M + 0.62, y: y + 0.34, w: 11.3, h: 0.65, fontFace: SANS,
      fontSize: 12, color: MUTED, margin: 0 });
  });
  s.addText('Saying this out loud is the point. Anyone who tells you a system is finished has not built one.',
    { x: M, y: 6.85, w: 11.9, h: 0.4, fontFace: SANS, fontSize: 12, italic: true, color: BRONZE, margin: 0 });
  s.addNotes('Volunteer this before they ask. It buys more trust than any feature on the previous slides.');
}

/* ============================ 15. NEXT STEPS ============================ */
{
  const s = lightSlide('If you say yes today', 'Going live');
  const weeks = [
    ['Week 1', 'Photograph the real catalogue. Load every product, price and size.'],
    ['Week 2', 'Configure four branches, create staff accounts, connect Safaricom.'],
    ['Week 3', 'Train the shop floor on the till. Run both systems side by side.'],
    ['Week 4', 'Point sirhenrys.co.ke at the new shop. Switch Shopify off.']
  ];
  weeks.forEach((w, i) => {
    const x = M + i * 3.05;
    card(s, x, 2.1, 2.8, 2.5);
    numDot(s, i + 1, x + 0.28, 2.35, 0.44);
    s.addText(w[0], { x: x + 0.28, y: 2.95, w: 2.3, h: 0.32, fontFace: SANS,
      fontSize: 14, bold: true, color: BRONZE, margin: 0 });
    s.addText(w[1], { x: x + 0.28, y: 3.3, w: 2.35, h: 1.1, fontFace: SANS,
      fontSize: 12, color: INK, margin: 0 });
  });
  s.addText('One month, and the Shopify bill stops.', { x: M, y: 5.0, w: 11.9, h: 0.55,
    fontFace: SERIF, fontSize: 26, bold: true, color: INK, margin: 0 });
  s.addText('Run both together for the last fortnight. Nothing switches off until your staff are comfortable and you have seen a full week of real orders come through.',
    { x: M, y: 5.6, w: 11.9, h: 0.6, fontFace: SANS, fontSize: 13, color: MUTED, margin: 0 });
  s.addNotes('The overlap fortnight removes almost all of the perceived risk. Emphasise it.');
}

/* ============================ 16. CLOSE ============================ */
{
  const s = darkSlide();
  s.addText('Open it yourself', { x: M, y: 0.45, w: 11, h: 0.3, fontFace: SANS,
    fontSize: 11, bold: true, charSpacing: 3, color: BRONZE_LT, margin: 0 });
  s.addText('sirhenrys.pages.dev', { x: M, y: 2.2, w: 11.9, h: 1.1, fontFace: SERIF,
    fontSize: 46, bold: true, color: BONE, margin: 0 });
  s.addText('It is live. Open it on your phone in this meeting, ring up a sale on the till, and watch the stock change on the screen in front of you.',
    { x: M, y: 3.4, w: 9.8, h: 0.8, fontFace: SANS, fontSize: 15, color: PALE, margin: 0 });

  const cols = [['KSh 50,000', 'once, to go live'], ['KSh 50,000', 'per month, everything included'],
                ['Four weeks', 'from yes to switched over']];
  cols.forEach((c, i) => {
    const x = M + i * 4.05;
    s.addText(c[0], { x, y: 5.0, w: 3.8, h: 0.6, fontFace: SERIF, fontSize: 26,
      bold: true, color: BRONZE_LT, margin: 0 });
    s.addText(c[1], { x, y: 5.6, w: 3.8, h: 0.4, fontFace: SANS, fontSize: 12,
      color: PALE, margin: 0 });
  });
  s.addText('Staff console: sirhenrys.pages.dev/#/admin  ·  demo PIN 1967',
    { x: M, y: 6.6, w: 11.9, h: 0.35, fontFace: SANS, fontSize: 11, color: MUTED, margin: 0 });
  s.addNotes('End here and stop talking. Let them open it. The silence while somebody scrolls the anatomy sequence on their own phone does more than another slide would.');
}

p.writeFile({ fileName: "Sir-Henrys-Proposal.pptx" })
 .then(f => console.log('written:', f));
