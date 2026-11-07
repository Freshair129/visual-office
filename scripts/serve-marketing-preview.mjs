// Isolated synthetic server: actual connector, pinned producer inputs, no upstream fetch.
import http from 'node:http';import {readFile,stat} from 'node:fs/promises';import {resolve,sep,extname} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {createZuriConnector} from './zuri-connector.mjs';
const fixturePath=process.argv[2],sha='7cd8b312704a75822c0495faa5c216f8536dc125aca0d9ee588ce5647fc8e101',bytes=await readFile(fixturePath);assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
const bundle=JSON.parse(bytes),vectors=new Map(bundle.vectors.map(v=>[v.id,v])),root=resolve('web'),port=4183;let scenario='READY',expired=false;const held=[],calls=[],fixtureViolations=[];
const fixture=id=>structuredClone(vectors.get(id).upstream);
const connector=createZuriConnector({enabled:true,now:()=>new Date('2026-10-24T00:00:00Z'),fetchImpl:async(input,init)=>{try{
 const url=new URL(input);assert.equal(url.origin,'http://127.0.0.1:3100');const body=init.body?JSON.parse(init.body):null,mode=scenario;let key;
 if(url.pathname==='/api/projects'){assert.equal(init.method,'GET');assert.equal(url.searchParams.get('limit'),'25');assert.equal(url.searchParams.size,2);assert.ok(['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'].includes(url.searchParams.get('businessId')));const row={path:url.pathname+url.search,method:init.method,scenario:mode,fixture:'projects-not-in-pilot',source:'transport',realUpstreamCalls:0};calls.push(row);console.log(JSON.stringify(row));return new Response('{}',{status:503});}
 if(url.pathname==='/api/entry'){assert.equal(init.method,'GET');assert.equal(url.search,'');key=expired?'entry-http-401':'entry-two-businesses';}
 else {
  const ask=url.pathname==='/api/growth/ask-marketing',campaign=url.pathname==='/api/growth/campaigns';assert.ok(ask||campaign);assert.equal(init.method,ask?'POST':'GET');
  const businessId=ask?body?.businessId:url.searchParams.get('businessId');assert.ok(['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'].includes(businessId));
  if(ask){assert.equal(url.search,'');assert.deepEqual(Object.keys(body).sort(),['businessId','question']);assert.equal(body.question,body.question.trim());assert.ok(body.question.length<=400);}else assert.equal(url.search,'?businessId='+businessId);
  const prefix=ask?'ask':'campaign';
  key=expired||mode==='AUTH_REQUIRED'?prefix+'-http-401':mode==='FORBIDDEN'?prefix+'-http-403':mode==='ERROR'?ask?'ask-malformed-answer':'campaign-malformed-collection':ask?({EMPTY:'ask-empty-owners',PARTIAL:'ask-partial-null-count',UNKNOWN:'ask-all-unknown',UNAVAILABLE:'ask-all-unavailable'}[mode]||(body.question===''?'ask-blank-overview':body.question.toLowerCase()==='overview'?'ask-overview':body.question.toLowerCase().includes('roas')?'ask-paid-null':'ask-unsupported')):mode==='EMPTY'?'campaign-empty':mode==='PARTIAL'?'campaign-producer-truncated':'campaign-authorized';
 }
 const upstream=fixture(key),businessId=body?.businessId||url.searchParams.get('businessId');
 if(body&&upstream.status===200&&upstream.body?.readModel==='MARKETING_ASK'){upstream.body.businessId=businessId;upstream.body.question=body.question;if(businessId.startsWith('222'))for(const section of upstream.body.answer?.sections||[])section.title='Synthetic B · '+section.title;}
 if(businessId?.startsWith('222')&&Array.isArray(upstream.body?.campaigns))upstream.body.campaigns=upstream.body.campaigns.map(r=>({...r,businessId,id:'synthetic-B-'+r.id,title:'Synthetic B · '+r.title}));
 const row={path:url.pathname+url.search,method:init.method,body,scenario:mode,fixture:key,source:mode==='HOLD'||businessId?.startsWith('222')||(body&&body.question!==vectors.get(key).request.body?.question)?'source-derived mutation':vectors.get(key).origin,realUpstreamCalls:0};calls.push(row);console.log(JSON.stringify(row));
 if(mode==='HOLD'&&url.pathname!=='/api/entry')await new Promise(r=>held.push(r));
 return new Response(JSON.stringify(upstream.body),{status:upstream.status,headers:{'content-type':'application/json'}});
}catch(error){fixtureViolations.push(error.message);throw error;}
}});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const send=(res,body,status=200)=>res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify(body));
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:'+port);if(req.headers.host!==url.host)return send(res,{error:'host'},403);
 if(url.pathname==='/__fixture/log'&&req.method==='GET')return send(res,{calls,fixtureViolations,pending:held.length,realUpstreamCalls:0,fixtureSha256:sha});
 if(url.pathname==='/__fixture/control'&&req.method==='POST'){
  if(req.headers.origin!==url.origin)return send(res,{error:'origin'},403);let raw='';for await(const c of req){raw+=c;if(raw.length>2048)return send(res,{error:'size'},413);}const b=JSON.parse(raw);
  if(b.scenario){assert.ok(['READY','EMPTY','PARTIAL','UNKNOWN','UNAVAILABLE','ERROR','FORBIDDEN','AUTH_REQUIRED','HOLD'].includes(b.scenario));scenario=b.scenario;}
  if(b.action==='release')held.splice(0).forEach(r=>r());if(b.action==='expire')expired=true;if(b.action==='reset')expired=false;return send(res,{scenario,pending:held.length});
 }
 if(url.pathname.startsWith('/api/zuri/')){req.headers.cookie='zuri_session=synthetic_fixture_only';return await connector(req,res,url);}
 if(url.pathname.startsWith('/api/'))return send(res,{error:'synthetic-only'},503);
 const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/tools/marketing-preview.html':url.pathname));if(!path.startsWith(root+sep)||!(await stat(path)).isFile())return send(res,{error:'not-found'},404);
 res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-store'}).end(await readFile(path));
}catch(error){console.error(error.message);if(!res.headersSent)send(res,{error:'synthetic-fixture-failure'},500);else res.end();}}).listen(port,'127.0.0.1',()=>console.log('Synthetic ONLY http://127.0.0.1:'+port+'/tools/marketing-preview.html'));
