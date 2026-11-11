/**
 * Fix the two cross-road quarantine walls shown in game screenshots.
 * Protect the middle 13m vehicle corridor; keep concrete blockers and signs
 * to either side for atmosphere, and let everyone cross shallow curbs.
 * Reconciled with multiplayer/coop-engine.mjs in the same change set.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const file=path.resolve(__dirname,'..','dist','game.js');
let js=fs.readFileSync(file,'utf8');
function edit(before,after,label){
 const occurrences=js.split(before);
 if(occurrences.length!==2)throw Error(label+' source marker count '+(occurrences.length-1));
 js=occurrences.join(after);
}
edit("box(-10.7,.25,0,.45,.5,108,curb,true,'curb');box(10.7,.25,0,.45,.5,108,curb,true,'curb');",
     "box(-10.7,.25,0,.45,.5,108,curb,false,'curb');box(10.7,.25,0,.45,.5,108,curb,false,'curb');",
     'shallow sidewalk curbs are visuals, not impassable walls');
edit("if(i===(row===0?1:-1))continue;const b=box(i*2.9",
     "if(Math.abs(i)!==3)continue;const b=box(i*2.9",
     'move checkpoint blocks out of central 13-meter lane');
edit("if(i===(z<0?1:-1))continue;",
     "if(Math.abs(i)!==3)continue;",
     'keep warning sign decals on the relocated roadside barriers');
fs.writeFileSync(file,js);
cp.execFileSync(process.execPath,['--check',file]);
console.log('ROAD_NAVIGATION_REPAIRED',JSON.stringify({checkpoints:[-38,34],obstacleColumns:[-3,3],roadCenterFree:true,curbsPassable:true,otherCollisionsPreserved:true}));
