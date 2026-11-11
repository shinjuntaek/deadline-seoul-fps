/**
 * Adds readable infected death feedback without changing the 5-wave director.
 * Applies AFTER all existing WebGL/coop/photographic character patches.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const file=path.resolve(__dirname,'..','dist','game.js');
let js=fs.readFileSync(file,'utf8');
function patch(oldCode,newCode,label){
 const parts=js.split(oldCode);
 if(parts.length!==2)throw new Error('Zombie-death patch '+label+': expected one marker, saw '+(parts.length-1));
 js=parts.join(newCode);
}
const runtime="\n/* Infected death animation for photo-textured + fallback 3D characters.\n * Server still owns health, killing and co-op scoring.\n * Dead enemies are instantly removed from combat raycasts, but their visual\n * remains for stagger -> fall -> prone corpse -> fade. */\nconst ZOMBIE_DEATH_STAGGER=.16;\nconst ZOMBIE_DEATH_FALL=.86;\nconst ZOMBIE_DEATH_FADE=3.13;\nconst ZOMBIE_DEATH_END=4.05;\nconst ZOMBIE_DEATH_MATERIALS=new Set();\nfunction zombieSmooth(v){const t=THREE.MathUtils.clamp(v,0,1);return t*t*(3-2*t)}\nfunction zombieCorpseVisual(z){\n if(z.deadCorpse||!z.photographicActive||!z.photoSprite)return;\n const source=z.photoSprite.material.map;\n if(!source||!source.image)return;\n const wide=z.kind==='brute'?2.2:1.35,long=z.kind==='brute'?2.8:2.32;\n const m=new THREE.MeshBasicMaterial({\n  map:source,color:0xa6a19b,transparent:true,opacity:0,alphaTest:.12,\n  depthTest:true,depthWrite:false,side:THREE.DoubleSide,\n  polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1\n });\n const corpse=new THREE.Mesh(new THREE.PlaneGeometry(wide,long),m);\n corpse.rotation.x=-Math.PI/2;\n corpse.position.set(z.deathSide*.10,.031,-.05);\n corpse.raycast=()=>{};\n corpse.renderOrder=8;\n z.group.add(corpse);\n z.deadCorpse=corpse;\n}\nfunction beginZombieDeath(z,head=false){\n if(z.deathStarted)return;\n z.deathStarted=true;\n z.dead=true;\n z.hp=0;\n z.death=0;\n z.deathSide=z.id%2?1:-1;\n z.deathHead=!!head;\n z.deathPhase='stagger';\n z.deathAnchorY=z.group.position.y;\n z.horrorRush=0;\n z.hitReact=0;\n if(z.photoSprite){\n  z.deathImageHeight=z.photoSprite.scale.y;\n  z.photoSprite.rotation.z=0;\n  z.photoSprite.material.color.setHex(0xffffff);\n }\n applyPhotographicZombieSkin(z);\n zombieCorpseVisual(z);\n}\nfunction updateZombieDeath(z,dt){\n if(!z.deathStarted)beginZombieDeath(z,false);\n z.death+=dt;\n const t=z.death;\n if(z.photoSprite&&!z.photographicActive)applyPhotographicZombieSkin(z);\n if(z.photographicActive&&!z.deadCorpse)zombieCorpseVisual(z);\n const fall=zombieSmooth((t-ZOMBIE_DEATH_STAGGER)/(ZOMBIE_DEATH_FALL-ZOMBIE_DEATH_STAGGER));\n const jerk=zombieSmooth(t/ZOMBIE_DEATH_STAGGER);\n const fade=zombieSmooth((t-ZOMBIE_DEATH_FADE)/(ZOMBIE_DEATH_END-ZOMBIE_DEATH_FADE));\n z.deathPhase=t<ZOMBIE_DEATH_STAGGER?'stagger':t<ZOMBIE_DEATH_FALL?'fall':t<ZOMBIE_DEATH_FADE?'down':'fade';\n z.group.position.y=0;\n if(z.photoSprite&&z.photographicActive){\n  const s=z.photoSprite;\n  s.rotation.z=z.deathSide*(jerk*.16+fall*1.35);\n  s.position.x=z.deathSide*(jerk*.035+fall*.29);\n  s.position.y=.025-jerk*.04-fall*.04;\n  s.scale.y=z.deathImageHeight*(1-.52*fall);\n  s.material.opacity=Math.max(0,1-zombieSmooth((t-.57)/.40));\n  if(z.deadCorpse){\n   const show=zombieSmooth((t-.54)/.32);\n   z.deadCorpse.material.opacity=Math.max(0,.81*show*(1-fade));\n  }\n }else{\n  // Texture unavailable: still give the original procedural fallback a clear fall.\n  const tilt=z.deathSide*(.18*jerk+1.24*fall);\n  z.group.rotation.z+=(tilt-z.group.rotation.z)*Math.min(1,dt*15);\n  z.group.position.y=-.38*fall;\n  z.group.scale.y=Math.max(.55,z.profile.scale*(1-.30*fall));\n }\n if(t>ZOMBIE_DEATH_FALL&&!z.deathImpactPlayed){\n  z.deathImpactPlayed=true;\n  if(Math.hypot(camera.position.x-z.group.position.x,camera.position.z-z.group.position.z)<16){\n   try{if(audio.ctx?.state==='running')audio.tone(z.kind==='brute'?54:75,.022,.24,'triangle')}catch{}\n  }\n }\n if(t>=ZOMBIE_DEATH_END){\n  disposeEnemyGroup(z);\n  return false;\n }\n return true;\n}\nfunction zombieHitReaction(z,dt){\n if(z.dead||!z.photoSprite||!z.photographicActive)return;\n z.hitReact=Math.max(0,(z.hitReact||0)-dt);\n const a=z.hitReact;\n const s=z.photoSprite;\n s.rotation.z=Math.sin(a*29+z.id)*a*.38;\n s.material.color.setRGB(1,1-Math.min(.25,a*.65),1-Math.min(.28,a*.8));\n}\n/* One lightweight kill-confirmation element; no new sprites or DOM nodes per kill. */\nlet zombieKillBadge=null,zombieKillTimer=0;\nfunction notifyZombieKill(z,head=false){\n if(!zombieKillBadge){\n  zombieKillBadge=document.createElement('output');\n  zombieKillBadge.id='zombie-kill-confirm';\n  zombieKillBadge.setAttribute('aria-live','off');\n  Object.assign(zombieKillBadge.style,{\n   position:'fixed',left:'50%',top:'56%',transform:'translateX(-50%)',\n   zIndex:'45',font:'900 17px/1.2 system-ui,sans-serif',\n   letterSpacing:'.05em',color:'#e9fff4',textShadow:'0 1px 12px #00140b',\n   padding:'7px 13px',borderRadius:'6px',\n   background:'rgba(5,30,20,.82)',border:'1px solid #83dfaf',\n   pointerEvents:'none',opacity:'0'\n  });\n  document.body.appendChild(zombieKillBadge);\n }\n zombieKillBadge.textContent=head?'헤드샷 · 처치 확인':z?.kind==='brute'?'브루트 처치!':'감염체 처치 확인';\n zombieKillBadge.style.opacity='1';\n zombieKillTimer=.72;\n}\nfunction tickZombieKillBadge(dt){\n if(!zombieKillBadge||zombieKillTimer<=0)return;\n zombieKillTimer=Math.max(0,zombieKillTimer-dt);\n zombieKillBadge.style.opacity=String(Math.min(1,zombieKillTimer/.19));\n}\n";
patch('function updateEnemy(z,dt){',runtime+'\nfunction updateEnemy(z,dt){','shared death visuals');
patch('if(z.dead){z.death+=dt;z.group.rotation.z+=(1.18-z.group.rotation.z)*Math.min(1,dt*4.2);z.group.position.y=Math.max(-.45,z.group.position.y-dt*.45);if(z.death>4.2){disposeEnemyGroup(z);return false}return true}',
 'if(z.dead)return updateZombieDeath(z,dt);',
 'singleplayer death fall/fade');
patch('function enemyDamage(z,amount,head){if(z.dead)return false;z.hp-=amount;',
 'function enemyDamage(z,amount,head){if(z.dead)return false;z.hitReact=Math.max(z.hitReact||0,head?.36:.24);z.hp-=amount;',
 'nonlethal flinch feedback');
patch('if(z.hp<=0){z.hp=0;z.dead=true;z.group.rotation.y+=(Math.random()-.5)*.7;return true}',
 'if(z.hp<=0){beginZombieDeath(z,head);return true}',
 'start death pose exactly once');
patch('horrorReact(z,dist);z.attack-=dt;',
 'horrorReact(z,dist);zombieHitReaction(z,dt);z.attack-=dt;',
 'nonlethal damage flash and recoil');
patch('function killEnemy(z,head,explosive=false){stats.kills++;',
 'function killEnemy(z,head,explosive=false){notifyZombieKill(z,head);stats.kills++;',
 'on-kill localized confirmation');
patch("if(m.by===coop.playerId&&m.hits&&m.hits.length){showHit(m.hits.some(h=>h.head));stats.hits++}",
 "if(m.by===coop.playerId&&m.hits&&m.hits.length){showHit(m.hits.some(h=>h.head));stats.hits++;if(m.hits.some(h=>h.hp===0))notifyZombieKill(null,m.hits.some(h=>h.head))}",
 'co-op confirmed kill event');
patch("if(!expected.has(id)){coopDisposeZombie(z);coop.enemyMeshes.delete(id)}",
 "if(!expected.has(id)){beginZombieDeath(z,false);coop.enemyMeshes.delete(id);(coop.deathCorpses||(coop.deathCorpses=[])).push(z);if(coop.deathCorpses.length>18){const oldest=coop.deathCorpses.shift();coopDisposeZombie(oldest)}}",
 'co-op removal becomes death pose instead of instant deletion');
patch('function coopFrame(dt,now){',
 "function coopFrame(dt,now){\n if(coop.deathCorpses)for(let i=coop.deathCorpses.length-1;i>=0;i--){const z=coop.deathCorpses[i];if(!updateZombieDeath(z,dt)){coop.deathCorpses.splice(i,1);const j=enemies.indexOf(z);if(j>=0)enemies.splice(j,1)}}",
 'co-op fall and corpse timeout');
patch('coop.enemyMeshes.clear();',
 "coop.enemyMeshes.clear();\n for(const z of coop.deathCorpses||[])coopDisposeZombie(z);\n coop.deathCorpses=[];",
 'prevent lingering corpses after leaving room');
patch('horrorThreatFrame(dt);updateFX(dt);fpsTime+=dt;',
 'horrorThreatFrame(dt);tickZombieKillBadge(dt);updateFX(dt);fpsTime+=dt;',
 'keep confirmation short and nonintrusive');
fs.writeFileSync(file,js);
cp.execFileSync(process.execPath,['--check',file]);
console.log('INFECTED_DEATH_ANIMATION_READY',JSON.stringify({
 staggerSeconds:.16,fallSeconds:.86,corpseLingerSeconds:3.13,totalVisualSeconds:4.05,
 corpseMeshOnlyOnDeath:true,concurrentCoopCorpseCap:18,
 intactHeadshotRaycasts:true,sharedPhotoTextures:true,cooperativeVisualParity:true
}));
