const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 await p.goto('http://localhost:8100/index.html#/admin',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4500);
 const before=await p.evaluate(()=>{const f=document.getElementById('aiFab');
   return {exists:!!f, display:f?getComputedStyle(f).display:null,
           bodyClass:document.body.className, adHidden:document.getElementById('ad').hidden};});
 await p.screenshot({path:'C:/Users/ADMIN/New folder (2)/_shots/fab-0-login.jpg',type:'jpeg',quality:80});
 // sign in exactly as a person does
 await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const ad=document.getElementById('ad');
   ad.querySelector('[data-staff="ha"]').click(); await wait(400);
   ad.querySelector('#pinInput').value='1967';
   ad.querySelector('#pinForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
 });
 await sleep(1800);
 const after=await p.evaluate(()=>{const f=document.getElementById('aiFab');
   const r=f?f.getBoundingClientRect():null;
   return {exists:!!f, display:f?getComputedStyle(f).display:null,
           box:r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null,
           hasClickHandler:f?!!f.onclick:null,
           cs:f?(()=>{const c=getComputedStyle(f);return {position:c.position,right:c.right,bottom:c.bottom,
             padding:c.padding,zIndex:c.zIndex,visibility:c.visibility,opacity:c.opacity,
             width:c.width,height:c.height,fontSize:c.fontSize};})():null,
           parents:(()=>{const out=[];let n=f;while(n&&n!==document.body){out.push(n.tagName+'#'+(n.id||'')+'.'+(n.className||''));n=n.parentElement;}return out;})(),
           ruleMatches:(()=>{try{return [...document.styleSheets].flatMap(ss=>{try{return [...ss.cssRules]}catch(e){return []}})
             .filter(r=>r.selectorText&&r.selectorText.includes('ai-fab')).map(r=>r.selectorText);}catch(e){return ['err']}})(),
           panelExists:!!document.getElementById('aiPanel'),
           bodyClass:document.body.className};});
 await p.screenshot({path:'C:/Users/ADMIN/New folder (2)/_shots/fab-1-signedin.jpg',type:'jpeg',quality:80});
 console.log(JSON.stringify({before,after},null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
