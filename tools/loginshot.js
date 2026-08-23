const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 // exactly what a person does: land on the site, then click Staff Login
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4000);
 await p.screenshot({path:'C:/Users/ADMIN/New folder (2)/_shots/login-0-home.jpg',type:'jpeg',quality:82});
 const info=await p.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const res={};
   const link=[...document.querySelectorAll('#shop a')].find(a=>/staff/i.test(a.textContent));
   res.footerLinkFound=!!link;
   location.hash='#/admin'; await wait(1200);
   const ad=document.getElementById('ad'), shop=document.getElementById('shop');
   res.adHidden=ad.hidden; res.shopHidden=shop.hidden;
   res.adHTMLlen=ad.innerHTML.length;
   res.hasLoginCard=!!ad.querySelector('.login');
   res.adLocked=ad.classList.contains('locked');
   const r=ad.getBoundingClientRect();
   res.adBox={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};
   const c=ad.querySelector('.login-card');
   if(c){const cr=c.getBoundingClientRect();
     res.cardBox={x:Math.round(cr.left),y:Math.round(cr.top),w:Math.round(cr.width),h:Math.round(cr.height)};}
   res.buttons=[...ad.querySelectorAll('[data-staff]')].map(b=>b.textContent.trim().slice(0,40));
   return res;
 });
 await sleep(600);
 await p.screenshot({path:'C:/Users/ADMIN/New folder (2)/_shots/login-1-admin.jpg',type:'jpeg',quality:82});
 info.errors=[...new Set(errs)];
 console.log(JSON.stringify(info,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
