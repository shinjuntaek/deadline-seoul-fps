import test from 'node:test';import assert from 'node:assert/strict';
import{campaignState,advanceCampaign,campaignBlocked,campaignSpawn,CAMPAIGN_STAGES,CAMPAIGN_BLOCKS}from'../shared/campaign.mjs';
import{CoopRoom}from'./coop-engine.mjs';
test('continuous 340m route: walkable spine, collision agreement and all gates',()=>{
 for(let i=0;i<3;i++){
  const s=CAMPAIGN_STAGES[i],state={stage:i,status:'travel'};
  for(let z=s.start-1;z>s.gate+1;z--)assert.equal(campaignBlocked(0,z,.38,state),false,`spine ${z}`);
  assert(campaignBlocked(0,s.gate-1,.38,state));assert(!campaignBlocked(0,s.gate-1,.38,{...state,status:'open'}));
  for(let n=0;n<24;n++){const p=campaignSpawn(i,n);assert(!campaignBlocked(p.x,p.z,.72,state))}
 }
 for(const b of CAMPAIGN_BLOCKS)assert(campaignBlocked(b.x,b.z,.38,{stage:2,status:'open'}));
 assert(campaignBlocked(NaN,0));assert(campaignBlocked(0,-340));
});
test('combat, all-team rally, hold reset, traversal, checkpoint and final rescue',()=>{
 const state=campaignState(),a={x:0,z:12},b={x:2,z:12};
 for(let i=0;i<3;i++){
  const s=CAMPAIGN_STAGES[i];a.z=s.trigger-1;b.z=a.z;
  assert.equal(advanceCampaign(state,.05,{players:[a,b]}),'combat');
  assert.equal(advanceCampaign(state,.05,{players:[a,b],enemies:1}),null);
  assert.equal(advanceCampaign(state,.05,{players:[a,b],queued:1}),null);
  assert.equal(advanceCampaign(state,.05,{players:[a,b]}),'cleared');
  a.z=s.gate+5;for(let n=0;n<100;n++)advanceCampaign(state,.05,{players:[a,b]});assert.equal(state.hold,0);
  b.z=a.z;advanceCampaign(state,.05,{players:[a,b]});b.downed=true;advanceCampaign(state,.05,{players:[a,b]});assert.equal(state.hold,0);b.downed=false;
  let event;for(let n=0;n<Math.ceil(s.hold/.05)+3;n++)event=advanceCampaign(state,.05,{players:[a,b]})||event;
  assert.equal(event,i===2?'victory':'open');
  if(i<2){a.z=s.gate-3;assert.equal(advanceCampaign(state,.05,{players:[a,b]}),null);b.z=a.z;assert.equal(advanceCampaign(state,.05,{players:[a,b]}),'checkpoint')}
 }
 assert.equal(state.status,'complete');
});
test('campaign server mode, extended movement, spawn, snapshot and reconnect',()=>{
 let now=10000;const room=new CoopRoom('ABC234',{mode:'campaign',now:()=>now,rng:()=>.5});
 const a=room.add('a','A',()=>{}),b=room.add('b','B',()=>{});room.ready(a.playerId,true);room.ready(b.playerId,true);assert(room.start(a.playerId).ok);
 assert.equal(room.mode,'campaign');assert.equal(room.snapshot().campaign.stage,0);
 const p=room.players.get(a.playerId);p.x=0;p.z=-48;now+=180;room.input(p.id,{x:0,z:-49,yaw:0,seq:1,sprint:true});assert.equal(p.z,-49);
 room.campaign.stage=1;p.z=-128;now+=180;room.input(p.id,{x:0,z:-129,yaw:0,seq:2,sprint:true});assert.equal(p.z,-129);
 const enemy=room.spawnEnemy('walker');assert(enemy.z<-160);assert(!room.isObstructed(enemy.x,enemy.z));
 room.remove('a');const resume=room.add('a2','A',()=>{},a.token);assert(resume.resumed);assert.equal(room.snapshot().campaign.stage,1);
});
