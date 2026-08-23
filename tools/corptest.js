/* Marking a corporate enquiry Won must create exactly one real order, priced at the
   volume tier, and must not create a second one if Won is clicked again. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8100/index.html#/admin',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4500);
 await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const ad=document.getElementById('ad');
   ad.querySelector('[data-staff="ha"]').click(); await wait(300);
   ad.querySelector('#pinInput').value='1967';
   ad.querySelector('#pinForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
 });
 await sleep(1500);
 const out=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const res={};
   location.hash='#/admin/corporate'; await wait(900);
   const c=SH.state.corporate[0];
   res.enquiry={id:c.id, company:c.company, headcount:c.headcount, garment:c.garment, status:c.status};
   res.ordersBefore=SH.state.orders.length;

   const won=[...document.querySelectorAll('[data-corp="'+c.id+'"]')].find(b=>b.dataset.corpst==='Won');
   res.wonButtonFound=!!won;
   won.click(); await wait(900);

   const c2=SH.state.corporate.find(x=>x.id===c.id);
   res.statusAfter=c2.status;
   res.orderId=c2.orderId||null;
   res.ordersAfter=SH.state.orders.length;
   const o=SH.state.orders.find(x=>x.id===c2.orderId);
   res.order=o?{id:o.id, total:o.total, payment:o.payment, status:o.status, corporate:o.corporate,
                items:o.items, customer:o.customer.name, note:o.alterations}:null;

   // the arithmetic must match the tier the customer was shown
   const slug=SH.CORP_GARMENTS[c.garment];
   const unit=SH.byId(slug).price;
   const disc=SH.corporateTier(+c.headcount);
   res.expected={slug, unit, disc, total:Math.round(unit*(1-disc))*(+c.headcount)};
   res.priceCorrect = o && o.total===res.expected.total;

   // clicking Won again must not bill twice
   const won2=[...document.querySelectorAll('[data-corp="'+c.id+'"]')].find(b=>b.dataset.corpst==='Won');
   if(won2){ won2.click(); await wait(700); }
   res.ordersAfterSecondClick=SH.state.orders.length;
   res.idempotent = res.ordersAfterSecondClick===res.ordersAfter;

   // and it must show up in Orders like any other order
   location.hash='#/admin/orders'; await wait(900);
   res.visibleInOrders = document.body.innerText.includes(c2.orderId);
   return res;
 });
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
