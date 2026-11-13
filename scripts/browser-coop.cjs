/**
 * End-to-end Chromium co-op smoke test: actual FPS browser + independent WS peer.
 * Does NOT pretend a 4-player human playthrough or physical Android measurement.
 */
'use strict';
const {chromium}=require('playwright');
const WebSocket=require('ws');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.GAME_BASE_URL||'http://127.0.0.1:4173';
const output=path.resolve(__dirname,'..','browser-qa');
fs.mkdirSync(output,{recursive:true});
const result={status:'PENDING',steps:[],errors:[],reference:'real Chromium UI + separate websocket connection'};
const step=(name,pass,detail)=>{result.steps.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail))};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browserArgs=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
 '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
async function waitWS(ws,condition,timeout=7000){
 const data=[];
 const resolveAlready=()=>data.find(condition);
 return await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{cleanup();reject(Error('WS timeout '+JSON.stringify(data.slice(-4))))},timeout);
  function onMessage(buf){
   let msg;try{msg=JSON.parse(buf.toString())}catch{return}
   data.push(msg);if(data.length>35)data.shift();
   if(condition(msg)){cleanup();resolve(msg)}
  }
  function cleanup(){clearTimeout(timer);ws.off('message',onMessage)}
  ws.on('message',onMessage);
 });
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:browserArgs});
 let ws;
 try{
  const context=await browser.newContext({viewport:{width:960,height:600},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',e=>result.errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:70000});
  await page.locator('#coop-launch').waitFor({state:'visible',timeout:70000});
  step('Co-op entry displayed alongside original single-player menu',true,{});
  await page.locator('#coop-launch').click();
  await page.locator('#coop-name').fill('Browser QA');
  await page.locator('#coop-create').click();
  await page.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__?.().room?.length===6,{timeout:10000});
  const status=await page.evaluate(()=>window.__DEADLINE_COOP_STATUS__());
  step('Actual browser created room code',/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(status.room),status);
  await page.screenshot({path:path.join(output,'coop-host-lobby.png')});
  ws=new WebSocket(base.replace(/^http/,'ws')+'/api/multiplayer',{
   origin:base
  });
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)});
  const joinedPromise=waitWS(ws,m=>m.t==='joined');
  ws.send(JSON.stringify({t:'join',code:status.room,name:'Node Team' }));
  const joined=await joinedPromise;
  step('Independent peer joins same room',joined.code===status.room,{code:joined.code});
  await page.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__?.().members===2,{timeout:10000});
  const buddyReady=waitWS(ws,m=>m.t==='lobby'&&m.players.length===2&&m.players.every(p=>p.ready),10000);
  ws.send(JSON.stringify({t:'ready',value:true}));
  await page.locator('#coop-ready').click();
  await buddyReady;
  // Attach listener before clicking: the host may start instantly, so registering
  // afterward can drop the broadcast and incorrectly time out a successful match.
  const startPromise=waitWS(ws,m=>m.t==='start',12000);
  await page.locator('#coop-start').click();
  const start=await startPromise;
  step('Host starts shared operation after both ready',start.wave===1,start);
  await page.locator('#hud-top:not(.hidden)').waitFor({state:'visible',timeout:70000});
  await page.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__?.().active,{timeout:10000});
  step('Game started without running separate local wave',await page.locator('#coop-topline').isVisible(),
    await page.locator('#coop-topline').innerText());
  await page.waitForFunction(()=>window.__DEADLINE_COOP_STATUS__?.().members===2,{timeout:13000});
  await page.screenshot({path:path.join(output,'coop-playing-wave1.png')});
  const before=Number(await page.locator('#ammo').innerText());
  try{
   const b=await page.locator('#game').boundingBox();
   await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
   await page.mouse.down();await pause(160);await page.mouse.up();
  }catch(e){result.errors.push('mouse firing: '+e.message)}
  await page.waitForFunction(previous=>Number(document.querySelector('#ammo').textContent)<previous,before,{timeout:8000});
  const after=Number(await page.locator('#ammo').innerText());
  step('Browser click produces authoritative rifle shot',before===30&&after<before,{before,after});
  const snap=await waitWS(ws,m=>m.t==='state'&&m.players.some(p=>p.id===status.playerId&&p.ammo.rifle<30),15000);
  step('Independent peer receives the same ammo change',snap.players.find(p=>p.id===status.playerId).ammo.rifle<30,{});
  result.status=result.errors.length?'PARTIAL':'PASS';
 }catch(err){result.status='FAIL';result.error=err.stack||err.message;console.error(result.error)}
 finally{
  try{ws?.close()}catch{}
  await browser.close();
  fs.writeFileSync(path.join(output,'coop-browser-results.json'),JSON.stringify(result,null,2)+'\n');
  console.log('COOP_BROWSER_QA',JSON.stringify(result));
 }
 if(result.status!=='PASS')process.exitCode=1;
})().catch(err=>{console.error(err);process.exitCode=1});
