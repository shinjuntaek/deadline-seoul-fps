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
  assert.deepEqual(profiles.slice(1).map(Number),[2.25,4.9,1.55]);
  assert(js.includes('proximity=THREE.MathUtils.clamp(1-dist/20,0,1)'));
  assert(js.includes("surge=z.kind==='runner'?.27:z.kind==='brute'?.12:.20"));
  assert(js.includes('step=Math.min(p.speed*1.7,p.speed*(1+surge*proximity)*rush)*dt'));
  assert.deepEqual(waves.map(w=>w.walkers+w.runners+w.brutes),[14,24,36,50,70]);
});

test('Seoul scene uses wet road PBR material, normal and roughness maps',()=>{
 assert(js.includes('function envPbrCanvas('));
 assert(js.includes('ground.material.normalMap=envRoadTex.normalMap;'));
 assert(js.includes('ground.material.roughnessMap=envRoadTex.roughnessMap;'));
 assert(js.includes('concrete.normalMap=sidewalk.normalMap;'));
});
test('Realistic facade, car and street furniture detail is quality-gated',()=>{
 for(const name of ['envDetailCar(g,broken)','envCityBus(-14.9,-45)','envBusStop(-16.5,12)','envWarningTex()','envManhole(x,z)','envObjMetrics','new THREE.InstancedMesh']){
  assert(js.includes(name),'Missing detailed city environment '+name);
 }
 assert(js.includes("const envDetail=ultraLow?0:quality==='low'?1:quality==='medium'?2:3;"));
 assert(js.includes('if(envDetail>=2){'));
 assert(js.includes('addCollider(x,z,2.85,8.25,2.8'));
});

test('Software WebGL skips additional road PBR to preserve baseline FPS',()=>{
 assert(js.includes("if(envDetail>=1){\n const envRoadTex="));
 assert(js.includes("const envDetail=ultraLow?0:quality==='low'?1:quality==='medium'?2:3;"));
 assert(js.includes('if(envDetail>=2){\n envCityBus(-14.9,-45);'));
});

test('Co-op lobby, server-authoritative shooting and teammate rendering are wired',()=>{
 assert(js.includes('function coopStartUI(){'));
 assert(js.includes('function coopApplySnapshot(state){'));
 assert(js.includes('function coopFrame(dt,now){'));
 assert(js.includes('function coopShoot(now){'));
 assert(js.includes('function coopReload(){'));
 assert(js.includes('if(coop.active){coopFrame(dt,now);updateHUD();'));
 assert(js.includes("if(coop.active)return;"));
 assert(js.includes('roomParam'));
 assert(fs.existsSync(path.join(root,'api','multiplayer.js')));
 assert(fs.existsSync(path.join(root,'multiplayer','coop-engine.mjs')));
});

test('Nightmare pursuit is bounded with horror animation, synth groans and co-op rush sync',()=>{
 for(const mark of ['function horrorRush(z,dt,dist,range){','z.horrorRush=.58;','z.horrorCooldown=','function horrorReact(z,dist){','z.horrorMouth=horrorMouth','AudioSystem.prototype.snarl=','horror-threat-vignette','function horrorThreatFrame(dt){','horrorThreatFrame(dt);','z.coopRushing=!!e.rush;']){
  assert(js.includes(mark),'Missing horror feature: '+mark);
 }
 assert(js.includes("if(quality!=='low'&&!ultraLow){"),'Low-end needs no extra face geometry');
 assert(js.includes("Math.min(p.speed*1.7,p.speed*(1+surge*proximity)*rush)"),'Movement capped for stability');
});

test('Checkpoint has a clear central lane and passable curbs',()=>{
 assert(js.includes("curb,false,'curb'"),'Sidewalk must not be a solid wall');
 assert(!js.includes("curb,true,'curb'"),'Old curb collision still exists');
 assert(js.includes('if(Math.abs(i)!==3)continue;const b=box('),'Checkpoint blocks must be on roadside');
 assert(js.includes('if(Math.abs(i)!==3)continue;'),'Warning decals follow new roadside checkpoint');
});
test('Actual BBANANA zombies appear in front of opaque geometry with 3D raycasting retained',()=>{
 assert(js.includes("const aiSkin=AI_TEXTURES[kind];let photoSprite=null;"));
 assert(js.includes("art.position.set(0,.025,kind==='brute'?-.92:-.79);"));
 assert(js.includes('z.photoSprite=photoSprite;'));
 assert(js.includes("map:aiSkin,color:0xffffff"));
 assert(js.includes('const zombieGrime='));
 assert(js.includes("torso.userData={enemy:z,part:'body'}"),'Do not discard original hitboxes');
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
