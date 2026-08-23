/* Confirms a garment with a photographed turnaround turns continuously in place, the way
   the reference film does - on its own clock, not because anyone dragged the rail - and
   that adjacent angles are crossfaded rather than cut. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
 await p.goto('http://localhost:8100/index.html#/lookbook',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(5000);
 const out=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const rail=window.Motion && Motion.rail && Motion.rail();
   const res={railExposed:!!rail};
   if(!rail) return res;
   const spinners=rail.meshes.filter(m=>m.userData.spinTex && m.userData.spinTex.length);
   res.meshes=rail.meshes.length;
   res.withTurnaround=spinners.map(m=>m.userData.item.slug);
   res.anglesEach=spinners.map(m=>m.userData.spinTex.length);
   if(!spinners.length) return res;
   const m=spinners[0];
   // nobody touches anything: the rail is left alone and the garment should still turn
   const seen=[], mixes=[];
   for(let i=0;i<16;i++){
     await wait(700);
     seen.push(m.userData.spinShown);
     mixes.push(+m.material.uniforms.uMix.value.toFixed(2));
   }
   res.idleAngles=seen;
   res.railMoved = Math.abs(rail.target)>0.001;
   // Total angular advance, not the count of distinct angle indices: headless
   // swiftshader runs slowly enough that the dt clamp throttles the clock, so counting
   // indices under-reports. Summing uMix across its wraps does not care about frame rate.
   let adv=0;
   for(let i=1;i<mixes.length;i++){ const d=mixes[i]-mixes[i-1]; adv += d<0 ? d+1 : d; }
   res.anglesAdvanced=+adv.toFixed(2);
   res.spinsUntouched = adv>1 && !res.railMoved;
   // a dissolve, not a cut: uMix must spend time strictly between the two plates
   res.crossfades = mixes.some(v=>v>0.05&&v<0.95);
   res.mixSamples=mixes;
   return res;
 });
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
