/* Check the deployed site the way a visitor meets it: real domain, real App Check,
   nothing from localhost. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL=process.env.SITE||'https://sirhenrys.pages.dev';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 p.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });
 await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForFunction(()=>window.SHSync&&window.SHAppCheck&&
   (SHSync.status().on||SHSync.status().error),{timeout:40000,polling:400}).catch(()=>{});
 await sleep(3000);
 const out=await p.evaluate(()=>({
   url: location.href,
   appCheck: window.SHAppCheck?SHAppCheck.status():null,
   sync: window.SHSync?SHSync.status():null,
   ai: window.SHAI?{ready:SHAI.status().ready,error:SHAI.status().error}:null,
   auth: window.SHAuth?{ready:SHAuth.isReady(),backend:SHAuth.hasBackend()}:null,
   products: document.querySelectorAll('#app .card, #app [class*=card]').length,
   homeIcon: !!document.querySelector('.nav .navhome'),
   signIn: !!document.querySelector('[data-signin]')
 }));
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
