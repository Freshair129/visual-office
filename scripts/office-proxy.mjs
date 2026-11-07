import {resolveOfficeApi} from '../shared/office-api-routes.js';
const json=(error,status,headers={})=>Response.json({error},{status,headers:{'cache-control':'no-store',...headers}});
export async function proxyOfficeRequest(request,{config,fetchImpl=fetch}={}){
 const url=new URL(request.url),route=resolveOfficeApi(url.pathname);
 if(!route?.browser)return json('Not found',404);
 if(!route.methods.includes(request.method))return json('Method not allowed',405,{allow:route.methods.join(', ')});
 if(!config)return json('Not configured',503);
 const write=request.method!=='GET';
 if(write&&request.headers.get('origin')!==url.origin)return json('Invalid origin',403);
 let payload;
 if(write){
  const limit=route.binary?8*1024*1024:48000,chunks=[];let size=0;
  const reader=request.body?.getReader();
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return json('Payload too large',413);}chunks.push(value);}
  payload=new Uint8Array(size);let offset=0;for(const part of chunks){payload.set(part,offset);offset+=part.length;}
 }
 try{
  const headers={'OAI-Sites-Authorization':'Bearer '+config.siteBearer};
  if(write){headers.origin=config.siteUrl;headers['content-type']=request.headers.get('content-type')||'application/json';if(route.binary)headers['x-file-name']=request.headers.get('x-file-name')||'';}
  const response=await fetchImpl(config.siteUrl+url.pathname+url.search,{method:request.method,headers,...(write?{body:payload}:{}),signal:AbortSignal.timeout(route.binary?60000:15000),redirect:'error'});
  const out=new Headers({'cache-control':'no-store','x-content-type-options':'nosniff'});
  for(const name of ['content-type','content-disposition','allow'])if(response.headers.has(name))out.set(name,response.headers.get(name));
  return new Response(response.body,{status:response.status,headers:out});
 }catch{return json('Office upstream unavailable',503);}
}
