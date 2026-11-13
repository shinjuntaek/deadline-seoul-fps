export function angleDelta(a,b){return Math.atan2(Math.sin(b-a),Math.cos(b-a))}
export function sampleMotion(samples,at,maxSpeed=9){
 if(!samples.length)return null;
 if(at<=samples[0].at)return {...samples[0]};
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i];
  if(at<=b.at){const t=Math.max(0,Math.min(1,(at-a.at)/Math.max(1,b.at-a.at)));
   return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:a.yaw+angleDelta(a.yaw,b.yaw)*t};
  }
 }
 const b=samples.at(-1),a=samples.at(-2);if(!a)return {...b};
 const extra=Math.max(0,Math.min(80,at-b.at))/1000,dt=Math.max(.001,(b.at-a.at)/1000);
 let vx=(b.x-a.x)/dt,vz=(b.z-a.z)/dt;
 const speed=Math.hypot(vx,vz);if(speed>maxSpeed){vx*=maxSpeed/speed;vz*=maxSpeed/speed}
 return {x:b.x+vx*extra,z:b.z+vz*extra,yaw:b.yaw};
}
export function appendMotion(samples,value){
 if(samples.length&&value.at<=samples.at(-1).at)return;
 samples.push(value);if(samples.length>8)samples.shift();
}
