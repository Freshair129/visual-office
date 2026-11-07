import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {TycoonAssembly,TycoonScene} from '../web/tycoon-scene.js';
import {tycoonSceneObjects} from '../web/tycoon-scene.js';import {createTycoonRoom} from '../web/tycoon-state.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';

test('skinned actor instances own bones and release shared-per-instance skeletons once',async()=>{
 const source=new THREE.Group(),hip=new THREE.Bone(),joint=new THREE.Bone();hip.name='test-hip';joint.name='test-joint';joint.position.y=.4;hip.add(joint);source.add(hip);
 const skeleton=new THREE.Skeleton([hip,joint]),geometry=new THREE.BoxGeometry(.2,.6,.2),count=geometry.attributes.position.count;
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(Array.from({length:count},()=>[1,0,0,0]).flat(),4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(Array.from({length:count},()=>[1,0,0,0]).flat(),4));
 source.updateMatrixWorld(true);
 for(const name of ['skin-a','skin-b']){const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());mesh.name=name;source.add(mesh);mesh.bind(skeleton);}
 const stage=new THREE.Group(),assembly=new TycoonAssembly(stage,async()=>source);await assembly.replace([{id:'a',kind:'actor'},{id:'b',kind:'actor'}]);
 const [a,b]=stage.children,skinA=a.getObjectByName('skin-a'),skinB=b.getObjectByName('skin-a');
 assert.notEqual(skinA.skeleton,skeleton);assert.notEqual(skinA.skeleton,skinB.skeleton);
 assert.equal(skinA.skeleton.bones[1],a.getObjectByName('test-joint'));
 assert.equal(a.getObjectByName('skin-b').skeleton.bones[1],a.getObjectByName('test-joint'));
 a.updateMatrixWorld(true);b.updateMatrixWorld(true);const beforeB=skinB.getVertexPosition(0,new THREE.Vector3());
 a.getObjectByName('test-joint').rotation.z=.7;a.updateMatrixWorld(true);skinA.skeleton.update();
 assert.ok(skinA.getVertexPosition(0,new THREE.Vector3()).distanceTo(beforeB)>.05);
 assert.ok(skinB.getVertexPosition(0,new THREE.Vector3()).distanceTo(beforeB)<1e-9);
 const owned=new Set();for(const model of [a,b])model.traverse(n=>{if(n.skeleton)owned.add(n.skeleton);});let released=0;for(const skeleton of owned){skeleton.computeBoneTexture();skeleton.boneTexture.addEventListener('dispose',()=>released++);}
 assembly.dispose();assembly.dispose();assert.equal(released,owned.size);assert.equal(geometry.attributes.position.count,count);
 source.traverse(n=>{if(n.material)n.material.dispose();});geometry.dispose();skeleton.dispose();
});

