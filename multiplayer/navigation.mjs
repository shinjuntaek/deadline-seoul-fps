// Shared, deterministic walkable-space definition for authoritative simulation.
export const SPAWN_POINTS=Object.freeze([[-8,-48],[8,-48],[-18,-43],[18,-43],[-20,-28],[20,-28],[-20,0],[20,0],[-20,27],[20,27],[-18,48],[18,48],[-4,48],[5,48]]);
export const obstacleAABBs=[
 ...[[-31,-36,19,18],[-31,-11,20,20],[-31,16,19,23],[-32,43,22,18],[31,-40,18,17],[31,-17,20,18],[31,10,19,24],[32,39,22,18]].map(([x,z,w,d])=>({x,z,w,d})),
 ...[[-5.8,-26],[5.8,-18],[-5.5,10],[5.9,27],[-16.2,-6],[16.5,-33],[-16.4,42]].map(([x,z])=>({x,z,w:4.05,d:2})),
 ...[-38,34].flatMap(z=>[-3,3].map(i=>({x:i*2.9,z,w:2.6,d:.7}))),
 {x:-14.9,z:-45,w:2.85,d:8.25},
 {x:-15.5,z:-23,w:8,d:8},{x:15.5,z:21,w:8,d:9},
];
export function obstructed(x,z,r=.36){
 if(Math.abs(x)>51-r||Math.abs(z)>51-r)return true;
 if(Math.abs(x)>26&&Math.abs(z)<50)return true;
 return obstacleAABBs.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);
}
export function clearSegment(a,b,r){
 const d=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(d/.4));
 for(let i=1;i<=steps;i++)if(obstructed(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,r))return false;
 return true;
}
// Grid search only when a direct pursuit is obstructed. Small fixed arena, no
// unbounded per-frame allocations; the caller retains waypoints until reached.
export function findPath(start,target,r){
 const key=(x,z)=>`${x},${z}`;
 const sx=Math.round(start.x),sz=Math.round(start.z),tx=Math.round(target.x),tz=Math.round(target.z);
 const nodes=[{x:sx,z:sz,parent:-1}],visited=new Set([key(sx,sz)]);
 let end=-1;
 for(let at=0;at<nodes.length&&at<5500;at++){
  const n=nodes[at];
  if(Math.hypot(n.x-tx,n.z-tz)<=1.5&&clearSegment(n,target,r)){end=at;break}
  for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]]){
   const x=n.x+dx,z=n.z+dz,k=key(x,z);
   if(Math.abs(x)>25||Math.abs(z)>49||visited.has(k)||obstructed(x,z,r))continue;
   if(!clearSegment(n,{x,z},r))continue;
   visited.add(k);nodes.push({x,z,parent:at});
  }
 }
 if(end<0)return [];
 const result=[{x:target.x,z:target.z}];
 while(end>=0){const n=nodes[end];result.push({x:n.x,z:n.z});end=n.parent}
 result.reverse();
 // Remove the rounded origin only if the next segment is traversable.
 if(result.length>1&&clearSegment(start,result[1],r))result.shift();
 return result;
}
