/* Customer sign in / create account, and that the header says which you are. */
const puppeteer=require('puppeteer-core');
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8100/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 await sleep(4000);
 const out=await p.evaluate(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const res={};
  res.homeIconInNav = !!document.querySelector('.nav .navhome');
  const si=document.querySelector('[data-signin]');
  res.signInControl = !!si;
  res.signInLabel = si ? si.textContent.trim() : null;
  if(si){const r=si.getBoundingClientRect();
    res.signInBox={w:Math.round(r.width),h:Math.round(r.height),visible:r.width>0&&r.top<200};}

  location.hash='#/account'; await wait(900);
  res.signedOutShowsForm = !!document.querySelector('.auth-form[data-authform="in"]');
  res.hasCreateTab = !!document.querySelector('[data-authtab="up"]');
  res.linksToConsole = !!document.querySelector('.auth-foot a[href="#/admin"]');

  // switching tabs must not lose typed input
  document.getElementById('ai-email').value='typed@example.com';
  document.querySelector('[data-authtab="up"]').click(); await wait(200);
  res.upFormShown = !document.querySelector('[data-authform="up"]').classList.contains('hide');
  document.querySelector('[data-authtab="in"]').click(); await wait(200);
  res.keepsTypedValue = document.getElementById('ai-email').value==='typed@example.com';

  res.hasBackend = SHAuth.hasBackend();
  return res;
 });
 // a real round trip against whatever the project allows
 const email='test'+Date.now()+'@example.com';
 const signup=await p.evaluate(async e=>{
   const r=await SHAuth.signUp('Test Buyer', e, 'sirhenrys123');
   return {ok:r.ok, local:!!r.local, error:r.error||null, current:SHAuth.current()};
 }, email);
 out.signUp=signup;
 if(signup.ok){
   await p.evaluate(()=>{location.hash='#/';}); await sleep(700);
   out.headerAfterSignUp=await p.evaluate(()=>document.querySelector('[data-signin-label]').textContent.trim());
   await p.evaluate(()=>{location.hash='#/account';}); await sleep(700);
   out.accountShowsName=await p.evaluate(()=>{const h=document.querySelector('#app h2');return h?h.textContent.trim():null;});
   out.signOutButton=await p.evaluate(()=>!!document.querySelector('[data-signout]'));
   await p.evaluate(async()=>{await SHAuth.signOut();}); await sleep(900);
   await p.evaluate(()=>{location.hash='#/account';}); await sleep(700);
   out.afterSignOutShowsForm=await p.evaluate(()=>!!document.querySelector('.auth-form'));
   out.syncStillOn=await p.evaluate(()=>SHSync.status().on);
 }
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
