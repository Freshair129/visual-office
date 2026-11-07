import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {TycoonDomainView} from '../web/tycoon-domain-view.js';
const stamp=Date.parse('2026-10-24T00:00:00.000Z');
const row=(key,label=key)=>({domainKey:key,label,canonicalDomainId:key==='growth'?'DOM-MARKETING':null,availability:'ACTIVE',modules:null,reads:key==='growth'?[{operation:'marketing.campaigns.read',decision:'ALLOW'},{operation:'marketing.overview.read',decision:'DENY'}]:[],actions:[]});
test('dynamic view uses authorized rows, literal labels, unsupported floors and no Studio grants',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost',pretendToBeVisual:true});globalThis.document=dom.window.document;const calls=[];const connector={getStatus:async()=>({enabled:true,synthetic:true,contextProfile:'office-domain-context/v1-candidate',target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'}]}),getDomainContext:async()=>({schemaVersion:'office-domain-context/v1',businessId:'a',contextRevision:'r',generatedAt:new Date(stamp).toISOString(),sourceRevision:'a'.repeat(40),domains:[row('projects'),row('growth'),row('future','<b>Future</b>')]}),getDomain:async key=>{calls.push(key);return {state:'EMPTY',records:[]};}};
 const v=new TycoonDomainView(document.querySelector('main'),{connector,dataOptions:{wallNow:()=>stamp},Scene:class{setScene(){}dispose(){}},storage:dom.window.localStorage});await v.ready;await v.data.selectBusiness('a');v.show();v.directory();assert.equal(v.content.querySelectorAll('.tycoon-floor-choice').length,4);assert.equal(v.content.querySelector('b'),null);v.show('domain:projects');v.work();assert.match(v.content.textContent,/unsupported/);assert.deepEqual(calls,[]);assert.equal(v.host.querySelector('[data-nav=studio]').disabled,true);
 v.show('domain:growth');await new Promise(r=>setTimeout(r,0));v.work();assert.deepEqual(calls,['growth']);assert.equal([...v.content.querySelectorAll('button')].find(b=>b.textContent==='Ask Marketing').disabled,true);
 v.show('domain:future');await v.data.focus();assert.equal(v.floor,'future');
 const nav=[];v.onNavigate=id=>nav.push(id);v.hide();assert.deepEqual(nav,[]);assert.equal(v.data.state.context,null);v.onNavigate=null;v.show();await v.data.refreshContext();v.show('domain:future');
 const original=connector.getDomainContext;let release;connector.getDomainContext=()=>new Promise(r=>release=r);v.onNavigate=id=>v.show(id);const refresh=v.data.refreshContext();v.show('lobby');release(await original());await refresh;assert.equal(v.floor,'lobby');connector.getDomainContext=original;v.onNavigate=null;v.show('domain:future');
 v.data.setHidden(true);assert.equal(v.sheet.open,false);assert.equal(v.floor,'lobby');v.retryScene();assert.equal(v.data.state.context,null);v.dispose();dom.window.close();
});

for(const transition of ['expiry','revocation'])for(const sheet of ['work','ask'])test(`pending scene recovery across ${transition} closes ${sheet} and fences old callbacks`,async(t)=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost',pretendToBeVisual:true});const previous=globalThis.document;globalThis.document=dom.window.document;
 let mono=0,revoked=false,contextCalls=0,readCalls=0;const scenes=[];let timer;
 class HeldScene{
  constructor(stage,callbacks){this.callbacks=callbacks;this.stage=stage;scenes.push(this);}
  setScene(floor){this.floor=floor;this.callbacks.onStatus('pending scene');}
  dispose(){this.disposed=true;}
 }
 const connector={getStatus:async()=>({enabled:true,synthetic:true,contextProfile:'office-domain-context/v1-candidate',target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'}]}),getDomainContext:async()=>{contextCalls++;return {schemaVersion:'office-domain-context/v1',businessId:'a',contextRevision:'same',generatedAt:new Date(stamp).toISOString(),sourceRevision:'a'.repeat(40),domains:revoked?[]:[{...row('growth'),reads:[{operation:'marketing.campaigns.read',decision:'ALLOW'},{operation:'marketing.overview.read',decision:'ALLOW'}]}]};},getDomain:async()=>{readCalls++;return {state:'READY',records:[{id:'private-campaign'}],source:'private-source',checkedAt:'private-time',truncated:true};},askGrowth:async()=>({response:{businessId:'a',state:'READY',answer:{sections:[{title:'private-answer'}]}}})};
 const v=new TycoonDomainView(document.querySelector('main'),{connector,Scene:HeldScene,storage:dom.window.localStorage,dataOptions:{wallNow:()=>stamp,monotonicNow:()=>mono,setTimer:fn=>{timer=fn;return 1;},clearTimer(){timer=null;}}});
 t.after(()=>{v.dispose();dom.window.close();globalThis.document=previous;});
 await v.ready;await v.data.selectBusiness('a');v.show('domain:growth');await v.data.refreshProjects();await v.data.askMarketing('');v[sheet]();assert.equal(v.sheet.open,true);assert.ok(v.data.state.source);assert.ok(v.data.state.ask);
 v.retryScene();const pending=scenes.at(-1),generation=v.renderGeneration;assert.equal(pending.floor,'growth');assert.equal(v.sheet.open,true);
 let refresh;if(transition==='expiry'){mono=60000;timer();}else{revoked=true;refresh=v.data.refreshContext();}
 // Authority and private UI disappear before the replacement context can resolve.
 assert.equal(v.sheet.open,false);assert.equal(v.content.childNodes.length,0,'purge removes private sheet DOM');assert.equal(v.data.state.context,null);assert.deepEqual(v.data.state.records,[]);assert.equal(v.data.state.ask,null);assert.equal(v.data.state.source,undefined);assert.equal(v.data.state.checkedAt,'');assert.equal(v.data.state.truncated,false);assert.equal(v.floor,'lobby');assert.equal(pending.disposed,true);assert.ok(v.renderGeneration>generation);
 await refresh;const expected=structuredClone(v.data.state),notice=v.host.querySelector('.tycoon-notice').textContent;
 pending.callbacks.onStatus('stale private success');pending.callbacks.onError('stale private error');assert.equal(v.host.querySelector('.tycoon-notice').textContent,notice);assert.equal(v.sheet.open,false);assert.deepEqual(v.data.state,expected);
 const calls=[contextCalls,readCalls];v.retryScene();assert.deepEqual([contextCalls,readCalls],calls);assert.equal(v.floor,'lobby');assert.equal(v.host.querySelector('[data-nav=studio]').disabled,true);assert.equal(v.host.querySelector('.tycoon-entry').textContent.includes('วัตถุในชั้นนี้'),false);
 v.ask();assert.equal(v.content.querySelector('form'),null);v.work();assert.equal(v.content.querySelector('button[type=submit]'),null);assert.equal(v.content.textContent.includes('private-campaign'),false);assert.deepEqual([contextCalls,readCalls],calls);
});
