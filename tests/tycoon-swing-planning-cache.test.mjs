import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';

function triangleRoot(name,vertices){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.name=name;mesh.userData.instanceId=name;
 mesh.updateMatrixWorld(true);return mesh;
}
function makeWorld(){
 return new TycoonCollisionWorld([
  triangleRoot('near-plane',[-1,0,-1,0,0,1,1,0,-1]),
  triangleRoot('far-wall',[9,0,-1,9,1,1,9,0,1])
 ]);
}
function capsule(x,y=.02,z=0){const p=new THREE.Vector3(x,y,z);return {name:'left-shoe',side:'left',start:p.clone(),end:p.clone(),radius:.06};}
function boxAt(x,r=1){return new THREE.Box3(new THREE.Vector3(x-r,-r,-r),new THREE.Vector3(x+r,r,r));}

test('bounded capsule batches preserve ordered results and report one-time broadphase work',()=>{
 const world=makeWorld(),options={phase:'leaving'},full=world.inspectCapsules([capsule(0)],options),bounds=boxAt(0),batch=world.createCapsuleBatch(options,{bounds});
 assert.equal(JSON.stringify(world.inspectCapsules([capsule(0)],options)),JSON.stringify(full),'ordinary two-argument inspection remains byte-identical');
 bounds.copy(boxAt(10));
 const first=world.inspectCapsules([capsule(0)],options,batch);
 assert.equal(first.ok,full.ok);assert.equal(first.minClearanceM,full.minClearanceM);assert.deepEqual(first.hit,full.hit);
 assert.equal(first.setupBoundsTests,2,'the worklist checks every immutable mesh bound once');
 assert.ok(first.boundsTests>=first.setupBoundsTests,'reported bound work includes setup');
 assert.equal(first.scopeChecks,1,'containment validation is counted for each uncached in-scope query');
 assert.equal(first.worklistMeshes,1,'the cloned scope keeps the near mesh in original order and excludes the far mesh');
 const repeated=world.inspectCapsules([capsule(0)],options,batch);
 assert.equal(repeated.cacheHits,undefined,'point queries do not add a serialization cache');
 assert.equal(repeated.setupBoundsTests,0,'one-time filter cost is not charged twice');
 assert.equal(repeated.scopeChecks,1,'every uncached direct point scan validates scope containment');
 assert.equal(repeated.testedTriangles,first.testedTriangles,'the repeated query executes its full ordered triangle scan');
});

test('queries outside a batch snapshot fall back to the full world',()=>{
 const world=makeWorld(),options={phase:'leaving'},batch=world.createCapsuleBatch(options,{bounds:boxAt(0)});
 const full=world.inspectCapsules([capsule(9,.4)],options),scoped=world.inspectCapsules([capsule(9,.4)],options,batch);
 assert.equal(scoped.ok,full.ok);assert.equal(scoped.hit?.objectId,full.hit?.objectId);
 assert.equal(scoped.ok,false,'the obstacle outside the filtered worklist must still be found');
 assert.equal(scoped.scopeChecks,1,'out-of-scope containment work is counted');
 assert.equal(scoped.scopeMisses,1,'an out-of-snapshot query scans the full world');
});

test('point batches keep only a guarded worklist and scan every current capsule directly',()=>{
 const world=makeWorld(),options={phase:'leaving'},firstBatch=world.createCapsuleBatch(options,{bounds:boxAt(0),witnessSeed:{hit:{}}});
 const hit=world.inspectCapsules([capsule(0)],options,firstBatch),nextBatch=world.createCapsuleBatch(options,{bounds:boxAt(0),witnessSeed:hit});
 const full=world.inspectCapsules([capsule(.1)],options),scoped=world.inspectCapsules([capsule(.1)],options,nextBatch);
 assert.equal(hit.ok,false);assert.equal(scoped.ok,full.ok);assert.deepEqual(scoped.hit,full.hit);
 assert.equal(scoped.hit.method,undefined,'point batches do not emit witness-only collision hits');
 assert.equal(scoped.testedTriangles,full.testedTriangles,'the current capsule receives the full ordered triangle query');
 assert.equal(scoped.scopeChecks,1);assert.equal(scoped.scopeMisses,0);
});

test('foreign kind, world, and support batches cannot narrow capsule queries',()=>{
 const world=makeWorld(),other=makeWorld(),options={phase:'leaving'},capsules=[capsule(9,.4)];
 const foreignWorld=other.createCapsuleBatch(options,{bounds:boxAt(0)}),wrongSupport=world.createCapsuleBatch(options,{bounds:boxAt(0)}),wrongKind=world.createSweepBatch(options,{bounds:boxAt(0)});
 for(const [changed,batch] of [
  [options,foreignWorld],
  [{phase:'standing'},wrongSupport],
  [options,wrongKind]
 ]){
  const actual=world.inspectCapsules(capsules,changed,batch),expected=world.inspectCapsules(capsules,changed);
  assert.equal(actual.ok,expected.ok);assert.deepEqual(actual.hit,expected.hit);
  assert.equal(actual.scopeMisses,undefined,'an invalid opaque batch falls back to the unchanged public query');
 }
});

test('bounded sweep batches report setup work even when the sweep range rejects before sampling',()=>{
 const world=makeWorld(),options={phase:'leaving',maxStepM:.001,maxSamples:1},batch=world.createSweepBatch(options,{bounds:boxAt(0)});
 const result=world.sweepCapsules([capsule(0)],[capsule(1)],options,batch);
 assert.equal(result.ok,false);assert.equal(result.hit.reason,'sweep-range-exceeded');
 assert.equal(result.setupBoundsTests,2);assert.equal(result.boundsTests,2,'prefilter work is counted even when no sample is queried');
 assert.equal(result.scopeChecks,0,'a range-rejected sweep never tests sample containment');
});

