/**
 * DEADLINE: SEOUL — authoritative cooperative room simulation.
 * Platform-independent ESM: used by Vercel WebSocket adapter and locally by node:test.
 * All movement, damage, shots, ammo, zombie behavior, waves, revive and victory
 * are resolved here. Clients may predict their own view but cannot decide hits.
 */
export const WAVE_CONFIG=Object.freeze([
 {walker:14,runner:0,brute:0,interval:.62},
 {walker:17,runner:7,brute:0,interval:.54},
 {walker:23,runner:13,brute:0,interval:.46},
 {walker:31,runner:18,brute:1,interval:.40},
 {walker:40,runner:28,brute:2,interval:.34},
]);
export const ENEMY_PROFILE=Object.freeze({
 walker:{hp:108,speed:2.25,damage:9,range:1.35,cool:.88,score:100,radius:.36},
 runner:{hp:74,speed:4.9,damage:7,range:1.28,cool:.62,score:135,radius:.30},
 brute:{hp:840,speed:1.55,damage:23,range:1.9,cool:1.15,score:900,radius:.72},
});
export const WEAPON_CONFIG=Object.freeze({
 rifle:{ammo:30,reserve:180,damage:32,rpm:720,range:95,reload:1550,pellets:1},
 shotgun:{ammo:8,reserve:40,damage:16,rpm:85,range:28,reload:2300,pellets:9},
});
import {SPAWN_POINTS,obstacleAABBs,obstructed,clearSegment,findPath} from './navigation.mjs';
export {SPAWN_POINTS,obstructed} from './navigation.mjs';
const MAX_PLAYERS=4,MIN_PLAYERS=2;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const norm=(a,b)=>Math.hypot(a,b)||1;
const finite=(v,def=0)=>typeof v==='number'&&Number.isFinite(v)?v:def;
const seqId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);
const cleanName=s=>String(s||'생존자').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,16)||'생존자';
const deviate=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function raySphere(origin,dx,dy,dz,ex,ey,ez,r,maxDistance){
 const ox=ex-origin.x,oy=ey-origin.y,oz=ez-origin.z,t=ox*dx+oy*dy+oz*dz;
 if(t<.1||t>maxDistance)return Infinity;
 const perp=(ox*ox+oy*oy+oz*oz)-t*t;
 return perp<=r*r?t:Infinity;
}
export function validRoomCode(code){return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(String(code||'').toUpperCase())}
export function generateRoomCode(rng=Math.random){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 let code='';for(let i=0;i<6;i++)code+=alphabet[Math.floor(clamp(rng(),0,.999999)*alphabet.length)];
 return code;
}
export class CoopRoom {
 constructor(code,{rng=Math.random,now=()=>Date.now(),maxPlayers=MAX_PLAYERS}={}){
  if(!validRoomCode(code))throw Error('INVALID_CODE');
  this.code=code;this.rng=rng;this.now=now;this.maxPlayers=Math.min(MAX_PLAYERS,Math.max(2,maxPlayers));
  this.players=new Map();this.connections=new Map();this.hostId=null;
  this.phase='lobby';this.waveIndex=-1;this.waveQueue=[];this.enemies=new Map();this.enemyId=0;
  this.cooldown=0;this.intermission=-1;this.extractionTimer=0;this.extractionHold=0;
  this.totalKills=0;this.score=0;this.tickCounter=0;this.events=[];
  this.lastSnapshot=0;this.maxActiveEnemies=0;this.lastActivity=this.now();
 }
 get connectedCount(){return[...this.players.values()].filter(p=>p.connected).length}
 get playerCount(){return this.players.size}
 get host(){return this.hostId}
 add(clientId,name,send,resumeToken){
  if(typeof send!=='function')return{ok:false,error:'INVALID_CLIENT'};
  const previous=resumeToken&&[...this.players.values()].find(p=>p.token===resumeToken);
  if(previous){
   this.connections.delete(previous.clientId);
   previous.connected=true;previous.clientId=clientId;previous.leftAt=0;
   if(!this.hostId)this.hostId=previous.id;
   this.connections.set(clientId,{id:previous.id,send});
   this.lastActivity=this.now();this.broadcastLobby();
   return{ok:true,playerId:previous.id,token:previous.token,resumed:true};
  }
  if(resumeToken)return{ok:false,error:'SESSION_EXPIRED'};
  if(this.phase!=='lobby')return{ok:false,error:'MATCH_IN_PROGRESS'};
  for(const [id,p] of this.players)if(!p.connected&&this.now()-p.leftAt>30000)this.players.delete(id);
  if(this.playerCount>=this.maxPlayers)return{ok:false,error:'ROOM_FULL'};
  const id=seqId(),token=seqId(),i=this.playerCount;
  const p={id,token,clientId,name:cleanName(name),connected:true,ready:false,
   x:(i%2?1:-1)*(1.5+i*.7),z:27+(i>=2?3:0),yaw:0,pitch:0,
   health:100,armor:50,stamina:100,downed:false,bleed:0,dead:false,revive:0,reviveTarget:null,
   weapon:'rifle',ammo:{rifle:30,shotgun:8},reserve:{rifle:180,shotgun:40},
   reloading:null,reloadDone:0,lastShot:0,lastInput:this.now(),lastMoveAt:this.now(),
   shots:0,hits:0,kills:0,score:0,ping:0,sequence:0,leftAt:0};
  this.players.set(id,p);this.connections.set(clientId,{id,send});
  if(!this.hostId)this.hostId=id;
  this.lastActivity=this.now();this.broadcastLobby();
  return{ok:true,playerId:id,token,resumed:false};
 }
 remove(clientId,intentional=false){
  const link=this.connections.get(clientId);if(!link)return;
  this.connections.delete(clientId);
  const p=this.players.get(link.id);if(!p)return;
  p.connected=false;p.leftAt=this.now();p.reviveTarget=null;
  if(this.phase==='lobby'&&intentional)this.players.delete(p.id);
  if(this.hostId===p.id)this.hostId=[...this.players.values()].find(x=>x.connected)?.id||null;
  this.lastActivity=this.now();this.broadcastLobby();
 }
 safeSend(id,msg){
  for(const connection of this.connections.values())if(connection.id===id)try{connection.send(msg)}catch{}
 }
 broadcast(msg){
  for(const connection of this.connections.values())try{connection.send(msg)}catch{}
 }
 broadcastLobby(){
  this.broadcast({t:'lobby',code:this.code,phase:this.phase,hostId:this.hostId,maxPlayers:this.maxPlayers,
   players:[...this.players.values()].map(p=>({id:p.id,name:p.name,ready:p.ready,connected:p.connected})),
   minPlayers:MIN_PLAYERS});
 }
 ready(id,value){
  const p=this.players.get(id);
  if(!p||this.phase!=='lobby'||!p.connected)return false;
  p.ready=!!value;this.broadcastLobby();return true;
 }
 start(id){
  if(this.phase!=='lobby'||id!==this.hostId)return{ok:false,error:'NOT_HOST'};
  const present=[...this.players.values()].filter(p=>p.connected);
  if(present.length<MIN_PLAYERS)return{ok:false,error:'NEED_TWO_PLAYERS'};
  if(present.some(p=>!p.ready))return{ok:false,error:'PLAYERS_NOT_READY'};
  this.phase='playing';this.waveIndex=-1;this.totalKills=0;this.score=0;this.enemies.clear();
  for(const p of present){
   p.health=100;p.armor=50;p.stamina=100;p.downed=false;p.dead=false;p.bleed=0;
   p.revive=0;p.reviveTarget=null;p.weapon='rifle';p.ammo={rifle:30,shotgun:8};
   p.reserve={rifle:180,shotgun:40};p.reloading=null;p.shots=0;p.hits=0;p.kills=0;p.score=0;
  }
  this.nextWave();this.broadcast({t:'start',code:this.code,at:this.now(),wave:1});
  return{ok:true};
 }
 nextWave(){
  this.waveIndex++;
  if(this.waveIndex>=WAVE_CONFIG.length){this.startExtraction();return}
  const config=WAVE_CONFIG[this.waveIndex];
  this.waveQueue=[];
  for(const kind of ['walker','runner']){
   for(let i=0;i<config[kind];i++)this.waveQueue.push(kind);
  }
  for(let i=this.waveQueue.length-1;i>0;i--){
   const j=Math.floor(this.rng()*(i+1));
   [this.waveQueue[i],this.waveQueue[j]]=[this.waveQueue[j],this.waveQueue[i]];
  }
  for(let i=0;i<config.brute;i++)this.waveQueue.push('brute');
  this.cooldown=this.waveIndex===0?1.3:1;
  this.intermission=-1;this.events.push({t:'wave',wave:this.waveIndex+1});
  this.broadcast({t:'wave',wave:this.waveIndex+1,total:this.waveQueue.length});
 }
 startExtraction(){
  this.phase='extraction';this.extractionTimer=75;this.extractionHold=0;
  this.broadcast({t:'extract',time:75,x:0,z:-45,hold:7});
 }
 spawnEnemy(kind){
  const p=ENEMY_PROFILE[kind];
  const active=[...this.players.values()].filter(x=>x.connected&&!x.downed&&!x.dead);
  const pool=SPAWN_POINTS.filter(([x,z])=>active.every(pl=>Math.hypot(pl.x-x,pl.z-z)>18));
  const source=(pool.length?pool:SPAWN_POINTS)[Math.floor(this.rng()*(pool.length?pool:SPAWN_POINTS).length)];
  let x=source[0]+(this.rng()-.5)*3,z=source[1]+(this.rng()-.5)*3;
  x=clamp(x,-24.5,24.5);z=clamp(z,-49,49);
  if(obstructed(x,z,p.radius)){x=source[0];z=source[1]}
  if(obstructed(x,z,p.radius))throw new Error('Invalid spawn configuration');
  const e={id:++this.enemyId,kind,x,z,yaw:0,hp:p.hp,max:p.hp,attack:.4+this.rng()*.25,dead:false,lunge:0,lungeCooldown:2.0+(this.enemyId%6)*.65};
  this.enemies.set(e.id,e);return e;
 }
 input(id,packet){
  const p=this.players.get(id);
  if(!p||!p.connected||(this.phase!=='playing'&&this.phase!=='extraction'))return false;
  const now=this.now();
  if(now-p.lastInput<28)return false;
  const dt=clamp((now-p.lastMoveAt)/1000,.016,.18);
  p.lastInput=now;p.lastMoveAt=now;
  p.yaw=clamp(finite(packet.yaw,p.yaw),-20*Math.PI,20*Math.PI);
  p.pitch=clamp(finite(packet.pitch,p.pitch),-1.38,1.38);
  p.sequence=Math.max(p.sequence,Math.floor(finite(packet.seq,0)));
  if(p.dead||p.downed)return true;
  const x=clamp(finite(packet.x,p.x),-50,50),z=clamp(finite(packet.z,p.z),-50,50);
  const d=Math.hypot(x-p.x,z-p.z);
  const max=(packet.sprint?7.15:4.55)*dt+.20;
  if(d<=max&&!obstructed(x,z)){p.x=x;p.z=z}
  else if(d>max){
   const nx=p.x+(x-p.x)*max/(d||1),nz=p.z+(z-p.z)*max/(d||1);
   if(!obstructed(nx,nz)){p.x=nx;p.z=nz}
  }
  return true;
 }
 fire(id,packet={}){
  const p=this.players.get(id),now=this.now();
  if(!p||p.dead||p.downed||!p.connected||(this.phase!=='playing'&&this.phase!=='extraction'))return{ok:false,error:'NOT_ACTIVE'};
  const cfg=WEAPON_CONFIG[p.weapon];
  if(p.reloading)return{ok:false,error:'RELOADING'};
  if(now-p.lastShot<60000/cfg.rpm)return{ok:false,error:'COOLDOWN'};
  if(p.ammo[p.weapon]<=0)return{ok:false,error:'EMPTY'};
  p.lastShot=now;p.ammo[p.weapon]--;p.shots++;
  const yaw=p.yaw,pitch=p.pitch;
  const dx=-Math.sin(yaw)*Math.cos(pitch),dy=-Math.sin(pitch),dz=-Math.cos(yaw)*Math.cos(pitch);
  const hits=[],pellets=cfg.pellets;
  for(let i=0;i<pellets;i++){
   const jitter=pellets===1?0:(this.rng()-.5)*.13;
   const a=yaw+jitter,b=pitch+(pellets===1?0:(this.rng()-.5)*.11);
   const dirX=pellets===1?dx:-Math.sin(a)*Math.cos(b),dirY=pellets===1?dy:-Math.sin(b),dirZ=pellets===1?dz:-Math.cos(a)*Math.cos(b);
   let best=null,bestD=Infinity,headshot=false;
   for(const e of this.enemies.values()){
    if(e.dead)continue;
    const pp=ENEMY_PROFILE[e.kind],radius=pp.radius;
    const origin={x:p.x,y:1.72,z:p.z};
    const hd=e.kind==='brute'?3.59:1.99,scale=e.kind==='brute'?1.58:e.kind==='runner'?.92:1;
    const head=raySphere(origin,dirX,dirY,dirZ,e.x,hd,e.z,radius*.69,cfg.range);
    const body=raySphere(origin,dirX,dirY,dirZ,e.x,1.18*scale,e.z,radius*1.37,cfg.range);
    const dist=Math.min(head,body);
    if(dist<bestD){best=e;bestD=dist;headshot=head<=body}
   }
   if(best&&bestD<Infinity){
    let blockedShot=false;
    for(const b of obstacleAABBs){
     const cx=b.x-p.x,cz=b.z-p.z,projection=cx*dirX+cz*dirZ;
     if(projection<=0||projection>=bestD)continue;
     const px=p.x+dirX*projection,pz=p.z+dirZ*projection;
     if(Math.abs(px-b.x)<b.w/2&&Math.abs(pz-b.z)<b.d/2){blockedShot=true;break}
    }
    if(blockedShot)continue;
    const damage=cfg.damage*(headshot?2.75:1);
    best.hp=Math.max(0,best.hp-damage);hits.push({id:best.id,hp:best.hp,head:headshot});
    if(best.hp===0&&!best.dead){
     best.dead=true;this.enemies.delete(best.id);this.totalKills++;this.score+=ENEMY_PROFILE[best.kind].score+(headshot?55:0);
     p.kills++;p.score+=ENEMY_PROFILE[best.kind].score+(headshot?55:0);
    }
   }
  }
  if(hits.length)p.hits++;
  const report={t:'shot',by:id,weapon:p.weapon,hits,ammo:p.ammo[p.weapon],at:now};
  this.broadcast(report);return{ok:true,hits};
 }
 reload(id){
  const p=this.players.get(id);
  if(!p||p.dead||p.downed||(this.phase!=='playing'&&this.phase!=='extraction'))return false;
  const w=p.weapon,cfg=WEAPON_CONFIG[w];
  if(p.reloading||p.ammo[w]>=cfg.ammo||p.reserve[w]<=0)return false;
  p.reloading=w;p.reloadDone=this.now()+cfg.reload;return true;
 }
 selectWeapon(id,weapon){
  const p=this.players.get(id);
  if(!p||!WEAPON_CONFIG[weapon]||p.reloading)return false;
  p.weapon=weapon;return true;
 }
 revive(id,targetId,holding){
  const p=this.players.get(id),target=this.players.get(targetId);
  if(!p||!target||p.id===target.id||p.downed||p.dead||!target.downed||target.dead||!holding){
   if(p)p.reviveTarget=null;return false;
  }
  if(deviate(p,target)>2.45){p.reviveTarget=null;return false}
  p.reviveTarget=targetId;return true;
 }
 damage(p,amount){
  if(p.downed||p.dead)return;
  const absorb=Math.min(p.armor,amount*.65);
  p.armor=Math.max(0,p.armor-absorb);p.health=Math.max(0,p.health-(amount-absorb));
  if(p.health===0){p.downed=true;p.bleed=25;p.revive=0;this.broadcast({t:'down',id:p.id})}
 }
 tick(dt){
  if(this.phase!=='playing'&&this.phase!=='extraction')return;
  dt=clamp(dt,0,.1);this.tickCounter++;
  const now=this.now();
  for(const p of this.players.values()){
   if(!p.connected&&p.leftAt&&now-p.leftAt>30000){p.dead=true;p.downed=false}
   if(p.reloading&&now>=p.reloadDone){
    const w=p.reloading,cfg=WEAPON_CONFIG[w];
    const needed=cfg.ammo-p.ammo[w],n=Math.min(needed,p.reserve[w]);
    p.ammo[w]+=n;p.reserve[w]-=n;p.reloading=null;
   }
   if(p.downed&&!p.dead){p.bleed-=dt;if(p.bleed<=0){p.dead=true;this.broadcast({t:'bleedout',id:p.id})}}
   if(p.reviveTarget){
    const target=this.players.get(p.reviveTarget);
    if(target&&target.downed&&!target.dead&&deviate(p,target)<2.45){
     target.revive+=dt;
     if(target.revive>=3){target.downed=false;target.health=35;target.armor=0;target.bleed=0;target.revive=0;
      this.broadcast({t:'revived',by:p.id,id:target.id});p.reviveTarget=null}
    }else p.reviveTarget=null;
   }
  }
  const fighters=[...this.players.values()].filter(p=>p.connected&&!p.downed&&!p.dead);
  if(fighters.length===0){
   const resumable=[...this.players.values()].some(p=>!p.connected&&!p.dead&&!p.downed&&now-p.leftAt<=30000);
   if(!resumable)this.finish('defeat','모든 요원 전투 불능');
   return;
  }
  if(this.phase==='playing'){
   const cap=Math.min(22,6+fighters.length*4);
   if(this.waveQueue.length&&this.enemies.size<cap){
    this.cooldown-=dt;
    if(this.cooldown<=0){this.spawnEnemy(this.waveQueue.shift());this.cooldown=WAVE_CONFIG[this.waveIndex].interval}
   }
  }
  for(const e of this.enemies.values()){
   if(e.dead)continue;
   const cfg=ENEMY_PROFILE[e.kind];
   let target=null,d=Infinity;
   for(const fighter of fighters){
    const distance=deviate(e,fighter);
    if(distance<d){d=distance;target=fighter}
   }
   if(!target)continue;
   let aim=target;
   if(!clearSegment(e,target,cfg.radius)){
    if(!e.path||!e.path.length||now-(e.pathAt||0)>1500){e.path=findPath(e,target,cfg.radius);e.pathAt=now}
    while(e.path.length&&Math.hypot(e.x-e.path[0].x,e.z-e.path[0].z)<.08)e.path.shift();
    if(e.path.length)aim=e.path[0];
   }else e.path=null;
   const ad=Math.hypot(aim.x-e.x,aim.z-e.z)||1;
   const vx=(aim.x-e.x)/ad,vz=(aim.z-e.z)/ad;
   e.yaw=Math.atan2(vx,vz)+Math.PI;
   e.lunge=Math.max(0,e.lunge-dt);
   e.lungeCooldown=Math.max(0,e.lungeCooldown-dt);
   if(e.lungeCooldown===0&&d>cfg.range+1.1&&d<12){
    e.lunge=.58;e.lungeCooldown=(e.kind==='runner'?7.2:8.8)+(e.id%4)*.6;
   }
   const surge=e.kind==='runner'?.27:e.kind==='brute'?.12:.20;
   const sprintLunge=e.lunge>0?(e.kind==='runner'?1.33:e.kind==='brute'?1.38:1.25):1;
   const sp=Math.min(cfg.speed*1.7,cfg.speed*(1+surge*clamp(1-d/20,0,1))*sprintLunge);
   if(d>cfg.range){const step=Math.min(sp*dt,ad),nx=e.x+vx*step,nz=e.z+vz*step;
    if(!obstructed(nx,nz,cfg.radius)){e.x=nx;e.z=nz}else{
     const sx=-vz,sz=vx;
     if(!obstructed(e.x+sx*sp*dt,e.z+sz*sp*dt,cfg.radius)){e.x+=sx*sp*dt;e.z+=sz*sp*dt}
    }
   }
   e.attack-=dt;
   if(d<=cfg.range&&e.attack<=0){this.damage(target,cfg.damage);e.attack=cfg.cool}
  }
  if(this.phase==='playing'&&this.waveQueue.length===0&&this.enemies.size===0){
   if(this.intermission<0){this.intermission=6;this.broadcast({t:'intermission',seconds:6,wave:this.waveIndex+1})}
   else{this.intermission-=dt;if(this.intermission<=0)this.nextWave()}
  }
  if(this.phase==='extraction'){
   this.extractionTimer-=dt;
   const inside=fighters.filter(p=>Math.hypot(p.x,p.z+45)<3.4);
   this.extractionHold=inside.length?this.extractionHold+dt:Math.max(0,this.extractionHold-1.6*dt);
   if(this.extractionHold>=7){this.finish('victory','구조 헬기 확보');return}
   if(this.extractionTimer<=0){this.finish('defeat','구조 신호 소멸');return}
  }
  if(this.tickCounter%2===0)this.broadcast(this.snapshot());
 }
 finish(phase,reason){
  this.phase=phase;this.broadcast({t:'end',phase,reason,score:this.score,kills:this.totalKills,wave:this.waveIndex+1});
 }
 snapshot(){
  return{t:'state',at:this.now(),code:this.code,phase:this.phase,wave:this.waveIndex+1,
   queued:this.waveQueue.length,kills:this.totalKills,score:this.score,intermission:Math.max(0,this.intermission),
   extraction:{visible:this.phase==='extraction',remaining:this.extractionTimer,hold:this.extractionHold,x:0,z:-45},
   players:[...this.players.values()].map(p=>({
    id:p.id,name:p.name,x:+p.x.toFixed(2),z:+p.z.toFixed(2),yaw:+p.yaw.toFixed(3),pitch:+p.pitch.toFixed(3),
    health:+p.health.toFixed(1),armor:+p.armor.toFixed(1),stamina:p.stamina,
    downed:p.downed,dead:p.dead,revive:+p.revive.toFixed(2),connected:p.connected,
    weapon:p.weapon,ammo:p.ammo, reserve:p.reserve,reloading:!!p.reloading,kills:p.kills,score:p.score,seq:p.sequence,
   })),
   enemies:[...this.enemies.values()].map(e=>({id:e.id,kind:e.kind,x:+e.x.toFixed(2),z:+e.z.toFixed(2),
    yaw:+e.yaw.toFixed(3),hp:+e.hp.toFixed(1),max:e.max,rush:e.lunge>0})),
  };
 }
 dispatch(id,msg){
  if(!msg||typeof msg!=='object'||typeof msg.t!=='string')return{ok:false,error:'BAD_MESSAGE'};
  switch(msg.t){
   case'ready':return{ok:this.ready(id,msg.value)};
   case'start':return this.start(id);
   case'input':return{ok:this.input(id,msg)};
   case'fire':return this.fire(id,msg);
   case'reload':return{ok:this.reload(id)};
   case'weapon':return{ok:this.selectWeapon(id,msg.weapon)};
   case'revive':return{ok:this.revive(id,msg.targetId,!!msg.hold)};
   case'ping':return{ok:true,t:'pong',sent:finite(msg.sent,0),now:this.now()};
   case'leave':return{ok:true,t:'leave'};
   default:return{ok:false,error:'UNKNOWN_MESSAGE'};
  }
 }
}
