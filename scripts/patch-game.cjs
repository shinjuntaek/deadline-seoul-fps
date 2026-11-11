/**
 * Apply non-destructive 3D visual upgrades to the verified static FPS bundle.
 * Base source remains untouched; output is rebuilt deterministically in dist/.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets','bbanana-manifest.json'),'utf8'));
const cssPath=path.join(dist,'style.css');
const jsPath=path.join(dist,'game.js');
const htmlPath=path.join(dist,'index.html');
let css=fs.readFileSync(cssPath,'utf8');
let js=fs.readFileSync(jsPath,'utf8');
let html=fs.readFileSync(htmlPath,'utf8');
const hero=manifest.assets.hero.url;
if(!css.includes(hero))throw new Error('BBANANA hero integration marker not found');
css=css.replace(hero,'/assets/hero.webp');
fs.writeFileSync(cssPath,css);
html=html.replace('<link rel="preconnect" href="https://uyncfjzfumputmyodmlr.supabase.co" crossorigin>\n','');
fs.writeFileSync(htmlPath,html);
function insertOnce(source,marker,addition,label){
  const chunks=source.split(marker);
  if(chunks.length!==2)throw new Error(label+' expected exactly one marker; got '+(chunks.length-1));
  return chunks[0]+marker+addition+chunks[1];
}
const preload=[
  '/* Keep Three.js meshes for hitboxes; use local textures to improve character art. */',
  'const AI_TEXTURES={};',
  'const aiLoader=new THREE.TextureLoader();',
  "[['walker','stalker'],['runner','runner'],['brute','brute']].forEach(([kind,asset])=>{",
  "  const tex=aiLoader.load('/assets/'+asset+'.webp',undefined,undefined,()=>console.warn('Procedural fallback for '+kind));",
  '  tex.colorSpace=THREE.SRGBColorSpace;',
  '  tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());',
  '  AI_TEXTURES[kind]=tex;',
  '});',
  "const decalTex=aiLoader.load('/assets/decals.webp');",
  'decalTex.colorSpace=THREE.SRGBColorSpace;',
  'const decalBoard=new THREE.Mesh(',
  '  new THREE.PlaneGeometry(2.1,2.1),',
  '  new THREE.MeshStandardMaterial({map:decalTex,roughness:.92,metalness:0,side:THREE.DoubleSide})',
  ');',
  'decalBoard.position.set(-8.5,2.1,11.2);',
  'decalBoard.rotation.y=.18;',
  'decalBoard.receiveShadow=true;',
  'scene.add(decalBoard);'
].join('\n');
const charArt=[
  '/* BBANANA photographic overlays over the intact 3D hit geometry. */',
  'const aiSkin=AI_TEXTURES[kind];',
  'if(aiSkin){',
  '  const art=new THREE.Sprite(new THREE.SpriteMaterial({',
  '    map:aiSkin,color:0xc9d5d3,transparent:true,depthTest:true,depthWrite:false,',
  '    alphaTest:.12,opacity:.96,fog:true',
  '  }));',
  '  art.center.set(.5,0);',
  "  art.scale.set(kind==='brute'?2.3:1.47,kind==='brute'?2.52:2.45,1);",
  "  art.position.set(0,.02,kind==='brute'?.57:.45);",
  '  art.raycast=function(){};',
  '  g.add(art);',
  '}'
].join('\n');
js=insertOnce(js,'const scene=new THREE.Scene();','\n'+preload+'\n','3D scene');
const enemyParts=js.split('const z={id:enemyId++');
if(enemyParts.length!==2)throw new Error('Enemy geometry marker mismatch');
js=enemyParts[0]+'\n'+charArt+'\nconst z={id:enemyId++'+enemyParts[1];

