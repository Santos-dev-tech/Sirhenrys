/* Same question, two deploys. sir-henrys.web.app predates appcheck.js; sirhenrys.pages.dev
   has it active. If one answers and the other does not, App Check is the difference. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function trial(b,url){
 const p=await b.newPage(); await p.setViewport({width:1280,height:800});
 const out={url};
 try{
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction(()=>window.SHAI&&(SHAI.status().ready||SHAI.status().error),
    {timeout:40000,polling:400}).catch(()=>{});
  await sleep(1500);
  out.appCheck = await p.evaluate(()=>window.SHAppCheck?SHAppCheck.status().on:'no appcheck.js');
  const t0=Date.now();
  out.result = await p.evaluate(async()=>{
    const SDK='https://www.gstatic.com/firebasejs/12.18.0/';
    const [{getApps,getApp},{getAI,getGenerativeModel,GoogleAIBackend}]=
      await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-ai.js')]);
    const ai=getAI(getApp(),{backend:new GoogleAIBackend()});
    const m=getGenerativeModel(ai,{model:'gemini-3.7-flash',generationConfig:{maxOutputTokens:40}});
    try{ const r=await m.generateContent('say ok'); return {ok:true,text:(r.response.text()||'').trim().slice(0,40)}; }
    catch(e){ return {ok:false,err:String(e.message||e).slice(0,180)}; }
  });
  out.ms = Date.now()-t0;
 }catch(e){ out.fatal=String(e.message).slice(0,120); }
 await p.close();
 return out;
}
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
   protocolTimeout:240000});
 const a=await trial(b,'https://sir-henrys.web.app');
 const c=await trial(b,'https://sirhenrys.pages.dev');
 console.log(JSON.stringify([a,c],null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
