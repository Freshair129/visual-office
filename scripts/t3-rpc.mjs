import {t3Request,t3Url} from './t3-auth.mjs';
// Effect JSON RPC envelopes, verified against T3 v0.0.45's RpcMessage contract.
export async function t3Rpc(token,tag,payload={}){
 const {ticket}=await t3Request('/api/auth/websocket-ticket',token,{});
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(t3Url.replace('http:','ws:')+'/ws?wsTicket='+encodeURIComponent(ticket));
  let settled=false;const timer=setTimeout(()=>finish(new Error('T3 RPC timeout on '+tag)),20000);
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);ws.close();error?reject(error):resolve(value);};
  ws.addEventListener('open',()=>ws.send(JSON.stringify({_tag:'Request',id:'1',tag,payload,headers:[]})));
  ws.addEventListener('error',()=>finish(new Error('T3 RPC connection failed')));
  ws.addEventListener('close',()=>{if(!settled)finish(new Error('T3 RPC connection closed'));});
  ws.addEventListener('message',event=>{try{const decoded=JSON.parse(event.data);for(const m of Array.isArray(decoded)?decoded:[decoded]){if(m._tag==='Ping')ws.send(JSON.stringify({_tag:'Pong'}));if(m._tag==='Exit'&&String(m.requestId)==='1')m.exit._tag==='Success'?finish(null,m.exit.value):finish(new Error('T3 RPC rejected '+tag));}}catch{finish(new Error('Invalid T3 RPC response'));}});
 });
}
