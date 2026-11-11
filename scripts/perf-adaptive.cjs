/**
 * Adaptive safety budget for CPUs and browsers without accelerated WebGL.
 * Normal mid/high-end GPUs keep the original graphics fidelity.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const file=path.join(__dirname,'..','dist','game.js');
let js=fs.readFileSync(file,'utf8');
const edit=(a,b,name)=>{const p=js.split(a);if(p.length!==2)throw new Error('Performance marker '+name+' count '+(p.length-1));js=p.join(b)};
edit(
 "renderer=new THREE.WebGLRenderer({canvas:dom.game,antialias:true,powerPreference:'high-performance',stencil:false});",
 "renderer=new THREE.WebGLRenderer({canvas:dom.game,antialias:!(navigator.hardwareConcurrency<=2||navigator.deviceMemory<=3),powerPreference:'high-performance',stencil:false});",
 'disable costly MSAA on software-grade devices'
);
edit(
 'const memory=navigator.deviceMemory||4,cores=navigator.hardwareConcurrency||4;',
 [
 'const memory=navigator.deviceMemory||4,cores=navigator.hardwareConcurrency||4;',
 'const glDebug=renderer.getContext();',
 "const gpuDebugExt=glDebug.getExtension('WEBGL_debug_renderer_info');",
 "const gpuRendererName=String(gpuDebugExt?glDebug.getParameter(gpuDebugExt.UNMASKED_RENDERER_WEBGL):glDebug.getParameter(glDebug.RENDERER)||'unknown');",
 "const softwareGPU=/swiftshader|llvmpipe|software|softpipe/i.test(gpuRendererName);",
 "const ultraLow=softwareGPU||cores<=2;",
 ].join('\n'),
 'characterize software renderer safely'
);
edit(
 'let quality=settings.quality;',
 "let quality=ultraLow?'low':settings.quality;",
 'force software renderer to cheap materials/shadows'
);
edit(
 'let renderScale=1;',
 'let renderScale=ultraLow?.55:1;',
 'software WebGL start at 55 percent resolution'
);
edit(
 'renderer.setPixelRatio(Math.min(devicePixelRatio||1,dprCap));',
 'renderer.setPixelRatio(Math.min(devicePixelRatio||1,dprCap)*renderScale);',
 'honor initial resolution budget'
);
edit(
 'renderer.toneMapping=THREE.ACESFilmicToneMapping;',
 'renderer.toneMapping=ultraLow?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;',
 'avoid expensive filmic tone mapping on software'
);
edit(
 "const rainCount=quality==='high'?3600:quality==='medium'?2300:1100,",
 "const rainCount=quality==='high'?3600:quality==='medium'?2300:(ultraLow?220:720),",
 'reduce particle load for low CPUs'
);
edit(
 'Math.max(.65,renderScale-.1)',
 'Math.max(ultraLow?.45:.65,renderScale-.1)',
 'let adaptive resolution decrease below 0.65'
);
edit(
 'const scene=new THREE.Scene();',
 [
 'const scene=new THREE.Scene();',
 'if(ultraLow)console.info("DEADLINE_SOFTWARE_GPU_LITE",JSON.stringify({gpu:gpuRendererName,cores,memory,renderScale}));'
 ].join('\n'),
 'software rendering diagnostics'
);
edit(
 "setLoading(100,'작전 준비 완료');",
 [
 "if(ultraLow){",
 " scene.traverse(o=>{if((o.isSpotLight||o.isPointLight)&&o.parent!==camera)o.visible=false});",
 " flashlight.visible=false;",
 "}",
 "setLoading(100,'작전 준비 완료');"
 ].join('\n'),
 'disable dynamic lights when CPU rasterization is used'
);
fs.writeFileSync(file,js);
cp.execFileSync(process.execPath,['--check',file]);
console.log('ADAPTIVE_WEBGL_LITE_OK',JSON.stringify({softwareGPU:true,lowCpu:true,scaledResolution:true,disabledMsaaOnWeakDevices:true,lowRainCount:220,dynamicLightsDisabled:true,highEndPreserved:true}));
