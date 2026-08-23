const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage(); await p.setViewport({width:1280,height:800});
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(5500);
 const out=await p.evaluate(async()=>{
   const calls=[];
   const handlers={
     openScreen:a=>{calls.push(['openScreen',a]);return 'opened';},
     proposeTransfer:a=>{calls.push(['proposeTransfer',a]);return 'drafted';},
     draftMessage:a=>{calls.push(['draftMessage',a]);return 'drafted';}
   };
   const r=await SHAI.ask([], 'What should I move between branches this week?', handlers);
   window.__calls=calls;
   return {ok:r.ok, error:r.error, raw:SHAI.status().lastRaw, calls, textLen:(r.text||'').length, text:(r.text||'').slice(0,500), actions:r.actions,
           model:SHAI.status().modelName, candidates:SHAI.status().candidates};
 });
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
