const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL=process.env.SITE||'https://sirhenrys.pages.dev';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 const net=[]; const errs=[];
 p.on('pageerror',e=>errs.push(e.message));
 p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,200))});
 p.on('response',async r=>{
   const u=r.url();
   if(/firebasevertexai|appcheck|recaptcha|identitytoolkit/i.test(u)){
     let body='';
     if(r.status()>=400){ try{ body=(await r.text()).slice(0,300);}catch(e){} }
     net.push({status:r.status(), url:u.split('?')[0].slice(0,110), body});
   }
 });
 await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForFunction(()=>window.SHAI&&(SHAI.status().ready||SHAI.status().error),
   {timeout:40000,polling:400}).catch(()=>{});
 await sleep(2000);
 const pre=await p.evaluate(()=>({appCheck:SHAppCheck.status(), ai:{ready:SHAI.status().ready,
   error:SHAI.status().error, model:SHAI.status().modelName}}));
 // ask something, and wait past our own 25s timeout
 const ans=await p.evaluate(async()=>{
   const r=await SHAI.ask([],'say ok',{});
   return {ok:r.ok, error:r.error, raw:SHAI.status().lastRaw, text:(r.text||'').slice(0,120)};
 });
 console.log(JSON.stringify({pre, ans, network:net.slice(0,12), errors:[...new Set(errs)].slice(0,8)},null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
