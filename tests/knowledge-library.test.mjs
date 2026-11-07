import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/index.js';
import {prepareKnowledgeAttachments} from '../scripts/knowledge-attachments.mjs';

const base='https://office.example',secret='owner-runner-secret';
class Bucket{
 values=new Map();etags=new Map();serial=0;
 async put(key,value,options={}){
  const current=this.etags.get(key),condition=options.onlyIf;
  if(condition instanceof Headers&&condition.get('if-none-match')==='*'&&this.values.has(key))return null;
  if(condition?.etagMatches&&current!==condition.etagMatches)return null;
  if(condition instanceof Headers&&condition.get('if-match')&&current!==condition.get('if-match'))return null;
  this.values.set(key,value instanceof Uint8Array?new Uint8Array(value):value);const etag=`etag-${++this.serial}`;this.etags.set(key,etag);return{etag};
 }
 async get(key){
  if(!this.values.has(key))return null;const value=this.values.get(key),bytes=value instanceof Uint8Array?value:new TextEncoder().encode(String(value));
  return{etag:this.etags.get(key),size:bytes.byteLength,body:new Response(bytes).body,json:async()=>JSON.parse(new TextDecoder().decode(bytes)),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 }
 async delete(key){this.values.delete(key);this.etags.delete(key);}
 async list({prefix}){return{objects:[...this.values.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false};}
}
const env=()=>({BUCKET:new Bucket(),OFFICE_SYNC_KEY:secret});
const req=(route,method='GET',payload=null,headers={})=>new Request(base+route,{method,headers,...(payload!==null?{body:JSON.stringify(payload)}:{})});
const id=()=>crypto.randomUUID();
const join=(...chunks)=>{const size=chunks.reduce((n,c)=>n+c.length,0),all=new Uint8Array(size);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.length;}return all;};
function minimalOfficeZip(paths){
 const locals=[],centrals=[];let offset=0;
 for(const path of paths){const name=new TextEncoder().encode(path),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(26,name.length,true);local.set(name,30);locals.push(local);
  const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);centrals.push(central);offset+=local.length;}
 const dir=join(...centrals),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,paths.length,true);ev.setUint16(10,paths.length,true);ev.setUint32(12,dir.length,true);ev.setUint32(16,offset,true);return join(...locals,dir,end);
}
function uploadRequest(fileId,name,bytes,origin=base,type='application/octet-stream'){
 return new Request(`${base}/api/knowledge/files/${fileId}`,{method:'POST',headers:{origin,'content-type':type,'x-file-name':encodeURIComponent(name)},body:bytes});
}
async function upload(e,name='notes.txt',text='workspace notes',fileId=id()){
 const response=await handleApi(uploadRequest(fileId,name,new TextEncoder().encode(text)),e);return{response,data:await response.json(),id:fileId};
}
async function approve(e,versionId,action='approve',origin=base){
 return handleApi(req(`/api/knowledge/versions/${versionId}/${action}`,'POST',{}, {origin}),e);
}
const source=(id,status='approved',sizeBytes=1)=>({id,name:`source-${id.slice(0,8)}.txt`,mimeType:'text/plain',sizeBytes,digest:'a'.repeat(64),createdAt:new Date().toISOString(),status,approvedAt:status==='approved'?'2026-10-11T00:00:00.000Z':null,revokedAt:null,purgedAt:status==='purged'?'2026-10-11T00:00:00.000Z':null,t3Attachments:{}});
const jobInput=(versionIds=[],taskId=id())=>({id:taskId,title:'Research',brief:'Use only reviewed sources',agentIds:['beam','kai'],team:true,knowledgeVersionIds:versionIds});
async function createJob(e,payload){return handleApi(req('/api/jobs','POST',payload,{origin:base} ),e);}
async function manifest(e){const record=await e.BUCKET.get('office/knowledge/manifest.json');return record?record.json():{schema:1,versions:[],jobReservations:{}};}
async function seedManifest(e,value){await e.BUCKET.put('office/knowledge/manifest.json',JSON.stringify(value));}

