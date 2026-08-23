/* App Check must be harmless when it is not configured, and must not break the app it is
   loaded in front of. With no site key it stays off and everything else works exactly as
   before - that is the state this project ships in until a key exists. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 const errs=[]; const warns=[];
 p.on('pageerror',e=>errs.push(e.message));
 p.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,140));
                     if(m.type()==='warning') warns.push(m.text().slice(0,160)); });
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});

 // Wait for a condition rather than a guess: anonymous auth and a dynamic ESM import
 // both take longer than a fixed sleep, and a too-short one reports a slow boot as a
 // broken one - which is exactly what it did.
 await p.waitForFunction(
   ()=>window.SHSync && window.SHAI && (SHSync.status().on || SHSync.status().error)
       && (SHAI.status().ready || SHAI.status().error),
   {timeout:30000, polling:300}).catch(()=>{});
 const out=await p.evaluate(()=>({
   sdkLoaded: typeof firebase!=='undefined' && !!firebase.appCheck,
   status: window.SHAppCheck ? SHAppCheck.status() : null,
   // the whole point: nothing downstream may be harmed by App Check being unconfigured
   firebaseAppExists: typeof firebase!=='undefined' && firebase.apps.length>0,
   syncOn: window.SHSync ? SHSync.status().on : null,
   syncErr: window.SHSync ? SHSync.status().error : null,
   syncUser: window.SHSync ? SHSync.status().user : null,
   authReady: window.SHAuth ? SHAuth.isReady() : null,
   aiReady: window.SHAI ? SHAI.status().ready : null,
   productsRendered: document.querySelectorAll('#app .card, #app [class*=card]').length
 }));
 out.debugModeFlag = await p.evaluate(()=>self.FIREBASE_APPCHECK_DEBUG_TOKEN===true);
 out.warnings = [...new Set(warns)].filter(w=>/app-check/i.test(w));
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
