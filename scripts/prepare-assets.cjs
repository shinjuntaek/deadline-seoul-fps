/**
 * Convert previously-generated BBANANA game art into local, optimized WebP.
 * Character backgrounds were generated on pure green and are keyed to alpha.
 * No new paid image generation takes place in this build.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets','bbanana-manifest.json'),'utf8'));
const dest=path.join(root,'dist','assets');
fs.mkdirSync(dest,{recursive:true});
const characterKeys=new Set(['runner','brute','stalker']);

async function processAsset(name,asset){
  const url=asset.url;
  if(!/^https:\/\/uyncfjzfumputmyodmlr\.supabase\.co\/storage\/v1\/object\/public\//.test(url))
    throw new Error('Unexpected asset origin for '+name);
  const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error('BBANANA asset '+name+' failed HTTP '+response.status);
  const source=Buffer.from(await response.arrayBuffer());
  if(source.length<1000||source.length>25_000_000)throw new Error('Unexpected asset bytes '+name+'='+source.length);
  let output;
  if(characterKeys.has(name)){
    const {data,info}=await sharp(source).rotate().resize({width:768,withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let i=0;i<data.length;i+=4){
      const r=data[i],g=data[i+1],b=data[i+2];
      const rb=Math.max(r,b);
      const key=g-rb;
      if(g>115&&key>=45){data[i+3]=0;data[i]=0;data[i+1]=0;data[i+2]=0;}
      else if(g>105&&key>12){
        data[i+3]=Math.round(data[i+3]*Math.max(0,(45-key)/33));
        data[i+1]=Math.min(g,rb+16);
      }
    }
    output=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}})
      .webp({quality:84,alphaQuality:96,effort:4}).toBuffer();
  }else{
    const maxWidth=name==='hero'?1600:1024;
    output=await sharp(source).rotate().resize({width:maxWidth,withoutEnlargement:true})
      .webp({quality:82,effort:4}).toBuffer();
  }
  if(output.length<1000)throw new Error('Invalid converted WebP '+name);
  fs.writeFileSync(path.join(dest,name+'.webp'),output);
  return {name,sourceBytes:source.length,webpBytes:output.length};
}
(async()=>{
  const results=[];
  for(const [name,asset] of Object.entries(manifest.assets)) results.push(await processAsset(name,asset));
  console.log('BBANANA_ASSETS_READY',JSON.stringify(results));
})().catch(err=>{console.error('BBANANA_ASSET_FAILURE',err.stack||String(err));process.exitCode=1});
