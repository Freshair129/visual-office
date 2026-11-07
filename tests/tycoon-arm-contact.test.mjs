import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {TycoonArmContact} from '../web/tycoon-arm-contact.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {createTycoonNavigation,tycoonGround,tycoonWorld} from '../web/tycoon-blueprint.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {TycoonScene} from '../web/tycoon-scene.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {measureSeatContact} from '../web/tycoon-seat-contact.js';

async function load(path){
  const bytes=await readFile(path);
  return parse(bytes);
}
async function parse(bytes){return GLTFLoader.prototype.parseAsync.call(new GLTFLoader(),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}

function skinnedTriangles(mesh){
  mesh.skeleton.update();const geometry=mesh.geometry,index=geometry.index,count=index?.count||geometry.attributes.position.count,vertices=new Array(geometry.attributes.position.count),point=new THREE.Vector3();
  for(let i=0;i<vertices.length;i++){mesh.getVertexPosition(i,point);vertices[i]=mesh.localToWorld(point).clone();}
  const triangles=[];
  for(let i=0;i+2<count;i+=3){
    const triangle=new THREE.Triangle(vertices[index?.getX(i)??i],vertices[index?.getX(i+1)??i+1],vertices[index?.getX(i+2)??i+2]),normal=triangle.getNormal(new THREE.Vector3());
    if(normal.lengthSq()>1e-10)triangles.push({triangle,normal});
  }
  return triangles;
}

function skinnedSelfClearance(mesh,bodyTriangles){
  mesh.skeleton.update();const geometry=mesh.geometry,point=new THREE.Vector3(),closest=new THREE.Vector3();let maximumPenetration=0,minimumSurfaceDistance=Infinity;
  for(let i=0;i<geometry.attributes.position.count;i++){
    mesh.getVertexPosition(i,point);mesh.localToWorld(point);let nearestDistanceSq=Infinity,nearestNormal=null,nearestPoint=null;
    for(const {triangle,normal} of bodyTriangles){
      triangle.closestPointToPoint(point,closest);const distanceSq=point.distanceToSquared(closest);
      if(distanceSq<nearestDistanceSq){nearestDistanceSq=distanceSq;nearestNormal=normal;nearestPoint=closest.clone();}
    }
    if(nearestNormal){minimumSurfaceDistance=Math.min(minimumSurfaceDistance,Math.sqrt(nearestDistanceSq));const signedDistance=point.clone().sub(nearestPoint).dot(nearestNormal);maximumPenetration=Math.max(maximumPenetration,-signedDistance);}
  }
  return {maximumPenetrationM:maximumPenetration,minimumSurfaceDistanceM:minimumSurfaceDistance};
}

async function seatedWorkScene({chairScale=1,deskZ=null}={}){
  const room=createTycoonRoom('projects'),deskData=room.objects.find(item=>item.id==='desk-1'),chairData=room.objects.find(item=>item.id==='chair-1');
  deskData.z=Number.isFinite(deskZ)?deskZ:chairData.z+1.2;
  chairData.scale=chairScale;
  const activity=new TycoonActivity(room),station=activity.nav.stations.find(item=>item.id==='station:desk-1');
  assert.ok(station, 'default Projects desk station exists');
  const [actorGltf,deskGltf,chairGltf]=await Promise.all([
    load('web/assets/models/tycoon-factory/actor-rig-v3.glb'),
    load('web/assets/models/tycoon-factory/desk-v3.glb'),
    load('web/assets/models/tycoon/chair.glb'),
  ]);
  const actor=actorGltf.scene;
  actor.userData={instanceId:'demo-agent',clips:actorGltf.animations,mixer:new THREE.AnimationMixer(actor)};
  const desk=deskGltf.scene;
  desk.userData.instanceId=deskData.id;
  desk.position.set(deskData.x,deskData.y,deskData.z);
  desk.rotation.y=deskData.rotation;
  desk.scale.setScalar(deskData.scale);
  const chair=chairGltf.scene;
  chair.userData.instanceId=chairData.id;
  chair.position.set(chairData.x,chairData.y,chairData.z);
  chair.rotation.y=chairData.rotation;
  chair.scale.setScalar(chairData.scale);
  const scene={ready:true,assembly:{owned:[actor,desk,chair]},activity,collisionWorld:new TycoonCollisionWorld([desk,chair]),play:TycoonScene.prototype.play,onStatus(){}};
  const admission=TycoonScene.prototype.startStation.call(scene,station.id);
  assert.equal(admission.ok,true,JSON.stringify(admission));
  return {actor,activity,desk,scene,station};
}

for(const hz of [30,60])test(`working hands rest on the measured desk-v3 top without arm collision at ${hz} Hz`,async()=>{
  const {actor,activity,desk,scene}=await seatedWorkScene();
  const probe=actor.userData.contact,applyWorking=probe.armContact.applyWorking.bind(probe.armContact);
  probe.armContact.applyWorking=(...args)=>{
    assert.ok(Math.abs(probe.pelvis-activity.station.seatHeight)<.001,`desktop IK ran before the current frame reached its seated pelvis height (${probe.pelvis} vs ${activity.station.seatHeight})`);
    return applyWorking(...args);
  };
  let diagnostics=null,contact=null,contactFrames=0;const trace=[];
  for(let i=0;i<hz*30;i++){
    TycoonScene.prototype.updateProbe.call(scene,actor,1/hz);
    diagnostics=actor.userData.limbCollisionDiagnostics;
    if(activity.phase==='working'&&diagnostics?.armContact){
      const current=diagnostics.armContact;
      if(contactFrames>0)assert.equal(current.status,'contact',`contact was lost during work: ${JSON.stringify(current)}`);
      if(current.status==='contact'){contact=current;contactFrames++;}
      else if(i%(Math.max(1,Math.round(hz/4)))===0)trace.push({elapsed:activity.elapsed,status:current.status,error:current.handTargetErrorM?.max,lean:current.torsoLeanRad,reason:current.reason});
    }
    if(contactFrames>=hz)break;
    assert.notEqual(activity.phase,'blocked',JSON.stringify(diagnostics));
  }
  assert.ok(contact,`upper-limb diagnostics are present: ${JSON.stringify({diagnostics,trace})}`);
  assert.ok(contactFrames>=hz,`stable support lasts at least one second (${contactFrames}/${hz} frames)`);
  assert.equal(contact.status,'contact',JSON.stringify({contact,trace}));
  assert.equal(contact.ok,true,JSON.stringify(contact));
  assert.equal(contact.targetMode,'desktop-top-support');
  assert.ok(contact.handTargetErrorM.max<=.005,JSON.stringify(contact.handTargetErrorM));
  assert.equal(contact.collisionHit,null,JSON.stringify(contact.collisionHit));
  const frame=scene.collisionWorld.topSurfaceFrame('desk-1');
  for(const side of ['left','right']){
    const surface=contact.contacts[side].surfacePoint,palm=contact.contacts[side].palmCenter;
    assert.equal(contact.contacts[side].surfaceMesh,frame.meshName);
    assert.ok(Math.abs(surface[1]-frame.planeY)<.00001,`${side} support height: ${surface}`);
    assert.ok(Math.abs(surface[0]-frame.center.x)<.7,`${side} support lies on desktop: ${surface}`);
    assert.ok(Math.abs(surface[2]-frame.center.z)<.4,`${side} support lies on desktop: ${surface}`);
    assert.ok(Math.abs(palm[1]-.785)<.01,`${side} palm height: ${palm}`);
  }
  assert.ok(contact.contacts.left.surfacePoint[0]<frame.center.x);
  assert.ok(contact.contacts.right.surfacePoint[0]>frame.center.x);
  for(const side of ['left','right']){
    const reach=contact.armReachRangesM[side],lengths=contact.armBoneLengthErrorM[side];
    assert.ok(reach.requiredM<=reach.maxM+.005,`${side} target outside measured range: ${JSON.stringify(reach)}`);
    assert.ok(lengths.upperM<.0001&&lengths.forearmM<.0001,`${side} arm bones changed length: ${JSON.stringify(lengths)}`);
  }
  assert.ok(Math.abs(contact.torsoLeanRad)<=.85);
  assert.equal(actor.userData.limbCollisionDiagnostics.armContact.status,'contact');
  desk.updateMatrixWorld(true);
});

test('walking and turning arms keep skinned clearance during translation and turns at 30/60 Hz',async t=>{
  const armMeshesFor=actor=>['left','right'].flatMap(side=>[`office-${side}-elbow-joint`,`office-${side}-palm`].map(name=>actor.getObjectByName(name)));
  const checkpoints=new Set([1,2,3,5,10,15,20,30,60,90,120]),scenarios=[
    {name:'approaching-seat from rest',phases:['approaching-seat']},
    {name:'walking from rest',phases:['walking']},
    {name:'turning from rest',phases:['turning']},
    {name:'approach, walk, turn carry path',phases:['approaching-seat','walking','turning']},
  ];
  for(const hz of [30,60])for(const scenario of scenarios){
    const actor=(await load('web/assets/models/tycoon-factory/actor-rig-v3.glb')).scene,controller=new TycoonArmContact(actor),bodyMeshes=['office-shirt','office-pelvis'].map(name=>actor.getObjectByName(name)),armMeshes=armMeshesFor(actor);
    actor.updateMatrixWorld(true);const restBodyTriangles=bodyMeshes.flatMap(skinnedTriangles),restClearance=new Map(armMeshes.map(mesh=>[mesh.name,skinnedSelfClearance(mesh,restBodyTriangles)]));
    if(scenario===scenarios[0])t.diagnostic(`${hz} Hz bind-pose baseline geometry overlap: ${JSON.stringify(Object.fromEntries([...restClearance].map(([name,value])=>[name,{maximumPenetrationM:value.maximumPenetrationM,minimumSurfaceDistanceM:value.minimumSurfaceDistanceM}])))}`);
    const checkClearance=(phase,frame)=>{
      actor.updateMatrixWorld(true);const bodyTriangles=bodyMeshes.flatMap(skinnedTriangles);
      for(const mesh of armMeshes){
        const clearance=skinnedSelfClearance(mesh,bodyTriangles),baseline=restClearance.get(mesh.name);
        assert.ok(clearance.maximumPenetrationM<=baseline.maximumPenetrationM+.002,`${scenario.name} ${phase} ${hz} Hz frame ${frame} ${mesh.name} exceeds bind-pose baseline geometry overlap by ${(clearance.maximumPenetrationM-baseline.maximumPenetrationM).toFixed(4)}m (current ${clearance.maximumPenetrationM.toFixed(4)}m; baseline ${baseline.maximumPenetrationM.toFixed(4)}m)`);
        if(baseline.maximumPenetrationM<=.002)assert.ok(clearance.minimumSurfaceDistanceM>.002,`${scenario.name} ${phase} ${hz} Hz frame ${frame} ${mesh.name} nearly touches torso/pelvis (${clearance.minimumSurfaceDistanceM.toFixed(4)}m)`);
      }
    };
    for(const phase of scenario.phases)for(let frame=0;frame<120;frame++){
      const dt=1/hz;actor.position.add(new THREE.Vector3(0,0,.85*dt).applyQuaternion(actor.quaternion));
      if(phase==='turning')actor.rotation.y+=.8*dt;
      actor.updateMatrixWorld(true);controller.applyLap(phase,dt,.48,'chair',null,null);
      if(checkpoints.has(frame+1))checkClearance(phase,frame+1);
    }
  }
});

test('safe-pose rollback restores rejected transit stage and actor-frame target state',async()=>{
  const actor=(await load('web/assets/models/tycoon-factory/actor-rig-v3.glb')).scene,contact=new ProbeContact(actor);
  assert.equal(contact.valid,true);
  const arm=contact.armContact,restPosition=actor.position.clone(),restArms=arm.capturePose();
  contact.rememberSafePose(contact.limbCapsules());
  actor.position.z+=.85/60;actor.updateMatrixWorld(true);
  assert.equal(arm.applyLap('approaching-seat',1/60,.48,'chair',null,null).ok,true);
  assert.equal(arm.lapStage,1,'accepted lateral hold advances to forward transit');
  actor.position.z+=.85/60;actor.rotation.y+=.8/60;actor.updateMatrixWorld(true);
  assert.equal(arm.applyLap('approaching-seat',1/60,.48,'chair',null,null).ok,true);
  assert.ok(arm.targetRootPosition&&arm.targetRootRotation,'moving transit target records its actor frame');
  assert.ok(contact.restoreSafePose(),'saved safe pose restores');
  assert.equal(arm.lapStage,0,'a rejected transit attempt cannot retain its later stage');
  assert.equal(arm.phase,null);
  assert.equal(arm.currentTargets,null);
  assert.equal(arm.targetRootPosition,null);
  assert.equal(arm.targetRootRotation,null);
  assert.ok(actor.position.distanceTo(restPosition)<1e-8);
  arm.arms.forEach((item,i)=>[item.shoulder,item.elbow,item.hand].forEach((bone,j)=>assert.ok(bone.quaternion.angleTo(restArms.arms[i][j])<1e-6,`${item.side} bone ${j} returns to safe pose`)));
});

test('static initial spawn reaches computed tucked transit readiness after plant sweeps',async()=>{
  const room=createTycoonRoom('projects'),navigation=createTycoonNavigation(room),spawn=tycoonWorld(navigation.spawnPoint),plantData=room.objects.find(item=>item.id==='plant-left');
  const [actorGltf,plantGltf]=await Promise.all([load('web/assets/models/tycoon-factory/actor-rig-v3.glb'),load('web/assets/models/tycoon/plant.glb')]);
  const actor=actorGltf.scene,plant=plantGltf.scene;plant.userData.instanceId=plantData.id;plant.position.set(plantData.x,plantData.y,plantData.z);plant.rotation.y=plantData.rotation;plant.scale.setScalar(plantData.scale);const world=new TycoonCollisionWorld([plant]),contact=new ProbeContact(actor,world);
  actor.position.set(spawn.x,0,spawn.z);actor.updateMatrixWorld(true);
  let observedWideStage=false,readyFrame=null;
  for(let frame=0;frame<240;frame++){
    const result=contact.update({heading:0,seatHeight:.4792452947742871},'approaching-seat',1/30,{});
    assert.equal(result.ok,true,JSON.stringify(result.collision));
    assert.equal(result.collision.ok,true,JSON.stringify(result.collision));
    if(contact.armContact.lapStage===2&&!contact.armContact.transitTargetReached){observedWideStage=true;assert.equal(contact.transitReady,false,'lapStage 2 alone does not unlock walking');}
    if(contact.transitReady){readyFrame=frame+1;break;}
  }
  assert.ok(observedWideStage,'the held-wide forward stage was observed before tuck');
  assert.ok(readyFrame!==null,'tucked palms become ready only after a clear full-world sweep');
  assert.equal(contact.armContact.transitTargetReached,true);
  assert.equal(contact.lastCollision.ok,true);
  assert.ok(contact.lastCollision.checkedCapsules>0,'readiness followed a swept capsule set');
  assert.equal(contact.lastCollision.hit,null);
  assert.ok(readyFrame>1,`readiness came from staged movement, frame ${readyFrame}`);
  const validatedRoot=actor.position.clone();contact.rememberSafePose(contact.limbCapsules());contact.transitReady=false;contact.armContact.transitTargetReached=false;contact.armContact.lapStage=1;actor.position.x+=.25;actor.updateMatrixWorld(true);
  assert.ok(contact.restoreSafePose(),'validated safe pose restores after a rejected attempt');
  assert.equal(contact.transitReady,true,'safe-pose rollback restores the last validated transit readiness');
  assert.equal(contact.armContact.transitTargetReached,true);
  assert.equal(contact.armContact.lapStage,2);
  assert.ok(actor.position.distanceTo(validatedRoot)<1e-8);
});

test('a collision world loaded after the probe is rebound before transit can unlock',async()=>{
  const room=createTycoonRoom('projects'),navigation=createTycoonNavigation(room),spawn=tycoonWorld(navigation.spawnPoint),plantData=room.objects.find(item=>item.id==='plant-left');
  const [actorGltf,plantGltf]=await Promise.all([load('web/assets/models/tycoon-factory/actor-rig-v3.glb'),load('web/assets/models/tycoon/plant.glb')]);
  const actor=actorGltf.scene,plant=plantGltf.scene;plant.userData.instanceId=plantData.id;plant.position.set(plantData.x,plantData.y,plantData.z);plant.rotation.y=plantData.rotation;plant.scale.setScalar(plantData.scale);
  actor.position.set(spawn.x,0,spawn.z);const contact=new ProbeContact(actor,null);
  for(let frame=0;frame<3;frame++){
    const result=contact.update({heading:0,seatHeight:.4792452947742871},'approaching-seat',1/30,{});
    assert.equal(result.ok,true,JSON.stringify(result.collision));
    assert.equal(contact.transitReady,false,'a pre-world pose cannot certify collision-checked transit');
  }
  assert.ok(contact.safePose,'the partial-load tick created a provisional safe pose');
  assert.ok(contact.armContact.currentTargets,'the partial-load tick created arm targets');
  const world=new TycoonCollisionWorld([plant]);
  assert.equal(contact.bindCollisionWorld(world),true);
  assert.equal(contact.collisionWorld,world);
  assert.equal(contact.armContact.collisionWorld,world);
  assert.equal(contact.safePose,null,'a pose validated without the final world is discarded');
  assert.equal(contact.started,false,'feet are reinitialized from the authored pose');
  assert.equal(contact.transitReady,false);
  assert.equal(contact.armContact.transitTargetReached,false);
  assert.equal(contact.armContact.lapStage,0);
  assert.equal(contact.armContact.currentTargets,null);
  assert.equal(contact.armContact.targetRootPosition,null);
  assert.equal(contact.armContact.targetRootRotation,null);

  let readyFrame=null;
  for(let frame=0;frame<240;frame++){
    const result=contact.update({heading:0,seatHeight:.4792452947742871},'approaching-seat',1/30,{});
    assert.equal(result.ok,true,JSON.stringify(result.collision));
    assert.equal(result.collision.ok,true,JSON.stringify(result.collision));
    if(contact.transitReady){readyFrame=frame+1;break;}
  }
  assert.ok(readyFrame!==null,'the rebound controller can earn readiness from full-world sweeps');
  assert.ok(contact.lastCollision.checkedCapsules>0);
  assert.equal(contact.lastCollision.hit,null);
});

test('palm collision capsules enclose every skinned palm vertex',async()=>{
  const {actor,activity,scene}=await seatedWorkScene();
  TycoonScene.prototype.updateProbe.call(scene,actor,1/30);
  const controller=actor.userData.contact.armContact;
  for(const arm of controller.arms){
    actor.updateMatrixWorld(true);arm.palm.mesh.skeleton.update();
    const inverse=arm.hand.matrixWorld.clone().invert(),point=new THREE.Vector3();let furthest=0;
    for(let i=0;i<arm.palm.mesh.geometry.attributes.position.count;i++){
      arm.palm.mesh.getVertexPosition(i,point);arm.palm.mesh.localToWorld(point);point.applyMatrix4(inverse);
      const direction=arm.palm.collisionEnd.clone().sub(arm.palm.collisionStart),t=THREE.MathUtils.clamp(point.clone().sub(arm.palm.collisionStart).dot(direction)/direction.lengthSq(),0,1),nearest=arm.palm.collisionStart.clone().addScaledVector(direction,t);
      furthest=Math.max(furthest,point.distanceTo(nearest));
    }
    assert.ok(arm.palm.radius>=furthest-1e-6,`${arm.side} palm capsule misses vertex by ${furthest-arm.palm.radius} m`);
  }
  activity.stop();
});

test('shoulder and localized forearm proxies enclose every skinned joint triangle',async()=>{
  const {actor,activity,scene}=await seatedWorkScene();
  TycoonScene.prototype.updateProbe.call(scene,actor,1/30);
  const controller=actor.userData.contact.armContact;
  const distance=(point,capsule)=>{const axis=capsule.end.clone().sub(capsule.start),t=THREE.MathUtils.clamp(point.clone().sub(capsule.start).dot(axis)/Math.max(axis.lengthSq(),1e-12),0,1);return point.distanceTo(capsule.start.clone().addScaledVector(axis,t));};
  for(const side of ['left','right']){
    actor.updateMatrixWorld(true);
    const capsules=controller.capsules(),upper=capsules.find(item=>item.name===`${side}-upper-arm`),shaft=capsules.find(item=>item.name===`${side}-forearm`),bulge=capsules.find(item=>item.name===`${side}-forearm-bulge`);
    const shoulder=actor.getObjectByName(`office-${side}-shoulder-joint`),elbow=actor.getObjectByName(`office-${side}-elbow-joint`);
    for(const [mesh,proxies,label] of [[shoulder,[upper],`${side} shoulder`],[elbow,[shaft,bulge],`${side} elbow`]]){
      mesh.skeleton.update();const positions=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?.count||positions.count,point=new THREE.Vector3(),triangles=[];
      for(let i=0;i+2<count;i+=3){const ids=[index?.getX(i)??i,index?.getX(i+1)??i+1,index?.getX(i+2)??i+2],vertices=ids.map(id=>{mesh.getVertexPosition(id,point);return mesh.localToWorld(point).clone();});triangles.push(vertices);}
      for(const vertices of triangles){
        const enclosedByOneProxy=proxies.some(proxy=>vertices.every(vertex=>distance(vertex,proxy)<=proxy.radius+1e-6));
        assert.ok(enclosedByOneProxy,`${label} triangle escapes every convex proxy`);
      }
    }
  }
  activity.stop();
});

test('stopping and restarting a desk probe restores the authored torso and arm pose',async()=>{
  const {actor,activity,scene}=await seatedWorkScene(),dt=1/30;
  let reached=false;
  for(let i=0;i<900;i++){
    TycoonScene.prototype.updateProbe.call(scene,actor,dt);
    if(activity.phase==='working'&&actor.userData.limbCollisionDiagnostics?.armContact?.status==='contact'){reached=true;break;}
    assert.notEqual(activity.phase,'blocked',JSON.stringify(actor.userData.limbCollisionDiagnostics));
  }
  assert.ok(reached,'first lifecycle reaches measured desktop support');
  const controller=actor.userData.contact.armContact,torso=controller.restTorso.clone(),arms=controller.arms.map(arm=>arm.rest.map(q=>q.clone()));
  activity.stop();TycoonScene.prototype.updateProbe.call(scene,actor,dt);
  assert.ok(controller.torso.quaternion.angleTo(torso)<1e-6,'stop restores the authored torso rotation');
  controller.arms.forEach((arm,i)=>[arm.shoulder,arm.elbow,arm.hand].forEach((bone,j)=>assert.ok(bone.quaternion.angleTo(arms[i][j])<1e-6,`${arm.side} arm bone ${j} was left posed`)));
  assert.equal(controller.lastDiagnostic.status,'inactive');
  assert.equal(controller.lapStage,0,'stop clears transit progress');
  assert.equal(controller.currentTargets,null,'stop clears absolute hand targets');
  assert.equal(controller.targetRootPosition,null,'stop clears the previous actor position');
  assert.equal(controller.targetRootRotation,null,'stop clears the previous actor rotation');
  assert.equal(TycoonScene.prototype.startStation.call(scene,'station:desk-1').ok,true);
  for(let i=0;i<30;i++)TycoonScene.prototype.updateProbe.call(scene,actor,dt);
  assert.notEqual(activity.phase,'blocked',JSON.stringify(actor.userData.limbCollisionDiagnostics));
  activity.stop();TycoonScene.prototype.updateProbe.call(scene,actor,dt);
  assert.ok(controller.torso.quaternion.angleTo(torso)<1e-6,'a second stop restores the authored torso rotation');
});

test('bundled sofa with measured seat height fails safely when the lap approach intersects its front',async()=>{
  const room={schemaVersion:'office-tycoon/v1',width:16,depth:10,objects:[]};
  const spawn=tycoonWorld(createTycoonNavigation(room).spawnPoint),object={id:'rest-sofa',kind:'sofa',x:spawn.x,y:0,z:spawn.z-.975,rotation:0,scale:1};room.objects.push(object);
  room.navigation={stations:[{objectId:object.id,approach:tycoonGround({x:spawn.x,z:spawn.z+.25})}]};
  const activity=new TycoonActivity(room),station=activity.nav.stations.find(item=>item.objectId===object.id);
  assert.ok(station,JSON.stringify(activity.nav.issues));
  const [actorGltf,sofaGltf]=await Promise.all([load('web/assets/models/tycoon-factory/actor-rig-v3.glb'),load('web/assets/models/tycoon/sofa.glb')]),actor=actorGltf.scene,sofa=sofaGltf.scene;
  actor.userData={instanceId:'demo-agent',clips:actorGltf.animations,mixer:new THREE.AnimationMixer(actor)};sofa.userData.instanceId=object.id;sofa.position.set(object.x,object.y,object.z);sofa.rotation.y=object.rotation;
  const scene={ready:true,assembly:{owned:[actor,sofa]},activity,collisionWorld:new TycoonCollisionWorld([sofa]),play:TycoonScene.prototype.play,onStatus(){}};
  assert.equal(TycoonScene.prototype.startStation.call(scene,station.id).ok,true);
  assert.ok(Math.abs(station.seatHeight-.475)<.001,`measured sofa seat ${station.seatHeight}`);
  for(let i=0;i<300&&activity.phase!=='blocked'&&activity.phase!=='done';i++)TycoonScene.prototype.updateProbe.call(scene,actor,1/30);
  const diagnostic=actor.userData.limbCollisionDiagnostics;
  assert.equal(activity.phase,'blocked',JSON.stringify(diagnostic));
  assert.equal(diagnostic.hit.objectId,object.id);
  assert.match(diagnostic.hit.limb,/palm|forearm/);
  assert.notEqual(diagnostic.armContact?.targetMode,'desktop-top-support');
  assert.ok(diagnostic.stepBackoffM>0);
});

const externalSeats=JSON.parse(await readFile('tests/fixtures/external-chairs/fixtures.json','utf8'));
const restChairFixture=externalSeats.fixtures.find(fixture=>fixture.id==='kenney-chair-four-leg');
for(const hz of [30,60])test(`standalone external seat uses lap clearance and completes its lifecycle at ${hz} Hz`,async()=>{
  const room={schemaVersion:'office-tycoon/v1',width:16,depth:10,objects:[]};
  const spawn=tycoonWorld(createTycoonNavigation(room).spawnPoint),object={id:'rest-custom-chair',kind:'custom',x:spawn.x,y:0,z:spawn.z-1,rotation:Math.PI,scale:.9,asset:{id:restChairFixture.provenance.glb.sha256,name:restChairFixture.name,category:'chair',size:restChairFixture.measured.gltfSize,sourceSize:restChairFixture.measured.gltfSize,origin:[0,0,0],interaction:{...restChairFixture.interaction}}};room.objects.push(object);
  const activity=new TycoonActivity(room),station=activity.nav.stations.find(item=>item.objectId===object.id);
  assert.ok(station,JSON.stringify(activity.nav.issues));
  const [actorGltf,seatGltf]=await Promise.all([load('web/assets/models/tycoon-factory/actor-rig-v3.glb'),load(`tests/fixtures/external-chairs/${restChairFixture.file}`)]),actor=actorGltf.scene,seat=seatGltf.scene;
  actor.userData={instanceId:'demo-agent',clips:actorGltf.animations,mixer:new THREE.AnimationMixer(actor)};seat.userData.instanceId=object.id;seat.position.set(object.x,object.y,object.z);seat.rotation.y=object.rotation;seat.scale.setScalar(object.scale);
  const scene={ready:true,assembly:{owned:[actor,seat]},activity,collisionWorld:new TycoonCollisionWorld([seat]),play:TycoonScene.prototype.play,onStatus(){}};
  assert.equal(TycoonScene.prototype.startStation.call(scene,station.id).ok,true);
  const seen=new Set();let settled=0,workingFrames=0;
  for(let i=0;i<Math.ceil(hz*30);i++){
    TycoonScene.prototype.updateProbe.call(scene,actor,1/hz);seen.add(activity.phase);
    const diagnostic=actor.userData.limbCollisionDiagnostics;
    assert.ok(diagnostic?.ok!==false,JSON.stringify(diagnostic));
    if(activity.phase==='working'){
      workingFrames++;const arm=diagnostic.armContact;
      assert.equal(arm?.targetMode,'lap-clearance',JSON.stringify(arm));
      assert.equal(arm?.status,'clearance-only',JSON.stringify(arm));
      assert.equal(activity.snapshot.clip,'sitting');assert.equal(activity.snapshot.status,'กำลังนั่งพัก');
      assert.ok(diagnostic.seatSupport?.ok,JSON.stringify(diagnostic.seatSupport));
      assert.ok(Math.abs(diagnostic.seatSupport.verticalGapM)<=.003,JSON.stringify(diagnostic.seatSupport));
    }
    if(activity.phase==='done'&&++settled>Math.ceil(hz*2))break;
    assert.notEqual(activity.phase,'blocked',JSON.stringify(diagnostic));
  }
  for(const phase of ['walking','turning','entering','sit','working','standing','leaving','done'])assert.ok(seen.has(phase),`missing ${phase}: ${activity.phase}`);
  assert.ok(workingFrames>=hz,`lap pose held for at least one second (${workingFrames}/${hz})`);
  assert.ok(settled>Math.ceil(hz*2),`completed and settled (${settled})`);
});
