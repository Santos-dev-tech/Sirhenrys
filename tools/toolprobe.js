/* gemini-3.7-flash answers a bare prompt but is refused once the assistant's tools are
   attached. Isolate which part the server objects to. */
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
 const out=await p.evaluate(async()=>{
   const SDK='https://www.gstatic.com/firebasejs/12.18.0/';
   const [{initializeApp,getApps,getApp},{getAI,getGenerativeModel,GoogleAIBackend,SchemaType}]=
     await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-ai.js')]);
   const app=getApps().length?getApp():initializeApp(window.SH_FIREBASE.config);
   const ai=getAI(app,{backend:new GoogleAIBackend()});
   const M='gemini-3.7-flash';
   const tool={functionDeclarations:[{name:'openScreen',description:'Open a screen',
     parameters:{type:'OBJECT',properties:{screen:{type:'STRING',description:'name'}},required:['screen']}}]};
   const toolLower={functionDeclarations:[{name:'openScreen',description:'Open a screen',
     parameters:{type:'object',properties:{screen:{type:'string',description:'name'}},required:['screen']}}]};
   const res={};
   const run=async(label,cfg,msg)=>{
     try{ const m=getGenerativeModel(ai,cfg);
       const c=m.startChat({history:[]});
       const r=await c.sendMessage(msg||'say ok');
       res[label]='OK -> '+(r.response.text()||'(no text)').trim().slice(0,60);
     }catch(e){ res[label]='FAIL: '+String(e.message||e).slice(0,300); }
   };
   res.exportsSchemaType = typeof SchemaType;
   await run('bare',{model:M});
   await run('systemInstruction only',{model:M,systemInstruction:'You are terse.'});
   await run('generationConfig only',{model:M,generationConfig:{temperature:0.3,maxOutputTokens:700}});
   await run('tools UPPERCASE types',{model:M,tools:[tool]});
   await run('tools lowercase types',{model:M,tools:[toolLower]});
   await run('everything',{model:M,tools:[toolLower],systemInstruction:'You are terse.',
     generationConfig:{temperature:0.3,maxOutputTokens:700}});
   return res;
 });
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
