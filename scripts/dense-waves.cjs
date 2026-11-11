/**
 * Higher-density escalating infection waves with an adaptive concurrent-alive cap.
 * Total wave counts are intentionally much larger than the original;
 * only a safe number of enemies are spawned simultaneously.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const file=path.join(__dirname,'..','dist','game.js');
let js=fs.readFileSync(file,'utf8');
function replaceOnce(before,after,name){
 const segments=js.split(before);
 if(segments.length!==2)throw new Error(name+' marker count '+(segments.length-1));
 js=segments.join(after);
}
const oldWaves=[
" {walkers:7,runners:0,brutes:0,interval:.72,label:'초기 감염체'},",
" {walkers:8,runners:3,brutes:0,interval:.62,label:'러너 출현'},",
" {walkers:10,runners:5,brutes:0,interval:.52,label:'대규모 접근'},",
" {walkers:12,runners:7,brutes:1,interval:.44,label:'브루트 출현'},",
" {walkers:14,runners:9,brutes:1,interval:.38,label:'최종 봉쇄선'}"
].join('\n');
const newWaves=[
" {walkers:14,runners:0,brutes:0,interval:.62,label:'초기 감염체'},",
" {walkers:17,runners:7,brutes:0,interval:.54,label:'러너 출현'},",
" {walkers:23,runners:13,brutes:0,interval:.46,label:'대규모 접근'},",
" {walkers:31,runners:18,brutes:1,interval:.40,label:'브루트 출현'},",
" {walkers:40,runners:28,brutes:2,interval:.34,label:'최종 봉쇄선'}"
].join('\n');
replaceOnce(oldWaves,newWaves,'increase five-wave counts');
const oldDirector="function director(dt){if(waveIndex<0)return;if(spawnQueue.length){spawnCooldown-=dt;if(spawnCooldown<=0){spawnEnemy(spawnQueue.shift());spawnCooldown=waves[waveIndex].interval}return}";
const newDirector=[
"function director(dt){if(waveIndex<0)return;if(spawnQueue.length){",
" const maxAlive=ultraLow?7:quality==='low'?11:quality==='medium'?17:24;",
" const live=enemies.reduce((n,z)=>n+(!z.dead?1:0),0);",
" // Keep queued enemies for later spawn instead of deleting them on low-end devices.",
" if(live>=maxAlive)return;",
" spawnCooldown-=dt;",
" if(spawnCooldown<=0){",
"  spawnEnemy(spawnQueue.shift());",
"  spawnCooldown=waves[waveIndex].interval;",
" }",
" return",
"}"
].join('\n');
replaceOnce(oldDirector,newDirector,'adaptive active-zombie cap');
fs.writeFileSync(file,js);
cp.execFileSync(process.execPath,['--check',file]);
console.log('DENSE_WAVES_READY',JSON.stringify({counts:[14,24,36,50,70],total:194,previousTotal:77,concurrentCaps:{software:7,low:11,medium:17,high:24},bosses:[0,0,0,1,2]}));
