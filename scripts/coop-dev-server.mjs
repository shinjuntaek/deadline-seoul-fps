/**
 * Local integration server: real WebSocket Vercel adapter and static dist assets
 * share one origin, so Playwright exercises the same /api/multiplayer URL.
 *
 * Only used in CI and developer environments, not as a production backend.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import server from '../api/multiplayer.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8',
 '.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml',
 '.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'};
const apiHandler=server.listeners('request')[0];
server.removeAllListeners('request');
server.on('request',(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 if(u.pathname==='/api/multiplayer')return apiHandler(req,res);
 const uri=u.pathname==='/'?'/index.html':u.pathname;
 const file=path.resolve(dist,'.'+decodeURIComponent(uri));
 if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end('Forbidden');return}
 fs.stat(file,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404);res.end('Not Found');return}
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream',
   'cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
 });
});
const port=Number(process.env.PORT||4173);
server.listen(port,'127.0.0.1',()=>console.log('DEADLINE_COOP_DEV_SERVER_READY http://127.0.0.1:'+port));
