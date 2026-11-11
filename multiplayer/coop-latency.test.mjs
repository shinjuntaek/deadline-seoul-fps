import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import WebSocket from 'ws';
import server from '../api/multiplayer.js';

const timeout=6000;
function until(ws,predicate){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{cleanup();reject(Error('WebSocket message timeout'))},timeout);
  function onMessage(data){
   let msg;try{msg=JSON.parse(String(data))}catch{return}
   if(predicate(msg)){cleanup();resolve(msg)}
  }
  function onError(error){cleanup();reject(error)}
  function cleanup(){clearTimeout(timer);ws.off('message',onMessage);ws.off('error',onError)}
  ws.on('message',onMessage);ws.on('error',onError);
 });
}
function socket(url,origin){
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(url,{origin});
  ws.once('open',()=>resolve(ws));ws.once('error',reject);
 });
}
function percentile(sorted,frac){return sorted[Math.min(sorted.length-1,Math.max(0,Math.floor((sorted.length-1)*frac)))]}
test('Four real clients: server round-trip time and message delivery on local CI host', {timeout:30000},async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const origin='http://127.0.0.1:'+port;
 const url='ws://127.0.0.1:'+port+'/api/multiplayer';
 const clients=[],samples=[],failed=[];
 try{
  for(let i=0;i<4;i++)clients.push(await socket(url,origin));
  let code=null;
  for(let i=0;i<clients.length;i++){
   const ws=clients[i];
   const done=until(ws,msg=>msg.t==='joined');
   ws.send(JSON.stringify(i===0?{t:'create',name:'Ping '+i}:{t:'join',code,name:'Ping '+i}));
   const reply=await done;
   assert.equal(reply.t,'joined');
   if(i===0)code=reply.code;else assert.equal(reply.code,code);
  }
  for(let round=0;round<12;round++){
   const batch=clients.map(async(ws,i)=>{
    const nonce=round*4+i;
    const waiter=until(ws,msg=>msg.t==='pong'&&msg.sent===nonce);
    const sentAt=performance.now();
    ws.send(JSON.stringify({t:'ping',sent:nonce}));
    try{await waiter;samples.push(performance.now()-sentAt)}
    catch(e){failed.push({round,i,error:String(e)})}
   });
   await Promise.all(batch);
  }
  assert.equal(failed.length,0,JSON.stringify(failed));
  assert.equal(samples.length,48);
  const sorted=samples.slice().sort((a,b)=>a-b);
  const stats={
   kind:'local CI loopback — NOT real player-to-server Internet latency',
   clients:4,expectedPackets:48,receivedPackets:samples.length,
   lossPercent:(48-samples.length)/48*100,
   p50RttMs:+percentile(sorted,.50).toFixed(2),
   p95RttMs:+percentile(sorted,.95).toFixed(2),
   p99RttMs:+percentile(sorted,.99).toFixed(2),
   maxRttMs:+sorted.at(-1).toFixed(2),
   minRttMs:+sorted[0].toFixed(2),
  };
  console.log('COOP_LOCAL_RTT_REPORT',JSON.stringify(stats));
 }finally{
  for(const ws of clients)try{ws.terminate()}catch{}
  await new Promise(resolve=>server.close(resolve));
 }
});
