import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {defaultNativeRoom,validateNativeRoom,NativeHistory,copy,createNativeObject,NATIVE_LIMIT,nativeDecor,nativeObjects} from '../web/native-state.js';
import {RoomStore,starterRoom,floorFile,parseFloorJSON} from '../web/hybrid-state.js';
import {NativeStudio} from '../web/native-studio.js';
import {translateObjects,objectScale} from '../web/native-transform.js';
import {OFFICE_ASSETS,PLACEABLE_STUDIO_GLBS} from '../web/office-assets.js';

test('a Native floor draft can be retried after a transient storage failure',async t=>{
  const storage=memory(),seed=new RoomStore(storage);seed.applyNative('projects',defaultNativeRoom());
  const {editor}=await setup(t,storage);editor.move('desk-0',{x:2});
  const write=storage.setItem;let reject=true;storage.setItem=(key,value)=>{if(reject)throw new DOMException('full','QuotaExceededError');write(key,value);};
  assert.equal(editor.save(),false);assert.equal(editor.history.dirty,true);assert.notEqual(new RoomStore(storage).nativeFloor('projects').objects[0].x,2);
  reject=false;assert.equal(editor.save(),true);assert.equal(editor.history.dirty,false);assert.equal(new RoomStore(storage).nativeFloor('projects').objects[0].x,2);
});

