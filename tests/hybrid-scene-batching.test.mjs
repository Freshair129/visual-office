import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as THREE from 'three';
import {HybridOffice3D} from '../web/hybrid-office-3d.js';
import {HybridScene} from '../web/hybrid-scene.js';
import {domainFloors} from '../web/domain-office.js';
import {departmentStarterRoom,parseRoomJSON} from '../web/hybrid-state.js';
import {hybridPerformanceFixture} from '../scripts/perf-hybrid-fixture.mjs';
import {listHybridDrawCalls} from '../scripts/diagnose-hybrid-draw-calls.mjs';
import {hybridMaterialParameters} from '../web/hybrid-scene-batching.js';
import {defaultBlueprintPlan} from '../web/office-blueprint-state.js';

function fixture(count){
  const dom=new JSDOM('<div id="scene"><div class="hy-objects"></div></div>');
  const root=dom.window.document.querySelector('#scene');
  root.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});
  class Renderer{
    constructor(){this.domElement=dom.window.document.createElement('canvas');this.shadowMap={};}
    setClearColor(){} setPixelRatio(){} setSize(){} render(){} dispose(){}
  }
  const layer=new HybridOffice3D(root,{Renderer});
  layer.characters={create:id=>{const group=new THREE.Group();group.name=`headless-${id}`;return group;},dispose(){}};
  const room=hybridPerformanceFixture(count,{domainFloors,departmentStarterRoom,parseRoomJSON});
  layer.sync(room,true);
  return {dom,root,layer,room,close(){layer.dispose();dom.window.close();}};
}

test('measured Hybrid fixture keeps room draw calls under the batching ceiling',()=>{
  for(const count of [4,12]){
    const f=fixture(count);
    try{
      const calls=listHybridDrawCalls(f.layer.scene).filter(item=>!item.source.startsWith('object kind: avatar-')).reduce((sum,item)=>sum+item.calls,0);
      // 65 is the achieved source-level ceiling for both the 4- and 12-avatar fixtures.
      assert.ok(calls<=65,`${count} avatars: ${calls} source-level room draw calls`);
    }finally{f.close();}
  }
});

function visibleSceneStats(root){
  root.updateMatrixWorld(true);const bounds=new THREE.Box3();let triangles=0;
  const hasVisibleAncestors=node=>{for(let current=node;current;current=current.parent)if(!current.visible)return false;return true;};
  root.traverse(node=>{
    if(!node.isMesh&&!node.isLine&&!node.isPoints||!hasVisibleAncestors(node))return;
    const materials=Array.isArray(node.material)?node.material:[node.material];if(!materials.some(material=>material?.visible!==false))return;
    const geometry=node.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
    const baseTriangles=node.isMesh?(geometry.index?.count??geometry.attributes.position.count)/3:0;
    if(node.isInstancedMesh){
      const instance=new THREE.Matrix4(),matrix=new THREE.Matrix4(),box=new THREE.Box3();
      for(let index=0;index<node.count;index++){
        node.getMatrixAt(index,instance);matrix.multiplyMatrices(node.matrixWorld,instance);box.copy(geometry.boundingBox).applyMatrix4(matrix);bounds.union(box);
      }
      triangles+=baseTriangles*node.count;
    }else{
      bounds.union(geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));triangles+=baseTriangles;
    }
  });
  return {bounds,triangles};
}

function trackedResources(batcher){
  const resources=new Set(batcher.proxyMaterials.values()),geometries=new Set(),materials=new Set();
  batcher.group?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)materials.add(material);});
  for(const resource of [...geometries,...materials,...resources])resources.add(resource);
  const disposed=new Map();
  for(const resource of resources){const dispose=resource.dispose.bind(resource);resource.dispose=()=>{disposed.set(resource,(disposed.get(resource)||0)+1);dispose();};}
  return {resources,disposed};
}

test('batching preserves world bounds, triangle count and material parameters exactly',()=>{
  const f=fixture(4);try{
    f.layer.sceneBatches.clear();const before=visibleSceneStats(f.layer.scene);
    f.layer.sceneBatches.rebuild(f.layer.architecture,f.layer.models);const after=visibleSceneStats(f.layer.scene);
    assert.equal(after.triangles,before.triangles,'merged and instanced geometry must retain every triangle');
    for(const axis of ['x','y','z']){
      assert.ok(Math.abs(after.bounds.min[axis]-before.bounds.min[axis])<1e-5,`minimum ${axis} bound`);
      assert.ok(Math.abs(after.bounds.max[axis]-before.bounds.max[axis])<1e-5,`maximum ${axis} bound`);
    }
    const shared=new Map();let batches=0;
    f.layer.sceneBatches.group.traverse(node=>{
      if(!node.userData.hybridBatch)return;batches++;
      assert.deepEqual(hybridMaterialParameters(node.material),node.userData.hybridBatch.materialParameters,node.name);
      const key=JSON.stringify(hybridMaterialParameters(node.material));
      if(shared.has(key))assert.equal(node.material,shared.get(key),'equal materials should share one batch material');else shared.set(key,node.material);
    });
    assert.ok(batches>0);
  }finally{f.close();}
});

