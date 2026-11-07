import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';

function capsule(name,side,x,y,z,radius=.04){
 const start=new THREE.Vector3(x,y,z);
 return {name,side,start,end:new THREE.Vector3(x+.08,y,z),radius};
}

function withoutBatchCounters(result){
 const {cacheHits,...behavior}=result;return behavior;
}

function collisionSemantics(result){
 return {ok:result.ok,phase:result.phase,checkedCapsules:result.checkedCapsules,sampleCount:result.sampleCount,minClearanceM:result.minClearanceM,hit:result.hit};
}

function measureWork(run){
 const work={clone:0,lerp:0,jsonStringify:0};let active=false;
 const originalClone=THREE.Vector3.prototype.clone,originalLerp=THREE.Vector3.prototype.lerp,originalStringify=JSON.stringify;
 THREE.Vector3.prototype.clone=function(...args){if(active)work.clone++;return originalClone.apply(this,args);};
 THREE.Vector3.prototype.lerp=function(...args){if(active)work.lerp++;return originalLerp.apply(this,args);};
 JSON.stringify=function(...args){if(active)work.jsonStringify++;return originalStringify.apply(this,args);};
 try{return {value:run(fn=>{active=true;try{return fn();}finally{active=false;}}),work};}
 finally{THREE.Vector3.prototype.clone=originalClone;THREE.Vector3.prototype.lerp=originalLerp;JSON.stringify=originalStringify;}
}

function runRepairCandidates(useBatch,measure){
 const world=new TycoonCollisionWorld([]),options={phase:'leaving',maxStepM:.01,maxSamples:40};
 const batch=useBatch?world.createSweepBatch(options):null;
 const from=[capsule('left-thigh','left',0,0,0),capsule('left-shin','left',0,.3,0),capsule('right-thigh','right',0,0,.3),capsule('right-shin','right',0,.3,.3)];
 const to=from.map(item=>({...item,start:item.start.clone(),end:item.end.clone()}));
 const results=[];let cacheHits=0;
 for(let candidate=0;candidate<310;candidate++){
  const angle=2*Math.PI*candidate/310,x=.043*Math.cos(angle),z=.043*Math.sin(angle);
  to[0].start.set(x,0,z);to[0].end.set(x+.08,0,z);
  const result=measure(()=>world.sweepCapsules(from,to,options,batch));
  results.push(withoutBatchCounters(result));cacheHits+=result.cacheHits||0;
 }
 return {results,cacheHits};
}

function triangleWorld(){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,-1,0,0,1,1,0,-1],3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.userData.instanceId='seat';mesh.updateMatrixWorld(true);
 return new TycoonCollisionWorld([mesh]);
}

test('repair batch reuses exact stationary limb samples and keys across 310 candidates',t=>{
 const cached=measureWork(measure=>runRepairCandidates(true,measure));
 const reference=measureWork(measure=>runRepairCandidates(false,measure));
 const oldBatchedWork={clone:310*4*6*2,lerp:310*4*6*2,jsonStringify:310*(1+4*6)};
 t.diagnostic(JSON.stringify({candidateCount:cached.value.results.length,batchWork:cached.work,uncachedWork:reference.work,oldBatchedWork,cacheHits:cached.value.cacheHits}));
 assert.deepEqual(cached.value.results,reference.value.results,'every ordered candidate keeps the same collision diagnostics');
 assert.equal(cached.value.results.length,310,'all repair candidates are still evaluated');
 assert.ok(cached.value.cacheHits>1000,'the existing exact query cache still accounts for repeated sample queries');
 assert.ok(cached.work.clone<reference.work.clone*.4,`Vector3.clone work: batch=${cached.work.clone}, full=${reference.work.clone}`);
 assert.ok(cached.work.lerp<reference.work.lerp*.4,`Vector3.lerp work: batch=${cached.work.lerp}, full=${reference.work.lerp}`);
 assert.ok(cached.work.jsonStringify<oldBatchedWork.jsonStringify*.4,
  `cached sample keys should reduce prior batched JSON work by at least 60%: batch=${cached.work.jsonStringify}, old=${oldBatchedWork.jsonStringify}`);
});

test('same-object endpoint mutation rebuilds changed samples while triangle hit and clear diagnostics stay exact',()=>{
 const world=triangleWorld(),reference=triangleWorld(),options={phase:'leaving',maxStepM:.05};
 const from=[capsule('left-thigh','left',1.05,.02,0,.06)],to=[capsule('left-thigh','left',.9,.02,0,.06)],batch=world.createSweepBatch(options);
 const first=world.sweepCapsules(from,to,options,batch),firstReference=reference.sweepCapsules(from,to,options);
 assert.equal(first.ok,true,'the measured triangle remains clear at the starting-side trajectory');
 assert.deepEqual(collisionSemantics(first),collisionSemantics(firstReference));
 to[0].start.x=.92;to[0].end.x=1;
 const mutated=world.sweepCapsules(from,to,options,batch),mutatedReference=reference.sweepCapsules(from,to,options);
 assert.equal(mutated.ok,true,'the changed endpoint remains a clear positive query');
 assert.deepEqual(collisionSemantics(mutated),collisionSemantics(mutatedReference));
 assert.equal(mutated.cacheHits,1,'only the identical t=0 sample may reuse a prior query after same-object mutation');
 from[0].start.x=1.04;from[0].end.x=1.12;to[0].radius=.061;
 const changedSourceAndRadius=world.sweepCapsules(from,to,options,batch),changedSourceAndRadiusReference=reference.sweepCapsules(from,to,options);
 assert.equal(changedSourceAndRadius.ok,true,'mutated from endpoints and destination radius remain clear');
 assert.deepEqual(collisionSemantics(changedSourceAndRadius),collisionSemantics(changedSourceAndRadiusReference));
 assert.equal(changedSourceAndRadius.cacheHits,0,'changing either endpoint snapshot and radius cannot reuse a stale capsule key');
 to[0].start.x=.15;to[0].end.x=.23;
 const collision=world.sweepCapsules(from,to,options,batch),collisionReference=reference.sweepCapsules(from,to,options);
 assert.equal(collision.ok,false,'the interpolated capsule crosses the real triangle');
 assert.deepEqual(collisionSemantics(collision),collisionSemantics(collisionReference),'first-hit triangle diagnostics retain exact coordinates and order');
});

test('repair interpolation tracks and exact query keys stay bounded at 4096 entries',()=>{
 const world=triangleWorld(),options={phase:'leaving',maxStepM:.05},batch=world.createSweepBatch(options);
 for(let entry=0;entry<4097;entry++){
  const name=`limb-${entry}`,from=[capsule(name,'left',0,.02,0,.06)],to=[capsule(name,'left',0,.02,0,.06)];
  const result=world.sweepCapsules(from,to,options,batch);
  assert.equal(result.ok,false,'the actual triangle hit stops at the first sample');
  assert.equal(result.hit.sampleIndex,0);
 }
 const from=[capsule('limb-0','left',0,.02,0,.06)],to=[capsule('limb-0','left',0,.02,0,.06)];
 const measured=measureWork(measure=>measure(()=>world.sweepCapsules(from,to,options,batch))),result=measured.value;
 assert.equal(result.ok,false);assert.equal(result.cacheHits,0,'the earliest exact query key was evicted after the bound');
 assert.ok(measured.work.clone>0&&measured.work.lerp>0,`the matching earliest interpolation track was evicted after the bound: ${JSON.stringify({work:measured.work,cacheHits:result.cacheHits,hit:result.hit})}`);
});
