import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene} from '../web/tycoon-scene.js';import {TycoonActivity} from '../web/tycoon-activity.js';
import {createTycoonRoom} from '../web/tycoon-state.js';import {createTycoonNavigation,tycoonGround,tycoonWorld,TYCOON_BUNDLED_CHAIR_SEAT_HEIGHT_M} from '../web/tycoon-blueprint.js';
async function setup(){const b=await readFile('web/assets/models/tycoon-factory/actor-rig-v3.glb'),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');const actor=g.scene;actor.userData={clips:g.animations,mixer:new THREE.AnimationMixer(actor)};const room={schemaVersion:'office-tycoon/v1',width:16,depth:10,objects:[]};const a=new TycoonActivity(room);return {actor,a,scene:{activity:a,play:TycoonScene.prototype.play}};}
function points(actor,name){const m=actor.getObjectByName(name);m.skeleton.update();const ps=[];for(let i=0;i<m.geometry.attributes.position.count;i++){const p=m.getVertexPosition(i,new THREE.Vector3());ps.push(m.localToWorld(p));}return ps;}
function sample(actor){actor.updateMatrixWorld(true);return ['left','right'].map(side=>{const p=points(actor,`office-${side}-shoe`);return {bottom:Math.min(...p.map(v=>v.y)),center:p.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/p.length)};});}
function frame(s,dt){TycoonScene.prototype.updateProbe.call(s.scene,s.actor,dt);return sample(s.actor);}
for(const hz of [30,60])test(`world plants remain grounded through turns and settled endpoint at ${hz} Hz`,async()=>{const s=await setup();assert.ok(s.a.startRoute([{x:-1,z:-1},{x:1,z:-1},{x:1,z:1},{x:-1,z:1}].map(tycoonGround)).ok);let previous,done=0,planted=0;for(let i=0;i<20*hz;i++){const f=frame(s,1/hz);for(let j=0;j<2;j++){assert.ok(f[j].bottom>=-.003,`penetration ${f[j].bottom}`);if(previous&&f[j].bottom<.001&&previous[j].bottom<.001){planted++;assert.ok(f[j].center.distanceTo(previous[j].center)<.004,"plant moved "+f[j].center.distanceTo(previous[j].center)+" bottoms "+f[j].bottom+"/"+previous[j].bottom);}}if(s.a.phase==='done')done++;if(done>hz*2){assert.ok(f.every(x=>Math.abs(x.bottom)<.003));break;}previous=f;}assert.ok(done>hz*2);assert.ok(planted>hz);});
for(const height of [.35,.55,.8])test(`full seating and standing at ${height} m keeps floor and pelvis contact`,async()=>{const s=await setup();s.a.snapshot={position:tycoonGround({x:0,z:0}),heading:1,clip:'idle'};s.a.station={seatHeight:height,seat:tycoonGround({x:0,z:0}),position:tycoonGround({x:0,z:1})};s.a.transition('sit','sit_down','sit');const seen=new Set();let done=0,working=0;for(let i=0;i<600;i++){const f=frame(s,1/30);seen.add(s.a.phase);assert.ok(f.every(x=>x.bottom>=-.003),`floor ${f.map(x=>x.bottom)}`);if(s.a.phase==='working'){working++;const bottom=Math.min(...points(s.actor,'office-pelvis').map(p=>p.y));assert.ok(Math.abs(bottom-height)<.005,`pelvis ${bottom}`);assert.ok(f.every(x=>Math.abs(x.bottom)<.003));}if(s.a.phase==='done'&&++done>60)break;}for(const p of ['sit','working','standing','leaving','done'])assert.ok(seen.has(p),p);assert.ok(working>60);assert.ok(done>60);});
import {measureSeatContact} from '../web/tycoon-seat-contact.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {ProbeContact} from '../web/tycoon-contact.js';
test('built-in chair station uses the measured Tycoon chair seat height',()=>{const station=createTycoonNavigation(createTycoonRoom('projects')).stations.find(item=>item.id==='station:desk-1');assert.equal(station.seatHeight,TYCOON_BUNDLED_CHAIR_SEAT_HEIGHT_M);});
for(const scale of [.75,1,1.25])test(`bundled chair surface measurement follows scale ${scale}`,async()=>{const b=await readFile('web/assets/models/tycoon/chair.glb'),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.scale.setScalar(scale);g.scene.rotation.y=.6;g.scene.position.set(1,0,-1);const expected=TYCOON_BUNDLED_CHAIR_SEAT_HEIGHT_M*scale,r=measureSeatContact(g.scene,{x:1,z:-1},expected);assert.ok(r.ok,r.message);assert.ok(Math.abs(r.height-expected)<.003);});
test('shoe collision capsules enclose every skinned shoe triangle',async()=>{
 const {actor}=await setup(),contact=new ProbeContact(actor),distance=(point,capsule)=>{const axis=capsule.b.clone().sub(capsule.a),t=THREE.MathUtils.clamp(point.clone().sub(capsule.a).dot(axis)/Math.max(axis.lengthSq(),1e-12),0,1);return point.distanceTo(capsule.a.clone().addScaledVector(axis,t));};
 actor.updateMatrixWorld(true);
 for(const leg of contact.legs){const mesh=actor.getObjectByName(`office-${leg.side}-shoe`),inverse=leg.ankle.matrixWorld.clone().invert(),index=mesh.geometry.index,positions=mesh.geometry.attributes.position,count=index?.count||positions.count;mesh.skeleton.update();
  for(let i=0;i+2<count;i+=3){const vertices=[0,1,2].map(offset=>{const id=index?.getX(i+offset)??i+offset,point=mesh.getVertexPosition(id,new THREE.Vector3());return mesh.localToWorld(point).applyMatrix4(inverse);});
   assert.ok(vertices.every(vertex=>distance(vertex,leg.shoe)<=leg.shoe.radius+1e-6),`${leg.side} shoe triangle ${i/3} escapes the fitted collision capsule (r=${leg.shoe.radius})`);
  }
 }
});
test('missing, mismatched and anatomically unreachable seats are rejected',()=>{const chair=new THREE.Mesh(new THREE.BoxGeometry(1,.1,1),new THREE.MeshBasicMaterial());chair.position.y=1.2;assert.equal(measureSeatContact(chair,{x:0,z:0},1.25).ok,false);assert.equal(measureSeatContact(chair,{x:0,z:0},.55).ok,false);assert.equal(measureSeatContact(chair,{x:2,z:0},.55).ok,false);});

