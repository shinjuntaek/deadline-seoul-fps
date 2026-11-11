/**
 * Build-time health check for color-keyed BBANANA assets.
 * Counts nontransparent pixels and bounding boxes after green removal.
 * The generated JSON helps diagnose missing-looking character sprites.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const dist=path.resolve(__dirname,'..','dist');
(async()=>{
 const result={};
 for(const name of ['stalker','runner','brute']){
  const file=path.join(dist,'assets',name+'.webp');
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let solid=0,partial=0,clear=0,minX=info.width,minY=info.height,maxX=0,maxY=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   const a=data[(y*info.width+x)*4+3];
   if(a>160){solid++;if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y}
   else if(a>0)partial++;else clear++;
  }
  const frac=solid/(info.width*info.height);
  result[name]={width:info.width,height:info.height,solidPercent:+(100*frac).toFixed(1),
    bbox:solid?[minX,minY,maxX,maxY]:null,partialPercent:+(100*partial/(info.width*info.height)).toFixed(1)};
  if(frac<.04||frac>.92)throw Error('Suspicious chroma key transparency: '+name+' '+JSON.stringify(result[name]));
 }
 fs.writeFileSync(path.join(dist,'zombie-art-audit.json'),JSON.stringify(result,null,2)+'\n');
 console.log('ZOMBIE_ART_ALPHA_AUDIT',JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});
