import test from 'node:test';
import assert from 'node:assert/strict';
import {handleWorkReview} from '../worker/work-review.js';

class Bucket{
 values=new Map();etags=new Map();writes=[];version=0;
 async put(key,value,options={}){
  const condition=options.onlyIf;
  if(condition instanceof Headers&&condition.get('if-none-match')==='*'&&this.values.has(key))return null;
  if(condition?.etagMatches&&this.etags.get(key)!==condition.etagMatches)return null;
  this.values.set(key,String(value));const etag=String(++this.version);this.etags.set(key,etag);this.writes.push({key,options});return{etag};
 }
 async get(key){const value=this.values.get(key);return value===undefined?null:{etag:this.etags.get(key),json:async()=>JSON.parse(value)};}
 async list({prefix,cursor}){return{objects:[...this.values.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false,cursor};}
}
const base='https://office.example';
const makeJob=(id,status='done')=>({id,title:'Evidence review',team:false,agentIds:['beam'],status,steps:[{agentId:'beam',threadId:'7e8b1b19-2ad0-40f8-9bf6-8fefc4625929',phase:'specialist',status,result:'Source checked'}]});
const request=(path,method='GET',value,origin=base)=>new Request(base+path,{method,headers:{...(origin?{origin}:{}),...(value?{'content-type':'application/json'}:{})},...(value?{body:JSON.stringify(value)}:{})});
const helpers={
 json:(value,status=200)=>Response.json(value,{status}),
 body:async(req,max=10000)=>{const source=await req.text();if(source.length>max)throw new Error('Payload too large');return JSON.parse(source);},
 uuid:value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
 listJobs:async bucket=>{const page=await bucket.list({prefix:'office/jobs/'});return Promise.all(page.objects.map(async object=>(await bucket.get(object.key)).json()));}
};
const call=(bucket,req)=>handleWorkReview(req,{BUCKET:bucket},helpers);
const payload=(jobId,reviewStatus='pending',action='metadata')=>({jobId,dueDate:'2026-10-18',acceptance:'Include verified sources',reviewStatus,note:'Check date and scope',action});

test('edit-base precondition blocks stale forms before writes or handoff creation',async()=>{
 const bucket=new Bucket(),id=crypto.randomUUID(),path='/api/work-reviews/'+id;
 await bucket.put('office/jobs/'+id+'.json',JSON.stringify(makeJob(id)));
 const first=await call(bucket,request(path,'PUT',{...payload(id),baseUpdatedAt:null}));assert.equal(first.status,200);
 const saved=(await first.json()).review,count=bucket.writes.length;
 for(const body of [
  {...payload(id),acceptance:'stale edit',baseUpdatedAt:null},
  {...payload(id,'changes_requested','changes_requested'),note:'stale handoff',baseUpdatedAt:'2020-01-01T00:00:00.000Z'}
 ]){
  const rejected=await call(bucket,request(path,'PUT',body));assert.equal(rejected.status,409);assert.equal((await rejected.json()).code,'REVIEW_CONFLICT');
 }
 assert.equal(bucket.writes.length,count);assert.equal(JSON.parse(bucket.values.get('office/reviews/'+id+'.json')).updatedAt,saved.updatedAt);
 const retry=await call(bucket,request(path,'PUT',{...payload(id),baseUpdatedAt:null}));assert.equal(retry.status,200);assert.equal(bucket.writes.length,count);
 const updated=await call(bucket,request(path,'PUT',{...payload(id),acceptance:'fresh edit',baseUpdatedAt:saved.updatedAt}));assert.equal(updated.status,200);
});

test('edit-base rejects malformed values and distinguishes consecutive same-millisecond revisions',async t=>{
 const bucket=new Bucket(),id=crypto.randomUUID(),path='/api/work-reviews/'+id;
 await bucket.put('office/jobs/'+id+'.json',JSON.stringify(makeJob(id)));
 for(const baseUpdatedAt of [false,4,{},'', 'yesterday'])assert.equal((await call(bucket,request(path,'PUT',{...payload(id),baseUpdatedAt}))).status,400);
 const fixed=Date.parse('2026-10-27T00:00:00.000Z');t.mock.method(Date,'now',()=>fixed);
 const first=(await(await call(bucket,request(path,'PUT',{...payload(id),baseUpdatedAt:null}))).json()).review;
 const second=(await(await call(bucket,request(path,'PUT',{...payload(id),note:'second',baseUpdatedAt:first.updatedAt}))).json()).review;
 assert.ok(Date.parse(second.updatedAt)>Date.parse(first.updatedAt));
 const third=await call(bucket,request(path,'PUT',{...payload(id),note:'third',baseUpdatedAt:first.updatedAt}));assert.equal(third.status,409);
});

test('review metadata persists separately from provider jobs and duplicate PUTs are idempotent',async()=>{
 const bucket=new Bucket(),id='7d2d9201-e9ea-4b43-8f0d-e1f9c398c105',job=makeJob(id);
 await bucket.put('office/jobs/'+id+'.json',JSON.stringify(job));
 const first=await call(bucket,request('/api/work-reviews/'+id,'PUT',payload(id)));
 assert.equal(first.status,200);const saved=(await first.json()).review;
 const{action:_action,...expectedReview}=payload(id);assert.deepEqual({...saved,updatedAt:null},{...expectedReview,updatedAt:null});
 assert.deepEqual(JSON.parse(bucket.values.get('office/jobs/'+id+'.json')),job);
 const writeCount=bucket.writes.length;
 const retry=await call(bucket,request('/api/work-reviews/'+id,'PUT',payload(id)));
 assert.equal(retry.status,200);assert.equal(bucket.writes.length,writeCount);assert.equal((await retry.json()).review.updatedAt,saved.updatedAt);
 assert.deepEqual(bucket.writes.map(write=>write.key),['office/jobs/'+id+'.json','office/reviews/'+id+'.json']);
});

test('review reads validate known jobs, return collection data, and keep provider completion separate',async()=>{
 const bucket=new Bucket(),doneId='9c4d3b4d-3202-48b6-b50c-02a885d4bd26',runningId='2e35f323-5446-4c1f-a195-0e18c81de12c';
 await bucket.put('office/jobs/'+doneId+'.json',JSON.stringify(makeJob(doneId,'done')));
 await bucket.put('office/jobs/'+runningId+'.json',JSON.stringify(makeJob(runningId,'running')));
 assert.equal((await call(bucket,request('/api/work-reviews/'+doneId,'PUT',payload(doneId,'accepted')))).status,200);
 assert.equal((await call(bucket,request('/api/work-reviews/'+runningId,'PUT',payload(runningId,'accepted')))).status,409);
 assert.equal((await call(bucket,request('/api/work-reviews/'+runningId,'PUT',payload(runningId,'pending')))).status,200);
 assert.equal((await call(bucket,request('/api/work-reviews','PUT',payload(runningId,'pending')))).status,200);
 const item=await(await call(bucket,request('/api/work-reviews/'+doneId))).json();assert.equal(item.review.reviewStatus,'accepted');
 assert.equal((await call(bucket,request('/api/work-reviews/'+crypto.randomUUID()))).status,404);
 const collection=await(await call(bucket,request('/api/work-reviews'))).json();assert.deepEqual(collection.reviews.map(review=>review.jobId).sort(),[doneId,runningId].sort());
});

test('review mutations require same origin and reject malformed metadata, unknown tasks, and mismatched IDs',async()=>{
 const bucket=new Bucket(),id='0108af47-46fd-4617-9b82-c47247e3b149';await bucket.put('office/jobs/'+id+'.json',JSON.stringify(makeJob(id)));
 assert.equal((await call(bucket,request('/api/work-reviews/'+id,'PUT',payload(id), 'https://attacker.example'))).status,403);
 assert.equal((await call(bucket,request('/api/work-reviews/'+id,'PUT',{...payload(id),dueDate:'2026-02-30'}))).status,400);
 assert.equal((await call(bucket,request('/api/work-reviews/'+id,'PUT',{...payload(id),jobId:'9c4d3b4d-3202-48b6-b50c-02a885d4bd26'}))).status,400);
 assert.equal((await call(bucket,request('/api/work-reviews/'+crypto.randomUUID(),'PUT',payload(crypto.randomUUID())))).status,400);
 assert.equal((await call(bucket,request('/api/work-reviews/2e35f323-5446-4c1f-a195-0e18c81de12c','PUT',payload('2e35f323-5446-4c1f-a195-0e18c81de12c')))).status,404);
 assert.equal((await call(bucket,request('/api/work-reviews/not-a-uuid'))).status,400);
});

test('changes requested atomically queues one bounded chat message and retries return the same handoff',async()=>{
 const bucket=new Bucket(),id='cf2cae77-c14b-491c-9ba1-99e2e6d49f39',job=makeJob(id);await bucket.put('office/jobs/'+id+'.json',JSON.stringify(job));
 const body={...payload(id,'changes_requested','changes_requested'),baseUpdatedAt:null},path='/api/work-reviews/'+id;
 const first=await call(bucket,request(path,'PUT',body));assert.equal(first.status,200);const firstData=await first.json();
 assert.equal(firstData.handoff.status,'queued');assert.equal(firstData.handoff.threadId,job.steps[0].threadId);
 const outboxKey='office/review-handoff-outbox/'+firstData.review.handoff.revisionId+'.json';assert.equal(JSON.parse(bucket.values.get(outboxKey)).status,'queued');
 const key='office/chat-queue/'+job.steps[0].threadId+'/'+firstData.handoff.messageId+'.json';const message=JSON.parse(bucket.values.get(key));
 assert.equal(message.id,firstData.handoff.messageId);assert.equal(message.commandId,firstData.review.handoff.commandId);assert.equal(message.status,'queued');
 assert.match(message.text,new RegExp(id));assert.match(message.text,/Evidence review/);assert.match(message.text,/Check date and scope/);assert.match(message.text,/Include verified sources/);
 await bucket.put(key,JSON.stringify({...message,status:'sent'}));
 const queueWrites=bucket.writes.filter(write=>write.key.startsWith('office/chat-queue/')).length;
 const retry=await call(bucket,request(path,'PUT',body));assert.equal(retry.status,200);const retryData=await retry.json();
 assert.equal(retryData.handoff.messageId,firstData.handoff.messageId);assert.equal(retryData.handoff.status,'sent');assert.equal(JSON.parse(bucket.values.get(key)).status,'sent');assert.equal(bucket.writes.filter(write=>write.key.startsWith('office/chat-queue/')).length,queueWrites);
});

test('concurrent duplicate change requests converge on one durable queue record',async()=>{
 const bucket=new Bucket(),id='83a9f31c-4d1f-4f97-a343-9258095f7e5b',job=makeJob(id);await bucket.put('office/jobs/'+id+'.json',JSON.stringify(job));
 const path='/api/work-reviews/'+id,body={...payload(id,'changes_requested','changes_requested'),baseUpdatedAt:null};
 const responses=await Promise.all([call(bucket,request(path,'PUT',body)),call(bucket,request(path,'PUT',body))]);
 assert.deepEqual(responses.map(response=>response.status),[200,200]);
 const data=await Promise.all(responses.map(response=>response.json()));assert.equal(data[0].handoff.messageId,data[1].handoff.messageId);
 const messages=[...bucket.values.keys()].filter(key=>key.startsWith('office/chat-queue/'));assert.equal(messages.length,1);
 assert.equal(bucket.writes.filter(write=>write.key===messages[0]).length,1);
});

test('failed queue persistence leaves a retryable durable handoff intent without claiming success',async()=>{
 const bucket=new Bucket(),id='414a6b86-4823-4826-b2eb-909beaeef903',job=makeJob(id);await bucket.put('office/jobs/'+id+'.json',JSON.stringify(job));
 const originalPut=bucket.put.bind(bucket);let failOnce=true;
 bucket.put=async(key,value,options)=>{if(key.startsWith('office/chat-queue/')&&failOnce){failOnce=false;throw new Error('simulated queue outage');}return originalPut(key,value,options);};
 const path='/api/work-reviews/'+id,body=payload(id,'changes_requested','changes_requested');
 const failed=await call(bucket,request(path,'PUT',body));assert.equal(failed.status,503);assert.match((await failed.json()).error,/คิวแชท/);
 const saved=JSON.parse(bucket.values.get('office/reviews/'+id+'.json'));assert.ok(saved.handoff);const outboxKey='office/review-handoff-outbox/'+saved.handoff.revisionId+'.json';assert.equal(JSON.parse(bucket.values.get(outboxKey)).status,'pending');assert.equal([...bucket.values.keys()].filter(key=>key.startsWith('office/chat-queue/')).length,0);
 const retry=await call(bucket,request(path,'PUT',body));assert.equal(retry.status,200);const data=await retry.json();assert.equal(data.handoff.status,'queued');
 assert.equal(JSON.parse(bucket.values.get(outboxKey)).status,'queued');
 assert.equal([...bucket.values.keys()].filter(key=>key.startsWith('office/chat-queue/')).length,1);
});

test('handoff requires a note and one unambiguous completed destination',async()=>{
 const bucket=new Bucket(),id='fe0fc93d-82ab-4da6-9131-641f983401ee',job=makeJob(id);await bucket.put('office/jobs/'+id+'.json',JSON.stringify(job));
 const path='/api/work-reviews/'+id;
 assert.equal((await call(bucket,request(path,'PUT',{...payload(id,'changes_requested','changes_requested'),note:'  '}))).status,400);
 job.steps.push({...job.steps[0],threadId:'b90194ce-123c-4bef-81c4-f5db667f105b'});await bucket.put('office/jobs/'+id+'.json',JSON.stringify(job));
 const ambiguous=await call(bucket,request(path,'PUT',payload(id,'changes_requested','changes_requested')));assert.equal(ambiguous.status,409);assert.match((await ambiguous.json()).error,/ปลายทาง/);
});

test('team handoffs target exactly one synthesis step and metadata saves never enqueue',async()=>{
 const bucket=new Bucket(),id='59f67c7c-a4ef-4e60-a042-c6fdb14f86e7',job=makeJob(id);job.team=true;job.agentIds=['beam','kai'];job.steps=[
  {...job.steps[0],agentId:'beam'},
  {agentId:'kai',threadId:'f3c8d489-9b21-49f5-875c-0e924407e597',phase:'specialist',status:'done'},
  {agentId:'mira',threadId:'491685b3-f4b5-4f6b-b8b5-8e38372ae44f',phase:'synthesis',status:'done'}
 ];await bucket.put('office/jobs/'+id+'.json',JSON.stringify(job));
 const path='/api/work-reviews/'+id;
 const first=await call(bucket,request(path,'PUT',payload(id,'changes_requested','changes_requested')));assert.equal(first.status,200);const data=await first.json();
 assert.equal(data.handoff.threadId,job.steps[2].threadId);
 const before=bucket.writes.filter(write=>write.key.startsWith('office/chat-queue/')).length;
 const metadata=await call(bucket,request(path,'PUT',{...payload(id,'changes_requested','metadata'),acceptance:'Add a source list',note:'  '}));assert.equal(metadata.status,200);
 assert.equal(bucket.writes.filter(write=>write.key.startsWith('office/chat-queue/')).length,before);
});
