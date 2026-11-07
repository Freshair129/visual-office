import test from 'node:test';import assert from 'node:assert/strict';import {ZuriConnector} from '../web/zuri-connector.js';
test('context connector rejects protected errors equally and consumes bounded stream only on success',async()=>{
 for(const status of [403,404]){const c=new ZuriConnector({fetchImpl:async()=>new Response('private secret',{status})});await assert.rejects(c.getDomainContext('a'),e=>e.status===403&&e.code==='CONTEXT_UNAVAILABLE');}
 const c=new ZuriConnector({fetchImpl:async()=>new Response(' '.repeat(65537))});await assert.rejects(c.getDomainContext('a'));assert.throws(()=>c.getDomainContext('a&role=OWNER'));
});
