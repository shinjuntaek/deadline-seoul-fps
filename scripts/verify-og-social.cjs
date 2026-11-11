/**
 * Release-blocking Open Graph audit of build output.
 * Tests the HTML and bytes social previews fetch, not DOM after JavaScript.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const dist=path.resolve(__dirname,'..','dist');
const canonical='https://deadline-seoul-play-shinjuntaek1207-1041.vercel.app/';
const image=canonical+'og-image-share-v2.jpg';
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const head=html.split('</head>')[0];
assert(head.length>200&&head.includes('<head>'),'OG tags must be present in initial HTML');
function meta(name,type='property'){
 const expr=new RegExp('<meta\\s+'+type+'="'+name+'"\\s+content="([^"]*)"\\s*>','g');
 const matches=[...head.matchAll(expr)];
 assert.equal(matches.length,1,name+' must appear exactly once in initial HTML');
 return matches[0][1];
}
(async()=>{
 assert.equal(meta('og:type'),'website');
 assert.equal(meta('og:url'),canonical);
 assert.equal(meta('og:image'),image);
 assert.equal(meta('og:image:secure_url'),image);
 assert.equal(meta('og:image:type'),'image/jpeg');
 assert.equal(meta('og:image:width'),'1200');
 assert.equal(meta('og:image:height'),'630');
 assert.equal(meta('twitter:card','name'),'summary_large_image');
 assert.equal(meta('twitter:image','name'),image);
 assert.equal(meta('twitter:url','name'),canonical);
 assert(meta('og:title').includes('DEADLINE'));
 assert(meta('og:description').includes('좀비 FPS'));
 assert.equal((head.match(/<link rel="canonical"[^>]+>/g)||[]).length,1);
 assert(head.includes('<link rel="canonical" href="'+canonical+'">'));
 assert(!head.includes('content="/og-image.jpg"'),'No relative OG URLs');
 assert(!/<meta[^>]+content="https:\/\/deadline-seoul-(?!play-)/.test(head),'Protected preview URL in social asset');
 const filename=image.split('/').at(-1);
 const p=path.join(dist,filename);
 const bytes=fs.readFileSync(p);
 assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);
 assert(bytes.length>=10000&&bytes.length<=1048576,'OG JPEG between 10KB and 1MB');
 const m=await sharp(bytes).metadata();
 assert.equal(m.format,'jpeg');assert.equal(m.width,1200);assert.equal(m.height,630);
 const robots=fs.readFileSync(path.join(dist,'robots.txt'),'utf8');
 assert(robots.includes('Allow: /'),'Image must be crawlable');
 const report={status:'PASS',canonical,ogImage:image,bytes:bytes.length,width:m.width,height:m.height,
  initialHtml:true,uniqueMeta:true,socialCrawlableByDesign:true,checkedAt:new Date().toISOString()};
 fs.writeFileSync(path.join(dist,'og-social-qa.json'),JSON.stringify(report,null,2)+'\n');
 console.log('SOCIAL_OG_QA_PASS',JSON.stringify(report));
})().catch(err=>{console.error('SOCIAL_OG_QA_FAIL',err);process.exitCode=1});
