import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {TycoonScene,TycoonAssembly,tycoonSceneObjects} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';

function makeTriangleWorld(){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,-1,0,0,1,1,0,-1],3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.userData.instanceId='seat';
 mesh.updateMatrixWorld(true);return new TycoonCollisionWorld([mesh]);
}
function capsule(x,y=.02,z=0,name='left-thigh',radius=.06){
 const point=new THREE.Vector3(x,y,z);return {name,side:'left',start:point.clone(),end:point.clone(),radius};
}
function witnessOptions(){return {phase:'leaving',maxStepM:.05};}

test('repair witness rejects only from a current exact triangle distance and reports the current hit',()=>{
 const world=makeTriangleWorld(),options=witnessOptions(),from=[capsule(1.05)],base=world.sweepCapsules(from,[capsule(0)],options);
 assert.equal(base.ok,false,'the ordered base sweep must find the actual triangle collision');
 assert.equal(base.hit.method,undefined,'the base sweep remains an ordered full scan');
 const batch=world.createSweepBatch(options,{useWitnesses:true,witnessSeed:base});
 const candidate=world.sweepCapsules(from,[capsule(.15)],options,batch);
 assert.equal(candidate.ok,false,'a current candidate sample still collides with the witnessed triangle');
 assert.equal(candidate.hit.method,'triangle-witness','a subset proof is labeled explicitly');
 assert.ok(candidate.witnessTests>0);assert.equal(candidate.witnessRejections,1);
 assert.equal(candidate.hit.limb,'left-thigh');assert.ok(candidate.hit.clearanceM<-.001);
 assert.ok(Math.abs(candidate.hit.segmentStart[0]-(from[0].start.x+(.15-from[0].start.x)*candidate.hit.sweepT))<1e-12,
  'the reported witness hit uses the current interpolated capsule coordinates');
 assert.ok(candidate.testedTriangles>=candidate.witnessTests,'every exact witness closest-point check is included in executed triangle work');
 assert.ok(Number.isInteger(candidate.boundsTests)&&candidate.boundsTests>=0,'bounds work remains a truthful non-negative count');
});

test('a witness miss falls back to the full ordered query and can accept a positive candidate',()=>{
 const world=makeTriangleWorld(),options=witnessOptions(),from=[capsule(1.05)],base=world.sweepCapsules(from,[capsule(0)],options);
 assert.equal(base.ok,false);
 const full=world.sweepCapsules(from,[capsule(1.05)],options,world.createSweepBatch(options));
 const batch=world.createSweepBatch(options,{useWitnesses:true,witnessSeed:base});
 const clear=world.sweepCapsules(from,[capsule(1.05)],options,batch);
 assert.equal(clear.ok,true,'the candidate remains clear after the normal full query');
 assert.ok(clear.witnessTests>0);assert.ok(clear.witnessFallbacks>0,'a witness miss proceeds to the full exact scan');
 assert.equal(clear.witnessRejections,0);assert.ok(clear.testedTriangles>0,'the full scan actually evaluated nearby GLB-style triangle geometry');
 assert.equal(clear.testedTriangles-full.testedTriangles,clear.witnessTests,'witness closest-point work is included in the actual triangle count');
 assert.equal(clear.boundsTests-full.boundsTests,clear.witnessTests*2,'both witness mesh and triangle bounds checks are counted');
});

test('seat support can cancel a witness hit and still reaches the normal full query',()=>{
 const world=makeTriangleWorld(),options={phase:'working',seatObjectId:'seat',seatPoint:new THREE.Vector3(0,0,0),seatHeight:0,seatSupportRadius:.32,maxStepM:.05},from=[capsule(0)],base=world.sweepCapsules(from,[capsule(1.05)],options);
 assert.equal(base.ok,false,'the base sweep finds collision after leaving the measured support patch');
 const batch=world.createSweepBatch(options,{useWitnesses:true,witnessSeed:base});
 const supported=world.sweepCapsules(from,[capsule(0)],options,batch);
 assert.equal(supported.ok,true,'seat support remains allowed for the current thigh position');
 assert.equal(supported.witnessRejections,0,'a support-allowed triangle never rejects a candidate');
 assert.ok(supported.witnessFallbacks>0,'allowed witness contact is resolved by the full ordered query');
 assert.ok(supported.witnessTests>0);assert.equal(supported.testedTriangles,supported.witnessTests,'support-filtered witness closest-point work remains counted');
});

