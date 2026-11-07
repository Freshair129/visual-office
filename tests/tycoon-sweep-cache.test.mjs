import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';

function fixture(){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,.1,1),new THREE.MeshBasicMaterial());mesh.userData.instanceId='seat';
 return new TycoonCollisionWorld([mesh]);
}
const cap=(name,x,y,z)=>({name,side:'left',start:new THREE.Vector3(x,y,z),end:new THREE.Vector3(x+.08,y,z),radius:.04});
function behavior(result){const {testedTriangles,checkedMeshes,boundsTests,cacheHits,...rest}=result;return rest;}

test('one repair batch reuses only exact capsule queries and reports actual executed work',()=>{
 const world=fixture(),options={phase:'leaving'},batch=world.createSweepBatch?.(options),from=[cap('left-thigh',0,.09,0),cap('left-shin',0,.4,0)];
 assert.ok(batch,'repair sweeps need an explicitly scoped cache');
 let hits=0,fastTests=0,referenceTests=0;
 for(const y of [.088,.086,.084,.082,.08]){
  const to=[cap('left-thigh',0,y,0),cap('left-shin',0,.4,0)],fast=world.sweepCapsules(from,to,options,batch),reference=world.sweepCapsules(from,to,options);
  assert.deepEqual(behavior(fast),behavior(reference));hits+=fast.cacheHits;fastTests+=fast.testedTriangles;referenceTests+=reference.testedTriangles;
 }
 assert.ok(hits>0,'unchanged samples are reused');assert.ok(fastTests<referenceTests,`executed triangles ${fastTests} vs ${referenceTests}`);
});

test('cache includes capsule geometry, seat support options and world identity; hits stay detached',()=>{
 const world=fixture(),other=fixture(),options={phase:'leaving'},batch=world.createSweepBatch?.(options);
 assert.ok(batch);
 assert.equal(world.inspectSweepSample,undefined,'unvalidated batch composition is private to the guarded sweep path');
 for(const x of [0,.1,.7])for(const radius of [.04,.08]){
  const from=[cap('left-thigh',x,.06,0)],to=[cap('left-thigh',x,.04,0)];to[0].radius=radius;
  for(const opts of [options,{phase:'sit',seatObjectId:'seat',seatPoint:new THREE.Vector3(),seatHeight:.05,seatSupportRadius:.4}]){
   const fast=world.sweepCapsules(from,to,opts,batch),reference=world.sweepCapsules(from,to,opts);assert.deepEqual(behavior(fast),behavior(reference));
   if(fast.hit){fast.hit.segmentStart[0]=999;fast.hit.surfaceBounds.min[0]=999;assert.deepEqual(behavior(world.sweepCapsules(from,to,opts,batch)),behavior(reference),'diagnostic mutation cannot poison a cache hit');}
  }
  assert.deepEqual(behavior(other.sweepCapsules(from,to,options,batch)),behavior(other.sweepCapsules(from,to,options)),'foreign batch cannot supply geometry');
 }
 const from=[cap('left-shin',0,.3,0)],to=[cap('left-shin',0,.3,0)];
 world.sweepCapsules(from,to,options,batch);from[0].start.y=.04;to[0].start.y=.04;
 assert.deepEqual(behavior(world.sweepCapsules(from,to,options,batch)),behavior(world.sweepCapsules(from,to,options)),'mutated endpoint cannot reuse a prior query');
 const fresh=world.createSweepBatch(options),result=world.sweepCapsules(from,to,options,fresh);assert.equal(result.cacheHits,0,'new update starts without prior query results');
});
