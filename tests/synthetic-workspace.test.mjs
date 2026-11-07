import test from 'node:test';import assert from 'node:assert/strict';
import {handleApi} from '../worker/index.js';import {createSyntheticWorkspace,SyntheticBucket,syntheticBodyLimit} from '../scripts/synthetic-workspace.mjs';
const origin='http://127.0.0.1:4185';
const req=(path,method='GET',value)=>new Request(origin+path,{method,headers:{origin,'content-type':'application/json'},...(value?{body:JSON.stringify(value)}:{})});
test('synthetic workspace exercises real chat queue and task APIs without a runner or upstream',async()=>{
 const fixture=await createSyntheticWorkspace(),env={BUCKET:fixture.bucket};
 const office=await(await handleApi(req('/api/office'),env)).json();assert.equal(office.stale,false);assert.equal(office.sessions.length,6);
 const thread=fixture.sessions[0].id,chat=await(await handleApi(req('/api/chats/'+thread),env)).json();assert.equal(chat.messages.length,30);assert.equal(chat.hasMoreHistory,true);
 const message={id:crypto.randomUUID(),text:'Synthetic test only'};
 assert.equal((await handleApi(req('/api/chats/'+thread+'/messages','POST',message),env)).status,201);
 assert.equal((await handleApi(req('/api/chats/'+thread+'/messages','POST',message),env)).status,200);
 const job={id:crypto.randomUUID(),title:'Synthetic new task',brief:'No actual Agent run',agentIds:['beam'],team:false};
 assert.equal((await handleApi(req('/api/jobs','POST',job),env)).status,201);
 assert.equal((await handleApi(req('/api/runner/jobs'),env)).status,401);
 const jobs=await(await handleApi(req('/api/jobs'),env)).json();assert.ok(jobs.jobs.some(j=>j.id===job.id));
 assert.equal(jobs.jobs.find(j=>j.status==='waiting').domainKey,'projects');assert.equal(jobs.jobs.find(j=>j.status==='running').domainKey,'growth');
 assert.equal(jobs.jobs.find(j=>j.id===job.id).domainKey,undefined);
 const knowledge=await(await handleApi(req('/api/knowledge'),env)).json();assert.ok(Array.isArray(knowledge.versions));
});
test('memory fixture retains R2 conditional writes rather than bypassing queue conflict behavior',async()=>{
 const b=new SyntheticBucket();const first=await b.put('key','{}');assert.equal(await b.put('key','{}',{onlyIf:new Headers({'if-none-match':'*'})}),null);
 assert.equal(await b.put('key','{}',{onlyIf:{etagMatches:'stale'}}),null);assert.ok(await b.put('key','{}',{onlyIf:{etagMatches:first.etag}}));
});
test('harness accepts supported workspace file sizes without increasing Zuri transport bounds',()=>{
 assert.equal(syntheticBodyLimit('/api/chats/76666666-6666-4666-8666-000000000001/attachments/76666666-6666-4666-8666-000000000009',true),8*1024*1024);
 assert.equal(syntheticBodyLimit('/api/knowledge/files/76666666-6666-4666-8666-000000000009',true),8*1024*1024);
 assert.equal(syntheticBodyLimit('/api/zuri/growth/ask-marketing',true),16384);
 assert.equal(syntheticBodyLimit('/api/jobs',false),16384);
});
