/* The console has to scroll. Lenis owns the page's scrolling, so stopping it does not
   hand control back to the browser - it removes scrolling entirely. */
const puppeteer=require('puppeteer-core');
const signInAs=require('./signin');   // the gate has a second factor now
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8100/index.html#/admin',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4000);
 // sign in as the owner, whose views are long enough to need scrolling
 await signInAs(p,'ha');
 const out={};
 for(const route of ['/admin/orders','/admin/inventory','/admin/products']){
   await p.evaluate(r=>{location.hash='#'+r;},route); await sleep(1200);
   const r=await p.evaluate(async()=>{
     const wait=ms=>new Promise(r=>setTimeout(r,ms));
     const before=window.scrollY;
     const docH=document.documentElement.scrollHeight;
     // a real wheel gesture, not a scrollTo - scrollTo can work while the wheel is dead
     return {docH, before, scrollable: docH>innerHeight+4};
   });
   await p.mouse.move(700,500);
   await p.mouse.wheel({deltaY:600});
   await sleep(900);
   const after=await p.evaluate(()=>window.scrollY);
   out[route]={...r, afterWheel:Math.round(after), moved: after>r.before+10};
   await p.evaluate(()=>window.scrollTo(0,0)); await sleep(400);
 }
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
