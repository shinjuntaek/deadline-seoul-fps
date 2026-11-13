import test from 'node:test';
import assert from 'node:assert/strict';
import {CoopRoom,WAVE_CONFIG,ENEMY_PROFILE,WEAPON_CONFIG,validRoomCode,generateRoomCode} from './coop-engine.mjs';
const code='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.slice(0,6);
function setup(n=2){
 let time=1000000;const room=new CoopRoom('ABCD23',{now:()=>time,rng:()=>.4});
 const messages=new Map(),members=[];
 for(let i=0;i<n;i++){
  const id='socket-'+i;messages.set(id,[]);
  const a=room.add(id,'요원 '+i,m=>{const list=messages.get(id);if(list.length>24)list.shift();list.push(m)});
  assert(a.ok);members.push({...a,clientId:id});
 }
 const go=()=>{
  for(const p of members)assert.equal(room.ready(p.playerId,true),true);
  assert.equal(room.start(members[0].playerId).ok,true);
 };
 return{room,members,messages,go,step(s=.05){time+=s*1000;room.tick(s)},advance(ms){time+=ms}};
}
test('Six-letter invite codes exclude ambiguous characters',()=>{
 assert(validRoomCode('ABCD23'));
 assert(!validRoomCode('IIIIII'));
 assert(!validRoomCode('ABC123'));
 assert.equal(generateRoomCode(()=>0),'AAAAAA');
});
test('Lobby: create, invite, host, ready, capacity 4, and promote disconnected host',()=>{
 const {room,members}=setup(4);
 assert.equal(room.playerCount,4);
 assert.equal(room.add('overflow','Nope',()=>{}).error,'ROOM_FULL');
 assert.equal(room.start(members[0].playerId).error,'PLAYERS_NOT_READY');
 assert.equal(room.ready(members[0].playerId,true),true);
 assert.equal(room.start(members[0].playerId).error,'PLAYERS_NOT_READY');
 room.remove(members[0].clientId);
 assert.equal(room.hostId,members[1].playerId);
 assert.equal(room.playerCount,3);
 assert.equal(room.ready(members[1].playerId,true),true);
 assert.equal(room.ready(members[2].playerId,true),true);
 assert.equal(room.ready(members[3].playerId,true),true);
 assert.equal(room.start(members[1].playerId).ok,true);
 assert.equal(room.add('late','Late',()=>{}).error,'MATCH_IN_PROGRESS');
});
test('Movement validates target position, yaw and pitch; huge teleports are bounded',()=>{
 const {room,members,go,advance}=setup();go();
 const p=room.players.get(members[0].playerId);
 const before=p.x;advance(60);
 assert(room.input(p.id,{x:before+80,z:29,yaw:Math.PI*3,pitch:99,seq:1}));
 assert(Math.abs(p.x-before)<1.1);
 assert.equal(p.pitch,1.38);
 assert.equal(p.sequence,1);
});
test('Server-owned ammo, fire rate, hit detection, reload and anti-spoof',()=>{
 const {room,members,go,advance,step}=setup();go();
 const p=room.players.get(members[0].playerId);
 p.x=0;p.z=0;p.yaw=Math.PI;p.pitch=-.055;
 const enemy=room.spawnEnemy('walker');enemy.x=0;enemy.z=5;
 const startHp=enemy.hp,ammo=p.ammo.rifle;
 const a=room.fire(p.id,{weapon:'shotgun',damage:999999,enemyId:enemy.id});
 assert(a.ok);assert.equal(p.ammo.rifle,ammo-1);
 assert(enemy.hp<startHp);
 assert.equal(room.fire(p.id,{}).error,'COOLDOWN');
 assert.equal(room.selectWeapon(p.id,'shotgun'),true);
 assert.equal(room.reload(p.id),false); // full magazine
 p.ammo.shotgun=5;assert.equal(room.reload(p.id),true);
 const reserve=p.reserve.shotgun;advance(2500);step(.05);
 assert.equal(p.ammo.shotgun,8);
 assert.equal(p.reserve.shotgun,reserve-3);
 assert.equal(room.dispatch('bad-user',{t:'fire'}).ok,false);
});
test('Damage and three-second co-op revive are resolved by server',()=>{
 const {room,members,go,step}=setup();go();
 const a=room.players.get(members[0].playerId),b=room.players.get(members[1].playerId);
 a.x=b.x;b.z=a.z;
 room.damage(b,300);
 assert.equal(b.downed,true);assert.equal(b.health,0);
 assert(room.revive(a.id,b.id,true));
 for(let i=0;i<65;i++)step(.05);
 assert.equal(b.downed,false);assert.equal(b.health,35);
 assert.equal(b.revive,0);
});
test('Server zombies can cross both central checkpoint gaps',()=>{
 const {room,members,go,step}=setup();go();
 const p=room.players.get(members[0].playerId);
 const p2=room.players.get(members[1].playerId);
 p.x=0;p.z=27;p2.x=1;p2.z=27;
 const zombie=room.spawnEnemy('walker');zombie.x=0;zombie.z=37;zombie.lungeCooldown=60;
 for(let k=0;k<42;k++)step(.05);
 assert(zombie.z<34,'Zombie must pass previous z=34 wall instead of freezing behind it: '+zombie.z);
 assert(zombie.z>28,'Zombie should be limited by movement speed');
});
test('Full five-wave room director spawns 194 enemies and unlocks shared extraction',()=>{
 const {room,go,step,members}=setup();go();
 assert.equal(WAVE_CONFIG.reduce((sum,w)=>sum+w.walker+w.runner+w.brute,0),194);
 assert.equal(room.waveIndex,0);
 let loops=0,alivePeak=0;
 while(room.phase==='playing'&&loops++<8500){
  step(.05);
  alivePeak=Math.max(alivePeak,room.enemies.size);
  room.enemies.clear(); // test simulates server kills for each spawned enemy, not human play
 }
 assert(loops<8500,'timeout waiting for all waves');
 assert.equal(room.phase,'extraction');
 assert.equal(room.enemyId,194);
 assert(alivePeak<=14);
 assert.equal(room.waveIndex,5);
 const p=room.players.get(members[0].playerId);p.x=0;p.z=-45;
 for(let i=0;i<145;i++)step(.05);
 assert.equal(room.phase,'victory');
});
test('No standing teammates results in shared defeat',()=>{
 const {room,members,go,step}=setup();go();
 room.damage(room.players.get(members[0].playerId),500);
 room.damage(room.players.get(members[1].playerId),500);
 step();
 assert.equal(room.phase,'defeat');
});
test('Snapshot, disconnection and resume token use bounded public fields',()=>{
 const {room,members,go}=setup();go();
 const p=room.players.get(members[0].playerId);
 const token=p.token;
 room.remove(members[0].clientId);
 const re=room.add('resume','Name',()=>{},token);
 assert(re.ok);assert(re.resumed);
 assert.equal(re.playerId,p.id);
 const snap=room.snapshot();
 assert.equal(snap.code,'ABCD23');
 assert(!JSON.stringify(snap).includes(token));
});

test('Fast runner and chase lunge stay bounded and visible to cooperative peers',()=>{
 const {room,members,go,step}=setup();go();
 assert.equal(ENEMY_PROFILE.walker.speed,2.25);
 assert.equal(ENEMY_PROFILE.runner.speed,4.9);
 assert.equal(ENEMY_PROFILE.brute.speed,1.55);
 const p=room.players.get(members[0].playerId);
 const e=room.spawnEnemy('runner');e.x=p.x;e.z=p.z-9;
 e.lungeCooldown=0;
 const before=e.z;
 step(.05);
 assert.equal(e.lunge>0,true,'runner should perform close-range lunge');
 assert(e.z-before>.32,'chase surge should noticeably move runner toward player');
 assert(e.z-before<.42,'server speed cannot teleport through geometry');
 assert.equal(room.snapshot().enemies.find(x=>x.id===e.id).rush,true);
 assert.equal(WAVE_CONFIG.reduce((a,w)=>a+w.walker+w.runner+w.brute,0),194);
});
