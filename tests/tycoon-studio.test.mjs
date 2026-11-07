import {createLegacyTycoonRoom} from './fixtures/legacy-tycoon-room.mjs';
import {tycoonGround} from '../web/tycoon-blueprint.js';
import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {TycoonStudio} from '../web/tycoon-studio.js';import {TycoonStore} from '../web/tycoon-state.js';
test('a Tycoon floor draft can be retried after a transient storage failure',async t=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'}),previousDocument=globalThis.document;globalThis.document=dom.window.document;
 const base=dom.window.localStorage,locks={request:async(_name,_options,run)=>run()};let reject=false;
 const storage={get length(){return base.length;},key:i=>base.key(i),getItem:k=>base.getItem(k),setItem:(k,v)=>{if(reject)throw new DOMException('full','QuotaExceededError');base.setItem(k,v);}};
 const store=new TycoonStore(storage,{locks}),e=new TycoonStudio(document.querySelector('main'),{floor:'projects',store,Scene:class{setScene(){}dispose(){}}});
 t.after(()=>{e.dispose();dom.window.close();globalThis.document=previousDocument;});
 e.change(r=>{r.objects[0].x+=.5;});const draft=structuredClone(e.room);reject=true;
 assert.equal((await e.save()).ok,false);assert.equal(e.dirty,true);assert.equal(store.get('projects'),null);
 reject=false;assert.equal((await e.save()).ok,true);assert.equal(e.dirty,false);assert.deepEqual(store.get('projects').room,draft);
});
test('Studio exposes the accepted30FPS mode and keeps the selected rate across a renderer retry without changing drafts',()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const created=[];
 class Scene{constructor(root,options){this.options=options;created.push(this);}setScene(){}setFrameRate(rate){this.rate=rate;}dispose(){}}
 const studio=new TycoonStudio(document.querySelector('main'),{floor:'projects',storage:dom.window.localStorage,Scene});
 try{const control=studio.q('[data-frame-rate]');assert.ok(control,'the real Studio has a rate control');assert.equal(created[0].options.frameRate,30);assert.equal(control.getAttribute('aria-pressed'),'true');
  const room=JSON.stringify(studio.room),saved=studio.saved,history=JSON.stringify(studio.past);control.click();assert.equal(created[0].rate,0);assert.equal(control.getAttribute('aria-pressed'),'false');studio.q('[data-scene-retry]').click();assert.equal(created.at(-1).options.frameRate,0);control.click();assert.equal(created.at(-1).rate,30);assert.equal(JSON.stringify(studio.room),room);assert.equal(studio.saved,saved);assert.equal(JSON.stringify(studio.past),history);
 }finally{studio.dispose();dom.window.close();}
});
test('new office plan is an explicit undoable draft and never silently overwrites a saved floor',()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const e=new TycoonStudio(document.querySelector('main'),{floor:'projects',storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}}});
 try{e.change(r=>{r.objects[0].x+=.7;});const before=JSON.stringify(e.room),stored=dom.window.localStorage.getItem('zuri-office:tycoon-studio:v1');e.q('[data-office-plan]').click();assert.notEqual(JSON.stringify(e.room),before);assert.equal(dom.window.localStorage.getItem('zuri-office:tycoon-studio:v1'),stored);e.undo();assert.equal(JSON.stringify(e.room),before);}finally{e.dispose();dom.window.close();}
});
test('latest texture selection wins even when an earlier import finishes first',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const pending=[];
 const e=new TycoonStudio(document.querySelector('main'),{storage:dom.window.localStorage,readTextureFile:()=>new Promise(r=>pending.push(r)),Scene:class{setScene(){}dispose(){}}});
 const applied=[];e.editTools.patchFinish=p=>{applied.push(p);e.editGeneration++;return true;};
 try{const a=e.editTools.loadTexture({}),b=e.editTools.loadTexture({});pending[0]('A');await a;pending[1]('B');await b;assert.deepEqual(applied,[{texture:'B'}]);}finally{e.dispose();dom.window.close();}
});
test('adding a prop after layer edits maintains a complete layer order',()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const e=new TycoonStudio(document.querySelector('main'),{storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}}});
 try{e.q('[data-layer="front"]').click();const count=e.room.objects.length;e.q('[data-kind]').value='chair';e.q('[data-add]').click();assert.equal(e.room.objects.length,count+1);assert.equal(e.room.layers.length,count+1);}finally{e.dispose();dom.window.close();}
});
test('deleting and recreating a local prop gives it a new identity while Undo and Redo retain each ID',()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const e=new TycoonStudio(document.querySelector('main'),{storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}}});
 try{
  e.q('[data-kind]').value='chair';e.q('[data-add]').click();const first=e.selection[0];assert.match(first,/^chair-copy-[a-f0-9]{32}$/);
  e.q('[data-delete]').click();assert.equal(e.room.objects.some(o=>o.id===first),false);
  e.q('[data-kind]').value='chair';e.q('[data-add]').click();const second=e.selection[0];assert.match(second,/^chair-copy-[a-f0-9]{32}$/);assert.notEqual(second,first);
  e.undo();assert.equal(e.room.objects.some(o=>o.id===second),false);e.undo();assert.equal(e.room.objects.some(o=>o.id===first),true);
  e.redo();assert.equal(e.room.objects.some(o=>o.id===first),false);e.redo();assert.equal(e.room.objects.some(o=>o.id===second),true);
 }finally{e.dispose();dom.window.close();}
});
test('late texture imports cannot change a new selection or another floor',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;let resolve;const e=new TycoonStudio(document.querySelector('main'),{floor:'projects',storage:dom.window.localStorage,readTextureFile:()=>new Promise(r=>resolve=r),Scene:class{setScene(){}dispose(){}}});
 try{e.selectIds(['desk-1']);const first=e.editTools.loadTexture({});e.selectIds(['chair-1']);resolve({});assert.equal(await first,false);assert.equal(e.dirty,false);const second=e.editTools.loadTexture({});e.load('lobby');resolve({});assert.equal(await second,false);assert.equal(e.dirty,false);}finally{e.dispose();dom.window.close();}
});
test('GLB multi-selection group edits, layers and finishes survive floor save with one Undo',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const e=new TycoonStudio(document.querySelector('main'),{floor:'projects',storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}}});
 const initialCount=e.room.objects.length;e.selectIds(['desk-1','chair-1']);e.q('[data-group]').click();assert.equal(e.selection.length,2);assert.ok(e.room.objects.find(o=>o.id==='desk-1').groupId);
 const previous=JSON.stringify(e.room);e.q('[data-set-scale]').value='1.2';e.q('[data-apply-scale]').click();assert.equal(e.room.objects.find(o=>o.id==='desk-1').scale,1.2);e.undo();assert.equal(JSON.stringify(e.room),previous);e.redo();
 e.q('[data-layer="front"]').click();assert.deepEqual(e.room.layers.slice(0,2),['desk-1','chair-1']);e.q('[data-material]').value='wood';e.q('[data-material]').dispatchEvent(new dom.window.Event('change'));assert.equal(e.room.objects.find(o=>o.id==='chair-1').finish.material,'wood');
 e.q('[data-copy]').click();assert.equal(e.selection.length,2);assert.equal(e.room.objects.length,initialCount+2);await e.save();const saved=JSON.stringify(e.room);e.load('lobby');assert.equal(e.room.layers,undefined);e.load('projects');assert.equal(JSON.stringify(e.room),saved);
 e.selectIds(['desk-1']);e.q('[data-ungroup]').click();assert.equal(e.room.objects.find(o=>o.id==='chair-1').groupId,undefined);e.dispose();dom.window.close();
});
test('queued save retains newer edits and cannot replace another loaded floor state',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 let release;const locks={request:(name,options,write)=>new Promise(resolve=>{release=()=>resolve(write());})};
 const store=new TycoonStore(dom.window.localStorage,{locks}),e=new TycoonStudio(document.querySelector('main'),{floor:'projects',store,Scene:class{setScene(){}dispose(){}}});
 e.change(r=>{r.objects[0].x=-4;});const first=e.save();let cancelled=false;dom.window.confirm=()=>assert.fail('pending save must not offer discard');e.requestLeave(()=>assert.fail('cannot leave pending save'),()=>{cancelled=true;});assert.equal(cancelled,true);assert.equal(e.floor,'projects');e.change(r=>{r.objects[0].x=-3;});release();await first;
 assert.equal(e.dirty,true);assert.equal(e.room.objects[0].x,-3);assert.equal(store.get('projects').room.objects[0].x,-4);assert.equal(e.revision,1);
 const second=e.save();e.load('lobby');const loaded=JSON.stringify(e.room);release();await second;
 assert.equal(JSON.stringify(e.room),loaded);assert.equal(e.revision,0);assert.equal(e.dirty,false);assert.equal(store.get('projects').room.objects[0].x,-3);assert.equal(store.get('lobby'),null);
 e.dispose();dom.window.close();
});
test('Tycoon editor saves actual floor state and Undo leaves the saved snapshot unchanged',async()=>{
  const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
  const store=new TycoonStore(dom.window.localStorage),Scene=class{setScene(){}dispose(){}reset(){}};
  const editor=new TycoonStudio(document.querySelector('main'),{floor:'projects',store,Scene});
  const old=editor.room.objects[0].x;editor.change(r=>{r.objects[0].x=old+1;});assert.equal(store.get('projects'),null);
  await editor.save();assert.equal(store.get('projects').room.objects[0].x,old+1);assert.equal(store.get('lobby'),null);
  editor.change(r=>{r.objects[0].x=old;});editor.undo();assert.equal(editor.room.objects[0].x,old+1);editor.dispose();dom.window.close();
});
test('confirmed discard clears the draft even when the editor is only hidden for another mode',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const editor=new TycoonStudio(document.querySelector('main'),{storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}}});const x=editor.room.objects[0].x;
 editor.change(r=>{r.objects[0].x=x+1;});dom.window.confirm=()=>false;editor.requestLeave(()=>editor.setVisible(false));assert.equal(editor.dirty,true);assert.equal(editor.visible,true);
 dom.window.confirm=()=>true;editor.requestLeave(()=>editor.setVisible(false));assert.equal(editor.dirty,false);assert.equal(editor.room.objects[0].x,x);assert.equal(editor.visible,false);editor.dispose();dom.window.close();
});

