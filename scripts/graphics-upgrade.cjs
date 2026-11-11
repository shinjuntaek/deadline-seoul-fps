/**
 * Game-ready procedural 3D animation, depth-silhouette & detailed PBR weapons.
 * Targets the verified legacy scene without breaking existing hitboxes.
 * This does not claim photogrammetry or replace a true rigged GLB asset.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),file=path.join(dist,'game.js');
let js=fs.readFileSync(file,'utf8');
function patch(before,after,name){
  const parts=js.split(before);if(parts.length!==2)throw new Error(name+' marker count '+(parts.length-1));
  js=parts.join(after);
}
const rigDetails=[
"/* Three-dimensional infected mesh anatomy. Rig remains valid at every camera angle. */",
"const detailRig={elbows:[],knees:[],cloth:[],photo:null,weight:kind==='brute'?1.35:1};",
"if(quality!=='low'){",
" const fabric=new THREE.MeshStandardMaterial({color:kind==='brute'?0x303d3b:kind==='runner'?0x42403b:0x39433f,metalness:.05,roughness:.98,flatShading:false});",
" const seams=new THREE.MeshStandardMaterial({color:0x65716b,metalness:.15,roughness:.78});",
" const stains=new THREE.MeshStandardMaterial({color:0x38262a,metalness:0,roughness:1});",
" const gaitScale=kind==='brute'?1.23:1;",
" function detailBox(parent,w,h,d,x,y,z,material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m}",
" detailBox(g,.56*gaitScale,.26,.25,0,kind==='brute'?1.75:1.58,-.04,fabric);",
" detailBox(g,.41*gaitScale,.15,.24,0,kind==='brute'?1.2:1.06,-.22,stains);",
" for(const side of [-1,1]){",
"   detailBox(g,.17,.08,.10,side*.17,kind==='brute'?1.82:1.64,-.29,seams);",
"   detailBox(g,.14,.08,.12,side*.26,kind==='brute'?1.32:1.22,-.25,stains);",
" }",
" for(let i=0;i<2;i++){",
"   const armPivot=limbs[i],elbow=new THREE.Group();elbow.position.set(0,-.68,0);armPivot.add(elbow);",
"   const lower=new THREE.Mesh(new THREE.CapsuleGeometry(kind==='brute'?.125:.085,.30,4,9),skin);lower.position.set(0,-.20,-.025);elbow.add(lower);",
"   const palm=new THREE.Mesh(new THREE.SphereGeometry(kind==='brute'?.12:.095,10,7),skin);palm.position.set(0,-.43,-.02);palm.scale.set(1.25,.66,.85);elbow.add(palm);",
"   for(let d=0;d<3;d++){const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.025,.09,3,5),skin);finger.position.set((d-1)*.063,-.52,-.04);finger.rotation.z=(d-1)*.13;elbow.add(finger)}",
"   detailRig.elbows.push(elbow);",
" }",
" for(let i=0;i<2;i++){",
"   const hip=limbs[i+2],knee=new THREE.Group();knee.position.set(0,-.69,0);hip.add(knee);",
"   const shin=new THREE.Mesh(new THREE.CapsuleGeometry(kind==='brute'?.14:.105,.32,4,9),fabric);shin.position.set(0,-.21,0);knee.add(shin);",
"   const shoe=detailBox(knee,.25,.15,.39,0,-.46,-.12,stains);shoe.rotation.x=-.06;",
"   detailRig.knees.push(knee);",
" }",
" const photo=g.children.find(o=>o.isSprite);",
" if(photo){",
"   photo.material.opacity=.66;",
"   const surfGeom=new THREE.PlaneGeometry(kind==='brute'?2.0:1.42,kind==='brute'?2.5:2.39,6,9);",
"   const attr=surfGeom.attributes.position;",
"   for(let i=0;i<attr.count;i++){const x=attr.getX(i),half=(kind==='brute'?2.0:1.42)/2;attr.setZ(i,-.04*Math.max(0,1-x*x/(half*half)))}",
"   attr.needsUpdate=true;surfGeom.computeVertexNormals();",
"   const surf=new THREE.Mesh(surfGeom,new THREE.MeshBasicMaterial({map:AI_TEXTURES[kind],color:0xc6d0cb,transparent:true,alphaTest:.14,depthWrite:false,side:THREE.DoubleSide,opacity:.65}));",
"   surf.position.set(0,kind==='brute'?1.25:1.2,-.34);surf.rotation.y=Math.PI;",
"   surf.raycast=function(){};g.add(surf);detailRig.photo=surf;",
" }",
"}"
].join('\n');
patch('const z={id:enemyId++',rigDetails+'\nconst z={id:enemyId++','3D zombie rig');
patch('g.userData.enemy=z;torso.userData','z.detailRig=detailRig;g.userData.enemy=z;g.traverse(o=>{if(o.isMesh&&!o.userData.part)o.userData={enemy:z,part:o.material===eyeM?\'head\':\'body\'}});torso.userData','store animated rig');
const animate=[
"/* Layered procedural animation: shoulder counter-rotation, bent elbows/knees,",
"   shuffling footfall, aggressive arm reach, spinal tilt and independent head sway. */",
"if(z.detailRig){",
" const rig=z.detailRig,close=THREE.MathUtils.clamp((p.range*1.8-dist)/(p.range*1.8),0,1);",
" const stagger=z.kind==='walker'?.65:z.kind==='brute'?.44:.30;",
" const stepSin=Math.sin(z.phase),other=Math.sin(z.phase+Math.PI);",
" rig.elbows.forEach((e,i)=>{",
"   e.rotation.x=.10+close*.65+Math.max(0,i?other:stepSin)*.25;",
"   e.rotation.z=(i===0?-.09:.09)+Math.cos(z.phase*.5+i*1.9)*.065;",
" });",
" rig.knees.forEach((k,i)=>{",
"   const swing=i?other:stepSin;",
"   k.rotation.x=Math.max(0,swing)*.45+Math.max(0,-swing)*(-.12);",
"   k.rotation.z=Math.sin(z.phase*.5+i)*.03;",
" });",
" z.torso.rotation.z=Math.sin(z.phase*.52+z.id)*.048;",
" z.torso.rotation.x=.08+Math.sin(z.phase)*.035+close*.09;",
" z.head.rotation.x=-.07+Math.sin(z.phase*.48+z.id)*.08-close*.07;",
" z.head.rotation.z=Math.sin(z.phase*.43+z.id)*.055;",
" if(rig.photo){",
"   rig.photo.position.y=(z.kind==='brute'?1.25:1.2)+Math.abs(Math.sin(z.phase*2))*.014;",
"   rig.photo.rotation.z=Math.sin(z.phase*.55)*.022;",
" }",
"}"
].join('\n');
patch("z.head.rotation.y=Math.sin(elapsed*1.7+z.id)*.09;", "z.head.rotation.y=Math.sin(elapsed*1.7+z.id)*.09;\n"+animate,'zombie gait animation');
const guns=[
"/* Close-up PBR viewmodel details: correct physical depth, perforations, rails and sights. */",
"const detailedWeaponParts={};",
"const gunMetal=new THREE.MeshStandardMaterial({color:0x121619,roughness:.28,metalness:.88});",
"const gunParker=new THREE.MeshStandardMaterial({color:0x343d40,roughness:.58,metalness:.60});",
"const gunGrip=new THREE.MeshStandardMaterial({color:0x121515,roughness:.95,metalness:.04});",
"const gunHighlight=new THREE.MeshStandardMaterial({color:0x788588,roughness:.31,metalness:.72});",
"const gunSight=new THREE.MeshBasicMaterial({color:0x9bdbbd,transparent:true,opacity:.56,side:THREE.DoubleSide});",
"function weaponBox(root,w,h,d,x,y,z,material=gunMetal){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);root.add(mesh);return mesh}",
"function weaponCyl(root,r,length,x,y,z,material=gunMetal){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,12),material);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);root.add(mesh);return mesh}",
"const rg=rifleModel.g,sg=shotModel.g;",
"/* Rifle upper receiver, handguard M-LOK slots, charging handle and front iron sight. */",
"weaponBox(rg,.137,.091,.57,0,.073,-.23,gunParker);",
"weaponBox(rg,.18,.035,.53,0,.165,-.38,gunMetal);",
"weaponBox(rg,.045,.044,.23,.078,.085,-.38,gunParker);",
"weaponBox(rg,.045,.044,.23,-.078,.085,-.38,gunParker);",
"for(let n=0;n<11;n++){",
" const z=-.18-n*.058;",
" weaponBox(rg,.18,.020,.023,0,.185,z,gunParker);",
" if(n<9){",
"  weaponBox(rg,.014,.032,.018,-.065,-.005,z,gunHighlight);",
"  weaponBox(rg,.014,.032,.018,.065,-.005,z,gunHighlight);",
" }",
"}",
"const rifleMag=weaponBox(rg,.099,.28,.12,0,-.22,-.25,gunMetal);rifleMag.rotation.x=-.15;",
"for(let i=0;i<6;i++)weaponBox(rifleMag,.106,.008,.01,0,-.11+i*.036,0,gunParker);",
"detailedWeaponParts.rifleMag=rifleMag;",
"const redDot=new THREE.Group();redDot.position.set(0,.235,-.22);rg.add(redDot);",
"weaponBox(redDot,.143,.085,.09,0,.01,0,gunMetal);",
"weaponBox(redDot,.10,.054,.011,0,.015,-.051,gunSight);",
"weaponCyl(rg,.029,.26,0,.01,-1.17,gunParker);",
"weaponBox(rg,.055,.11,.065,0,.08,-1.05,gunMetal);",
"/* Shotgun pump, dual tube magazine, ventilated rib and bead sight. */",
"weaponBox(sg,.19,.037,.63,0,.188,-.52,gunParker);",
"for(let n=0;n<8;n++)weaponBox(sg,.20,.014,.019,0,.212,-.27-n*.07,gunHighlight);",
"weaponCyl(sg,.029,.78,0,-.018,-.84,gunParker);",
"weaponBox(sg,.10,.045,.18,0,.03,-1.18,gunMetal);",
"const pump=new THREE.Group();pump.position.set(0,-.052,-.74);sg.add(pump);",
"weaponBox(pump,.196,.163,.38,0,0,0,gunGrip);",
"for(let n=0;n<7;n++){const z=-.15+n*.05;weaponBox(pump,.20,.01,.014,0,.085,z,gunParker)}",
"detailedWeaponParts.pump=pump;",
"weaponBox(sg,.05,.11,.025,0,.17,-1.18,gunSight);",
"for(const group of [rg,sg])group.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});"
].join('\n');
patch('const weaponState={',guns+'\nconst weaponState={','PBR gun mesh detail');
const weaponAnimate=[
"/* Animated rifle magazine and shotgun pump, driven by actual reload timer. */",
"const normalizedReload=w.reloading?THREE.MathUtils.clamp((now-w.reloadAt)/(w.cfg.reload*1000),0,1):0;",
"if(detailedWeaponParts.rifleMag){",
" const alpha=w.reloading&&currentWeapon==='rifle'?Math.sin(normalizedReload*Math.PI):0;",
" detailedWeaponParts.rifleMag.position.y=-.22-.21*alpha;",
" detailedWeaponParts.rifleMag.rotation.x=-.15-alpha*.32;",
"}",
"if(detailedWeaponParts.pump){",
" const alpha=w.reloading&&currentWeapon==='shotgun'?Math.sin(normalizedReload*Math.PI):0;",
" detailedWeaponParts.pump.position.z=-.74+.22*alpha;",
"}"
].join('\n');
patch('weaponRoot.rotation.z=sprint?-.18:0', 'weaponRoot.rotation.z=sprint?-.18:0;\n'+weaponAnimate,'weapon reload animation');