const tinyTexture={data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',repeatX:2,repeatY:3,offsetX:.1,offsetY:0,rotation:30,opacity:.7};

const memory=()=>{let data;return{getItem:()=>data,setItem:(k,v)=>{data=v;}};};
class FixtureOffice{
  constructor(root,options){this.root=root;this.options=options;this.furniture=new Map();this.assetModels=new Map(PLACEABLE_STUDIO_GLBS.map(asset=>[asset.assetId,{}]));this.selectionRing=null;}
  async load(){this.loaded=true;return true;}
  showDomain(d,agents){this.domain=d;this.agents=agents;}
  setNativeRoom(room){this.room=copy(room);}
  cancelObjectDrag(){}
  resize(){}
  dispose(){this.disposed=true;}
}
async function setup(t,storage=memory(),initialFloor='projects'){
  const dom=new JSDOM('<main></main>',{url:'https://office.test'});
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const root=dom.window.document.querySelector('main'),visits=[];
  const editor=new NativeStudio(root,{storage,initialFloor,onVisitFloor:f=>visits.push(f),loadOffice:async()=>({Office:FixtureOffice})});await editor.ready;
  t.after(()=>{editor.dispose();dom.window.close();});
  return {editor,dom,storage,visits,root,q:s=>root.querySelector(s)};
}
test('asset library filters named cards and places a stable GLB asset ID into the selected floor draft',async t=>{
  const {editor:e,q,dom,root,storage}=await setup(t),agents=copy(e.office.agents);
  assert.equal(qAll(root,'.ns-asset-card').length,OFFICE_ASSETS.length);
  assert.ok(qAll(root,'.ns-asset-card').every(card=>card.querySelector('img')?.getAttribute('src')&&card.querySelector('code')?.textContent===card.dataset.assetAdd));
  q('[data-asset-category="furniture"]').click();assert.equal(qAll(root,'.ns-asset-card').length,14);
  const search=q('.ns-asset-search input');search.value='coffee-table.studio.v1';search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(qAll(root,'.ns-asset-card').length,1);assert.match(q('.ns-asset-card strong').textContent,/โต๊ะกลาง/);
  search.value='';search.dispatchEvent(new dom.window.Event('input'));
  q('[data-asset-category="all"]').click();
  const glb=OFFICE_ASSETS.find(asset=>asset.assetId==='visual-office.sofa.lounge.v1');
  q(`[data-asset-add="${glb.assetId}"]`).click();
  const placed=e.object();assert.equal(placed.kind,'asset');assert.equal(placed.assetId,glb.assetId);assert.equal(Object.hasOwn(placed,'slot'),false);
  assert.ok(placed.id.startsWith('prop-'));assert.deepEqual(validateNativeRoom(e.history.current),e.history.current);
  assert.deepEqual(e.office.room,e.history.current);assert.deepEqual(e.office.agents,agents);
  assert.equal(e.save(),true);
  const persisted=new RoomStore(storage).nativeFloor('projects');assert.equal(persisted.objects.at(-1).assetId,glb.assetId);
  assert.deepEqual(parseFloorJSON(JSON.stringify(floorFile('projects',persisted))).room,persisted);
});
function qAll(root,selector){return [...root.querySelectorAll(selector)];}
test('multi-selection moves as one transaction, snaps without changing spacing and duplicates without agent seats',async t=>{
  const {editor:e,q,storage}=await setup(t),roster=copy(e.office.agents);
  e.selectObject('desk-0');e.selectObject('chair-0',{additive:true});const before=copy(e.history.current),past=e.history.past.length;
  e.grid=.25;e.move('desk-0',{x:-1.12,z:0});
  assert.equal(e.history.past.length,past+1);
  const a=e.history.current.objects;assert.equal(a[0].x,-1);assert.equal(a[1].x,-1);assert.equal(a[1].z-a[0].z,.95);
  q('.ns-undo').click();assert.deepEqual(e.history.current,before);q('.ns-redo').click();
  e.duplicate();const copies=e.selectedObjects();assert.equal(copies.length,2);assert.ok(copies.every(o=>!Object.hasOwn(o,'slot')));
  assert.ok(Math.abs(copies[1].z-copies[0].z-.95)<1e-9);
  e.resizeSelection(1.4);assert.ok(e.selectedObjects().every(o=>objectScale(o).x===1.4));
  e.finish({texture:tinyTexture});const textured=e.object().id;
  e.history.change({...e.history.current,projection:'perspective'});e.update();assert.equal(e.save(),true);
  const saved=copy(e.history.current);assert.deepEqual(parseFloorJSON(JSON.stringify(floorFile('projects',saved))).room,saved);
  e.loadFloor('customer');assert.equal(e.history.current.projection,undefined);
  e.loadFloor('projects');assert.deepEqual(e.history.current,saved);e.selectObject(textured);assert.deepEqual(e.currentFinish().texture,tinyTexture);
  assert.deepEqual(e.office.agents,roster);assert.equal(new RoomStore(storage).nativeSaved('projects').projection,'perspective');
});
test('scale/dimension edits, tilt, locked groups and failed group copies preserve atomic state',async t=>{
  const {editor:e,q,dom}=await setup(t);
  e.office.objectDimensions=()=>({size:{x:2,y:1,z:1}});
  const width=q('[data-dimension="x"]');width.value='300';width.dispatchEvent(new dom.window.Event('change'));
  assert.deepEqual(e.object().scale,{x:1.5,y:1.5,z:1.5});
  q('.ns-proportions').click();width.value='400';width.dispatchEvent(new dom.window.Event('change'));
  assert.deepEqual(e.object().scale,{x:3,y:1.5,z:1.5});
  const tilt=q('[data-tilt="x"]');tilt.value='20';tilt.dispatchEvent(new dom.window.Event('change'));assert.equal(e.object().tilt.x,20);
  const good=copy(e.history.current);e.resizeSelection(2);assert.deepEqual(e.history.current,good);
  e.selectObject('chair-0',{additive:true});e.changeObject({...e.object(),locked:true});e.resizeSelection(1.1);
  assert.equal(objectScale(e.history.current.objects[1]).x,1);assert.ok(objectScale(e.history.current.objects[0]).x>3);
  e.selectObject('desk-0');while(e.history.current.objects.length<47)e.add('plant');
  e.selectObject('desk-0');e.selectObject('desk-1',{additive:true});const full=copy(e.history.current);e.duplicate();assert.deepEqual(e.history.current,full);
  q('.ns-play').click();e.resizeSelection(.5);e.move('desk-0',{x:0});assert.deepEqual(e.history.current,full);
});
test('snap aligns origins to other furniture and clamps whole groups at room boundaries',()=>{
  const room=defaultNativeRoom(),ids=['desk-0','chair-0'];
  const snapped=translateObjects(room,ids,'desk-0',{x:.15,z:1.31},{align:true});
  assert.equal(snapped[0].x,.1);assert.equal(snapped[0].z,1.35);
  const edge=translateObjects(room,ids,'desk-0',{x:99,z:99});
  assert.ok(edge.every(o=>o.x<=5.5&&o.z<=3.8));assert.equal(Math.round((edge[1].z-edge[0].z)*100),95);
});
test('transform and raster contracts reject nonfinite axes, excessive dimensions, external images and oversized state',()=>{
  const base=defaultNativeRoom(),object=base.objects[0];
  for(const patch of [{scale:{x:0,y:1,z:1}},{scale:{x:1,y:1,z:1,admin:1}},{tilt:{x:90,z:0}},{scale:{x:NaN,y:1,z:1}},{finish:{texture:{...tinyTexture,data:'https://example.com/image.png'}}},{finish:{texture:{...tinyTexture,opacity:2}}},{finish:{texture:{...tinyTexture,data:'data:image/svg+xml;base64,PHN2Zz4='}}}]){
    assert.throws(()=>validateNativeRoom({...base,objects:[{...object,...patch}]}));
  }
  const bytes=Buffer.from(tinyTexture.data.split(',')[1],'base64');bytes.writeUInt32BE(10000,16);
  assert.throws(()=>validateNativeRoom({...base,objects:[{...object,finish:{texture:{...tinyTexture,data:'data:image/png;base64,'+bytes.toString('base64')}}}]}));
});
test('typed size, tilt and texture persist before blur or selection, and incomplete fields block save',async t=>{
  const {editor:e,q,dom}=await setup(t);
  e.office.objectDimensions=id=>{const s=objectScale(nativeObjects(e.history.current).find(o=>o.id===id));return {size:{x:2*s.x,y:s.y,z:s.z}};};
  e.update();
  const input=(selector,value)=>{const el=q(selector);el.value=value;el.dispatchEvent(new dom.window.Event('input'));};
  input('.ns-scale','125');assert.equal(e.object().scale.x,1.25);
  input('[data-dimension="x"]','300');assert.equal(e.object().scale.x,1.5);
  input('[data-tilt="z"]','15');e.finish({texture:tinyTexture});input('[data-texture="repeatX"]','4');
  e.selectObject('chair-0');e.selectObject('desk-0');assert.equal(e.object().scale.x,1.5);assert.equal(e.object().tilt.z,15);assert.equal(e.currentFinish().texture.repeatX,4);
  input('.ns-scale','');assert.equal(e.save(),false);e.update();
  input('[data-dimension="x"]','');assert.equal(e.save(),false);e.update();assert.equal(e.save(),true);
});
test('native file schema pins geometry identities and rejects authority, scripts, invalid scope and transforms',()=>{
  const room=defaultNativeRoom();assert.deepEqual(validateNativeRoom(room),room);
  const file=floorFile('projects',room);assert.deepEqual(parseFloorJSON(JSON.stringify(file)),file);
  for(const bad of [
    {...room,tenantId:'x'},{...room,objects:[...room.objects,room.objects[0]]},
    {...room,objects:room.objects.map((o,i)=>i?o:{...o,id:'desk-9'})},
    {...room,objects:room.objects.map((o,i)=>i?o:{...o,x:Infinity})},
    {...room,objects:room.objects.map((o,i)=>i?o:{...o,interaction:{type:'floor',floor:'evil'}})},
    {...room,objects:room.objects.map((o,i)=>i?o:{...o,interaction:{type:'popup',title:'X',body:'Y',script:'bad'}})},
  ])assert.throws(()=>validateNativeRoom(bad));
  assert.throws(()=>floorFile('lobby',room));
  assert.throws(()=>parseFloorJSON(JSON.stringify({...file,scope:'business'})));
});
test('catalog edits persist independently per floor, copies never inherit agent slots, and empty rooms are valid',async t=>{
  const {editor:e,q,storage}=await setup(t),agents=copy(e.office.agents);
  const original=copy(e.object());q('.ns-duplicate').click();
  assert.equal(e.history.current.objects.length,13);assert.equal(e.object().kind,'desk');assert.equal(Object.hasOwn(e.object(),'slot'),false);
  assert.notEqual(e.object().id,original.id);assert.deepEqual(e.object().interaction,original.interaction);
  q('[data-asset-add="visual-office.plant.standard.v1"]').click();const plantId=e.object().id;
  e.action({type:'popup',title:'ต้นไม้ของทีม',body:'ดูแลร่วมกัน'});
  q('.ns-delete').click();assert.equal(e.history.current.objects.some(o=>o.id===plantId),false);
  assert.equal(q('.ns-delete').disabled,true);e.remove();assert.equal(e.history.current.objects.length,13);
  q('.ns-undo').click();assert.equal(e.history.current.objects.find(o=>o.id===plantId).interaction.title,'ต้นไม้ของทีม');
  e.selected=plantId;e.update();q('.ns-lock').click();const count=e.history.current.objects.length;
  e.remove();e.duplicate();assert.equal(e.history.current.objects.length,count);
  q('.ns-lock').click();q('.ns-play').click();e.add('chair');e.remove();assert.equal(e.history.current.objects.length,count);
  assert.equal(q('.ns-undo').disabled,true);q('.ns-play').click();
  e.selected='chair-0';e.update();e.remove();assert.deepEqual(e.office.agents,agents);
  assert.equal(e.save(),true);const saved=copy(e.history.current);
  e.loadFloor('customer');assert.deepEqual(e.history.current,defaultNativeRoom());
  e.loadFloor('projects');assert.deepEqual(e.history.current,saved);
  assert.deepEqual(parseFloorJSON(JSON.stringify(floorFile('projects',saved))).room,saved);
  while(e.history.current.objects.length){e.selected=e.history.current.objects[0].id;e.remove();}
  assert.equal(q('.ns-delete').disabled,true);assert.equal(q('.ns-x').disabled,true);assert.equal(e.save(),true);
  assert.deepEqual(new RoomStore(storage).nativeFloor('projects').objects,[]);
  e.loadFloor('projects');assert.equal(e.history.current.objects.length,0);e.add('chair');assert.equal(e.history.current.objects.length,1);
  assert.deepEqual(e.office.agents,agents);
});
test('native validation bounds catalog size and disallows prop seat/role injection while reading original files',()=>{
  const objects=Array.from({length:NATIVE_LIMIT},(_,i)=>createNativeObject('chair',`prop-test-${String(i).padStart(8,'0')}`));
  assert.equal(validateNativeRoom({schemaVersion:'office-3d/v1',objects}).objects.length,NATIVE_LIMIT);
  assert.throws(()=>validateNativeRoom({schemaVersion:'office-3d/v1',objects:[...objects,createNativeObject('plant','prop-over-limit')]}));
  for(const bad of [{...objects[0],slot:0},{...objects[0],role:'manager'},{...objects[0],kind:'agent'}]){
    assert.throws(()=>validateNativeRoom({schemaVersion:'office-3d/v1',objects:[bad]}));
  }
  assert.deepEqual(validateNativeRoom(defaultNativeRoom()),defaultNativeRoom());
});
test('room finishes share floor history, file exchange and persistence without changing props or agents',async t=>{
  const {editor:e,q,storage}=await setup(t),objects=copy(e.history.current.objects),agents=copy(e.office.agents);
  q('[data-room-surface="wall-left"]').click();assert.equal(q('.ns-object-editor').hidden,true);
  q('[data-surface-color="#a6b9b3"]').click();q('.ns-material').onchange({target:{value:'wood'}});
  assert.deepEqual(e.office.room.surfaces['wall-left'],{color:'#a6b9b3',material:'wood'});
  q('.ns-undo').click();assert.equal(e.history.current.surfaces['wall-left'].material,undefined);
  q('.ns-redo').click();assert.equal(e.history.current.surfaces['wall-left'].material,'wood');
  q('.ns-play').click();e.finish({color:'#000000'});assert.equal(e.history.current.surfaces['wall-left'].color,'#a6b9b3');q('.ns-play').click();
  q('.ns-color-hex').value='oops';assert.equal(e.save(),false);e.update();
  assert.equal(e.save(),true);const saved=copy(e.history.current);
  assert.deepEqual(parseFloorJSON(JSON.stringify(floorFile('projects',saved))).room,saved);
  e.loadFloor('customer');assert.equal(e.history.current.surfaces,undefined);
  e.loadFloor('projects');assert.deepEqual(e.history.current,saved);assert.deepEqual(e.office.agents,agents);
  e.selectSurface('wall-left');q('.ns-surface-reset').click();assert.equal(e.history.current.surfaces,undefined);
  assert.deepEqual(e.history.current.objects,objects);
  q('.ns-undo').click();assert.deepEqual(e.history.current,saved);
  const bad=[null,[],{'unknown-wall':{color:'#ffffff'}},{floor:{color:'red'}},{floor:{material:'url(x)'}},{floor:{role:'admin'}},{floor:{color:'#fffffff'}}];
  for(const surfaces of bad)assert.throws(()=>validateNativeRoom({...saved,surfaces}));
  const other=new RoomStore(storage);other.applyNative('projects',{...saved,surfaces:{floor:{material:'stone'}}});
  assert.equal(e.save(),false);assert.deepEqual(e.history.current,saved);
});
test('original decor moves, duplicates and deletes independently; legacy colors, file exchange and floor isolation survive',async t=>{
  const storage=memory(),room={...defaultNativeRoom(),surfaces:{'lounge-sofa':{color:'#d6ecfa',material:'fabric'}}};
  new RoomStore(storage).applyNative('projects',room);
  const {editor:e,q}=await setup(t,storage),agents=copy(e.office.agents);
  q('[data-room-surface="lounge-sofa"]').click();assert.equal(e.object().id,'builtin-lounge-sofa');
  assert.deepEqual(e.object().finish,room.surfaces['lounge-sofa']);assert.equal(q('.ns-object-editor').hidden,false);
  e.move(e.selected,{x:-4.5,z:2,rotation:90});e.duplicate();const duplicate=e.object().id;
  assert.equal(e.object().source,'lounge-sofa');assert.equal(e.object().slot,undefined);
  e.finish({color:'#c6a052'});assert.equal(nativeDecor(e.history.current).find(o=>o.source==='lounge-sofa').finish.color,'#d6ecfa');
  e.selectSurface('lounge-sofa');e.remove();assert.equal(nativeDecor(e.history.current).some(o=>o.source==='lounge-sofa'),false);
  assert.ok(e.history.current.objects.some(o=>o.id===duplicate));q('.ns-undo').click();
  assert.equal(nativeDecor(e.history.current).find(o=>o.source==='lounge-sofa').x,-4.5);
  e.selectSurface('storage');e.remove();assert.equal(e.save(),true);
  const saved=copy(e.history.current);e.loadFloor('customer');assert.equal(nativeDecor(e.history.current).length,8);
  e.loadFloor('projects');assert.deepEqual(e.history.current,saved);
  assert.equal(nativeDecor(e.history.current).some(o=>o.source==='storage'),false);
  assert.deepEqual(parseFloorJSON(JSON.stringify(floorFile('projects',saved))).room,saved);
  e.selectSurface('storage');assert.ok(e.object());assert.equal(e.object().x,-6.58);q('.ns-undo').click();
  assert.equal(nativeDecor(e.history.current).some(o=>o.source==='storage'),false);
  assert.deepEqual(e.office.agents,agents);
});
test('new desk/chair finishes are independent, copied and restored; locked objects and Play block edits',async t=>{
  const {editor:e,q}=await setup(t);e.add('chair');const id=e.object().id;
  e.finish({color:'#e8820c',material:'metal'});e.duplicate();const duplicate=e.object().id;
  assert.deepEqual(e.object().finish,{color:'#e8820c',material:'metal'});
  e.finish({color:'#d6ecfa'});assert.equal(e.history.current.objects.find(o=>o.id===id).finish.color,'#e8820c');
  q('.ns-lock').click();e.finish({color:'#000000'});assert.equal(e.object().finish.color,'#d6ecfa');
  q('.ns-lock').click();q('.ns-play').click();e.finish(null);assert.equal(e.object().finish.color,'#d6ecfa');
  q('.ns-play').click();q('.ns-surface-reset').click();assert.deepEqual(e.object().finish,{});
  q('.ns-undo').click();assert.equal(e.object().finish.color,'#d6ecfa');
  assert.equal(e.save(),true);e.loadFloor('projects');
  assert.equal(e.history.current.objects.find(o=>o.id===duplicate).finish.material,'metal');
});
test('decor schema rejects forged source/slot/builtin identity and unsafe finish while allowing explicit empty decor',()=>{
  const room=defaultNativeRoom(),decor=nativeDecor(room);
  assert.deepEqual(validateNativeRoom({...room,decor:[]}).decor,[]);
  for(const bad of [
    {...room,decor:[{...decor[0],slot:0}]},
    {...room,decor:[{...decor[0],source:'wall-left'}]},
    {...room,decor:[decor[0],decor[0]]},
    {...room,objects:[...room.objects,decor[0]]},
    {...room,decor:[{...decor[0],finish:{material:'url(secret)'}}]},
    {...room,objects:[createNativeObject('room-decor','prop-invalid-01')]},
  ])assert.throws(()=>validateNativeRoom(bad));
  assert.equal(nativeObjects({...room,objects:[],decor:[]}).length,0);
});
test('saving native layouts is atomic and isolated, preserves hybrid alternatives and survives reload',()=>{
  const storage=memory(),s=new RoomStore(storage),native=defaultNativeRoom();
  s.apply('preview:projects',starterRoom());s.apply('preview:customer',{...starterRoom(),background:'city'});
  native.objects[0].x=-1.2;s.applyNative('projects',native);
  const reloaded=new RoomStore(storage);
  assert.equal(reloaded.edition('projects'),'native3d');assert.equal(reloaded.floor('projects'),null);
  assert.equal(reloaded.nativeFloor('projects').objects[0].x,-1.2);
  assert.equal(reloaded.floor('customer').background,'city');
  assert.ok(reloaded.data.floors['preview:projects']);
  reloaded.apply('preview:projects',starterRoom());assert.equal(new RoomStore(storage).nativeSaved('projects').objects[0].x,-1.2);
  const denied=new RoomStore({getItem:storage.getItem,setItem(){throw Error('quota');}}),before=copy(denied.data);
  assert.equal(denied.applyNative('projects',defaultNativeRoom()),false);assert.deepEqual(denied.data,before);
  reloaded.unapply('preview:projects');assert.equal(new RoomStore(storage).nativeFloor('projects'),null);
  assert.equal(new RoomStore(storage).edition('projects'),'original');
});
test('editor loads actual saved floor, moves chairs independently and protects dirty switches and locks',async t=>{
  const storage=memory(),s=new RoomStore(storage),room=defaultNativeRoom();room.objects[0].x=-2;s.applyNative('projects',room);
  const {editor:e,q}=await setup(t,storage);
  assert.equal(e.office.room.objects[0].x,-2);
  q('[data-native-object="chair-0"]').click();e.move('chair-0',{x:-1,z:0,rotation:45});
  assert.equal(e.history.current.objects[0].x,-2);assert.equal(e.office.room.objects[1].x,-1);
  q('.ns-lock').click();e.move('chair-0',{x:3});assert.equal(e.object().x,-1);
  q('.ns-floor').onchange({target:{value:'customer'}});assert.equal(q('.ns-discard').open,true);
  q('.ns-keep').click();assert.equal(e.floor,'projects');assert.equal(e.history.dirty,true);
  q('.ns-undo').click();assert.equal(e.object().locked,false);
  q('.ns-save').click();assert.equal(new RoomStore(storage).nativeFloor('projects').objects[1].rotation,45);
  e.loadFloor('customer');assert.deepEqual(e.history.current,defaultNativeRoom());
  e.loadFloor('projects');assert.equal(e.history.current.objects[1].x,-1);
});
test('configured popup works in play, keeps plain text, and persisted action can navigate',async t=>{
  const {editor:e,q,dom,visits,storage}=await setup(t);
  q('.ns-action').onchange({target:{value:'popup'}});
  q('.ns-title').value='<img src=x>';q('.ns-title').dispatchEvent(new dom.window.Event('input'));
  q('.ns-body').value='<script>bad()</script>';q('.ns-body').dispatchEvent(new dom.window.Event('input'));
  q('.ns-play').click();q('.ns-test').click();
  assert.equal(q('.native-popup').open,true);assert.equal(q('.native-popup h2').textContent,'<img src=x>');assert.equal(q('.native-popup script'),null);
  e.move('desk-0',{x:1});assert.equal(e.object().x,-3.25);
  q('.native-popup button').click();q('.ns-play').click();
  e.action({type:'floor',floor:'customer'});assert.equal(e.save(),true);
  e.loadFloor('projects');e.use(e.object());assert.deepEqual(visits,['customer']);
  assert.equal(new RoomStore(storage).nativeFloor('projects').objects[0].interaction.floor,'customer');
});
test('concurrent floor changes and denied storage do not overwrite or discard a native draft',async t=>{
  const {editor:e,storage}=await setup(t);
  e.move('desk-0',{x:0});
  new RoomStore(storage).apply('preview:projects',starterRoom());
  assert.equal(e.save(),false);assert.equal(e.history.dirty,true);
  assert.equal(new RoomStore(storage).edition('projects'),'hybrid');
  e.loadFloor('customer');e.move('desk-0',{x:2});
  e.storage={getItem:storage.getItem,setItem(){throw Error('quota');}};
  assert.equal(e.save(),false);assert.equal(e.object().x,2);
});
test('numeric input commits on input before selection or blur, and incomplete fields cannot be saved',async t=>{
  const {editor:e,q,dom,storage}=await setup(t);
  q('.ns-x').value='-2.25';q('.ns-x').dispatchEvent(new dom.window.Event('input'));
  q('.ns-rotation').value='30';q('.ns-rotation').dispatchEvent(new dom.window.Event('input'));
  q('[data-native-object="chair-0"]').click();
  assert.equal(e.history.current.objects[0].x,-2.25);assert.equal(e.history.current.objects[0].rotation,30);
  q('.ns-z').value='';q('.ns-z').dispatchEvent(new dom.window.Event('input'));assert.equal(e.save(),false);
  q('.ns-z').value='2';q('.ns-z').dispatchEvent(new dom.window.Event('input'));assert.equal(e.save(),true);
  const saved=new RoomStore(storage).nativeFloor('projects');assert.equal(saved.objects[0].x,-2.25);assert.equal(saved.objects[1].z,2);
});
test('native import reviews file then loads named floor without applying; hidden/late renderers suspend or dispose',async t=>{
  const {editor:e,q,storage}=await setup(t),room=defaultNativeRoom();room.objects[0].rotation=90;
  e.reviewFile(JSON.stringify(floorFile('customer',room)));
  assert.equal(q('.ns-file-review').open,true);assert.equal(e.floor,'projects');
  q('.ns-file-accept').click();assert.equal(e.floor,'customer');assert.equal(e.object().rotation,90);
  assert.equal(new RoomStore(storage).nativeFloor('customer'),null);
  e.setVisible(false);assert.equal(e.office.suspended,true);
  e.setVisible(true);assert.equal(e.office.suspended,false);
  let resolve;const pending=new Promise(r=>resolve=r),dom=new JSDOM('<main></main>');
  const late=new NativeStudio(dom.window.document.querySelector('main'),{storage:memory(),loadOffice:()=>pending});
  late.dispose();resolve({Office:FixtureOffice});await late.ready;assert.equal(late.office,undefined);dom.window.close();
});
