/**
 * Playwright browser-level smoke test for DEADLINE: SEOUL.
 *
 * Runs against a locally built dist server, not a protected Vercel preview.
 * Tests Chromium with software WebGL (SwiftShader). "mobile" is emulated,
 * never described as an actual phone performance measurement.
 *
 * Run:
 * npm run build
 * python3 -m http.server 4173 --directory dist
 * npm install --no-save playwright@1.56.1
 * npx playwright install chromium
 * node scripts/browser-smoke.cjs
 */
'use strict';
const {chromium,devices}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const reports=path.join(root,'browser-qa');
fs.mkdirSync(reports,{recursive:true});
const url=process.env.GAME_BASE_URL||'http://127.0.0.1:4173';
const args=[
 '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
 '--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
 '--disable-background-timer-throttling','--disable-backgrounding-occluded-windows'
];
const cases=[
  {name:'desktop',options:{viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:false}},
  {name:'mobile-emulated',options:{...devices['Pixel 7'],deviceScaleFactor:2}}
];
const results=[];
async function runCase(browser,variant){
  const name=variant.name;
  const context=await browser.newContext(variant.options);
  const page=await context.newPage();
  const errors=[],failedRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',req=>failedRequests.push({url:req.url(),error:req.failure()}));
  const result={device:name,viewport:variant.options.viewport??'emulated Pixel 7',status:'PENDING',steps:[],errors,failedRequests};
  const check=(label,ok,actual)=>{result.steps.push({label,pass:!!ok,actual});assert(ok,label+': '+JSON.stringify(actual))};
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.locator('#menu:not(.hidden)').waitFor({state:'visible',timeout:60000});
    await page.screenshot({path:path.join(reports,name+'-menu.png')});
    check('menu visible',await page.locator('#start').isVisible(),true);
    await page.locator('#start').click({timeout:15000});
    await page.locator('#hud-top:not(.hidden)').waitFor({state:'visible',timeout:30000});
    check('gameplay HUD visible',await page.locator('#menu').evaluate(el=>el.classList.contains('hidden')),true);
    await page.locator('#wave-label').waitFor({state:'visible'});
    const wave=(await page.locator('#wave-label').innerText()).trim();
    check('wave 1 starts',/WAVE\s*0?1/.test(wave),wave);
    const ammoBefore=+(await page.locator('#ammo').innerText());
    check('rifle ammo 30',ammoBefore===30,ammoBefore);
    await page.screenshot({path:path.join(reports,name+'-wave1.png')});
    // Genuine mouse input, not a direct game-engine function invocation.
    if(name==='desktop'){
      try{
        const canvas=page.locator('#game');
        const box=await canvas.boundingBox();
        assert(box,'Canvas missing bounding rect');
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.down();
        await page.waitForTimeout(250);
        await page.mouse.up();
        const ammoAfter=+(await page.locator('#ammo').innerText());
        result.steps.push({label:'physical mouse event fires rifle',pass:ammoAfter<ammoBefore,actual:{before:ammoBefore,after:ammoAfter}});
        if(ammoAfter<ammoBefore){
          await page.keyboard.press('r');
          const reloadStatus=await page.locator('#weapon-status').innerText();
          result.steps.push({label:'keyboard R initiates reload',pass:reloadStatus.includes('RELOADING'),actual:reloadStatus});
          await page.waitForTimeout(1800);
          const reloaded=+(await page.locator('#ammo').innerText());
          result.steps.push({label:'reload refills magazine',pass:reloaded>ammoAfter,actual:{afterShot:ammoAfter,reloaded}});
        }
      }catch(err){result.steps.push({label:'physical mouse test',pass:false,actual:String(err)})}
    }else{
      check('touch controls visible',await page.locator('#touch').isVisible(),true);
      check('touch fire available',await page.locator('#touch-fire').isVisible(),true);
      await page.locator('#touch-fire').tap({timeout:5000});
      await page.waitForTimeout(150);
      const ammoAfter=+(await page.locator('#ammo').innerText());
      result.steps.push({label:'touch FIRE decreases ammo',pass:ammoAfter<ammoBefore,actual:{before:ammoBefore,after:ammoAfter}});
    }
    // Fast engine-driven 5-wave verification runs in an isolated page,
    // expressly not represented as a natural human playthrough.
    const qa=await context.newPage();
    qa.on('pageerror',e=>errors.push('release-QA: '+e.message));
    await qa.goto(url+'/?qa=release',{waitUntil:'domcontentloaded',timeout:60000});
    await qa.locator('#release-qa-report').waitFor({state:'visible',timeout:60000});
    await qa.waitForFunction(()=>{
       try{const r=JSON.parse(document.querySelector('#release-qa-report')?.textContent||'{}');return r.status==='PASS'||r.status==='FAIL'}catch{return false}
    },{timeout:60000});
    const report=JSON.parse(await qa.locator('#release-qa-report').innerText());
    result.integration={status:report.status,passed:report.passed,at:report.at,error:report.error,waves:report.waves};
    check('all 5-wave engine integration tests pass',report.status==='PASS',report.error??report.passed);
    await qa.screenshot({path:path.join(reports,name+'-five-waves.png')});
    await qa.close();
    result.status=result.steps.every(t=>t.pass)?'PASS':'PARTIAL';
  }catch(err){
    result.status='FAIL';
    result.error=err.message;
    try{await page.screenshot({path:path.join(reports,name+'-failure.png')})}catch{}
  }finally{
    result.hardwareClassification=name==='mobile-emulated'?'Chromium Pixel 7 emulation; NOT physical mobile hardware':'headless Chromium/SwiftShader';
    await context.close();
  }
  return result;
}
(async()=>{
  const browser=await chromium.launch({headless:true,args});
  try{for(const v of cases){const result=await runCase(browser,v);results.push(result);console.log('BROWSER_QA_CASE',JSON.stringify(result))}}
  finally{await browser.close()}
  fs.writeFileSync(path.join(reports,'results.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));
  if(results.some(r=>r.status==='FAIL'||r.steps.some(x=>!x.pass)))process.exitCode=1;
})().catch(err=>{console.error(err.stack||String(err));process.exitCode=1});
