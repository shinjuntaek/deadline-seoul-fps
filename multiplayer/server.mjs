/**
 * Persistent single-replica Node WebSocket service for the multiplayer MVP.
 *
 * Designed for Railway/Render (one instance): a dedicated long-lived server,
 * unlike per-invocation Vercel Function instances. Room state currently lives
 * in process memory. Restarts reset live rooms; configure session persistence
 * before promising durable multi-region high-availability.
 *
 * Deployment variables:
 *   PORT               (injected by host)
 *   COOP_ALLOWED_ORIGINS=https://<game-domain>[,https://<preview-domain>]
 */
import server from '../api/multiplayer.js';
const port=Number(process.env.PORT||8080);
const host='0.0.0.0';
server.listen(port,host,()=>{
 console.log(JSON.stringify({event:'DEADLINE_MULTIPLAYER_READY',port,
  maxPlayersPerRoom:4,durable:false,topology:'one Node process'}));
});
function shutdown(signal){
 console.log('COOP_SERVER_SHUTDOWN',signal);
 server.close(()=>process.exit(0));
 setTimeout(()=>process.exit(1),12000).unref();
}
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
