function coopDisconnect(){
 clearTimeout(coop.retryTimer);clearInterval(coop.heartbeat);
 const ws=coop.ws;coop.ws=null;
 if(ws){try{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({t:'leave'}));ws.close(1000,'Leave room')}catch{}}
 for(const z of coop.enemyMeshes.values())coopDisposeZombie(z);coop.enemyMeshes.clear();
 for(const z of coop.deathCorpses||[])coopDisposeZombie(z);coop.deathCorpses=[];
 for(const g of coop.teammates.values())coopDisposeTeammate(g);coop.teammates.clear();
 Object.assign(coop,{active:false,ended:false,playerId:null,token:null,code:null,roomInfo:null,lastState:null,
 needsReconnect:false,resumePending:false,retryAt:0,retries:0,clockOffset:null,downed:false,dead:false,reviveHeld:false,sentRevive:false});
 try{sessionStorage.removeItem('deadline-coop-session')}catch{}
 for(const id of ['coop-revive','coop-topline'])document.getElementById(id)?.classList.add('hidden');
 document.getElementById('coop-recover')?.remove();coopResetLobby();
}
