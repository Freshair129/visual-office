import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {RoomStore,RoomHistory,HYBRID_KEY,starterRoom,departmentStarterRoom,parseRoomJSON,normalizeRoom,clone,catalog,catalogGroups,genericAvatarKinds,backgrounds,floorFile,parseFloorJSON,defaultEffects} from '../web/hybrid-state.js';
import {HybridStudio} from '../web/hybrid-studio.js';
import {HybridScene} from '../web/hybrid-scene.js';
import {domainFloors} from '../web/domain-office.js';
import {defaultBlueprintPlan} from '../web/office-blueprint-state.js';
import {blueprintPoint} from '../web/office-blueprints.js';
import {externalAssetTest} from './external-assets-helper.mjs';

test('a Hybrid floor draft can be retried after a transient storage failure',t=>{
  const storage=memory(),store=new RoomStore(storage);store.apply('preview:lobby',starterRoom());
  const {ui}=setup(t,storage);ui.change({name:'Retry draft'});
  const write=storage.setItem;let reject=true;storage.setItem=(key,value)=>{if(reject)throw new DOMException('full','QuotaExceededError');write(key,value);};
  assert.equal(ui.saveFloor(),false);assert.equal(ui.history.dirty,true);assert.notEqual(new RoomStore(storage).floor('lobby').name,'Retry draft');
  reject=false;assert.equal(ui.saveFloor(),true);assert.equal(ui.history.dirty,false);assert.equal(new RoomStore(storage).floor('lobby').name,'Retry draft');
});

const memory=()=>{let data;return {getItem:()=>data,setItem:(k,v)=>{assert.equal(k,HYBRID_KEY);data=v;}};};
function setup(t,storage,initialFloor='lobby'){
  const dom=new JSDOM('<main></main>',{url:'https://office.test'});
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const root=dom.window.document.querySelector('main'),visits=[];
  const ui=new HybridStudio(root,{storage:storage||dom.window.localStorage,initialFloor,onVisitFloor:key=>visits.push(key)});
  // These compatibility cases pin the legacy editor fixture; the new default is tested separately.
  if(initialFloor==='projects'&&!ui.store.floor(initialFloor)&&ui.history.current.sceneSheet){ui.history=new RoomHistory(departmentStarterRoom(domainFloors.find(f=>f.key===initialFloor)));ui.update();ui.updateEdition();}
  t.after(()=>{ui.dispose();dom.window.close();});
  return {dom,root,ui,visits,q:s=>root.querySelector(s)};
}

test('Projects Studio file, assignment and AI previews use their actual floor art context',t=>{
 const {ui,q}=setup(t,undefined,'projects');
 const room=departmentStarterRoom(domainFloors.find(f=>f.key==='projects'));
 ui.history.change(room);ui.update();ui.openFloor();
 assert.equal(ui.floorPreview.getFloor().key,'projects');assert.equal(ui.floorPreview.root.dataset.paintedSkeleton,'true');
 q('.hy-floor-select').value='customer';q('.hy-floor-select').dispatchEvent(new ui.root.ownerDocument.defaultView.Event('change',{bubbles:true}));
 assert.equal(ui.floorPreview.getFloor().key,'customer');assert.equal(ui.floorPreview.root.dataset.paintedSkeleton,'false');
 ui.reviewFloorFile(JSON.stringify(floorFile('projects',room)));assert.equal(ui.fileScene.getFloor().key,'projects');assert.equal(ui.fileScene.root.dataset.paintedSkeleton,'true');
 q('.hy-import').value=JSON.stringify(room);ui.reviewProposal();assert.equal(ui.proposalScene.getFloor().key,'projects');assert.equal(ui.proposalScene.root.dataset.paintedSkeleton,'true');
});

test('blueprint editing and named templates preserve scene state and persist independently on two floors',t=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},f=setup(t,storage,'projects'),{ui,q,dom}=f;
  q('.hy-blueprint-apply').click();const objects=clone(ui.history.current.objects);
  q('.hy-blueprint-edit').click();assert.equal(q('.hy-blueprint-editor-controls').hidden,false);
  q('.hy-bp-width').value='13';q('.hy-bp-width').dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(ui.history.current.blueprintPlan.width,13);assert.deepEqual(ui.history.current.objects,objects);
  q('.hy-undo').click();assert.equal(ui.history.current.blueprintPlan,undefined);
  q('.hy-redo').click();assert.equal(ui.history.current.blueprintPlan.width,13);
  q('.hy-bp-template-name').value='Team custom';q('.hy-bp-template-save').click();assert.equal(new RoomStore(storage).floor('projects'),null);
  q('.hy-save-floor').click();assert.equal(new RoomStore(storage).floor('projects').blueprintPlan.width,13);
  ui.loadFloor('customer');const otherObjects=clone(ui.history.current.objects);
  q('.hy-blueprint-load-saved').click();assert.equal(ui.history.current.blueprintPlan.width,13);assert.deepEqual(ui.history.current.objects,otherObjects);
  assert.equal(new RoomStore(storage).floor('customer'),null);q('.hy-save-floor').click();
  assert.equal(new RoomStore(storage).floor('customer').blueprintPlan.width,13);
  ui.loadFloor('projects');assert.equal(ui.history.current.blueprintPlan.width,13);assert.deepEqual(ui.history.current.objects,objects);
});

