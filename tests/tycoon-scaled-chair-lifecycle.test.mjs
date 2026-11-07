import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {createTycoonNavigation,tycoonGround,tycoonWorld} from '../web/tycoon-blueprint.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';

const parse=async bytes=>GLTFLoader.prototype.parseAsync.call(new GLTFLoader(),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const catalog=JSON.parse(await readFile('tests/fixtures/external-chairs/fixtures.json','utf8'));
const externalCases=catalog.fixtures.map(fixture=>({name:`${fixture.id}-1.1`,scale:1.1,fixture}));
const lifecycleCases=[...externalCases,{name:'bundled-0.75',scale:.75},{name:'bundled-1.25',scale:1.25}];

async function createCase(spec){
 const room=createTycoonRoom('projects'),chairData=room.objects.find(object=>object.id==='chair-1'),deskData=room.objects.find(object=>object.id==='desk-1');
 chairData.scale=spec.scale;
 let chairBytes;
 if(spec.fixture){
  const fixture=spec.fixture,heading=chairData.rotation+Math.PI;
  chairData.kind='custom';
  chairData.asset={id:fixture.provenance.glb.sha256,name:fixture.name,category:'chair',size:fixture.measured.gltfSize,sourceSize:fixture.measured.gltfSize,origin:[0,0,0],interaction:structuredClone(fixture.interaction)};
  chairData.rotation=heading-fixture.interaction.heading;
  chairBytes=await readFile(`tests/fixtures/external-chairs/${fixture.file}`);
 }else chairBytes=await readFile('web/assets/models/tycoon/chair.glb');
 const [actorBytes,deskBytes]=await Promise.all([
  readFile('web/assets/models/tycoon-factory/actor-rig-v3.glb'),
  readFile('web/assets/models/tycoon-factory/desk-v3.glb')
 ]);
 const [actorGltf,chairGltf,deskGltf]=await Promise.all([parse(actorBytes),parse(chairBytes),parse(deskBytes)]);
 const actor=actorGltf.scene,chair=chairGltf.scene,desk=deskGltf.scene;
 actor.userData={instanceId:'demo-agent',clips:actorGltf.animations,mixer:new THREE.AnimationMixer(actor)};
 for(const [model,data] of [[chair,chairData],[desk,deskData]]){
  model.userData.instanceId=data.id;model.position.set(data.x,data.y,data.z);model.rotation.y=data.rotation;model.scale.setScalar(data.scale);
 }
 const activity=new TycoonActivity(room),scene={ready:true,assembly:{owned:[actor,chair,desk]},activity,collisionWorld:new TycoonCollisionWorld([chair,desk]),play:TycoonScene.prototype.play,onStatus(){}};
 return {actor,activity,scene,chair,desk,room};
}

function shoeSamples(actor){
 actor.updateMatrixWorld(true);
 return ['left','right'].map(side=>{
  const mesh=actor.getObjectByName(`office-${side}-shoe`);mesh.skeleton.update();let bottom=Infinity;const center=new THREE.Vector3();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){const point=mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3()));bottom=Math.min(bottom,point.y);center.add(point);}
  return {bottom,center:center.multiplyScalar(1/mesh.geometry.attributes.position.count)};
 });
}

function palmGaps(actor,arm){
 const gaps=[];
 for(const side of ['left','right']){
  const mesh=actor.getObjectByName(`office-${side}-palm`),support=arm.contacts?.[side];
  assert.ok(mesh?.isSkinnedMesh&&support?.surfacePoint&&support?.surfaceNormal,`missing measured ${side} palm support`);
  mesh.skeleton.update();const normal=new THREE.Vector3().fromArray(support.surfaceNormal),origin=new THREE.Vector3().fromArray(support.surfacePoint);
  let minimum=Infinity;
  for(let i=0;i<mesh.geometry.attributes.position.count;i++)minimum=Math.min(minimum,mesh.localToWorld(mesh.getVertexPosition(i,new THREE.Vector3())).sub(origin).dot(normal));
  gaps.push(minimum);
 }
 return gaps;
}

