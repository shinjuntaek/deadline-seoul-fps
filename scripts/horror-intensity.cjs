/**
 * Extra-fast infected with bounded lunges and cinematic threat cues.
 * Apply after enemy-speed.cjs and coop-client.cjs to keep local and co-op visuals aligned.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const file=path.resolve(__dirname,'..','dist','game.js');
let game=fs.readFileSync(file,'utf8');
function exact(oldCode,newCode,label){
 const pieces=game.split(oldCode);
 if(pieces.length!==2)throw Error('Unsafe horror patch '+label+': found '+(pieces.length-1));
 game=pieces.join(newCode);
}
const face="\n/* Lightweight nightmare facial anatomy. Decorative parts are not raycast targets. */\nlet horrorMouth=null;\nif(quality!=='low'&&!ultraLow){\n const voidMat=new THREE.MeshStandardMaterial({color:0x16060a,roughness:1,metalness:0});\n const toothMat=new THREE.MeshStandardMaterial({color:0xb9ac97,roughness:.86,metalness:0});\n const faceWidth=kind==='brute'?.40:.27;\n const mouth=new THREE.Mesh(new THREE.BoxGeometry(faceWidth,.14,.032),voidMat);\n mouth.position.set(0,-.012,-.172);mouth.raycast=()=>{};jaw.add(mouth);horrorMouth=mouth;\n for(let i=0;i<4;i++){\n  const fang=new THREE.Mesh(new THREE.ConeGeometry(.021,.085,5),toothMat);\n  fang.position.set((i-1.5)*faceWidth*.235,-.06,-.201);\n  fang.rotation.z=Math.PI+(i%2?.12:-.12);fang.raycast=()=>{};jaw.add(fang);\n }\n if(settings.gore){\n  const woundMat=new THREE.MeshStandardMaterial({color:0x451119,transparent:true,opacity:.8,roughness:.98,side:THREE.DoubleSide});\n  for(let i=0;i<2;i++){\n   const scar=new THREE.Mesh(new THREE.PlaneGeometry(.06,.32+i*.18),woundMat);\n   scar.position.set((i===0?-.1:.11),1.30+i*.10,-.317);\n   scar.rotation.z=(i===0?.4:-.3);scar.raycast=()=>{};g.add(scar);\n  }\n }\n}\n";
const runtime="\n/* Bounded short-distance enemy lunge; cannot teleport through colliders. */\nfunction horrorRush(z,dt,dist,range){\n z.horrorRush=Math.max(0,z.horrorRush-dt);\n z.horrorCooldown=Math.max(0,z.horrorCooldown-dt);\n if(z.horrorCooldown===0&&dist>range+1.1&&dist<12){\n  z.horrorRush=.58;\n  z.horrorCooldown=(z.kind==='runner'?7.2:8.8)+(z.id%4)*.6;\n }\n return z.horrorRush>0?(z.kind==='runner'?1.33:z.kind==='brute'?1.38:1.25):1;\n}\nfunction horrorReact(z,dist){\n if(z.horrorMouth)z.horrorMouth.scale.y=.7+(z.horrorRush>0?.6:0)+Math.abs(Math.sin(z.phase*.37))*.32;\n z.head.rotation.z+=Math.sin(z.phase*.27+z.id)*.085;\n if(z.horrorRush>0){\n  z.head.rotation.x-=.16;\n  z.limbs[0].rotation.x-=.25;\n  z.limbs[1].rotation.x-=.25;\n }\n if(z.horrorEyes){\n  const pulse=.5+.5*Math.sin(elapsed*3+z.id*.9);\n  z.horrorEyes.color.setRGB(.78+.22*pulse,z.kind==='runner'?.11+.14*pulse:.035+.065*pulse,.018);\n }\n}\n";
const ui="\n/* Proximity pressure: subtle peripheral threat, no flashing jumpscare imagery. */\nconst horrorVignette=document.createElement('div');\nhorrorVignette.id='horror-threat-vignette';\nhorrorVignette.setAttribute('aria-hidden','true');\nObject.assign(horrorVignette.style,{\n position:'fixed',inset:'0',zIndex:'23',pointerEvents:'none',opacity:'0',\n background:'radial-gradient(ellipse at center,transparent 37%,rgba(93,5,12,.15) 65%,rgba(110,8,15,.85) 100%)',\n transition:'opacity .16s ease-out'\n});\ndocument.body.appendChild(horrorVignette);\nconst horrorThreatLabel=document.createElement('div');\nhorrorThreatLabel.id='horror-threat-label';horrorThreatLabel.setAttribute('aria-live','off');\nObject.assign(horrorThreatLabel.style,{\n position:'fixed',top:'13%',left:'50%',transform:'translateX(-50%)',\n zIndex:'25',pointerEvents:'none',color:'#ffb9ae',background:'rgba(31,4,9,.78)',\n border:'1px solid rgba(190,60,58,.62)',borderRadius:'6px',padding:'6px 13px',\n font:'800 12px/1.2 system-ui,sans-serif',letterSpacing:'.12em',\n textShadow:'0 0 10px #ff6254',opacity:'0',transition:'opacity .20s ease-out'\n});\nhorrorThreatLabel.textContent='감염체 근접';document.body.appendChild(horrorThreatLabel);\nlet horrorLastScan=0,horrorThreatLevel=0,horrorThreatKind='walker',horrorNearest=Infinity;\nif(new URLSearchParams(location.search).get('qa')==='1'){\n window.__DEADLINE_HORROR_QA__=()=>({nearest:horrorNearest,level:horrorThreatLevel,\n  opacity:Number(horrorVignette.style.opacity),indicator:Number(horrorThreatLabel.style.opacity)});\n}\nconst horrorReducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;\nfunction horrorThreatFrame(dt){\n if(phase!=='playing'){\n  horrorThreatLevel=0;horrorVignette.style.opacity='0';horrorThreatLabel.style.opacity='0';horrorNearest=Infinity;\n  return;\n }\n if(elapsed-horrorLastScan>.13){\n  horrorLastScan=elapsed;\n  let closest=Infinity,kind='walker';\n  for(const z of enemies){\n   if(z.dead)continue;\n   const dist=Math.hypot(z.group.position.x-camera.position.x,z.group.position.z-camera.position.z);\n   if(dist<closest){closest=dist;kind=z.kind}\n   if(coop.active&&z.coopRushing)horrorReact(z,dist);\n  }\n  horrorNearest=closest;\n  const near=THREE.MathUtils.clamp((19-closest)/18,0,1);\n  horrorThreatLevel+=(Math.pow(near,1.25)-horrorThreatLevel)*.36;\n  horrorThreatKind=kind;\n  horrorThreatLabel.textContent=kind==='runner'?'러너 접근!':kind==='brute'?'브루트 접근!':'감염체 근접';\n  horrorThreatLabel.style.opacity=closest<7?String(Math.min(.95,.30+(7-closest)*.12)):'0';\n  if(closest<9)audio.snarl(kind,closest);\n  if(closest<3.3&&settings.shake&&!horrorReducedMotion)cameraShake=Math.max(cameraShake,.008);\n }\n const pulse=horrorReducedMotion?1:(.93+Math.sin(elapsed*4.2)*.07);\n horrorVignette.style.opacity=String(Math.min(.68,horrorThreatLevel*.70*pulse));\n}\n";
exact('walker:{hp:108,speed:1.65','walker:{hp:108,speed:2.25','walker top speed');
exact('runner:{hp:74,speed:3.45','runner:{hp:74,speed:4.9','runner top speed');
exact('brute:{hp:840,speed:1.08','brute:{hp:840,speed:1.55','brute top speed');
exact('const z={id:enemyId++',face+'\nconst z={id:enemyId++','scary head and scratches');
exact('z.detailRig=detailRig;g.userData.enemy=z;',
  'z.detailRig=detailRig;z.horrorMouth=horrorMouth;z.horrorEyes=eyeM;z.horrorRush=0;z.horrorCooldown=2+(z.id%6)*.65;g.userData.enemy=z;',
 'horror animation state');