test('scene door clicks create undoable Studio drafts and Save persists only the selected floor',t=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},f=setup(t,storage,'projects'),{ui,q}=f;
  q('.hy-blueprint-apply').click();q('.hy-save-floor').click();const objects=clone(ui.history.current.objects);
  assert.ok(q('.hy-stage [data-door="entry"]'));
  q('.hy-stage [data-door="entry"]').click();assert.equal(ui.history.current.blueprintPlan.door.open,false);
  assert.equal(new RoomStore(storage).floor('projects').blueprintPlan,undefined);
  q('.hy-undo').click();assert.equal(ui.history.current.blueprintPlan,undefined);q('.hy-redo').click();
  q('.hy-save-floor').click();assert.equal(new RoomStore(storage).floor('projects').blueprintPlan.door.open,false);assert.equal(new RoomStore(storage).floor('customer'),null);assert.deepEqual(ui.history.current.objects,objects);assert.equal(q('.hy-stage .hy-door-status').hidden,true,'saving clears the old unsaved-door notice');
});

test('read-only scene previews expose door status but cannot mutate a floor',t=>{
  const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');t.after(()=>dom.window.close());
  const scene=new HybridScene(root);t.after(()=>scene.dispose());scene.render({...starterRoom(),background:'office',blueprint:'medium',blueprintPlan:defaultBlueprintPlan('medium')});
  assert.equal(root.querySelector('[data-door="entry"]').disabled,true);
});

test('blueprint fallback stays static rather than playing paths through closed doors without 3D',t=>{
  const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');t.after(()=>dom.window.close());const scene=new HybridScene(root);t.after(()=>scene.dispose());
  const p=defaultBlueprintPlan('medium');p.door.open=false;scene.render({...departmentStarterRoom(domainFloors[0]),blueprint:'medium',blueprintPlan:p},null,true);
  assert.equal(root.querySelector('[data-kind^="avatar-"]').hasAttribute('data-activity'),false);
});

test('fallback rejects closing on a static avatar in the doorway',t=>{
  const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');t.after(()=>dom.window.close());let calls=0;
  const scene=new HybridScene(root,{onDoorToggle:()=>{calls++;}});t.after(()=>scene.dispose());const p=defaultBlueprintPlan('medium'),r=departmentStarterRoom(domainFloors[0]),avatar=r.objects.find(o=>o.kind.startsWith('avatar-'));
  Object.assign(avatar,blueprintPoint(p,2.1,p.depth));scene.render({...r,blueprint:'medium',blueprintPlan:p});root.querySelector('[data-door="entry"]').click();
  assert.equal(calls,0);assert.match(root.querySelector('.hy-door-status').textContent,/ตัวละครอยู่ในช่องประตู/);
});
test('loading a structural template on a Garden department never migrates or deletes its existing props',t=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},f=setup(t,storage,'projects'),{ui,q,dom}=f;
  q('.hy-blueprint-apply').click();q('.hy-blueprint-edit').click();q('.hy-bp-template-name').value='Structure only';q('.hy-bp-template-save').click();
  const legacy=starterRoom();legacy.objects.push({id:'saved-printer',kind:'printer',x:42,y:72,scale:1,flip:false,locked:false});
  const store=new RoomStore(storage);store.apply('preview:customer',legacy);ui.loadFloor('customer');const old=clone(ui.history.current.objects);
  q('.hy-blueprint-load-saved').click();assert.equal(ui.history.current.background,'office');assert.deepEqual(ui.history.current.objects,old);
  q('.hy-save-floor').click();assert.deepEqual(new RoomStore(storage).floor('customer').objects,old);
  assert.deepEqual(parseRoomJSON(JSON.stringify(ui.history.current)).objects,old);
});

