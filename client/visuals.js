/* Original Seoul quarantine atmosphere. All resources are scene-owned and reused. */
const visualTextures={};
for(const name of ['asphalt','concrete','fabric','gunmetal']){
 const texture=aiLoader.load('/assets/materials/'+name+'.webp');
 texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());visualTextures[name]=texture;
}
visualTextures.asphalt.repeat.set(20,20);visualTextures.concrete.repeat.set(4,16);
visualTextures.fabric.repeat.set(1,2);visualTextures.gunmetal.repeat.set(2,3);
ground.material.map=visualTextures.asphalt;ground.material.color.setHex(0x89999d);
ground.material.roughness=quality==='low'?.79:.57;ground.material.metalness=.10;ground.material.needsUpdate=true;
concrete.map=visualTextures.concrete;concrete.color.setHex(0xa1a8a4);concrete.needsUpdate=true;
for(const m of [gunMetal,envMat.iron,envMat.rust]){m.map=visualTextures.gunmetal;m.needsUpdate=true}
gunMetal.color.setHex(0x9aadae);gunMetal.roughness=.44;
// Tighter shadow region follows the player on the texel grid, avoiding shimmer.
if(moon.castShadow){
 const span=quality==='high'?27:22,size=quality==='high'?1024:512;
 moon.shadow.mapSize.set(size,size);Object.assign(moon.shadow.camera,{left:-span,right:span,top:span,bottom:-span});
 moon.shadow.camera.updateProjectionMatrix();scene.add(moon.target);
}
hemi.intensity=quality==='low'?1.25:.92;hemi.color.setHex(0x8da5b8);
flashlight.color.setHex(0xeee7ce);flashlight.penumbra=.65;flashlight.intensity=32;
// A visible destination light at the existing east-side shop; no new collider.
const shopSignCanvas=document.createElement('canvas');shopSignCanvas.width=512;shopSignCanvas.height=128;
const shopInk=shopSignCanvas.getContext('2d');shopInk.fillStyle='#cce3d5';shopInk.fillRect(0,0,512,128);shopInk.fillStyle='#125b48';shopInk.font='bold 65px sans-serif';shopInk.textAlign='center';shopInk.fillText('24시 편의점',256,86);
const shopTex=new THREE.CanvasTexture(shopSignCanvas);shopTex.colorSpace=THREE.SRGBColorSpace;
const shopSign=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.1),new THREE.MeshBasicMaterial({map:shopTex,toneMapped:false}));shopSign.rotation.y=-Math.PI/2;shopSign.position.set(11.43,3.45,21);scene.add(shopSign);
if(quality!=='low'){
 const shopLight=new THREE.PointLight(0xbce8d1,17,10,2);shopLight.position.set(10.9,2.6,21);scene.add(shopLight);
 const abandonedLamp=new THREE.SpotLight(0xffdca4,28,22,.40,.7,1.6);abandonedLamp.position.set(-3.4,.8,10);abandonedLamp.target.position.set(4,.1,4);scene.add(abandonedLamp,abandonedLamp.target);
}
// One alpha texture, one instanced draw for local illuminated wet-road pools.
const poolCanvas=document.createElement('canvas');poolCanvas.width=poolCanvas.height=64;
const poolCtx=poolCanvas.getContext('2d'),gradient=poolCtx.createRadialGradient(32,32,0,32,32,32);
gradient.addColorStop(0,'rgba(222,180,107,.65)');gradient.addColorStop(.3,'rgba(173,154,107,.24)');gradient.addColorStop(1,'rgba(0,0,0,0)');
poolCtx.fillStyle=gradient;poolCtx.fillRect(0,0,64,64);
const poolTex=new THREE.CanvasTexture(poolCanvas);poolTex.colorSpace=THREE.SRGBColorSpace;
const poolMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:poolTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),8);
const poolDummy=new THREE.Object3D();let poolIndex=0;
for(const x of [-10.7,10.7])for(const z of [-36,-12,12,36]){
 poolDummy.position.set(x,.035,z);poolDummy.rotation.x=-Math.PI/2;poolDummy.scale.set(4.3,7.8,1);poolDummy.updateMatrix();poolMesh.setMatrixAt(poolIndex++,poolDummy.matrix);
}
poolMesh.instanceMatrix.needsUpdate=true;poolMesh.frustumCulled=false;scene.add(poolMesh);
// A light mist layer is quality-gated: four cheap cards, never a full-screen post-process.
const mist=[];
// Merge only immutable detail owned by envRoot; gameplay collision meshes remain intact.
import('/vendor/BufferGeometryUtils.js').then(({mergeGeometries})=>{
 envRoot.updateMatrixWorld(true);const batches=new Map();
 for(const mesh of [...envRoot.children])if(mesh.isMesh&&!mesh.isInstancedMesh&&!Array.isArray(mesh.material)){
  const batch=batches.get(mesh.material)||[];batch.push(mesh);batches.set(mesh.material,batch);
 }
 for(const [material,meshes] of batches){
  if(meshes.length<3)continue;
  const parts=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrixWorld));
  const geo=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());if(!geo)continue;
  const combined=new THREE.Mesh(geo,material);combined.castShadow=quality!=='low';combined.receiveShadow=true;scene.add(combined);
  const released=new Set();for(const m of meshes){envRoot.remove(m);if(!released.has(m.geometry)){released.add(m.geometry);m.geometry.dispose()}}
 }
}).catch(e=>console.warn('Static detail batching unavailable',e));
if(!ultraLow&&quality!=='low'){
 const material=new THREE.MeshBasicMaterial({map:poolTex,color:0x6c92a0,transparent:true,opacity:.055,depthWrite:false,side:THREE.DoubleSide});
 for(let i=0;i<4;i++){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(21,3),material);m.position.set((i%2?1:-1)*5,1.1,-36+i*23);scene.add(m);mist.push(m);
 }
}
function visualFrame(dt){
 if(moon.castShadow){const x=Math.round(camera.position.x*4)/4,z=Math.round(camera.position.z*4)/4;moon.position.set(x-28,38,z+18);moon.target.position.set(x,0,z)}
 for(let i=0;i<mist.length;i++){const m=mist[i];m.position.x=(i%2?1:-1)*5+Math.sin(elapsed*.09+i)*2;m.quaternion.copy(camera.quaternion)}
}
function improveSurvivor(group){
 // Reuse the actual existing body and joint pivots; no screen-facing teammate images.
 const meshes=group.children.filter(o=>o.isMesh);
 for(const m of meshes){if(m.material.color?.getHex()===0x435b56){m.material.map=visualTextures.fabric;m.material.color.setHex(0x899584);m.material.needsUpdate=true}}
 const limbs=[];
 for(const [index,hipY] of [[4,1.65],[5,1.65],[6,.97],[7,.97]]){
  const m=meshes[index];if(!m)continue;
  const pivot=new THREE.Group();pivot.position.set(m.position.x,hipY,0);
  m.position.x=0;m.position.y-=hipY;group.add(pivot);pivot.add(m);limbs.push(pivot);
 }
 group.userData.rig=limbs;group.userData.stride=0;group.userData.prev=group.position.clone();
}
function animateSurvivor(group,dt){
 const rig=group.userData.rig;if(!rig)return;
 const prev=group.userData.prev,d=Math.hypot(group.position.x-prev.x,group.position.z-prev.z);
 group.userData.stride+=Math.min(.3,d)*5.8;prev.copy(group.position);
 const amp=Math.min(1,d/Math.max(.001,dt)/3.5),stride=Math.sin(group.userData.stride)*.48*amp;
 rig.forEach((joint,i)=>{const goal=(i<2?-.22:0)+stride*(i%2?1:-1)*(i<2?.5:1);joint.rotation.x+=(goal-joint.rotation.x)*(1-Math.exp(-dt*16))});
}
