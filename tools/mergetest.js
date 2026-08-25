/* One document, two apps. Confirms each router yields the whole of the other's
   subtree, that the console's stylesheet cannot reach the storefront, and that the
   Firebase layer either syncs or degrades without taking the page down. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))});
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4000);

 const out=await p.evaluate(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const res={};
  const shop=document.getElementById('shop'), ad=document.getElementById('ad');
  res.bothPresent = !!shop && !!ad;

  // --- storefront mode ---
  location.hash='#/'; await wait(700);
  res.shop={ shopHidden:shop.hidden, adHidden:ad.hidden,
             heroRendered: !!document.querySelector('#app .anat, #app section') };
  // the console's palette must not have leaked onto the storefront
  const bodyBg=getComputedStyle(document.body).backgroundColor;
  const btn=document.querySelector('#shop .btn');
  res.shopBtnPad = btn?getComputedStyle(btn).padding:null;
  res.bodyBg=bodyBg;

  // --- console mode ---
  location.hash='#/admin'; await wait(900);
  res.admin={ shopHidden:shop.hidden, adHidden:ad.hidden,
              loginShown: !!ad.querySelector('.login'),
              adLocked: ad.classList.contains('locked'),
              shopStillInDom: !!document.getElementById('app') };

  // Sign in as the owner and check the console actually renders. Two steps now:
  // the PIN is checked against a PBKDF2 hash, then a TOTP code. This runs inside
  // p.evaluate so it cannot call tools/signin.js - same flow, written out.
  const who=ad.querySelector('[data-staff="ha"]');
  if(who){ who.click(); await wait(320);
    try{ localStorage.removeItem('sirhenrys.rl'); }catch(e){}
    const submit=()=>ad.querySelector('#pinForm')
      .dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
    const pin=ad.querySelector('#pinInput');
    if(pin){ pin.value='1967'; submit(); await wait(1500);
      const otp=ad.querySelector('#otpInput');
      if(otp){ otp.value=await SHSec.totp.now(SH.STAFF.find(s=>s.id==='ha').totp);
        submit(); await wait(1700); } } }
  res.signedIn={ view: !!ad.querySelector('#view'),
                 hasNav: ad.querySelectorAll('.side a[data-nav]').length,
                 heading: (ad.querySelector('#view h1')||{}).textContent };

  // navigate inside the console
  location.hash='#/admin/inventory'; await wait(700);
  res.adminRoute={ heading:(ad.querySelector('#view h1')||{}).textContent, shopHidden:shop.hidden };

  // --- back to the storefront ---
  location.hash='#/shop'; await wait(900);
  res.backToShop={ shopHidden:shop.hidden, adHidden:ad.hidden,
                   cards: document.querySelectorAll('#app .card, #app [class*=card]').length };

  // --- firebase ---
  res.firebaseSdk = typeof firebase!=='undefined';
  res.sync = window.SHSync ? SHSync.status() : null;
  res.sharedKeys = SH.SHARED; res.deviceKeys = SH.DEVICE;
  return res;
 });
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
