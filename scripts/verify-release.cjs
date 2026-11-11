/**
 * DEADLINE: SEOUL deterministic build-time regression checks.
 * Static checks supplement (do NOT replace) real browser playtesting.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist');
const read=name=>fs.readFileSync(path.join(dist,name),'utf8');
const html=read('index.html'),js=read('game.js'),css=read('style.css'),sw=read('service-worker.js');
const conf=JSON.parse(read('vercel.json'));
const tests=[];
function test(name,fn){fn();tests.push(name);console.log('QA_PASS',name)}
test('Game script parses in Node',()=>cp.execFileSync(process.execPath,['--check',path.join(dist,'game.js')]));
test('Service worker parses in Node',()=>cp.execFileSync(process.execPath,['--check',path.join(dist,'service-worker.js')]));
test('Three.js renderer is self-hosted',()=>{
  assert(fs.statSync(path.join(dist,'vendor','three.module.js')).size>1000000);
  assert(html.includes('type="module"'));
  assert(!html.includes('three.min.js'));
  assert(js.includes('new THREE.WebGLRenderer'));
});
test('Start button enters gameplay directly and ENTER keyboard works',()=>{
  assert(html.includes('id="start"'));
  assert(js.includes("dom.start.addEventListener('click',()=>{if(phase!=='menu')return;startRun();"));
  assert(js.includes("if(e.code==='Enter'&&phase==='menu'"));
  assert(js.includes("function startRun(){seenLock=false;resetRun();phase='playing';"));
  assert(js.includes('pointerlockchange'));
});
test('Two weapons and shooting are implemented',()=>{
  for(const name of ['K2C1','KSG-12'])assert(js.includes(name));
  assert(js.includes('function shoot(now){'));
  assert(js.includes('w.ammo--;'));
  assert(js.includes('function reload(){'));
  assert(js.includes('stats.hits++'));
});
const waveSpec=js.match(/const waves=\[([\s\S]*?)\];/);
if(!waveSpec)throw new Error('Missing wave configuration');
const waves=[...waveSpec[1].matchAll(/walkers:(\d+),runners:(\d+),brutes:(\d+),interval:[\d.]+,label:'([^']+)'/g)]
 .map(x=>({walkers:+x[1],runners:+x[2],brutes:+x[3],label:x[4]}));
test('Five balanced waves and no duplicate brute boss',()=>{
  assert.equal(waves.length,5);
  assert.deepEqual(waves.map(w=>w.walkers+w.runners+w.brutes),[14,24,36,50,70]);
  assert.deepEqual(waves.map(w=>w.brutes),[0,0,0,1,2]);
  assert(!js.includes("if(p.brutes)spawnQueue.push('brute');"));
  assert(js.includes("for(let n=0;n<p.brutes;n++)spawnQueue.push('brute');"));
  assert(js.includes("const maxAlive=ultraLow?7:quality==='low'?11:quality==='medium'?17:24;"));
  assert(js.includes("if(live>=maxAlive)return;"));
});
test('Enemies have GPU resource disposal and audio uses a reusable buffer pool',()=>{
  assert(js.includes('function disposeEnemyGroup(z){'));
  assert(js.includes('geometries.forEach(g=>g.dispose'));
  assert(js.includes('disposeEnemyGroup(z);return false'));
  assert(js.includes('this.noiseCache=new Map()'));
});
test('AI textures are local WebP and fit 750 KB budget',()=>{
  const images=['hero','runner','brute','stalker','decals'];
  let total=0;
  for(const name of images){
    const buf=fs.readFileSync(path.join(dist,'assets',name+'.webp'));
    assert.equal(buf.toString('ascii',0,4),'RIFF');
    assert.equal(buf.toString('ascii',8,12),'WEBP');
    assert(buf.length>2000);
    total+=buf.length;
  }
  assert(total<=750000,'AI WebP visual bundle exceeds budget: '+total);
  assert(css.includes('/assets/hero.webp'));
  assert(js.includes('AI_TEXTURES'));
  assert(js.includes('new THREE.Sprite'));
});
test('PWA core cache references existing files; preview registration disabled',()=>{
  assert(sw.includes('deadline-seoul-v4-ai'));
  assert(!sw.includes('og-image.png'));
  const m=sw.match(/const CORE=\[([^\]]+)\]/);
  assert(m);
  const paths=[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
  for(const url of paths){
    if(url==='/')continue;
    assert(fs.existsSync(path.join(dist,url.slice(1))),'PWA precache missing '+url);
  }
  assert(js.includes("!location.hostname.endsWith('.vercel.app')"));
});
test('Security headers prevent MIME sniffing and mutable JS uses revalidation cache',()=>{
  const head=conf.headers.flatMap(r=>r.headers);
  const get=k=>head.find(h=>h.key.toLowerCase()===k.toLowerCase())?.value||'';
  assert.equal(get('X-Content-Type-Options'),'nosniff');
  assert(!get('Content-Security-Policy').includes('unpkg.com'));
  assert(!get('Content-Security-Policy').includes('cdn.jsdelivr.net'));
  assert(get('Cache-Control').includes('max-age=300'));
  assert(!get('Cache-Control').includes('immutable'));
});
test('QA mode exposes diagnostic HUD without shipping debugging UI by default',()=>{
  assert(js.includes("get('qa')==='1'"));
  assert(js.includes('window.__DEADLINE_QA__=()=>'));
  assert(html.includes('id="hud-top"'));
});
test('Volumetric zombie articulation and detailed PBR weapons',()=>{
  assert(js.includes('const detailRig={elbows:[],knees:[]'));
  assert(js.includes('rig.elbows.forEach'));
  assert(js.includes('rig.knees.forEach'));
  assert(js.includes('o.material===eyeM'));
  assert(js.includes('const detailedWeaponParts={}'));
  assert(js.includes('detailedWeaponParts.rifleMag.position.y'));
  assert(js.includes('detailedWeaponParts.pump.position.z'));
});
test('Live opt-in combat and timed FPS diagnostic are available',()=>{
  assert(js.includes("qaParams.get('qa')==='release'"));
  assert(js.includes('function runReleaseQA(){'));
  assert(js.includes('function launchDeviceBenchmark(){'));
  assert(js.includes('window.__DEADLINE_BENCHMARK__=result'));
});
test('Tracer distance and restart GPU cleanup are correct',()=>{
 assert(js.includes('rayLength=dir.length()'));
 assert(js.includes('disposeTemporaryProp(p.group)'));
 assert(js.includes('disposeTemporaryProp(b.group)'));
});
test('Zombie pursuit speeds and nearby rush are higher while 194 enemies remain',()=>{
  const profiles=js.match(/const profiles=\{walker:\{hp:108,speed:([\d.]+)[\s\S]*?runner:\{hp:74,speed:([\d.]+)[\s\S]*?brute:\{hp:840,speed:([\d.]+)/);
  assert(profiles,'Missing complete enemy speed profile');
  assert.deepEqual(profiles.slice(1).map(Number),[1.65,3.45,1.08]);
  assert(js.includes('proximity=THREE.MathUtils.clamp(1-dist/23,0,1)'));
  assert(js.includes("surge=z.kind==='runner'?.16:z.kind==='brute'?.06:.10"));
  assert(js.includes('step=p.speed*(1+surge*proximity)*dt'));
  assert.deepEqual(waves.map(w=>w.walkers+w.runners+w.brutes),[14,24,36,50,70]);
});

const report={game:'DEADLINE: SEOUL',kind:'static regression verification',passed:tests.length,checks:tests,waves,
 knownLimitations:[
  'Full 5-wave playthrough and extraction ending not yet observed in real browser',
  'Mouse gunfire, damage, ammo decrease and enemy hitboxes need hands-on verification',
  'Frame-time and LCP measurements needed on mid-range Android and desktop GPUs',
  'AI zombie visuals currently use camera-facing sprites over procedural 3D bodies',
  'Weapon meshes are procedural; BBANANA photorealistic weapon visuals not yet integrated'
 ]};
fs.writeFileSync(path.join(dist,'static-qa-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('RELEASE_STATIC_QA_OK',JSON.stringify({passed:tests.length,waveEnemies:waves.map(w=>w.walkers+w.runners+w.brutes)}));