test('GLB blueprint, navigation, seat and door tools share saved per-floor state and templates',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 const rendered=[],Scene=class{setScene(k,r){rendered.push(structuredClone(r));}dispose(){}stopTest(){}startWalk(){return {ok:true,message:'walk'};}startStation(){return {ok:true,message:'seat'};}};
 const store=new TycoonStore(dom.window.localStorage),e=new TycoonStudio(document.querySelector('main'),{floor:'projects',store,Scene});
 e.room=createLegacyTycoonRoom('projects');e.room.navigation={version:1,routes:[],forbidden:[],stations:[{objectId:'desk-1',approach:tycoonGround({x:-2.8,z:-2.9}),seat:tycoonGround({x:-1.7,z:-2.9})}]};e.update();
 const roomObjects=structuredClone(e.room.objects);e.q('.hy-bp-width').value='13';e.q('.hy-bp-width').onchange({target:e.q('.hy-bp-width')});assert.equal(e.room.width,13);assert.equal(rendered.at(-1).width,13);assert.deepEqual(e.room.objects,roomObjects);
 e.q('.hy-bp-template-name').value='Projects 13m';e.q('.hy-bp-template-save').click();assert.match(e.q('.hy-bp-template-list').textContent,/Projects 13m/);
 e.q('[data-tool="navigation"]').click();e.navigationEditor.addRoute();assert.equal(e.room.navigation.routes.length,1);
 e.navigationEditor.target='station:desk-1';e.navigationEditor.selectedPoint=1;e.navigationEditor.draw();const seat=e.navigationEditor.currentPoint();e.navigationEditor.editPoint({...seat,x:seat.x+.1});assert.equal(e.room.navigation.stations[0].seat.x,seat.x+.1);
 e.toggleDoor('entry');assert.equal(e.room.blueprintPlan.door.open,false);e.undo();assert.equal(e.room.blueprintPlan.door.open,undefined);e.redo();assert.equal(e.room.blueprintPlan.door.open,false);
 await e.save();const saved=structuredClone(e.room);e.load('lobby');assert.equal(e.room.width,24);assert.equal(e.room.navigation,undefined);e.load('projects');assert.deepEqual(e.room,saved);assert.equal(store.get('lobby'),null);e.dispose();dom.window.close();
});

