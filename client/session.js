// Injected into the recovered game closure by stability-upgrade.cjs.
Object.assign(coop,{retryTimer:null,heartbeat:null,retryAt:0,retries:0,lastSeen:0,
 clockOffset:null,resumePending:false,samples:[],disconnects:0,lastClose:null});
function coopSaveSession(){
 try{sessionStorage.setItem('deadline-coop-session',JSON.stringify({code:coop.code,token:coop.token,at:Date.now()}))}catch{}
}
function coopResetLobby(){
 if(!coop.lobby)return;
 coop.lobby.querySelector('#coop-joinform').classList.remove('hidden');
 coop.lobby.querySelector('#coop-share').classList.add('hidden');
 coop.lobby.querySelector('#coop-members').replaceChildren();
 for(const id of ['#coop-ready','#coop-start'])coop.lobby.querySelector(id).disabled=true;
 coopText('#coop-roomcode','');
}
function coopScheduleReconnect(){
 if(!coop.token||!coop.code)return;
 if(!coop.retryAt)coop.retryAt=Date.now();
 if(Date.now()-coop.retryAt>28000){
  coopMsg('연결 복구 시간이 지났습니다. 방 나가기 후 새 방을 만들어 주세요.');return;
 }
 clearTimeout(coop.retryTimer);
 const delay=Math.min(3000,500*2**Math.min(3,coop.retries++));
 coopMsg('연결 복구 중 · '+coop.retries+'차 시도');
 coop.retryTimer=setTimeout(()=>coopLaunch('resume'),delay);
}
function coopEnter(state,resumed=false){
 const wasInitialized=coop.resumePending;
 coop.active=true;coop.ended=false;
 if(!resumed||!wasInitialized){startRun();clearRun();spawnQueue.length=0}
 else {phase='playing';dom.pause.classList.add('hidden');}
 coop.resumePending=true;coop.needsReconnect=false;coop.retryAt=0;coop.retries=0;
 clearTimeout(coop.retryTimer);coopClosePanel();
 const top=document.getElementById('coop-topline');if(top)top.classList.remove('hidden');
 if(state){
  const me=state.players.find(p=>p.id===coop.playerId);
  if(me){camera.position.x=me.x;camera.position.z=me.z;yaw=me.yaw;pitch=me.pitch;camera.rotation.set(pitch,yaw,0,'YXZ');}
  coop.lastState=state;coopApplySnapshot(state);
 }
}
// Reload recovery is opt-in to avoid unexpectedly starting a match on page load.
try{
 const saved=JSON.parse(sessionStorage.getItem('deadline-coop-session')||'null');
 if(saved&&Date.now()-saved.at<24*60*60*1000&&/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(saved.code)){
  coop.code=saved.code;coop.token=saved.token;
  const recover=document.createElement('button');recover.id='coop-recover';recover.type='button';
  recover.textContent='이전 작전 재접속';
  recover.addEventListener('click',()=>{coop.retryAt=Date.now();coopLaunch('resume')});
  coop.lobby.querySelector('#coop-joinform').appendChild(recover);
 }
}catch{}
addEventListener('online',()=>{if(coop.needsReconnect)coopLaunch('resume')});
