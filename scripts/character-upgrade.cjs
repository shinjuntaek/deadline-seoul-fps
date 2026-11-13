'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'dist/game.js');let js=fs.readFileSync(file,'utf8');
function edit(a,b){if(js.split(a).length!==2)throw Error('Character marker: '+a.slice(0,80));js=js.replace(a,b)}
for(const [from,to] of [['loaders/GLTFLoader.js','GLTFLoader.js'],['utils/SkeletonUtils.js','SkeletonUtils.js'],['utils/BufferGeometryUtils.js','BufferGeometryUtils.js']]){
 let source=fs.readFileSync(path.join(root,'node_modules/three/examples/jsm',from),'utf8').replaceAll("from 'three'","from './three.module.js'").replace("from '../utils/BufferGeometryUtils.js'","from './BufferGeometryUtils.js'");
 fs.writeFileSync(path.join(root,'dist/vendor',to),source);
}
fs.cpSync(path.join(root,'assets/models'),path.join(root,'dist/assets/models'),{recursive:true});
for(const f of fs.readdirSync(path.join(root,'assets/models')))if(f.endsWith('.glb.gz')){
 fs.writeFileSync(path.join(root,'dist/assets/models',f.slice(0,-3)),require('node:zlib').gunzipSync(fs.readFileSync(path.join(root,'assets/models',f))));
 fs.rmSync(path.join(root,'dist/assets/models',f));
}
edit('let idleFrameAt=0;',fs.readFileSync(path.join(root,'client/characters.js'),'utf8')+'\nlet idleFrameAt=0;');
for(const part of ['la','lh','ra','rh'])edit('model.add('+part+')','model.add('+part+');'+part+'.userData.legacyArm=true');
edit('let idleFrameAt=0;',fs.readFileSync(path.join(root,'client/viewmodel.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'client/playtest.js'),'utf8')+'\nlet idleFrameAt=0;');
edit('visualFrame(dt);renderer.render(scene,camera);','visualFrame(dt);humanFrame(dt);viewmodelFrame(dt);renderer.render(scene,camera);');
edit('z.hp=e.hp;z.max=e.max;', 'if(e.hp<z.hp)z.hitReact=.3;z.hp=e.hp;z.max=e.max;');
fs.writeFileSync(file,js);console.log('SKINNED_INFECTED_READY');
