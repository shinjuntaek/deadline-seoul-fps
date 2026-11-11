/**
 * Display actual BBANANA photo textures on the zombie FRONT, not behind
 * the opaque procedural torso. Retain volumetric geometry for shadow,
 * animation, occlusion, raycast hitboxes and fallback while loading.
 * This is a photo-textured hybrid, not a fully rigged photogrammetry GLB.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const file=path.resolve(__dirname,'..','dist','game.js');
let js=fs.readFileSync(file,'utf8');
function edit(from,to,label){const p=js.split(from);if(p.length!==2)throw Error('Photo character patch '+label+' count '+(p.length-1));js=p.join(to)}
const prep=[
"/* Reusable inexpensive grime textures for side/back geometry. */",
"const zombieGrime=(()=>{",
" const canvas=document.createElement('canvas');canvas.width=canvas.height=128;",
" const ctx=canvas.getContext('2d'),im=ctx.createImageData(128,128);",
" let seed=0xdead501;",
" const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};",
" for(let i=0;i<im.data.length;i+=4){",
"  const streak=Math.sin((i/4%128)*.19+Math.floor(i/512)*.05)*11;",
"  const n=rnd(),v=Math.max(65,Math.min(224,158+(n-.5)*54+streak));",
"  im.data[i]=Math.round(v*.83);im.data[i+1]=Math.round(v*.88);im.data[i+2]=Math.round(v*.86);im.data[i+3]=255;",
" }",
" ctx.putImageData(im,0,0);",
" const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;",
" tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1,2);",
" return tex;",
"})();"
].join('\n');
edit('function createEnemy(kind,pos){',prep+'\nfunction createEnemy(kind,pos){','cloth texture setup');
edit("const aiSkin=AI_TEXTURES[kind];","const aiSkin=AI_TEXTURES[kind];let photoSprite=null;","track photoreal character sprite");
edit("map:aiSkin,color:0xc9d5d3,transparent:true,depthTest:true,depthWrite:false,",
     "map:aiSkin,color:0xffffff,transparent:true,depthTest:true,depthWrite:false,",
     "remove muddy color filtering from existing art");
edit("alphaTest:.12,opacity:.96,fog:true","alphaTest:.17,opacity:.98,fog:true","opacity and green chroma edges");
edit("art.scale.set(kind==='brute'?2.3:1.47,kind==='brute'?2.52:2.45,1);",
     "art.scale.set(kind==='brute'?2.45:kind==='runner'?1.65:1.53,kind==='brute'?2.83:2.47,1);",
     "realistic human silhouette");
edit("art.position.set(0,.02,kind==='brute'?.57:.45);",
     "art.position.set(0,.025,kind==='brute'?-.92:-.79);",
     "photo must sit in front of 3D body, not occluded behind it");
edit("art.raycast=function(){};\n  g.add(art);",
     "art.raycast=function(){};art.renderOrder=4;photoSprite=art;\n  g.add(art);",
     "photographic overlay is visual not combat collider");
edit("photo.material.opacity=.66;","photo.material.opacity=.98;","full photographic visibility");
edit("side:THREE.DoubleSide,opacity:.65","side:THREE.DoubleSide,opacity:.28","reduce double-photo ghosting");
edit("z.detailRig=detailRig;z.horrorMouth=horrorMouth;",
     "z.photoSprite=photoSprite;z.detailRig=detailRig;z.horrorMouth=horrorMouth;",
     "photo sprite state retained for audits");
edit("g.position.copy(pos);g.scale.setScalar(p.scale);const torso=",
     "g.position.copy(pos);g.scale.setScalar(p.scale);if(!ultraLow&&quality!=='low'){cloth.map=zombieGrime;cloth.color.setHex(0xcbd0c9);cloth.roughness=.97;cloth.needsUpdate=true}const torso=",
     "physically shaded clothing texture on original 3D torso");
fs.writeFileSync(file,js);
cp.execFileSync(process.execPath,['--check',file]);
console.log('ZOMBIE_PHOTO_FRONT_READY',JSON.stringify({bbbananaTextureReused:true,spriteInFrontOfMeshes:true,alphaCropped:true,semi3dHitboxesPreserved:true,sideClothingGrime:true,extraAssetNetworkRequests:0,paidGeneration:false}));
