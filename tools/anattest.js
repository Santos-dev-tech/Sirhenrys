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
  const R=e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),r:Math.round(r.right),b:Math.round(r.bottom)}};
  const res={};
  const sec=document.getElementById('anatomy');
  const total=sec.offsetHeight-innerHeight;
  Motion.scrollTo(sec.offsetTop+total*0.5,{immediate:true}); await wait(500);
  const stage=document.querySelector('.anat-stage'), panel=document.querySelector('.anat-stage-panel');
  res.stage=R(stage); res.panel=R(panel);
  res.sticky=R(document.querySelector('.anat-sticky'));
  res.stickyCols=getComputedStyle(document.querySelector('.anat-sticky')).gridTemplateColumns;
  // what is painted just left of the panel?
  res.probe=[];
  for(const x of [res.panel.x-70,res.panel.x-40,res.panel.x-10,res.panel.x+5,res.panel.x+40]){
    const els=document.elementsFromPoint(x,450).slice(0,3)
      .map(e=>e.tagName+'.'+String(e.className||'').trim().split(/\s+/).join('.'));
    res.probe.push({x,els});
  }
  // per-step: does the copy box overlap the panel box?
  res.steps=[];
  for(let i=0;i<=8;i++){
    Motion.scrollTo(sec.offsetTop+total*(i/8),{immediate:true}); await wait(320);
    const on=document.querySelector('.anat-step.on')||document.querySelector('.anat-step');
    const t=on?R(on):null;
    const overlapsPanel = t ? (t.r > res.panel.x+2) : null;
    const f=document.querySelector('.anat-f.on');
    res.steps.push({p:+(i/8).toFixed(2), copyRight:t&&t.r, panelLeft:res.panel.x, overlapsPanel, frame:f&&(f.getAttribute('src')||'').slice(-8)});
  }
  // intro title
  Motion.scrollTo(sec.offsetTop,{immediate:true}); await wait(400);
  const h=document.querySelector('.anat-intro,.anat-title,.anat h1,.anat-lead');
  res.introSel=h?h.className:null;
  res.intro=h?R(h):null;
  res.introOverlapsPanel=h? (R(h).r > res.panel.x+2):null;
  return res;
 });
 out.errors=[...new Set(errs)];
 console.log(JSON.stringify(out,null,1));
 await b.close();
})().catch(e=>{console.error('FAILED:',e.message);process.exit(1)});
