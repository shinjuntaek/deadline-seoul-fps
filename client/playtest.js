/* Loopback-only automation; unavailable on the public site or Preview. */
if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('playtest')){
 let bot=false,fireEnabled=true,restarts=0,lastBot=performance.now(),frames=0;
 const history={kills:0,waves:new Set(),deaths:0,reloads:0,maxEnemies:0};let lastReload=false,lastKills=0;
 const originalFrame=humanFrame;
 humanFrame=function(dt){originalFrame(dt);frames++;if(!bot||phase!=='playing')return;
  const w=stateWeapon();if(w.reloading&&!lastReload)history.reloads++;lastReload=w.reloading;
  if(stats.kills>lastKills)history.kills+=stats.kills-lastKills;lastKills=stats.kills;
  history.waves.add(stats.wave);history.maxEnemies=Math.max(history.maxEnemies,enemies.filter(z=>!z.dead).length);
  const target=enemies.filter(z=>!z.dead).sort((a,b)=>a.group.position.distanceToSquared(camera.position)-b.group.position.distanceToSquared(camera.position))[0];
  if(target){const dx=target.group.position.x-camera.position.x,dz=target.group.position.z-camera.position.z;
   yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(2.02*target.profile.scale-camera.position.y,Math.hypot(dx,dz));
   const distance=Math.hypot(dx,dz);moveTouch.set(distance<6?.7:0,distance<5?.65:0);
   fireHeld=fireEnabled&&distance<34;if(w.ammo===0&&!w.reloading&&w.reserve)reload();
  }else{fireHeld=false;moveTouch.set(0,0)}
  // Real pickup traversal, no synthetic ammunition or health refill.
  if(w.reserve<20){const pickup=pickups.find(p=>p.active&&p.kind==='ammo');if(pickup){const dx=pickup.group.position.x-camera.position.x,dz=pickup.group.position.z-camera.position.z;yaw=Math.atan2(-dx,-dz);moveTouch.set(0,-.65);interactRequested=true}}
 };
 window.__DEADLINE_PLAYTEST__={
  ready:()=>humanAssets.ready,
  stage(){if(phase==='playing')resetRun();else startRun();clearRun();spawnQueue=[];waveIndex=0;stats.wave=1;nextWave=-1;camera.position.set(0,PLAYER.height,24);yaw=0;pitch=0;camera.rotation.set(0,0,0,'YXZ');
   for(const [kind,x,z] of [['walker',-2.0,17],['runner',2.1,15],['walker',-.3,10],['runner',-4,6],['walker',4,4]])createEnemy(kind,new THREE.Vector3(x,0,z));
   initialProps();return this.state();},
  aimAtEnemy(){const z=enemies.find(z=>!z.dead);if(!z)return;const d=z.group.position.clone().sub(camera.position);yaw=Math.atan2(-d.x,-d.z);pitch=Math.atan2(2.02*z.profile.scale-camera.position.y,Math.hypot(d.x,d.z));},
  bot(value){bot=value;if(!value){fireHeld=false;moveTouch.set(0,0)}},
  fire(value){fireEnabled=value;fireHeld=value},
  restart(){if(phase==='gameover'||phase==='victory'){history.deaths+=phase==='gameover'?1:0;restarts++;lastKills=0;startRun()}},
  state(){return{phase,frames,restarts,health,ammo:stateWeapon().ammo,reserve:stateWeapon().reserve,kills:stats.kills,wave:stats.wave,history:{...history,waves:[...history.waves]},art:window.__DEADLINE_ZOMBIE_ART__(),camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z,yaw,pitch},rig:enemies.find(z=>z.human)?.human?.bones.get('upperleg01_L')?.bone.quaternion.toArray()||null,performance:window.__DEADLINE_PERFORMANCE__()}}
 };
}
