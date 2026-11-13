const perfLog={samples:[],contextLosses:0,frames:[],start:performance.now(),last:performance.now(),contextLost:false};
window.__DEADLINE_PERFORMANCE__=()=>({build:'stability-visuals-20261113',gpu:gpuRendererName,softwareGPU,quality,
 dimensions:{width:dom.game.width,height:dom.game.height},contextLosses:perfLog.contextLosses,
 memoryKind:'JS heap when supported; renderer counts are not GPU bytes',samples:perfLog.samples.slice()});
function capturePerformance(rawDt){
 const now=performance.now();perfLog.frames.push(rawDt*1000);if(perfLog.frames.length>300)perfLog.frames.shift();
 if(now-perfLog.last<1000)return;
 const frames=perfLog.frames.slice().sort((a,b)=>a-b),span=now-perfLog.last;
 perfLog.samples.push({at:Math.round(now-perfLog.start),phase,wave:stats.wave,fps:+(perfLog.frames.length*1000/span).toFixed(1),
 p95FrameMs:+(frames[Math.floor((frames.length-1)*.95)]||0).toFixed(2),heapBytes:performance.memory?.usedJSHeapSize||null,
 geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,drawCalls:renderer.info.render.calls,
 triangles:renderer.info.render.triangles,enemies:enemies.length,ws:coop.ws?.readyState??null,wsAgeMs:Math.round(now-coop.lastSeen),rtt:coop.ping});
 if(perfLog.samples.length>180)perfLog.samples.shift();perfLog.frames.length=0;perfLog.last=now;
}
dom.game.addEventListener('webglcontextlost',event=>{
 event.preventDefault();perfLog.contextLost=true;perfLog.contextLosses++;fireHeld=false;
 if(phase==='playing')pauseGame();showCenter('그래픽 장치 연결이 끊겼습니다. 복구를 기다리는 중…',10);
});
dom.game.addEventListener('webglcontextrestored',()=>{
 perfLog.contextLost=false;clock.getDelta();showCenter('그래픽 복구 완료 · 계속하기를 눌러 주세요.',8);
});
