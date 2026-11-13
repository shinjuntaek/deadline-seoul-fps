/** One route/collision/progression contract for local and authoritative co-op play.
 * Metres; north is -Z. Original five-wave arena remains a separate mode. */
export const CAMPAIGN_STAGES=Object.freeze([
 {id:'alley',name:'서울역 뒤편 골목',subtitle:'상가 봉쇄선을 돌파하고 지하차도 입구로 이동',start:18,end:-94,trigger:-31,gate:-88,width:18,walkers:12,runners:3,brutes:0,hold:3},
 {id:'underpass',name:'청파 지하차도',subtitle:'정전된 지하차도를 통과해 강변 출구 확보',start:-94,end:-204,trigger:-139,gate:-198,width:11,walkers:15,runners:7,brutes:0,hold:3},
 {id:'riverside',name:'한강 임시 대피소',subtitle:'마지막 봉쇄선을 정리하고 구조 버스까지 이동',start:-204,end:-330,trigger:-248,gate:-318,width:23,walkers:19,runners:10,brutes:1,hold:8},
]);
export const CAMPAIGN_START={x:0,z:12,yaw:0};
export const CAMPAIGN_BLOCKS=Object.freeze([
 {x:-11,z:-13,w:2.2,d:4.5,kind:'car'}, {x:11,z:-52,w:2.2,d:4.5,kind:'car'},
 {x:-12,z:-69,w:2.2,d:4.5,kind:'car'}, {x:15,z:3,w:2.1,d:1.6,kind:'crate'},
 {x:-7.5,z:-119,w:2.2,d:4.5,kind:'car'}, {x:7.5,z:-162,w:2.2,d:4.5,kind:'car'},
 {x:-17,z:-226,w:2.2,d:4.5,kind:'car'}, {x:16,z:-268,w:2.2,d:4.5,kind:'car'},
 {x:-16,z:-300,w:2.7,d:8.2,kind:'bus'}, {x:14,z:-307,w:3.8,d:2.3,kind:'crate'},
]);
export function routeWidth(z){
 // Wider transition aprons make a continuous corridor with no invisible step.
 if(z<-212.5)return 23;
 if(z<-96.5)return 11;
 return 18;
}
export function campaignBlocked(x,z,r=.38,state={stage:0,status:'travel'}){
 if(!Number.isFinite(x)||!Number.isFinite(z)||z>19-r||z<-332+r||Math.abs(x)>routeWidth(z)-r)return true;
 for(const b of CAMPAIGN_BLOCKS)if(Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r)return true;
 for(const s of CAMPAIGN_STAGES)if(Math.abs(z-s.gate)<.35+r&&Math.abs(x)>5.8-r)return true;
 const gate=CAMPAIGN_STAGES[state.stage]?.gate??-318;
 if(state.status!=='open'&&state.status!=='complete'&&z<gate+r)return true;
 // Future gates remain closed even after this stage opens.
 if(state.status==='open'&&state.stage<2&&z<CAMPAIGN_STAGES[state.stage+1].gate+r)return true;
 return false;
}
export function campaignQueue(stage){const s=CAMPAIGN_STAGES[stage];return [...Array(s.walkers).fill('walker'),...Array(s.runners).fill('runner'),...Array(s.brutes).fill('brute')]}
export function campaignSpawn(stage,index=0){
 const s=CAMPAIGN_STAGES[stage];
 return {x:[-5,5,-2,2][index%4],z:s.gate+17+(index%3)*3};
}
export function campaignState(){return{stage:0,status:'travel',hold:0,checkpoint:0}}
/** Mutates only the serializable route state; caller owns combat/spawns/resources. */
export function advanceCampaign(state,dt,{players,enemies=0,queued=0}){
 const s=CAMPAIGN_STAGES[state.stage];
 const present=players.filter(p=>p.connected!==false&&!p.dead);
 const active=present.filter(p=>!p.downed);
 if(!active.length)return null;
 if(state.status==='travel'&&active.some(p=>p.z<=s.trigger)){
  state.status='combat';return 'combat';
 }
 if(state.status==='combat'&&enemies===0&&queued===0){state.status='regroup';state.hold=0;return 'cleared'}
 if(state.status==='regroup'){
  const together=present.every(p=>!p.downed&&Math.abs(p.x)<5.6&&p.z>s.gate&&p.z<s.gate+10);
  state.hold=together?Math.min(s.hold,state.hold+Math.min(dt,.1)):0;
  if(state.hold>=s.hold){
   if(state.stage===2){state.status='complete';return 'victory'}
   state.status='open';return 'open';
  }
 }
 if(state.status==='open'&&active.every(p=>p.z<s.gate-2)){
  state.stage++;state.checkpoint=state.stage;state.status='travel';state.hold=0;return 'checkpoint';
 }
 return null;
}
