import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {JSDOM} from 'jsdom';
import {HybridOffice3D} from '../web/hybrid-office-3d.js';
import {defaultOfficeRoom} from '../web/hybrid-state.js';
import {createOfficeCharacter,updateOfficeCharacter,disposeOfficeCharacter} from '../web/office-characters.js';
import {groundToWorld} from '../web/office-projection.js';
import {createOfficeNavigation} from '../web/office-navigation.js';
import {sheetYaw} from '../web/office-scene-sheet.js';
import {blueprintPoint,blueprintLocalPoint} from '../web/office-blueprints.js';
import {rotationCandidate} from '../web/office-placement-grid.js';
// Inspect the rendered trouser seat-contact vertex after skeletal deformation;
// the garment's full bounding box also includes both continuous trouser legs.
const pelvisContactY=actor=>{actor.updateMatrixWorld(true);const pants=actor.getObjectByName('office-pelvis');pants.skeleton.update();return Math.min(...pants.userData.seatContactVertices.map(i=>pants.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(pants.matrixWorld).y));};

function fixture(t){
 const dom=new JSDOM('<main></main>');
 class Renderer{constructor(){this.domElement=dom.window.document.createElement('canvas');this.shadowMap={};}setClearColor(){}setPixelRatio(){}setSize(){}render(){}clear(){}getRenderTarget(){return null;}setRenderTarget(){}dispose(){}}
 const layer=new HybridOffice3D(dom.window.document.querySelector('main'),{Renderer,SkinLayer:null});
 const room=defaultOfficeRoom({key:'projects',label:'Projects',number:1,roles:[{},{},{},{}]});layer.sync(room,true);
 t.after(()=>{layer.dispose();dom.window.close();});return {layer,room};
}
test('unknown and authoritative idle never acquire a working status from ambient poses',t=>{
 const {layer,room}=fixture(t),actor=layer.actors.values().next().value,snapshot=JSON.stringify(room);
 assert.match(layer.step(0).get(actor.id).thought,/ไม่ทราบสถานะ/);
 for(let tick=1;tick<450;tick++)layer.step(tick/10);
 assert.equal(actor.path.length,0);assert.equal(actor.action,'sitting');
 layer.setAgentStates([{avatarId:actor.id,state:'idle',source:'synthetic regression'}]);
 assert.match(layer.step(45).get(actor.id).thought,/ว่าง/);assert.doesNotMatch(layer.step(45).get(actor.id).thought,/กำลังคิด|ทำงาน/);
 layer.setAgentStates([{avatarId:actor.id,state:'working'}]);
 assert.match(layer.step(45).get(actor.id).thought,/ไม่ทราบสถานะ/);
 assert.equal(JSON.stringify(room),snapshot);
});
test('sourced waiting and done display truthful labels without typing or automatic breaks',t=>{
 const {layer}=fixture(t),actor=layer.actors.values().next().value;
 let time=0;
 for(const [state,label]of [['waiting','รอข้อมูล'],['done','เสร็จแล้ว']]){
  layer.setAgentStates([{avatarId:actor.id,state,source:'synthetic regression'}]);
  const initial={...actor.position};
  for(let tick=0;tick<700;tick++){time+=.1;const result=layer.step(time).get(actor.id);assert.ok(result.thought.startsWith(label));}
  assert.equal(actor.action,'sitting');assert.equal(actor.path.length,0);assert.deepEqual(actor.position,initial);
 }
});
test('sofa cushions transform with scale/rotation and can be reserved by two distinct actors',t=>{
 const {layer,room}=fixture(t),sofa=room.objects.find(o=>o.kind==='team-sofa');
 for(const rotation of [0,90,180,270]){
  const moved={...room,objects:room.objects.map(o=>o.id===sofa.id?{...o,rotation}:o)};
  const seats=createOfficeNavigation(moved).stations.filter(s=>s.type==='sofa');
  assert.equal(seats.length,2);assert.notEqual(seats[0].id,seats[1].id);
  const yaw=sheetYaw({...sofa,rotation}),origin=groundToWorld(sofa);
  for(const [i,seat]of seats.entries()){
   const local=groundToWorld(seat.seat).sub(origin).applyAxisAngle(new THREE.Vector3(0,1,0),-yaw).divideScalar(sofa.scale);
   assert.ok(Math.abs(local.x-(i===0?-.51:.51))<1e-6);assert.ok(Math.abs(local.z+.16)<1e-6);
   assert.ok(seat.seatHeight>0);assert.ok(Math.abs(seat.heading-(yaw+Math.PI))<1e-8);
  }
 }
 const [a,b,c]=layer.actors.values();
 assert.equal(layer.setMode(a.id,'resting'),true);assert.equal(layer.setMode(b.id,'resting'),true);
 assert.notEqual(a.target.id,b.target.id);assert.equal(layer.setMode(c.id,'resting'),false);
});
test('adult limb lengths and seated sole contact remain stable without scaling bones',()=>{
 const group=createOfficeCharacter();try{
  const rig=group.userData.officeCharacter.rig;
  assert.ok(Math.abs(rig.legs.left.knee.position.y/rig.legs.left.ankle.position.y-1)<.1);
  for(const height of [.54,.62,.74,.83])for(const action of ['sitting','seated','resting']){
   updateOfficeCharacter(group,{action,seatHeight:height,time:0});group.updateMatrixWorld(true);
   for(const side of ['left','right']){
    const leg=rig.legs[side],sole=new THREE.Box3().setFromObject(leg.shoe).min.y;
    assert.ok(Math.abs(sole)<.012,`${action} at ${height}: sole ${sole}`);
    assert.deepEqual(leg.knee.scale.toArray(),[1,1,1]);
   }
  }
 }finally{disposeOfficeCharacter(group);}
});
test('recommended sofa cushions support the pelvis and feet without the doorway obscuring seated people',t=>{
 const {layer}=fixture(t),door=layer.architecture.userData.officeArchitecture.doors.find(d=>d.id==='partition:lounge-partition');
 const projectedX=node=>{node.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(node),xs=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])xs.push(new THREE.Vector3(x,y,z).project(layer.camera).x);return {min:Math.min(...xs),max:Math.max(...xs)};};
 const doorX=projectedX(door.group);
 for(const seat of layer.navigation.stations.filter(s=>s.type==='sofa')){
  const actor=createOfficeCharacter(3);try{
   actor.position.copy(groundToWorld(seat.seat));updateOfficeCharacter(actor,{action:'resting',heading:seat.heading,seatHeight:seat.seatHeight+.1});actor.updateMatrixWorld(true);
   assert.ok(Math.abs(pelvisContactY(actor)-(seat.seatHeight-.01))<1e-6,'pelvis compresses cushion by 10mm');
   for(const side of ['left','right'])assert.ok(Math.abs(new THREE.Box3().setFromObject(actor.userData.officeCharacter.rig.legs[side].shoe).min.y)<1e-6);
   assert.ok(projectedX(actor).max<doorX.min-.005,'fixed camera keeps the doorway clear of both seated silhouettes');
  }finally{disposeOfficeCharacter(actor);}
 }
});
test('recommended board faces its reachable discussion area and fits a quarter turn',t=>{
 const {room}=fixture(t),board=room.objects.find(o=>o.kind==='whiteboard'),local=blueprintLocalPoint(room.blueprintPlan,board),nav=createOfficeNavigation(room);
 assert.ok(Math.abs(local.x-10.75)<1e-7&&Math.abs(local.z-.9)<1e-7);
 assert.equal(sheetYaw(board),0,'writing face points forward into the huddle area and toward the camera');
 const approach=blueprintPoint(room.blueprintPlan,10.75,2.2),aisle=blueprintPoint(room.blueprintPlan,9.8,3.2);
 assert.equal(nav.isWalkable(approach),true);assert.ok(nav.findPath(aisle,approach).length>1);
 assert.equal(rotationCandidate(room,board.id).ok,true);
});
test('walking phase follows distance and the planted foot stays level on the floor',()=>{
 const group=createOfficeCharacter();try{
  const rig=group.userData.officeCharacter.rig;
  for(let distance=0;distance<1.1;distance+=.025){
   updateOfficeCharacter(group,{action:'walking',walkDistance:distance,time:100,speed:.9});group.updateMatrixWorld(true);
   const stance=distance<.55?'left':'right',sole=new THREE.Box3().setFromObject(rig.legs[stance].shoe).min.y;
   assert.ok(Math.abs(sole)<.005,`${distance}: planted ${stance} sole ${sole}`);
   for(const side of ['left','right'])assert.ok(new THREE.Box3().setFromObject(rig.legs[side].shoe).min.y>-.005);
  }
  updateOfficeCharacter(group,{action:'walking',walkDistance:.2,time:0});const angle=rig.legs.left.hip.rotation.x;
  updateOfficeCharacter(group,{action:'walking',walkDistance:.2,time:900});assert.equal(rig.legs.left.hip.rotation.x,angle,'stopping movement freezes stride');
  updateOfficeCharacter(group,{action:'sitting',seatHeight:.65,dt:.05});
  assert.ok(rig.body.position.y>.65&&rig.body.position.y<.94,'sit transition is gradual');
  for(let i=0;i<30;i++)updateOfficeCharacter(group,{action:'sitting',seatHeight:.65,dt:.05});
  assert.ok(Math.abs(rig.body.position.y-.65)<.001);
 }finally{disposeOfficeCharacter(group);}
});
test('sourced idle waits, takes one water break, then returns to its own quiet desk',t=>{
 const {layer,room}=fixture(t),actor=layer.actors.values().next().value,snapshot=JSON.stringify(room);
 layer.setAgentStates([{avatarId:actor.id,state:'idle',source:'synthetic regression'}]);
 const home=actor.station.id,visits=[],initial={...actor.position};let last=home;
 for(let tick=0;tick<1400;tick++){
  const before={...actor.position},ignoreIds=[...(actor.ignoreIds||[])],time=tick/10;
  const state=layer.step(time).get(actor.id);
  assert.match(state.thought,/ว่าง/);assert.doesNotMatch(state.thought,/กำลังคิด|กำลังทำงาน/);
  if(time<59)assert.deepEqual(actor.position,initial);
  if(actor.action==='walking'&&time>61)assert.equal(layer.navigation.isSegmentWalkable(before,actor.position,{ignoreIds}),true);
  if(actor.station&&actor.station.id!==last){visits.push(actor.station.type);last=actor.station.id;}
  if(visits.length===2)break;
 }
 assert.deepEqual(visits,['water','desk']);assert.equal(actor.station.id,home);assert.equal(actor.action,'sitting');
 assert.equal(JSON.stringify(room),snapshot);
 layer.setAgentStates([{avatarId:actor.id,state:'working',source:'synthetic regression'}]);
 assert.equal(actor.action,'seated');assert.match(layer.step(140).get(actor.id).thought,/กำลังทำงาน/);
});
test('waiting and done interrupt automatic breaks and return quietly to the owned desk',t=>{
 const {layer}=fixture(t),actor=layer.actors.values().next().value,home=actor.station.id;let time=0;
 for(const [state,origin,midwalk]of [['waiting','water',true],['done','water',false],['waiting','sofa',false],['done','sofa',true]]){
  layer.setAgentStates([{avatarId:actor.id,state:'idle',source:'synthetic regression'}]);actor.mode='auto';
  assert.equal(layer.travel(actor,layer.stationFor(actor,origin)),true);
  let steps=0;while(actor.path.length&&steps++<(midwalk?30:1200)){time+=.1;layer.step(time);}
  if(midwalk)assert.ok(actor.path.length);else assert.equal(actor.station.type,origin);
  layer.setAgentStates([{avatarId:actor.id,state,source:'synthetic regression'}]);
  assert.equal(actor.target?.id,home);
  steps=0;while(actor.path.length&&steps++<1600){const before={...actor.position},ignoreIds=[...(actor.ignoreIds||[])];time+=.1;layer.step(time);assert.equal(layer.navigation.isSegmentWalkable(before,actor.position,{ignoreIds}),true);}
  assert.equal(actor.station.id,home);assert.equal(actor.action,'sitting');
 }
});
test('missing or offline status stops automatic travel in place but preserves explicit local actions',t=>{
 const {layer}=fixture(t),actor=layer.actors.values().next().value;let time=0;
 layer.setAgentStates([{avatarId:actor.id,state:'idle',source:'synthetic regression'}]);actor.mode='auto';
 assert.equal(layer.travel(actor,layer.stationFor(actor,'water')),true);
 for(let i=0;i<35;i++){time+=.1;layer.step(time);}
 const position={...actor.position};layer.setAgentStates([]);
 assert.equal(actor.path.length,0);assert.equal(actor.target,null);assert.equal(actor.action,'idle');assert.deepEqual(actor.position,position);
  assert.equal(layer.navigation.isWalkable(actor.position,{ignoreIds:actor.ignoreIds||[]}),true);
 for(let i=0;i<800;i++){time+=.1;layer.step(time);}assert.deepEqual(actor.position,position);
 assert.equal(layer.setMode(actor.id,'water'),true);const path=JSON.stringify(actor.path);
 layer.setAgentStates([{avatarId:actor.id,state:'offline',source:'synthetic regression'}]);
 assert.equal(JSON.stringify(actor.path),path,'explicit local trip survives status change');
 while(actor.path.length){time+=.1;layer.step(time);}
  actor.mode='auto';const waterPosition={...actor.position};layer.setAgentStates([]);
  assert.equal(actor.action,'idle');assert.deepEqual(actor.position,waterPosition);assert.equal(actor.path.length,0);
 actor.mode='auto';layer.setAgentStates([{avatarId:actor.id,state:'idle',source:'synthetic regression'}]);
 assert.equal(layer.travel(actor,layer.stationFor(actor,'sofa')),true);
 while(actor.path.length){time+=.1;layer.step(time);}
 const seat={...actor.position};layer.setAgentStates([{avatarId:actor.id,state:'offline',source:'synthetic regression'}]);
 assert.equal(actor.action,'resting');assert.deepEqual(actor.position,seat);assert.equal(actor.path.length,0);
 assert.equal(layer.travel(actor,layer.stationFor(actor,'desk')),true);
 for(let i=0;i<35;i++){time+=.1;layer.step(time);}const stopped={...actor.position};
 layer.setAgentStates([{avatarId:actor.id,state:'offline',source:'synthetic regression'}]);assert.equal(actor.path.length,0);assert.deepEqual(actor.position,stopped);assert.equal(actor.action,'idle');
});
test('offline during final sofa entry completes only the reserved local sit and rests grounded',t=>{
 const {layer}=fixture(t),actor=layer.actors.values().next().value;let time=0;
 layer.setAgentStates([{avatarId:actor.id,state:'idle',source:'synthetic regression'}]);actor.mode='auto';
 const sofa=layer.stationFor(actor,'sofa');assert.equal(layer.travel(actor,sofa),true);
 let steps=0;while(actor.path.length&&steps++<1500){time+=.05;layer.step(time);if(!layer.navigation.isWalkable(actor.position)&&groundToWorld(actor.position).distanceTo(groundToWorld(sofa.seat))<.3)break;}
 assert.ok(actor.path.length&&steps<1500);assert.equal(actor.station,null);
 const entry={...actor.position};layer.setAgentStates([{avatarId:actor.id,state:'offline',source:'synthetic regression'}]);
 assert.deepEqual(actor.position,entry,'no teleport on status loss');assert.equal(actor.action,'resting');assert.equal(actor.target.id,sofa.id,'reserved cushion remains owned during settle');
 steps=0;while(actor.path.length&&steps++<100){const before={...actor.position};time+=.05;const result=layer.step(time).get(actor.id);assert.match(result.thought,/ออฟไลน์/);assert.notEqual(actor.action,'walking');assert.equal(layer.navigation.isSegmentWalkable(before,actor.position,{ignoreIds:[sofa.objectId]}),true);}
 assert.ok(steps<100);assert.equal(actor.station.id,sofa.id);assert.deepEqual(actor.position,sofa.seat);
 const stopped={...actor.position};for(let i=0;i<100;i++){time+=.05;layer.step(time);}assert.deepEqual(actor.position,stopped);
 for(const side of ['left','right'])assert.ok(Math.abs(new THREE.Box3().setFromObject(actor.model.userData.runtimeCharacter.fallback.userData.officeCharacter.rig.legs[side].shoe).min.y)<.001);
 assert.ok(Math.abs(pelvisContactY(actor.model)-(sofa.seatHeight-.01))<.001);
});
test('unknown and offline during final chair entry settle into the reserved desk without typing',t=>{
 const {layer}=fixture(t),[actor,other]=layer.actors.values(),home=actor.station;let time=0;
 for(const status of ['unknown','offline']){
  layer.setAgentStates([{avatarId:actor.id,state:'idle',source:'synthetic regression'}]);actor.mode='auto';
  assert.equal(layer.travel(actor,layer.stationFor(actor,'water')),true);
  let steps=0;while(actor.path.length&&steps++<1600){time+=.05;layer.step(time);}assert.equal(actor.station.type,'water');
  assert.equal(layer.travel(actor,home),true);
  steps=0;while(actor.path.length&&steps++<1600){time+=.05;layer.step(time);if(!layer.navigation.isWalkable(actor.position)&&groundToWorld(actor.position).distanceTo(groundToWorld(home.seat))<.3)break;}
  assert.ok(actor.path.length&&steps<1600);const entry={...actor.position};
  layer.setAgentStates(status==='unknown'?[]:[{avatarId:actor.id,state:status,source:'synthetic regression'}]);
  assert.deepEqual(actor.position,entry);assert.equal(actor.action,'sitting');assert.equal(actor.target.id,home.id);assert.equal(layer.stationOccupied(home,other),true);
  steps=0;while(actor.path.length&&steps++<100){const before={...actor.position};time+=.05;const result=layer.step(time).get(actor.id);assert.equal(result.status.state,status);assert.equal(actor.action,'sitting');assert.equal(layer.navigation.isSegmentWalkable(before,actor.position,{ignoreIds:[home.seatObjectId]}),true);}
  assert.ok(steps<100);assert.equal(actor.station.id,home.id);assert.deepEqual(actor.position,home.seat);
  const stopped={...actor.position};for(let i=0;i<100;i++){time+=.05;layer.step(time);}assert.deepEqual(actor.position,stopped);assert.equal(actor.action,'sitting');
  for(const side of ['left','right'])assert.ok(Math.abs(new THREE.Box3().setFromObject(actor.model.userData.runtimeCharacter.fallback.userData.officeCharacter.rig.legs[side].shoe).min.y)<.001);
  assert.ok(Math.abs(pelvisContactY(actor.model)-(home.seatHeight-.01))<.001);
 }
});