test('an unsupported skeleton fails closed instead of admitting a seat pose',()=>{const actor=new THREE.Group(),a=new TycoonActivity({...createTycoonRoom('projects'),objects:[]});a.begin([{x:40,y:40},{x:41,y:40}]);const messages=[];TycoonScene.prototype.updateProbe.call({activity:a,play(){},onStatus:m=>messages.push(m)},actor,1/30);assert.equal(a.snapshot,null);assert.equal(actor.visible,false);assert.ok(messages.some(m=>m.includes('Unsupported probe skeleton')));});
test('unreachable seating blocks explicitly at the last safe visible pose',async()=>{const s=await setup();s.a.snapshot={position:tycoonGround({x:0,z:0}),heading:0,clip:'idle'};s.a.station={seatHeight:.95};s.a.transition('sit','sit_down','sit');for(let i=0;i<360&&s.a.phase!=='blocked';i++)frame(s,1/30);assert.equal(s.a.phase,'blocked');assert.ok(s.a.snapshot);assert.equal(s.actor.visible,true);assert.equal(s.actor.userData.limbCollisionDiagnostics.reason,'pose-error');assert.match(s.actor.userData.limbCollisionDiagnostics.message,/ท่าให้ถึงเบาะและพื้น/);assert.ok(s.a.elapsed===0);});
test('restarting a probe discards old world plants and Stop clears it',async()=>{const s=await setup();for(const x of [-1,1]){assert.ok(s.a.startRoute([{x,z:0},{x:x+.03,z:0}].map(tycoonGround)).ok);for(let i=0;i<100;i++){const f=frame(s,1/30);assert.ok(f.every(p=>p.bottom>-.003));}assert.equal(s.a.phase,'done');}s.a.stop();frame(s,1/30);assert.equal(s.actor.visible,false);});