test('owner upload enforces origin, allowlist, matching type signature, JSON syntax and the 8 MiB bound',async()=>{
 const e=env();
 assert.equal((await handleApi(uploadRequest(id(),'notes.txt',new TextEncoder().encode('x'),'https://attacker.example'),e)).status,403);
 assert.equal((await handleApi(uploadRequest(id(),'image.png',new Uint8Array([0x89,0x50,0x4e,0x47])),e)).status,400);
 assert.equal((await handleApi(uploadRequest(id(),'wrong.pdf',new TextEncoder().encode('not a PDF')),e)).status,400);
 assert.equal((await handleApi(uploadRequest(id(),'wrong.pdf',new TextEncoder().encode('%PDF-1.7'),'https://office.example','text/plain'),e)).status,400);
 assert.equal((await handleApi(uploadRequest(id(),'broken.json',new TextEncoder().encode('{oops')),e)).status,400);
 assert.equal((await handleApi(uploadRequest(id(),'large.pdf',new Uint8Array(8*1024*1024+1)),e)).status,413);
 const accepted=[
  ['brief.pdf',new TextEncoder().encode('%PDF-1.7\nbody')],
  ['data.json',new TextEncoder().encode('{"safe":true}')],
  ['sheet.xlsx',minimalOfficeZip(['[Content_Types].xml','xl/workbook.xml'])],
  ['paper.docx',minimalOfficeZip(['[Content_Types].xml','word/document.xml'])],
  ['slides.pptx',minimalOfficeZip(['[Content_Types].xml','ppt/presentation.xml'])],
  ['table.csv',new TextEncoder().encode('a,b\n1,2')]
 ];
 for(const[name,bytes]of accepted)assert.equal((await handleApi(uploadRequest(id(),name,bytes),e)).status,201,name);
});

test('workspace caps enforce 20 active versions, 100 MiB retained bytes, and bounded purged history',async()=>{
 const countEnv=env(),countVersions=Array.from({length:20},()=>source(id(),'pending',1));await seedManifest(countEnv,{schema:1,versions:countVersions,jobReservations:{}});
 assert.equal((await upload(countEnv)).response.status,413);
 const concurrentEnv=env(),nineteen=Array.from({length:19},()=>source(id(),'pending',1));await seedManifest(concurrentEnv,{schema:1,versions:nineteen,jobReservations:{}});
 const simultaneous=await Promise.all([upload(concurrentEnv,'first.txt','a'),upload(concurrentEnv,'second.txt','b')]);assert.deepEqual(simultaneous.map(r=>r.response.status).sort(),[201,413]);assert.equal((await manifest(concurrentEnv)).versions.filter(v=>v.status!=='purged').length,20);
 const bytesEnv=env(),largeVersions=Array.from({length:12},()=>source(id(),'pending',8*1024*1024));await seedManifest(bytesEnv,{schema:1,versions:largeVersions,jobReservations:{}});
 assert.equal((await upload(bytesEnv,'too-much.txt','x'.repeat(5*1024*1024))).response.status,413);
 const historyEnv=env(),old=Array.from({length:200},()=>source(id(),'purged',1));await seedManifest(historyEnv,{schema:1,versions:old,jobReservations:{}});
 const inserted=await upload(historyEnv);assert.equal(inserted.response.status,201);const state=await manifest(historyEnv);assert.equal(state.versions.length,200);assert.ok(state.versions.some(v=>v.id===inserted.id));assert.ok(!state.versions.some(v=>v.id===old[0].id));
});