test('measured blueprints preview before applying, support Undo and save only the selected floor',t=>{
  const storage=memory(),{ui,q}=setup(t,storage,'projects');
  const original=clone(ui.history.current),avatars=original.objects.filter(o=>o.kind.startsWith('avatar-')).map(o=>[o.id,o.kind]);
  q('[data-blueprint="small"]').click();
  assert.deepEqual(ui.history.current,original);assert.match(q('.hy-blueprint-title').textContent,/8 × 6/);
  assert.match(q('.hy-blueprint-source').textContent,/พรีวิว/);
  q('.hy-blueprint-apply').click();assert.equal(ui.edition,'draft');assert.equal(ui.history.current.blueprint,'small');
  assert.match(q('.hy-blueprint-source').textContent,/ตำแหน่งจริง/);
  assert.deepEqual(ui.history.current.objects.filter(o=>o.kind.startsWith('avatar-')).map(o=>[o.id,o.kind]),avatars);
  assert.equal(storage.getItem(),undefined);
  q('.hy-undo').click();assert.deepEqual(ui.history.current,original);
  q('.hy-redo').click();assert.equal(ui.history.current.blueprint,'small');
  q('.hy-save-floor').click();
  assert.equal(new RoomStore(storage).floor('projects').blueprint,'small');assert.equal(new RoomStore(storage).floor('customer'),null);
  q('.hy-nav-edit').click();ui.navEditor.addRoute();
  assert.ok(ui.history.current.navigation.routes[0].points.length>=2);
  ui.loadFloor('customer');assert.equal(ui.history.current.blueprint,undefined);
  ui.loadFloor('projects');assert.equal(ui.history.current.blueprint,'small');
});
test('room schemas exclude runtime authority, external assets, duplicate ids and unsafe numbers',()=>{
  const room=starterRoom();assert.deepEqual(parseRoomJSON(JSON.stringify(room)),room);
  for(const bad of [
    {...room,businessId:'secret'},
    {...room,background:'https://unknown/image.png'},
    {...room,objects:[{...room.objects[0],src:'evil'}]},
    {...room,objects:[{...room.objects[0],x:'90'}]},
    {...room,objects:[{...room.objects[0],x:999}]},
    {...room,objects:[room.objects[0],room.objects[0]]},
    {...room,objects:[{...room.objects[0],kind:'__proto__'}]},
  ])assert.throws(()=>parseRoomJSON(JSON.stringify(bad)));
  assert.throws(()=>parseRoomJSON('{bad'));
  assert.throws(()=>parseRoomJSON(' '.repeat(80001)));
  assert.equal(normalizeRoom({...room,businessId:'secret',objects:[{...room.objects[0],x:Infinity}]}).businessId,undefined);
});
test('an unassigned floor uses the shared team scene in the current edition without writing it',t=>{
  const storage=memory(),domain=domainFloors.find(f=>f.key==='projects'),{ui,q}=setup(t,storage,domain.key),expected=departmentStarterRoom(domain);
  assert.deepEqual(ui.history.current,expected);
  assert.equal(ui.edition,'current');
  assert.equal(q('.hy-current-scene').hidden,false);
  assert.match(q('.hy-current-note').textContent,/Three\.js/);
  assert.equal(storage.getItem(),undefined);
  assert.equal(new RoomStore(storage).apply(`preview:${domain.key}`,starterRoom()),true);
  ui.loadFloor(domain.key);ui.edition='current';ui.updateEdition();
  assert.equal(q('.hy-current-note').textContent,'ภาพจากสถานะที่ชั้นนี้บันทึกไว้ · การแก้แบบร่างยังไม่มีผลต่อภาพนี้');
  assert.equal(new RoomStore(storage).unapply(`preview:${domain.key}`),true);
  ui.loadFloor(domain.key);assert.match(q('.hy-current-note').textContent,/Three\.js/);
});
test('department starter scenes arrange a four-role team in a readable two-row office layout',()=>{
  const domain=domainFloors.find(f=>f.key==='projects'),room=departmentStarterRoom(domain);
  const desks=room.objects.filter(object=>object.kind==='work-desk');
  assert.deepEqual(desks.map(({x,y})=>[x,y]),[[61,43],[76,51],[49,51],[64,59]]);
  assert.equal(room.objects.find(object=>object.id==='role-1-avatar').scale,.82);
  assert.equal(room.objects.find(object=>object.id==='role-1-chair').y,40.5);
  assert.equal(room.objects.find(object=>object.id==='role-1-desk').scale,.62);
  assert.equal(room.objects.filter(object=>object.kind.startsWith('avatar-')).length,domain.roles.length);
});
test('the Hybrid renderer crops anime avatars from the shared atlas as visible sprite layers',t=>{
  const {ui,q}=setup(t),room=departmentStarterRoom(domainFloors.find(f=>f.key==='projects'));
  room.objects.find(object=>object.id==='role-1-avatar').effects={...defaultEffects,opacity:.5,shadow:4,glow:true};
  ui.scene.render(room);
  const avatar=q('[data-object="role-1-avatar"]'),art=avatar.querySelector('.hy-sprite-art');
  assert.equal(avatar.dataset.renderType,'sprite');
  assert.equal(avatar.querySelector('img').hidden,true);
  assert.ok(art);
  assert.match(art.style.backgroundImage,/avatar-atlas-12\.png/);
  assert.equal(art.style.backgroundSize,'400% 300%');
  assert.equal(art.style.backgroundPosition,'100% 0%');
  assert.equal(art.style.opacity,'0.5');
  assert.match(art.style.filter,/drop-shadow/);
});
test('saved designs and per-floor snapshots survive reload independently; denied writes are atomic',()=>{
  const storage=memory(),store=new RoomStore(storage),room=starterRoom();
  assert.equal(store.save('one',room),true);
  assert.equal(store.apply('preview:lobby',room),true);
  room.objects[1].x=67;room.background='city';
  assert.equal(store.save('one',room),true);
  assert.equal(store.floor('lobby').background,'garden');
  assert.equal(store.apply('preview:customer',room),true);
  const loaded=new RoomStore(storage);
  assert.equal(loaded.floor('customer').background,'city');
  assert.equal(loaded.floor('lobby').background,'garden');
  assert.equal(loaded.apply('business:123',room),false);
  assert.equal(loaded.unapply('preview:lobby'),true);
  assert.equal(new RoomStore(storage).floor('lobby'),null);
  const failing=new RoomStore({getItem:storage.getItem,setItem(){throw Error('quota');}});
  const before=clone(failing.data);assert.equal(failing.save('two',room),false);assert.deepEqual(failing.data,before);
  assert.equal(failing.apply('preview:lobby',room),false);assert.deepEqual(failing.data,before);
});
test('add duplicate remove lock undo redo and explicit save operate on independent objects',t=>{
  const {ui,q,dom}=setup(t);
  q('[data-add="chair"]').click();const id=ui.selected;
  assert.equal(ui.history.current.objects.length,7);
  const desk=clone(ui.history.current.objects.find(o=>o.kind==='desk'));
  q('[data-nudge="right"]').click();assert.equal(ui.object().x,57);
  assert.deepEqual(ui.history.current.objects.find(o=>o.id===desk.id),desk);
  q('.hy-lock').click();assert.equal(ui.object().locked,true);assert.equal(q('.hy-delete').disabled,true);
  const x=ui.object().x;ui.move(id,{x:80});assert.equal(ui.object().x,x);
  q('.hy-lock').click();q('.hy-duplicate').click();assert.equal(ui.history.current.objects.length,8);
  q('.hy-delete').click();assert.equal(ui.history.current.objects.length,7);
  q('.hy-undo').click();assert.equal(ui.history.current.objects.length,8);
  q('.hy-redo').click();assert.equal(ui.history.current.objects.length,7);
  assert.equal(dom.window.localStorage.getItem(HYBRID_KEY),null);
  q('.hy-save').click();assert.equal(new RoomStore(dom.window.localStorage).data.designs[0].room.objects.length,7);
  assert.equal(ui.history.dirty,false);
});
test('changing backgrounds preserves objects, apply targets only chosen floor and opens assigned scene',t=>{
  const {ui,q,visits}=setup(t),before=clone(ui.history.current.objects);
  q('[data-background="city"]').click();assert.deepEqual(ui.history.current.objects,before);
  q('.hy-apply').click();q('.hy-floor-select').value='customer';q('.hy-floor-select').onchange({target:q('.hy-floor-select')});
  assert.equal(q('.hy-visit-floor').hidden,true);
  q('.hy-confirm-floor').click();assert.equal(ui.store.floor('customer').background,'city');
  assert.equal(ui.store.floor('lobby'),null);
  q('.hy-visit-floor').click();assert.deepEqual(visits,['customer']);
  q('.hy-apply').click();q('.hy-unapply').click();assert.equal(ui.store.floor('customer'),null);
});
test('AI JSON requires preview acceptance, protects locks, rejects stale preview and can undo acceptance',t=>{
  const {ui,q}=setup(t),original=clone(ui.history.current),proposal=clone(original);
  proposal.background='city';proposal.objects[1].x=55;
  q('.hy-import').value=JSON.stringify(proposal);q('.hy-review').click();
  assert.equal(q('.hy-proposal').hidden,false);assert.deepEqual(ui.history.current,original);
  q('.hy-accept').click();assert.equal(ui.history.current.background,'city');assert.equal(ui.store.data.designs.length,0);
  q('.hy-undo').click();assert.deepEqual(ui.history.current,original);
  proposal.objects[0].x=20;q('.hy-import').value=JSON.stringify(proposal);q('.hy-review').click();
  assert.equal(q('.hy-proposal').hidden,true);assert.match(q('.hy-feedback').textContent,/ล็อก/);
  proposal.objects[0]=clone(original.objects[0]);q('.hy-import').value=JSON.stringify(proposal);q('.hy-review').click();
  q('[data-add="plant"]').click();q('.hy-accept').click();
  assert.match(q('.hy-feedback').textContent,/แบบร่างเปลี่ยน/);assert.equal(ui.history.current.objects.length,7);
});
test('library protects unsaved draft; save failure does not apply a floor',t=>{
  const {ui,q}=setup(t,{getItem:()=>null,setItem(){throw Error('quota');}});
  q('[data-add="plant"]').click();q('.hy-library').click();q('.hy-new-room').click();
  assert.equal(q('.hy-discard-dialog').open,true);q('.hy-keep-draft').click();assert.equal(ui.history.current.objects.length,7);
  q('.hy-library-dialog').close();q('.hy-apply').click();q('.hy-confirm-floor').click();
  assert.match(q('.hy-floor-feedback').textContent,/บันทึกแบบไม่ได้/);assert.equal(ui.store.floor('lobby'),null);assert.equal(ui.history.dirty,true);
});
test('pointer capture changes the selected prop once; cancellation and locked objects preserve state',t=>{
  const {ui,q}=setup(t),desk=q('[data-object="desk-1"]'),stage=q('.hy-stage');
  stage.getBoundingClientRect=()=>({width:1000,height:666});
  ui.scene.pick=()=>desk;
  desk.onpointerdown({button:0,pointerId:1,clientX:400,clientY:400});
  desk.onpointermove({pointerId:1,clientX:500,clientY:440});
  assert.equal(ui.history.past.length,0);
  desk.onpointerup({pointerId:1});assert.equal(ui.history.past.length,1);assert.equal(ui.object().x,66);
  desk.onpointerdown({button:0,pointerId:2,clientX:400,clientY:400});
  desk.onpointermove({pointerId:2,clientX:50,clientY:10});desk.onpointercancel();
  assert.equal(ui.object().x,66);assert.equal(ui.history.past.length,1);
  q('.hy-play').click();desk.onpointerdown({button:0,pointerId:3,clientX:400,clientY:400});
  assert.equal(ui.scene.drag,null);
});
test('alpha hit testing selects chair through transparent desk pixels and respects visible occlusion',t=>{
  const {ui,q}=setup(t),desk=q('[data-object="desk-1"]'),chair=q('[data-object="chair-1"]');
  for(const el of q('.hy-stage').querySelectorAll('[data-object]'))el.getBoundingClientRect=()=>({left:0,top:0,right:0,bottom:0,width:0,height:0});
  for(const el of [desk,chair])el.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:100,width:100,height:100});
  const clear=new Uint8ClampedArray(128*128*4),opaque=new Uint8ClampedArray(128*128*4).fill(255);
  ui.scene.alpha.set(desk.querySelector('img').src,clear);ui.scene.alpha.set(chair.querySelector('img').src,opaque);
  assert.equal(ui.scene.pick({clientX:50,clientY:50},desk),chair);
  ui.scene.alpha.set(desk.querySelector('img').src,opaque);
  assert.equal(ui.scene.pick({clientX:50,clientY:50},chair),desk);
});
externalAssetTest('new background and standalone prop assets have image data and independent source paths',[
 'office-isometric-v4.png','garden.png','city.png','desk.png','chair.png',
].map(name=>`web/assets/office-world/${name==='office-isometric-v4.png'||name==='garden.png'||name==='city.png'?'hybrid/backgrounds':'hybrid/props'}/${name}`),async()=>{
  for(const info of [...Object.values(backgrounds),catalog.desk,catalog.chair]){
    const b=await readFile(new URL(`../web/${info.src.replace('./','')}`,import.meta.url));
    assert.equal(b.subarray(1,4).toString(),'PNG');assert.ok(b.readUInt32BE(16)>=1000);
  }
  assert.notEqual(catalog.desk.src,catalog.chair.src);
});
externalAssetTest('twelve generic anime avatars are sprite-only assets grouped separately from furniture and carry no role binding',['web/assets/office-world/hybrid/characters/avatar-atlas-12.png'],async t=>{
  assert.equal(genericAvatarKinds.length,12);
  assert.deepEqual(Object.keys(catalogGroups),['furniture','decor','characters']);
  assert.deepEqual(genericAvatarKinds,Object.keys(catalog).filter(k=>k.startsWith('avatar-')));
  assert.equal(catalog['avatar-01'].group,'characters');assert.equal(catalog['avatar-01'].renderType,'sprite');assert.equal(catalog['avatar-01'].roleBound,false);
  assert.equal(starterRoom().objects.some(o=>o.kind.startsWith('avatar-')),false);
  const {q}=setup(t);
  const characters=q('[data-catalog-group="characters"]');
  assert.ok(characters);
  assert.equal(characters.querySelectorAll('[data-add^="avatar-"]').length,12);
  assert.equal(q('[data-catalog-group="furniture"]').querySelectorAll('[data-add]').length,6);
  for(const [i,kind] of genericAvatarKinds.entries()){
    const svg=await readFile(new URL(`../web/${catalog[kind].src.replace('./','')}`,import.meta.url),'utf8');
    assert.match(svg,/<svg\b/);assert.match(svg,/avatar-atlas-12\.png/);assert.match(svg,/viewBox=/);
    assert.doesNotMatch(svg,/agent|role|tenant|business/i);
    assert.equal(catalog[kind].name,`Avatar กลาง ${String(i+1).padStart(2,'0')}`);
  }
  const atlas=await readFile(new URL('../web/assets/office-world/hybrid/characters/avatar-atlas-12.png',import.meta.url));
  assert.equal(atlas.subarray(1,4).toString(),'PNG');assert.equal(atlas[25],6);
  assert.equal(atlas.readUInt32BE(16),1182);assert.equal(atlas.readUInt32BE(20),1330);
});
test('typing a brief is retained when a pointer selection runs before blur',t=>{
  const {ui,q,dom}=setup(t);
  q('.hy-brief').value='เก็บไอเดียนี้ไว้';
  q('.hy-brief').dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  ui.select('plant-1');
  assert.equal(q('.hy-brief').value,'เก็บไอเดียนี้ไว้');
  assert.equal(ui.history.current.brief,'เก็บไอเดียนี้ไว้');
  assert.equal(ui.history.dirty,true);
});
test('editor loads the selected floor instead of the last library design; current edition preserves its snapshot',t=>{
  const storage=memory(),s=new RoomStore(storage),lobby=starterRoom(),customer={...starterRoom(),name:'Customer',background:'city'};
  s.apply('preview:lobby',lobby);s.apply('preview:customer',customer);s.save('latest',{...customer,name:'Unrelated'});
  const {ui,q}=setup(t,storage);
  assert.deepEqual(ui.history.current,lobby);
  ui.loadFloor('customer');assert.deepEqual(ui.history.current,customer);
  ui.change({background:'garden'});
  ui.edition='current';ui.updateEdition();
  assert.equal(ui.currentScene.room.background,'city');
  assert.equal(ui.history.current.background,'garden');
  assert.equal(ui.saveFloor(),true);
  assert.equal(new RoomStore(storage).floor('customer').background,'garden');
  assert.deepEqual(new RoomStore(storage).floor('lobby'),lobby);
  ui.loadFloor('projects');
  assert.equal(ui.edition,'current');assert.equal(q('.hy-layout').hidden,true);
  assert.equal(q('.hy-current-scene').hidden,false);
  assert.match(q('.hy-current-note').textContent,/Three\.js/);
  assert.equal(ui.hasUnsavedFloor(),false);
});
test('saving a library copy cannot bypass floor dirty guards; quota and concurrent changes preserve draft',t=>{
  const storage=memory(),s=new RoomStore(storage);s.apply('preview:lobby',starterRoom());
  const {ui,q}=setup(t,storage);
  ui.change({name:'Draft'});ui.save();assert.equal(ui.history.dirty,false);assert.equal(ui.hasUnsavedFloor(),true);
  q('.hy-edit-floor').onchange({target:{value:'customer'}});
  assert.equal(q('.hy-discard-dialog').open,true);assert.equal(ui.editingFloor,'lobby');
  q('.hy-keep-draft').click();
  const other=new RoomStore(storage);other.apply('preview:lobby',{...starterRoom(),name:'Other tab'});
  assert.equal(ui.saveFloor(),false);assert.equal(ui.history.current.name,'Draft');
  assert.equal(new RoomStore(storage).floor('lobby').name,'Other tab');
  ui.loadFloor('customer');ui.change({name:'Still here'});
  ui.storage={getItem:storage.getItem,setItem(){throw Error('quota');}};
  assert.equal(ui.saveFloor(),false);assert.equal(ui.history.current.name,'Still here');
});
test('floor exchange validates scope and effects; importing is staged until explicit floor save',t=>{
  const room=starterRoom();
  room.objects[4].interaction={type:'popup',title:'Welcome',body:'Plain text'};
  room.objects[4].effects={...defaultEffects,shadow:8,hover:'lift'};
  const file=floorFile('customer',room);assert.deepEqual(parseFloorJSON(JSON.stringify(file)),file);
  for(const bad of [{...file,floor:'tenant-1'},{...file,scope:'live'},{...file,tenant:'x'},{...file,edition:'original'}])assert.throws(()=>parseFloorJSON(JSON.stringify(bad)));
  for(const field of [{interaction:{type:'url',url:'javascript:alert(1)'}},{interaction:{type:'floor',floor:'unknown'}},{effects:{...defaultEffects,opacity:0}},{effects:{...defaultEffects,hover:'script'}}]){
    const bad=clone(room);Object.assign(bad.objects[4],field);assert.throws(()=>parseRoomJSON(JSON.stringify(bad)));
  }
  const {ui,q}=setup(t);
  ui.reviewFloorFile(JSON.stringify(file));assert.equal(q('.hy-file-dialog').open,true);assert.equal(ui.editingFloor,'lobby');assert.equal(ui.store.floor('customer'),null);
  q('.hy-file-accept').click();assert.equal(ui.editingFloor,'customer');assert.deepEqual(ui.history.current,room);assert.equal(ui.store.floor('customer'),null);
  assert.equal(ui.saveFloor(),true);assert.deepEqual(ui.store.floor('customer'),room);
  ui.reviewFloorFile(JSON.stringify(floorFile('customer',null)));q('.hy-file-accept').click();
  assert.ok(ui.store.floor('customer'));assert.equal(ui.originalDraft,true);
  assert.equal(q('.hy-original-frame iframe').getAttribute('src'),'?office-edition=original#office/customer');
  assert.equal(ui.saveFloor(),true);assert.equal(ui.store.floor('customer'),null);
});
test('object effects and popup work through the same renderer after save/reload; popup content is plain text',t=>{
  const storage=memory(),s=new RoomStore(storage);s.apply('preview:lobby',starterRoom());
  const {ui,q}=setup(t,storage);
  ui.select('desk-1');
  ui.setInteraction({type:'popup',title:'<img src=x>',body:'<script>evil()</script>'});
  ui.move('desk-1',{effects:{...defaultEffects,opacity:.65,shadow:10,glow:true,hover:'highlight'}});
  q('.hy-test-action').click();
  assert.equal(q('.hy-interaction-popup').open,true);
  assert.equal(q('.hy-interaction-popup h2').textContent,'<img src=x>');
  assert.equal(q('.hy-interaction-popup script'),null);
  q('.hy-interaction-popup button').click();assert.equal(ui.saveFloor(),true);
  ui.loadFloor('lobby');assert.equal(ui.object().effects.opacity,.65);
  q('.hy-play').click();ui.scene.activate('desk-1');
  assert.equal(q('.hy-interaction-popup p').textContent,'<script>evil()</script>');
  const image=q('.hy-stage [data-object="desk-1"] img');
  assert.equal(image.style.opacity,'0.65');assert.match(image.style.filter,/drop-shadow/);
  assert.equal(q('.hy-stage [data-object="desk-1"]').dataset.hover,'highlight');
});
test('play elevator navigates without opening assignment; locked objects cannot acquire actions',t=>{
  const storage=memory(),s=new RoomStore(storage);s.apply('preview:lobby',starterRoom());
  const {ui,q,visits}=setup(t,storage);ui.scene.activate('lift-1');
  assert.equal(q('.hy-play-elevator').open,true);assert.equal(q('.hy-floor-dialog').open,false);
  q('[data-play-floor="customer"]').click();assert.deepEqual(visits,['customer']);
  ui.select('lift-1');ui.setInteraction({type:'none'});assert.equal(ui.object().interaction,undefined);
  ui.select('desk-1');ui.setInteraction({type:'floor',floor:'projects'});ui.saveFloor();ui.scene.activate('desk-1');
  assert.deepEqual(visits,['customer','projects']);
});