const limb=(name,side,start,end,radius=.04)=>({name,side,start:new THREE.Vector3(...start),end:new THREE.Vector3(...end),radius});
test('swept limb collision catches a thin obstacle between safe endpoints',()=>{
 const post=new THREE.Mesh(new THREE.BoxGeometry(.012,.8,.3),new THREE.MeshBasicMaterial());post.userData.instanceId='thin-post';
 const world=new TycoonCollisionWorld([post]);
 const from=[limb('left-shin','left',[-.3,.3,0],[-.3,.8,0])],to=[limb('left-shin','left',[.3,.3,0],[.3,.8,0])];
 assert.equal(world.inspectCapsules(from).ok,true);
 assert.equal(world.inspectCapsules(to).ok,true);
 const result=world.sweepCapsules(from,to);
 assert.equal(result.ok,false);
 assert.equal(result.hit.objectId,'thin-post');
 assert.equal(result.hit.limb,'left-shin');
});
test('sweep rejects travel beyond its bounded sample budget instead of truncating checks',()=>{
 const post=new THREE.Mesh(new THREE.BoxGeometry(.02,.8,.2),new THREE.MeshBasicMaterial());post.userData.instanceId='far-post';const world=new TycoonCollisionWorld([post]);
 const result=world.sweepCapsules([limb('left-shin','left',[-1,.3,0],[-1,.8,0])],[limb('left-shin','left',[1,.3,0],[1,.8,0])],{maxStepM:.02,maxSamples:40});
 assert.equal(result.ok,false);assert.equal(result.sampleCount,0);assert.equal(result.requiredSamples,100);assert.equal(result.hit.reason,'sweep-range-exceeded');
});
test('collision geometry follows assembled furniture transforms and scale',()=>{
 const root=new THREE.Group();root.userData.instanceId='turned-chair-leg';root.position.set(2,0,-1);root.rotation.y=Math.PI/2;root.scale.setScalar(.5);
 const leg=new THREE.Mesh(new THREE.BoxGeometry(.018,.7,.48),new THREE.MeshBasicMaterial());root.add(leg);
 const world=new TycoonCollisionWorld([root]);
 const result=world.inspectCapsules([limb('right-thigh','right',[2.12,.05,-1],[2.12,.55,-1],.035)]);
 assert.equal(result.ok,false);
 assert.equal(result.hit.objectId,'turned-chair-leg');
});
test('occupied chair remains collidable outside its supported seat surface',()=>{
 const chair=new THREE.Group();chair.userData.instanceId='occupied-chair';
 const material=new THREE.MeshBasicMaterial();
 const seat=new THREE.Mesh(new THREE.BoxGeometry(.7,.08,.7),material);seat.position.y=.55;chair.add(seat);
 for(const x of [-.25,.25])for(const z of [-.25,.25]){const legMesh=new THREE.Mesh(new THREE.BoxGeometry(.07,.52,.07),material);legMesh.position.set(x,.26,z);chair.add(legMesh);}
 const world=new TycoonCollisionWorld([chair]);
 const result=world.inspectCapsules([limb('left-shin','left',[.25,.03,.25],[.25,.5,.25],.035)],{seatObjectId:'occupied-chair',phase:'working'});
 assert.equal(result.ok,false);
 assert.equal(result.hit.objectId,'occupied-chair');
});
test('seat support is limited to near-height thigh contact on the measured seat patch',()=>{
 const chair=new THREE.Group();chair.userData.instanceId='supported-chair';const top=new THREE.Mesh(new THREE.BoxGeometry(.7,.1,.7),new THREE.MeshBasicMaterial());top.position.y=.5;chair.add(top);const world=new TycoonCollisionWorld([chair]),support={seatObjectId:'supported-chair',phase:'working',seatPoint:new THREE.Vector3(),seatHeight:.55,seatSupportRadius:.32};
 assert.equal(world.inspectCapsules([limb('left-thigh','left',[-.1,.58,0],[.1,.58,0],.04)],support).ok,true);
 assert.equal(world.inspectCapsules([limb('left-thigh','left',[-.1,.52,0],[.1,.52,0],.04)],support).ok,false);
 assert.equal(world.inspectCapsules([limb('left-shin','left',[-.1,.58,0],[.1,.58,0],.04)],support).ok,false);
 assert.equal(world.inspectCapsules([limb('left-thigh','left',[-.1,.58,0],[.1,.58,0],.04)],{...support,phase:'entering',allowSeatSupport:false}).ok,false);
 const sloped=new THREE.Mesh(new THREE.BoxGeometry(.5,.03,.3),new THREE.MeshBasicMaterial());sloped.rotation.z=-.8;sloped.position.y=.55;chair.add(sloped);const slopedWorld=new TycoonCollisionWorld([chair]);
 assert.equal(slopedWorld.inspectCapsules([limb('left-thigh','left',[-.1,.6,0],[.1,.6,0],.04)],support).ok,false,'sloped seat sides are not support');
});
for(const deskId of ['desk-1','desk-2','desk-3','desk-4'])for(const hz of [30,60])test(`bundled ${deskId} completes supported work and exit at scale 1 at ${hz} Hz`,async()=>{
 const scale=1;
 const room=createTycoonRoom('projects'),deskData=room.objects.find(o=>o.id===deskId),chairData=room.objects.find(o=>o.id===deskId.replace('desk','chair'));const activity=new TycoonActivity(room);
 const actorBytes=await readFile('web/assets/models/tycoon-factory/actor-rig-v3.glb'),actorGltf=await new GLTFLoader().parseAsync(actorBytes.buffer.slice(actorBytes.byteOffset,actorBytes.byteOffset+actorBytes.byteLength),''),actor=actorGltf.scene;
 actor.userData={instanceId:'demo-agent',clips:actorGltf.animations,mixer:new THREE.AnimationMixer(actor)};
 const chairBytes=await readFile('web/assets/models/tycoon/chair.glb'),chairGltf=await new GLTFLoader().parseAsync(chairBytes.buffer.slice(chairBytes.byteOffset,chairBytes.byteOffset+chairBytes.byteLength),''),chair=chairGltf.scene;chairData.scale*=scale;
 chair.userData.instanceId=chairData.id;chair.position.set(chairData.x,chairData.y,chairData.z);chair.rotation.y=chairData.rotation;chair.scale.setScalar(chairData.scale);
 const deskBytes=await readFile('web/assets/models/tycoon-factory/desk-v3.glb'),desk= (await new GLTFLoader().parseAsync(deskBytes.buffer.slice(deskBytes.byteOffset,deskBytes.byteOffset+deskBytes.byteLength),'' )).scene;desk.userData.instanceId=deskData.id;desk.position.set(deskData.x,deskData.y,deskData.z);desk.rotation.y=deskData.rotation;desk.scale.setScalar(deskData.scale);
 const messages=[],scene={ready:true,assembly:{owned:[actor,chair,desk]},activity,collisionWorld:new TycoonCollisionWorld([chair,desk]),play:TycoonScene.prototype.play,onStatus:m=>messages.push(m)},admission=TycoonScene.prototype.startStation.call(scene,deskId);
 assert.equal(admission.ok,true,`${admission.message} ${JSON.stringify(admission.diagnostic||null)}`);
 const station=activity.station,seatWorld=tycoonWorld(station.seat),front=tycoonWorld(station.footAnchor).sub(seatWorld).setY(0).normalize(),chairFront=scene.collisionWorld.projectionExtent(chairData.id,seatWorld,front),shoeRear=new ProbeContact(actor,scene.collisionWorld).shoeRearExtent(station.heading,front),ankleTarget=tycoonWorld(station.footAnchor).sub(seatWorld).dot(front);
 assert.ok(station.footPlacementDiagnostic?.ok,`measured seat-foot placement must be valid: ${JSON.stringify(station.footPlacementDiagnostic)}`);
 // The projected extents are a conservative box-style diagnostic; triangle sweeps remain the collision authority.
 const shoeProxyGap=ankleTarget-chairFront-shoeRear;
 assert.ok(shoeProxyGap>=.001,`measured shoe proxy clearance ${JSON.stringify({shoeProxyGapM:shoeProxyGap,diagnostic:station.footPlacementDiagnostic,ankleTarget,chairFront,shoeRear})}`);
 const seen=new Set();let settled=0,diagnostics,lastPhase=null,trace=[],maxLeavingLift=0;
 for(let i=0;i<hz*90;i++){
  TycoonScene.prototype.updateProbe.call(scene,actor,1/hz);seen.add(activity.phase);diagnostics=actor.userData.contact?.lastCollision;
  const swing=diagnostics?.swingClearancePlan;if(activity.phase==='leaving'&&swing?.phase==='leaving'){assert.notEqual(swing.ok,false,`leaving shoe route ${JSON.stringify(swing)}`);if(Number.isFinite(swing.lift)){maxLeavingLift=Math.max(maxLeavingLift,swing.lift);assert.ok(swing.lift<=.420001,`leaving lift exceeds bounded search: ${swing.lift}`);}if(Number.isFinite(swing.minClearanceM))assert.ok(swing.minClearanceM>=.001,`leaving shoe clearance ${swing.minClearanceM}`);}
  const arm=diagnostics?.armContactAttempt||diagnostics?.armContact;if(activity.phase!==lastPhase){trace.push({phase:activity.phase,stage:activity.approachStage,position:tycoonWorld(activity.snapshot.position)});lastPhase=activity.phase;}
  assert.ok(diagnostics?.ok!==false,`collision ${JSON.stringify({trace,phase:activity.phase,collisionPhase:diagnostics?.phase,reason:actor.userData.limbCollisionDiagnostics?.reason,message:actor.userData.limbCollisionDiagnostics?.message,seatSupport:actor.userData.limbCollisionDiagnostics?.seatSupport,root:activity.snapshot.position,rootWorld:tycoonWorld(activity.snapshot.position),stage:activity.approachStage,stationPosition:station.position,stationPositionWorld:tycoonWorld(station.position),footPlacement:station.footPlacementDiagnostic,seatRoot:station.seatRoot,seatRootWorld:tycoonWorld(station.seatRoot),footAnchor:station.footAnchor,footAnchorWorld:tycoonWorld(station.footAnchor),heading:activity.snapshot.heading,pelvis:actor.userData.contact?.pelvis,legs:actor.userData.contact?.legs?.map(l=>({side:l.side,point:l.point?.toArray()})),hit:diagnostics?.hit,swingPlan:diagnostics?.swingClearancePlan,kneePoleSearch:diagnostics?.kneePoleSearch,arm:arm&&{phase:arm.phase,status:arm.status,reason:arm.reason,approachStage:arm.approachStage,workExitStage:arm.workExitStage,workExitState:arm.workExitState,handTargetErrorM:arm.handTargetErrorM,armReachRangesM:arm.armReachRangesM,contacts:arm.contacts,supportSearch:arm.supportSearch}})}`);
  if(activity.phase==='working'){
   const support=actor.userData.limbCollisionDiagnostics?.seatSupport;
   assert.ok(support?.ok,`measured pelvis seat support ${JSON.stringify(support)}`);
   assert.ok(Math.abs(support.verticalGapM)<=.003,`pelvis support gap ${support.verticalGapM}`);
   const arm=actor.userData.limbCollisionDiagnostics?.armContact;
   assert.equal(arm?.status,'contact',`measured desktop support ${JSON.stringify(arm)}`);
   assert.equal(arm?.targetMode,'desktop-top-support');
   assert.ok(arm.handTargetErrorM.max<=.005,`palm support residual ${arm.handTargetErrorM.max}`);
  }
  const feet=sample(actor);assert.ok(feet.every(f=>f.bottom>=-.003),`floor ${feet.map(f=>f.bottom)}`);
  if(activity.phase==='done'&&++settled>60)break;
  if(activity.phase==='blocked')break;
 }
  for(const phase of ['walking','entering','sit','working','standing','leaving','done'])assert.ok(seen.has(phase),`${deskId} ${phase}; stopped at ${activity.phase}; ${messages.join('; ')}; status=${activity.snapshot?.status}; ${JSON.stringify({contact:actor.userData.limbCollisionDiagnostics,last:actor.userData.contact?.lastCollision})}`);
 assert.ok(settled>60);
 assert.ok(maxLeavingLift>0,`no measured leaving shoe route; maximum lift ${maxLeavingLift}`);
});

