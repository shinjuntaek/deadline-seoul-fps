/* Inlined after the legacy game/coop bootstrap; shared campaign contract above. */
let selectedMode='survival',campaign=campaignState(),campaignWorld=null;
const arenaTargets=staticTargets.slice();
const arenaObjects=scene.children.filter(o=>![camera,hemi,moon,lightning,rain,extraction].includes(o));
const arenaVisibility=new Map(arenaObjects.map(o=>[o,o.visible]));
const campaignTargets=[],campaignChunks=[],campaignGates=[],campaignLamps=[];
const campaignBox=new THREE.BoxGeometry(1,1,1),campaignCylinder=new THREE.CylinderGeometry(1,1,1,10);
const campaignPalette={
 road:new THREE.MeshStandardMaterial({color:0x30393b,map:asphalt,roughness:.63,metalness:.12}),
 concrete:new THREE.MeshStandardMaterial({color:0x566063,map:asphalt,roughness:.95}),
 brick:new THREE.MeshStandardMaterial({color:0x604f48,map:asphalt,roughness:.93}),
 pale:new THREE.MeshStandardMaterial({color:0x7e837e,roughness:.85}),
 iron:new THREE.MeshStandardMaterial({color:0x293337,metalness:.68,roughness:.48}),
 shutter:new THREE.MeshStandardMaterial({color:0x424e50,metalness:.48,roughness:.65}),
 glass:new THREE.MeshStandardMaterial({color:0x101f25,metalness:.65,roughness:.2}),
 yellow:new THREE.MeshStandardMaterial({color:0xb7a66e,roughness:.82}),
 lamp:new THREE.MeshBasicMaterial({color:0xc0e8dc}),warm:new THREE.MeshBasicMaterial({color:0xefb16b}),
 blue:new THREE.MeshStandardMaterial({color:0x345a68,roughness:.48,metalness:.35}),
 tyre:new THREE.MeshStandardMaterial({color:0x13191b,roughness:.98}),
 water:new THREE.MeshStandardMaterial({color:0x172d37,metalness:.6,roughness:.23}),
};
// Software rasterizers retain route readability with a cheaper lighting model.
if(ultraLow)for(const key of Object.keys(campaignPalette)){const m=campaignPalette[key];if(m.isMeshStandardMaterial){campaignPalette[key]=new THREE.MeshLambertMaterial({color:m.color,map:m.map,emissive:m.emissive});m.dispose()}}
function makeCampaignWorld(){
 if(campaignWorld)return;
 campaignWorld=new THREE.Group();campaignWorld.name='SEOUL ESCAPE · 340m connected route';scene.add(campaignWorld);
 const dummy=new THREE.Object3D();
 function chunk(center){const g=new THREE.Group();g.userData.center=center;g.userData.batches=new Map();campaignWorld.add(g);campaignChunks.push(g);return g}
 function part(g,key,x,y,z,w,h,d,rotate=0,shape='box'){
  const id=key+'/'+shape;let b=g.userData.batches.get(id);if(!b){b={key,shape,items:[]};g.userData.batches.set(id,b)}
  b.items.push({x,y,z,w,h,d,rotate});
 }
 function sign(g,text,x,y,z,w=6,h=1,sub='서울 비상 대피 경로',color='#a6dfbc',ry=0){
  const texture=signTexture(text,color,sub);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),(ultraLow?new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.5,roughness:.7,side:THREE.DoubleSide})));
  mesh.position.set(x,y,z);mesh.rotation.y=ry;g.add(mesh);campaignTargets.push(mesh);
 }
 function lamp(g,x,y,z,warm=false){
  part(g,'iron',x,y/2,z,.14,y,.14);part(g,warm?'warm':'lamp',x,y,z,.55,.12,1.2);
  const l=new THREE.PointLight(warm?0xffba7c:0x91d1c3,quality==='low'?1.8:3.5,18,1.8);l.position.set(x,y-.2,z);g.add(l);campaignLamps.push(l);
 }
 for(let k=0;k<12;k++){
  const z=5-k*29,s=CAMPAIGN_STAGES[z<-204?2:z<-94?1:0],g=chunk(z),half=s.width;
  part(g,'road',0,-.1,z,half*2,.16,29.1);
  for(const side of [-1,1]){
   const x=side*(half+3),h=s.id==='alley'?11+(k%3)*3:6;
   if(s.id==='alley'){
    part(g,k%2?'concrete':'brick',x,h/2,z,6,h,28.5);
    for(let t=-10;t<=10;t+=10){
     part(g,'iron',side*(half-.03),1.6,z+t,.22,3.2,5);
     part(g,'shutter',side*(half-.22),1.5,z+t,.12,2.7,4.5);
     for(let rib=.4;rib<2.8;rib+=.3)part(g,'iron',side*(half-.3),rib,z+t,.1,.035,4.5);
     for(let floor=1;floor<=3;floor++){
      part(g,'pale',side*(half-.15),4+floor*2.5,z+t,.22,1.7,2.3);
      part(g,(floor+t+k)%3===0?'warm':'glass',side*(half-.28),4+floor*2.5,z+t,.1,1.4,2);
      part(g,'pale',side*(half-.5),4+floor*2.5-.9,z+t,.75,.16,2.6);
     }
     part(g,'pale',side*(half-.65),3.4,z+t+3,1.1,.65,.8);
     part(g,'iron',side*(half-.4),4.5,z+t+4,.15,8,.15);
    }
    sign(g,side<0?['서울식당','청파 세탁','24 편의점','대성 공업사'][k%4]:['한빛약국','서울부동산','치킨 & 호프','정비센터'][k%4],side*(half-.35),3.4,z,7,1.1,'SEOUL · CLOSED',side<0?'#86c9ae':'#dab48a',side<0?Math.PI/2:-Math.PI/2);
   }else if(s.id==='underpass'){
    part(g,'concrete',side*(half+.5),3.5,z,1,7,29.1);
    part(g,'yellow',side*(half-.04),1.05,z,.09,.3,29);
    part(g,'iron',side*(half-.2),5.8,z,.3,.3,29);
    for(let t=-12;t<15;t+=7)part(g,'pale',side*(half-.2),3.5,z+t,.4,7,.7);
   }else{
    // Low river parapet, river visible beyond it; construction fence on city side.
    part(g,'concrete',side*(half+.5),.65,z,1,1.3,29);
    for(let t=-12;t<15;t+=4){part(g,'iron',side*half,1.5,z+t,.12,2.8,.12);part(g,'iron',side*half,2.6,z+t,.12,.1,4)}
    if(side>0)part(g,'water',half+18,-.45,z,35,.08,29.1);
    else{part(g,'concrete',-half-7,4+(k%2)*2,z,10,8+(k%2)*4,14);part(g,'glass',-half-1.9,5,z,.15,2,8)}
   }
   // Flush shoulders avoid curb collisions / zombie trapping.
   part(g,'concrete',side*(half-1.1),-.005,z,2,.05,29);
  }
  if(s.id==='underpass'){
   part(g,'concrete',0,7.1,z,24,.6,29.1);
   part(g,'iron',0,6.7,z,23,.2,.3);
   for(const x of [-4.5,4.5]){part(g,'lamp',x,6.73,z,2,.08,.35);lamp(g,x,5.8,z)}
  }else lamp(g,k%2?-8.5:8.5,5.8,z,k%3===0);
  for(let t=-12;t<15;t+=6)part(g,'yellow',.15,.015,z+t,.13,.02,2.8);
  // Small puddles use the same material and instanced geometry.
  part(g,'water',k%2?4:-5,.022,z+6,3.5,.008,5.2);
  part(g,'iron',-half+2,.025,z+9,1.1,.035,.75);
  if(k%2===0)sign(g,'대피소 ↑',-5.9,2.6,z+3,2.5,.9,'EVACUATION · KEEP MOVING','#c8e79b');
 }
 for(const b of CAMPAIGN_BLOCKS){
  const g=campaignChunks.reduce((a,c)=>Math.abs(c.userData.center-b.z)<Math.abs(a.userData.center-b.z)?c:a);
  const x=b.x,z=b.z;
  if(b.kind==='crate'){part(g,'yellow',x,.6,z,b.w,1.2,b.d);part(g,'iron',x,.8,z,b.w+.04,.12,b.d+.04);continue}
  const bus=b.kind==='bus',length=bus?8.2:4.5,width=bus?2.7:2.2;
  part(g,bus?'blue':'pale',x,.74,z,width,.95,length);
  part(g,'glass',x,bus?1.9:1.43,z,width*.89,bus?1.5:.65,length*.62);
  part(g,bus?'blue':'iron',x,bus?2.72:1.8,z,width*.93,.16,length*.65);
  part(g,'iron',x,.42,z,width+.12,.2,length+.06);
  for(const side of [-1,1]){
   // Wheels point along X via a box tyre profile with hub insert.
   for(const dz of [-length*.32,length*.32]){part(g,'tyre',x+side*width*.48,.45,z+dz,.36,.85,.85);part(g,'iron',x+side*(width*.48+.19),.45,z+dz,.05,.4,.4)}
   part(g,'lamp',x+side*width*.3,.85,z-length/2-.02,.45,.25,.04);
   part(g,'warm',x+side*width*.3,.85,z+length/2+.02,.4,.18,.04);
  }
  if(bus)sign(g,'재난 대피 차량',x,2.5,z+length/2+.04,2.3,.45,'SEOUL RESCUE','#bbdfb7');
 }
 CAMPAIGN_STAGES.forEach((s,i)=>{
  const g=chunk(s.gate),door=new THREE.Group();door.position.set(0,0,s.gate);g.add(door);
  const left=new THREE.Mesh(campaignBox,campaignPalette.shutter);left.scale.set(5.8,3.5,.28);left.position.set(-3,1.75,0);door.add(left);
  const right=new THREE.Mesh(campaignBox,campaignPalette.shutter);right.scale.set(5.8,3.5,.28);right.position.set(3,1.75,0);door.add(right);
  for(const side of [-1,1])part(g,'concrete',side*(s.width+6)/2,2,s.gate,s.width-6,4,.65);
  part(g,'iron',0,3.8,s.gate,12.6,.5,.6);
  sign(g,i===2?'한강 대피소':'안전 구역 0'+(i+1),0,4.5,s.gate+.1,8,1.1,i===2?'모두 모여 구조 신호 유지':'전투 완료 → 전원 집결 → 문 개방','#a9e2bc');
  const area=new THREE.Mesh(new THREE.PlaneGeometry(11,9),new THREE.MeshBasicMaterial({color:0x65c69b,transparent:true,opacity:.12,depthWrite:false}));area.rotation.x=-Math.PI/2;area.position.set(0,.035,s.gate+5);g.add(area);
  campaignGates.push({door,left,right,area,stage:i});campaignTargets.push(left,right);
  lamp(g,-5,4,s.gate+5);lamp(g,5,4,s.gate+5);
 });
 for(const g of campaignChunks){
  for(const {key,shape,items}of g.userData.batches.values()){
   const mesh=new THREE.InstancedMesh(shape==='box'?campaignBox:campaignCylinder,campaignPalette[key],items.length);
   items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.rotation.set(0,p.rotate,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=quality==='high'&&['concrete','brick','pale'].includes(key);g.add(mesh);campaignTargets.push(mesh);
  }
  g.userData.batches.clear();
 }
 // Share geometries/materials across every chunk; one allocation for the session.
 campaignWorld.visible=false;
}
function campaignSetWorld(enabled){
 if(enabled)makeCampaignWorld();
 hemi.intensity=enabled?1.18:(quality==='low'?1:.78);
 arenaObjects.forEach(o=>o.visible=enabled?false:arenaVisibility.get(o));
 if(campaignWorld)campaignWorld.visible=enabled;
 staticTargets.splice(0,staticTargets.length,...(enabled?campaignTargets:arenaTargets));
 scene.fog.density=enabled?.012:(quality==='low'?.019:.015);
 extraction.visible=false;extraction.position.set(0,.03,-45);
}
const arenaBlocked=blocked;blocked=function(x,z,r=.38){return selectedMode==='campaign'?campaignBlocked(x,z,r,campaign):arenaBlocked(x,z,r)};
const arenaReset=resetRun;resetRun=function(){
 campaignSetWorld(selectedMode==='campaign');arenaReset();
 if(selectedMode!=='campaign')return;
 clearRun();campaign=campaignState();camera.position.set(CAMPAIGN_START.x,PLAYER.height,CAMPAIGN_START.z);yaw=0;pitch=0;camera.rotation.set(0,0,0);stats.wave=1;waveIndex=0;
 spawnPickup('ammo',new THREE.Vector3(-4,0,-17));spawnPickup('medkit',new THREE.Vector3(4,0,-74));
};
const arenaBeginWave=beginWave;beginWave=function(i){if(selectedMode!=='campaign')return arenaBeginWave(i);showBanner('SEOUL ESCAPE · CHAPTER 01','서울역 뒤편 골목','표지판을 따라 전진 · 봉쇄선을 돌파하세요',4)};
function campaignEvent(event){
 const s=CAMPAIGN_STAGES[campaign.stage];
 if(event==='combat')showBanner('INFECTED CONTACT',s.name+' · 전투','감염체를 모두 정리하고 출구로 전진');
 if(event==='cleared')showBanner('SECTOR CLEAR','출구로 이동','초록색 집결 구역에 전원 모이세요');
 if(event==='open')showBanner('SAFE PASSAGE','봉쇄문 개방','문을 통과하면 보급과 다음 구역 시작');
 if(event==='checkpoint'){
  stats.wave=campaign.stage+1;waveIndex=campaign.stage;
  if(!coop.active){health=Math.min(100,health+35);armor=Math.min(75,armor+25);weaponState.rifle.reserve=Math.max(weaponState.rifle.reserve,180);weaponState.shotgun.reserve=Math.max(weaponState.shotgun.reserve,40);spawnPickup('ammo',new THREE.Vector3(-4,0,s.trigger+8));spawnPickup('medkit',new THREE.Vector3(4,0,s.gate+18))}
  showBanner('CHAPTER 0'+(campaign.stage+1)+' · CHECKPOINT',s.name,'체력 · 방탄 · 탄약 보급 완료',4);
 }
 if(event==='victory'){finish(true);dom['result-title'].textContent='서울 탈출 성공';dom['result-description'].textContent='골목과 지하차도를 돌파해 한강 대피소에 도착했습니다.'}
}
const arenaDirector=director;director=function(dt){
 if(selectedMode!=='campaign')return arenaDirector(dt);
 if(spawnQueue.length&&enemies.filter(z=>!z.dead).length<(softwareGPU?7:quality==='low'?10:16)){
  spawnCooldown-=dt;if(spawnCooldown<=0){const p=campaignSpawn(campaign.stage,stats.kills+enemies.length);createEnemy(spawnQueue.shift(),new THREE.Vector3(p.x,0,p.z));spawnCooldown=.8}
 }
 const event=advanceCampaign(campaign,dt,{players:[{x:camera.position.x,z:camera.position.z}],enemies:enemies.filter(z=>!z.dead).length,queued:spawnQueue.length});
 if(event==='combat'){spawnQueue=campaignQueue(campaign.stage);spawnCooldown=.8}
 if(event)campaignEvent(event);
};
const arenaExtraction=updateExtraction;updateExtraction=function(dt){if(selectedMode!=='campaign')arenaExtraction(dt)};
const arenaHUD=updateHUD;updateHUD=function(){
 arenaHUD();if(selectedMode!=='campaign')return;
 const s=CAMPAIGN_STAGES[campaign.stage],distance=Math.max(0,Math.round(camera.position.z-s.gate));
 dom['wave-label'].textContent='구역 '+(campaign.stage+1)+' / 3';dom.objective.textContent=s.name;
 const remaining=coop.active?(coop.lastState?.enemies.length||0)+(coop.lastState?.queued||0):enemies.filter(e=>!e.dead).length+spawnQueue.length;
 dom['objective-detail'].textContent=campaign.status==='combat'?'봉쇄선 전투 · 남은 감염체 '+remaining+' · 출구 '+distance+'m':campaign.status==='regroup'?'출구 집결 '+distance+'m · 전원 대기 '+campaign.hold.toFixed(1)+' / '+s.hold+'초':campaign.status==='open'?'문이 열렸습니다 · 전원 다음 구역으로 이동':s.subtitle+' · '+distance+'m';
};
const arenaWorldUpdate=updateWorld;updateWorld=function(dt){
 arenaWorldUpdate(dt);if(selectedMode!=='campaign'||!campaignWorld)return;
 for(const g of campaignChunks)g.visible=Math.abs(camera.position.z-g.userData.center)<(ultraLow?74:112);
 // At most four nearby fixed lights; no extra shadow maps along the longer route.
 const near=campaignLamps.slice().sort((a,b)=>a.position.distanceToSquared(camera.position)-b.position.distanceToSquared(camera.position)).slice(0,ultraLow?0:quality==='low'?2:4);
 campaignLamps.forEach(l=>l.visible=near.includes(l));
 campaignGates.forEach(g=>{const open=g.stage<campaign.stage||(g.stage===campaign.stage&&['open','complete'].includes(campaign.status));g.left.position.x+=( (open?-9:-3)-g.left.position.x)*Math.min(1,dt*3);g.right.position.x+=((open?9:3)-g.right.position.x)*Math.min(1,dt*3);g.door.visible=Math.abs(g.left.position.x)<8.95||!open;g.area.material.opacity=g.stage===campaign.stage&&campaign.status==='regroup'?.22:.06});
 moon.position.set(camera.position.x-28,38,camera.position.z+18);moon.target.position.set(camera.position.x,0,camera.position.z);moon.target.updateMatrixWorld();
 rain.visible=!(camera.position.z<-94&&camera.position.z>-204);
};
const arenaMenu=menu;menu=function(){arenaMenu();selectedMode='survival';campaignSetWorld(false);rain.visible=true;moon.position.set(-28,38,18);moon.target.position.set(0,0,0);moon.target.updateMatrixWorld()};
const campaignButton=document.createElement('button');campaignButton.id='campaign-start';campaignButton.type='button';campaignButton.className=dom.start.className;campaignButton.textContent='서울 탈출 캠페인';
campaignButton.addEventListener('click',()=>{if(phase!=='menu')return;selectedMode='campaign';startRun()});dom.start.before(campaignButton);dom.start.textContent='기존 5웨이브 방어전';
dom.start.addEventListener('click',()=>selectedMode='survival',{capture:true});
const routeNote=document.createElement('p');routeNote.className='campaign-route-note';routeNote.textContent='NEW · 골목 → 지하차도 → 한강 대피소 / 도보 연결 340m';campaignButton.before(routeNote);
const style=document.createElement('style');style.textContent='.campaign-route-note{font-size:12px;line-height:1.7;color:#b5d3c6;margin:0 0 9px;letter-spacing:.02em}#campaign-start{margin-bottom:8px;background:#b9dfb4;color:#14291d}#coop-mode{display:block;width:100%;padding:10px;margin-top:8px;background:#10251f;color:#eaffdf;border:1px solid #56887b;border-radius:6px}';document.head.appendChild(style);
const modeLabel=document.createElement('label');modeLabel.textContent='방 작전';const modeSelect=document.createElement('select');modeSelect.id='coop-mode';modeSelect.innerHTML='<option value="survival">기존 5웨이브 방어전</option><option value="campaign">서울 탈출 캠페인 · 연결 스테이지</option>';modeLabel.appendChild(modeSelect);coop.lobby.querySelector('#coop-create').before(modeLabel);
const originalCoopReceive=coopReceive;coopReceive=function(m){
 if(m.t==='start'||m.t==='resume')selectedMode=m.mode==='campaign'?'campaign':'survival';
 if(m.t==='resume'){
  for(const e of coop.enemyMeshes.values())coopDisposeZombie(e);coop.enemyMeshes.clear();
  for(const g of coop.teammates.values())coopDisposeTeammate(g);coop.teammates.clear();
  coop.active=true;coop.ended=false;coop.needsReconnect=false;coopClosePanel();startRun();clearRun();
  if(m.state.campaign)campaign={...m.state.campaign};const me=m.state.players.find(p=>p.id===coop.playerId);if(me){camera.position.set(me.x,PLAYER.height,me.z);yaw=me.yaw;pitch=me.pitch}
  coop.lastState=m.state;coopApplySnapshot(m.state);return;
 }
 if(m.t==='campaign'){campaign={...m.campaign};campaignEvent(m.event);return}
 if(m.t==='state'&&m.campaign)campaign={...m.campaign};
 originalCoopReceive(m);
 if(m.t==='lobby'&&m.mode==='campaign')coop.lobby.querySelector('h2').textContent='서울 탈출 캠페인 · 3개 연결 구역';
};
window.__DEADLINE_CAMPAIGN_STATUS__=()=>({mode:selectedMode,phase,campaign:{...campaign},position:{x:camera.position.x,z:camera.position.z},yaw,pitch,health,armor,ammo:stateWeapon().ammo,queued:spawnQueue.length,enemies:enemies.filter(e=>!e.dead).length,kills:stats.kills,quality,softwareGPU,gpu:gpuRendererName,width:innerWidth,height:innerHeight,renderScale,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,ws:coop.ws?.readyState??null,peers:coop.lastState?.players.map(p=>({id:p.id,x:p.x,z:p.z,connected:p.connected}))||[]});
// Only loopback CI may drive deterministic stage states. No remote cheats in Preview.
if(['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).has('campaignQA')){
 window.__CAMPAIGN_TEST__={
  position:(x,z)=>{if(coop.active)throw Error('server owns cooperative position');if(campaignBlocked(x,z,.38,campaign))throw Error('blocked QA position');camera.position.set(x,PLAYER.height,z);velocity.set(0,0,0);yaw=0;pitch=0},
  aim:(x,z,y=1.4)=>{yaw=Math.atan2(-(x-camera.position.x),-(z-camera.position.z));pitch=Math.atan2(y-camera.position.y,Math.hypot(x-camera.position.x,z-camera.position.z));camera.rotation.set(pitch,yaw,0)},
  clearEncounter:()=>{if(coop.active)throw Error('server owns cooperative combat');spawnQueue.length=0;for(const e of enemies)if(!e.dead){enemyDamage(e,99999,false);killEnemy(e,false)}},
  targets:()=>enemies.filter(e=>!e.dead).map(e=>({x:e.group.position.x,z:e.group.position.z,hp:e.hp})),
  returnMenu:()=>menu(),
 };
}
