import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';

async function loadGlb(file){
 const bytes=await readFile(file);
 const data=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 return (await new GLTFLoader().parseAsync(data,'')).scene;
}

async function productionCollisionFixture(){
 const room=createTycoonRoom('projects'),deskData=room.objects.find(object=>object.id==='desk-1'),chairData=room.objects.find(object=>object.id==='chair-1');
 const [actor,desk,chair]=await Promise.all([
  loadGlb('web/assets/models/tycoon-factory/actor-rig-v3.glb'),
  loadGlb('web/assets/models/tycoon-factory/desk-v3.glb'),
  loadGlb('web/assets/models/tycoon/chair.glb'),
 ]);
 actor.userData.instanceId='demo-agent';
 desk.userData.instanceId=deskData.id;desk.position.set(deskData.x,deskData.y,deskData.z);desk.rotation.y=deskData.rotation;desk.scale.setScalar(deskData.scale);
 chair.userData.instanceId=chairData.id;chair.position.set(chairData.x,chairData.y,chairData.z);chair.rotation.y=chairData.rotation;chair.scale.setScalar(chairData.scale);
 actor.updateMatrixWorld(true);desk.updateMatrixWorld(true);chair.updateMatrixWorld(true);
 const roots=[desk,chair],accelerated=new TycoonCollisionWorld(roots),reference=new TycoonCollisionWorld(roots,{useBvh:false});
 const contact=new ProbeContact(actor,accelerated);
 assert.equal(contact.valid,true,'the bundled actor rig supplies production probe capsules');
 const capsules=contact.limbCapsules().filter(capsule=>/^(left|right)-(thigh|shin|shoe)$/.test(capsule.name));
 assert.equal(capsules.length,6,'the production probe supplies both thigh, shin, and shoe capsules');
 const seatFrame=accelerated.topSurfaceFrame('chair-1'),seatTriangle=seatFrame?.triangles[0];
 assert.ok(seatTriangle,'the bundled chair GLB contains a measured horizontal seat surface');
 const seatPoint=seatTriangle.a.clone().add(seatTriangle.b).add(seatTriangle.c).multiplyScalar(1/3);
 const bounds=new THREE.Box3().setFromObject(desk).union(new THREE.Box3().setFromObject(chair));
 return {actor,roots,accelerated,reference,capsules,seatPoint,seatHeight:seatPoint.y,bounds};
}

function shifted(capsule,offset){return {...capsule,start:capsule.start.clone().add(offset),end:capsule.end.clone().add(offset)};}
function withoutBoundsTests(result){const {boundsTests,...behavior}=result;return behavior;}
function seeded(seed){let state=seed>>>0;return ()=>{state=(1664525*state+1013904223)>>>0;return state/0x100000000;};}

test('accelerated triangle queries preserve full-scan results on bundled GLBs and seeded probe capsules',async()=>{
 const {accelerated,reference,capsules,seatPoint,seatHeight,bounds}=await productionCollisionFixture();
 assert.equal(accelerated.useBvh,true,'the production constructor uses the accelerated index by default');
 assert.equal(reference.useBvh,false,'the reference constructor selects the full-scan implementation');
 const random=seeded(0x6f666669),size=bounds.getSize(new THREE.Vector3()),origin=bounds.getCenter(new THREE.Vector3());
 let acceleratedBounds=0,referenceBounds=0,hitCases=0;
 for(let i=0;i<144;i++){
  const source=capsules[i%capsules.length],count=i%9===0?capsules.length:1,offset=new THREE.Vector3(
   bounds.min.x-.35+random()*(size.x+.7),
   -.1+random()*(Math.max(.8,size.y+.2)),
   bounds.min.z-.35+random()*(size.z+.7),
  );
  const query=capsules.slice(i%capsules.length,i%capsules.length+count).map(capsule=>shifted(capsule,offset));
  if(query.length===0)query.push(shifted(source,offset));
  const options=i%4===0?{phase:'working',seatObjectId:'chair-1',seatPoint,seatHeight}:i%4===1?{phase:'entering',allowSeatSupport:true,seatObjectId:'chair-1',seatPoint,seatHeight}:{phase:i%2?'walking':'leaving'};
  const indexed=accelerated.inspectCapsules(query,options),linear=reference.inspectCapsules(query,options);
  assert.deepEqual(withoutBoundsTests(indexed),withoutBoundsTests(linear),`seed 0x6f666669 query ${i}`);
  acceleratedBounds+=indexed.boundsTests;referenceBounds+=linear.boundsTests;
  if(indexed.hit)hitCases++;
 }
 const seatCapsule={name:'left-thigh',side:'left',start:seatPoint.clone(),end:seatPoint.clone(),radius:.04};
 const supportedOptions={phase:'sit',seatObjectId:'chair-1',seatPoint,seatHeight};
 const indexedSupport=accelerated.inspectCapsules([seatCapsule],supportedOptions),linearSupport=reference.inspectCapsules([seatCapsule],supportedOptions);
 assert.deepEqual(withoutBoundsTests(indexedSupport),withoutBoundsTests(linearSupport),'measured chair-seat support exception');
 assert.equal(indexedSupport.ok,true,'the actual chair top remains valid seat support');
 const unsupportedOptions={...supportedOptions,phase:'entering',allowSeatSupport:false};
 const indexedCollision=accelerated.inspectCapsules([seatCapsule],unsupportedOptions),linearCollision=reference.inspectCapsules([seatCapsule],unsupportedOptions);
 assert.deepEqual(withoutBoundsTests(indexedCollision),withoutBoundsTests(linearCollision),'seat contact remains blocked outside its supported phase');
 assert.equal(indexedCollision.ok,false,'a thigh capsule cannot penetrate the chair when seat support is disabled');
 assert.ok(hitCases>0,'seeded actor capsules exercise actual GLB collisions');
 assert.ok(acceleratedBounds<referenceBounds,`the index visits fewer bounds (${acceleratedBounds} vs ${referenceBounds})`);
 const fromOffset=new THREE.Vector3(bounds.min.x-1,0,origin.z),toOffset=new THREE.Vector3(bounds.max.x+1,0,origin.z);
 const from=capsules.map(capsule=>shifted(capsule,fromOffset)),to=capsules.map(capsule=>shifted(capsule,toOffset));
 const indexedSweep=accelerated.sweepCapsules(from,to,{phase:'approaching-seat',maxStepM:.15,maxSamples:40});
 const linearSweep=reference.sweepCapsules(from,to,{phase:'approaching-seat',maxStepM:.15,maxSamples:40});
 assert.deepEqual(withoutBoundsTests(indexedSweep),withoutBoundsTests(linearSweep),'swept collision diagnostics and first hit');
 assert.ok(indexedSweep.boundsTests<linearSweep.boundsTests,`the index reduces sweep bounds work (${indexedSweep.boundsTests} vs ${linearSweep.boundsTests})`);
});