test('bounded sweep scope misses scan the full world and count actual containment calls',()=>{
 const world=makeWorld(),options={phase:'leaving',maxStepM:.05},batch=world.createSweepBatch(options,{bounds:boxAt(0)}),pose=[capsule(9,2)];
 const expected=world.sweepCapsules(pose,pose,options),actual=world.sweepCapsules(pose,pose,options,batch);
 assert.equal(actual.ok,expected.ok);assert.deepEqual(actual.hit,expected.hit);
 assert.equal(actual.scopeChecks,1,'the first unique sample performs one exact containment check');
 assert.equal(actual.scopeMisses,1,'the actual miss is named and reported');
 assert.equal(actual.cacheHits,1,'the repeated second sweep sample reuses only the existing exact sweep cache');
});

function makeSwingWorld(){
 const wall=triangleRoot('low-wall',[.5,-.2,-1,.5,.25,-1,.5,-.2,1,.5,.25,-1,.5,.25,1,.5,-.2,1]),decoys=[];
 for(let i=0;i<40;i++){const x=20+i;decoys.push(triangleRoot(`far-${i}`,[x,0,-1,x,1,1,x,0,1]));}
 return new TycoonCollisionWorld([wall,...decoys]);
}
function runSwing(useBatch){
 const world=makeSwingWorld();if(!useBatch)world.createCapsuleBatch=()=>null;
 const contact=Object.create(ProbeContact.prototype);contact.collisionWorld=world;
 contact.shoeCapsuleAt=(leg,ankle)=>({name:`${leg.side}-shoe`,side:leg.side,start:ankle.clone(),end:ankle.clone(),radius:leg.shoe.radius});
 let testedTriangles=0,boundsTests=0,cacheHits=0,witnessTests=0,setupBoundsTests=0,scopeChecks=0,scopeMisses=0;
 const inspect=world.inspectCapsules.bind(world);world.inspectCapsules=(...args)=>{const result=inspect(...args);testedTriangles+=result.testedTriangles;boundsTests+=result.boundsTests;cacheHits+=result.cacheHits||0;witnessTests+=result.witnessTests||0;setupBoundsTests+=result.setupBoundsTests||0;scopeChecks+=result.scopeChecks||0;scopeMisses+=result.scopeMisses||0;return result;};
 const shoe={a:new THREE.Vector3(),b:new THREE.Vector3(),radius:.06},leg={side:'left',shoe};
 const from=new THREE.Vector3(.25,.02,0),to=new THREE.Vector3(.75,.02,0);
 const plan=contact.swingClearanceLift(leg,from,to,0,0,'leaving',false);
 return {plan,metrics:{testedTriangles,boundsTests,cacheHits,witnessTests,setupBoundsTests,scopeChecks,scopeMisses}};
}

test('scoped shoe scans keep the selected lift and reduce full-world bounds work without point caching',t=>{
 const full=runSwing(false),batched=runSwing(true);
 assert.deepEqual(batched.plan,full.plan,'the ordered lift search returns the same accepted plan');
 assert.equal(batched.plan.ok,true);assert.ok(Math.abs(batched.plan.lift-.3)<1e-12);assert.equal(batched.plan.attempts,13);assert.equal(batched.plan.sampleCount,49);
 assert.equal(batched.metrics.cacheHits,0,'point planning performs no exact-key cache reuse');
 assert.ok(batched.metrics.setupBoundsTests>0,'the bounded worklist setup is included in executed bounds work');
 assert.ok(batched.metrics.scopeChecks>0);assert.equal(batched.metrics.scopeMisses,0);
 assert.ok(batched.metrics.boundsTests<full.metrics.boundsTests,
  `ordered mesh filtering must reduce total mesh bounds tests: batched=${JSON.stringify(batched.metrics)} full=${JSON.stringify(full.metrics)}`);
 t.diagnostic(JSON.stringify({plan:batched.plan,scoped:batched.metrics,full:full.metrics}));
});

test('walking shoe collision without a repair candidate does not construct a sweep batch',async()=>{
 const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8')),asset=TYCOON_FACTORY_ASSETS.actor||manifest.assets.find(item=>item.kind==='actor');
 assert.ok(asset,'the actual articulated actor GLB exists');
 const bytes=await readFile(`web/assets/models/${TYCOON_FACTORY_ASSETS.actor?'tycoon-factory':'tycoon'}/${asset.file}`),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const actor=gltf.scene;actor.updateMatrixWorld(true);let batches=0;
 const world=new TycoonCollisionWorld([]);world.sweepCapsules=(from,to,options)=>({ok:false,phase:options.phase,checkedCapsules:to.length,testedTriangles:0,checkedMeshes:0,boundsTests:0,sampleCount:1,minClearanceM:-.01,hit:{objectId:'chair',mesh:'surface',limb:'left-shoe',side:'left',clearanceM:-.01}});
 world.createSweepBatch=()=>{batches++;return null;};
 const contact=new ProbeContact(actor,world);assert.equal(contact.valid,true);
 const result=contact.update({heading:0,seatHeight:.551132},'walking',1/30);
 assert.ok(result&&contact.lastCollision.hit?.limb==='left-shoe','the injected shoe hit reaches the no-repair branch');
 assert.equal(batches,0,'unsupported walking-shoe collision has no repair candidate and must not build a filtered mesh list');
});
