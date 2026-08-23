const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const W=+(process.env.W||1440), H=+(process.env.H||900), TAG=process.env.TAG||'desk';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:W,height:H,deviceScaleFactor:1,isMobile:W<800,hasTouch:W<800});
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4500);
 const marks=[0,0.22,0.45,0.7,0.99];
 for(let i=0;i<marks.length;i++){
   await p.evaluate(m=>{const s=document.getElementById('anatomy');
     Motion.scrollTo(s.offsetTop+(s.offsetHeight-innerHeight)*m,{immediate:true});},marks[i]);
   await sleep(1600);   // let the eased camera and frame index settle
   await p.screenshot({path:`C:/Users/ADMIN/New folder (2)/_shots/anat-${TAG}-${i}.jpg`,type:'jpeg',quality:88});
 }
 console.log('shot',marks.length,TAG,W+'x'+H);
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
