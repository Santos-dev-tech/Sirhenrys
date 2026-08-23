const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4000);
 await p.screenshot({path:'C:/Users/ADMIN/New folder (2)/_shots/auth-header.jpg',type:'jpeg',quality:90,
   clip:{x:0,y:0,width:1440,height:130}});
 await p.evaluate(()=>{location.hash='#/account';}); await sleep(1000);
 await p.screenshot({path:'C:/Users/ADMIN/New folder (2)/_shots/auth-signin.jpg',type:'jpeg',quality:88,
   clip:{x:380,y:60,width:680,height:760}});
 await p.evaluate(()=>document.querySelector('[data-authtab="up"]').click()); await sleep(400);
 await p.screenshot({path:'C:/Users/ADMIN/New folder (2)/_shots/auth-signup.jpg',type:'jpeg',quality:88,
   clip:{x:380,y:60,width:680,height:760}});
 console.log('ok');
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
