import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {inspectCustomGLB,describeCustomAsset,validateCustomAsset,normalizeCustomModel} from '../web/custom-assets.js';
import {createTycoonRoom,validateTycoonRoom} from '../web/tycoon-state.js';
import {tycoonFootprint,createTycoonNavigation,tycoonGround,tycoonWorld} from '../web/tycoon-blueprint.js';
import {captureFurnitureSet,placeFurnitureSet} from '../web/tycoon-prefabs.js';
import {exportFurnitureBundle,importFurnitureBundle} from '../web/tycoon-prefab-files.js';
import {transformSelection,duplicateSelection} from '../web/tycoon-transform.js';
import {JSDOM} from 'jsdom';
import {TycoonStudio} from '../web/tycoon-studio.js';
import {customModels,disposeCustomModel} from '../web/custom-assets.js';
import {inspectGLBContainer} from '../web/custom-assets.js';
import {TycoonScene} from '../web/tycoon-scene.js';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=';
const bytes=new Uint8Array(await fs.readFile('web/assets/models/tycoon/chair.glb'));
test('undeclared GPU instancing extensions cannot bypass resource budgets',()=>{
 const source=Buffer.from(bytes),n=source.readUInt32LE(12),json=JSON.parse(source.subarray(20,20+n)),bin=source.subarray(28+n);
 delete json.extensionsUsed;delete json.extensionsRequired;
 json.nodes[0].extensions={EXT_mesh_gpu_instancing:{attributes:{TRANSLATION:0}}};
 let text=JSON.stringify(json);while(Buffer.byteLength(text)%4)text+=' ';
 const h=Buffer.alloc(20),b=Buffer.alloc(8);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+Buffer.byteLength(text)+bin.length,8);h.writeUInt32LE(Buffer.byteLength(text),12);h.writeUInt32LE(0x4e4f534a,16);b.writeUInt32LE(bin.length,0);b.writeUInt32LE(0x004e4942,4);
 assert.throws(()=>inspectGLBContainer(Buffer.concat([h,Buffer.from(text),b,bin])),/extension/);
});
test('custom GLB measures and normalizes a grounded prop with independent metadata',async()=>{
 const inspected=await inspectCustomGLB(bytes),asset=describeCustomAsset(inspected,{name:'My chair',category:'chair',height:1.2,interaction:{mode:'seat',approach:[0,1.8],seat:[0,0],height:.5,heading:0}});
 assert.equal(asset.name,'My chair');assert.equal(asset.size[1],1.2);assert.deepEqual(validateCustomAsset(asset),asset);
 const model=normalizeCustomModel(inspected.model,asset),box=new THREE.Box3().setFromObject(model);
 assert.ok(Math.abs(box.min.y)<1e-6);assert.ok(Math.abs(box.max.y-1.2)<1e-6);assert.ok(box.getCenter(new THREE.Vector3()).x<1e-6);
 assert.throws(()=>validateCustomAsset({...asset,role:'manager'}));
 const room={...createTycoonRoom('lobby'),objects:[{id:'custom-1',kind:'custom',asset,x:0,y:0,z:0,rotation:0,scale:1,intent:'decor'}]};
 validateTycoonRoom(room);const footprint=tycoonFootprint(room.objects[0]);assert.equal(footprint.length,4);
 const nav=createTycoonNavigation(room);assert.equal(nav.stations.length,1);assert.equal(nav.stations[0].seatHeight,.5);assert.equal(nav.isWalkable(tycoonGround({x:0,z:0})),false);
 const set=captureFurnitureSet(room,['custom-1'],'Custom set',png),placed=placeFurnitureSet(createTycoonRoom('projects'),set,{x:3,z:0});
 assert.equal(placed.room.objects.at(-1).asset.id,asset.id);assert.equal(placed.room.objects.at(-1).groupId,undefined);
 const blobs=new Map([[asset.id,bytes]]),models={get:async id=>blobs.get(id),putMany:async list=>{for(const item of list)blobs.set(item.id,item.bytes);}};
 const file=await exportFurnitureBundle(set,{models});assert.equal(JSON.parse(file).schemaVersion,'office-furniture-bundle/v2');
 const restored=await importFurnitureBundle(file,{models});assert.deepEqual(restored,set);
 const bad=JSON.parse(file);bad.models[0].data=bad.models[0].data.slice(0,-5)+'AAAA=';await assert.rejects(importFurnitureBundle(JSON.stringify(bad),{models}));
});
test('custom inspection rejects malformed and external resources before parsing',async()=>{
 await assert.rejects(inspectCustomGLB(new Uint8Array(13)));
 const json={asset:{version:'2.0'},buffers:[{byteLength:1,uri:'https://example.test/x'}]};let text=JSON.stringify(json);while(text.length%4)text+=' ';const data=new Uint8Array(20+text.length),view=new DataView(data.buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,data.length,true);view.setUint32(12,text.length,true);view.setUint32(16,0x4e4f534a,true);data.set(new TextEncoder().encode(text),20);
 await assert.rejects(inspectCustomGLB(data),/embedded|ภายนอก/);
});
test('mixed desk/custom chair preserves station transforms and verifies every binary before storage',async()=>{
 const info=await inspectCustomGLB(bytes),asset=describeCustomAsset(info,{name:'Custom chair',category:'chair',height:1.15,interaction:{mode:'seat',approach:[0,1.5],seat:[0,0],height:.6,heading:Math.PI}});
 // Use the real work bay; the former (0,0) fixture now lies in the service core.
 const base=createTycoonRoom('projects'),room={...base,objects:[{...base.objects.find(o=>o.id==='desk-1'),id:'desk-a'},{...base.objects.find(o=>o.id==='chair-1'),id:'custom-a',kind:'custom',asset}]};
 const facing=layout=>{const chair=layout.objects.find(o=>o.asset),station=createTycoonNavigation(layout).stations.find(s=>s.type==='desk');assert.ok(station,'paired desk remains reachable');const from=tycoonWorld(station.seat),to=tycoonWorld(station.footAnchor),heading=chair.rotation+chair.asset.interaction.heading;assert.ok((to.x-from.x)*Math.sin(heading)+(to.z-from.z)*Math.cos(heading)>0,'seat heading, not a rear approach, sets the foot direction');};
 facing(room);
 const turned=structuredClone(room),pivot=room.objects[1];for(const object of turned.objects){const dx=object.x-pivot.x,dz=object.z-pivot.z;object.x=pivot.x+dz;object.z=pivot.z-dx;object.rotation+=Math.PI/2;}facing(turned);
 const set=captureFurnitureSet(room,['desk-a','custom-a'],'Mixed',png);assert.equal(set.room.navigation.stations.length,2);
 const placed=placeFurnitureSet(createTycoonRoom('lobby'),set,{x:1,z:0}),moved=transformSelection(placed.room,placed.ids,{angle:Math.PI/2,dx:1,factor:1.1}),duplicate=duplicateSelection(moved,placed.ids);
 assert.notDeepEqual(moved.navigation.stations[0].seat,placed.room.navigation.stations[0].seat);assert.equal(duplicate.ids.length,2);assert.equal(duplicate.room.objects.filter(o=>o.asset).length,2);
 const catalog=JSON.parse(await fs.readFile('web/assets/models/tycoon/manifest.json','utf8')),models={get:async()=>bytes,putMany:async()=>{writes++;}},load=async kind=>new Uint8Array(await fs.readFile('web/assets/models/tycoon/'+kind+'.glb'));let writes=0;
 const file=await exportFurnitureBundle(set,{catalog,models,load}),bad=JSON.parse(file);bad.models[1].sha256='0'.repeat(64);
 await assert.rejects(importFurnitureBundle(JSON.stringify(bad),{catalog,models}));assert.equal(writes,0);
 const fresh=await importFurnitureBundle(file,{catalog,models});assert.deepEqual(fresh,set);assert.equal(writes,1);
 const obstructed=structuredClone(set);obstructed.room.navigation.stations.find(s=>s.objectId==='custom-a').approach=obstructed.room.navigation.stations.find(s=>s.objectId==='custom-a').seat;
 assert.throws(()=>placeFurnitureSet(createTycoonRoom('lobby'),obstructed));
});
test('custom import UI saves a card without changing floor, handles storage failure and discards stale preview',async()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'}),previous=globalThis.document,put=customModels.putMany;globalThis.document=dom.window.document;
 let pending;const Scene=class{setScene(){}dispose(){}async furnitureThumbnail(){return pending?new Promise(r=>pending=r):png;}};
 const editor=new TycoonStudio(document.querySelector('main'),{storage:dom.window.localStorage,Scene}),panel=editor.prefabs.custom,before=JSON.stringify(editor.room);
 try{
  await panel.read({name:'Chair.glb',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
  panel.q('[data-custom-category]').value='chair';panel.q('[data-custom-mode]').value='seat';
  customModels.putMany=async()=>{throw Error('storage full');};assert.equal(await panel.save(),false);assert.equal(editor.prefabs.store.list().length,0);
  customModels.putMany=async()=>{};assert.equal(await panel.save(),true);assert.equal(editor.prefabs.store.list().length,1);assert.equal(JSON.stringify(editor.room),before);
  pending=true;const late=panel.preview();panel.generation++;pending(png);assert.equal(await late,false);
  const set=editor.prefabs.store.list()[0];assert.equal(set.room.objects[0].asset.category,'chair');
 }finally{editor.dispose();customModels.putMany=put;globalThis.document=previous;dom.window.close();}
});
test('bounded GLBs reject excessive primitives even below triangle budget',()=>{
 const source=Buffer.from(bytes),n=source.readUInt32LE(12),json=JSON.parse(source.subarray(20,20+n)),bin=source.subarray(28+n),primitive=json.meshes[0].primitives[0];json.accessors[primitive.indices].count=3;json.meshes[0].primitives=Array.from({length:4097},()=>primitive);json.nodes=[{mesh:0}];json.scenes=[{nodes:[0]}];
 let text=JSON.stringify(json);while(Buffer.byteLength(text)%4)text+=' ';const h=Buffer.alloc(20),b=Buffer.alloc(8);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+Buffer.byteLength(text)+bin.length,8);h.writeUInt32LE(Buffer.byteLength(text),12);h.writeUInt32LE(0x4e4f534a,16);b.writeUInt32LE(bin.length,0);b.writeUInt32LE(0x004e4942,4);
 assert.throws(()=>inspectGLBContainer(Buffer.concat([h,Buffer.from(text),b,bin])),/primitive/);
});
test('custom loader shares one parse across named instances and normalizes separately',async()=>{
 const info=await inspectCustomGLB(bytes),asset=describeCustomAsset(info,{name:'A',category:'decoration',height:1}),other={...asset,name:'B',size:asset.size.map(n=>n*2)},get=customModels.get,scene={cache:new Map()};let reads=0;
 customModels.get=async()=>{reads++;return bytes;};try{const [a,b]=await Promise.all([TycoonScene.prototype.loadAsset.call(scene,'custom',asset),TycoonScene.prototype.loadAsset.call(scene,'custom',other)]);assert.equal(reads,1);assert.ok(Math.abs(new THREE.Box3().setFromObject(a).max.y-1)<1e-6);assert.ok(Math.abs(new THREE.Box3().setFromObject(b).max.y-2)<1e-6);}finally{customModels.get=get;for(const pending of scene.cache.values())disposeCustomModel(await pending);disposeCustomModel(info.model);}
});
test('oversize portable export rejects before parsing or base64 encoding model payloads',async()=>{
 const info=await inspectCustomGLB(bytes),asset=describeCustomAsset(info,{name:'Budget',category:'decoration',height:1}),large=new Uint8Array(16000000),old=globalThis.btoa;let encodes=0;
 const objects=['a','b','c','d'].map((c,i)=>({id:'custom-'+c,kind:'custom',asset:{...asset,id:c.repeat(64)},x:i,y:0,z:0,rotation:0,scale:1,intent:'decor'}));
 const set={schemaVersion:'office-furniture-set/v2',name:'Budget',preview:png,room:{schemaVersion:'office-tycoon/v1',width:24,depth:20,objects,layers:objects.map(o=>o.id),navigation:{version:1,routes:[],forbidden:[],stations:[]}}};
 globalThis.btoa=(...args)=>{encodes++;return old(...args);};try{await assert.rejects(exportFurnitureBundle(set,{models:{get:async()=>large}}),/64 MB/);assert.equal(encodes,0);}finally{globalThis.btoa=old;disposeCustomModel(info.model);}
});