test('an interrupted pending upload resumes by content and name without consuming a second quota slot',async()=>{
 const e=env(),fileId=id(),bytes=new TextEncoder().encode('resumable source');let failOnce=true;const original=e.BUCKET.put.bind(e.BUCKET);
 e.BUCKET.put=async(key,value,options)=>{if(failOnce&&key.startsWith('office/knowledge/files/')){failOnce=false;throw new Error('temporary blob failure');}return original(key,value,options);};
 assert.equal((await handleApi(uploadRequest(fileId,'retry.txt',bytes),e)).status,503);assert.equal((await manifest(e)).versions[0].status,'uploading');
 const resumed=await handleApi(uploadRequest(id(),'retry.txt',bytes),e);assert.equal(resumed.status,200);const data=await resumed.json();assert.equal(data.version.id,fileId);assert.equal(data.version.status,'pending');assert.equal((await manifest(e)).versions.length,1);
});

test('approval is version-specific; jobs snapshot approved sources and retries reject changed selection',async()=>{
 const e=env(),created=await upload(e,'reference.txt','Approved reference');assert.equal(created.data.version.status,'pending');
 assert.equal((await createJob(e,jobInput([created.id]))).status,409);
 const approved=await(await approve(e,created.id)).json(),stamp=approved.version.approvedAt;assert.equal(approved.version.status,'approved');
 const payload=jobInput([created.id]),first=await createJob(e,payload);assert.equal(first.status,201);const job=(await first.json()).job;
 assert.deepEqual(job.knowledgeSnapshot,[{id:created.id,digest:created.data.version.digest,name:'reference.txt',mimeType:'text/plain',sizeBytes:18,approvedAt:stamp}]);
 const retry=await createJob(e,payload),retryJob=(await retry.json()).job;assert.equal(retry.status,200);assert.deepEqual(retryJob.steps,job.steps);
 assert.equal((await createJob(e,jobInput([],payload.id))).status,409);
 assert.equal((await approve(e,created.id,'revoke')).status,200);
 assert.equal((await createJob(e,jobInput([created.id]))).status,409);
 const existing=await(await handleApi(req('/api/jobs'),e)).json();assert.deepEqual(existing.jobs[0].knowledgeSnapshot,job.knowledgeSnapshot);
 const racing=env(),racingUpload=await upload(racing,'race-source.txt','same source');await approve(racing,racingUpload.id);const shared=jobInput([racingUpload.id]);
 const parallel=await Promise.all([createJob(racing,shared),createJob(racing,shared)]),parallelJobs=await Promise.all(parallel.map(async r=>(await r.json()).job));assert.deepEqual(parallelJobs[0].steps,parallelJobs[1].steps);assert.equal((await handleApi(req('/api/jobs'),racing)).status,200);assert.equal((await(await handleApi(req('/api/jobs'),racing)).json()).jobs.length,1);
});

test('same-ID job race recovery rejects a different team or agent selection',async()=>{
 const cases=[
  {recovery:'conditional-create collision',winner:{team:true,agentIds:['beam']},contender:{team:false,agentIds:['beam']}},
  {recovery:'write-error collision',winner:{team:true,agentIds:['beam','kai']},contender:{team:true,agentIds:['kai','beam']}}
 ];
 for(const scenario of cases){
  const e=env(),taskId=id(),jobPath=`office/jobs/${taskId}.json`,winnerPayload={...jobInput([],taskId),...scenario.winner},contenderPayload={...jobInput([],taskId),...scenario.contender};
  let resumeInitialRead,signalInitialRead;const waitForResume=new Promise(resolve=>resumeInitialRead=resolve),initialReadSeen=new Promise(resolve=>signalInitialRead=resolve),originalGet=e.BUCKET.get.bind(e.BUCKET);let hideFirstRead=true;
  e.BUCKET.get=async key=>{if(key===jobPath&&hideFirstRead){hideFirstRead=false;signalInitialRead();await waitForResume;return null;}return originalGet(key);};
  const contender=createJob(e,contenderPayload);await initialReadSeen;
  assert.equal((await createJob(e,winnerPayload)).status,201,scenario.recovery);
  if(scenario.recovery==='write-error collision'){
   const originalPut=e.BUCKET.put.bind(e.BUCKET);
   e.BUCKET.put=async(key,value,options)=>{if(key===jobPath&&e.BUCKET.values.has(key))throw new Error('simulated conditional write failure');return originalPut(key,value,options);};
  }
  resumeInitialRead();const conflict=await contender;assert.equal(conflict.status,409,scenario.recovery);assert.equal((await conflict.json()).error,'Task ID already used',scenario.recovery);
 }
});

