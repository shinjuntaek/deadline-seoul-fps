/**
 * Attach four-player cooperative mode without replacing proven single-player.
 * Opt-in UI, WebSocket client, teammate meshes, interpolation and state bridge.
 * All shared enemy damage, loot, wave and victory decisions are server-owned.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const dist=path.resolve(__dirname,'..','dist'),src=path.join(dist,'game.js');
let js=fs.readFileSync(src,'utf8');
function edit(before,after,why){
 const parts=js.split(before);
 if(parts.length!==2)throw new Error(why+' expected exactly once; found '+(parts.length-1));
 js=parts.join(after);
}
const multiplayer=String.raw`
/* ===== DEADLINE: SEOUL COOPERATIVE MODE (OPT-IN) ===== */
const coop={
 ws:null,active:false,ended:false,playerId:null,token:null,code:null,lobby:null,roomInfo:null,
 lastState:null,enemyMeshes:new Map(),teammates:new Map(),latestMembers:[],sendAt:0,pingAt:0,
 seq:0,ping:0,frameSamples:[],frameAt:performance.now(),reviveHeld:false,sentRevive:false,
 needsReconnect:false, serverInstance:null,desiredAction:null
};
function coopSocketSend(data){if(coop.ws&&coop.ws.readyState===WebSocket.OPEN)coop.ws.send(JSON.stringify(data))}
function coopText(selector,msg){const el=coop.lobby&&coop.lobby.querySelector(selector);if(el)el.textContent=String(msg)}
function coopMsg(msg){coopText('#coop-message',msg)}
function coopURL(){
 const here=new URL(location.href),q=new URLSearchParams();
 if(here.searchParams.get('_vercel_share'))q.set('_vercel_share',here.searchParams.get('_vercel_share'));
 return (location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/multiplayer'+(q.size?'?'+q.toString():'');
}
function coopName(){return (coop.lobby.querySelector('#coop-name').value||'생존자').replace(/[<>]/g,'').trim().slice(0,16)||'생존자'}
function coopInviteURL(){
 const here=new URL(location.href);
 here.searchParams.delete('qa');here.searchParams.delete('benchmark');
 here.searchParams.set('room',coop.code);
 return here.toString();
}
function coopDisconnect(){
 const ws=coop.ws;coop.ws=null;
 if(ws){try{ws.close(1000,'Leave room')}catch{}}
 for(const z of coop.enemyMeshes.values())coopDisposeZombie(z);
 coop.enemyMeshes.clear();
 for(const g of coop.teammates.values())coopDisposeTeammate(g);
 coop.teammates.clear();
 coop.active=false;coop.ended=false;coop.playerId=null;coop.token=null;
 coop.roomInfo=null;coop.lastState=null;
 const rev=document.getElementById('coop-revive');if(rev)rev.classList.add('hidden');
 const status=document.getElementById('coop-topline');if(status)status.classList.add('hidden');
}
function coopOpenPanel(){
 if(!coop.lobby)return;
 coop.lobby.classList.remove('hidden');
 try{document.exitPointerLock?.()}catch{}
 const code=new URL(location.href).searchParams.get('room');
 if(code&&/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/i.test(code)){
  coop.lobby.querySelector('#coop-code').value=code.toUpperCase();
  coopMsg('초대받은 방 코드가 입력되었습니다. 닉네임을 정하고 입장하세요.');
 }
}
function coopClosePanel(){if(coop.lobby)coop.lobby.classList.add('hidden')}
function coopLaunch(action){
 if(!('WebSocket'in window)){coopMsg('WebSocket을 지원하는 최신 브라우저가 필요합니다.');return}
 const code=coop.lobby.querySelector('#coop-code').value.trim().toUpperCase();
 if(action==='join'&&!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)){
  coopMsg('6자리 방 코드를 입력해 주세요.');return;
 }
 if(coop.ws&&coop.ws.readyState<2)coop.ws.close();
 coop.desiredAction=action;coop.serverInstance=null;coop.playerId=null;
 coopMsg('실시간 협동 서버에 연결하는 중...');
 const ws=new WebSocket(coopURL());
 coop.ws=ws;
 ws.onopen=()=>{coopSocketSend({t:action,name:coopName(),code,resumeToken:null})};
 ws.onmessage=(ev)=>{
  let m;try{m=JSON.parse(ev.data)}catch{return}
  coopReceive(m);
 };
 ws.onclose=()=>{
  if(coop.ws!==ws)return;
  const wasActive=coop.active;
  if(wasActive){
   coop.active=false;coop.needsReconnect=true;
   coopMsg('서버 연결이 끊겼습니다. 네트워크와 룸 서버 상태를 확인해 주세요.');
   coopOpenPanel();
   phase='paused';fireHeld=false;
  }else if(!coop.playerId)coopMsg('연결이 종료되었습니다. 방 코드를 확인하거나 다시 연결해 주세요.');
 };
 ws.onerror=()=>coopMsg('WebSocket 연결 오류입니다. 서버 /api/multiplayer 상태를 확인해 주세요.');
}
function coopRenderLobby(){
 const info=coop.roomInfo;if(!info)return;
 const list=coop.lobby.querySelector('#coop-members');list.replaceChildren();
 for(const p of info.players){
  const item=document.createElement('li');
  item.textContent=(p.id===info.hostId?'★ ':'')+p.name+
    (p.connected?'':' · 접속 끊김')+
    (p.ready?' · 준비 완료':' · 준비 전')+
    (p.id===coop.playerId?' (나)':'');
  list.appendChild(item);
 }
 const me=info.players.find(p=>p.id===coop.playerId);
 const isHost=info.hostId===coop.playerId;
 const ready=coop.lobby.querySelector('#coop-ready'),start=coop.lobby.querySelector('#coop-start');
 ready.disabled=!me;ready.textContent=me&&me.ready?'준비 취소':'준비 완료';
 start.disabled=!(isHost&&info.players.filter(p=>p.connected).length>=2&&info.players.every(p=>p.ready));
 start.classList.toggle('hidden',!isHost);
 const count=info.players.filter(p=>p.connected).length;
 coopText('#coop-roomcode',info.code+' · '+count+'/4');
 coop.lobby.querySelector('#coop-share').classList.remove('hidden');
 coop.lobby.querySelector('#coop-joinform').classList.add('hidden');
 if(info.phase==='lobby')coopMsg(isHost?'전원이 준비 완료하면 작전을 시작할 수 있습니다.':'방장이 작전을 시작하면 전투에 진입합니다.');
}
function coopReceive(m){
 if(m.t==='hello'){coop.serverInstance=m.instanceId;return}
 if(m.t==='error'){
  const codes={ROOM_NOT_FOUND:'방을 찾을 수 없습니다. Preview 서버 인스턴스가 달라 연결되지 않았을 수 있습니다.',ROOM_FULL:'방이 가득 찼습니다 (최대 4명).',MATCH_IN_PROGRESS:'이미 진행 중인 작전입니다.',NEED_TWO_PLAYERS:'최소 2명이 있어야 시작할 수 있습니다.',PLAYERS_NOT_READY:'모든 팀원이 준비를 완료해야 합니다.',NOT_HOST:'방장만 작전을 시작할 수 있습니다.',FORBIDDEN_ORIGIN:'허용되지 않은 접속입니다.'};
  coopMsg(codes[m.code]||('오류: '+m.code));return;
 }
 if(m.t==='joined'){
  coop.playerId=m.playerId;coop.token=m.token;coop.code=m.code;
  coopText('#coop-roomcode',m.code);
  const here=new URL(location.href);here.searchParams.set('room',m.code);
  history.replaceState(null,'',here.pathname+here.search+here.hash);
  coopRenderLobby();return;
 }
 if(m.t==='lobby'){coop.roomInfo=m;if(coop.playerId)coopRenderLobby();return}
 if(m.t==='start'){
  coop.active=true;coop.ended=false;coopClosePanel();
  startRun(); // Initializes the existing first-person camera, weapon and HUD.
  clearRun(); // Server owns spawns and pickups in co-op; discard local single-player wave.
  stats.wave=1;waveIndex=0;spawnQueue.length=0;
  dom.objective.textContent='4인 협동 · 서울 격리선 방어';
  dom['objective-detail'].textContent='서버에서 웨이브와 좀비를 동기화합니다.';
  const top=document.getElementById('coop-topline');if(top)top.classList.remove('hidden');
  return;
 }
 if(m.t==='wave'){stats.wave=m.wave;waveIndex=m.wave-1;showBanner('CO-OP DEFENSE','WAVE '+m.wave,'팀원과 함께 감염체를 막으세요.');return}
 if(m.t==='intermission'){showBanner('SECTOR SECURED','웨이브 완료',m.seconds+'초 후 다음 웨이브');return}
 if(m.t==='extract'){
  extraction.visible=true;dom.objective.textContent='공동 탈출 지점으로 이동';
  dom['objective-detail'].textContent='북쪽 신호 지점으로 이동한 뒤 7초 유지';return;
 }
 if(m.t==='state'){
  coop.lastState=m;coopApplySnapshot(m);return;
 }
 if(m.t==='shot'){
  if(m.by===coop.playerId&&m.hits&&m.hits.length){showHit(m.hits.some(h=>h.head));stats.hits++}
  return;
 }
 if(m.t==='down'){
  if(m.id===coop.playerId)showCenter('전투 불능 · 팀원이 구조할 수 있습니다',4);
  else showCenter('팀원 전투 불능 · 가까이 가서 E키로 구조',2);
  return;
 }
 if(m.t==='revived'){showCenter(m.id===coop.playerId?'구조 완료!':'팀원 구조 성공',2);return}
 if(m.t==='end'){
  coop.ended=true;stats.kills=m.kills;stats.score=m.score;
  finish(m.phase==='victory');
  dom['result-kicker'].textContent=m.phase==='victory'?'CO-OP MISSION COMPLETE':'CO-OP SIGNAL LOST';
  dom['result-description'].textContent=m.reason+' · '+coop.code+' · 협동 점수 '+m.score.toLocaleString('ko-KR');
  return;
 }
 if(m.t==='pong'){
  coop.ping=Math.max(0,Math.round(performance.now()-m.sent));
 }
}
function coopDisposeZombie(z){
 const i=enemies.indexOf(z);if(i>=0)enemies.splice(i,1);
 disposeEnemyGroup(z);
}
function coopMakeTeammate(p){
 const group=new THREE.Group();group.name='COOP TEAMMATE '+p.name;
 const uniform=new THREE.MeshStandardMaterial({color:0x435b56,metalness:.12,roughness:.85});
 const armorMat=new THREE.MeshStandardMaterial({color:0x26352e,metalness:.35,roughness:.72});
 const helmet=new THREE.MeshStandardMaterial({color:0x61756b,roughness:.74,metalness:.2});
 const skin=new THREE.MeshStandardMaterial({color:0xbaa095,roughness:.92});
 const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);group.add(m);m.castShadow=quality!=='low';return m};
 add(new THREE.BoxGeometry(.53,.72,.33),uniform,0,1.37,0);
 add(new THREE.BoxGeometry(.6,.51,.44),armorMat,0,1.40,-.05);
 add(new THREE.SphereGeometry(.19,10,9),skin,0,2.02,0);
 add(new THREE.SphereGeometry(.25,10,9),helmet,0,2.13,.02);
 add(new THREE.BoxGeometry(.13,.55,.13),uniform,-.34,1.37,0);
 add(new THREE.BoxGeometry(.13,.55,.13),uniform,.34,1.37,0);
 add(new THREE.BoxGeometry(.18,.72,.22),uniform,-.15,.61,0);
 add(new THREE.BoxGeometry(.18,.72,.22),uniform,.15,.61,0);
 add(new THREE.BoxGeometry(.43,.15,.85),armorMat,.20,1.25,-.38);
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#08171d';ctx.fillRect(0,0,256,64);
 ctx.font='bold 31px sans-serif';ctx.fillStyle='#aaf1cf';ctx.textAlign='center';
 ctx.fillText(p.name.slice(0,12),128,43);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthWrite:false,transparent:true}));
 sprite.position.y=2.77;sprite.scale.set(1.75,.43,1);group.add(sprite);
 scene.add(group);return group;
}
function coopDisposeTeammate(group){
 scene.remove(group);
 group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){
  if(o.material.map)o.material.map.dispose();o.material.dispose()
 }});
}
function coopApplySnapshot(state){
 if(!coop.active||coop.ended)return;
 stats.wave=Math.max(1,state.wave);
 stats.kills=state.kills;stats.score=state.score;
 const me=state.players.find(p=>p.id===coop.playerId);
 if(me){
  health=me.health;armor=me.armor;stamina=me.stamina;
  coop.downed=me.downed;coop.dead=me.dead;
  for(const w of ['rifle','shotgun']){
   weaponState[w].ammo=me.ammo[w];weaponState[w].reserve=me.reserve[w];
   weaponState[w].reloading=me.reloading&&me.weapon===w;
  }
  const dx=me.x-camera.position.x,dz=me.z-camera.position.z;
  const drift=Math.hypot(dx,dz);
  if(drift>1.1){camera.position.x=me.x;camera.position.z=me.z}
  else if(drift>.22){camera.position.x+=dx*.22;camera.position.z+=dz*.22}
 }
 const expected=new Set();
 for(const e of state.enemies){
  expected.add(e.id);let z=coop.enemyMeshes.get(e.id);
  if(!z){
   z=createEnemy(e.kind,new THREE.Vector3(e.x,0,e.z));
   z.coopId=e.id;z.serverTarget=new THREE.Vector3(e.x,0,e.z);
   coop.enemyMeshes.set(e.id,z);
  }
  z.hp=e.hp;z.max=e.max;z.serverTarget.set(e.x,0,e.z);z.remoteYaw=e.yaw;
 }
 for(const [id,z] of coop.enemyMeshes){
  if(!expected.has(id)){coopDisposeZombie(z);coop.enemyMeshes.delete(id)}
 }
 const mates=new Set();
 for(const p of state.players){
  if(p.id===coop.playerId)continue;mates.add(p.id);
  let g=coop.teammates.get(p.id);
  if(!g){g=coopMakeTeammate(p);coop.teammates.set(p.id,g);g.position.set(p.x,0,p.z)}
  g.userData.goal={x:p.x,z:p.z,yaw:p.yaw,downed:p.downed,dead:p.dead};
 }
 for(const [id,g] of coop.teammates){
  if(!mates.has(id)){coopDisposeTeammate(g);coop.teammates.delete(id)}
 }
 if(state.extraction?.visible)extraction.visible=true;
 dom.objective.textContent=state.phase==='extraction'?'함께 탈출 지점으로 이동':'4인 협동 · WAVE '+state.wave;
 dom['objective-detail'].textContent=state.phase==='extraction'?
  ('탈출까지 '+state.extraction.remaining.toFixed(0)+'초 · 동기화 '+Math.floor(state.extraction.hold/7*100)+'%'):
  ('남은 적 '+(state.queued+state.enemies.length)+' · 팀원 '+state.players.filter(p=>p.connected).length+'명');
 const status=document.getElementById('coop-topline');
 if(status){
  status.textContent='CO-OP · '+state.code+' · '+state.players.filter(p=>p.connected).length+'/4 · '+coop.ping+'ms · WAVE '+state.wave;
 }
}
function coopFrame(dt,now){
 for(const z of coop.enemyMeshes.values()){
  z.group.position.lerp(z.serverTarget,Math.min(1,dt*9));
  if(typeof z.remoteYaw==='number')z.group.rotation.y=z.remoteYaw;
  z.phase+=dt*(z.profile.speed*4.8);
  const s=Math.sin(z.phase);
  for(let i=0;i<4;i++)z.limbs[i].rotation.x=(i<2?-.55:0)+(i%2?-s:s)*.24;
 }
 for(const g of coop.teammates.values()){
  const goal=g.userData.goal;if(!goal)continue;
  g.position.x+=(goal.x-g.position.x)*Math.min(1,dt*12);
  g.position.z+=(goal.z-g.position.z)*Math.min(1,dt*12);
  g.rotation.y=goal.yaw;
  g.rotation.z=goal.downed?-1.0:0;
  g.position.y=goal.downed?-.3:0;
  g.visible=!goal.dead;
 }
 if(now-coop.sendAt>=100&&coop.ws?.readyState===WebSocket.OPEN){
  coop.sendAt=now;coop.seq++;
  coopSocketSend({t:'input',x:camera.position.x,z:camera.position.z,yaw,pitch,
   sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),seq:coop.seq});
  const near=coop.lastState?.players.find(p=>p.id!==coop.playerId&&p.downed&&!p.dead&&
   Math.hypot(p.x-camera.position.x,p.z-camera.position.z)<2.45);
  const pressed=(keys.has('KeyE')||coop.reviveHeld)&&!!near;
  if(pressed)coopSocketSend({t:'revive',targetId:near.id,hold:true});
  else if(coop.sentRevive){coopSocketSend({t:'revive',targetId:coop.sentRevive,hold:false})}
  coop.sentRevive=pressed?near.id:false;
  const reviveBtn=document.getElementById('coop-revive');
  if(reviveBtn)reviveBtn.classList.toggle('hidden',!near||!coarse);
 }
 if(now-coop.pingAt>5000){
  coop.pingAt=now;coopSocketSend({t:'ping',sent:performance.now()});
 }
 if(coop.downed||coop.dead){
  fireHeld=false;moveTouch.set(0,0);
 }
}
function coopShoot(now){
 if(coop.downed||coop.dead)return;
 const w=stateWeapon();
 if(w.reloading||!w.ammo||now<w.next)return;
 w.next=now+60000/w.cfg.rpm;
 w.ammo=Math.max(0,w.ammo-1);
 weaponKick=Math.min(1,weaponKick+.38);muzzleTimer=.065;
 dom['fx-muzzle'].style.opacity='1';
 try{audio.shot(w.cfg.id)}catch{}
 coopSocketSend({t:'fire'});
}
function coopReload(){
 if(coop.downed||coop.dead)return;
 const w=stateWeapon();
 if(w.reloading||w.ammo>=w.cfg.mag||w.reserve<=0)return;
 w.reloading=true;w.reloadAt=performance.now();
 coopSocketSend({t:'reload'});
}
function coopStartUI(){
 const launch=document.createElement('button');
 launch.id='coop-launch';launch.className='coop-launch';launch.textContent='친구와 4인 협동 플레이';
 launch.type='button';
 launch.addEventListener('click',coopOpenPanel);
 dom.start.parentElement.appendChild(launch);
 const panel=document.createElement('section');
 panel.id='coop-panel';panel.className='coop-panel hidden';panel.setAttribute('role','dialog');
 panel.setAttribute('aria-label','데드라인 서울 협동 플레이 대기실');
 panel.innerHTML='<div class="coop-card">'+
  '<header><span>ONLINE CO-OP</span><button id="coop-close" type="button" aria-label="닫기">×</button></header>'+
  '<h2>서울 격리선 · 4인 생존 작전</h2><p>실시간으로 최대 4명이 협동합니다. 최소 2명부터 작전을 시작할 수 있습니다.</p>'+
  '<div id="coop-joinform"><label>요원 닉네임<input id="coop-name" type="text" maxlength="16" placeholder="생존자"/></label>'+
  '<button id="coop-create" type="button">새 작전 방 만들기</button>'+
  '<label>친구의 6자리 방 코드<input id="coop-code" type="text" maxlength="6" placeholder="예: A2B3CD" autocapitalize="characters"/></label>'+
  '<button id="coop-join" type="button">방 코드로 입장하기</button></div>'+
  '<div id="coop-share" class="hidden"><strong id="coop-roomcode"></strong>'+
  '<button id="coop-copy" type="button">초대 링크 복사</button>'+
  '<ul id="coop-members"></ul>'+
  '<div class="coop-actions"><button id="coop-ready" type="button">준비 완료</button>'+
  '<button id="coop-start" type="button">작전 시작</button></div></div>'+
  '<p id="coop-message" aria-live="polite">서버를 연결하면 친구 초대가 가능합니다.</p>'+
  '<small>Preview 실험 기능 · 서버 인스턴스가 달라지면 방 참가에 실패할 수 있습니다.</small>'+
  '</div>';
 document.body.appendChild(panel);
 coop.lobby=panel;
 try{panel.querySelector('#coop-name').value=localStorage.getItem('deadline-seoul-nickname')||''}catch{}
 panel.querySelector('#coop-close').addEventListener('click',()=>{
  if(!coop.active)coopDisconnect();coopClosePanel();
 });
 panel.querySelector('#coop-create').addEventListener('click',()=>{
  try{localStorage.setItem('deadline-seoul-nickname',coopName())}catch{}
  coopLaunch('create');
 });
 panel.querySelector('#coop-join').addEventListener('click',()=>{
  try{localStorage.setItem('deadline-seoul-nickname',coopName())}catch{}
  coopLaunch('join');
 });
 panel.querySelector('#coop-ready').addEventListener('click',()=>{
  const me=coop.roomInfo?.players.find(p=>p.id===coop.playerId);
  if(me)coopSocketSend({t:'ready',value:!me.ready});
 });
 panel.querySelector('#coop-start').addEventListener('click',()=>coopSocketSend({t:'start'}));
 panel.querySelector('#coop-copy').addEventListener('click',()=>{
  const link=coopInviteURL();
  navigator.clipboard?.writeText(link).then(()=>coopMsg('초대 링크를 복사했습니다.'),()=>coopMsg('초대 주소: '+link));
 });
 const top=document.createElement('div');top.id='coop-topline';top.className='coop-topline hidden';
 document.body.appendChild(top);
 const revive=document.createElement('button');revive.id='coop-revive';
 revive.className='coop-revive hidden';revive.textContent='팀원 소생 (누르고 있기)';
 revive.addEventListener('pointerdown',e=>{e.preventDefault();coop.reviveHeld=true});
 for(const event of ['pointerup','pointercancel','pointerleave'])revive.addEventListener(event,()=>coop.reviveHeld=false);
 document.body.appendChild(revive);
 const roomParam=new URL(location.href).searchParams.get('room');
 if(roomParam&&/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/i.test(roomParam))coopOpenPanel();
 window.__DEADLINE_COOP_STATUS__=()=>({active:coop.active,playerId:coop.playerId,
  room:coop.code,phase:coop.lastState?.phase||coop.roomInfo?.phase||'none',
  members:coop.lastState?.players?.length||coop.roomInfo?.players?.length||0,
  ping:coop.ping,enemies:coop.enemyMeshes.size});
}
coopStartUI();
/* ===== END COOP ===== */
`;
edit('function frame(){',multiplayer+'\nfunction frame(){','insert cooperative UI and state bridge');
edit('function shoot(now){',"function shoot(now){if(coop.active){coopShoot(now);return}",'co-op authoritative shot');
edit('function reload(){',"function reload(){if(coop.active){coopReload();return}",'co-op authoritative reload');
edit('function switchWeapon(id){',"function switchWeapon(id){if(coop.active)coopSocketSend({t:'weapon',weapon:id});",'co-op weapon selection');
edit("function takeDamage(amount){","function takeDamage(amount){if(coop.active)return;",'co-op server damage');
edit('function updatePlayer(dt){',"function updatePlayer(dt){if(coop.active&&(coop.downed||coop.dead))return{moving:false,sprint:false,speed:0};",'co-op freeze downed player');
const localAI="for(let i=enemies.length-1;i>=0;i--)if(!updateEnemy(enemies[i],dt))enemies.splice(i,1);director(dt);updatePickups(dt);updateExtraction(dt);updateHUD();";
if(!js.includes(localAI))throw Error('local AI marker mismatch');
edit(localAI,
"if(coop.active){coopFrame(dt,now);updateHUD();const st=coop.lastState;if(st){dom['enemy-count'].textContent=st.enemies.length+st.queued}}else{"+localAI+"}",
'disable local zombie AI and wave director during co-op');
edit("function menu(){phase='menu';","function menu(){if(coop.active||coop.ws)coopDisconnect();phase='menu';",'co-op exit cleanup');
edit("dom.restart.addEventListener('click',startRun);",
"dom.restart.addEventListener('click',e=>{if(coop.ended){e.stopImmediatePropagation();coopDisconnect();menu();coopOpenPanel();return}startRun()});",
'co-op restart must not accidentally initialize local battle');
const css=String.raw`
/* Four-player room UI; all dynamic names use textContent, never raw HTML. */
.coop-launch{background:#2a5552!important;border:1px solid #6ccfb0!important;color:#e2fff0!important;margin-top:11px;letter-spacing:.02em}
.coop-panel{position:fixed;inset:0;z-index:550;display:flex;align-items:center;justify-content:center;background:rgba(3,8,10,.92);backdrop-filter:blur(12px);padding:16px;overflow:auto}
.coop-panel.hidden,.coop-topline.hidden,.coop-revive.hidden{display:none!important}
.coop-card{width:min(530px,100%);background:linear-gradient(130deg,#172625,#091012);border:1px solid #426f65;border-radius:16px;box-shadow:0 20px 90px #0009;padding:22px;color:#e6f1e9;font:15px/1.45 system-ui,sans-serif}
.coop-card header{display:flex;justify-content:space-between;align-items:center;color:#a6ffd6;font-weight:900;letter-spacing:.1em}
.coop-card header button{background:transparent;color:#d6eae0;font-size:30px;line-height:1;border:0}
.coop-card h2{font-size:24px;line-height:1.3;margin:14px 0}
.coop-card p,.coop-card small{color:#aec1b7}
.coop-card label{display:block;margin-top:16px;font-size:13px;color:#d2e4d8}
.coop-card input{display:block;width:100%;margin-top:7px;padding:12px;background:#07110f;color:white;border:1px solid #56887b;border-radius:7px;font-size:16px;box-sizing:border-box}
.coop-card button:not(header button){background:#a9e6c3;color:#10231a;border:0;padding:12px 14px;border-radius:7px;font-weight:800;margin-top:11px;cursor:pointer;max-width:100%}
.coop-card button:disabled{opacity:.43;cursor:not-allowed}
.coop-card #coop-join{background:#24554d;color:#e8fff2}
.coop-card #coop-share{text-align:center}
.coop-card #coop-roomcode{display:block;font:800 27px monospace;color:#afffd2;margin-top:12px;letter-spacing:.04em}
.coop-card #coop-members{list-style:none;margin:20px 0;padding:0;text-align:left}
.coop-card #coop-members li{padding:10px 12px;margin:7px 0;background:#1e322e;border:1px solid #385a50;border-radius:6px}
.coop-actions{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}
.coop-actions button:last-child{background:#f1b765!important}
#coop-message{min-height:24px}
.coop-topline{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:160;background:#0d201fe8;color:#bdffde;border:1px solid #4c9a81;padding:7px 15px;border-radius:7px;font:700 12px/1.1 monospace;pointer-events:none}
.coop-revive{position:fixed;z-index:170;right:17px;bottom:165px;background:#83e9bd;border:1px solid #a8ffe0;color:#10301c;font-weight:900;font-size:14px;border-radius:12px;padding:13px;touch-action:none}
@media(max-width:600px){.coop-panel{padding:9px}.coop-card{padding:17px}.coop-card h2{font-size:20px}.coop-topline{font-size:10px;top:4px;white-space:nowrap}}
`;
fs.writeFileSync(src,js);
fs.appendFileSync(path.join(dist,'style.css'),'\n'+css+'\n');
cp.execFileSync(process.execPath,['--check',src]);
console.log('COOP_CLIENT_READY',JSON.stringify({syncEnemy:true,syncTeammate:true,hostLobby:true,inviteURL:true,
 authoritativeDamage:true,serverWaves:true,revive:true,mobile:true,bytes:Buffer.byteLength(multiplayer)}));
