import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene,TycoonAssembly,tycoonSceneObjects} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';

const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8'));
const modelCache=new Map();
async function load(kind){
 if(!modelCache.has(kind))modelCache.set(kind,(async()=>{
  const factory=TYCOON_FACTORY_ASSETS[kind],meta=factory||manifest.assets.find(item=>item.kind===kind);
  assert.ok(meta,`real GLB metadata for ${kind}`);
  const bytes=await readFile(`web/assets/models/${factory?'tycoon-factory':'tycoon'}/${meta.file}`);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.animations=gltf.animations;
  return gltf.scene;
 })());
 return modelCache.get(kind);
}
async function setup(){
 const room=createTycoonRoom('projects');room.objects.find(object=>object.id==='chair-1').scale=1.25;
 const assembly=new TycoonAssembly(new THREE.Group(),load);
 await assembly.replace([...tycoonSceneObjects('projects',room),{id:'demo-agent',kind:'actor',clip:'idle',optional:false}]);
 const activity=new TycoonActivity(room),actor=assembly.owned.find(model=>model.userData.instanceId==='demo-agent');
 const scene={ready:true,room,assembly,activity,collisionWorld:new TycoonCollisionWorld(assembly.owned),play:TycoonScene.prototype.play,onStatus(){}};
 return {scene,actor,activity,assembly};
}
function createMetrics(){return {updates:0,totalSweeps:0,candidateSweeps:0,maxCandidatesPerUpdate:0,candidateSweepsByPhase:{},maxCandidatesPerPhase:{},hipOffsetMaxM:[0,0],hipBudgetBreaches:0,hintsSeen:0};}
function instrumentContact(scene,actor,metrics,{reuseHint}){
 const originalSweep=scene.collisionWorld.sweepCapsules.bind(scene.collisionWorld),originalUpdate=ProbeContact.prototype.update;let current=null;
 scene.collisionWorld.sweepCapsules=(from,to,options)=>{
  const contact=actor.userData.contact,sweep={hipOffsetsM:contact?.legs?.map(leg=>leg.hip.position.distanceTo(leg.hipRestPosition))||[0,0]};
  const result=originalSweep(from,to,options);if(current){current.sweeps.push(sweep);metrics.totalSweeps++;sweep.hipOffsetsM.forEach((distance,index)=>{metrics.hipOffsetMaxM[index]=Math.max(metrics.hipOffsetMaxM[index],distance);if(distance>.020001)metrics.hipBudgetBreaches++;});}return result;
 };
 ProbeContact.prototype.update=function(state,phase,dt,options){
  if(!reuseHint)this.legPoseHint=null;
  const previous=current,call={phase,sweeps:[]};current=call;
  try{return originalUpdate.call(this,state,phase,dt,options);}
  finally{const candidates=Math.max(0,call.sweeps.length-1);metrics.updates++;metrics.candidateSweeps+=candidates;metrics.maxCandidatesPerUpdate=Math.max(metrics.maxCandidatesPerUpdate,candidates);metrics.candidateSweepsByPhase[phase]=(metrics.candidateSweepsByPhase[phase]||0)+candidates;metrics.maxCandidatesPerPhase[phase]=Math.max(metrics.maxCandidatesPerPhase[phase]||0,candidates);current=previous;}
 };
 return ()=>{scene.collisionWorld.sweepCapsules=originalSweep;ProbeContact.prototype.update=originalUpdate;};
}
function assertAcceptedPose(actor,activity,label){
 const diagnostic=actor.userData.limbCollisionDiagnostics;
 assert.notEqual(activity.phase,'blocked',`${label}: blocked: ${JSON.stringify({reason:diagnostic?.reason,hit:diagnostic?.hit})}`);
 assert.notEqual(diagnostic?.ok,false,`${label}: collision refused`);
 const contact=actor.userData.contact;actor.updateMatrixWorld(true);
 for(const leg of contact.legs){
  const hip=leg.hip.getWorldPosition(new THREE.Vector3()),knee=leg.knee.getWorldPosition(new THREE.Vector3()),ankle=leg.ankle.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(hip.distanceTo(knee)-leg.a)<1e-5,`${label}: ${leg.side} thigh length changed`);
  assert.ok(Math.abs(knee.distanceTo(ankle)-leg.b)<1e-5,`${label}: ${leg.side} shin length changed`);
  const offset=leg.hip.position.distanceTo(leg.hipRestPosition);
  assert.ok(offset<=.020001,`${label}: ${leg.side} hip ${offset}m exceeds absolute 20mm budget`);
 }
 for(const side of ['left','right']){
  const shoe=actor.getObjectByName(`office-${side}-shoe`);shoe.skeleton.update();let bottom=Infinity;
  for(let index=0;index<shoe.geometry.attributes.position.count;index++)bottom=Math.min(bottom,shoe.localToWorld(shoe.getVertexPosition(index,new THREE.Vector3())).y);
  assert.ok(bottom>=-.003,`${label}: ${side} shoe penetrates floor by ${-bottom}m`);
  if(activity.phase==='working'||activity.phase==='done')assert.ok(Math.abs(bottom)<=.003,`${label}: ${side} planted shoe gap ${bottom}m`);
 }
 if(activity.phase==='working'){
  assert.ok(diagnostic?.seatSupport?.ok&&Math.abs(diagnostic.seatSupport.verticalGapM)<=.003,`${label}: measured seat support ${JSON.stringify(diagnostic?.seatSupport)}`);
  const arm=diagnostic?.armContact;assert.equal(arm?.status,'contact',`${label}: measured palm support`);assert.ok(arm.handTargetErrorM.max<=.005,`${label}: palm target residual ${arm.handTargetErrorM.max}`);
  for(const side of ['left','right']){
   const support=arm.contacts[side],palm=actor.getObjectByName(`office-${side}-palm`),normal=new THREE.Vector3().fromArray(support.surfaceNormal),point=new THREE.Vector3().fromArray(support.surfacePoint);palm.skeleton.update();let gap=Infinity;
   for(let index=0;index<palm.geometry.attributes.position.count;index++)gap=Math.min(gap,palm.localToWorld(palm.getVertexPosition(index,new THREE.Vector3())).sub(point).dot(normal));
   assert.ok(gap>=-.001&&gap<=.005,`${label}: ${side} actual palm gap ${gap}m`);
  }
 }
}
async function replay({reuseHint}){
 const {scene,actor,activity,assembly}=await setup(),metrics=createMetrics(),restoreInstrumentation=instrumentContact(scene,actor,metrics,{reuseHint}),phases=new Set();
 let stationStarted=false,completed=false,contact=null,observedHint=null,roundTrip=false,resetHint;
 try{
  assert.equal(TycoonScene.prototype.startWalk.call(scene,activity.nav.suggestRoute()).ok,true);
  for(let frame=0;frame<9000;frame++){
   contact=actor.userData.contact||contact;if(!reuseHint&&contact)contact.legPoseHint=null;
   TycoonScene.prototype.updateProbe.call(scene,actor,1/30);contact=actor.userData.contact||contact;
   assertAcceptedPose(actor,activity,`reuseHint=${reuseHint} frame=${frame}`);
   if(contact?.legPoseHint){metrics.hintsSeen++;observedHint??={offsets:contact.legPoseHint.offsets.map(offset=>offset.toArray()),poleElevations:[...contact.legPoseHint.poleElevations]};
    if(reuseHint&&!roundTrip&&contact.safePose){const expected=contact.legPoseHint.offsets.map(offset=>offset.toArray()),snapshot=contact.captureInternal();contact.legPoseHint=null;contact.restoreInternal(snapshot);assert.deepEqual(contact.legPoseHint.offsets.map(offset=>offset.toArray()),expected,'internal rollback preserves the validated hint');contact.legPoseHint=null;assert.equal(contact.restoreSafePose(),true);assert.deepEqual(contact.legPoseHint.offsets.map(offset=>offset.toArray()),expected,'safe-pose rollback restores the validated hint');roundTrip=true;}
   }
   phases.add(activity.phase);
   if(activity.phase==='done'){
    if(!stationStarted){assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);stationStarted=true;phases.clear();}
    else{completed=true;break;}
   }
  }
  assert.equal(stationStarted,true,'route reaches the assembled large-chair desk');assert.equal(completed,true,'one full desk lifecycle reaches grounded done');
  for(const phase of ['walking','entering','sit','working','standing','leaving','settling','done'])assert.ok(phases.has(phase),`full lifecycle visits ${phase}`);
  if(reuseHint){contact?.reset();resetHint=contact?.legPoseHint;}
  return {metrics,observedHint,roundTrip,resetHint};
 }finally{restoreInstrumentation();assembly.dispose();}
}
test('validated leg pose hints reduce real-GLB repair sweeps while preserving the complete contact lifecycle',async()=>{
 const warm=await replay({reuseHint:true}),reference=await replay({reuseHint:false});
 assert.equal(warm.metrics.hipBudgetBreaches,0,`warm absolute hip budget: ${JSON.stringify(warm.metrics)}`);
 assert.equal(reference.metrics.hipBudgetBreaches,0,`reference absolute hip budget: ${JSON.stringify(reference.metrics)}`);
 assert.ok(warm.metrics.candidateSweeps<reference.metrics.candidateSweeps,`warm run should reduce full collision candidate sweeps: warm=${JSON.stringify(warm.metrics)}, no-hint=${JSON.stringify(reference.metrics)}`);
 assert.ok(warm.metrics.maxCandidatesPerUpdate<=reference.metrics.maxCandidatesPerUpdate+1,`a rejected parameter hint may add only its one full-sweep validation before the unchanged search: warm=${JSON.stringify(warm.metrics)}, no-hint=${JSON.stringify(reference.metrics)}`);
 assert.ok(warm.observedHint,'the real collision repair stores validated hip offsets and pole elevations');
 assert.ok(warm.roundTrip,'internal and safe-pose rollback retain the validated hint');
 assert.equal(warm.resetHint,null,'contact reset clears the hint');
});
