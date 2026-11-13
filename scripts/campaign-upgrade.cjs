'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),file=path.join(root,'dist/game.js');let js=fs.readFileSync(file,'utf8');
const shared=fs.readFileSync(path.join(root,'shared/campaign.mjs'),'utf8').replace(/^export /gm,'');
const client=fs.readFileSync(path.join(root,'client/campaign.js'),'utf8');
const marker='function frame(){';if(js.split(marker).length!==2)throw Error('campaign insertion point mismatch');
js=js.replace(marker,shared+'\n'+client+'\n'+marker);
fs.writeFileSync(file,js);cp.execFileSync(process.execPath,['--check',file]);
console.log('CAMPAIGN: connected 340m route / 3 stages / shared server collision and progression.');