function projectedCenter(layer,root,object){
  layer.scene.updateMatrixWorld(true);const center=new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(layer.camera),rect=root.getBoundingClientRect();
  return {x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2};
}

test('instanced editable props retain picking, selection and live preview transforms',()=>{
  const f=fixture(4);try{
    const id='role-4-desk',model=f.layer.models.get(id),point=projectedCenter(f.layer,f.root,model);
    assert.equal(f.layer.pick(point.x,point.y),id,'the hidden per-object pick geometry remains raycastable');
    f.layer.highlightSkeleton(`object:${id}`);assert.ok(f.layer.selectionHelper?.visible);
    const record=f.layer.sceneBatches.objectInstances.get(id)?.[0],before=new THREE.Matrix4();assert.ok(record);
    record.instanced.getMatrixAt(record.index,before);
    const source=f.room.objects.find(object=>object.id===id),moved={...source,x:source.x+2,y:source.y+1};
    f.layer.previewMove(id,moved);
    const after=new THREE.Matrix4();record.instanced.getMatrixAt(record.index,after);
    assert.notDeepEqual(after.elements,before.elements,'the matching instance follows Studio preview movement');
    const movedPoint=projectedCenter(f.layer,f.root,model);assert.equal(f.layer.pick(movedPoint.x,movedPoint.y),id);
    f.layer.highlightSkeleton(null);
  }finally{f.close();}
});

test('instance visibility follows each source object and camera layer',()=>{
  const f=fixture(4);try{
    const id='role-4-desk',record=f.layer.sceneBatches.objectInstances.get(id)[0],matrix=new THREE.Matrix4();
    const instanceScale=()=>{record.instanced.getMatrixAt(record.index,matrix);return new THREE.Vector3().setFromMatrixScale(matrix).length();};
    assert.ok(instanceScale()>0);
    f.layer.models.get(id).visible=false;f.layer.draw();assert.equal(instanceScale(),0,'hidden source has a zero-scale instance');
    f.layer.models.get(id).visible=true;f.layer.draw();assert.ok(instanceScale()>0,'restoring source visibility restores its instance');
    f.layer.camera.layers.set(2);f.layer.draw();assert.equal(instanceScale(),0,'a source outside the active camera layer is skipped');
    f.layer.camera.layers.set(0);f.layer.draw();assert.ok(instanceScale()>0);
  }finally{f.close();}
});

test('replacement batches keep shadow casting without duplicate source shadow draws',()=>{
  const f=fixture(4);try{
    const batcher=f.layer.sceneBatches;
    const source=batcher.originals.find(entry=>entry.castShadow);
    assert.ok(source,'the fixture contains source meshes that cast shadows');
    assert.equal(source.mesh.castShadow,false,'hidden pick geometry does not submit a duplicate shadow draw');
    assert.ok([...batcher.group.children].some(node=>node.userData.hybridBatch&&node.castShadow),
      'the visible replacement batch keeps the original shadow contribution');
    batcher.clear();assert.equal(source.mesh.castShadow,source.castShadow,'rebuild first restores the source shadow flag');
    batcher.rebuild(f.layer.architecture,f.layer.models);assert.equal(source.mesh.castShadow,false);
    batcher.dispose();assert.equal(source.mesh.castShadow,source.castShadow,'dispose restores the source shadow flag');
  }finally{f.close();}
});

test('per-object material effects stay separate from opaque shared instances',()=>{
  const f=fixture(4);try{
    const id='role-1-desk',room={...f.room,objects:f.room.objects.map(object=>object.id===id?{...object,effects:{opacity:.75,shadow:0,glow:true,hover:'none'}}:object)};
    f.layer.sync(room,true);
    const model=f.layer.models.get(id),material=model.children.find(node=>node.isMesh).material;
    assert.equal(material.visible,true,'effect-bearing source remains its own render mesh');
    assert.equal(material.opacity,.75);assert.ok(material.emissive.getHex()>0);
    assert.equal(f.layer.sceneBatches.objectInstances.has(id),false);
    assert.equal(f.layer.sceneBatches.objectInstances.has('role-2-desk'),true,'unchanged desks continue sharing instances');
  }finally{f.close();}
});

