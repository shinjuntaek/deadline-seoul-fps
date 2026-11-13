/* Skinned CC0 anatomy, shared geometry/materials and bounded near-detail budget. */
const humanAssets={templates:{},ready:false,error:null,nearBudget:quality==='low'?3:8};
let cloneHuman=null;
const legacyCreateEnemy=createEnemy,legacyDisposeEnemy=disposeEnemyGroup;
const legacyPhotoSkin=applyPhotographicZombieSkin,legacyDeath=updateZombieDeath;
const humanProfiles={walker:{hp:108,speed:2.25,damage:9,range:1.35,cool:.88,scale:1},runner:{hp:74,speed:4.9,damage:7,range:1.28,cool:.62,scale:.92},brute:{hp:840,speed:1.55,damage:23,range:1.9,cool:1.15,scale:1.58}};
const humanHitMaterial=new THREE.MeshBasicMaterial({visible:false});
const humanHeadGeo=new THREE.SphereGeometry(.24,8,6),humanBodyGeo=new THREE.CapsuleGeometry(.31,.78,3,8);
Promise.all([import('/vendor/GLTFLoader.js'),import('/vendor/SkeletonUtils.js')]).then(async([loader,utils])=>{
 cloneHuman=utils.clone;
 const gltfLoader=new loader.GLTFLoader();
 await Promise.all(['infected-civilian','infected-worker'].flatMap(model=>['far','near'].map(async lod=>{
  const asset=await gltfLoader.loadAsync('/assets/models/'+model+'-'+lod+'.glb');
  asset.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.raycast=()=>{};o.material.side=THREE.FrontSide;o.material.vertexColors=!!o.geometry.attributes.color;o.material.needsUpdate=true}});
  humanAssets.templates[model+'-'+lod]=asset.scene;
 })));
 humanAssets.ready=true;
}).catch(e=>{humanAssets.error=String(e);console.warn('Skinned character fallback',e)});
function instantiateHuman(z,lod){
 if(z.human?.lod===lod)return;
 releaseHuman(z);
 const type=z.kind==='runner'?'infected-civilian':'infected-worker';
 const model=cloneHuman(humanAssets.templates[type+'-'+lod]);model.rotation.y=Math.PI;model.name=type;
 const bones=new Map(),meshes=[];
 model.traverse(o=>{if(o.isBone){bones.set(o.name,{bone:o,rest:o.quaternion.clone(),angles:new THREE.Vector3()})}if(o.isMesh){o.raycast=()=>{};o.castShadow=quality!=='low'&&lod==='near';o.receiveShadow=true;meshes.push(o)}});
 z.group.add(model);z.human={model,bones,meshes,lod,clock:0,prev:z.group.position.clone(),stride:z.phase,blend:0,ownedMaterials:[]};
}
function releaseHuman(z){
 if(!z.human)return;
 const skeletons=new Set();z.human.model.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton)});
 skeletons.forEach(s=>s.dispose());z.human.ownedMaterials.forEach(m=>m.dispose());
 z.group.remove(z.human.model);z.human=null;
}
createEnemy=function(kind,pos){
 if(!humanAssets.ready)return legacyCreateEnemy(kind,pos);
 const p=humanProfiles[kind],g=new THREE.Group();g.position.copy(pos);g.scale.setScalar(p.scale);
 const torso=new THREE.Mesh(humanBodyGeo,humanHitMaterial);torso.position.y=1.28;torso.visible=false;
 const head=new THREE.Mesh(humanHeadGeo,humanHitMaterial);head.position.set(0,2.02,-.02);head.visible=false;
 const limbs=Array.from({length:4},()=>new THREE.Group());g.add(torso,head,...limbs);
 const z={id:enemyId++,kind,group:g,hp:p.hp,max:p.hp,dead:false,profile:p,torso,head,limbs,phase:Math.random()*Math.PI*2,attack:Math.random()*.5,death:0,strafe:Math.random()<.5?-1:1,horrorRush:0,horrorCooldown:2,photoSprite:null};
 g.userData.enemy=z;torso.userData={enemy:z,part:'body'};head.userData={enemy:z,part:'head'};
 instantiateHuman(z,'far');scene.add(g);enemies.push(z);return z;
};
applyPhotographicZombieSkin=function(z){if(!z.human)legacyPhotoSkin(z)};
disposeEnemyGroup=function(z){if(z.disposed)return;if(!z.human){legacyDisposeEnemy(z);return}releaseHuman(z);scene.remove(z.group);z.disposed=true};
const humanEuler=new THREE.Euler(),humanQ=new THREE.Quaternion();
function poseHuman(h,name,x,y,z,dt){
 const item=h.bones.get(name);if(!item)return;
 const f=1-Math.exp(-dt*14);item.angles.x+=(x-item.angles.x)*f;item.angles.y+=(y-item.angles.y)*f;item.angles.z+=(z-item.angles.z)*f;
 humanEuler.set(item.angles.x,item.angles.y,item.angles.z,'XYZ');humanQ.setFromEuler(humanEuler);
 item.bone.quaternion.copy(item.rest).multiply(humanQ);
}
function animateHuman(z,dt,near){
 const h=z.human;if(!h||z.dead)return;
 h.clock+=dt;
 const moved=Math.hypot(z.group.position.x-h.prev.x,z.group.position.z-h.prev.z);
 h.prev.copy(z.group.position);h.stride+=moved*(z.kind==='runner'?6.1:7.7);
 const target=THREE.MathUtils.clamp(moved/Math.max(dt,.001)/z.profile.speed,0,1);
 h.blend+=(target-h.blend)*(1-Math.exp(-dt*10));
 const dist=z.group.position.distanceTo(camera.position),hz=dist>25?10:dist>14?18:60;
 if(h.clock<1/hz)return;const step=h.clock;h.clock=0;
 const attack=dist<z.profile.range*1.45?Math.max(0,Math.sin(elapsed*Math.PI*2/z.profile.cool+z.id)):0;
 const gait=Math.sin(h.stride),hit=Math.min(1,(z.hitReact||0)*3);z.hitReact=Math.max(0,(z.hitReact||0)-step);
 for(const [side,sign] of [['L',1],['R',-1]]){
  const stride=gait*sign*h.blend;
  poseHuman(h,'upperleg01_'+side,stride*.37,0,sign*.09,step);
  poseHuman(h,'lowerleg01_'+side,Math.max(0,-stride)*.74,0,0,step);
  poseHuman(h,'foot_'+side,-Math.max(0,stride)*.17,0,0,step);
  poseHuman(h,'upperarm01_'+side,-.34-stride*.15-attack*.72,0,-sign*.40,step);
  poseHuman(h,'lowerarm01_'+side,-.24-attack*.38,0,0,step);
  poseHuman(h,'wrist_'+side,.12,0,sign*.08,step);
 }
 poseHuman(h,'spine01',.14+attack*.13-hit*.20,Math.sin(h.stride)*.035,Math.sin(elapsed*.7+z.id)*.025,step);
 poseHuman(h,'head',.1+Math.sin(elapsed*1.4+z.id)*.055-hit*.34,Math.sin(elapsed*.55+z.id)*.10,hit*.18,step);
 poseHuman(h,'jaw',attack*.12,0,0,step);
 h.model.position.y=Math.abs(Math.sin(h.stride))*h.blend*.018;
 for(const m of h.meshes)m.castShadow=near&&quality!=='low'&&dist<13;
}
updateZombieDeath=function(z,dt){
 if(!z.human)return legacyDeath(z,dt);
 if(!z.deathStarted)beginZombieDeath(z,false);
 z.death+=dt;const t=z.death,h=z.human;
 z.deathPhase=t<.22?'stagger':t<.80?'fall':t<5.5?'down':'fade';
 const fall=THREE.MathUtils.smoothstep(t,.16,.85);
 h.model.rotation.x=-Math.PI/2*fall;h.model.rotation.z=z.deathSide*.13*fall;
 h.model.position.y=.10*fall;z.group.position.y=0;
 if(t>5.5&&!h.ownedMaterials.length){for(const m of h.meshes){m.material=m.material.clone();m.material.transparent=true;h.ownedMaterials.push(m.material)}}
 for(const m of h.ownedMaterials)m.opacity=Math.max(0,1-(t-5.5)/1.2);
 if(t>=6.7){disposeEnemyGroup(z);return false}return true;
};
function humanFrame(dt){
 const active=enemies.filter(z=>z.human&&!z.dead).sort((a,b)=>a.group.position.distanceToSquared(camera.position)-b.group.position.distanceToSquared(camera.position));
 active.forEach((z,i)=>{
  const d=z.group.position.distanceTo(camera.position),near=i<humanAssets.nearBudget&&d<16;
  // Hysteresis avoids clone churn near the detail transition.
  if(near&&z.human.lod==='far'&&d<14)instantiateHuman(z,'near');
  else if(!near&&z.human.lod==='near'&&(d>18||i>=humanAssets.nearBudget+2))instantiateHuman(z,'far');
  animateHuman(z,dt,near);
 });
 const corpses=enemies.filter(z=>z.human&&z.dead).sort((a,b)=>b.death-a.death),max=quality==='low'?6:12;
 for(let i=0;i<corpses.length-max;i++)corpses[i].death=7;
}
const legacyArtStatus=window.__DEADLINE_ZOMBIE_ART__;
window.__DEADLINE_ZOMBIE_ART__=()=>({...legacyArtStatus(),skinned:enemies.filter(z=>z.human&&!z.dead).length,assetsReady:humanAssets.ready,assetError:humanAssets.error,near:enemies.filter(z=>z.human?.lod==='near').length,corpses:enemies.filter(z=>z.human&&z.dead).length});
