import test from 'node:test';import assert from 'node:assert/strict';
import {OfficeContextData} from '../web/office-context-data.js';
const stamp=Date.parse('2026-10-24T00:00:00.000Z');
test('default timer wrappers never pass the controller as browser host receiver',()=>{
 const oldClear=globalThis.clearTimeout,oldSet=globalThis.setTimeout;
 let d;
 try{
  globalThis.clearTimeout=function(){assert.notEqual(this,d);};
  globalThis.setTimeout=function(){assert.notEqual(this,d);return 1;};
  d=new OfficeContextData({});d.purge('EXPIRED');d.setTimer(()=>{},1);
 }finally{globalThis.clearTimeout=oldClear;globalThis.setTimeout=oldSet;}
});
const context=id=>({schemaVersion:'office-domain-context/v1',businessId:id,contextRevision:'r',generatedAt:new Date(stamp).toISOString(),sourceRevision:'a'.repeat(40),domains:[{domainKey:'growth',label:'Marketing',canonicalDomainId:'DOM-MARKETING',availability:'ACTIVE',modules:null,reads:[{operation:'marketing.campaigns.read',decision:'ALLOW'},{operation:'marketing.overview.read',decision:'ALLOW'}],actions:[]},{domainKey:'projects',label:'Projects',canonicalDomainId:null,availability:'ACTIVE',modules:null,reads:[],actions:[]}]});
function setup(overrides={}){let mono=0;const calls=[];const connector={getStatus:async()=>({enabled:true,synthetic:true,contextProfile:'office-domain-context/v1-candidate',target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a',name:'A'},{id:'b',name:'B'}]}),getDomainContext:async id=>context(id),getDomain:async (key,id)=>{calls.push([key,id]);return {state:'READY',records:[{id,label:id}]};},askGrowth:async id=>({response:{businessId:id,state:'READY',answer:{sections:[]}}}),...overrides};const d=new OfficeContextData(connector,{wallNow:()=>stamp,monotonicNow:()=>mono,setTimer:()=>0,clearTimer(){}});return {d,calls,setMono:v=>mono=v};}
test('candidate rejects absent mode marker and never reads Projects or implicit Lobby default',async()=>{const {d,calls}=setup();await d.connect();await d.selectBusiness('a');assert.equal(d.state.context.domains.length,2);await d.setDomain('projects');assert.equal(calls.length,0);await d.setDomain('growth');assert.equal(calls.length,1);d.dispose();const x=setup({getStatus:async()=>({enabled:true,synthetic:true,target:'http://127.0.0.1:3100'})}).d;await x.connect();assert.equal(x.state.status,'UNAVAILABLE');assert.deepEqual(x.state.businesses,[]);x.dispose();});
test('late A context cannot overwrite B and hidden/refresh purges before resolution',async()=>{const pending=[];const {d}=setup({getDomainContext:id=>new Promise(resolve=>pending.push({id,resolve}))});await d.connect();const a=d.selectBusiness('a'),b=d.selectBusiness('b');pending[1].resolve(context('b'));await b;pending[0].resolve(context('a'));await a;assert.equal(d.state.context.businessId,'b');const refresh=d.refreshContext();assert.equal(d.state.context,null);d.setHidden(true);pending[2].resolve(context('b'));await refresh;assert.equal(d.state.context,null);assert.equal(d.state.contextStatus,'HIDDEN');d.dispose();});
test('late Campaign and Ask replies cannot repopulate revoked or expired context',async()=>{let campaign,ask;const {d,setMono}=setup({getDomain:()=>new Promise(r=>campaign=r),askGrowth:()=>new Promise(r=>ask=r)});await d.connect();await d.selectBusiness('a');const read=d.setDomain('growth'),question=d.askMarketing('');const refresh=d.refreshContext();assert.deepEqual(d.state.records,[]);await refresh;campaign({state:'READY',records:[{id:'secret'}]});ask({response:{businessId:'a',state:'READY',answer:{sections:[]}}});await Promise.all([read,question]);assert.deepEqual(d.state.records,[]);assert.equal(d.state.ask,null);setMono(60001);assert.equal(d.canRead('marketing.overview.read'),false);assert.equal(d.state.contextStatus,'EXPIRED');assert.equal(d.state.context,null);d.dispose();});
test('protected denial removes directory, Business and source data with equal 403/404 public state',async()=>{for(const status of [401,403,404]){const {d}=setup({getDomainContext:async()=>{throw Object.assign(Error('private'),{status});}});await d.connect();await d.selectBusiness('a');assert.equal(d.state.context,null);assert.equal(d.state.businessId,'');assert.deepEqual(d.state.businesses,[]);assert.equal(d.state.status,status===401?'AUTH_REQUIRED':'FORBIDDEN');d.dispose();}});

test('hidden mode refuses new private loads and focus restarts only after visible',async()=>{let scopes=0;const {d}=setup({getScope:async()=>{scopes++;return {businesses:[{id:'a'}]};}});d.setHidden(true);await d.connect();assert.equal(scopes,0);await d.setHidden(false);assert.equal(d.state.status,'SELECT_BUSINESS');assert.equal(scopes,1);d.dispose();});
test('suspending Office fences an in-flight directory and focus cannot revive it',async()=>{let resolve;const {d}=setup({getDomainContext:()=>new Promise(r=>resolve=r)});await d.connect();const pending=d.selectBusiness('a');d.suspend();resolve(context('a'));await pending;await d.focus();assert.equal(d.state.context,null);assert.equal(d.hidden,true);d.dispose();});

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function assertPrivatePurged(d){assert.deepEqual(d.state.records,[]);assert.equal(d.state.ask,null);assert.equal(d.state.source,undefined);assert.equal(d.state.checkedAt,'');assert.equal(d.state.truncated,false);assert.equal(d.state.askStatus,'IDLE');}
for(const transition of ['business','domain','hidden','suspend','dispose','refresh','focus','expiry','denial'])for(const outcome of ['success','failure']){
 test(`pending Campaign + Ask: ${transition} fences late ${outcome}`,async()=>{
  const campaign=deferred(),ask=deferred();let held=false,readSignal,askSignal;
  const {d,setMono}=setup({getDomain:async(key,id,{signal})=>{if(held){readSignal=signal;return campaign.promise;}return {state:'READY',records:[{id:'before'}],source:{private:'before'},checkedAt:'before',truncated:true};},askGrowth:async(id,q,{signal})=>{if(held){askSignal=signal;return ask.promise;}return {response:{businessId:id,state:'READY',answer:{sections:[{title:'before'}]}}};}});
  await d.connect();await d.selectBusiness('a');await d.setDomain('growth');await d.askMarketing('');assert.ok(d.state.source);assert.ok(d.state.ask);
  held=true;const read=d.refreshProjects(),question=d.askMarketing('');const epoch=d.epoch,readSeq=d.readSeq,askSeq=d.askSeq;
  let changed;
  if(transition==='business')changed=d.selectBusiness('b');
  else if(transition==='domain')changed=d.setDomain('projects');
  else if(transition==='hidden')changed=d.setHidden(true);
  else if(transition==='suspend')d.suspend();
  else if(transition==='dispose')d.dispose();
  else if(transition==='refresh')changed=d.refreshContext();
  else if(transition==='focus')changed=d.focus();
  else if(transition==='expiry'){setMono(60000);assert.equal(d.ensureFresh(),false);}
  else d.failure({status:403});
  // These assertions run synchronously, before awaiting the transition or old transport.
  assert.equal(readSignal.aborted,true);assert.equal(askSignal.aborted,true);assert.ok(d.readSeq>readSeq);assert.ok(d.askSeq>askSeq);if(transition!=='domain')assert.ok(d.epoch>epoch);assertPrivatePurged(d);
  await changed;
  // Re-authorize the same reader after refresh: stale replies must fail generation, not merely absent grants.
  if(['refresh','focus'].includes(transition)){held=false;await d.setDomain('growth');await d.askMarketing('');}
  const expected=structuredClone(d.state);
  if(outcome==='success'){campaign.resolve({state:'READY',records:[{id:'late-secret'}],source:'late-secret',checkedAt:'late-secret',truncated:true});ask.resolve({response:{businessId:'a',state:'READY',answer:{sections:[{title:'late-secret'}]}}});}
  else {campaign.reject(Object.assign(Error('late-secret'),{status:401}));ask.reject(Object.assign(Error('late-secret'),{status:403}));}
  await Promise.all([read,question]);assert.deepEqual(d.state,expected);d.dispose();
 });
}
for(const retry of ['refreshContext','focus'])for(const outcome of ['success','failure'])test(`same Business ${retry} rejects held context ${outcome} with identical revision`,async()=>{
 const pending=[];const {d}=setup({getDomainContext:(id,{signal})=>{if(pending.length)assert.equal(pending.at(-1).signal.aborted,true,'prior request aborted before next connector invocation');const p=deferred();pending.push({...p,signal});return p.promise;}});
 await d.connect();const old=d.selectBusiness('a'),epoch=d.epoch;const replacement=d[retry]();assert.ok(d.epoch>epoch);assert.equal(d.state.context,null);assert.equal(d.state.contextStatus,'LOADING');
 const fresh=context('a');fresh.domains=[];pending[1].resolve(fresh);await replacement;const expected=structuredClone(d.state);
 if(outcome==='success')pending[0].resolve(context('a'));else pending[0].reject(Object.assign(Error('old denial'),{status:403}));await old;assert.deepEqual(d.state,expected);d.dispose();
});

for(const trigger of ['campaign','ask'])for(const status of [401,403])test(`${trigger} transport denial ${status} aborts and fences the pending peer`,async()=>{
 const campaign=deferred(),ask=deferred();let readSignal,askSignal;
 const {d}=setup({getDomain:(key,id,{signal})=>{readSignal=signal;return campaign.promise;},askGrowth:(id,q,{signal})=>{askSignal=signal;return ask.promise;}});
 await d.connect();await d.selectBusiness('a');const read=d.setDomain('growth'),question=d.askMarketing(''),epoch=d.epoch;
 if(trigger==='campaign'){campaign.resolve({state:status===401?'AUTH_REQUIRED':'FORBIDDEN'});await read;}else{ask.reject(Object.assign(Error('synthetic denied'),{status}));await question;}
 assert.ok(d.epoch>epoch);assert.equal(readSignal.aborted,true);assert.equal(askSignal.aborted,true);assertPrivatePurged(d);assert.equal(d.state.businessId,'');assert.deepEqual(d.state.businesses,[]);assert.equal(d.state.status,status===401?'AUTH_REQUIRED':'FORBIDDEN');const expected=structuredClone(d.state);
 if(trigger==='campaign'){ask.resolve({response:{businessId:'a',state:'READY',answer:{sections:[{title:'stale'}]}}});await question;}else{campaign.resolve({state:'READY',records:[{id:'stale'}],source:'stale'});await read;}
 assert.deepEqual(d.state,expected);d.dispose();
});
