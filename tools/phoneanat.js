/* Why is the garment invisible on a phone past the opening step? */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4500);
 const out=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const R=e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}};
   const sec=document.getElementById('anatomy'); const total=sec.offsetHeight-innerHeight;
   const cam=document.querySelector('.anat-cam'), stage=document.querySelector('.anat-stage');
   const res={stage:R(stage), cam:R(cam), panel:R(document.querySelector('.anat-stage-panel')), steps:[]};
   for(const m of [0,0.22,0.45,0.7,0.99]){
     Motion.scrollTo(sec.offsetTop+total*m,{immediate:true}); await wait(1500);
     const f=document.querySelector('.anat-f.on');
     const fr=f?f.getBoundingClientRect():null;
     res.steps.push({m, src:f&&(f.getAttribute('src')||'').slice(-8),
       complete:f&&f.complete, nat:f&&(f.naturalWidth+'x'+f.naturalHeight),
       op:f&&getComputedStyle(f).opacity,
       frameBox: fr?{x:Math.round(fr.left),y:Math.round(fr.top),w:Math.round(fr.width),h:Math.round(fr.height)}:null,
       camTransform:getComputedStyle(cam).transform,
       camOrigin:getComputedStyle(cam).transformOrigin,
       stageBox:R(stage)});
   }
   return res;
 });
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