test('witness seeds are rejected across support options, worlds and forged result objects',()=>{
 const options=witnessOptions(),world=makeTriangleWorld(),from=[capsule(1.05)],base=world.sweepCapsules(from,[capsule(0)],options);
 assert.equal(base.ok,false);
 const changedOptions={...options,phase:'standing'};
 const changed=world.sweepCapsules(from,[capsule(0)],changedOptions,world.createSweepBatch(changedOptions,{useWitnesses:true,witnessSeed:base}));
 assert.equal(changed.ok,false);assert.equal(changed.hit.method,undefined);assert.equal(changed.witnessTests||0,0,'support-key mismatch disables the seed');
 const otherWorld=makeTriangleWorld(),foreign=otherWorld.sweepCapsules(from,[capsule(0)],options,otherWorld.createSweepBatch(options,{useWitnesses:true,witnessSeed:base}));
 assert.equal(foreign.ok,false);assert.equal(foreign.hit.method,undefined);assert.equal(foreign.witnessTests,0,'another collision world cannot use the seed');
 const forged={...base,hit:{...base.hit}};
 const untrusted=world.sweepCapsules(from,[capsule(0)],options,world.createSweepBatch(options,{useWitnesses:true,witnessSeed:forged}));
 assert.equal(untrusted.ok,false);assert.equal(untrusted.hit.method,undefined);assert.equal(untrusted.witnessTests,0,'copying public diagnostic fields cannot forge private triangle provenance');
});

const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8'));
const modelCache=new Map();
async function load(kind){
 if(!modelCache.has(kind))modelCache.set(kind,(async()=>{
  const factory=TYCOON_FACTORY_ASSETS[kind],meta=factory||manifest.assets.find(item=>item.kind===kind);
  assert.ok(meta,`actual GLB metadata for ${kind}`);
  const bytes=await readFile(`web/assets/models/${factory?'tycoon-factory':'tycoon'}/${meta.file}`);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.animations=gltf.animations;return gltf.scene;
 })());
 return modelCache.get(kind);
}
async function setup(useWitnesses){
 const room=createTycoonRoom('projects');room.objects.find(object=>object.id==='chair-1').scale=1.25;
 const assembly=new TycoonAssembly(new THREE.Group(),load);
 await assembly.replace([...tycoonSceneObjects('projects',room),{id:'demo-agent',kind:'actor',clip:'idle',optional:false}]);
 const activity=new TycoonActivity(room),actor=assembly.owned.find(model=>model.userData.instanceId==='demo-agent');
 const collisionWorld=new TycoonCollisionWorld(assembly.owned),createBatch=collisionWorld.createSweepBatch.bind(collisionWorld);
 collisionWorld.createSweepBatch=(options,configuration={})=>createBatch(options,{...configuration,useWitnesses});
 const runMetrics={witnessTests:0,witnessRejections:0,candidateSweeps:0,candidateTriangles:0,positiveFullSweeps:0};
 const sweep=collisionWorld.sweepCapsules.bind(collisionWorld);
 collisionWorld.sweepCapsules=(from,to,options,batch)=>{
  const result=sweep(from,to,options,batch);
  if(batch){runMetrics.candidateSweeps++;runMetrics.candidateTriangles+=result.testedTriangles||0;if(result.ok&&result.testedTriangles>0)runMetrics.positiveFullSweeps++;}
  runMetrics.witnessTests+=result.witnessTests||0;runMetrics.witnessRejections+=result.witnessRejections||0;return result;
 };
 const scene={ready:true,room,assembly,activity,collisionWorld,play:TycoonScene.prototype.play,onStatus(){}};
 return {scene,actor,activity,assembly,metrics:()=>({...runMetrics})};
}
function poseHash(actor,activity){
 actor.updateMatrixWorld(true);const contact=actor.userData.contact;
 const objectPose=object=>({position:object.position.toArray(),quaternion:object.quaternion.toArray()});
 const bones=[];actor.traverse(object=>{if(object.isBone)bones.push({name:object.name,position:object.position.toArray(),quaternion:object.quaternion.toArray(),matrixWorld:object.matrixWorld.toArray()});});
 const state={phase:activity.phase,ready:contact.ready,feetReady:contact.feetReady,visible:actor.visible,root:objectPose(actor),bones,legs:contact.legs.map(leg=>({side:leg.side,point:leg.point.toArray(),yaw:leg.yaw,
  hip:objectPose(leg.hip),knee:objectPose(leg.knee),ankle:objectPose(leg.ankle)})),
  seatedHipPose:contact.seatedHipPose?{offsets:contact.seatedHipPose.offsets.map(offset=>offset.toArray()),poleElevations:[...contact.seatedHipPose.poleElevations]}:null,
  legPoseHint:contact.legPoseHint?{offsets:contact.legPoseHint.offsets.map(offset=>offset.toArray()),poleElevations:[...contact.legPoseHint.poleElevations]}:null};
 return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}
