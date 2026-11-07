import {createLegacyTycoonRoom} from './fixtures/legacy-tycoon-room.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {captureFurnitureSet,placeFurnitureSet,FurnitureLibrary,validateFurnitureSet} from '../web/tycoon-prefabs.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {tycoonGround,tycoonWorld} from '../web/tycoon-blueprint.js';
import {deleteSelection} from '../web/tycoon-transform.js';
import {JSDOM} from 'jsdom';import {TycoonStudio} from '../web/tycoon-studio.js';
const preview='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=';
function sample(){const r=createLegacyTycoonRoom('projects');r.objects.find(o=>o.id==='desk-1').finish={material:'wood',color:'#cc8844',texture:{data:preview,repeatX:2,repeatY:1,offsetX:0,offsetY:0,rotation:15,opacity:.8}};r.navigation={version:1,routes:[],forbidden:[],stations:[{objectId:'desk-1',approach:tycoonGround({x:-2.8,z:-2.9}),seat:tycoonGround({x:-1.7,z:-2.9})}]};return r;}
test('prefab places repeated groups across floors retaining finishes, relative anchors and fresh IDs',()=>{
 const source=sample(),original=JSON.stringify(source),set=captureFurnitureSet(source,['desk-1','chair-1'],'Amber pair',preview),lobby=createTycoonRoom('lobby');
 const one=placeFurnitureSet(lobby,set,{x:1,z:1}),two=placeFurnitureSet(one.room,set,{x:-2,z:0});
 assert.equal(JSON.stringify(source),original);assert.equal(two.room.objects.length,lobby.objects.length+4);
 assert.equal(new Set(two.room.objects.map(o=>o.id)).size,lobby.objects.length+4);assert.notEqual(one.room.objects.at(-1).groupId,two.room.objects.at(-1).groupId);
 const desk=one.room.objects.find(o=>o.id===one.ids[0]),station=one.room.navigation.stations[0],seat=tycoonWorld(station.seat);
 assert.deepEqual(desk.finish,source.objects.find(o=>o.id==='desk-1').finish);assert.ok(Math.abs(seat.z-desk.z+1)<1e-8);assert.equal(station.objectId,desk.id);
 assert.equal(two.room.objects.some(o=>o.kind==='actor'||o.role),false);validateFurnitureSet(JSON.parse(JSON.stringify(set)));
});
test('deleting and placing the same prefab again never reuses its local object IDs',()=>{
 const set=captureFurnitureSet(sample(),['desk-1','chair-1'],'Pair',preview),first=placeFurnitureSet(createTycoonRoom('lobby'),set);
 assert.ok(first.ids.every(id=>/^(desk|chair)-set-[a-f0-9]{32}$/.test(id)));
 const deleted=deleteSelection(first.room,first.ids),second=placeFurnitureSet(deleted,set);
 assert.equal(second.ids.length,first.ids.length);assert.ok(second.ids.every(id=>!first.ids.includes(id)),'removed prefab IDs remain retired');
});
test('prefabs reject unsafe payloads and do not replace floor state',()=>{
 const set=captureFurnitureSet(sample(),['desk-1','chair-1'],'Pair',preview);
 for(const mutate of [s=>s.room.objects[0].role='admin',s=>s.room.objects[0].kind='actor',s=>s.preview='https://external/image',s=>s.room.navigation.routes.push({})]){const bad=structuredClone(set);mutate(bad);assert.throws(()=>validateFurnitureSet(bad));}
 assert.throws(()=>captureFurnitureSet(sample(),['lift','desk-1'],'Bad',preview));assert.throws(()=>placeFurnitureSet(createTycoonRoom('lobby'),set,{x:100,z:0}));
});
test('library reloads separate bounded entries and reports storage failure',()=>{
 const map=new Map(),storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const set=captureFurnitureSet(sample(),['desk-1','chair-1'],'Pair',preview),lib=new FurnitureLibrary(storage);lib.save(set);assert.equal(new FurnitureLibrary(storage).list().length,1);
 storage.setItem=()=>{throw Error('quota');};assert.throws(()=>lib.save({...set,name:'second'}));assert.equal(lib.list()[0].name,'Pair');
});
test('default resolved seats are captured rather than recalculated on the destination floor',()=>{
 const set=captureFurnitureSet(createTycoonRoom('projects'),['desk-1','chair-1'],'Default',preview);assert.ok(set.room.navigation.stations[0].seat);assert.ok(set.room.navigation.stations[0].approach);
});
test('library rejects a seat anchor outside the actual scaled chair footprint',()=>{
 const set=captureFurnitureSet(sample(),['desk-1','chair-1'],'Pair',preview),chair=set.room.objects.find(o=>o.kind==='chair');chair.scale=.25;
 set.room.navigation.stations[0].seat=tycoonGround({x:chair.x+.18,z:chair.z});
 assert.throws(()=>validateFurnitureSet(set),/จุดนั่ง|เก้าอี้/);
 const blocked=captureFurnitureSet(sample(),['desk-1','chair-1'],'Blocked',preview);blocked.room.navigation.stations[0].approach=tycoonGround(blocked.room.objects.find(o=>o.kind==='desk'));assert.throws(()=>validateFurnitureSet(blocked),/กีดขวาง/);
});
test('set cannot hide a prop across the approach-to-seat segment',()=>{
 const set=captureFurnitureSet(sample(),['desk-1','chair-1'],'Pair',preview),seat=tycoonWorld(set.room.navigation.stations[0].seat);
 set.room.objects.push({id:'blocker',kind:'plant',intent:'decor',x:seat.x-.55,y:0,z:seat.z,rotation:Math.PI/4,scale:.25,groupId:'group-set'});set.room.layers.push('blocker');
 assert.throws(()=>validateFurnitureSet(set),/ทางจากจุดเข้าถึง/);
});
test('Studio saves a preview card, inserts into another floor with Undo and rejects stale thumbnail',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
 let resolve;const Scene=class{setScene(){}dispose(){}furnitureThumbnail(){return new Promise(r=>resolve=r);}};
 const e=new TycoonStudio(document.querySelector('main'),{floor:'projects',storage:dom.window.localStorage,Scene});
 try{
  e.room=sample();e.saved=JSON.stringify(e.room);e.update();e.selectIds(['desk-1','chair-1']);e.prefabs.q('[data-prefab-name]').value='Pair';const save=e.prefabs.save();resolve(preview);assert.equal(await save,true);assert.equal(e.dirty,false);assert.equal(e.prefabs.q('[data-prefab-cards] img').src,preview);
  e.load('lobby');const before=JSON.stringify(e.room);e.prefabs.q('[data-prefab-cards] button').click();assert.equal(e.selection.length,2);assert.equal(e.room.objects.length,createTycoonRoom('lobby').objects.length+2);e.undo();assert.equal(JSON.stringify(e.room),before);e.redo();assert.equal((await e.save()).ok,true);e.load('projects');e.load('lobby');assert.equal(e.room.objects.length,createTycoonRoom('lobby').objects.length+2);
  e.load('projects');e.selectIds(['desk-1','chair-1']);const late=e.prefabs.save();e.load('lobby');resolve(preview);assert.equal(await late,false);assert.equal(e.prefabs.store.list().length,1);
 }finally{e.dispose();dom.window.close();}
});
