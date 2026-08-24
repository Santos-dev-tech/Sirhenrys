/* How long does a real answer actually take on the live site, and does turning the
   model's thinking down change it? */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
   protocolTimeout:300000});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 await p.goto('https://sirhenrys.pages.dev',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForFunction(()=>window.SHAI&&SHAI.status().ready,{timeout:40000,polling:400}).catch(()=>{});
 await sleep(1500);
 const out=await p.evaluate(async()=>{
   const SDK='https://www.gstatic.com/firebasejs/12.18.0/';
   const [{getApps,getApp},{getAI,getGenerativeModel,GoogleAIBackend}]=
     await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-ai.js')]);
   const ai=getAI(getApp(),{backend:new GoogleAIBackend()});
   const res={};
   const time=async(label,cfg,prompt)=>{
     const t0=performance.now();
     try{
       const m=getGenerativeModel(ai,cfg);
       const r=await m.generateContent(prompt);
       res[label]={ms:Math.round(performance.now()-t0), chars:(r.response.text()||'').length};
     }catch(e){ res[label]={ms:Math.round(performance.now()-t0), err:String(e.message||e).slice(0,140)}; }
   };
   const M='gemini-3.7-flash';
   await time('bare, short prompt', {model:M}, 'say ok');
   await time('with thinking off', {model:M, generationConfig:{maxOutputTokens:700,
     thinkingConfig:{thinkingBudget:0}}}, 'say ok');
   return res;
 });
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