function maxArmLengthError(arm){
 return Math.max(...Object.values(arm.armBoneLengthErrorM||{}).flatMap(lengths=>Object.values(lengths)));
}

test('the 1.25 bundled chair admits a connected approach inside the existing foot-reach limit',()=>{
 const room=createTycoonRoom('projects');room.objects.find(object=>object.id==='chair-1').scale=1.25;
 const nav=createTycoonNavigation(room),station=nav.stations.find(item=>item.id==='station:desk-1');
 assert.ok(station,`scaled chair approach was not admitted: ${JSON.stringify(nav.issues)}`);
 assert.ok(nav.isWalkable(station.position),'selected approach is walkable');
 assert.ok(nav.findLocalPath(nav.spawnPoint,station.position).length>0,'selected approach connects to the spawn');
 assert.ok(nav.isSegmentWalkable(station.position,station.seatRoot,{ignoreIds:[station.seatObjectId]}),'chair entry segment stays clear');
 assert.ok(tycoonWorld(station.position).distanceTo(tycoonWorld(station.footAnchor))<=1.4,'selected approach stays within measured foot reach');
});

function assertGrounded(actor,phase,label){
 const shoes=shoeSamples(actor);
 for(const shoe of shoes){
  assert.ok(shoe.bottom>=-.003,`${label} ${phase}: shoe penetrated floor by ${-shoe.bottom}m`);
  if(['working','done'].includes(phase))assert.ok(Math.abs(shoe.bottom)<=.003,`${label} ${phase}: resting shoe gap ${shoe.bottom}m`);
 }
 return shoes;
}

