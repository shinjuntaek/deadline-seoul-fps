/* Execute the actual built result transition, including a server end while paused. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const js=fs.readFileSync('dist/game.js','utf8');
const from=js.indexOf('function finish(win)'),to=js.indexOf('\n\nfunction updateHUD',from);
assert(from>=0&&to>from,'Built finish function is present');
const fn=js.slice(from,to);
function run(phase,active,ended,win){
 const shown=[],hidden=[],dom=new Proxy({},{get:(o,k)=>o[k]||(o[k]={classList:{add(){hidden.push(k)},remove(){shown.push(k)}}})});
 const context={dom,phase,coop:{active,ended},stats:{score:0,kills:0,headshots:0,shots:0},document:{pointerLockElement:null},localStorage:{getItem:()=>0,setItem(){}},setTimeout:f=>f(),SCORE:{extract:1}};
 vm.runInNewContext(fn+';finish('+win+')',context);
 return{phase:context.phase,shown,hidden};
}
for(const win of [false,true]){
 const result=run('paused',true,true,win);
 assert.equal(result.phase,win?'victory':'gameover');
 assert(result.shown.includes('result'));assert(result.hidden.includes('pause'));
}
assert.equal(run('paused',false,false,false).phase,'paused','Single-player pause must stay paused');
assert(!run('gameover',true,true,false).shown.includes('result'),'Repeated end must not restart the result transition');
console.log('CLIENT_RESULT_STATE_QA_PASS 4 cases');
