import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {JSDOM} from 'jsdom';
import {DesignStudio} from '../web/design-studio.js';
import {StudioHistory,defaults,normalizeStudioState,readStudioState,saveStudioState,STUDIO_STORAGE_KEY} from '../web/studio-state.js';
import {makeStudioDesk,makeStudioRoom,makeStudioPlant,makeStudioMannequin,disposeStudioObject,batchStudioScene,DESK_ANCHORS,STUDIO_LEVELS,STUDIO_SLOTS} from '../web/studio-models.js';
import {STUDIO_MODEL_METADATA} from '../web/office-assets.js';

test('sandbox sanitizes corrupt and foreign data without retaining business identity or rewards',()=>{
  const value=normalizeStudioState({version:1,room:'invented',desks:['signature',null,'__proto__'],wing:1,plant:99,mannequin:'true',businessId:'foreign',balance:999999});
  assert.deepEqual(value,{...defaults(),desks:['signature','starter','starter','starter']});
  assert.deepEqual(normalizeStudioState({version:2,room:'signature'}),defaults());
  assert.deepEqual(readStudioState({getItem(){return '{';}}),defaults());
  assert.deepEqual(readStudioState({getItem(){throw Error('denied');}}),defaults());
  const writes=[];assert.equal(saveStudioState({setItem:(...args)=>writes.push(args)},value),true);
  assert.equal(writes[0][0],STUDIO_STORAGE_KEY);assert.equal(JSON.parse(writes[0][1]).businessId,undefined);
  assert.equal(saveStudioState({setItem(){throw Error('quota');}},value),false);
});

test('preview, undo, cancel and commit keep the saved layout independent of drafts',()=>{
  const h=new StudioHistory(defaults());h.change({desks:['signature','starter','starter','starter']});h.change({wing:true});
  assert.equal(h.dirty,true);assert.equal(h.saved.wing,false);
  h.undo();assert.equal(h.current.wing,false);assert.equal(h.current.desks[0],'signature');
  h.cancel();assert.deepEqual(h.current,defaults());assert.equal(h.dirty,false);
  h.change({room:'studio'});h.commit();h.change({room:'signature'});h.cancel();
  assert.equal(h.current.room,'studio');assert.equal(h.past.length,0);
});

test('desk variants preserve seat anchors and bounds, with finite low-poly geometry',()=>{
  for(const tier of STUDIO_LEVELS){
    const desk=makeStudioDesk(tier);
    assert.deepEqual(desk.userData.anchors,DESK_ANCHORS);
    const bounds=new THREE.Box3().setFromObject(desk);
    assert.ok(bounds.min.x>=-1&&bounds.max.x<=1);
    assert.ok(bounds.min.z>=-.5&&bounds.max.z<=1.3);
    let triangles=0;
    desk.traverse(mesh=>{if(mesh.geometry){const p=mesh.geometry.attributes.position;assert.ok([...p.array].every(Number.isFinite));triangles+=p.count/3;}});
    assert.ok(triangles<1500);disposeStudioObject(desk);
  }
  const room=makeStudioRoom('starter'),expanded=makeStudioRoom('signature',true);
  assert.deepEqual(room.userData.anchors.door,expanded.userData.anchors.door);
  assert.ok(new THREE.Box3().setFromObject(expanded).max.x>new THREE.Box3().setFromObject(room).max.x);
  disposeStudioObject(room);disposeStudioObject(expanded);
});

test('model resource disposal releases each geometry and material once per owned model',()=>{
  const model=makeStudioDesk('signature'),watched=new Set(),counts=new Map();
  model.traverse(node=>{for(const resource of [node.geometry,node.material].filter(Boolean)){if(!watched.has(resource)){watched.add(resource);counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}}});
  disposeStudioObject(model);assert.ok([...counts.values()].every(count=>count===1));
});

test('scene batching preserves placed bounds while reducing mixed-tier draw objects',()=>{
  const source=new THREE.Group();source.add(makeStudioRoom('signature',true),makeStudioPlant(),makeStudioMannequin());
  STUDIO_SLOTS.forEach((position,i)=>{const desk=makeStudioDesk(STUDIO_LEVELS[i%3]);desk.position.fromArray(position);source.add(desk);});
  const before=new THREE.Box3().setFromObject(source),batch=batchStudioScene(source),after=new THREE.Box3().setFromObject(batch);
  assert.ok(before.min.distanceTo(after.min)<.00001);assert.ok(before.max.distanceTo(after.max)<.00001);
  // The art brief's whole-room trial budget is 100 calls, including selection.
  assert.ok(batch.children.length+1<=100);disposeStudioObject(batch);
});