async function runLifecycle(spec,hz,{stopAfterWorking=false}={}){
 const {actor,activity,scene}=await createCase(spec),label=`${spec.name} at ${hz} Hz`;
 const admitted=TycoonScene.prototype.startStation.call(scene,'station:desk-1');
 assert.equal(admitted.ok,true,`${label}: station admission failed; ${JSON.stringify({message:admitted.message,issues:activity.nav.issues})}`);
 const pelvisSupportOffset=actor.userData.contact?.pelvisSupportOffset;
 assert.ok(pelvisSupportOffset?.isVector3&&pelvisSupportOffset.toArray().every(Number.isFinite),`${label}: missing measured pelvis support offset`);
 const seen=new Set();let doneFrames=0,stopped=false,workingFrames=0,workingAnkles=null;
 for(let frame=0,phaseBeforeUpdate=activity.phase;frame<hz*90;frame++){
  TycoonScene.prototype.updateProbe.call(scene,actor,1/hz);
  const phase=activity.phase;seen.add(phase);
  const diagnostics=actor.userData.limbCollisionDiagnostics;
  const collision=actor.userData.contact?.lastCollision;
  const arm=diagnostics?.armContact;
  const armAttempt=collision?.armContactAttempt;
  assert.ok(diagnostics?.ok!==false,`${label}: blocked during ${phase}; ${JSON.stringify({phaseBeforeUpdate,reason:diagnostics?.reason,message:diagnostics?.message,seatSupport:diagnostics?.seatSupport,armContact:arm&&{phase:arm.phase,targetMode:arm.targetMode,approachStage:arm.approachStage,workElbowPoleAngles:arm.workElbowPoleAngles,workElbowPoleSearch:arm.workElbowPoleSearch,workElbowPoleClear:arm.workElbowPoleClear,workElbowPoleClearance:arm.workElbowPoleClearance,collisionHit:arm.collisionHit},armContactAttempt:armAttempt&&{phase:armAttempt.phase,targetMode:armAttempt.targetMode,workElbowPoleAngles:armAttempt.workElbowPoleAngles,workElbowPoleSearch:armAttempt.workElbowPoleSearch,workElbowPoleClear:armAttempt.workElbowPoleClear,workElbowPoleClearance:armAttempt.workElbowPoleClearance,collisionHit:armAttempt.collisionHit},collisionPhase:collision?.phase,hit:collision?.hit,clearanceM:collision?.minClearanceM,pairedHipOffsetM:collision?.pairedHipOffsetM,kneePoleTrials:collision?.kneePoleSearch?.length,bestKneePoleSearch:collision?.kneePoleSearch?.filter(item=>Number.isFinite(item.hit?.clearanceM)).sort((a,b)=>b.hit.clearanceM-a.hit.clearanceM).slice(0,5)})}`);
  const shoes=assertGrounded(actor,phase,label);
  if(phase==='working'){
   workingFrames++;
   const support=diagnostics?.seatSupport,arm=diagnostics?.armContact;
   assert.ok(support?.ok,`${label}: pelvis lost chair support; ${JSON.stringify(support)}`);
   assert.ok(Math.abs(support.verticalGapM)<=.003,`${label}: pelvis seat gap ${support.verticalGapM}m`);
   const hipOffsetM=diagnostics?.pairedHipOffsetM??diagnostics?.clearanceHipOffset?.distanceM;
   if(Number.isFinite(hipOffsetM))assert.ok(hipOffsetM<=.020,`${label}: seated hip correction exceeds 20 mm (${hipOffsetM})`);
   assert.equal(arm?.status,'contact',`${label}: working frame lacks palm contact; ${JSON.stringify(arm)}`);
   const gaps=palmGaps(actor,arm),minGap=Math.min(...gaps),maxGap=Math.max(...gaps);
   assert.ok(minGap>=-.001,`${label}: palm penetrated support by ${-minGap}m`);
   assert.ok(maxGap<=.005,`${label}: palm support gap ${maxGap}m`);
   assert.ok(maxArmLengthError(arm)<=.0001,`${label}: arm bone length error ${maxArmLengthError(arm)}m`);
   assert.ok(shoes.every(shoe=>Math.abs(shoe.bottom)<=.003),`${label}: planted shoes were not grounded`);
   const anklePoints=actor.userData.contact.legs.map(leg=>leg.point.clone());
   if(!workingAnkles)workingAnkles=anklePoints;else for(let i=0;i<anklePoints.length;i++)assert.ok(anklePoints[i].distanceTo(workingAnkles[i])<1e-8,`${label}: seated correction moved the ${actor.userData.contact.legs[i].side} ankle anchor`);
   if(stopAfterWorking&&!stopped){
    activity.stop();
    TycoonScene.prototype.updateProbe.call(scene,actor,1/hz);
    assert.equal(actor.userData.contact?.safePose,null,'Stop cleared the previous validated pose');
    const restarted=TycoonScene.prototype.startStation.call(scene,'station:desk-1');
    assert.equal(restarted.ok,true,`${label}: restart admission failed`);
    seen.clear();workingFrames=0;stopped=true;
   }
  }
  if(phase==='done'){
   doneFrames++;
   assert.ok(shoes.every(shoe=>Math.abs(shoe.bottom)<=.003),`${label}: terminal shoe gap`);
   if(doneFrames>hz*2)break;
  }
  assert.notEqual(phase,'blocked',`${label}: blocked lifecycle`);
  phaseBeforeUpdate=phase;
 }
 for(const phase of ['walking','turning','approaching-seat','entering','sit','working','standing','leaving','settling','done'])assert.ok(seen.has(phase),`${label}: missing ${phase}; stopped at ${activity.phase}`);
 assert.ok(workingFrames>=hz,`${label}: only ${workingFrames} contact frames`);
 assert.ok(doneFrames>hz*2,`${label}: did not remain grounded in done for more than two seconds`);
 if(stopAfterWorking)assert.equal(stopped,true,'Stop/restart path ran after measured working contact');
}

for(const spec of lifecycleCases)for(const hz of [30,60])test(`actual chair GLB ${spec.name} completes seated work, departure and grounded completion at ${hz} Hz`,async()=>runLifecycle(spec,hz));

for(const hz of [30,60])test(`scaled bundled chair clears its pose state across Stop and station restart at ${hz} Hz`,async()=>runLifecycle({name:'bundled-0.75-restart',scale:.75},hz,{stopAfterWorking:true}));
