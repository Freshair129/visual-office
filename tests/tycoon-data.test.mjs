import test from 'node:test';import assert from 'node:assert/strict';
import {TycoonData} from '../web/tycoon-data.js';
test('opening Marketing during connection retains authorized scope discovery',async()=>{
 let ready;const data=new TycoonData({getStatus:()=>new Promise(r=>ready=r),getScope:async()=>({businesses:[{id:'a'}]})});const pending=data.connect();await data.setDomain('growth');ready({enabled:true,target:'http://127.0.0.1:3100'});await pending;assert.equal(data.state.status,'SELECT_BUSINESS');assert.equal(data.state.businesses.length,1);data.dispose();
});
test('expired authorization clears both campaign and Ask projections and Business scope',async()=>{
 const data=new TycoonData({getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'}]}),getDomain:async()=>({state:'READY',records:[{id:'campaign'}]}),askGrowth:async()=>{throw Object.assign(Error('expired'),{status:401});}});
 await data.connect();await data.setDomain('growth');await data.selectBusiness('a');await data.askMarketing('status');assert.equal(data.state.businessId,'');assert.deepEqual(data.state.businesses,[]);assert.deepEqual(data.state.records,[]);assert.equal(data.state.ask,null);data.dispose();
});
test('Marketing collection and Ask are isolated from Projects and late floor responses',async()=>{
 let resolveAsk;const calls=[];const data=new TycoonData({getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'},{id:'b'}]}),getDomain:async(domain)=>{calls.push(domain);return {state:'READY',records:[{id:domain,label:domain}]};},askGrowth:()=>new Promise(r=>resolveAsk=r)});
 await data.connect();await data.setDomain('growth');await data.selectBusiness('a');assert.equal(calls.at(-1),'growth');
 const ask=data.askMarketing('Campaign status');await data.setDomain('projects');resolveAsk({response:{businessId:'a',state:'READY',answer:null}});await ask;assert.equal(data.state.ask,null);assert.equal(data.state.records[0].id,'projects');
 data.connector.askGrowth=async()=>({response:{businessId:'b',state:'READY',answer:null}});await data.setDomain('growth');await data.askMarketing('Campaign status');assert.equal(data.state.askStatus,'ERROR');assert.equal(data.state.ask,null);data.dispose();
});
test('project reads are scoped, late data is discarded and unknown roster stays unavailable',async()=>{
  const pending=[];const adapter={getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a',name:'A'},{id:'b',name:'B'}]}),getDomain:(_,id)=>new Promise(resolve=>pending.push({id,resolve}))};
  const data=new TycoonData(adapter);await data.connect();const first=data.selectBusiness('a'),second=data.selectBusiness('b');
  pending[1].resolve({state:'READY',records:[{id:'b-project',label:'B project'}]});await second;
  pending[0].resolve({state:'READY',records:[{id:'a-project',label:'Private A'}]});await first;
  assert.equal(data.state.businessId,'b');assert.equal(data.state.records[0].id,'b-project');assert.equal(data.state.agentState,'UNAVAILABLE');
  assert.throws(()=>data.selectBusiness('other'));data.dispose();
});
test('network failure is not an empty project collection',async()=>{
  const data=new TycoonData({getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'}]}),getDomain:async()=>{throw Error('network');}});
  await data.connect();await data.selectBusiness('a');assert.equal(data.state.status,'ERROR');assert.equal(data.state.records.length,0);
});
test('target must be an allowed loopback stack and follows the status response',async()=>{
  let scopeReads=0;const data=new TycoonData({getStatus:async()=>({enabled:true,target:'https://example.com'}),getScope:async()=>{scopeReads++;return {businesses:[]};}});
  await data.connect();assert.equal(scopeReads,0);assert.equal(data.state.status,'UNAVAILABLE');assert.equal(data.state.targetOrigin,'');
  data.connector.getStatus=async()=>({enabled:true,target:'http://127.0.0.1:3000'});await data.connect();assert.equal(data.state.targetOrigin,'http://127.0.0.1:3000');assert.equal(scopeReads,1);
});


test('Marketing accepts blank overview and blocks duplicate in-flight asks',async()=>{
 let finish;const calls=[];const data=new TycoonData({getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'}]}),getDomain:async()=>({state:'EMPTY',records:[]}),askGrowth:async(id,q)=>{calls.push(q);return new Promise(r=>finish=()=>r({response:{businessId:id,state:'READY',answer:{sections:[]}}}));}});
 await data.connect();await data.setDomain('growth');await data.selectBusiness('a');const pending=data.askMarketing('  ');
 assert.deepEqual(calls,['']);await assert.rejects(data.askMarketing('duplicate'));finish();await pending;
 await assert.rejects(data.askMarketing(null));await assert.rejects(data.askMarketing('x'.repeat(401)));data.dispose();
});

test('Marketing truncation metadata clears on Business switch and failed refresh',async()=>{
 const data=new TycoonData({getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'},{id:'b'}]}),getDomain:async()=>({state:'READY',records:[],truncated:true})});
 await data.connect();await data.setDomain('growth');await data.selectBusiness('a');assert.equal(data.state.truncated,true);
 data.connector.getDomain=async()=>{throw Error('offline');};await data.selectBusiness('b');assert.equal(data.state.truncated,false);assert.deepEqual(data.state.records,[]);data.dispose();
});
