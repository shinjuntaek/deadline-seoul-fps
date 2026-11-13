/* Reuse one anatomical hand mesh, with actual reload-time magazine contact. */
const anatomicalHands=[];
import('/vendor/GLTFLoader.js').then(async({GLTFLoader})=>{
 const asset=await new GLTFLoader().loadAsync('/assets/models/view-hand.glb');
 for(const weapon of [rifleModel.g,shotModel.g]){
  // Original four capsule/box arms remain a safe loading fallback.
  weapon.children.filter(o=>o.userData.legacyArm).forEach(o=>o.visible=false);
  for(const side of ['left','right']){
   const hand=asset.scene.clone(true);hand.name='Anatomical '+side+' hand';
   hand.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.frustumCulled=false;if(o.material.name==='Sleeve'){o.material.map=visualTextures.fabric;o.material.needsUpdate=true}}});
   if(side==='left')hand.scale.x=-1;
   weapon.add(hand);anatomicalHands.push({hand,side,weapon,base:new THREE.Vector3()});
  }
 }
}).catch(e=>console.warn('Anatomical hand fallback',e));
function viewmodelFrame(dt){
 const w=stateWeapon(),t=w.reloading?THREE.MathUtils.clamp((performance.now()-w.reloadAt)/(w.cfg.reload*1000),0,1):0;
 const reach=w.reloading?Math.sin(Math.PI*t):0;
 for(const item of anatomicalHands){
  const {hand,side}=item;
  if(side==='right'){hand.position.set(.08,-.12,.07);hand.rotation.set(.75,-.12,-.95)}
  else{
   hand.position.set(-.075-.08*reach,-.075-.23*reach,-.68+.43*reach);
   hand.rotation.set(.12+.75*reach,.10,-.08-.45*reach);
  }
 }
 // Keep the actual inserted magazine visually connected to the support hand.
 if(detailedWeaponParts.rifleMag&&currentWeapon==='rifle'){
  detailedWeaponParts.rifleMag.position.y=-.22-.23*reach;
  detailedWeaponParts.rifleMag.position.x=-.05*reach;
 }
}
