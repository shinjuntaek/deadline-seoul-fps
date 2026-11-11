/**
 * Build a dedicated 1200x630 Open Graph JPEG from the existing licensed
 * BBANANA Seoul key art. The share card is generated locally in the Vercel
 * build; no runtime API dependency or additional generation credits.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const assert=require('node:assert/strict');

const dist=path.resolve(__dirname,'..','dist');
const photo=path.join(dist,'assets','hero.webp');
const htmlPath=path.join(dist,'index.html');
const output=path.join(dist,'og-image.jpg');
const shareFilename='og-image-share-v2.jpg';
const shareOutput=path.join(dist,shareFilename);
// Stable alias has an explicit public protection override; deployment previews do not.
const gameOrigin='https://deadline-seoul-play-shinjuntaek1207-1041.vercel.app';
const canonicalURL=gameOrigin+'/';
const shareImageURL=gameOrigin+'/'+shareFilename;
if(!fs.existsSync(photo))throw new Error('Missing locally optimized Seoul key art');
const svg=String.raw`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
 <defs>
  <linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">
   <stop offset="0" stop-color="#03090e" stop-opacity=".36"/>
   <stop offset=".36" stop-color="#030709" stop-opacity=".10"/>
   <stop offset=".75" stop-color="#060609" stop-opacity=".74"/>
   <stop offset="1" stop-color="#030408" stop-opacity=".97"/>
  </linearGradient>
  <linearGradient id="red" x1="0" x2="1">
   <stop offset="0" stop-color="#f14b43"/>
   <stop offset="1" stop-color="#b3181e"/>
  </linearGradient>
 </defs>
 <rect width="1200" height="630" fill="url(#dark)"/>
 <path d="M68 87 H244" stroke="#ff4d44" stroke-width="6" stroke-linecap="square"/>
 <text x="68" y="120" font-family="DejaVu Sans,Arial,sans-serif" font-weight="700" font-size="23" letter-spacing="4" fill="#f9b8ad">SEOUL QUARANTINE ZONE</text>
 <text x="69" y="440" font-family="DejaVu Sans,Arial,sans-serif" font-weight="900" font-size="99" letter-spacing="-5" fill="#f3f1ec" stroke="#11151a" stroke-width="2.5" paint-order="stroke">DEADLINE:</text>
 <text x="70" y="548" font-family="DejaVu Sans,Arial,sans-serif" font-weight="900" font-size="121" letter-spacing="-7" fill="url(#red)" stroke="#121212" stroke-width="2.5" paint-order="stroke">SEOUL</text>
 <path d="M70 574 H1130" stroke="#c3a2a2" opacity=".38" stroke-width="2"/>
 <text x="72" y="605" font-family="DejaVu Sans,Arial,sans-serif" font-weight="700" font-size="20" letter-spacing="4" fill="#dadfdd">ZOMBIE SURVIVAL FPS  /  5 WAVES  /  ONE LAST ESCAPE</text>
 <rect x="1050" y="52" width="80" height="34" fill="#711b1a" fill-opacity=".85" rx="2"/>
 <text x="1063" y="75" font-family="DejaVu Sans,Arial,sans-serif" font-size="16" font-weight="700" fill="#fff">FPS</text>
</svg>`;

const ogTitle='데드라인: 서울 | DEADLINE: SEOUL';
const ogDesc='서울 격리구역에서 살아남아라. 설치 없이 즐기는 시네마틱 3D 좀비 FPS · 5개 웨이브 생존';
(async()=>{
 const jpeg=await sharp(photo)
  .resize(1200,630,{fit:'cover',position:sharp.strategy.attention})
  .composite([{input:Buffer.from(svg),left:0,top:0}])
  .jpeg({quality:88,mozjpeg:true,progressive:true})
  .toBuffer();
 fs.writeFileSync(output,jpeg);
 fs.writeFileSync(shareOutput,jpeg);
 const m=await sharp(jpeg).metadata();
 assert.equal(m.width,1200);assert.equal(m.height,630);
 assert(jpeg.length<1000000,'OG image size exceeds 1MB budget');
 let html=fs.readFileSync(htmlPath,'utf8');
 if(!/<meta property="og:image" content="[^"]*">/.test(html)){
  throw new Error('Missing og:image in extracted source HTML');
 }
 // Bots inspect the original server HTML, not JavaScript-created metadata.
 // Strip the archived placeholder tags before inserting a single canonical set.
 html=html.replace(/^[ \t]*<meta[ \t]+(?:property="og:[^"]+"|name="twitter:[^"]+")[^\n]*\r?\n/gm,'');
 html=html.replace(/^[ \t]*<link[^\n]*rel="canonical"[^\n]*\r?\n/gm,'');
 html=html.replace(/<meta name="description" content="[^"]*">/,
  '<meta name="description" content="'+ogDesc+'">');
 const socialMeta=[
  '<link rel="canonical" href="'+canonicalURL+'">',
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="DEADLINE: SEOUL">',
  '<meta property="og:locale" content="ko_KR">',
  '<meta property="og:url" content="'+canonicalURL+'">',
  '<meta property="og:title" content="'+ogTitle+'">',
  '<meta property="og:description" content="'+ogDesc+'">',
  '<meta property="og:image" content="'+shareImageURL+'">',
  '<meta property="og:image:secure_url" content="'+shareImageURL+'">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:type" content="image/jpeg">',
  '<meta property="og:image:alt" content="데드라인 서울 — 좀비 FPS 게임 포스터">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:url" content="'+canonicalURL+'">',
  '<meta name="twitter:title" content="'+ogTitle+'">',
  '<meta name="twitter:description" content="'+ogDesc+'">',
  '<meta name="twitter:image" content="'+shareImageURL+'">',
  '<meta name="twitter:image:alt" content="데드라인 서울 — 좀비 FPS 게임 포스터">'
 ];
 const anchor='  <link rel="manifest" href="/manifest.webmanifest">';
 if(!html.includes(anchor))throw Error('Missing HTML head metadata insertion anchor');
 html=html.replace(anchor,socialMeta.map(tag=>'  '+tag).join('\n')+'\n'+anchor);
 if(!html.includes('content="'+shareImageURL+'"'))throw Error('Failed to emit absolute public OG image');
 if(html.includes('content="/og-image.jpg"'))throw Error('Relative OG image URL survived rewriting');
 fs.writeFileSync(htmlPath,html);
 fs.writeFileSync(path.join(dist,'og-image-report.json'),JSON.stringify({
  source:'Existing BBANANA Seoul concept art, local sharp composition',
  filename:shareFilename,width:m.width,height:m.height,
  bytes:jpeg.length,format:m.format,ogImage:shareImageURL,ogUrl:canonicalURL,
  ogTitle,ogDesc,uploadedToExternalStorage:false,publicAlias:true
 },null,2)+'\n');
 console.log('OG_IMAGE_READY',JSON.stringify({dimensions:'1200x630',bytes:jpeg.length,metaURL:shareImageURL,ogUrl:canonicalURL,htmlUpdated:true}));
})().catch(err=>{console.error(err);process.exitCode=1});