test('batched furniture still opens its existing object action menu',()=>{
  const dom=new JSDOM('<main id="scene"></main>'),root=dom.window.document.querySelector('#scene');
  root.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const scene=new HybridScene(root);let layer;
  class Renderer{
    constructor(){this.domElement=dom.window.document.createElement('canvas');this.shadowMap={};}
    setClearColor(){} setPixelRatio(){} setSize(){} render(){} dispose(){}
  }
  try{
    layer=new HybridOffice3D(root,{Renderer});layer.characters={create:id=>{const group=new THREE.Group();group.name=`headless-${id}`;return group;},dispose(){}};
    scene.modelLayer=layer;const room=hybridPerformanceFixture(4,{domainFloors,departmentStarterRoom,parseRoomJSON});scene.render(room,null,true);
    root.querySelector('[data-object="role-4-desk"]').click();
    const menu=root.querySelector('.hy-interaction-popup [data-use-station]');
    assert.ok(menu,'the desk menu remains available for an instanced desk');assert.equal(menu.disabled,false);
  }finally{scene.dispose();dom.window.close();}
});

function pointerEvent(dom,type,{x,y,pointerId=1}={}){
  const event=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y,detail:1});
  Object.defineProperty(event,'pointerId',{value:pointerId});return event;
}

function interactiveBatchFixture({editable=false,onSelect=()=>{},onMove=()=>{},onDoorToggle,roomFactory}={}){
  const dom=new JSDOM('<main id="scene"></main>'),root=dom.window.document.querySelector('#scene');
  root.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const scene=new HybridScene(root,{editable,onSelect,onMove,onDoorToggle,getObjectWorkspace:object=>object.kind==='work-desk'?{
    heading:'Lin · Sales Coordinator',note:'workspace context',actions:[
      {label:'ดูงานของชั้นนี้',run(){}},{label:'ดูรายละเอียดบทบาท',run(){}}
    ]
  }:null});
  class Renderer{
    constructor(){this.domElement=dom.window.document.createElement('canvas');this.shadowMap={};}
    setClearColor(){} setPixelRatio(){} setSize(){} render(){} dispose(){}
  }
  const layer=new HybridOffice3D(root,{Renderer});
  layer.characters={create:id=>{const group=new THREE.Group();group.name=`headless-${id}`;return group;},dispose(){}};
  scene.modelLayer=layer;const base=hybridPerformanceFixture(4,{domainFloors,departmentStarterRoom,parseRoomJSON}),room=roomFactory?roomFactory(base):base;scene.render(room,null,!editable);
  const objectId='role-4-desk',model=layer.models.get(objectId),point=projectedCenter(layer,root,model),canvas=layer.renderer.domElement;
  return {dom,root,scene,layer,room,objectId,model,point,canvas,close(){scene.dispose();dom.window.close();}};
}

test('canvas pointer sequence resolves a batched desk through HybridScene and opens its action menu',()=>{
  const f=interactiveBatchFixture();try{
    assert.equal(f.layer.pick(f.point.x,f.point.y),f.objectId,'the projected canvas point is over the desk');
    f.canvas.dispatchEvent(pointerEvent(f.dom,'pointerdown',{...f.point,pointerId:17}));
    f.canvas.dispatchEvent(pointerEvent(f.dom,'pointerup',{...f.point,pointerId:17}));
    assert.match(f.scene.popup?.querySelector('h2')?.textContent,/^โต๊ะทำงาน/);
    assert.ok(f.scene.popup?.querySelector('[data-use-station]'));
    assert.equal(f.scene.popup?.querySelector('.hy-workspace-actions h3')?.textContent,'Lin · Sales Coordinator');
    assert.deepEqual([...f.scene.popup.querySelectorAll('[data-workspace-action]')].map(button=>button.textContent),['ดูงานของชั้นนี้','ดูรายละเอียดบทบาท']);
  }finally{f.close();}
});

