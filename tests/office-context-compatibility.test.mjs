import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseOfficeDomainContext,readContextJSON} from '../web/office-domain-context.js';
import {contextVectorResponse} from '../scripts/synthetic-domain-context.mjs';
const bytes=await readFile(new URL('./fixtures/marketing-office/domain-context-v1.json',import.meta.url));
const bundle=JSON.parse(bytes);
test('producer candidate fixture is byte-pinned without regenerating its source',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'68aae4bddcb5fd737945974a40cdf815e739426603e0d5b8a0ce3b4c1c4d6a7b');
 assert.equal(bundle.vectors.length,96);
});
for(const vector of bundle.vectors)test(`candidate compatibility: ${vector.id} [${vector.origin}]`,async()=>{
 let accepted=false,result,raw;
 try{
  const response=contextVectorResponse(vector);
  if(!response.ok)throw Error('Scope unavailable');
  raw=await readContextJSON(response);
  result=parseOfficeDomainContext(raw,vector.request.businessId,{wallNow:()=>bundle.clock.wallNowMs});
  accepted=true;
 }catch{}
 assert.equal(accepted,vector.expect.accept,vector.id);
 if(accepted){
  const expected=vector.wire?JSON.parse(Buffer.concat(vector.wire.chunks.map(c=>Buffer.from(c,'base64'))).toString('utf8')):vector.upstream.body;
  assert.deepEqual(raw,expected);assert.deepEqual(result,expected);
 }
});
