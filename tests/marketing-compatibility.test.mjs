import test from 'node:test';import assert from 'node:assert/strict';
import {runMarketingVectors} from '../scripts/marketing-compatibility.mjs';
test('synthetic runner requires exact upstream and checks complete denial equality',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const bundle={schemaVersion:'office-marketing-vectors/v1',cases:[403,404].map(status=>({id:`denied-${status}`,request:{path:`/api/zuri/domains/growth?businessId=${id}`},upstream:{path:`/api/growth/campaigns?businessId=${id}`,status,body:{error:{code:`PRIVATE_${status}`}}},expect:{status:200,upstreamCalls:1,body:{state:'FORBIDDEN',source:{status:403}},absent:['PRIVATE_','sourceCode'],equalGroup:'campaign-denied'}}))};
 assert.equal((await runMarketingVectors(bundle)).cases,2);bundle.cases[0].upstream.path='/unexpected';await assert.rejects(runMarketingVectors(bundle));
});

test('upstream assertion cannot be swallowed into an expected UNAVAILABLE',async()=>{
 const bundle={schemaVersion:'office-marketing-vectors/v1',cases:[{id:'wrong-url-error',request:{path:'/api/zuri/domains/growth?businessId=11111111-1111-4111-8111-111111111111'},upstream:{path:'/wrong',status:500,body:{}},expect:{status:200,upstreamCalls:1,body:{state:'UNAVAILABLE'}}}]};
 await assert.rejects(runMarketingVectors(bundle));
});
