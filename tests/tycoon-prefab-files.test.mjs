import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {exportFurnitureBundle,importFurnitureBundle} from '../web/tycoon-prefab-files.js';
import {captureFurnitureSet,FurnitureLibrary,placeFurnitureSet} from '../web/tycoon-prefabs.js';import {createTycoonRoom} from '../web/tycoon-state.js';
import {JSDOM} from 'jsdom';import {TycoonStudio} from '../web/tycoon-studio.js';
const catalog=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8'));
const load=async kind=>{const a=catalog.assets.find(a=>a.kind===kind);return new Uint8Array(await readFile('web/assets/models/tycoon/'+a.file));};
const preview='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=';
function fixture(){const room=createTycoonRoom('projects');room.objects.find(o=>o.id==='desk-1').finish={color:'#bb8844',material:'wood',texture:{data:preview,repeatX:2,repeatY:1,offsetX:0,offsetY:0,rotation:30,opacity:1}};return captureFurnitureSet(room,['desk-1','chair-1'],'Portable pair',preview);}
test('portable bundle embeds exact GLBs and all visual/seat data, importing into fresh storage',async()=>{
 const set=fixture(),text=await exportFurnitureBundle(set,{catalog,load}),bundle=JSON.parse(text);assert.equal(bundle.models.length,2);assert.ok(bundle.models.every(m=>m.data.startsWith('data:model/gltf-binary;base64,')));
 const imported=await importFurnitureBundle(text,{catalog});assert.deepEqual(imported,set);
 const map=new Map(),storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};new FurnitureLibrary(storage).save(imported);const {id,...rest}=new FurnitureLibrary(storage).list()[0];assert.deepEqual(rest,set);
 assert.equal(placeFurnitureSet(createTycoonRoom('lobby'),rest).room.objects.length,createTycoonRoom('lobby').objects.length+2);assert.equal(await exportFurnitureBundle(rest,{catalog,load}),text);
});
test('portable import rejects missing, duplicate, changed and incompatible GLBs and unknown metadata',async()=>{
 const text=await exportFurnitureBundle(fixture(),{catalog,load});
 for(const mutate of [b=>b.models.pop(),b=>b.models.push(b.models[0]),b=>b.models[0].sha256='0'.repeat(64),b=>b.models[0].data=b.models[0].data.slice(0,-8)+'AAAAAAAA',b=>b.set.room.objects[0].role='admin',b=>b.models[0].url='https://external/glb',b=>b.schemaVersion='future']){const b=JSON.parse(text);mutate(b);await assert.rejects(()=>importFurnitureBundle(JSON.stringify(b),{catalog}));}
 await assert.rejects(()=>importFurnitureBundle(text,{catalog:{assets:[]}}),/เวอร์ชัน|รองรับ/);
 const changed=structuredClone(catalog);changed.revision='tycoon-kit/2';await assert.rejects(()=>importFurnitureBundle(text,{catalog:changed}),/เวอร์ชัน|kit/);
 const geometry=structuredClone(catalog);geometry.assets.find(a=>a.kind==='desk').footprint[0]+=1;await assert.rejects(()=>importFurnitureBundle(text,{catalog:geometry}),/เวอร์ชัน|kit/);
 await assert.rejects(()=>importFurnitureBundle(' '.repeat(64000001),{catalog}),/64 MB/);
});
test('UI import appends only valid entries and never edits a floor; disposed imports are discarded',async t=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'}),previousDocument=globalThis.document,previousFetch=globalThis.fetch;globalThis.document=dom.window.document;globalThis.fetch=async()=>({ok:true,json:async()=>catalog});
 const e=new TycoonStudio(document.querySelector('main'),{storage:dom.window.localStorage,Scene:class{setScene(){}dispose(){}}});t.after(()=>{e.dispose();dom.window.close();globalThis.document=previousDocument;globalThis.fetch=previousFetch;});
 const text=await exportFurnitureBundle(fixture(),{catalog,load}),before=JSON.stringify(e.room),file={size:text.length,text:async()=>text};
 assert.equal(await e.prefabs.importFile(file),true);assert.equal(e.prefabs.store.list().length,1);assert.equal(JSON.stringify(e.room),before);assert.equal(e.dirty,false);
 assert.equal(await e.prefabs.importFile({size:1,text:async()=>'{}'}),false);assert.equal(e.prefabs.store.list().length,1);
 let finish;const pending=e.prefabs.importFile({size:1,text:()=>new Promise(r=>finish=r)});e.dispose();finish(text);assert.equal(await pending,false);assert.equal(e.prefabs.store.list().length,1);
});
