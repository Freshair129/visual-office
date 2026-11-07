import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {OFFICE_FLOORS} from '../web/office-floor-registry.js';
import {TycoonView} from '../web/tycoon-view.js';
import {designId} from '../web/office-world-identity.js';
import {TycoonStore,createTycoonRoom,TYCOON_KEY} from '../web/tycoon-state.js';
import {describeAreaDimensions} from '../web/office-plan-dimensions.js';
test('space guide shows geometry dimensions and focuses a real area only after scene readiness',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const focused=[];class Scene{ready=false;setScene(){}dispose(){}focusArea(id){focused.push(id);return {ok:true,areaId:id};}}
 const view=new TycoonView(document.querySelector('main'),{storage:dom.window.localStorage,Scene,connector:{getStatus:async()=>({enabled:false})}});await view.ready;view.show('people');view.spaces();
 assert.match(view.content.textContent,/24 × 16 ม\..*384 ตร\.ม\./s);
 const area=view.room.blueprintPlan.areas[0],d=describeAreaDimensions(view.room.blueprintPlan,area),card=view.content.querySelector(`[data-space-area="${area.id}"]`);
 assert.ok(card);assert.ok(card.querySelector('.tycoon-space-dimensions').textContent.includes(`${d.widthM.toFixed(1)} × ${d.depthM.toFixed(1)} ม.`));
 const focus=card.querySelector('button[data-area]');focus.click();assert.equal(focused.length,0);assert.equal(view.sheet.open,true);assert.match(card.querySelector('[role=status]').textContent,/กำลังโหลด/);
 view.scene.ready=true;focus.click();assert.deepEqual(focused,[area.id]);assert.equal(view.sheet.open,false);assert.ok(view.host.querySelector('.tycoon-notice').textContent.includes(area.name));
 view.dispose();dom.window.close();
});
test('all15 floor designs open and persist independently without a backend',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const view=new TycoonView(document.querySelector('main'),{storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}},connector:{getStatus:async()=>({enabled:false})}});await view.ready;
 const store=new TycoonStore(dom.window.localStorage,{locks:{request:async(name,options,run)=>run()}});
 for(const floor of OFFICE_FLOORS){view.show(floor.key);assert.equal(view.room.schemaVersion,'office-tycoon/v1');assert.equal(view.host.querySelector('h1').textContent,floor.label);assert.equal((await store.save(floor.key,createTycoonRoom(floor.key))).ok,true);}
 assert.equal(Object.keys(store.read().floors).length,15);view.directory();assert.equal(view.content.querySelectorAll('.tycoon-floor-choice').length,15);view.dispose();dom.window.close();
});
test('object design IDs match the exported floor, furniture placement and catalog asset identities',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const view=new TycoonView(document.querySelector('main'),{storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}},connector:{getStatus:async()=>({enabled:false})}});await view.ready;
 view.show('people');const object=view.room.objects.find(o=>o.kind==='chair');view.pick(object.id);
 const expected=await Promise.all([designId('floor','people'),designId('placement','people/furniture/'+object.id),designId('asset','chair')]);await new Promise(r=>setTimeout(r,10));
 for(const id of expected)assert.ok(view.content.textContent.includes(id));assert.match(view.content.textContent,/ยังไม่ได้ลงทะเบียน/);view.dispose();dom.window.close();
});
test('a new department clears prior records and does not read Projects under another label',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const calls=[];
 const view=new TycoonView(document.querySelector('main'),{storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}},connector:{getStatus:async()=>({enabled:true,target:'http://127.0.0.1:3100'}),getScope:async()=>({businesses:[{id:'a'}]}),getDomain:async key=>{calls.push(key);return {state:'READY',records:[{id:'project-secret',label:'Project secret'}]};}}});await view.ready;view.show('projects');await view.data.selectBusiness('a');const count=calls.length;
 view.show('people');await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,count);assert.deepEqual(view.data.state.records,[]);view.work();assert.match(view.content.textContent,/แบบ|ออกแบบ|ลงทะเบียน/);assert.doesNotMatch(view.content.textContent,/Project secret|project-secret/);view.dispose();dom.window.close();
});
test('export reads one consistent snapshot and preserves saved floor edits',async()=>{
 const first=createTycoonRoom('people'),second=createTycoonRoom('projects');first.objects[0].color='#123456';second.objects[0].color='#abcdef';
 const saved={version:1,floors:{people:{revision:3,room:first,edition:'tycoon3d'},projects:{revision:7,room:second,edition:'legacy'}}};let reads=0,lock;
 const store=new TycoonStore({getItem:()=>{reads++;return reads===1?JSON.stringify(saved):'{broken';}},{locks:{request:async(key,options,fn)=>{lock={key,mode:options.mode};return fn();}}});
 const result=await store.snapshotForExport();assert.equal(reads,1);assert.deepEqual(lock,{key:TYCOON_KEY,mode:'shared'});assert.equal(result.rooms.people.objects[0].color,'#123456');assert.equal(result.rooms.projects.objects[0].color,'#abcdef');assert.equal(result.revisions.projects,7);assert.equal(result.revisions.lobby,0);assert.equal(Object.keys(result.rooms).length,15);
});
test('export refuses corrupt or unsupported saved scenes instead of exporting defaults',async()=>{
 const invalid=createTycoonRoom('people');invalid.objects[0].x='bad';
 for(const raw of ['{broken',JSON.stringify({version:2,floors:{}}),JSON.stringify({version:1,floors:{people:{revision:1,room:invalid}}})]){
  const store=new TycoonStore({getItem:()=>raw},{locks:null});await assert.rejects(store.snapshotForExport());
 }
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;dom.window.localStorage.setItem(TYCOON_KEY,'{broken');const view=new TycoonView(document.querySelector('main'),{storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}},connector:{getStatus:async()=>({enabled:false})}});await view.ready;view.show('people');view.work();const button=[...view.content.querySelectorAll('button')].find(b=>b.textContent.includes('.zip'));await button.onclick();assert.match(view.content.textContent,/ส่งออกไม่ได้.*เสียหาย/s);view.dispose();dom.window.close();
});
