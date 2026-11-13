import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {CoopRoom,SPAWN_POINTS,obstructed,ENEMY_PROFILE} from './coop-engine.mjs';
import {sampleMotion,appendMotion} from './interpolation.mjs';
import {Euler,Vector3} from 'three';
const setup=()=>{
 let now=100000;const room=new CoopRoom('ABCDEF',{now:()=>now,rng:()=>.5});
 const a=room.add('a','A',()=>{}),b=room.add('b','B',()=>{});
 room.ready(a.playerId,true);room.ready(b.playerId,true);room.start(a.playerId);
 return {room,a,b,tick(n=1){for(let i=0;i<n;i++){now+=50;room.tick(.05)}}};
};
test('All 14 spawn positions and three enemy classes reach the central street',()=>{
 for(const kind of Object.keys(ENEMY_PROFILE))for(const [x,z] of SPAWN_POINTS){
  const {room,tick}=setup();room.waveQueue=[];room.enemies.clear();
  for(const p of room.players.values()){p.x=0;p.z=0;p.health=100000;p.armor=0}
  const e=room.spawnEnemy(kind);e.x=x;e.z=z;
  assert(!obstructed(x,z,ENEMY_PROFILE[kind].radius));
  tick(1400);
  assert(Math.hypot(e.x,e.z)<3,`${kind} ${x},${z} stalled at ${e.x},${e.z}`);
 }
});
test('A full team disconnect has 30 seconds of grace and restores the same state',()=>{
 const {room,a,b,tick}=setup();
 const p=room.players.get(a.playerId);p.ammo.rifle=17;p.health=65;
 room.remove('a');room.remove('b');tick(400);
 assert.equal(room.phase,'playing');
 const resumed=room.add('a2','A',()=>{},a.token);
 assert.equal(resumed.playerId,a.playerId);assert.equal(resumed.resumed,true);
 assert.equal(p.ammo.rifle,17);assert.equal(p.health,65);assert.equal(room.hostId,a.playerId);
 room.remove('a2');tick(620);assert.equal(room.phase,'defeat');
});
test('Lobby disconnect can resume; explicit leave releases the seat',()=>{
 const room=new CoopRoom('ABCDEF');const a=room.add('a','A',()=>{});
 room.remove('a');assert.equal(room.playerCount,1);
 assert.equal(room.add('a2','A',()=>{},a.token).playerId,a.playerId);
 room.remove('a2',true);assert.equal(room.playerCount,0);
 assert.equal(room.add('a3','A',()=>{},a.token).error,'SESSION_EXPIRED');
});
test('Interpolation crosses the short rotation arc and bounds stale extrapolation',()=>{
 const list=[];appendMotion(list,{at:100,x:0,z:0,yaw:Math.PI-.1});
 appendMotion(list,{at:200,x:1,z:0,yaw:-Math.PI+.1});
 const halfway=sampleMotion(list,150);assert.equal(halfway.x,.5);assert(Math.abs(halfway.yaw-Math.PI)<.001);
 assert(sampleMotion(list,5000).x<=1.72+1e-9);
 appendMotion(list,{at:150,x:9,z:9,yaw:0});assert.equal(list.length,2);
 for(let i=3;i<100;i++)appendMotion(list,{at:i*100,x:i,z:0,yaw:0});assert.equal(list.length,8);
});
test('Authoritative headshots agree with the actual Three.js camera pitch for every class',()=>{
 for(const [kind,scale] of [['walker',1],['runner',.92],['brute',1.58]]){
  const {room,a}=setup();room.enemies.clear();room.waveQueue=[];
  const p=room.players.get(a.playerId);p.x=0;p.z=0;p.yaw=0;p.pitch=Math.atan2(2.02*scale-1.72,10);
  const direction=new Vector3(0,0,-1).applyEuler(new Euler(p.pitch,p.yaw,0,'YXZ'));
  assert(direction.y>0,'Upward camera aim must travel upward');
  const e=room.spawnEnemy(kind);e.x=0;e.z=-10;
  const shot=room.fire(a.playerId);assert(shot.ok);assert(shot.hits.some(hit=>hit.id===e.id&&hit.head),kind+' headshot');
 }
});
test('Browser launch sends resume token and ignores events from replaced sockets',()=>{
 const sent=[],received=[];let retries=0;
 class WS{static OPEN=1;readyState=1;constructor(){WS.all.push(this)}close(){}send(v){sent.push(JSON.parse(v))}static all=[];}
 const coop={ws:null,code:'ABCDEF',token:'private-token',lobby:{querySelector:()=>({value:'ABCDEF'})}};
 const ctx=vm.createContext({coop,window:{WebSocket:WS},WebSocket:WS,performance,Date,JSON,setInterval:()=>1,clearInterval,clearTimeout,
 coopMsg(){},coopURL:()=> 'ws://localhost',coopName:()=> 'A',coopSocketSend:m=>coop.ws.send(JSON.stringify(m)),
 coopReceive:m=>received.push(m),coopScheduleReconnect:()=>retries++,coopOpenPanel(){},coopResetLobby(){},fireHeld:false});
 vm.runInContext(fs.readFileSync(new URL('../client/launch.js',import.meta.url),'utf8'),ctx);
 vm.runInContext("coopLaunch('resume')",ctx);const first=WS.all[0];first.onopen();
 assert.equal(sent[0].resumeToken,'private-token');assert.equal(sent[0].t,'join');
 vm.runInContext("coopLaunch('resume')",ctx);first.onmessage({data:'{"t":"end"}'});first.onclose({code:1006});
 assert.equal(received.length,0);assert.equal(retries,0);
 WS.all[1].onclose({code:1006});assert.equal(retries,1);
});
