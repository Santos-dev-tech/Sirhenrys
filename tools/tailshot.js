/* What does the anatomy section look like as it ends and hands over to the next one? */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4500);
 const geo=await p.evaluate(()=>{const s=document.getElementById('anatomy');
   return {top:s.offsetTop,h:s.offsetHeight,vh:innerHeight,doc:document.body.scrollHeight};});
 console.log(JSON.stringify(geo));
 // absolute scroll positions: the last stretch of the section, then past its end
 const end=geo.top+geo.h-geo.vh;
 const marks=[end-geo.vh*1.2, end-geo.vh*0.6, end, end+geo.vh*0.5, end+geo.vh*1.0, end+geo.vh*1.6];
 for(let i=0;i<marks.length;i++){
   await p.evaluate(y=>Motion.scrollTo(y,{immediate:true}), Math.round(marks[i]));
   await sleep(1500);
   await p.screenshot({path:`C:/Users/ADMIN/New folder (2)/_shots/tail-${i}.jpg`,type:'jpeg',quality:86});
 }
 console.log('shot',marks.length);
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
