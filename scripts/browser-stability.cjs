// CI-only actual Chromium UI integration. SwiftShader is not physical GPU QA.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../browser-qa');fs.mkdirSync(output,{recursive:true});
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:4173';
const report={environment:'Two Chromium contexts, SwiftShader software GPU',steps:[],errors:[],performance:[]};
const check=(name,condition,detail)=>{report.steps.push({name,pass:!!condition,detail});assert(condition,name)};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
 try{
  const a=await browser.newContext({viewport:{width:960,height:600}}),b=await browser.newContext({viewport:{width:640,height:420}});
  const host=await a.newPage(),guest=await b.newPage();
  for(const p of [host,guest])p.on('pageerror',e=>report.errors.push(e.message));
  await host.addInitScript(()=>{window.__qaMouse=[];document.addEventListener('mousemove',e=>{window.__qaMouse.push({x:e.movementX,y:e.movementY,locked:!!document.pointerLockElement});if(window.__qaMouse.length>12)window.__qaMouse.shift()})});
  await Promise.all([host.goto(base),guest.goto(base)]);
  for(const p of [host,guest]){await p.locator('#coop-launch').waitFor({timeout:60000});await p.locator('#coop-launch').click()}
  await host.locator('#coop-name').fill('Host QA');await host.locator('#coop-create').click();
  await host.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__?.().room?.length===6);
  const code=(await host.evaluate(()=>window.__DEADLINE_COOP_STATUS__())).room;
  await guest.locator('#coop-name').fill('Guest QA');await guest.locator('#coop-code').fill(code);await guest.locator('#coop-join').click();
  await guest.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__?.().members===2);
  const before=await guest.evaluate(()=>window.__DEADLINE_COOP_STATUS__());
  await guest.locator('#coop-ready').click();await host.locator('#coop-ready').click();await host.locator('#coop-start').click();
  for(const p of [host,guest])await p.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__?.().active);
  check('Two independent browsers enter the same operation',true,{code});
  await guest.keyboard.down('KeyW');await guest.waitForTimeout(700);await guest.keyboard.up('KeyW');
  await host.waitForTimeout(1000);await host.screenshot({path:path.join(output,'stability-two-browser-playing.png')});
  await guest.reload();await guest.locator('#coop-launch').waitFor({timeout:60000});
  if(!await guest.locator('#coop-panel').isVisible())await guest.locator('#coop-launch').click();
  await guest.locator('#coop-recover').click();await guest.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__?.().active);
  const after=await guest.evaluate(()=>window.__DEADLINE_COOP_STATUS__());
  check('Page reload resumes original player and active match',after.playerId===before.playerId&&after.room===code,{before:before.playerId,after:after.playerId,phase:after.phase});
  await guest.screenshot({path:path.join(output,'stability-resumed-match.png')});
  // Repeat explicit menu -> create -> leave -> reopen to detect stale lobby state.
  report.beforeExit=await guest.evaluate(()=>({game:window.__DEADLINE_PERFORMANCE__().samples.at(-1),coop:window.__DEADLINE_COOP_STATUS__()}));
  await guest.keyboard.press('Escape');
  // The authoritative server keeps running while the client reloads. A player
  // may legitimately die during slow software-renderer screenshots.
  await guest.locator('#quit:visible, #result-menu:visible').first().click();
  await guest.locator('#coop-launch').click();
  check('Leaving restores create/join controls',await guest.locator('#coop-create').isVisible()&&await guest.locator('#coop-join').isVisible());
  await guest.locator('#coop-close').click();await guest.locator('#coop-launch').click();
  check('Reopening lobby has no stale share panel',await guest.locator('#coop-create').isVisible()&&!await guest.locator('#coop-copy').isVisible());
  if(await host.locator('#resume').isVisible())await host.locator('#resume').click();
  await host.waitForTimeout(8000);
  await host.screenshot({path:path.join(output,'stability-street-materials.png')});
  report.performance.push(await host.evaluate(()=>window.__DEADLINE_PERFORMANCE__()));
  check('Telemetry includes raw frame time and renderer counters',report.performance[0].samples.some(s=>s.p95FrameMs>0&&s.drawCalls>0));
  check('No unhandled JavaScript errors',report.errors.length===0,report.errors);
  // Dedicated visual QA exercises medium shaders under software GL, without
  // treating these settings or timings as a real GPU performance result.
  await host.goto(base+'?qa=visual');await host.locator('#start').waitFor({timeout:60000});
  // CDP click coordinates retained from the menu can emit repeat warps after
  // pointer lock; keyboard activation verifies start orientation independently.
  await host.mouse.move(0,0);await host.locator('#start').focus();await host.keyboard.press('Enter');await host.waitForTimeout(3500);
  await host.screenshot({path:path.join(output,'seoul-medium-visual-qa.png')});
  report.visual=await host.evaluate(()=>window.__DEADLINE_PERFORMANCE__());
  report.visualMouse=await host.evaluate(()=>window.__qaMouse);
  check('Medium lighting/material path renders',report.visual.quality==='medium');
  check('Keyboard start without look input keeps the camera level',Math.abs(report.visual.view.pitch)<.05,report.visual.view);
  check('No unhandled JavaScript errors after medium render',report.errors.length===0,report.errors);
  report.status='PASS';
 }catch(error){report.status='FAIL';report.failure=error.stack;for(const context of browser.contexts())for(const page of context.pages()){report.failureState=await page.evaluate(()=>({game:window.__DEADLINE_PERFORMANCE__?.().samples.at(-1),coop:window.__DEADLINE_COOP_STATUS__?.()})).catch(()=>null);await page.screenshot({path:path.join(output,'stability-failure.png')}).catch(()=>{});}throw error}
 finally{fs.writeFileSync(path.join(output,'stability-report.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
