/* The assistant. Checks the panel is staff-only, that it boots or fails legibly, and
   that the "propose, do not commit" boundary actually holds - the handlers must not
   change stock until a person clicks. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(5000);
 const out={};

 // the storefront must never show a staff tool
 out.storefront=await p.evaluate(()=>{
   const f=document.getElementById('aiFab');
   return {fabExists:!!f, fabVisible:f?getComputedStyle(f).display!=='none':null,
           bodyHasAdShowing:document.body.classList.contains('ad-showing')};
 });

 await p.evaluate(()=>{location.hash='#/admin';}); await sleep(1200);
 await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const ad=document.getElementById('ad');
   const who=ad.querySelector('[data-staff="ha"]'); if(who){who.click(); await wait(300);}
   const pin=ad.querySelector('#pinInput');
   if(pin){pin.value='1967'; ad.querySelector('#pinForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));}
 });
 await sleep(1600);
 out.console=await p.evaluate(()=>{
   const f=document.getElementById('aiFab');
   return {fabVisible:getComputedStyle(f).display!=='none',
           bodyHasAdShowing:document.body.classList.contains('ad-showing')};
 });

 out.status=await p.evaluate(()=>window.SHAI?SHAI.status():null);

 // open it and ask something real
 await p.evaluate(()=>document.getElementById('aiFab').click()); await sleep(500);
 out.panelOpen=await p.evaluate(()=>!document.getElementById('aiPanel').hidden);
 out.suggestions=await p.evaluate(()=>document.querySelectorAll('#aiSugg button').length);

 if(out.status && out.status.ready){
   const before=await p.evaluate(()=>JSON.stringify(SH.state.adjustments||{}));
   await p.evaluate(()=>{document.getElementById('aiInput').value='What should I move between branches this week?';
     document.getElementById('aiForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));});
   await sleep(22000);
   out.reply=await p.evaluate(()=>{
     const m=[...document.querySelectorAll('#aiLog .ai-msg')];
     const last=m[m.length-1];
     return {cls:last?last.className:null, text:last?last.textContent.slice(0,400):null,
             cards:document.querySelectorAll('#aiLog .ai-did').length};
   });
   const after=await p.evaluate(()=>JSON.stringify(SH.state.adjustments||{}));
   // THE boundary: a model turn must not have moved any stock on its own
   out.stockUnchangedByModel = before===after;
 }
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
