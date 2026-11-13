/**
 * Vercel Node /api/multiplayer WebSocket adapter (experimental same-instance rooms).
 * Vercel Functions support WebSocket upgrades (GA Oct 2026), but connections
 * aren't guaranteed to share the same Function instance. In-memory rooms are
 * therefore Preview/testing only until a durable per-room coordinator is deployed.
 *
 * This module deliberately has no external secret, no persistent user PII,
 * no cross-room chat and no unauthenticated privileged admin methods.
 */
import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {CoopRoom,generateRoomCode,validRoomCode} from '../multiplayer/coop-engine.mjs';
const sessions=new Map();
const instanceId=crypto.randomUUID();
const ms=()=>Date.now();
const send=(ws,msg)=>{
 if(ws.readyState!==WebSocket.OPEN)return;
 try{ws.send(JSON.stringify(msg))}catch{}
};
const server=createServer((req,res)=>{
 const origin=req.headers.origin||'';
 if(origin)res.setHeader('access-control-allow-origin',origin);
 res.setHeader('cache-control','no-store');
 res.setHeader('content-type','application/json; charset=utf-8');
 res.end(JSON.stringify({status:'ok',service:'deadline-seoul-coop-preview',websocket:true,
  coordination:'same-instance-only',durable:false,maxPlayers:4,
  note:'Use Cloudflare Durable Objects for reliable public multi-instance rooms'}));
});
const wss=new WebSocketServer({server,maxPayload:2048,perMessageDeflate:false,clientTracking:true});
let serviceTimer=null;
function ensureTimer(){
 if(serviceTimer)return;
 serviceTimer=setInterval(()=>{
  const now=ms();
  for(const [code,room] of sessions){
   if(room.phase==='playing'||room.phase==='extraction')room.tick(.05);
   if(room.connectedCount===0&&(now-room.lastActivity>60000))sessions.delete(code);
  }
  if(sessions.size===0){clearInterval(serviceTimer);serviceTimer=null}
 },50);
 serviceTimer.unref?.();
}
function uniqueCode(){
 for(let n=0;n<12;n++){
  const code=generateRoomCode();
  if(!sessions.has(code))return code;
 }
 return null;
}
wss.on('connection',(ws,req)=>{
 const origin=String(req.headers.origin||'');
 const reqHost=String(req.headers.host||'');
 const siteHost=origin?new URL(origin).host:'';
 const allowlist=String(process.env.COOP_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const sameSite=siteHost===reqHost;
 const samePreviewFamily=siteHost.endsWith('.vercel.app')&&reqHost.endsWith('.vercel.app');
 const explicitlyAllowed=allowlist.includes(origin);
 if(origin&&!sameSite&&!samePreviewFamily&&!explicitlyAllowed){
  send(ws,{t:'error',code:'FORBIDDEN_ORIGIN'});ws.close(1008,'Origin rejected');return;
 }
 const clientId=crypto.randomUUID();
 let room=null,playerId=null,initialAt=ms(),messages=0,windowAt=initialAt,lastMessage=initialAt;
 send(ws,{t:'hello',v:1,instanceId,heartbeat:10000,maxPlayers:4,warning:'preview-instance-limited'});
 const helloTimeout=setTimeout(()=>{if(!playerId&&ws.readyState===WebSocket.OPEN)ws.close(1008,'Handshake timeout')},18000);
 ws.on('message',data=>{
  const now=ms();
  if(now-windowAt>1000){messages=0;windowAt=now}
  if(++messages>100){ws.close(1008,'Rate limit');return}
  lastMessage=now;
  let msg;
  try{if(typeof data.toString()!=='string'||data.length>2048)throw Error('bad');msg=JSON.parse(data.toString())}catch{
   send(ws,{t:'error',code:'BAD_JSON'});return;
  }
  if(!msg||typeof msg.t!=='string'){send(ws,{t:'error',code:'BAD_MESSAGE'});return}
  if(!playerId){
   if(msg.t!=='create'&&msg.t!=='join'){send(ws,{t:'error',code:'JOIN_FIRST'});return}
   const isCreate=msg.t==='create';
   const code=isCreate?uniqueCode():String(msg.code||'').toUpperCase().trim();
   if(!code||!validRoomCode(code)){send(ws,{t:'error',code:'INVALID_CODE'});return}
   if(isCreate){
    if(sessions.size>=60){send(ws,{t:'error',code:'SERVER_BUSY'});return}
    room=new CoopRoom(code,{mode:msg.mode});sessions.set(code,room);
   }else room=sessions.get(code);
   if(!room){send(ws,{t:'error',code:'ROOM_NOT_FOUND',hint:'The preview may route to a different function instance. A durable room backend is required for public release.'});return}
   const result=room.add(clientId,msg.name,m=>send(ws,m),msg.resumeToken);
   if(!result.ok){send(ws,{t:'error',code:result.error});return}
   playerId=result.playerId;
   clearTimeout(helloTimeout);
   send(ws,{t:'joined',code,playerId,token:result.token,resumed:result.resumed,mode:room.mode,instanceId});
   room.broadcastLobby();
   if(result.resumed)send(ws,{t:'resume',mode:room.mode,state:room.snapshot()});
   ensureTimer();
   return;
  }
  if(msg.t==='leave'){ws.close(1000,'Left room');return}
  const result=room.dispatch(playerId,msg);
  if(result?.t==='pong')send(ws,result);
  else if(result&&!result.ok&&!['input','fire'].includes(msg.t))send(ws,{t:'error',code:result.error||'ACTION_REJECTED'});
 });
 ws.on('close',()=>{
  clearTimeout(helloTimeout);
  if(room)room.remove(clientId);
 });
 ws.on('error',()=>{if(room)room.remove(clientId)});
});
export default server;