test('exported GLBs round-trip through the real Three loader with asset metadata intact',async()=>{
  const manifest=JSON.parse(await readFile('web/assets/models/studio/manifest.json','utf8'));
  assert.equal(manifest.assets.length,Object.keys(STUDIO_MODEL_METADATA).length);
  assert.equal(manifest.revision,'office-models/v1');
  const loader=new GLTFLoader();
  for(const asset of manifest.assets){
    const bytes=await readFile(`web/assets/models/studio/${asset.file}`);
    assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.byteLength);
    const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const root=scene.children[0];assert.equal(root.userData.units,'metres');assert.equal(root.userData.assetVersion,asset.assetVersion);
    if(asset.anchors)assert.deepEqual(root.userData.anchors,asset.anchors);
    if(asset.footprint)assert.deepEqual(root.userData.footprint,asset.footprint);
    let meshes=0;scene.traverse(node=>{if(node.isMesh){meshes++;assert.ok(node.geometry.attributes.uv?.count>0)}});assert.ok(meshes>0);
    if(asset.file.startsWith('desk-'))assert.deepEqual(root.userData.anchors,DESK_ANCHORS);
    disposeStudioObject(scene);
  }
});

function setupUI(t,{failScene=false,failSave=false,initialFloor,selectModel=true}={}){
  const dom=new JSDOM('<main></main>',{url:'https://office.test',pretendToBeVisual:true});
  const oldWindow=globalThis.window;globalThis.window=dom.window;t.after(()=>{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;dom.window.close();});
  const calls={states:[],selections:[],disposals:0,writes:[]};
  class Scene{
    constructor(){if(failScene)throw Error('no WebGL');}
    setState(state){calls.states.push(structuredClone(state));}
    select(id){calls.selections.push(id);}
    dispose(){calls.disposals++;}
  }
  const storage={getItem(){return null;},setItem(key,value){if(failSave)throw Error('quota');calls.writes.push([key,value]);}};
  const root=dom.window.document.querySelector('main');
  const ui=new DesignStudio(root,{Scene,storage,initialFloor});if(selectModel)root.querySelector('[data-studio-mode="model"]').click();t.after(()=>ui.dispose());
  return {ui,root,calls,dom};
}
test('an unassigned office floor opens the Hybrid Design Studio on its shared default team scene',t=>{
  const {ui,root,calls}=setupUI(t,{initialFloor:'projects',selectModel:false});
  assert.equal(ui.mode,'hybrid');
  assert.equal(root.querySelector('.studio-hybrid-host').hidden,false);
  assert.equal(root.querySelector('.hy-current-scene').hidden,false);
  assert.match(root.querySelector('.hy-current-note').textContent,/Three\.js/);
  assert.equal(calls.writes.length,0);
});
test('UI changes one selected desk, requires Apply to persist and supports cancel and undo',t=>{
  const {root,calls,ui}=setupUI(t);
  root.querySelector('[data-slot="1"]').click();root.querySelector('[data-tier="signature"]').click();
  assert.deepEqual(calls.states.at(-1).desks,['starter','signature','starter','starter']);
  assert.equal(calls.writes.length,0);
  root.querySelector('.studio-undo').click();assert.equal(ui.history.dirty,false);
  root.querySelector('[data-tier="studio"]').click();root.querySelector('.studio-apply').click();
  assert.equal(calls.writes.length,1);assert.equal(ui.history.dirty,false);
  root.querySelector('[data-tier="signature"]').click();root.querySelector('.studio-cancel').click();
  assert.equal(ui.history.current.desks[1],'studio');
  ui.dispose();ui.dispose();assert.equal(calls.disposals,1);assert.equal(root.children.length,0);
});
test('unavailable WebGL keeps keyboard controls usable and failed storage never claims a save',t=>{
  const {root,ui}=setupUI(t,{failScene:true,failSave:true});
  assert.equal(root.querySelector('.studio-fallback').hidden,false);
  root.querySelector('[data-tier="signature"]').click();root.querySelector('.studio-apply').click();
  assert.equal(ui.history.dirty,true);assert.match(root.querySelector('.studio-feedback').textContent,/ยังไม่ได้บันทึก/);
});
