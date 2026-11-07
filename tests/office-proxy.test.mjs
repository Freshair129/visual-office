import test from 'node:test';
import assert from 'node:assert/strict';
import {proxyOfficeRequest} from '../scripts/office-proxy.mjs';
const id='11111111-1111-4111-8111-111111111111',origin='http://127.0.0.1:4200';
const config={siteUrl:'https://office.example',siteBearer:'synthetic-only'};
test('proxy forwards formerly missing browser reads and preserves query/status',async()=>{
 for(const path of ['/api/work-reviews','/api/work-reviews/'+id,'/api/chats/'+id+'/history?before=message&limit=30','/api/result-files?threadId='+id]){
  let called;const result=await proxyOfficeRequest(new Request(origin+path),{config,fetchImpl:async(url,options)=>{called={url,options};return Response.json({ok:true},{status:206});}});
  assert.equal(called.url,config.siteUrl+path);assert.equal(result.status,206);assert.equal(called.options.method,'GET');
 }
});
test('download bytes and safe content headers survive proxy without JSON conversion',async()=>{
 const bytes=Uint8Array.of(0,255,128,13,10);
 const response=await proxyOfficeRequest(new Request(origin+'/api/result-files/'+id+'/'+id+'/download'),{config,fetchImpl:async()=>new Response(bytes,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="result.bin"','x-content-type-options':'nosniff','content-length':'1'}})});
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);assert.match(response.headers.get('content-disposition'),/result.bin/);assert.equal(response.headers.get('content-type'),'application/octet-stream');
 assert.equal(response.headers.get('content-length'),null,'fetch may decode a compressed response; Node computes the actual wire length');
});
test('proxy rejects runner, unknown, wrong-method and cross-origin writes without fetch',async()=>{
 const fetchImpl=()=>{throw Error('must not fetch');};
 for(const [path,method,headers,status] of [['/api/runner/jobs','GET',{},404],['/api/missing','GET',{},404],['/api/jobs','DELETE',{},405],['/api/team','PUT',{origin:'https://wrong.example'},403]]){
  const r=await proxyOfficeRequest(new Request(origin+path,{method,headers}),{config,fetchImpl});assert.equal(r.status,status);
 }
 const r=await proxyOfficeRequest(new Request(origin+'/api/jobs',{method:'DELETE'}),{config,fetchImpl});assert.equal(r.headers.get('allow'),'GET, POST');
});
test('proxy forwards same-origin review writes and bounds request bodies',async()=>{
 let called;const fetchImpl=async(url,options)=>{called=options;return Response.json({ok:true});};
 const request=new Request(origin+'/api/work-reviews/'+id,{method:'PUT',headers:{origin,'content-type':'application/json'},body:'{}'});
 assert.equal((await proxyOfficeRequest(request,{config,fetchImpl})).status,200);assert.equal(called.headers.origin,config.siteUrl);assert.equal(new TextDecoder().decode(called.body),'{}');
 const large=new Request(origin+'/api/jobs',{method:'POST',headers:{origin},body:'a'.repeat(48001)});
 assert.equal((await proxyOfficeRequest(large,{config,fetchImpl:()=>{throw Error('must not forward');}})).status,413);
});
