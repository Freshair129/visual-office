import test from 'node:test';import assert from 'node:assert/strict';
import {handleApi} from '../worker/index.js';
const req=(path,method='GET',body)=>new Request('http://127.0.0.1:4185'+path,{method,headers:{cookie:'private-cookie',authorization:'Bearer private-token',origin:'http://127.0.0.1:4185'},...(body?{body:JSON.stringify(body)}:{})});
test('Worker Zuri reads default disabled without storage and never activate from public origin',async()=>{
 const status=await handleApi(req('/api/zuri/status'),{});assert.equal(status.status,200);assert.equal((await status.json()).enabled,false);
 let calls=0;const env={OFFICE_SYNTHETIC:true,SYNTHETIC_ZURI:{fetch:async()=>{calls++;return Response.json({});}}};
 assert.equal((await handleApi(new Request('https://office.example/api/zuri/scope'),env)).status,503);assert.equal(calls,0);
});
test('Worker synthetic seam allows only reads and strips credentials before injected service',async()=>{
 const calls=[],env={OFFICE_SYNTHETIC:true,SYNTHETIC_ZURI:{fetch:async r=>{calls.push(r);return Response.json({state:'READY'});}}};
 assert.equal((await handleApi(req('/api/zuri/domains/growth/ask','POST',{businessId:'a',question:''}),env)).status,200);
 assert.equal(calls[0].headers.get('cookie'),null);assert.equal(calls[0].headers.get('authorization'),null);assert.equal((await calls[0].json()).question,'');
 assert.equal((await handleApi(req('/api/zuri/domains/growth/ask','DELETE'),env)).status,405);
 assert.equal((await handleApi(req('/api/zuri/agent/dispatch','POST',{}),env)).status,404);assert.equal(calls.length,1);
});

test('synthetic context transport is bounded, strips credentials and rejects extra scope parameters',async()=>{
 let forwarded;const env={OFFICE_SYNTHETIC:true,SYNTHETIC_ZURI:{fetch:async request=>{forwarded=request;return Response.json({});}}};
 const path='/api/zuri/synthetic/domain-context?businessId=a';assert.equal((await handleApi(req(path),{})).status,503);assert.equal((await handleApi(req(path),env)).status,200);assert.equal(forwarded.headers.get('cookie'),null);
 for(const suffix of ['&tenantId=x','&businessId=b','&role=OWNER'])assert.equal((await handleApi(req(path+suffix),env)).status,400);
});
