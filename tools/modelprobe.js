/* Which Gemini model names will THIS project actually accept? Guessing has cost two
   rounds already; ask it. Each name gets one trivial prompt and its raw error. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage();
 await p.setViewport({width:1280,height:800});
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(5000);
 await p.evaluate(v=>{window.__SDKV=v;}, process.env.SDKV||'12.18.0');
 const names=['gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.7-flash-lite'];
 const out=await p.evaluate(async(names)=>{
   const SDK='https://www.gstatic.com/firebasejs/'+(window.__SDKV||'12.18.0')+'/';
   const [{initializeApp,getApps,getApp},{getAI,getGenerativeModel,GoogleAIBackend}]=
     await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-ai.js')]);
   const app=getApps().length?getApp():initializeApp(window.SH_FIREBASE.config);
   const ai=getAI(app,{backend:new GoogleAIBackend()});
   const res={};
   for(const n of names){
     try{
       const m=getGenerativeModel(ai,{model:n,generationConfig:{maxOutputTokens:8}});
       const r=await m.generateContent('say ok');
       res[n]='OK -> '+(r.response.text()||'').trim().slice(0,20);
     }catch(e){ res[n]='FAIL: '+String(e.message||e).slice(0,400); }
   }
   return res;
 },names);
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
