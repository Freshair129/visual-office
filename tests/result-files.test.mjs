import test from 'node:test';
import assert from 'node:assert/strict';
import {handleResultFiles} from '../worker/result-files.js';

const base='https://office.example';
const thread='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherThread='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fileId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});

class Bucket{
 values=new Map();
 async put(key,value){this.values.set(key,value)}
 async get(key){
  if(!this.values.has(key))return null;
  const value=this.values.get(key),bytes=value instanceof Uint8Array?value:new TextEncoder().encode(String(value));
  return{size:bytes.byteLength,body:new Response(bytes).body,json:async()=>JSON.parse(new TextDecoder().decode(bytes))};
 }
 async list({prefix,limit=1000}){return{objects:[...this.values.keys()].filter(key=>key.startsWith(prefix)).slice(0,limit).map(key=>({key})),truncated:false};}
}
const env=()=>({BUCKET:new Bucket()});
const jobsFor=threadId=>[{id:'job-1',cancelRequested:false,steps:[{threadId:threadId,status:'done'}]}];
const call=(request,e,jobs=jobsFor(thread))=>handleResultFiles(request,e,{json,uuid,listJobs:async()=>jobs});
const request=(route,method='GET')=>new Request(base+route,{method});

test('the list endpoint returns only bounded public metadata for a known job thread',async()=>{
 const e=env(),metadata={id:fileId,threadId:thread,name:'report.md',type:'file',mimeType:'text/markdown',sizeBytes:4,createdAt:'2026-10-01T00:00:00Z',digest:'private-digest',attachmentId:'runner-id'};
 await e.BUCKET.put(`office/chat-file-meta/${thread}/${fileId}.json`,JSON.stringify(metadata));
 await e.BUCKET.put(`office/chat-files/${thread}/${fileId}`,'real');
 const response=await call(request(`/api/result-files?threadId=${thread}`),e);
 assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.files.length,1);assert.deepEqual(data.files[0],{id:fileId,type:'file',name:'report.md',mimeType:'text/markdown',sizeBytes:4,createdAt:'2026-10-01T00:00:00Z'});
 assert.equal(JSON.stringify(data).includes('private-digest'),false);assert.equal(JSON.stringify(data).includes('runner-id'),false);
});

test('file metadata alone cannot make a thread known, and cancelled job threads remain private',async()=>{
 const e=env();
 assert.equal((await call(request(`/api/result-files?threadId=${otherThread}`),e)).status,404);
 assert.equal((await call(request(`/api/result-files?threadId=${thread}`),e,[{id:'job',cancelRequested:true,steps:[{threadId:thread,status:'running'}]}])).status,404);
 await e.BUCKET.put('office/latest.json',JSON.stringify({sessions:[{id:otherThread}]}));
 assert.equal((await call(request(`/api/result-files?threadId=${otherThread}`),e,[])).status,200);
});

test('downloads stream bounded bytes with safe attachment headers and no-store protections',async()=>{
 const e=env(),name='แผนงาน final.md',metadata={id:fileId,threadId:thread,name,type:'file',mimeType:'text/markdown',sizeBytes:4,createdAt:'2026-10-01T00:00:00Z'};
 await e.BUCKET.put(`office/chat-file-meta/${thread}/${fileId}.json`,JSON.stringify(metadata));
 await e.BUCKET.put(`office/chat-files/${thread}/${fileId}`,new TextEncoder().encode('real'));
 const response=await call(request(`/api/result-files/${thread}/${fileId}/download`),e);
 assert.equal(response.status,200);assert.equal(await response.text(),'real');
 assert.equal(response.headers.get('content-type'),'application/octet-stream');
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.match(response.headers.get('content-disposition'),/filename="attachment\.bin"/);
 assert.match(response.headers.get('content-disposition'),/UTF-8''%/);
});

test('downloads reject files whose stored byte count exceeds the upload bound or metadata size',async()=>{
 const e=env(),metadata={id:fileId,threadId:thread,name:'brief.txt',type:'file',mimeType:'text/plain',sizeBytes:3};
 await e.BUCKET.put(`office/chat-file-meta/${thread}/${fileId}.json`,JSON.stringify(metadata));
 await e.BUCKET.put(`office/chat-files/${thread}/${fileId}`,new TextEncoder().encode('longer'));
 assert.equal((await call(request(`/api/result-files/${thread}/${fileId}/download`),e)).status,404);
});

test('the result-files API is read-only and rejects malformed identifiers',async()=>{
 const e=env();
 assert.equal((await call(request('/api/result-files','POST'),e)).status,405);
 assert.equal((await call(request('/api/result-files?threadId=bad'),e)).status,400);
 assert.equal((await call(request(`/api/result-files/${thread}/bad/download`),e)).status,400);
});