test('Dev alignment edits one floor, keeps art/inventory, supports Undo and stale-save protection',t=>{
 const {ui,q,dom}=setup(t,undefined,'projects');q('.hy-start-edit').click();const objects=clone(ui.history.current.objects),background=ui.history.current.background;
 q('.hy-dev-toggle').click();assert.equal(q('.hy-dev-body').hidden,false);assert.equal(q('.hy-stage').dataset.calibrationView,'overlay');
 q('.hy-dev-x').value='48';q('.hy-dev-x').dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.deepEqual(ui.history.current.skeletonAlignment,{x:48,y:0,scale:1});assert.deepEqual(ui.history.current.objects,objects);assert.equal(ui.history.current.background,background);
 q('.hy-undo').click();assert.equal(ui.history.current.skeletonAlignment,undefined);q('.hy-redo').click();assert.equal(ui.history.current.skeletonAlignment.x,48);
 assert.equal(ui.saveFloor(),true);const saved=ui.store.floor('projects');ui.loadFloor('customer');assert.equal(ui.history.current.skeletonAlignment,undefined);assert.equal(ui.skeletonEditor.enabled,false);
 ui.loadFloor('projects');assert.deepEqual(ui.history.current,saved);const fresh=new RoomStore(ui.storage);fresh.apply('preview:projects',{...saved,skeletonAlignment:{x:99,y:0,scale:1}});assert.equal(ui.saveFloor(),false);assert.equal(ui.history.current.skeletonAlignment.x,48);
});

