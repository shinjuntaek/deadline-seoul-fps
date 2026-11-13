function coopLaunch(action){
 if(!('WebSocket'in window)){coopMsg('최신 브라우저에서 접속해 주세요.');return}
 const resuming=action==='resume';
 const code=resuming?coop.code:coop.lobby.querySelector('#coop-code').value.trim().toUpperCase();
 if((action==='join'||resuming)&&!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code||'')){
  coopMsg('6자리 방 코드를 입력해 주세요.');return;
 }
 clearTimeout(coop.retryTimer);clearInterval(coop.heartbeat);
 const previous=coop.ws;coop.ws=null;
 if(previous){try{previous.close()}catch{}}
 if(!resuming){coop.token=null;coop.playerId=null;coop.resumePending=false;coop.retryAt=0;coop.retries=0;}
 coop.desiredAction=action;coop.serverInstance=null;coop.lastSeen=performance.now();
 coopMsg(resuming?'기존 작전에 재접속하는 중…':'협동 서버에 연결하는 중…');
 let ws;try{ws=new WebSocket(coopURL())}catch{coopMsg('협동 서버 주소가 올바르지 않습니다.');return}
 coop.ws=ws;
 ws.onopen=()=>{
  if(coop.ws!==ws)return;
  coopSocketSend({t:resuming?'join':action,name:coopName(),code,resumeToken:resuming?coop.token:null});
  coop.heartbeat=setInterval(()=>{
   if(coop.ws!==ws)return;
   if(performance.now()-coop.lastSeen>15000){ws.close(4000,'Heartbeat timeout');return}
   coopSocketSend({t:'ping',sent:performance.now()});
  },5000);
 };
 ws.onmessage=ev=>{
  if(coop.ws!==ws)return;
  let m;try{m=JSON.parse(ev.data)}catch{return}
  coop.lastSeen=performance.now();coopReceive(m);
 };
 ws.onclose=event=>{
  if(coop.ws!==ws)return;
  clearInterval(coop.heartbeat);coop.disconnects++;coop.lastClose={code:event.code,at:Date.now()};
  coop.active=false;fireHeld=false;
  if(coop.resumePending)phase='paused';
  if(coop.token){coop.needsReconnect=true;coopOpenPanel();coopScheduleReconnect()}
  else {coopResetLobby();coopMsg('연결이 종료되었습니다. 다시 연결해 주세요.')}
 };
 ws.onerror=()=>{if(coop.ws===ws)coopMsg('협동 서버에 연결할 수 없습니다. 연결 복구를 시도합니다.')};
}
