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
console.log('RECOVERY_OK',JSON.stringify({encodedBytes:encoded.length,gzipBytes:bytes.length,tarBytes:tar.length,sha256:crypto.createHash('sha256').update(tar).digest('hex'),files:fileList}));
console.log('GAME_AUDIT',JSON.stringify({htmlBytes:Buffer.byteLength(html),scriptBytes:Buffer.byteLength(js),threeScripts:(html.match(/<script[^>]+>/g)||[]),markers:lookup.map(k=>({term:k,count:js.split(k).length-1,context:(js.indexOf(k)>=0?js.slice(Math.max(0,js.indexOf(k)-90),js.indexOf(k)+370).replace(/\n/g,' '):null)}))}));