test('Dev alignment mode yields to play/navigation and disabled mode does not restart paused playback',t=>{const {ui,q}=setup(t,undefined,'projects');q('.hy-start-edit').click();q('.hy-dev-toggle').click();assert.equal(ui.skeletonEditor.enabled,true);q('.hy-play').click();assert.equal(ui.skeletonEditor.enabled,false);assert.equal(ui.playing,true);q('.hy-play').click();assert.equal(ui.playing,false);q('.hy-dev-toggle').click();q('.hy-nav-edit').click();assert.equal(ui.skeletonEditor.enabled,false);assert.equal(ui.navigationEditing,true);});

test('Dev piece edits move only skeleton records, save per floor and retain selected art',t=>{const {ui,q,dom}=setup(t,undefined,'projects');q('.hy-start-edit').click();const original=clone(ui.history.current.objects);q('.hy-dev-toggle').click();const change=(sel,v)=>{q(sel).value=v;q(sel).dispatchEvent(new dom.window.Event('change',{bubbles:true}));};change('.hy-dev-target','object:role-1-chair');change('.hy-dev-x','24');change('.hy-dev-scale','110');assert.deepEqual(ui.history.current.objects,original);assert.equal(ui.history.current.skeletonParts[0].id,'object:role-1-chair');assert.equal(ui.history.current.skeletonParts[0].scale,1.1);change('.hy-dev-art','perspective-v5');assert.match(q('.hy-stage .hy-background').src,/office-isometric-v5.png/);assert.equal(ui.saveFloor(),true);ui.loadFloor('customer');assert.equal(ui.history.current.skeletonParts,undefined);assert.equal(ui.history.current.officeArt,undefined);ui.loadFloor('projects');assert.equal(ui.history.current.officeArt,'perspective-v5');assert.equal(ui.history.current.skeletonParts[0].x,24);assert.deepEqual(ui.history.current.objects,original);});