test('scene cache teardown disposes each loaded skin skeleton once before renderer',async()=>{
 const source=new THREE.Group(),skeleton=new THREE.Skeleton([new THREE.Bone()]);skeleton.computeBoneTexture();let released=0,rendererDisposed=false;
 skeleton.boneTexture.addEventListener('dispose',()=>{assert.equal(rendererDisposed,false);released++;});
 for(let i=0;i<2;i++){const mesh=new THREE.SkinnedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());mesh.skeleton=skeleton;source.add(mesh);}
 const fake={assembly:{dispose(){}},resizeObserver:{disconnect(){}},renderer:{domElement:{removeEventListener(){},remove(){}},setAnimationLoop(){},dispose(){rendererDisposed=true;}},cache:new Map([['actor',Promise.resolve(source)]])};
 TycoonScene.prototype.dispose.call(fake);await fake.disposal;assert.equal(released,1);assert.equal(rendererDisposed,true);
});
test('scene disposal releases each shared source texture once',async()=>{
 const texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture,roughnessMap:texture}),model=new THREE.Group();model.add(new THREE.Mesh(new THREE.BoxGeometry(),material));let disposed=0;let rendererDisposed=false;texture.addEventListener('dispose',()=>{assert.equal(rendererDisposed,false);disposed++;});
 const fake={assembly:{dispose(){}},resizeObserver:{disconnect(){}},renderer:{domElement:{removeEventListener(){},remove(){}},setAnimationLoop(){},dispose(){rendererDisposed=true;}},cache:new Map([['desk',Promise.resolve(model)]])};
 TycoonScene.prototype.dispose.call(fake);await fake.disposal;assert.equal(disposed,1);assert.equal(rendererDisposed,true);
});
test('GLB finish and layer overrides own resources and retain depth occlusion',async()=>{
 const source=new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:'#ffffff'})));
 const stage=new THREE.Group(),assembly=new TycoonAssembly(stage,async()=>source);await assembly.replace([{id:'a',kind:'desk',renderOrder:9,finish:{material:'wood',color:'#cc8844'}},{id:'b',kind:'desk'}]);
 const a=stage.children[0].children[0],b=stage.children[1].children[0];assert.ok(a.material.map);assert.equal(b.material.map,null);assert.equal(a.renderOrder,9);assert.equal(a.material.depthTest,true);assert.equal(source.children[0].material.map,null);
 let disposed=0;a.material.map.addEventListener('dispose',()=>disposed++);assembly.dispose();assert.equal(disposed,1);assert.equal(source.children[0].material.color.getHexString(),'ffffff');
 const room=createTycoonRoom('projects');room.layers=room.objects.map(o=>o.id).reverse();room.finishes={floor:{material:'stone'},walls:{material:'matte'}};const objects=tycoonSceneObjects('projects',room);
 assert.equal(objects.find(o=>o.id==='floor').finish.material,'stone');assert.ok(objects.filter(o=>o.kind==='wall').every(o=>o.finish.material==='matte'));
 assert.ok(objects.find(o=>o.id===room.layers[0]).renderOrder>objects.find(o=>o.id===room.layers.at(-1)).renderOrder);
});
test('obsolete GLB loads never attach to a replaced or disposed scene',async()=>{
  let resolve;const loader=()=>new Promise(r=>resolve=r),scene=new THREE.Group(),assembly=new TycoonAssembly(scene,loader);
  const pending=assembly.replace([{id:'old',kind:'desk',x:0,z:0}]);assembly.dispose();resolve(new THREE.Group());await pending;assert.equal(scene.children.length,0);
});
test('an obsolete scene rejection cannot publish an error to the new floor',async()=>{
 const pending=[],errors=[];const fake={reset(){},assembly:{owned:[],replace:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))},onError:m=>errors.push(m)};
 const first=TycoonScene.prototype.setScene.call(fake,'lobby',{width:12,depth:8,objects:[]});
 const second=TycoonScene.prototype.setScene.call(fake,'projects',{width:12,depth:8,objects:[]});
 pending[1].resolve();await second;pending[0].reject(Error('old'));await first;assert.deepEqual(errors,[]);
});
test('failed GLB fetch is evicted so an explicit retry can recover',async t=>{
 const previous=globalThis.fetch;let calls=0;t.after(()=>globalThis.fetch=previous);
 globalThis.fetch=async()=>{calls++;throw Error('offline');};
 const fake={manifest:Promise.resolve({assets:[{kind:'desk',file:'desk.glb'}]}),cache:new Map()};
 await assert.rejects(()=>TycoonScene.prototype.loadAsset.call(fake,'desk'));await assert.rejects(()=>TycoonScene.prototype.loadAsset.call(fake,'desk'));assert.equal(calls,2);
});
test('GLB instances share source geometry but own materials and transforms',async()=>{
  const source=new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
  const scene=new THREE.Group(),assembly=new TycoonAssembly(scene,async()=>source);
  await assembly.replace([{id:'one',kind:'desk',x:1,z:0},{id:'two',kind:'desk',x:3,z:0}]);
  const [a,b]=scene.children;assert.equal(a.position.x,1);assert.equal(b.position.x,3);assert.notEqual(a.children[0].material,b.children[0].material);
  a.children[0].material.color.set('red');assert.notEqual(a.children[0].material.color.getHex(),b.children[0].material.color.getHex());
  assert.equal(a.userData.instanceId,'one');assembly.dispose();assert.equal(scene.children.length,0);
});

