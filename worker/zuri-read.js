import {CONTEXT_PATH} from '../web/office-domain-context.js';
// Local synthetic qualification seam, not a live Zuri/auth contract.
const routes=new Map([[CONTEXT_PATH,'GET'],['/api/zuri/status','GET'],['/api/zuri/scope','GET'],['/api/zuri/domains/growth','GET'],['/api/zuri/domains/projects','GET'],['/api/zuri/domains/growth/ask','POST']]);
const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export async function handleZuriRead(request,env={}){
 const url=new URL(request.url),method=routes.get(url.pathname);
 if(!method)return reply({error:{code:'UNSUPPORTED_ROUTE'}},404);
 if(request.method!==method)return Response.json({error:{code:'METHOD_NOT_ALLOWED'}},{status:405,headers:{'cache-control':'no-store',allow:method}});
 const enabled=env.OFFICE_SYNTHETIC===true&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&typeof env.SYNTHETIC_ZURI?.fetch==='function';
 if(!enabled)return url.pathname==='/api/zuri/status'?reply({enabled:false,target:null,synthetic:false}):reply({error:{code:'UNAVAILABLE'}},503);
 if(url.pathname===CONTEXT_PATH&&(url.searchParams.size!==1||!url.searchParams.has('businessId')||!/^[A-Za-z0-9_-]{1,128}$/.test(url.searchParams.get('businessId'))))return reply({error:{code:'INVALID_SCOPE'}},400);
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return reply({error:{code:'INVALID_ORIGIN'}},403);
 const headers=new Headers();for(const key of ['content-type','origin'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
 try{return await env.SYNTHETIC_ZURI.fetch(new Request(request.url,{method:request.method,headers,...(request.method==='POST'?{body:request.body,duplex:'half'}:{})}));}catch{return reply({error:{code:'UNAVAILABLE'}},503);}
}