exact('function updateEnemy(z,dt){',runtime+'\nfunction updateEnemy(z,dt){','lunge and reactions');
exact("const p=z.profile,proximity=THREE.MathUtils.clamp(1-dist/23,0,1),surge=z.kind==='runner'?.16:z.kind==='brute'?.06:.10,step=p.speed*(1+surge*proximity)*dt,r=z.kind===",
"const p=z.profile,proximity=THREE.MathUtils.clamp(1-dist/20,0,1),surge=z.kind==='runner'?.27:z.kind==='brute'?.12:.20,rush=horrorRush(z,dt,dist,p.range),step=Math.min(p.speed*1.7,p.speed*(1+surge*proximity)*rush)*dt,r=z.kind===",
 'speed surge and lunge cap');
exact("z.phase+=dt*(p.speed*4.8+(z.kind==='runner'?3.2:0));",
 "z.phase+=dt*(p.speed*4.8+(z.kind==='runner'?3.2:0))*(z.horrorRush>0?1.35:1);",
 'more aggressive gait');
exact("}z.attack-=dt;if(dist<=p.range&&z.attack<=0){",
 "}\nhorrorReact(z,dist);z.attack-=dt;if(dist<=p.range&&z.attack<=0){",
 'facial reaction each frame');
exact("if(dist<12&&Math.random()<dt*.08)audio.moan(z.kind==='brute');",
 "if(dist<14&&Math.random()<dt*.13)audio.snarl(z.kind,dist);",
 'groan close to player');
exact('const audio=new AudioSystem();',[
 "AudioSystem.prototype.snarl=function(kind,dist){",
 " if(!this.ctx||this.ctx.state!=='running')return;",
 " const now=performance.now();if(now-(this.lastSnarl||0)<1700)return;",
 " this.lastSnarl=now;",
 " const deep=kind==='brute'?54:kind==='runner'?96:72;",
 " this.tone(deep,dist<5?.047:.027,.33,'sawtooth');",
 " if(dist<5.5)this.tone(deep*.67,.023,.46,'triangle');",
 "};",
 "const audio=new AudioSystem();"
].join('\n'),'ominous procedural growls');
exact('z.hp=e.hp;z.max=e.max;z.serverTarget.set(e.x,0,e.z);z.remoteYaw=e.yaw;',
 'z.hp=e.hp;z.max=e.max;z.serverTarget.set(e.x,0,e.z);z.remoteYaw=e.yaw;z.coopRushing=!!e.rush;',
 'co-op lunge snapshot interpolation');
exact('z.phase+=dt*(z.profile.speed*4.8);',
 'z.phase+=dt*(z.profile.speed*4.8)*(z.coopRushing?1.35:1);',
 'co-op aggressive gait');
exact('function frame(){',ui+'\nfunction frame(){','subtle threat vignette');
exact(' updateFX(dt);fpsTime+=dt;',' horrorThreatFrame(dt);updateFX(dt);fpsTime+=dt;','threat proximity scan');
fs.writeFileSync(file,game);
cp.execFileSync(process.execPath,['--check',file]);
console.log('NIGHTMARE_INFECTED_READY',JSON.stringify({speed:{walker:2.25,runner:4.9,brute:1.55},rushDuration:.58,capMultiplier:1.7,maxRushRunner:8.33,extraGeometryOnlyAboveLow:true,spatialThreatUI:true,synthAudio:true,coopSnapshotRush:true,baseWavesPreserved:194}));