test('a missing optional simulation actor does not prevent the room loading',async()=>{
 const stage=new THREE.Group(),errors=[],assembly=new TycoonAssembly(stage,async kind=>{
  if(kind==='actor')throw Error('actor unavailable');const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));return g;
 },(object,error)=>errors.push([object.id,error.message]));
 await assembly.replace([{id:'desk-1',kind:'desk'},{id:'demo-agent',kind:'actor',optional:true}]);
 assert.equal(assembly.owned.length,1);assert.deepEqual(errors,[['demo-agent','actor unavailable']]);assembly.dispose();
});

test('reduced motion blocks manual simulation before movement starts',t=>{
 const old=globalThis.matchMedia;t.after(()=>{globalThis.matchMedia=old;});globalThis.matchMedia=()=>({matches:true});
 const fake={ready:true,activity:{startRoute(){throw Error('must not start');},startStation(){throw Error('must not start');}}};
 assert.equal(TycoonScene.prototype.startWalk.call(fake,[]).ok,false);
 assert.equal(TycoonScene.prototype.startStation.call(fake,'station:desk-1').ok,false);
});

test('connected presentation can omit the local simulation actor',async()=>{
 const captured=[];const fake={reset(){},assembly:{owned:[],async replace(objects){captured.push(...objects);}}};
 await TycoonScene.prototype.setScene.call(fake,'projects',createTycoonRoom('projects'),{allowProbe:false});
 assert.equal(fake.ready,true);assert.ok(!captured.some(o=>o.kind==='actor'));
});

test('focusing the visible probe centers the camera without changing its position',()=>{
 const actor=new THREE.Group();actor.position.set(3,0,-2);actor.visible=true;actor.userData.instanceId='demo-agent';
 const scene={assembly:{owned:[actor]},room:null,pan:new THREE.Vector3(),scale:1,fit(){this.fitted=true;}};
 assert.equal(TycoonScene.prototype.focusProbe.call(scene).ok,true);
 assert.deepEqual(scene.pan.toArray(),[3,0,-2]);assert.deepEqual(actor.position.toArray(),[3,0,-2]);assert.equal(scene.fitted,true);
 actor.visible=false;assert.equal(TycoonScene.prototype.focusProbe.call(scene).ok,false);
});

test('starting a new local test hides the previous probe until its spawn pose is checked',()=>{
 const actor=new THREE.Group();actor.userData.instanceId='demo-agent';let resets=0;actor.userData.contact={reset(){resets++;}};actor.userData.probeSnapshot={old:true};
 const scene={ready:true,assembly:{owned:[actor]},activity:{nav:{stations:[]},startRoute(){return {ok:true};},startStation(){return {ok:true};}}};
 for(const [method,input] of [['startWalk',[]],['startStation','station:desk-1']]){actor.visible=true;assert.equal(TycoonScene.prototype[method].call(scene,input).ok,true);assert.equal(actor.visible,false);assert.equal(actor.userData.probeSnapshot,null);}
 assert.equal(resets,2);
});


test('a load completing after context loss cannot enable navigation',async()=>{
 const fake={contextLost:true,reset(){},assembly:{owned:[],replace:async()=>{}},onStatus(){}};
 await TycoonScene.prototype.setScene.call(fake,'building',null);
 assert.equal(fake.ready,false);assert.equal(TycoonScene.prototype.startWalk.call(fake,[]).ok,false);
});

test('temporary navigation probe keeps measured rig-v3 assets and never enters floor inventory',async()=>{
 const stage=new THREE.Group(),loaded=[];
 const assembly=new TycoonAssembly(stage,async kind=>{loaded.push(kind);return new THREE.Group();});
 const room=createTycoonRoom('projects'),before=JSON.stringify(room);
 assert.equal(TYCOON_FACTORY_ASSETS.actor.file,'actor-rig-v3.glb');
 assert.equal(TYCOON_FACTORY_ASSETS.desk.file,'desk-v3.glb');
 assert.equal(tycoonSceneObjects('projects',room).some(object=>object.id==='demo-agent'),false);
 await assembly.replace([{id:'demo-agent',kind:'actor',intent:'agent'}]);
 const actor=assembly.owned[0];
 assert.deepEqual(loaded,['actor']);assert.equal(actor.userData.instanceId,'demo-agent');
 assert.equal(actor.userData.runtimeCharacter,undefined);assert.equal(JSON.stringify(room),before);
 assembly.dispose();assert.equal(stage.children.length,0);
});
