const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120))});
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4000);
 const out=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const res={};
   res.overflow=[];
   const sec=document.getElementById('anatomy');
   const check=n=>{const w=document.documentElement.scrollWidth;
     if(w>window.innerWidth+1) res.overflow.push(n+':'+w+'>'+window.innerWidth);};
   check('home');
   // does the copy sit clear of the stage on a phone?
   const stage=document.querySelector('.anat-stage'), step=document.querySelector('.anat-step.on');
   const sr=stage.getBoundingClientRect(), tr=step?step.getBoundingClientRect():null;
   res.stageBox={t:Math.round(sr.top),h:Math.round(sr.height),w:Math.round(sr.width)};
   res.copyBox=tr?{t:Math.round(tr.top),h:Math.round(tr.height)}:null;
   res.copyBelowStage = tr? tr.top >= sr.bottom-4 : null;
   // scrub through the sequence on touch
   const total=sec.offsetHeight-innerHeight; const seen=[];
   const all=[...document.querySelectorAll('.anat-f')];
   for(let i=0;i<=6;i++){
     Motion.scrollTo(sec.offsetTop+total*(i/6),{immediate:true}); await wait(300);
     const on=document.querySelector('.anat-f.on'); seen.push(on?all.indexOf(on):-1);
   }
   res.frameWalk=seen;
   res.scrubsOnPhone = seen[seen.length-1] > seen[0];
   for(const h of ['/shop','/product/carlo-navy','/bespoke','/wedding','/corporate','/checkout']){
     location.hash=h; await wait(400); check(h);
   }
   // tap targets
   location.hash='/product/carlo-navy'; await wait(600);
   const small=[...document.querySelectorAll('button,a.btn,.sizes button')]
     .filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && (r.height<40||r.width<40);}).length;
   res.tapTargetsUnder40px=small;
   res.spinnerOnPhone=!!document.querySelector('[data-spin]');
   return res;
 });
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await p.screenshot({path:'C:/Users/ADMIN/New folder (2)/_shots/mobile-anat.jpg',type:'jpeg',quality:85});
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
