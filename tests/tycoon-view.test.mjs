import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {TycoonView} from '../web/tycoon-view.js';
import {TycoonStore,createTycoonRoom} from '../web/tycoon-state.js';
test('30 FPS control changes scene rendering and survives floor navigation',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const rates=[];
 const Scene=class{constructor(root,opts){rates.push(opts.frameRate);}setScene(){}dispose(){}setFrameRate(rate){rates.push(rate);}};
 const view=new TycoonView(document.querySelector('main'),{Scene,storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:false})}});
 await view.ready;view.show('projects');const control=view.host.querySelector('[data-frame-rate]');assert.ok(control);assert.equal(control.getAttribute('aria-pressed'),'false');control.click();
 assert.equal(control.getAttribute('aria-pressed'),'true');assert.equal(rates.at(-1),30);view.show('lobby');assert.equal(rates.at(-1),30);control.click();assert.equal(rates.at(-1),0);
 view.dispose();dom.window.close();
});
test('simulation actor has an accessible focus action and stays out of connected view',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;let focused=0,visible=true;
 const view=new TycoonView(document.querySelector('main'),{Scene:class{setScene(){}dispose(){}probeVisible(){return visible;}focusProbe(){focused++;return {ok:true};}},storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:false})}});
 await view.ready;view.show('projects');view.objects();assert.match(view.content.textContent,/ตัวละครตัวอย่าง \(จำลอง\)/);
 view.pick('demo-agent');assert.match(view.content.textContent,/ยังไม่ผูก Agent|ไม่มี role/);[...view.content.querySelectorAll('button')].find(b=>b.textContent.includes('โฟกัส')).click();assert.equal(focused,1);
 visible=false;view.objects();assert.doesNotMatch(view.content.textContent,/ตัวละครตัวอย่าง \(จำลอง\)/);visible=true;
 view.data.state.businessId='connected';view.objects();assert.doesNotMatch(view.content.textContent,/ตัวละครตัวอย่าง \(จำลอง\)/);
 view.dispose();dom.window.close();
});
test('queued door save stops movement and cannot apply its room after changing floors',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;let release,stops=0;
 const locks={request:(name,options,write)=>new Promise(resolve=>{release=()=>resolve(write());})};
 const view=new TycoonView(document.querySelector('main'),{Scene:class{setScene(){}dispose(){}stopTest(){stops++;}},storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:false})}});
 await view.ready;view.store=new TycoonStore(dom.window.localStorage,{locks});view.show('projects');const pending=view.toggleDoor('entry');assert.equal(stops,1);view.show('lobby');const lobby=JSON.stringify(view.room);release();await pending;
 assert.equal(JSON.stringify(view.room),lobby);assert.equal(view.revision,0);assert.equal(view.store.get('projects').room.blueprintPlan.door.open,false);assert.equal(view.store.get('lobby'),null);view.dispose();dom.window.close();
});
test('Marketing GLB floor opens a campaign board and a deterministic Ask form',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const view=new TycoonView(document.querySelector('main'),{Scene:class{setScene(){}dispose(){}},storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:false})}});
 await view.ready;view.show('growth');view.pick('marketing-board');assert.match(view.sheet.textContent,/Campaigns/);view.pick('marketing-ask');assert.match(view.sheet.textContent,/Ask Marketing/);assert.equal(view.content.querySelector('textarea').maxLength,-1);assert.equal(view.content.querySelector('button[type=submit]').disabled,true);view.dispose();dom.window.close();
});
test('Marketing board and Ask render scoped safe projections and clear on logout',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const view=new TycoonView(document.querySelector('main'),{Scene:class{setScene(){}dispose(){}},storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a',name:'Business A'}]}),getDomain:async()=>({state:'READY',records:[{id:'c1',label:'Campaign A',status:'OPEN'}],truncated:true}),askGrowth:async()=>({response:{businessId:'a',state:'PARTIAL',answer:{sections:[{title:'Campaigns',count:2,state:'READY'}]},sources:[{owner:'MARKETING',source:'MARKETING_CAMPAIGNS',sourceVersion:'v1',state:'READY'}],unavailable:[{source:'PAID',reasonCode:'UNAVAILABLE'}],generatedAt:'2026-10-24T00:00:00Z'}})}});
 await view.ready;view.show('growth');await view.data.selectBusiness('a');view.pick('marketing-board');assert.match(view.content.textContent,/Campaign A/);assert.match(view.content.textContent,/บางรายการ/);view.pick('marketing-ask');await view.data.askMarketing('status');assert.match(view.content.textContent,/ข้อมูลบางส่วน/);assert.match(view.content.textContent,/count: 2/);assert.doesNotMatch(view.content.textContent,/v1/);view.data.deny('AUTH_REQUIRED');assert.doesNotMatch(view.content.textContent,/count: 2|Campaign A|v1/);assert.equal(view.content.querySelector('button[type=submit]').disabled,true);assert.match(view.content.textContent,/เลือก Business \/ เชื่อม Zuri/);view.dispose();dom.window.close();
});

test('scene object and keyboard routes share sheets; floor transition closes stale sheet',async()=>{
  const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
  const routes=[],fakeScene=class{constructor(){}setScene(){}dispose(){}zoom(){}reset(){}};
  const view=new TycoonView(document.querySelector('main'),{onNavigate:k=>routes.push(k),Scene:fakeScene,storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:false})}});
  view.show(null);view.pick('lobby');assert.deepEqual(routes,['lobby']);
  view.show('projects');view.pick('project-board');assert.match(view.sheet.textContent,/Projects/);assert.match(view.sheet.textContent,/Zuri/);
  view.pick('desk-1');assert.match(view.sheet.textContent,/งาน/);
  view.show('lobby');assert.equal(view.sheet.open,false);
  view.pick('lift');assert.match(view.sheet.textContent,/Projects/);view.dispose();dom.window.close();
});
test('both floors discard local presentation when Business is selected and use the verified login target',async()=>{
  const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
  const store=new TycoonStore(dom.window.localStorage),local=createTycoonRoom('lobby');local.objects[0].x=-3;await store.save('lobby',local);
  const view=new TycoonView(document.querySelector('main'),{Scene:class{setScene(){}dispose(){}},storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3000'}),getScope:async()=>({businesses:[{id:'a',name:'A'}]}),getDomain:async()=>({state:'EMPTY',records:[]})}});
  await view.ready;view.show('lobby');assert.equal(view.room.objects[0].x,-3);
  await view.data.selectBusiness('a');assert.equal(view.room.objects[0].x,createTycoonRoom('lobby').objects[0].x);
  view.connection();assert.equal(view.content.querySelector('a').href,'http://127.0.0.1:3000/login');
  view.dispose();dom.window.close();
});

test('runtime doors persist per floor, reject stale saves and cannot write connected scenes',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const store=new TycoonStore(dom.window.localStorage),view=new TycoonView(document.querySelector('main'),{Scene:class{setScene(){}dispose(){}},storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:false})}});
 await view.ready;view.show('projects');assert.equal((await view.toggleDoor('entry')).ok,true);assert.equal(store.get('projects').room.blueprintPlan.door.open,false);assert.equal(store.get('lobby'),null);
 view.show('projects');assert.equal(view.room.blueprintPlan.door.open,false);const saved=store.get('projects');await store.save('projects',saved.room,saved.revision);
 assert.equal((await view.toggleDoor('entry')).reason,'conflict');assert.equal(view.room.blueprintPlan.door.open,false);
 view.data.state.businessId='readonly';assert.equal((await view.toggleDoor('entry')).reason,'read-only');assert.equal(store.get('projects').revision,2);view.dispose();dom.window.close();
});

