import {handleApi} from '../worker/index.js';
import {createSyntheticWorkspace,syntheticBodyLimit} from './synthetic-workspace.mjs';
// Isolated synthetic server: actual connector, pinned producer inputs, no upstream fetch.
import http from 'node:http';import {Readable} from 'node:stream';import {readFile,stat} from 'node:fs/promises';import {resolve,sep,extname} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {createZuriConnector} from './zuri-connector.mjs';
import {selectContextVector,contextVectorResponse} from './synthetic-domain-context.mjs';
import {CONTEXT_PROFILE,CONTEXT_PATH} from '../web/office-domain-context.js';
import {syntheticCsp,protectSyntheticHtml} from './synthetic-browser-policy.mjs';
const legacyArt=process.argv.includes('--legacy-art');
const workspaceMode=process.argv.includes('--workspace');if(workspaceMode&&process.argv.includes('--dynamic'))throw new Error('Workspace fixture is separate from dynamic-context qualification');
const workspaceFixture=workspaceMode?await createSyntheticWorkspace():null;
if(legacyArt&&process.argv.includes('--dynamic'))throw new Error('Legacy art preview is separate from dynamic context qualification');
const dynamicMode=process.argv.includes('--dynamic');const contextBytes=dynamicMode?await readFile('tests/fixtures/marketing-office/domain-context-v1.json'):null;const contextBundle=contextBytes?JSON.parse(contextBytes):null;const contextSha=contextBytes?createHash('sha256').update(contextBytes).digest('hex'):null;let contextCase='AUTO',contextHold=false;
const workerMode=process.argv.includes('--worker');const builtWorker=workerMode?(await import('../dist/server/index.js')).default:null;
const fixturePath='tests/fixtures/marketing-office/read-v1.json',sha='7cd8b312704a75822c0495faa5c216f8536dc125aca0d9ee588ce5647fc8e101',bytes=await readFile(fixturePath);assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
const bundle=JSON.parse(bytes),vectors=new Map(bundle.vectors.map(v=>[v.id,v])),root=resolve('web'),port=Number(process.env.PORT||(workerMode?4185:4184));let sceneFault='NONE';let scenario='READY',expired=false;const held=[],calls=[],fixtureViolations=[];
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
async function invokeConnector(request){
 const url=new URL(request.url);
 if(url.pathname===CONTEXT_PATH){
  if(!dynamicMode)return Response.json({error:{code:'UNAVAILABLE'}},{status:503});
  if(request.method!=='GET'||url.searchParams.size!==1||!url.searchParams.has('businessId')||!/^[A-Za-z0-9_-]{1,128}$/.test(url.searchParams.get('businessId')))return Response.json({error:{code:'INVALID_SCOPE'}},{status:400});
  const vector=selectContextVector(contextBundle,url.searchParams.get('businessId'),contextCase);calls.push({path:url.pathname+url.search,method:'GET',fixture:vector?.id||'no-candidate',source:vector?.origin||'candidate',realUpstreamCalls:0});
  if(contextHold)await new Promise(resolve=>held.push(resolve));
  if(expired)return Response.json({error:{code:'AUTH_REQUIRED'}},{status:401});
  return contextVectorResponse(vector);
 }
 const chunks=[];let size=0;if(request.body){const reader=request.body.getReader();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();return Response.json({error:{code:'BODY_TOO_LARGE'}},{status:413});}chunks.push(Buffer.from(value));}}
 const req=Readable.from(chunks);req.method=request.method;req.headers={host:url.host,...(request.headers.has('origin')?{origin:request.headers.get('origin')} : {}), 'content-type':request.headers.get('content-type')||'',cookie:'zuri_session=synthetic_fixture_only'};req.socket={remoteAddress:'127.0.0.1',localPort:port};let status=500,headers={},raw='';
 await connector(req,{writeHead(s,h){status=s;headers=h;},end(v){raw=v;}},url);
 if(url.pathname==='/api/zuri/status'&&status===200){const body=JSON.parse(raw);body.synthetic=true;if(dynamicMode)body.contextProfile=CONTEXT_PROFILE;raw=JSON.stringify(body);}
 return new Response(raw,{status,headers});
}
const workerEnv={...(workspaceFixture?{BUCKET:workspaceFixture.bucket}:{}),OFFICE_SYNTHETIC:true,SYNTHETIC_ZURI:{fetch:invokeConnector}};
// Deliberate fault UI exists only in this local synthetic harness response.
const workspaceHtml=html=>workspaceMode?html.replace('</head>','<meta name="office-workspace-profile" content="office-workspace-synthetic/v1"><script type="application/json" id="office-synthetic-agent-states">'+JSON.stringify(workspaceFixture.actorStates)+'</script></head>'):html;
const protectHtml=html=>protectSyntheticHtml(legacyArt?workspaceHtml(html).replace('</head>','<meta name="office-art-preview" content="legacy"></head>'):workspaceHtml(html)).replace(/<head([^>]*)>/i,`<head$1>${dynamicMode?'<meta name="office-context-profile" content="'+CONTEXT_PROFILE+'"><meta name="office-context-wall-clock" content="'+new Date(contextBundle.clock.wallNowMs).toISOString()+'">':''}`).replace('</body>',legacyArt?'</body>':`<button id="synthetic-context-loss" style="position:fixed;bottom:100px;right:8px;z-index:9999" type="button">Synthetic: lose WebGL</button><script>
document.querySelector('#synthetic-context-loss').onclick=()=>{const canvas=[...document.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0&&c.getAttribute('aria-label')==='ฉาก GLB ออฟฟิศแบบสามมิติ');const gl=canvas?.getContext('webgl2');const extension=gl?.getExtension('WEBGL_lose_context');if(extension)extension.loseContext();else document.querySelector('#synthetic-context-loss').textContent='Context loss unavailable';};
</script></body>`);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const send=(res,body,status=200)=>res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify(body));
http.createServer(async(req,res)=>{try{
 res.setHeader('Content-Security-Policy',syntheticCsp);
 const url=new URL(req.url,'http://127.0.0.1:'+port);if(req.headers.host!==url.host)return send(res,{error:'host'},403);
 if(url.pathname==='/__fixture/context-cases'&&req.method==='GET')return send(res,{dynamicMode,contextCase,contextHold,vectors:(contextBundle?.vectors||[]).map(v=>({id:v.id,origin:v.origin}))});
 if(url.pathname==='/__fixture/log'&&req.method==='GET')return send(res,{workspaceMode,dynamicMode,contextCase,contextHold,contextSha,sceneFault,calls,fixtureViolations,pending:held.length,realUpstreamCalls:0,fixtureSha256:sha});
 if(url.pathname==='/__fixture/control'&&req.method==='POST'){
  if(req.headers.origin!==url.origin)return send(res,{error:'origin'},403);let raw='';for await(const c of req){raw+=c;if(raw.length>2048)return send(res,{error:'size'},413);}const b=JSON.parse(raw);
  if(b.contextCase){assert.ok(b.contextCase==='AUTO'||contextBundle?.vectors.some(v=>v.id===b.contextCase));contextCase=b.contextCase;}if(typeof b.contextHold==='boolean')contextHold=b.contextHold;
  if(b.sceneFault){assert.ok(['NONE','GLB404','BADHASH'].includes(b.sceneFault));sceneFault=b.sceneFault;}
  if(b.scenario){assert.ok(['READY','EMPTY','PARTIAL','UNKNOWN','UNAVAILABLE','ERROR','FORBIDDEN','AUTH_REQUIRED','HOLD'].includes(b.scenario));scenario=b.scenario;}
  if(b.action==='release')held.splice(0).forEach(r=>r());if(b.action==='expire')expired=true;if(b.action==='reset')expired=false;return send(res,{scenario,pending:held.length});
 }
 if(url.pathname.startsWith('/assets/models/tycoon/')&&url.pathname.endsWith('.glb')&&sceneFault!=='NONE'){res.writeHead(sceneFault==='GLB404'?404:200,{'content-type':'model/gltf-binary','cache-control':'no-store'}).end('synthetic invalid GLB');return;}
 if(workerMode||url.pathname.startsWith('/api/zuri/')||workspaceMode&&url.pathname.startsWith('/api/')){
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>syntheticBodyLimit(url.pathname,workspaceMode))return send(res,{error:'size'},413);chunks.push(c);}
  const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  if(workspaceFixture)await workspaceFixture.refresh();
  const workspaceRequest=workspaceMode&&url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/zuri/');
  if(workspaceRequest)calls.push({path:url.pathname+url.search,method:req.method,source:'synthetic-workspace-memory',realUpstreamCalls:0});
  const response=workerMode?await builtWorker.fetch(request,workerEnv):workspaceRequest?await handleApi(request,workerEnv):await invokeConnector(request);
  const headers=Object.fromEntries(response.headers);
  // Enforce both policies: fixture containment must not hide Worker CSP defects.
  headers['content-security-policy']=[syntheticCsp,...headers['content-security-policy']?[headers['content-security-policy']]:[]];delete headers['content-length'];
  res.writeHead(response.status,headers);res.end((headers['content-type']||'').includes('text/html')?protectHtml(await response.text()):Buffer.from(await response.arrayBuffer()));return;
 }
 if(url.pathname.startsWith('/api/'))return send(res,{error:'synthetic-only'},503);
 const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+sep)||!(await stat(path)).isFile())return send(res,{error:'not-found'},404);
 res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-store'}).end(extname(path)==='.html'?protectHtml(await readFile(path,'utf8')):await readFile(path));
}catch(error){console.error(error.message);if(!res.headersSent)send(res,{error:'synthetic-fixture-failure'},500);else res.end();}}).listen(port,'127.0.0.1',()=>console.log('Synthetic ONLY http://127.0.0.1:'+port+'/#office/growth · '+(workerMode?'built Worker':'source app')));