/* Runtime and interaction fixes discovered during actual browser Preview QA. */
function replaceExact(source,original,replacement,label){
  const parts=source.split(original);
  if(parts.length!==2)throw new Error('Unsafe '+label+' source patch: marker occurrences='+ (parts.length-1));
  return parts.join(replacement);
}
js=replaceExact(
  js,
  "dom.start.addEventListener('click',()=>{audio.resume();if(localStorage.getItem('deadline-seoul-tutorial')!=='1'){phase='tutorial';dom.tutorial.classList.remove('hidden');localStorage.setItem('deadline-seoul-tutorial','1')}else startRun()});",
  "dom.start.addEventListener('click',()=>{if(phase!=='menu')return;startRun();showCenter('WASD 이동 · 클릭 사격 · R 재장전',3.3)});",
  'start button / remove unnecessary first-launch blocking modal'
);
js=replaceExact(
  js,
  "addEventListener('keydown',e=>{keys.add(e.code);",
  "addEventListener('keydown',e=>{if(e.code==='Enter'&&phase==='menu'&&document.activeElement!==dom.start){e.preventDefault();dom.start.click();return}keys.add(e.code);",
  'ENTER key in menu'
);
js=replaceExact(
  js,
  "function startRun(){resetRun();phase='playing';",
  "function startRun(){seenLock=false;resetRun();phase='playing';",
  'new game pointer lock guard'
);
js=replaceExact(
  js,
  "document.addEventListener('pointerlockchange',()=>{if(!coarse&&phase==='playing'&&document.pointerLockElement!==dom.game)pauseGame(false)});",
  "let seenLock=false;document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===dom.game){seenLock=true;return}if(!coarse&&seenLock&&phase==='playing'){seenLock=false;pauseGame(false)}});",
  'do not pause on initially denied pointer lock'
);
const badLock="if(!coarse)dom.game.requestPointerLock().catch(()=>{})";
if(js.split(badLock).length!==3)throw new Error('Expected two original pointer lock calls');
const safeLock="if(!coarse&&typeof dom.game.requestPointerLock==='function')try{const p=dom.game.requestPointerLock();if(p&&typeof p.catch==='function')p.catch(()=>{if(phase==='playing')showCenter('화면을 클릭해 마우스 조준을 활성화하세요',2)})}catch(e){console.warn('Pointer lock unavailable',e)}";
js=js.split(badLock).join(safeLock);
js=replaceExact(
  js,
  "beginWave(0);audio.resume();",
  "beginWave(0);try{audio.resume()}catch(e){console.warn('Audio unavailable',e)}",
  'audio failure should not block gameplay'
);
const qaScript=[
  "/* Read-only QA diagnostics for Preview smoke tests. */",
  "const qaEnabled=new URLSearchParams(location.search).get('qa')==='1';",
  "let qaOutput=null,qaLastUpdate=-1;",
  "if(qaEnabled){",
  "qaOutput=document.createElement('output');",
  "qaOutput.id='deadline-qa-status';",
  "qaOutput.setAttribute('aria-live','off');",
  "Object.assign(qaOutput.style,{position:'fixed',left:'12px',bottom:'9px',zIndex:'240',background:'rgba(3,9,9,.90)',color:'#b7ffcc',padding:'6px 12px',border:'1px solid #447d67',font:'12px monospace',pointerEvents:'none',maxWidth:'calc(100vw - 24px)'});",
  "document.body.appendChild(qaOutput);",
  "window.__DEADLINE_QA__=()=>({phase,wave:stats.wave,ammo:weaponState[currentWeapon].ammo,kills:stats.kills,score:stats.score,pointerLocked:document.pointerLockElement===dom.game});",
  "}",
].join('\n');
js=replaceExact(js,'function frame(){',qaScript+'\nfunction frame(){','QA instrumentation before main loop');
js=replaceExact(js,' updateFX(dt);fpsTime+=dt;fpsFrames++;'," updateFX(dt);fpsTime+=dt;fpsFrames++;if(qaOutput&&elapsed-qaLastUpdate>.5){qaLastUpdate=elapsed;qaOutput.textContent='QA '+phase.toUpperCase()+' · WAVE '+stats.wave+' · AMMO '+weaponState[currentWeapon].ammo+' · KILLS '+stats.kills+' · '+Math.round(1/Math.max(dt,.0001))+' FPS';}",'QA FPS and state HUD');
const styleFix=[
  '#menu .actions {position:relative;z-index:5;pointer-events:auto}',
  '#menu .actions button {pointer-events:auto;touch-action:manipulation}',
  '#tutorial {z-index:60}',
].join('\n');
fs.appendFileSync(cssPath,'\n/* Tested menu interaction fixes */\n'+styleFix+'\n');
css=fs.readFileSync(cssPath,'utf8');

fs.writeFileSync(jsPath,js);
cp.execFileSync(process.execPath,['--check',jsPath]);
for(const name of ['hero','stalker','runner','brute','decals']){
  const stat=fs.statSync(path.join(dist,'assets',name+'.webp'));
  if(stat.size<2000)throw new Error('Game asset unexpectedly small '+name);
}
if(/<script[^>]+src=[\"'][^\"']*three\.min\.js/.test(html))throw new Error('Obsolete Three.js UMD script remains');
if(!js.includes('AI_TEXTURES')||!js.includes('THREE.Sprite'))throw new Error('Enemy visual upgrade missing');
const report={
  source:'BBANANA Nano Banana 2.1 (existing generations)',
  localWebp:true,images:fs.readdirSync(path.join(dist,'assets')),
  renderer:'Three.js r164 self-hosted ESM',
  characterVisuals:'camera-facing transparent art over 3D gameplay hitboxes',
  jsBytes:Buffer.byteLength(js),htmlBytes:Buffer.byteLength(html),cssBytes:Buffer.byteLength(css),
  checks:{syntax:true,hero:true,characterSprites:true,decals:true,obsoleteUmdRemoved:true,startButton:true,keyboardEnter:true,pointerLockFallback:true,qaDiagnostic:true}
};
fs.writeFileSync(path.join(dist,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('GAME_VISUAL_QA_OK',JSON.stringify(report));