test('Ask form submits blank overview and preserves null versus zero with trimmed validation',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const calls=[];
 const view=new TycoonView(document.querySelector('main'),{Scene:class{setScene(){}dispose(){}},storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'}]}),getDomain:async()=>({state:'EMPTY',records:[]}),askGrowth:async(id,q)=>{calls.push(q);return {response:{businessId:id,state:'PARTIAL',answer:{sections:[{title:'Unknown',count:null,window:{from:null,to:null}},{title:'Zero',value:0}]}}};}}});
 await view.ready;view.show('growth');await view.data.selectBusiness('a');view.pick('marketing-ask');const input=view.content.querySelector('textarea'),form=view.content.querySelector('form');
 assert.equal(input.required,false);assert.equal(input.maxLength,-1);assert.match(form.textContent,/ดูภาพรวม Marketing/);
 form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.deepEqual(calls,['']);assert.match(view.content.textContent,/ช่วงข้อมูล: ยังไม่ทราบ → ยังไม่ทราบ/);assert.match(view.content.textContent,/value: 0/);
 input.value='x'.repeat(401);input.dispatchEvent(new dom.window.Event('input'));assert.equal(view.content.querySelector('button[type=submit]').disabled,true);
 input.value='  '+'x'.repeat(400)+'  ';input.dispatchEvent(new dom.window.Event('input'));assert.equal(view.content.querySelector('button[type=submit]').disabled,false);
 view.dispose();dom.window.close();
});

test('Ask recovery keeps keyboard focus in the dialog through Business selection',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const view=new TycoonView(document.querySelector('main'),{Scene:class{setScene(){}dispose(){}},storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'}]}),getDomain:async()=>({state:'EMPTY',records:[]})}});
 await view.ready;view.show('growth');view.ask();const recovery=view.content.querySelector('.tycoon-ask-recovery button');recovery.focus();recovery.click();assert.ok(view.sheet.contains(document.activeElement),'focus stays in dialog after sheet content replacement');
 const select=view.content.querySelector('select');select.focus();select.value='a';select.dispatchEvent(new dom.window.Event('change'));await new Promise(r=>setTimeout(r,0));assert.equal(document.activeElement,view.content.querySelector('select'));view.dispose();dom.window.close();
});

test('Marketing main-app surface labels synthetic status without granting an Agent role',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const view=new TycoonView(document.querySelector('main'),{Scene:class{setScene(){}dispose(){}},storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:true,synthetic:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[]})}});await view.ready;view.show('growth');assert.match(view.host.querySelector('.tycoon-edition').textContent,/SYNTHETIC/);assert.equal(view.data.state.agentState,'UNAVAILABLE');view.connection();assert.equal(view.content.querySelector('a'),null,'synthetic connection must not navigate to live login');view.dispose();dom.window.close();
});

test('scene retry preserves scope and room and fences obsolete renderer errors',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const instances=[];
 class Scene{constructor(root,options){this.options=options;instances.push(this);}setScene(floor,room){this.room=room;}dispose(){this.disposed=true;}}
 const v=new TycoonView(document.querySelector('main'),{Scene,storage:dom.window.localStorage,connector:{getStatus:async()=>({enabled:false})}});await v.ready;v.show('growth');const room=v.room;
 instances[0].options.onError('failed');v.objects();assert.match(v.content.textContent,/Campaigns/);v.closeSheet();
 const retry=v.host.querySelector('[data-scene-retry]');assert.ok(retry);retry.click();assert.equal(v.room,room);assert.equal(instances.length,2);assert.equal(instances[0].disposed,true);
 instances[0].options.onError('obsolete');assert.doesNotMatch(v.host.textContent,/obsolete/);v.dispose();dom.window.close();
});
