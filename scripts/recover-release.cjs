/**
 * Recover the validated 2026-11-11 lean deployment archive.
 * The original source archive and lean.b64.part-04 were corrupted by an
 * oversized duplicated tail. Keep the original chunks intact for provenance.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const temp = path.join(root, '.release');
const parts = Array.from({ length: 8 }, (_, i) =>
  fs.readFileSync(path.join(root, 'release', 'lean.b64.part-' + String(i).padStart(2,'0')), 'utf8').trim());
for (const [index, part] of parts.entries()) {
  if (!/^[a-z0-9+/=]+$/i.test(part)) throw new Error('Invalid base64 characters in chunk ' + index);
  if (index !== 4 && index !== 7 && part.length !== 6000)
    throw new Error('Unexpected chunk ' + index + ' size=' + part.length);
}
const encoded = parts.slice(0, 4).join('') + parts[4].slice(0,6000) + parts.slice(5).join('');
if (encoded.length !== 44452 || !encoded.endsWith('='))
  throw new Error('Unexpected release archive size or padding. Refusing to deploy.');
const bytes = Buffer.from(encoded, 'base64');
const tar = zlib.gunzipSync(bytes); // checks the gzip checksum as well as decompression
if (tar.length !== 122880)
  throw new Error('Unexpected uncompressed archive size: ' + tar.length);
fs.rmSync(dist, {recursive:true,force:true});
fs.rmSync(temp, {recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
fs.mkdirSync(temp,{recursive:true});
const archive = path.join(temp,'release.tar');
fs.writeFileSync(archive,tar);
const fileList = cp.execFileSync('tar',['-tf',archive],{encoding:'utf8'}).trim().split('\n');
if(fileList.some(x => x.includes('..')||x.startsWith('/')||x.startsWith('\\')))
  throw new Error('Archive contains an unsafe path.');
cp.execFileSync('tar',['-xf',archive,'-C',dist]);
for (const filename of ['index.html','style.css','game.js','favicon.svg','manifest.webmanifest']) {
  if (!fs.existsSync(path.join(dist,filename))) throw new Error('Missing release file '+filename);
}
cp.execFileSync(process.execPath,['--check',path.join(dist,'game.js')]);
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dist,'game.js'),'utf8');
if(!html.includes('id="game"')||!html.includes('id="menu"')||!js.includes('WebGLRenderer'))
  throw new Error('FPS/WebGL entrypoints missing from release.');
const lookup=['function spawnEnemy','function createEnemy','function makeEnemy','function spawnZombie','function createZombie','class Zombie','function buildZombie','function boot','function waitThree','const scene=new THREE.Scene()','new THREE.TextureLoader','THREE.Sprite','function shoot','function frame','new AudioContext','AudioContext','localStorage'];

/* Self-hosted Three.js ESM prevents the removed r161+ UMD URL from freezing loading. */
const threeModule = path.join(root,'node_modules','three','build','three.module.js');
if(!fs.existsSync(threeModule)) throw new Error('Expected Three.js ESM module missing from npm install.');
fs.mkdirSync(path.join(dist,'vendor'),{recursive:true});
fs.copyFileSync(threeModule,path.join(dist,'vendor','three.module.js'));
let revisedHtml=html;
const removedUmd='<script src="https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.min.js"></script>';
if(!revisedHtml.includes(removedUmd))
  throw new Error('Expected removed Three.js UMD script not found; review upstream archive before patch.');
revisedHtml=revisedHtml.replace(removedUmd,'<script type="module">import * as THREE from "/vendor/three.module.js"; window.THREE=THREE;</script>');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets','bbanana-manifest.json'),'utf8'));
const hero=manifest.assets.hero.url;
if(!hero.startsWith('https://')) throw new Error('Invalid hero asset origin');
revisedHtml=revisedHtml.replace('<meta property="og:image" content="/og-image.svg">','<meta property="og:image" content="'+hero+'">');
revisedHtml=revisedHtml.replace('</head>','<link rel="preconnect" href="https://uyncfjzfumputmyodmlr.supabase.co" crossorigin>\n</head>');
fs.writeFileSync(path.join(dist,'index.html'),revisedHtml);
fs.writeFileSync(path.join(dist,'ai-assets.json'),JSON.stringify(manifest,null,2)+'\n');
const extraCSS=[
'/* BBANANA-generated Seoul quarantine visual / 2026-11-11 */',
'#menu.screen {',
' background-image:linear-gradient(90deg,rgba(5,9,13,.93) 0%,rgba(6,11,15,.70) 45%,rgba(7,11,15,.54) 100%),url("'+hero+'") !important;',
' background-color:#080d11 !important;',
' background-repeat:no-repeat !important;',
' background-position:center center !important;',
' background-size:cover !important;',
'}',
'#menu .menu-copy {text-shadow:0 2px 24px rgba(0,0,0,.38)}',
'#menu .briefing {background:rgba(8,14,17,.77);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}',
'@media (max-width:640px) {#menu.screen {background-position:58% center !important}#menu .briefing {backdrop-filter:none;-webkit-backdrop-filter:none}}',
'@media (prefers-reduced-motion:reduce){#menu *{animation-duration:.01ms !important;transition-duration:.01ms !important}}'
].join('\n');
fs.appendFileSync(path.join(dist,'style.css'),'\n'+extraCSS+'\n');
console.log('THREE_ESM_PATCH_OK',JSON.stringify({threeBytes:fs.statSync(threeModule).size,aiAssets:Object.keys(manifest.assets),hero}));
const enemySrcIdx=js.indexOf('function createEnemy');
console.log('ENEMY_SOURCE',JSON.stringify(enemySrcIdx>=0?js.slice(enemySrcIdx,enemySrcIdx+6400):'not found'));
console.log('WORLD_SOURCE',JSON.stringify(js.slice(Math.max(0,js.indexOf('function initialProps')-100),js.indexOf('function initialProps')+2200)));
console.log('VERCEL_JSON',JSON.stringify(fs.readFileSync(path.join(dist,'vercel.json'),'utf8')));

console.log('RECOVERY_OK',JSON.stringify({encodedBytes:encoded.length,gzipBytes:bytes.length,tarBytes:tar.length,sha256:crypto.createHash('sha256').update(tar).digest('hex'),files:fileList}));
console.log('GAME_AUDIT',JSON.stringify({htmlBytes:Buffer.byteLength(html),scriptBytes:Buffer.byteLength(js),threeScripts:(html.match(/<script[^>]+>/g)||[]),markers:lookup.map(k=>({term:k,count:js.split(k).length-1,context:(js.indexOf(k)>=0?js.slice(Math.max(0,js.indexOf(k)-90),js.indexOf(k)+370).replace(/\n/g,' '):null)}))}));