async function replay(useWitnesses){
 const {scene,actor,activity,assembly,metrics}=await setup(useWitnesses),hashes=[];let workingFrames=0,doneFrames=0;
 try{
  assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);
  for(let frame=0;frame<30*90;frame++){
   TycoonScene.prototype.updateProbe.call(scene,actor,1/30);
   assert.notEqual(activity.phase,'blocked',`real-GLB ${useWitnesses?'witness':'full'} run blocked at frame ${frame}: ${JSON.stringify(actor.userData.limbCollisionDiagnostics)}`);
   assert.notEqual(actor.userData.limbCollisionDiagnostics?.ok,false,`collision refused at frame ${frame}`);
   if(activity.phase==='working')workingFrames++;
   hashes.push(poseHash(actor,activity));
   if(activity.phase==='done'&&++doneFrames>30)break;
  }
  assert.ok(workingFrames>=25,'the actual bundled large-chair desk reaches sustained working contact');
  assert.ok(doneFrames>30,'the actual GLB lifecycle reaches grounded done');
  return {hashes,metrics:metrics()};
 }finally{assembly.dispose();}
}

test('actual large-chair GLB accepted pose hashes match with witness rejection enabled and disabled',async t=>{
 const reference=await replay(false),witnessed=await replay(true);
 assert.deepEqual(witnessed.hashes,reference.hashes,'witness proofs preserve every accepted actor, joint and contact phase pose');
 assert.ok(witnessed.metrics.witnessTests>0,'real GLB repair candidates were checked against captured triangle witnesses');
 assert.ok(witnessed.metrics.witnessRejections>0,'real GLB repair candidates were rejected by exact current-geometry proofs');
 assert.equal(witnessed.metrics.candidateSweeps,reference.metrics.candidateSweeps,'candidate order and search length are unchanged');
 assert.ok(witnessed.metrics.candidateTriangles<reference.metrics.candidateTriangles,
  `witness rejection reduces actual candidate triangle work: witness=${JSON.stringify(witnessed.metrics)}, full=${JSON.stringify(reference.metrics)}`);
 assert.ok(witnessed.metrics.positiveFullSweeps>0,'clear candidates still pass a full or exact-key cached query');
 assert.equal(reference.metrics.witnessTests,0,'the full ordered reference uses no witness shortcuts');
 t.diagnostic(JSON.stringify({acceptedFrames:witnessed.hashes.length,acceptedPoseSequenceSha256:createHash('sha256').update(witnessed.hashes.join('\n')).digest('hex'),
  fullScanCandidateSweeps:reference.metrics.candidateSweeps,witnessCandidateSweeps:witnessed.metrics.candidateSweeps,
  fullScanCandidateTriangleTests:reference.metrics.candidateTriangles,witnessCandidateTriangleTests:witnessed.metrics.candidateTriangles,
  witnessTriangleTests:witnessed.metrics.witnessTests,witnessRejections:witnessed.metrics.witnessRejections,positiveFullCandidateSweeps:witnessed.metrics.positiveFullSweeps}));
});
