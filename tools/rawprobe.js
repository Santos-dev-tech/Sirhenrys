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
   const asks=['Which alterations are due or overdue?','Draft a reply to the Sidian Bank enquiry'];
   const results=[];
   for(const q of asks){
     const rr=await SHAI.ask([], q, handlers);
     results.push({q, ok:rr.ok, error:rr.error||null, raw:(SHAI.status().lastRaw||'').slice(0,260),
                   model:SHAI.status().modelName, text:(rr.text||'').slice(0,160), actions:(rr.actions||[]).map(a=>a.name)});
   }
   window.__res=results;
   const r={ok:true};
   window.__calls=calls;
   return {results, calls,
           model:SHAI.status().modelName, candidates:SHAI.status().candidates};
 });
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