test('canvas hover resolves the batched object and clears its hover state on leave',()=>{
  const f=interactiveBatchFixture({roomFactory:base=>({...base,objects:base.objects.map(object=>object.id==='role-4-desk'?{...object,effects:{...object.effects,hover:'highlight'}}:object)})});try{
    f.canvas.dispatchEvent(pointerEvent(f.dom,'pointermove',f.point));
    const button=f.root.querySelector(`[data-object="${f.objectId}"]`);
    assert.equal(button.dataset.pointerHover,'true');assert.ok(['lift','highlight'].includes(button.dataset.hover));
    f.canvas.dispatchEvent(pointerEvent(f.dom,'pointerleave',f.point));
    assert.equal(button.hasAttribute('data-pointer-hover'),false);
  }finally{f.close();}
});

test('object-button browser pointer sequence raycasts the batched desk through HybridScene',()=>{
  const f=interactiveBatchFixture();try{
    const button=f.root.querySelector(`[data-object="${f.objectId}"]`);
    for(const type of ['pointerdown','pointerup'])button.dispatchEvent(pointerEvent(f.dom,type,{...f.point,pointerId:19}));
    button.dispatchEvent(pointerEvent(f.dom,'click',f.point));
    assert.match(f.scene.popup?.querySelector('h2')?.textContent,/^โต๊ะทำงาน/);
    assert.ok(f.scene.popup?.querySelector('[data-use-station]'));
  }finally{f.close();}
});

test('canvas pointer sequence toggles a door while room props use draw-call batches',()=>{
  const calls=[],plan={...defaultBlueprintPlan('medium'),partitions:[{id:'split',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4,open:false}}]};
  const f=interactiveBatchFixture({onDoorToggle:id=>{calls.push(id);return {ok:true,message:'changed'};},roomFactory:base=>({...base,blueprint:'medium',blueprintPlan:plan})});try{
    const door=f.layer.architecture.userData.officeArchitecture.doors.find(item=>item.id==='partition:split'),point=new THREE.Vector3(.2,.6,0);
    door.group.localToWorld(point);point.project(f.layer.camera);const client={x:(point.x+1)*500,y:(1-point.y)*350};
    f.canvas.dispatchEvent(pointerEvent(f.dom,'pointerdown',{...client,pointerId:21}));
    f.canvas.dispatchEvent(pointerEvent(f.dom,'pointerup',{...client,pointerId:21}));
    f.canvas.dispatchEvent(pointerEvent(f.dom,'click',client));
    assert.deepEqual(calls,['partition:split']);assert.match(f.root.querySelector('.hy-door-status').textContent,/changed/);
    assert.ok(f.layer.sceneBatches.objectInstances.size>0,'desk/chair batches remain active beside the unbatched door');
  }finally{f.close();}
});

test('canvas pointer drag selects and previews a batched desk in Hybrid Studio',()=>{
  let selected=null,moved=null;const f=interactiveBatchFixture({editable:true,onSelect:id=>{selected=id;},onMove:(id,next)=>{moved={id,next};}});try{
    const record=f.layer.sceneBatches.objectInstances.get(f.objectId)[0],before=new THREE.Matrix4(),after=new THREE.Matrix4();
    record.instanced.getMatrixAt(record.index,before);
    f.canvas.dispatchEvent(pointerEvent(f.dom,'pointerdown',{...f.point,pointerId:23}));
    f.canvas.dispatchEvent(pointerEvent(f.dom,'pointermove',{x:f.point.x+20,y:f.point.y+10,pointerId:23}));
    record.instanced.getMatrixAt(record.index,after);
    assert.equal(selected,f.objectId,'pointerdown selects the mesh-resolved object');
    assert.notDeepEqual(after.elements,before.elements,'pointermove updates the instance preview');
    f.canvas.dispatchEvent(pointerEvent(f.dom,'pointerup',{x:f.point.x+20,y:f.point.y+10,pointerId:23}));
    assert.equal(moved?.id,f.objectId,'pointerup commits the preview through the Studio callback');
  }finally{f.close();}
});

test('batch geometries and proxy materials dispose once on rebuild and final teardown',()=>{
  const f=fixture(4);try{
    const first=trackedResources(f.layer.sceneBatches);
    const room={...f.room,objects:f.room.objects.map(object=>object.id==='role-4-desk'?{...object,x:object.x+1}:object)};
    f.layer.sync(room,true);
    assert.deepEqual([...first.resources].map(resource=>first.disposed.get(resource)).sort(),Array(first.resources.size).fill(1));
    const second=trackedResources(f.layer.sceneBatches);f.layer.dispose();
    assert.deepEqual([...second.resources].map(resource=>second.disposed.get(resource)).sort(),Array(second.resources.size).fill(1));
  }finally{f.dom.window.close();}
});
