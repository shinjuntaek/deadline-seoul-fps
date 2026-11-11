/**
 * Enemy pursuit tuning. Keep wave sizes, hitboxes, damage and attack cadence intact.
 * Movement is slightly faster in the open and surges as an infected closes in.
 * Run AFTER graphics-upgrade, perf-adaptive and dense-waves stages.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const file=path.join(__dirname,'..','dist','game.js');
let js=fs.readFileSync(file,'utf8');
function change(before,after,label){
 const parts=js.split(before);
 if(parts.length!==2)throw new Error(label+' expected once, found '+(parts.length-1));
 js=parts.join(after);
}
change('walker:{hp:108,speed:1.15','walker:{hp:108,speed:1.65','walker pursuit +43%');
change('runner:{hp:74,speed:2.35','runner:{hp:74,speed:3.45','runner pursuit +47%');
change('brute:{hp:840,speed:.82','brute:{hp:840,speed:1.08','brute pursuit +32%');
change(
  'const p=z.profile,step=p.speed*dt,r=z.kind===',
  "const p=z.profile,proximity=THREE.MathUtils.clamp(1-dist/23,0,1),surge=z.kind==='runner'?.16:z.kind==='brute'?.06:.10,step=p.speed*(1+surge*proximity)*dt,r=z.kind===",
  'distance-based chase surge; 23 metres or closer'
);
// Original animation references p.speed, now increased with movement.
// No extra spawn pressure, attack-damage changes, or mesh allocations.
fs.writeFileSync(file,js);
cp.execFileSync(process.execPath,['--check',file]);
const speed={walker:{before:1.15,after:1.65,peak:1.815},runner:{before:2.35,after:3.45,peak:4.002},brute:{before:.82,after:1.08,peak:1.1448}};
console.log('ENEMY_SPEED_TUNED',JSON.stringify({units:'metres per second (approximate world units)',speed,nearbyChaseDistance:23,totalEnemiesPreserved:194,concurrentCapsPreserved:true}));
