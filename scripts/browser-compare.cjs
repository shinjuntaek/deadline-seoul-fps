/* Controlled in-engine comparison: same camera, medium quality, five enemies,
   seeded world and one simulated second. Simulation pauses for the capture. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve('browser-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const states=[];
 for(const [label,base] of [['before','http://127.0.0.1:4174'],['after','http://127.0.0.1:4173']]){
  const context=await browser.newContext({viewport:{width:960,height:600},deviceScaleFactor:1});const page=await context.newPage();
  await page.addInitScript(()=>{let s=6123;Math.random=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296}});
  await page.route('**/game.js',async route=>{
   const response=await route.fetch();let code=await response.text();
   code=code.replace('const ultraLow=softwareGPU||cores<=2;','const ultraLow=false;').replace("let quality=ultraLow?'low':settings.quality;","let quality='medium';");
   code=code.replace('function frame(){',`let compareFrozen=false;
window.__DEADLINE_COMPARE__=()=>{
 startRun();clearRun();spawnQueue=[];waveIndex=0;stats.wave=1;nextWave=-1;settings.quality='medium';renderScale=1;resize();
 camera.position.set(0,PLAYER.height,24);yaw=0;pitch=-.04;camera.rotation.set(pitch,yaw,0,'YXZ');
 for(const [kind,x,z] of [['walker',-2,17],['runner',2.1,15],['walker',-.3,10],['runner',-4,6],['walker',4,4]])createEnemy(kind,new THREE.Vector3(x,0,z));
 for(let i=0;i<20;i++){for(const z of enemies)updateEnemy(z,.05);if(typeof humanFrame==='function')humanFrame(.05)}
 if(typeof viewmodelFrame==='function')viewmodelFrame(.05);
 dom['wave-banner'].classList.remove('show');dom['letterbox'].classList.remove('active');dom['center-message'].textContent='';
 compareFrozen=true;return{camera:camera.position.toArray(),yaw,pitch,quality,renderScale,enemies:enemies.map(z=>({kind:z.kind,position:z.group.position.toArray()}))};
};
function frame(){`);
   code=code.replace('dt=Math.min(rawDt,.05)','dt=compareFrozen?0:Math.min(rawDt,.05)').replace('const dt=Math.min(clock.getDelta(),.05)','const dt=compareFrozen?0:Math.min(clock.getDelta(),.05)');
   await route.fulfill({response,body:code});
  });
  await page.goto(base+'/?qa=visual');await page.locator('#start').waitFor({timeout:90000});await page.waitForLoadState('networkidle');
  if(label==='after')await page.waitForFunction(()=>window.__DEADLINE_ZOMBIE_ART__?.().assetsReady,null,{timeout:90000});
  await page.locator('#start').click();const state=await page.evaluate(()=>window.__DEADLINE_COMPARE__());
  await page.waitForTimeout(4000);await page.screenshot({path:path.join(out,'combat-'+label+'-same-camera.png')});
  states.push({label,...state,method:'Fixed in-engine comparison, simulation paused after 20 × 50 ms, not a performance sample'});await context.close();
 }
 fs.writeFileSync(path.join(out,'comparison-conditions.json'),JSON.stringify(states,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
