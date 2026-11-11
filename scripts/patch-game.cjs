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
js=insertOnce(js,'const z={id:enemyId++','\n'+charArt+'\n','Enemy geometry');
fs.writeFileSync(jsPath,js);
cp.execFileSync(process.execPath,['--check',jsPath]);
for(const name of ['hero','stalker','runner','brute','decals']){
  const stat=fs.statSync(path.join(dist,'assets',name+'.webp'));
  if(stat.size<2000)throw new Error('Game asset unexpectedly small '+name);
}
if(html.includes('three.min.js'))throw new Error('Obsolete Three.js UMD remains');
if(!js.includes('AI_TEXTURES')||!js.includes('THREE.Sprite'))throw new Error('Enemy visual upgrade missing');
const report={
  source:'BBANANA Nano Banana 2.1 (existing generations)',
  localWebp:true,images:fs.readdirSync(path.join(dist,'assets')),
  renderer:'Three.js r164 self-hosted ESM',
  characterVisuals:'camera-facing transparent art over 3D gameplay hitboxes',
  jsBytes:Buffer.byteLength(js),htmlBytes:Buffer.byteLength(html),cssBytes:Buffer.byteLength(css),
  checks:{syntax:true,hero:true,characterSprites:true,decals:true,obsoleteUmdRemoved:true}
};
fs.writeFileSync(path.join(dist,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
console.log('GAME_VISUAL_QA_OK',JSON.stringify(report));
