import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOfficeApi,OFFICE_API_ROUTES} from '../shared/office-api-routes.js';
import {handleApi} from '../worker/index.js';
const id='11111111-1111-4111-8111-111111111111';
test('every registered endpoint has explicit methods, ownership and consumers',()=>{
 for(const route of OFFICE_API_ROUTES){assert.ok(route.methods.length);assert.ok(route.owner);assert.ok(route.consumers.length);assert.equal(resolveOfficeApi(route.example)?.id,route.id);}
 for(const path of ['/api/chats/'+id+'/history','/api/work-reviews','/api/work-reviews/'+id,'/api/result-files','/api/result-files/'+id+'/'+id+'/download'])assert.ok(resolveOfficeApi(path)?.browser,path);
 assert.equal(resolveOfficeApi('/api/no-such-route'),null);
 assert.equal(resolveOfficeApi('/api/chats/'+id+'/history/'+id),null);
});
test('Worker rejects wrong methods and unknown endpoints before any storage access',async()=>{
 const env={get BUCKET(){throw Error('must not access storage');}};
 for(const route of OFFICE_API_ROUTES.filter(r=>r.worker&&r.owner!=='zuri')){
  const response=await handleApi(new Request('https://office.example'+route.example,{method:'DELETE'}),env);
  assert.equal(response.status,405,route.id);assert.equal(response.headers.get('allow'),route.methods.join(', '));
 }
 assert.equal((await handleApi(new Request('https://office.example/api/missing'),env)).status,404);
});
test('synthetic Zuri method rejections also advertise the allowed method without enabling transport',async()=>{
 for(const [path,method] of [['/api/zuri/status','GET'],['/api/zuri/scope','GET'],['/api/zuri/synthetic/domain-context','GET'],['/api/zuri/domains/projects','GET'],['/api/zuri/domains/growth','GET'],['/api/zuri/domains/growth/ask','POST']]){
  const response=await handleApi(new Request('http://127.0.0.1:4200'+path,{method:'DELETE'}),{});
  assert.equal(response.status,405);assert.equal(response.headers.get('allow'),method);
 }
});