/* Firing tracer uses world-space ray distance, not normalized unit vector. */
patch(
  'const dir=end.clone().sub(start),vis=start.clone().add(dir.normalize().multiplyScalar(Math.min(dir.length(),16)))',
  'const dir=end.clone().sub(start),rayLength=dir.length(),vis=start.clone().add(dir.normalize().multiplyScalar(Math.min(rayLength,16)))',
  'correct tracer visibility length'
);
/* Releasing non-enemy dynamic geometry prevents restart-session GPU leaks. */
const disposeProp=[
  'function disposeTemporaryProp(group){',
  ' const geometries=new Set(),materials=new Set();',
  ' group.traverse(o=>{',
  '  if(o.geometry)geometries.add(o.geometry);',
  '  if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));',
  ' });',
  ' scene.remove(group);',
  ' geometries.forEach(g=>g.dispose&&g.dispose());',
  ' materials.forEach(m=>m.dispose&&m.dispose());',
  '}'
].join('\n');
patch('function clearRun(){',disposeProp+'\nfunction clearRun(){','temporary prop disposal');
patch('pickups.forEach(p=>scene.remove(p.group));barrels.forEach(b=>scene.remove(b.group));',
      'pickups.forEach(p=>disposeTemporaryProp(p.group));barrels.forEach(b=>disposeTemporaryProp(b.group));',
      'prevent repeated-restart prop memory accumulation');

fs.writeFileSync(file,js);
cp.execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
console.log('PROCEDURAL_3D_RIG_AND_WEAPONS_OK',JSON.stringify({jsBytes:Buffer.byteLength(js),pbrWeaponDetails:true,riggedElbowsAndKnees:true,attackReach:true,cameraIndependent3D:true,weaponReloadMotion:true,paid3dGeneration:false}));