test('old oversized rooms remain editable and exportable until supported structure is selected',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const store=new TycoonStore(dom.window.localStorage);
 const e=new TycoonStudio(document.querySelector('main'),{store,Scene:class{setScene(){}dispose(){}}});e.change(r=>{delete r.blueprintPlan;r.width=20;r.depth=12;});assert.equal(e.room.width,20);assert.match(e.q('.tycoon-blueprint-map').textContent,/S\/M\/L/);assert.equal((await e.save()).ok,true);
 const inventory=structuredClone(e.room.objects);e.q('[data-plan-size]').value='medium';e.q('[data-plan-apply]').click();assert.equal(e.room.width,12);assert.deepEqual(e.room.objects,inventory);e.dispose();dom.window.close();
});

test('Studio scene retry preserves unsaved draft, selection and Undo without saving',()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;const instances=[];
 class Scene{constructor(root,options){this.options=options;instances.push(this);}setScene(){}dispose(){this.disposed=true;}}
 const e=new TycoonStudio(document.querySelector('main'),{floor:'projects',storage:dom.window.localStorage,Scene});
 e.q('[data-add]').click();const room=JSON.stringify(e.room),past=e.past.length,selection=[...e.selection];
 const retry=e.q('[data-scene-retry]');assert.ok(retry);retry.click();assert.equal(JSON.stringify(e.room),room);assert.equal(e.past.length,past);assert.deepEqual(e.selection,selection);assert.equal(e.dirty,true);assert.equal(e.store.get('projects'),null);assert.equal(instances[0].disposed,true);
 instances[0].options.onError('obsolete');assert.doesNotMatch(e.root.textContent,/obsolete/);e.dispose();dom.window.close();
});
