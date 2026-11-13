'use strict';
const{chromium,devices}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
const out='browser-qa/campaign';fs.mkdirSync(out,{recursive:true});
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:4173';
const report={environment:'GitHub Actions Ubuntu / real Chromium / SwiftShader software WebGL; mobile is viewport+touch emulation, not hardware',method:'Native keyboard/mouse/touch checks. Stage progression uses explicitly labelled loopback-only test positioning and enemy clearing; not an unaided full campaign clear.',steps:[],errors:[],screenshots:[],performance:[]};
const check=(name,ok,data)=>{report.steps.push({name,pass:!!ok,data});assert(ok,name+': '+JSON.stringify(data))};
const state=p=>p.evaluate(()=>window.__DEADLINE_CAMPAIGN_STATUS__());
async function shot(p,name){const file=out+'/'+name+'.png';await p.screenshot({path:file});report.screenshots.push(file)}
async function open(c){const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('crash',()=>report.errors.push('PAGE_CRASH'));await p.goto(base+'/?campaignQA=1',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__,null,{timeout:60000});return p}
async function perf(p,label){const r=await p.evaluate(async()=>{const times=[],start=performance.now();let last=start;await new Promise(resolve=>{function frame(t){times.push(t-last);last=t;if(t-start>5000)resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)});times.sort((a,b)=>a-b);return{...window.__DEADLINE_CAMPAIGN_STATUS__(),frames:times.length,meanFPS:1000/(times.reduce((a,b)=>a+b,0)/times.length),p95ms:times[Math.floor(times.length*.95)],heap:performance.memory?.usedJSHeapSize}});report.performance.push({label,...r})}
async function walk(p,key,ms){await p.keyboard.down(key);await p.waitForTimeout(ms);await p.keyboard.up(key)}
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows']});let c;
try{
 c=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,recordVideo:{dir:out+'/video',size:{width:960,height:540}}});const p=await open(c);
 await shot(p,'00-menu');await p.locator('#campaign-start').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__().mode==='campaign');
 await p.mouse.move(0,0);await p.evaluate(()=>window.__CAMPAIGN_TEST__.position(0,12));
 const start=await state(p);check('campaign initializes original first-person game',start.phase==='playing'&&start.position.z===12,start);
 await p.keyboard.down('w');await p.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__().position.z<8,null,{timeout:30000});await p.keyboard.up('w');const moved=await state(p);check('native keyboard travels forward in larger route',moved.position.z<start.position.z-3,moved.position);
 await p.mouse.down();await p.waitForTimeout(220);await p.mouse.up();check('native rifle fire spends ammo',(await state(p)).ammo<30,await state(p));await p.keyboard.press('r');await p.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__().ammo===30,null,{timeout:12000});check('native reload restores magazine',(await state(p)).ammo===30,await state(p));
 await p.waitForTimeout(1800);await shot(p,'01-alley');await perf(p,'alley exploration');
 const gates=[-88,-198,-318],triggers=[-31,-139,-248];
 for(let i=0;i<3;i++){
  await p.evaluate(z=>window.__CAMPAIGN_TEST__.position(0,z),triggers[i]-1);await p.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__().campaign.status==='combat');await p.waitForTimeout(2200);
  check('stage '+(i+1)+' movement trigger starts horde',(await state(p)).enemies>0,await state(p));
  await shot(p,'0'+(i+2)+'-stage-'+(i+1)+'-combat');
  if(i===0){
   const before=(await state(p)).kills;
   // Test-assisted aim, actual mouse firing and actual game hit detection/AI.
   for(let n=0;n<28&&(await state(p)).kills===before;n++){
    await p.evaluate(()=>{const t=window.__CAMPAIGN_TEST__.targets()[0];if(t)window.__CAMPAIGN_TEST__.aim(t.x,t.z,2)});
    await p.mouse.down();await p.waitForTimeout(160);await p.mouse.up();await p.waitForTimeout(60);
   }
   check('actual raycast shooting kills a moving campaign zombie',(await state(p)).kills>before,await state(p));
  }
  const locked=await p.evaluate(z=>{try{window.__CAMPAIGN_TEST__.position(0,z);return false}catch{return true}},gates[i]-1);check('locked gate prevents skipping combat '+i,locked);
  await perf(p,'stage '+(i+1)+' combat');
  await p.evaluate(()=>window.__CAMPAIGN_TEST__.clearEncounter());await p.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__().campaign.status==='regroup');
  await p.evaluate(z=>window.__CAMPAIGN_TEST__.position(0,z),gates[i]+5);
  if(i<2){await p.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__().campaign.status==='open',null,{timeout:60000});await p.waitForTimeout(1000);await shot(p,'gate-'+(i+1)+'-open');await p.keyboard.down('w');await p.waitForFunction(stage=>window.__DEADLINE_CAMPAIGN_STATUS__().campaign.stage===stage,i+1,{timeout:45000});await p.keyboard.up('w');check('walk through unlocked gate advances chapter '+i,(await state(p)).campaign.stage===i+1,await state(p))}
  else{await p.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__().phase==='victory',null,{timeout:120000});await p.waitForTimeout(600);await shot(p,'07-rescued');check('final regroup produces victory',(await state(p)).campaign.status==='complete',await state(p))}
 }
 // Restart/menu: no repeated map allocations, survival still selectable.
 await p.locator('#result-menu').click();await p.locator('#campaign-start').focus();await p.keyboard.press('Enter');await p.waitForTimeout(1500);await perf(p,'campaign restart');
 await p.evaluate(()=>window.__CAMPAIGN_TEST__.returnMenu());await p.locator('#start').focus();await p.keyboard.press('Enter');await p.waitForTimeout(300);check('original survival remains functional',(await state(p)).mode==='survival'&&/WAVE/.test(await p.locator('#wave-label').innerText()),await state(p));
 await c.close();c=null;
 const mobile=await browser.newContext({...devices['Pixel 7'],deviceScaleFactor:1});const mp=await open(mobile);await mp.locator('#campaign-start').tap();await mp.waitForTimeout(1800);check('mobile campaign and touch HUD start',await mp.locator('#touch-fire').isVisible(),await state(mp));await mp.locator('#touch-fire').tap();await mp.waitForTimeout(100);check('mobile native touch shoots',(await state(mp)).ammo<30,await state(mp));await shot(mp,'08-mobile');await mobile.close();
 // Real two browser clients / real same-origin WebSocket adapter.
 const ca=await browser.newContext({viewport:{width:960,height:640}}),cb=await browser.newContext({viewport:{width:960,height:640}});const a=await open(ca),b=await open(cb);
 await a.locator('#coop-launch').click();await a.locator('#coop-mode').selectOption('campaign');await a.locator('#coop-name').fill('선발대');await a.locator('#coop-create').click();await a.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__().room);
 const code=await a.evaluate(()=>window.__DEADLINE_COOP_STATUS__().room);await b.locator('#coop-launch').click();await b.locator('#coop-name').fill('후발대');await b.locator('#coop-code').fill(code);await b.locator('#coop-join').click();await b.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__().members===2);
 await a.locator('#coop-ready').click();await b.locator('#coop-ready').click();await a.locator('#coop-start').click();await a.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__().active);await b.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__().active);await a.mouse.move(0,0);await b.mouse.move(0,0);
 check('room mode synchronized to both clients',(await state(a)).mode==='campaign'&&(await state(b)).mode==='campaign',{a:await state(a),b:await state(b)});
 await shot(a,'09-coop');await a.keyboard.down('w');await a.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__().position.z<8,null,{timeout:30000});await a.keyboard.up('w');
 await b.waitForFunction(()=>window.__DEADLINE_CAMPAIGN_STATUS__().peers.some(p=>p.z<8),null,{timeout:15000});
 check('peer receives native campaign movement beyond initial spawn',true,{a:await state(a),b:await state(b)});
 check('both WebSockets open',(await state(a)).ws===1&&(await state(b)).ws===1,true);
 await ca.close();await cb.close();
 check('no uncaught browser errors or crashes',report.errors.length===0,report.errors);
 report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;console.error(e);process.exitCode=1}
finally{if(c)await c.close();await browser.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.steps.length,failure:report.failure,performance:report.performance},null,2))}
})();
