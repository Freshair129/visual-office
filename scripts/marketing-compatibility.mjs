// Synthetic-only producer/consumer qualification. No listening server or live fetch.
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createZuriConnector} from './zuri-connector.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const subset=(actual,expected)=>{if(Array.isArray(expected)){assert.ok(Array.isArray(actual));assert.equal(actual.length,expected.length);expected.forEach((v,i)=>subset(actual[i],v));}else if(expected&&typeof expected==='object'&&!Array.isArray(expected)){assert.ok(actual&&typeof actual==='object');for(const [key,value] of Object.entries(expected))subset(actual[key],value);}else assert.deepEqual(actual,expected);};
export async function runMarketingVectors(bundle){
 if(bundle.schemaVersion===1){
  assert.equal(bundle.profile,'marketing-office-read-v1');assert.equal(bundle.synthetic,true);assert.ok(Array.isArray(bundle.vectors)&&bundle.vectors.length>0);
  const forbidden=bundle.forbiddenOutputMarkers||[];assert.ok(Array.isArray(forbidden)&&forbidden.every(x=>typeof x==='string'&&x.length));
  bundle={schemaVersion:'office-marketing-vectors/v1',cases:bundle.vectors.map(v=>{
   assert.ok(['entry','campaign','ask'].includes(v.kind));assert.ok(['producer','mutation','transport'].includes(v.origin));const body={};
   for(const k of ['state','businesses','records','returnedCount','truncated','response'])if(k in v.expect)body[k]=v.expect[k];if(v.expect.errorCode)body.error={code:v.expect.errorCode};
   const business=new URL(v.request.path,'http://127.0.0.1:4182').searchParams.get('businessId');
   const path=v.kind==='entry'?'/api/entry':v.kind==='campaign'?`/api/growth/campaigns?businessId=${business}`:'/api/growth/ask-marketing';
   return {id:v.id,request:v.request,upstream:v.expect.noUpstream?null:{...v.upstream,path,method:v.kind==='ask'?'POST':'GET',...(v.kind==='ask'?{requestBody:{...v.request.body,question:v.request.body.question.trim()}}:{})},expect:{status:v.expect.httpStatus,upstreamCalls:v.expect.noUpstream?0:1,body,absent:['PRIVATE_',...forbidden],...([403,404].includes(v.upstream.status)?{equalGroup:v.kind+'-denied'}:{})}};
  })};
 }
 assert.equal(bundle.schemaVersion,'office-marketing-vectors/v1');assert.ok(Array.isArray(bundle.cases)&&bundle.cases.length>0);const ids=new Set(),groups=new Map(),results=[];
 for(const vector of bundle.cases){
  assert.equal(typeof vector.id,'string');assert.ok(!ids.has(vector.id));ids.add(vector.id);
  const {request,upstream,expect}=vector;assert.ok(['/api/zuri/scope','/api/zuri/domains/growth','/api/zuri/domains/growth/ask'].includes(new URL(request.path,'http://127.0.0.1:4182').pathname));
  let calls=0,violation;const connector=createZuriConnector({enabled:true,now:()=>new Date('2026-10-24T00:00:00Z'),fetchImpl:async(input,init)=>{
   try {calls++;assert.ok(upstream,'unexpected upstream call');assert.equal(calls,1);const url=new URL(input);assert.equal(url.origin,'http://127.0.0.1:3100');assert.equal(url.pathname+url.search,upstream.path);assert.equal(init.method,upstream.method||'GET');
   if('requestBody' in upstream)assert.deepEqual(JSON.parse(init.body),upstream.requestBody);
   }catch(error){violation=error;throw error;}
   return new Response(JSON.stringify(upstream.body),{status:upstream.status,headers:{'content-type':'application/json'}});
  }});
  const req=Readable.from(request.body===undefined?[]:[Buffer.from(JSON.stringify(request.body))]);req.method=request.method||'GET';req.headers={host:'127.0.0.1:4182',origin:'http://127.0.0.1:4182','content-type':'application/json',...(request.auth===false?{}:{cookie:'zuri_session=synthetic_fixture_only'})};req.socket={remoteAddress:'127.0.0.1',localPort:4182};
  let status,raw;const res={headersSent:false,writeHead(code){status=code;this.headersSent=true;},end(text){raw=text;}};
  assert.equal(await connector(req,res,new URL(request.path,'http://127.0.0.1:4182')),true);if(violation)throw violation;assert.equal(calls,expect.upstreamCalls);assert.equal(status,expect.status,vector.id);const body=JSON.parse(raw);try{subset(body,expect.body);}catch(error){throw new Error(`${vector.id}: ${error.message}`,{cause:error});}
  for(const token of expect.absent||[])assert.ok(!raw.includes(token),`${vector.id}: leaked forbidden value`);
  if(expect.equalGroup){const previous=groups.get(expect.equalGroup);if(previous)assert.deepEqual({status,body},previous,vector.id);else groups.set(expect.equalGroup,{status,body});}
  results.push({id:vector.id,status:'PASS',upstreamCalls:calls});
 }
 return {status:'PASS',cases:results.length,results,live:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [file,sha]=process.argv.slice(2);assert.ok(file&&/^[a-f0-9]{64}$/.test(sha||''),'Usage: node scripts/marketing-compatibility.mjs <vectors.json> <sha256>');
 const bytes=await readFile(file);assert.equal(hash(bytes),sha,'shared vector hash mismatch');const result=await runMarketingVectors(JSON.parse(bytes));console.log(JSON.stringify({...result,vectorsSha256:sha},null,2));
}
