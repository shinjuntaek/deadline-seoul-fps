import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import server from '../api/multiplayer.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function connect(url){
 const ws=new WebSocket(url,{origin:'http://127.0.0.1:'+new URL(url).port});
 const messages=[];
 ws.on('message',buf=>{try{messages.push(JSON.parse(buf.toString()));if(messages.length>80)messages.shift()}catch{}});
 return new Promise((resolve,reject)=>{
  ws.on('open',()=>resolve({ws,messages}));
  ws.on('error',reject);
 });
}
async function seen(c,test,ms=6000){
 const deadline=Date.now()+ms;
 while(Date.now()<deadline){
  const value=c.messages.find(test);
  if(value)return value;
  await wait(25);
 }
 throw Error('Timed out waiting for '+test.toString()+'; seen '+JSON.stringify(c.messages.slice(-5)));
}
const send=(c,msg)=>c.ws.send(JSON.stringify(msg));
test('Actual four simultaneous websocket clients share lobby, start and server wave snapshots', {timeout:22000},async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,url='ws://127.0.0.1:'+port+'/api/multiplayer';
 const clients=[];
 try{
  for(let i=0;i<4;i++)clients.push(await connect(url));
  send(clients[0],{t:'create',name:'QA 팀장'});
  const host=await seen(clients[0],m=>m.t==='joined');
  assert.match(host.code,/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  const code=host.code;
  for(let i=1;i<4;i++){
   send(clients[i],{t:'join',code,name:'요원'+i});
   const m=await seen(clients[i],m=>m.t==='joined');
   assert.equal(m.code,code);
  }
  await seen(clients[0],m=>m.t==='lobby'&&m.players.length===4);
  const fifth=await connect(url);clients.push(fifth);
  send(fifth,{t:'join',name:'5th',code});
  assert.equal((await seen(fifth,m=>m.t==='error')).code,'ROOM_FULL');
  for(let i=0;i<4;i++)send(clients[i],{t:'ready',value:true});
  await seen(clients[0],m=>m.t==='lobby'&&m.players.length===4&&m.players.every(p=>p.ready));
  send(clients[0],{t:'start'});
  for(let i=0;i<4;i++){
   await seen(clients[i],m=>m.t==='start'&&m.wave===1);
   const state=await seen(clients[i],m=>m.t==='state'&&m.phase==='playing');
   assert.equal(state.code,code);
   assert.equal(state.players.length,4);
   assert.equal(state.wave,1);
   assert.equal(state.queued+state.enemies.length,14);
  }
  await wait(100);
  const first=clients[0].messages.find(m=>m.t==='joined').playerId;
  const state=await seen(clients[0],m=>m.t==='state'&&m.players.length===4);
  const me=state.players.find(p=>p.id===first);assert(me);
  send(clients[0],{t:'input',x:me.x+.16,z:me.z,yaw:Math.PI,pitch:0,seq:10});
  send(clients[0],{t:'fire'});
  const shot=await seen(clients[1],m=>m.t==='shot'&&m.by===first);
  assert.equal(shot.by,first);
  assert.equal(shot.ammo,29);
  send(clients[0],{t:'ping',sent:123});
  const pong=await seen(clients[0],m=>m.t==='pong'&&m.sent===123);
  assert(Number.isFinite(pong.now));
  await seen(clients[1],m=>m.t==='state'&&m.players.find(p=>p.id===first)?.ammo.rifle===29);
 }finally{
  for(const c of clients)try{c.ws.close()}catch{}
  await wait(100);
  await new Promise(resolve=>server.close(resolve));
 }
});
