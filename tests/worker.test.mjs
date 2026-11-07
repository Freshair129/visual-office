import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/index.js';
class Bucket{values=new Map();etags=new Map();version=0;async put(k,v,options={}){const condition=options.onlyIf;if(condition instanceof Headers&&condition.get('if-none-match')==='*'&&this.values.has(k))return null;if(condition&&typeof condition==='object'&&'etagMatches'in condition&&this.etags.get(k)!==condition.etagMatches)return null;this.values.set(k,v);const etag=String(++this.version);this.etags.set(k,etag);return{etag}}async get(k){const v=this.values.get(k);return v===undefined?null:{etag:this.etags.get(k),json:async()=>JSON.parse(typeof v==='string'?v:new TextDecoder().decode(v)),body:new Response(v).body}}async list({prefix}){return{objects:[...this.values.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false}}}
const url='https://office.example';const env=()=>({BUCKET:new Bucket(),OFFICE_SYNC_KEY:'secret'});
const req=(route,method='GET',payload=null,headers={})=>new Request(url+route,{method,headers,...(payload?{body:JSON.stringify(payload)}:{})});
test('ingestion rejects missing credentials and malformed duplicate sessions',async()=>{const e=env();assert.equal((await handleApi(req('/api/sync','POST',{}),e)).status,401);const s={id:'a',status:'working'};assert.equal((await handleApi(req('/api/sync','POST',{version:1,sessions:[s,s]},{authorization:'Bearer secret'}),e)).status,400);assert.equal(e.BUCKET.values.size,0)});
test('ingestion persists sanitized data and stamps trusted receipt time; stale data becomes offline',async()=>{const e=env();const snapshot={version:1,hostStatus:'live',receivedAt:'2099-01-01',sessions:[{id:'a',status:'working',name:'Mira',lastLog:'real update',token:'never-store'}]};const response=await handleApi(req('/api/sync','POST',snapshot,{authorization:'Bearer secret'}),e);assert.equal(response.status,200);const live=await(await handleApi(req('/api/office'),e)).json();assert.equal(live.stale,false);assert.equal(live.sessions[0].status,'working');assert.equal(live.sessions[0].token,undefined);live.receivedAt=new Date(Date.now()-40000).toISOString();await e.BUCKET.put('office/latest.json',JSON.stringify(live));const stale=await(await handleApi(req('/api/office'),e)).json();assert.equal(stale.stale,true);assert.equal(stale.sessions[0].status,'offline');assert.equal(stale.sessions[0].lastLog,'real update')});
test('preferences require same-origin mutation and persist for a second device',async()=>{const e=env();const prefs={assignments:Array.from({length:6},()=>({id:null,name:''})),avatars:Object.fromEntries(Array.from({length:6},(_,i)=>[i,{outfit:'#F5EFE4',skin:'#dfaf8c',hair:'bob',glasses:true}]))};assert.equal((await handleApi(req('/api/preferences','PUT',prefs,{origin:'https://attacker.example'}),e)).status,403);assert.equal((await handleApi(req('/api/preferences','PUT',prefs,{origin:url}),e)).status,200);assert.deepEqual(await(await handleApi(req('/api/preferences'),e)).json(),prefs)});
const task=()=>({id:crypto.randomUUID(),title:'Competitor analysis',brief:'Research official sources',agentIds:['beam','kai'],team:true});
test('role queue snapshots context, rejects cross-origin and invalid agents, retries without duplicate chats',async()=>{
 const e=env(),v=task();assert.equal((await handleApi(req('/api/jobs','POST',v),e)).status,403);
 await handleApi(req('/api/team','PUT',{context:'Business context'},{origin:url}),e);
 const first=await handleApi(req('/api/jobs','POST',v,{origin:url}),e);assert.equal(first.status,201);const j=(await first.json()).job;
 assert.equal(j.context,'Business context');assert.deepEqual(j.steps.map(s=>s.agentId),['beam','kai','mira']);assert.equal(j.steps[2].phase,'synthesis');
 const retry=(await(await handleApi(req('/api/jobs','POST',v,{origin:url}),e)).json()).job;assert.deepEqual(retry.steps,j.steps);
 assert.equal((await handleApi(req('/api/jobs','POST',{...v,title:'Different'},{origin:url}),e)).status,409);
 assert.equal((await handleApi(req('/api/jobs','POST',{...task(),agentIds:['unknown']},{origin:url}),e)).status,400);
 const listed=await(await handleApi(req('/api/jobs'),e)).json();assert.equal(listed.jobs.length,1);
 assert.equal((await handleApi(req('/api/runner/jobs'),e)).status,401);
});
test('runner updates cannot rebind identities and stale updates cannot erase a cancellation',async()=>{
 const e=env(),v=task();const j=(await(await handleApi(req('/api/jobs','POST',v,{origin:url}),e)).json()).job;
 const route='/api/runner/jobs/'+j.id,h={authorization:'Bearer secret'};
 assert.equal((await handleApi(req(route,'PUT',{...j,steps:j.steps.map(s=>({...s,agentId:'mira'}))},h),e)).status,400);
 await handleApi(req('/api/jobs/'+j.id+'/cancel','POST',{}, {origin:url}),e);
 assert.equal((await handleApi(req(route,'PUT',{...j,status:'running'},h),e)).status,200);
 const pending=await(await handleApi(req('/api/runner/jobs','GET',null,h),e)).json();assert.equal(pending.jobs[0].cancelRequested,true);
 assert.equal(pending.jobs[0].steps[0].threadId,j.steps[0].threadId);
});
test('a full six-role team plus lead can persist all maximum-length results and business context',async()=>{
 const e=env();await handleApi(req('/api/team','PUT',{context:'c'.repeat(6000)},{origin:url}),e);
 const v={...task(),brief:'b'.repeat(10000),agentIds:['mira','kai','pim','theo','nara','beam']};
 const j=(await(await handleApi(req('/api/jobs','POST',v,{origin:url}),e)).json()).job;
 assert.equal(j.steps.length,7);j.status='done';j.steps.forEach(s=>{s.status='done';s.result='x'.repeat(12000)});
 assert.equal((await handleApi(req('/api/runner/jobs/'+j.id,'PUT',j,{authorization:'Bearer secret'}),e)).status,200);
});
test('chat messages are restricted to known threads, same-origin, and retries keep the same dispatch ID',async()=>{
 const e=env(),j=(await(await handleApi(req('/api/jobs','POST',task(),{origin:url}),e)).json()).job,id=j.steps[0].threadId;
 const v={id:crypto.randomUUID(),text:'Continue this conversation'};
 assert.equal((await handleApi(req('/api/chats/'+crypto.randomUUID()+'/messages','POST',v,{origin:url}),e)).status,404);
 assert.equal((await handleApi(req('/api/chats/'+id+'/messages','POST',v),e)).status,403);
 const first=(await(await handleApi(req('/api/chats/'+id+'/messages','POST',v,{origin:url}),e)).json()).message;
 const retry=(await(await handleApi(req('/api/chats/'+id+'/messages','POST',v,{origin:url}),e)).json()).message;assert.equal(first.commandId,retry.commandId);
 assert.equal((await handleApi(req('/api/chats/'+id+'/messages','POST',{...v,text:'Different'},{origin:url}),e)).status,409);
 const queue=await(await handleApi(req('/api/runner/chats','GET',null,{authorization:'Bearer secret'}),e)).json();assert.equal(queue.messages.length,1);assert.equal(queue.messages[0].threadId,id);
 assert.equal((await handleApi(req('/api/runner/chats'),e)).status,401);
});
test('concurrent distinct chat messages cannot exceed the global queue capacity',async()=>{
 const e=env(),j=(await(await handleApi(req('/api/jobs','POST',task(),{origin:url}),e)).json()).job,threadId=j.steps[0].threadId,runner={authorization:'Bearer secret'},seeded=[];
 for(let i=0;i<19;i++){
  const id=crypto.randomUUID();seeded.push(id);
  await e.BUCKET.put(`office/chat-queue/${threadId}/${id}.json`,JSON.stringify({id,threadId,text:`Existing message ${i}`,attachments:[],commandId:crypto.randomUUID(),status:'queued',error:null,createdAt:new Date().toISOString()}));
 }
 const ids=[crypto.randomUUID(),crypto.randomUUID()],responses=await Promise.all(ids.map(id=>handleApi(req('/api/chats/'+threadId+'/messages','POST',{id,text:'Concurrent message'},{origin:url}),e)));
 assert.deepEqual(responses.map(response=>response.status).sort((a,b)=>a-b),[201,429]);
 const rejectedId=ids[responses.findIndex(response=>response.status===429)];
 assert.equal((await handleApi(req(`/api/runner/chats/messages/${threadId}/${seeded[0]}`,'PUT',{status:'done'},runner),e)).status,200);
 assert.equal((await handleApi(req('/api/chats/'+threadId+'/messages','POST',{id:rejectedId,text:'Concurrent message'},{origin:url}),e)).status,201);
 const queue=await(await handleApi(req('/api/runner/chats','GET',null,runner),e)).json();assert.equal(queue.messages.length,20);
});
test('a failed queue create releases its reservation after the bounded lease and same-ID retry succeeds',async()=>{
 const e=env(),j=(await(await handleApi(req('/api/jobs','POST',task(),{origin:url}),e)).json()).job,threadId=j.steps[0].threadId,runner={authorization:'Bearer secret'},id=crypto.randomUUID(),otherId=crypto.randomUUID(),realNow=Date.now,originalPut=e.BUCKET.put.bind(e.BUCKET);let now=1700000000000;
 for(let i=0;i<19;i++){
  const messageId=crypto.randomUUID();
  await e.BUCKET.put(`office/chat-queue/${threadId}/${messageId}.json`,JSON.stringify({id:messageId,threadId,text:`Existing message ${i}`,attachments:[],commandId:crypto.randomUUID(),status:'queued',error:null,createdAt:new Date().toISOString()}));
 }
 Date.now=()=>now;
 try{
  let failQueue=true;
  e.BUCKET.put=async(key,value,options)=>{if(key.startsWith('office/chat-queue/')&&failQueue){failQueue=false;throw new Error('simulated queue outage');}return originalPut(key,value,options);};
  const failed=await handleApi(req('/api/chats/'+threadId+'/messages','POST',{id,text:'Retry this message'},{origin:url}),e);assert.equal(failed.status,503);
  e.BUCKET.put=originalPut;
  assert.equal((await handleApi(req('/api/chats/'+threadId+'/messages','POST',{id:otherId,text:'Another message'},{origin:url}),e)).status,429);
  now+=5*60*1000+1;
  assert.equal((await handleApi(req('/api/chats/'+threadId+'/messages','POST',{id,text:'Retry this message'},{origin:url}),e)).status,201);
  const queue=await(await handleApi(req('/api/runner/chats','GET',null,runner),e)).json();assert.equal(queue.messages.length,20);
 }finally{Date.now=realNow;e.BUCKET.put=originalPut;}
});
test('chat snapshots accept opaque T3 message IDs, exclude extra fields, reject reasoning and retain stale history',async()=>{
 const e=env(),j=(await(await handleApi(req('/api/jobs','POST',task(),{origin:url}),e)).json()).job,id=j.steps[0].threadId,h={authorization:'Bearer secret'};
 const snap={threadId:id,status:'done',messages:[{id:'provider-message:1',role:'assistant',text:'Answer',secret:'never-save'}],capabilities:{model:'gpt-6-astra',context:{usedTokens:22779,maxTokens:258400,updatedAt:'2026-10-10T01:00:00Z',credential:'never-save'}}};
 assert.equal((await handleApi(req('/api/runner/chats/snapshot','POST',snap,h),e)).status,200);
 assert.equal((await handleApi(req('/api/runner/chats/snapshot','POST',{...snap,messages:[{id:'reasoning',role:'reasoning',text:'Hidden'}]},h),e)).status,400);
 const data=await(await handleApi(req('/api/chats/'+id),e)).json();assert.equal(data.stale,true);assert.equal(data.messages[0].text,'Answer');assert.equal(data.messages[0].secret,undefined);
 assert.deepEqual(data.capabilities.context,{usedTokens:22779,maxTokens:258400,updatedAt:'2026-10-10T01:00:00Z'});
 assert.equal((await handleApi(req('/api/runner/chats/snapshot','POST',{...snap,capabilities:{model:'gpt-6-astra',context:{usedTokens:'22779',maxTokens:258400}}},h),e)).status,200);
 assert.equal((await(await handleApi(req('/api/chats/'+id),e)).json()).capabilities.context,null);
});
test('chat history is paged by opaque message cursor and older cursors survive rolling snapshots',async()=>{
 const e=env(),j=(await(await handleApi(req('/api/jobs','POST',task(),{origin:url}),e)).json()).job,id=j.steps[0].threadId,h={authorization:'Bearer secret'};
 const messages=(from,to)=>Array.from({length:to-from},(_,i)=>({id:'provider-message:'+ (from+i),role:i%2?'user':'assistant',text:'Message '+(from+i)}));
 const snapshot={threadId:id,status:'done',messages:messages(0,60)};
 assert.equal((await handleApi(req('/api/runner/chats/snapshot','POST',snapshot,h),e)).status,200);
 const latest=await(await handleApi(req('/api/chats/'+id),e)).json();assert.equal(latest.messages.length,30);assert.equal(latest.messages[0].id,'provider-message:30');assert.equal(latest.hasMoreHistory,true);assert.equal(latest.historyCursor,'provider-message:30');
 const first=await(await handleApi(req('/api/chats/'+id+'/history?before=provider-message%3A30&limit=25'),e)).json();assert.deepEqual(first.messages.map(m=>m.id),messages(5,30).map(m=>m.id));assert.equal(first.hasMoreHistory,true);assert.equal(first.nextCursor,'provider-message:5');
 const last=await(await handleApi(req('/api/chats/'+id+'/history?before=provider-message%3A5&limit=25'),e)).json();assert.deepEqual(last.messages.map(m=>m.id),messages(0,5).map(m=>m.id));assert.equal(last.hasMoreHistory,false);
 assert.equal((await handleApi(req('/api/chats/'+id+'/history?before=missing'),e)).status,404);assert.equal((await handleApi(req('/api/chats/'+id+'/history?before=provider-message%3A30&limit=0'),e)).status,400);
 assert.equal((await handleApi(req('/api/runner/chats/snapshot','POST',{...snapshot,messages:messages(10,70)},h),e)).status,200);
 const retained=await(await handleApi(req('/api/chats/'+id+'/history?before=provider-message%3A30&limit=30'),e)).json();assert.deepEqual(retained.messages.map(m=>m.id),messages(0,30).map(m=>m.id));
});
test('uploads require same-origin and known threads; attachment-only messages keep bytes private and reject cross-thread references',async()=>{
 const e=env(),j=(await(await handleApi(req('/api/jobs','POST',task(),{origin:url}),e)).json()).job,id=j.steps[0].threadId,file=crypto.randomUUID(),route='/api/chats/'+id+'/attachments/'+file;
 const upload=(name='brief.txt',text='ZURI-FILE-OK',origin=url)=>new Request(url+route,{method:'POST',headers:{origin,'x-file-name':encodeURIComponent(name)},body:text});
 assert.equal((await handleApi(upload('brief.txt','x','https://attacker.example'),e)).status,403);
 assert.equal((await handleApi(upload('bad.exe'),e)).status,400);assert.equal((await handleApi(upload('bad.png'),e)).status,400);
 assert.equal((await handleApi(upload(),e)).status,201);assert.equal((await handleApi(upload(),e)).status,200);assert.equal((await handleApi(upload('brief.txt','different'),e)).status,409);
 const v={id:crypto.randomUUID(),text:'',attachments:[file]};const m=await handleApi(req('/api/chats/'+id+'/messages','POST',v,{origin:url}),e);assert.equal(m.status,201);const record=(await m.json()).message;assert.equal(record.attachments[0].name,'brief.txt');assert.equal(record.attachments[0].digest,undefined);
 assert.equal((await handleApi(req('/api/chats/'+j.steps[1].threadId+'/messages','POST',{...v,id:crypto.randomUUID()},{origin:url}),e)).status,400);
 const raw='/api/runner/chats/attachments/'+id+'/'+file;assert.equal((await handleApi(req(raw),e)).status,401);assert.equal(await(await handleApi(req(raw,'GET',null,{authorization:'Bearer secret'}),e)).text(),'ZURI-FILE-OK');
 const browser=await(await handleApi(req('/api/chats/'+id),e)).json();assert.equal(browser.pending[0].attachments[0].name,'brief.txt');assert.equal(JSON.stringify(browser).includes('attachmentId'),false);
});
