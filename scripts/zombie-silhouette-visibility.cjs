/**
 * Remove the opaque procedural mannequin from the visual pass AFTER the photo
 * has loaded, without deleting its raycast hitboxes, shadows or animation rig.
 * Browser can fall back to the original 3D model if the texture fails to load.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const file=path.resolve(__dirname,'..','dist','game.js');
let js=fs.readFileSync(file,'utf8');
function patch(before,after,label){
 const p=js.split(before);if(p.length!==2)throw Error(label+' marker count '+(p.length-1));js=p.join(after);
}
const helper=[
 'function applyPhotographicZombieSkin(z){',
 ' if(z.photographicActive||!z.photoSprite)return;',
 ' const tex=z.photoSprite.material.map,img=tex&&tex.image;',
 ' if(!img||!(img.width||img.naturalWidth)||!tex.isTexture)return;',
 ' z.photographicActive=true;',
 ' const invisible=new Set();',
 ' z.group.traverse(o=>{',
 '  if(!o.isMesh||!o.material)return;',
 '  for(const mat of (Array.isArray(o.material)?o.material:[o.material]))invisible.add(mat);',
 ' });',
 ' for(const mat of invisible){',
 '  // Keep all meshes and hit geometry, but stop their opaque color/depth hiding the photo.',
 '  mat.colorWrite=false;mat.depthWrite=false;mat.needsUpdate=true;',
 ' }',
 ' z.photoSprite.material.depthTest=true;',
 ' z.photoSprite.material.depthWrite=false;',
 ' z.photoSprite.material.opacity=1;',
 ' z.photoSprite.renderOrder=9;',
 '}'
].join('\n');
patch('function updateEnemy(z,dt){',
 helper+'\nfunction updateEnemy(z,dt){\n applyPhotographicZombieSkin(z);',
 'render photo rather than primitive zombie geometry');
patch('for(const z of coop.enemyMeshes.values()){\n  z.group.position.lerp(',
 'for(const z of coop.enemyMeshes.values()){\n  applyPhotographicZombieSkin(z);\n  z.group.position.lerp(',
 'apply texture to co-op client too');
patch('function applyPhotographicZombieSkin(z){',
 [
 " window.__DEADLINE_ZOMBIE_ART__=()=>({",
 "  total:enemies.filter(z=>!z.dead).length,",
 "  photoActive:enemies.filter(z=>!z.dead&&z.photographicActive).length,",
 "  photoPending:enemies.filter(z=>!z.dead&&z.photoSprite&&!z.photographicActive).length",
 " });",
 'function applyPhotographicZombieSkin(z){'
 ].join('\n'),
 'read-only sprite QA state');
fs.writeFileSync(file,js);
cp.execFileSync(process.execPath,['--check',file]);
console.log('PHOTO_ZOMBIE_VISIBLE',JSON.stringify({hideCrude3dOnlyAfterTextureLoads:true,raycastMeshesPreserved:true,cooperativeSupport:true,textureErrorFallback:true}));