test('Customer CRM desk completes its assembled lifecycle at 60 Hz',async()=>{
 const room=createTycoonRoom('customer'),deskId='customer-crm-desk',chairId='customer-crm-chair',activity=new TycoonActivity(room),station=activity.nav.stations.find(item=>item.id===`station:${deskId}`);
 assert.ok(station,`Customer production navigation station exists: ${JSON.stringify(activity.nav.issues)}`);
 const deskData=room.objects.find(item=>item.id===deskId),chairData=room.objects.find(item=>item.id===chairId);
 const [actorBytes,chairBytes,deskBytes]=await Promise.all([readFile('web/assets/models/tycoon-factory/actor-rig-v3.glb'),readFile('web/assets/models/tycoon/chair.glb'),readFile('web/assets/models/tycoon-factory/desk-v3.glb')]);
 const parse=async bytes=>GLTFLoader.prototype.parseAsync.call(new GLTFLoader(),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const [actorGltf,chairGltf,deskGltf]=await Promise.all([parse(actorBytes),parse(chairBytes),parse(deskBytes)]),actor=actorGltf.scene,chair=chairGltf.scene,desk=deskGltf.scene;
 actor.userData={instanceId:'demo-agent',clips:actorGltf.animations,mixer:new THREE.AnimationMixer(actor)};
 for(const [mesh,data] of [[chair,chairData],[desk,deskData]]){mesh.userData.instanceId=data.id;mesh.position.set(data.x,data.y,data.z);mesh.rotation.y=data.rotation;mesh.scale.setScalar(data.scale);}
 const messages=[],scene={ready:true,assembly:{owned:[actor,chair,desk]},activity,collisionWorld:new TycoonCollisionWorld([chair,desk]),play:TycoonScene.prototype.play,onStatus:message=>messages.push(message)};
 const admission=TycoonScene.prototype.startStation.call(scene,station.id);assert.equal(admission.ok,true,JSON.stringify(admission));
 const seen=new Set(),trace=[];let previousPhase=null,doneFrames=0;
 for(let i=0;i<60*90;i++){
  TycoonScene.prototype.updateProbe.call(scene,actor,1/60);seen.add(activity.phase);
  if(activity.phase!==previousPhase){trace.push({phase:activity.phase,root:activity.snapshot?.position&&tycoonWorld(activity.snapshot.position).toArray(),swing:actor.userData.contact?.lastCollision?.swingClearancePlan,hit:actor.userData.limbCollisionDiagnostics?.hit});previousPhase=activity.phase;}
  const diagnostic=actor.userData.limbCollisionDiagnostics;
  assert.ok(diagnostic?.ok!==false,JSON.stringify({trace,phase:activity.phase,root:activity.snapshot?.position,seatRoot:station.seatRoot,footAnchor:station.footAnchor,diagnostic,messages}));
  if(activity.phase==='working'){
   assert.ok(diagnostic.seatSupport?.ok,JSON.stringify(diagnostic.seatSupport));assert.ok(Math.abs(diagnostic.seatSupport.verticalGapM)<=.003,JSON.stringify(diagnostic.seatSupport));
   const arm=diagnostic.armContact;assert.equal(arm?.status,'contact',JSON.stringify(arm));assert.equal(arm?.targetMode,'desktop-top-support');assert.ok(arm.handTargetErrorM.max<=.005,JSON.stringify(arm.handTargetErrorM));
  }
  if(sample(actor).some(foot=>foot.bottom<-.003))assert.fail(`Customer foot penetration: ${JSON.stringify(trace)}`);
  if(activity.phase==='done'&&++doneFrames>120)break;
  if(activity.phase==='blocked')break;
 }
 for(const phase of ['walking','turning','approaching-seat','entering','sit','working','standing','leaving','done'])assert.ok(seen.has(phase),`Customer CRM missing ${phase}; stopped ${activity.phase}: ${JSON.stringify({trace,diagnostic:actor.userData.limbCollisionDiagnostics,messages})}`);
 assert.ok(doneFrames>120);
});

test('approach deferral keeps a rejected intermediate footfall blocked and rejects its terminal anchor',async()=>{
 const s=await setup(),state={position:tycoonGround({x:0,z:0}),heading:0,seatHeight:TYCOON_BUNDLED_CHAIR_SEAT_HEIGHT_M,seatApproachBlend:0},station={type:'desk',objectId:'fixture-desk',seatObjectId:'fixture-chair',seat:tycoonGround({x:0,z:0}),seatRoot:tycoonGround({x:0,z:.23}),footAnchor:tycoonGround({x:0,z:.5}),heading:0};
 s.a.phase='approaching-seat';s.a.snapshot=state;s.a.station=station;s.a.tick=()=>{};s.actor.userData.contact=new ProbeContact(s.actor);s.scene.play=()=>{};
 const contact=s.actor.userData.contact;contact.swingClearanceLift=()=>({ok:false,lift:null,attempts:1,minClearanceM:-.004,sampleCount:1,failure:{clearanceM:-.004}});
 TycoonScene.prototype.updateProbe.call(s.scene,s.actor,1/60);
 state.seatApproachBlend=.5;TycoonScene.prototype.updateProbe.call(s.scene,s.actor,1/60);
 const deferred=s.actor.userData.limbCollisionDiagnostics.swingClearancePlan;
 assert.equal(deferred.ok,false,'a rejected candidate is never represented as a valid plan');assert.equal(deferred.deferred,true);assert.equal(deferred.reason,'waiting-for-final-approach-anchor');assert.equal(contact.swing,null,'deferral retains the planted foot instead of starting a blocked swing');
 const lastSafe=contact.safePose.position.clone();state.seatApproachBlend=1;TycoonScene.prototype.updateProbe.call(s.scene,s.actor,1/60);
 const terminal=s.actor.userData.limbCollisionDiagnostics;
 assert.equal(s.a.phase,'blocked');assert.equal(terminal.reason,'pose-error');assert.equal(terminal.swingClearancePlan.ok,false);assert.notEqual(terminal.swingClearancePlan.deferred,true);assert.ok(s.actor.visible);assert.ok(s.actor.position.distanceTo(lastSafe)<1e-8,'terminal-anchor failure restores the last clear root');assert.equal(contact.swing,null);
});

test('pose failure restores the visible actor to its last accepted root and bones',async()=>{
 const s=await setup();s.a.snapshot={position:tycoonGround({x:0,z:0}),heading:0,clip:'idle'};s.a.phase='rest';
 frame(s,1/30);const contact=s.actor.userData.contact,safe=contact.safePose.position.clone();assert.ok(safe);
 s.a.snapshot.position=tycoonGround({x:8,z:0});frame(s,1/30);
 assert.equal(s.a.phase,'blocked');assert.equal(s.actor.visible,true);assert.equal(s.actor.position.distanceTo(safe),0);
 assert.equal(s.actor.userData.limbCollisionDiagnostics.reason,'pose-error');assert.deepEqual(s.actor.userData.limbCollisionDiagnostics.safeRoot,safe.toArray());
});
test('blocked walking rolls back to the last clear articulated pose and reports the obstacle',async()=>{
 const s=await setup(),post=new THREE.Mesh(new THREE.BoxGeometry(.035,.9,1),new THREE.MeshBasicMaterial());post.userData.instanceId='sweep-post';s.scene.collisionWorld=new TycoonCollisionWorld([post]);
 assert.equal(s.a.startRoute([{x:-1,z:0},{x:1,z:0}].map(tycoonGround)).ok,true);let blocked=false;
 for(let i=0;i<240;i++){frame(s,1/30);if(s.a.phase==='blocked'){blocked=true;break;}}
 assert.equal(blocked,true);assert.equal(s.actor.visible,true);assert.equal(s.actor.userData.limbCollisionDiagnostics.hit.objectId,'sweep-post');assert.ok(s.actor.userData.limbCollisionDiagnostics.stepBackoffM>0);assert.deepEqual(s.actor.position.toArray(),s.actor.userData.limbCollisionDiagnostics.safeRoot);
});
test('renderer-independent station lifecycle does not wait for scene foot readiness',()=>{
 const activity=new TycoonActivity(createTycoonRoom('projects'));assert.equal(activity.startStation('station:desk-1').ok,true);assert.equal(activity.entryFeetReady,undefined);
 let entered=false;for(let i=0;i<1000&&activity.phase!=='done';i++){activity.tick(.04);if(activity.phase==='entering')entered=true;}
 assert.equal(entered,true);assert.equal(activity.phase,'done');assert.equal(activity.reservations.size,0);
});

const externalCatalog=JSON.parse(await readFile('tests/fixtures/external-chairs/fixtures.json','utf8'));
const compatibleExternal=externalCatalog.fixtures.find(fixture=>fixture.id==='kenney-chair-four-leg');
for(const hz of [30,60])test(`external ${compatibleExternal.id} completes assembled lifecycle from its authored approach at scale 0.9 at ${hz} Hz`,async()=>{
 const room=createTycoonRoom('projects'),deskData=room.objects.find(o=>o.id==='desk-1'),chairData=room.objects.find(o=>o.id==='chair-1');deskData.z=chairData.z+1.15;
 const authoredApproach=[-.9349881851,-.2925788864],asset={id:compatibleExternal.provenance.glb.sha256,name:compatibleExternal.name,category:'chair',size:compatibleExternal.measured.gltfSize,sourceSize:compatibleExternal.measured.gltfSize,origin:[0,0,0],interaction:{...compatibleExternal.interaction,approach:authoredApproach}};
 chairData.kind='custom';chairData.asset=asset;chairData.scale*=.9;
 const activity=new TycoonActivity(room),nav=activity.nav,station=nav.stations.find(s=>s.id==='station:desk-1'&&s.seatObjectId==='chair-1');assert.ok(station,JSON.stringify(nav.issues));assert.ok(Math.abs(deskData.z-chairData.z-1.15)<1e-8,'compatible custom-room desk gap');assert.equal(chairData.rotation,Math.PI);
 const expectedApproach=new THREE.Vector3(authoredApproach[0]*chairData.scale,0,authoredApproach[1]*chairData.scale).applyAxisAngle(new THREE.Vector3(0,1,0),chairData.rotation).add(new THREE.Vector3(chairData.x,0,chairData.z));
 const approachWorld=tycoonWorld(station.position);assert.ok(approachWorld.distanceTo(expectedApproach)<1e-5,`authored approach resolves to ${approachWorld.toArray()}`);assert.ok(nav.findLocalPath(nav.spawnPoint,station.position).length>0,'authored approach is reachable from spawn');
 const [actorBytes,chairBytes,deskBytes]=await Promise.all([readFile('web/assets/models/tycoon-factory/actor-rig-v3.glb'),readFile(`tests/fixtures/external-chairs/${compatibleExternal.file}`),readFile('web/assets/models/tycoon-factory/desk-v3.glb')]);
 const parse=async bytes=>GLTFLoader.prototype.parseAsync.call(new GLTFLoader(),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const [actorGltf,chairGltf,deskGltf]=await Promise.all([parse(actorBytes),parse(chairBytes),parse(deskBytes)]),actor=actorGltf.scene,chair=chairGltf.scene,desk=deskGltf.scene;
 actor.userData={instanceId:'demo-agent',clips:actorGltf.animations,mixer:new THREE.AnimationMixer(actor)};chair.userData.instanceId=chairData.id;chair.position.set(chairData.x,chairData.y,chairData.z);chair.rotation.y=chairData.rotation;chair.scale.setScalar(chairData.scale);desk.userData.instanceId=deskData.id;desk.position.set(deskData.x,deskData.y,deskData.z);desk.rotation.y=deskData.rotation;desk.scale.setScalar(deskData.scale);
 const scene={ready:true,assembly:{owned:[actor,chair,desk]},activity,collisionWorld:new TycoonCollisionWorld([chair,desk]),play:TycoonScene.prototype.play,onStatus(){} };
 assert.equal(TycoonScene.prototype.startStation.call(scene,station.id).ok,true);const seen=new Set(),trace=[];let settled=0,lastPhase=null;
 for(let i=0;i<hz*90;i++){TycoonScene.prototype.updateProbe.call(scene,actor,1/hz);seen.add(activity.phase);if(activity.phase!==lastPhase){trace.push({phase:activity.phase,stage:activity.approachStage,root:activity.snapshot?.position,worldRoot:activity.snapshot&&tycoonWorld(activity.snapshot.position)});lastPhase=activity.phase;}assert.ok(actor.userData.limbCollisionDiagnostics?.ok!==false,JSON.stringify({trace,phase:activity.phase,stationPosition:station.position,footAnchor:station.footAnchor,seatRoot:station.seatRoot,swing:actor.userData.contact?.lastCollision?.swingClearancePlan,diagnostic:actor.userData.limbCollisionDiagnostics}));assert.ok(sample(actor).every(f=>f.bottom>=-.003));if(activity.phase==='working'){const support=actor.userData.limbCollisionDiagnostics?.seatSupport,arm=actor.userData.contact?.armContact?.lastDiagnostic;assert.ok(support?.ok,`${compatibleExternal.id}@0.9: pelvis support ${JSON.stringify(support)}`);assert.ok(Math.abs(support.verticalGapM)<=.003,`${compatibleExternal.id}@0.9: pelvis gap ${support.verticalGapM}`);assert.equal(arm?.status,'contact',`${compatibleExternal.id}@0.9: palm support ${JSON.stringify(arm)}`);assert.ok(arm.handTargetErrorM.max<=.005,`${compatibleExternal.id}@0.9: palm residual ${arm.handTargetErrorM.max}`);}if(activity.phase==='done'&&++settled>Math.ceil(hz*2))break;if(activity.phase==='blocked')break;}
 for(const phase of ['walking','entering','sit','working','standing','leaving','done'])assert.ok(seen.has(phase),`${compatibleExternal.id}@0.9: missing ${phase}, stopped ${activity.phase}; ${JSON.stringify(actor.userData.limbCollisionDiagnostics)}`);
 assert.ok(settled>Math.ceil(hz*2));
});

