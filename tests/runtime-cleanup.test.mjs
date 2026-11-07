import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {safeZuriLoginUrl,safeZuriBusinessesUrl,safeZuriDomainUrl,ZuriConnector} from '../web/zuri-connector.js';
import {CloudClient} from '../web/cloud-client.js';
test('unreported Zuri targets never produce guessed navigation links',()=>{
 assert.equal(safeZuriLoginUrl(), '');assert.equal(safeZuriBusinessesUrl(), '');assert.throws(()=>safeZuriDomainUrl('projects','a'),TypeError);
});
test('browser connector rejects unsupported methods before requesting a known route',async()=>{
 let calls=0;const client=new ZuriConnector({fetchImpl:async()=>{calls++;return Response.json({});}});
 await assert.rejects(()=>client.request('/api/zuri/status',{method:'DELETE'}),TypeError);
 await assert.rejects(()=>client.request('/api/zuri/domains/growth/ask',{method:'GET'}),TypeError);assert.equal(calls,0);
});
test('retired direct T3 browser client is physically absent and runtime demo has no invented work',async()=>{
 await assert.rejects(access('web/t3-client.js'));const app=await readFile('web/app.js','utf8');
 assert.doesNotMatch(app,/demoSessions|campaigns\/q4-launch|reports\/campaign-performance|id:'demo-/);
 const cloud=await readFile('web/cloud-client.js','utf8');assert.doesNotMatch(cloud,/setThreadIds\(\)\{\}/);
});
test('cloud transport rejects malformed jobs/team and clears stale workspace data on failure',async t=>{
 const jobs=[],states=[],snapshots=[];
 const client=new CloudClient({fetchImpl:async path=>Response.json(path==='/api/office'?{version:1,sessions:[],stale:false,receivedAt:new Date().toISOString()}:path==='/api/jobs'?{jobs:'invalid'}:{context:42}),onJobs:value=>jobs.push(value),onState:value=>states.push(value),onSnapshot:value=>snapshots.push(value)});t.after(()=>client.disconnect());
 assert.equal(await client.refresh(),false);assert.deepEqual(jobs.at(-1),{jobs:[],context:''});assert.equal(states.at(-1).status,'retrying');assert.deepEqual(snapshots.at(-1),[]);
});
