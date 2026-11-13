/* Actual Chromium combat with skinned GLB assets; software GPU, no device claim. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve('browser-qa');fs.mkdirSync(out,{recursive:true});
const report={environment:'Chromium / SwiftShader',errors:[],checks:[]};
const check=(name,pass,detail)=>{report.checks.push({name,pass,detail});assert(pass,name)};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-precise-memory-info']});
 const context=await browser.newContext({viewport:{width:960,height:600},recordVideo:{dir:path.join(out,'video'),size:{width:640,height:400}}});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('crash',()=>report.errors.push('renderer process crashed'));
 try{
  await page.goto((process.env.GAME_BASE_URL||'http://127.0.0.1:4173')+'/?playtest=1');
  await page.waitForFunction(()=>window.__DEADLINE_PLAYTEST__?.ready(),null,{timeout:90000});
  await page.locator('#start').click();await page.evaluate(()=>window.__DEADLINE_PLAYTEST__.stage());
  await page.waitForTimeout(1200);
  const before=await page.evaluate(()=>window.__DEADLINE_PLAYTEST__.state());
  check('Two skinned types are present in actual combat',before.art.skinned===5,before.art);
  await page.screenshot({path:path.join(out,'skinned-combat-before-shooting.png')});
  await page.evaluate(()=>window.__DEADLINE_PLAYTEST__.aimAtEnemy());
  await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();
  await page.waitForFunction(()=>window.__DEADLINE_PLAYTEST__.state().ammo<30,null,{timeout:10000});
  check('Short mouse press fires with skinned enemies',true);
  await page.keyboard.press('KeyR');await page.waitForTimeout(600);
  await page.screenshot({path:path.join(out,'anatomical-hand-reload.png')});
  await page.evaluate(()=>window.__DEADLINE_PLAYTEST__.bot(true));
  await page.waitForTimeout(18000);
  const after=await page.evaluate(()=>window.__DEADLINE_PLAYTEST__.state());
  check('Skeleton pose changes during pursuit',JSON.stringify(before.rig)!==JSON.stringify(after.rig),{before:before.rig,after:after.rig});
  check('Damage or kills resolve through live combat',after.kills>0||after.health<100,after);
  check('Near detail remains bounded',after.art.near<=10,after.art);
  check('No browser JavaScript errors',report.errors.length===0,report.errors);
  await page.screenshot({path:path.join(out,'skinned-combat-after.png')});
  report.final=after;report.status='PASS';
 }catch(e){report.status='FAIL';report.failure=e.stack;await page.screenshot({path:path.join(out,'skinned-failure.png')}).catch(()=>{});throw e}
 finally{await context.close();await browser.close();fs.writeFileSync(path.join(out,'characters-report.json'),JSON.stringify(report,null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