test('explicit same-sheet rebuild preserves IDs, saves only its floor and removes independent image references',t=>{const {ui,q}=setup(t,undefined,'projects');const ids=ui.history.current.objects.map(o=>[o.id,o.kind]);q('.hy-rebuild-sheet').click();assert.equal(ui.history.current.sceneSheet,'office-sheet/v1');assert.deepEqual(ui.history.current.objects.map(o=>[o.id,o.kind]),ids);assert.equal(q('.hy-stage').dataset.unifiedSheet,'true');assert.equal(q('.hy-stage .hy-background').getAttribute('src'),null);assert.equal(q('.hy-sheet-layers').hidden,false);assert.equal(ui.saveFloor(),true);ui.loadFloor('customer');assert.equal(ui.history.current.sceneSheet,undefined);ui.loadFloor('projects');assert.equal(ui.history.current.sceneSheet,'office-sheet/v1');assert.deepEqual(ui.history.current.objects.map(o=>[o.id,o.kind]),ids);});

test('without a 3D navigation adapter, walking is unavailable and stale walk overrides stay still',t=>{
 const {ui}=setup(t,undefined,'projects');const actor=ui.history.current.objects.find(o=>catalog[o.kind].renderType==='sprite');assert.ok(actor);
 ui.scene.openActivity(actor);const walking=[...ui.scene.popup.querySelectorAll('button')].find(b=>b.textContent==='เดินในสำนักงาน');assert.equal(walking.disabled,true);
 ui.scene.activityModes.set(actor.id,{mode:'walking',at:0});ui.scene.playing=true;ui.scene.elapsed=30000;ui.scene.paintActivity();
 const node=[...ui.scene.root.querySelector('.hy-objects').children].find(n=>n.dataset.object===actor.id);assert.notEqual(node.dataset.activity,'walking');
});

test('temporary character picker updates only appearance, saves its floor and retains identity through Undo',t=>{
 const {ui,q,dom}=setup(t,undefined,'projects');q('.hy-start-edit').click();
 const before=clone(ui.history.current),avatar=before.objects.find(o=>o.kind.startsWith('avatar-'));ui.select(avatar.id);
 const picker=q('.hy-appearance');assert.equal(q('.hy-appearance-field').hidden,false);
 picker.value='zuri';picker.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.deepEqual(ui.history.current.objects.map(o=>[o.id,o.kind]),before.objects.map(o=>[o.id,o.kind]));assert.equal(ui.history.current.objects.find(o=>o.id===avatar.id).appearance,'zuri');
 q('.hy-save-floor').click();assert.equal(ui.store.floor('projects').objects.find(o=>o.id===avatar.id).appearance,'zuri');assert.equal(ui.store.floor('customer'),null);
 q('.hy-undo').click();assert.equal(ui.history.current.objects.find(o=>o.id===avatar.id).appearance,undefined);
});
