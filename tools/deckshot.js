const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage(); await p.setViewport({width:1600,height:900,deviceScaleFactor:1});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
 await p.goto('http://localhost:8100/pitch/'+(process.env.DECK||'Sir-Henrys-Proposal.html'),{waitUntil:'networkidle2',timeout:90000});
 await sleep(3000);
 const n=await p.evaluate(()=>document.querySelectorAll('.slide').length);
 const want=(process.env.SLIDES||'1,2,3,5,6,12,13,16').split(',').map(Number);
 for(const s of want){
   await p.evaluate(k=>{ for(let j=0;j<k-1;j++) dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'})); }, s);
   await sleep(1200);
   await p.screenshot({path:`C:/Users/ADMIN/New folder (2)/_shots/${process.env.PFX||'deck'}-${String(s).padStart(2,'0')}.jpg`,type:'jpeg',quality:88});
   await p.reload({waitUntil:'networkidle2'}); await sleep(1500);
 }
 // overflow check: nothing should spill past its slide
 const over=await p.evaluate(()=>{
   const bad=[];
   document.querySelectorAll('.slide').forEach((s,i)=>{
     s.classList.add('on');
     s.querySelectorAll('.pad, .split-txt, .display, .foot, .sub, .col, .stat, .step, .six, .week').forEach(el=>{
       const r=el.getBoundingClientRect();
       if(r.bottom>innerHeight+2||r.right>innerWidth+2||r.top<-2)
         bad.push(`slide ${i+1}: ${el.className.split(' ')[0]} ${Math.round(r.top)}..${Math.round(r.bottom)} (vh ${innerHeight})`);
     });
     s.classList.remove('on');
   });
   return bad.slice(0,14);
 });
 console.log(JSON.stringify({slides:n, overflow:over, errors:[...new Set(errs)]},null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