test('same-ID retry after reservation release returns the persisted step identities',async()=>{
 const e=env(),taskId=id(),payload=jobInput([],taskId),jobPath=`office/jobs/${taskId}.json`;
 let resumeInitialRead,signalInitialRead;const waitForResume=new Promise(resolve=>resumeInitialRead=resolve),initialReadSeen=new Promise(resolve=>signalInitialRead=resolve),originalGet=e.BUCKET.get.bind(e.BUCKET);let hideFirstRead=true;
 e.BUCKET.get=async key=>{if(key===jobPath&&hideFirstRead){hideFirstRead=false;signalInitialRead();await waitForResume;return null;}return originalGet(key);};
 const retry=createJob(e,payload);await initialReadSeen;
 const winner=await createJob(e,payload);assert.equal(winner.status,201);const persisted=(await winner.json()).job;
 resumeInitialRead();const replay=await retry;assert.equal(replay.status,200);const returned=(await replay.json()).job;
 assert.deepEqual(returned.steps,persisted.steps);assert.equal(returned.createdAt,persisted.createdAt);
});

test('job validation enforces selected file count and combined 20 MiB payload limits',async()=>{
 const e=env(),six=Array.from({length:6},()=>source(id()));await seedManifest(e,{schema:1,versions:six,jobReservations:{}});
 assert.equal((await createJob(e,jobInput(six.map(v=>v.id)))).status,400);
 const three=Array.from({length:3},()=>source(id(),'approved',8*1024*1024));await seedManifest(e,{schema:1,versions:three,jobReservations:{}});
 assert.equal((await createJob(e,jobInput(three.map(v=>v.id)))).status,413);
});

test('runner reads only an active job source; transfer cache is thread-scoped and expires after eight minutes',async()=>{
 const e=env(),uploaded=await upload(e,'reference.txt','source bytes');await approve(e,uploaded.id);
 const created=await createJob(e,jobInput([uploaded.id])),job=(await created.json()).job,first=job.steps[0],second=job.steps[1],auth={authorization:'Bearer '+secret};
 const route=step=>`/api/runner/knowledge/${uploaded.id}?jobId=${job.id}&threadId=${step.threadId}`;
 assert.equal((await handleApi(req(route(first)),e)).status,401);
 let read=await handleApi(req(route(first),'GET',null,auth),e);assert.equal(read.status,200);assert.equal(await read.text(),'source bytes');
 const cached=await handleApi(req(route(first),'PUT',{attachmentId:'native_first',uploadedAt:Date.now()},auth),e);assert.equal(cached.status,200);
 read=await handleApi(req(route(first),'GET',null,auth),e);assert.equal(read.status,204);assert.equal(read.headers.get('x-t3-attachment-id'),'native_first');
 read=await handleApi(req(route(second),'GET',null,auth),e);assert.equal(read.status,200);assert.equal(read.headers.get('x-t3-attachment-id'),'');
 const state=await manifest(e),version=state.versions.find(v=>v.id===uploaded.id);version.t3Attachments[first.threadId].uploadedAt=Date.now()-9*60000;await seedManifest(e,state);
 read=await handleApi(req(route(first),'GET',null,auth),e);assert.equal(read.status,200);assert.equal(read.headers.get('x-t3-attachment-id'),'');assert.equal(await read.text(),'source bytes');
 assert.equal((await handleApi(req(`/api/runner/knowledge/${uploaded.id}?jobId=${job.id}&threadId=${id()}`,'GET',null,auth),e)).status,404);
});

