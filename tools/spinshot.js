/* Capture the product-page spinner at even points around one revolution. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await p.goto('http://localhost:8100/index.html#/product/carlo-navy',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4500);
 // Park the idle turn first. Setting frames by hand while the rAF loop is running is
 // pointless - it repaints from its own position on the very next frame, which is why
 // the first attempt captured eight arbitrary moments instead of eight even ones.
 await p.evaluate(()=>{const e=document.querySelector('[data-spin]');
   e.scrollIntoView({block:'center'});
   e.dispatchEvent(new PointerEvent('pointerdown',{clientX:0,clientY:0,bubbles:true,pointerId:1}));
   e.dispatchEvent(new PointerEvent('pointerup',{clientX:0,clientY:0,bubbles:true,pointerId:1}));});
 await sleep(400);
 const box=await p.evaluate(()=>{const r=document.querySelector('[data-spin]').getBoundingClientRect();
   return {x:Math.max(0,Math.round(r.left)),y:Math.max(0,Math.round(r.top)),
           w:Math.round(r.width),h:Math.round(r.height)};});
 for(let k=0;k<8;k++){
   // drive the sequence directly so the shots are evenly spaced round the turn
   await p.evaluate(k=>{const e=document.querySelector('[data-spin]');
     // re-park so the idle clock cannot advance during the capture
     e.dispatchEvent(new PointerEvent('pointerdown',{clientX:0,clientY:0,bubbles:true,pointerId:1}));
     e.dispatchEvent(new PointerEvent('pointerup',{clientX:0,clientY:0,bubbles:true,pointerId:1}));
     const fr=[...document.querySelectorAll('.spin-f')];
     const i=Math.round(k*fr.length/8)%fr.length;
     fr.forEach(f=>{f.style.opacity=0;f.classList.remove('on')});
     fr[i].style.opacity=1; fr[i].classList.add('on');},k);
   await sleep(120);
   await p.screenshot({path:`C:/Users/ADMIN/New folder (2)/_shots/spin-${k}.jpg`,type:'jpeg',quality:88,clip:{x:box.x,y:box.y,width:box.w,height:box.h}});
 }
 console.log(JSON.stringify(box));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
