'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'dist/game.js');let js=fs.readFileSync(file,'utf8');
function edit(a,b){if(js.split(a).length!==2)throw Error('Visual marker: '+a.slice(0,100));js=js.replace(a,b)}
fs.cpSync(path.join(root,'assets/materials'),path.join(root,'dist/assets/materials'),{recursive:true});
edit("const ultraLow=softwareGPU||cores<=2;","const visualQA=new URLSearchParams(location.search).get('qa')==='visual'&&['127.0.0.1','localhost'].includes(location.hostname);\nconst ultraLow=!visualQA&&(softwareGPU||cores<=2);");
edit("let quality=ultraLow?'low':settings.quality;","let quality=visualQA?'medium':ultraLow?'low':settings.quality;");
edit('function frame(){',fs.readFileSync(path.join(root,'client/visuals.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'client/diagnostics.js'),'utf8')+'\nlet idleFrameAt=0;\nfunction frame(){');
edit('const rawDt=clock.getDelta(),dt=Math.min(rawDt,.05);',"const stamp=performance.now();\n if(perfLog.contextLost||document.hidden||(phase!=='playing'&&stamp-idleFrameAt<66)){clock.getDelta();requestAnimationFrame(frame);return}\n idleFrameAt=stamp;\n const rawDt=clock.getDelta(),dt=Math.min(rawDt,.05);");
edit('renderer.render(scene,camera);requestAnimationFrame(frame)', 'visualFrame(dt);renderer.render(scene,camera);capturePerformance(rawDt);requestAnimationFrame(frame)');
// Hidden hitboxes still raycast in Three.js; eliminate their raster + shadow draw submissions.
edit('if(!o.isMesh||!o.material)return;\n  for(const mat', 'if(!o.isMesh||!o.material)return;\n  o.visible=false;o.castShadow=false;\n  for(const mat');
edit('scene.add(group);return group;', 'improveSurvivor(group);scene.add(group);return group;');
edit('g.rotation.z=goal.downed?-1.0:0;', 'g.rotation.z=goal.downed?-1.0:0;animateSurvivor(g,dt);');
// The old spawn ring crossed solid city blocks. Keep jitter inside actual colliders.
edit('const spawnPoints=[[-8,-50],[8,-50],[-18,-43],[18,-43],[-48,-28],[48,-28],[-50,0],[50,0],[-49,27],[49,27],[-18,49],[18,49],[-4,50],[5,50]]', 'const spawnPoints=[[-8,-48],[8,-48],[-18,-43],[18,-43],[-20,-28],[20,-28],[-20,0],[20,0],[-20,27],[20,27],[-18,48],[18,48],[-4,48],[5,48]]');
edit('src.x+=(Math.random()-.5)*4;src.z+=(Math.random()-.5)*4;createEnemy(kind,src);',"const radius=kind==='brute'?.72:.42,origin=src.clone();\n for(let attempt=0;attempt<12;attempt++){src.set(origin.x+(Math.random()-.5)*2,0,origin.z+(Math.random()-.5)*2);if(!blocked(src.x,src.z,radius))break}\n if(blocked(src.x,src.z,radius))src.copy(origin);\n if(blocked(src.x,src.z,radius))return;createEnemy(kind,src);");
edit("yaw=Math.PI;pitch=0;camera.position.set(0,PLAYER.height,27);","yaw=0;pitch=0;camera.rotation.set(0,0,0,'YXZ');camera.position.set(0,PLAYER.height,27);");
fs.writeFileSync(file,js);console.log('SEOUL_CINEMATIC_MATERIALS_READY');

fs.appendFileSync(path.join(root,'dist/style.css'), '\n.coop-panel{align-items:flex-start}.coop-card{margin:auto;box-sizing:border-box;max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain}\n@media(max-width:600px){.coop-card{max-height:calc(100dvh - 18px)}}\n');
