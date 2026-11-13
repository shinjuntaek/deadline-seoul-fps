/* 15 minutes wall-clock browser combat. Bot aims and uses normal weapons;
   health, ammo, enemy damage and wave rules are never overridden. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve('browser-qa');fs.mkdirSync(out,{recursive:true});
const duration=Number(process.env.QA_SOAK_SECONDS||900),report={durationRequestedSeconds:duration,environment:'GitHub Actions Chromium/SwiftShader, automated control, not human/physical-device play',errors:[],samples:[],gc:[]};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-precise-memory-info','--disable-background-timer-throttling']});
 const context=await browser.newContext({viewport:{width:800,height:500}}),page=await context.newPage();
 page.on('crash',()=>report.errors.push('Chromium renderer crashed'));page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:4173')+'/?playtest=soak');
  await page.waitForFunction(()=>window.__DEADLINE_PLAYTEST__?.ready(),null,{timeout:90000});
  await page.locator('#start').click();await page.evaluate(()=>window.__DEADLINE_PLAYTEST__.bot(true));
  const started=Date.now();let lastGC=-1;
  while(Date.now()-started<duration*1000){
   await page.waitForTimeout(10000);
   const value=await page.evaluate(()=>window.__DEADLINE_PLAYTEST__.state());
   const at=(Date.now()-started)/1000;report.samples.push({at,...value});
   if(['gameover','victory'].includes(value.phase))await page.evaluate(()=>window.__DEADLINE_PLAYTEST__.restart());
   if(value.phase==='paused'&&await page.locator('#resume').isVisible())await page.locator('#resume').click();
   const slot=Math.floor(at/300);
   if(slot!==lastGC){lastGC=slot;const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');report.gc.push({at,metrics:(await cdp.send('Runtime.getHeapUsage'))});await cdp.detach();}
   if(report.samples.length%6===0)console.log('SOAK_PROGRESS',JSON.stringify({seconds:Math.round(at),phase:value.phase,wave:value.wave,kills:value.history.kills,contextLosses:value.performance.contextLosses}));
  }
  report.durationActualSeconds=(Date.now()-started)/1000;
  report.final=await page.evaluate(()=>window.__DEADLINE_PLAYTEST__.state());
  await page.screenshot({path:path.join(out,'soak-final.png')});
  const all=new Map();for(const s of report.samples)for(const f of s.performance.samples)all.set(f.at,f);
  report.frameSamples=[...all.values()];
  report.status=report.errors.length||report.final.performance.contextLosses?'FAIL':'COMPLETED';
  report.limitations=['No physical GPU, device thermals or external friend network tested','Automated aim/control; not a human five-wave clear','WebSocket regression is a separate two-context test','No FPS target is inferred from software rendering'];
 }catch(e){report.status='FAIL';report.failure=e.stack;process.exitCode=1}
 finally{fs.writeFileSync(path.join(out,'soak-report.json'),JSON.stringify(report,null,2));await browser.close()}
 if(report.status!=='COMPLETED')process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