test('job reservation and purge race never leave a queued snapshot without its source; purge retains job metadata',async()=>{
 const e=env(),uploaded=await upload(e,'race.txt','race source');await approve(e,uploaded.id);const input=jobInput([uploaded.id]);
 const[purge,created]=await Promise.all([approve(e,uploaded.id,'purge'),createJob(e,input)]);
 const jobResponse=created.status===201?created:created.status===200?created:null;
 if(jobResponse){assert.equal(purge.status,409);const job=(await jobResponse.json()).job;assert.ok(await e.BUCKET.get('office/knowledge/files/'+uploaded.id));
  const done={...job,status:'done',steps:job.steps.map(s=>({...s,status:'done',result:''}))};
  assert.equal((await handleApi(req('/api/runner/jobs/'+job.id,'PUT',done,{authorization:'Bearer '+secret}),e)).status,200);
  assert.equal((await approve(e,uploaded.id,'purge')).status,200);
  const saved=(await(await handleApi(req('/api/jobs'),e)).json()).jobs.find(j=>j.id===job.id);assert.deepEqual(saved.knowledgeSnapshot,job.knowledgeSnapshot);assert.equal(await e.BUCKET.get('office/knowledge/files/'+uploaded.id),null);
 }else{assert.equal(created.status,409);assert.equal(purge.status,200);assert.equal(await e.BUCKET.get('office/knowledge/files/'+uploaded.id),null);}
});

test('knowledge attachment preparation reuses a fresh cache, refreshes an expired one and fails closed on read errors',async()=>{
 const sourceVersion={id:id(),digest:'b'.repeat(64),name:'facts.txt',mimeType:'text/plain',sizeBytes:4,approvedAt:'2026-10-11T00:00:00Z'},job={id:id(),knowledgeSnapshot:[sourceVersion]},step={threadId:id()},now=Date.now();let rpcCalls=0,uploadCalls=0;
 const fresh=await prepareKnowledgeAttachments(job,{token:'token',step,now:()=>now,cloud:async()=>new Response(null,{status:204,headers:{'x-file-digest':sourceVersion.digest,'x-file-size':'4','x-file-mime-type':sourceVersion.mimeType,'x-t3-attachment-id':'native_cached','x-t3-uploaded-at':String(now)}}),rpc:async()=>{rpcCalls++;throw Error('must not upload');}});
 assert.equal(fresh[0].id,'native_cached');assert.equal(rpcCalls,0);
 const expiredAt=now-9*60000;let putRoute='';
 const refreshed=await prepareKnowledgeAttachments(job,{token:'token',step,now:()=>now,rpc:async(_token,tag,payload)=>{rpcCalls++;assert.equal(tag,'attachments.createUploadUrl');assert.equal(payload.name,'facts.txt');return{attachmentId:'native_new',relativeUrl:'/api/attachments/upload/upload-1'};},upload:async(url,options)=>{uploadCalls++;assert.ok(String(url).startsWith('http://127.0.0.1:3773/'));assert.equal((await new Response(options.body).text()).length,4);return new Response(null,{status:200});},cloud:async(route,options={})=>{putRoute=route;if(options.method==='PUT')return Response.json({attachmentId:'native_new',uploadedAt:now});return new Response(new TextEncoder().encode('data'),{headers:{'x-file-digest':sourceVersion.digest,'x-file-size':'4','x-file-mime-type':sourceVersion.mimeType,'x-file-name':'facts.txt','x-t3-attachment-id':'native_old','x-t3-uploaded-at':String(expiredAt)}});}});
 assert.equal(refreshed[0].id,'native_new');assert.equal(rpcCalls,1);assert.equal(uploadCalls,1);assert.ok(putRoute.includes('threadId='+step.threadId));
 await assert.rejects(()=>prepareKnowledgeAttachments(job,{token:'token',step,cloud:async()=>new Response('{}',{status:503}),rpc:async()=>{throw Error('should fail before transfer');}}));
});
