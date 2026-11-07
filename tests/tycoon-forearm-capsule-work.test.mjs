import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonArmContact} from '../web/tycoon-arm-contact.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

async function loadActor(){
  const bytes=await readFile('web/assets/models/tycoon-factory/actor-rig-v3.glb');
  return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}

// Frozen reference for the helpers as they existed before this optimization.
function referenceMeshCapsuleRadius(mesh,start,end,fallback,counts){
  if(!mesh?.isSkinnedMesh)return fallback;
  mesh.skeleton.update();const axis=end.clone().sub(start),lengthSq=axis.lengthSq();if(lengthSq<1e-10)return fallback;
  const point=new THREE.Vector3();let furthest=0;
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    mesh.getVertexPosition(i,point);mesh.localToWorld(point);const t=clamp(point.clone().sub(start).dot(axis)/lengthSq,0,1),nearest=start.clone().addScaledVector(axis,t);counts.distanceToCalls++;furthest=Math.max(furthest,point.distanceTo(nearest));
  }
  return Math.max(fallback,furthest+.002);
}

function referenceDistanceToSegment(point,start,end,counts){
  const axis=end.clone().sub(start),lengthSq=axis.lengthSq(),t=lengthSq<1e-10?0:clamp(point.clone().sub(start).dot(axis)/lengthSq,0,1);
  counts.distanceToCalls++;return point.distanceTo(start.clone().addScaledVector(axis,t));
}

function referenceForearmCapsuleSet(mesh,start,end,side,counts){
  const shaftRadius=.076;
  if(!mesh?.isSkinnedMesh)return {shaft:{name:`${side}-forearm`,side,start:start.clone(),end:end.clone(),radius:shaftRadius},bulge:{name:`${side}-forearm-bulge`,side,start:start.clone(),end:start.clone(),radius:.001}};
  mesh.skeleton.update();const geometry=mesh.geometry,count=geometry.index?.count||geometry.attributes.position.count,points=new Array(geometry.attributes.position.count),point=new THREE.Vector3();
  for(let i=0;i<points.length;i++){mesh.getVertexPosition(i,point);points[i]=mesh.localToWorld(point).clone();}
  const axis=end.clone().sub(start),lengthSq=axis.lengthSq(),selected=new Set();
  const triangleIndices=i=>[geometry.index?.getX(i)??i,geometry.index?.getX(i+1)??i+1,geometry.index?.getX(i+2)??i+2];
  for(let i=0;i+2<count;i+=3){const indices=triangleIndices(i);if(indices.some(index=>referenceDistanceToSegment(points[index],start,end,counts)>shaftRadius))indices.forEach(index=>selected.add(index));}
  if(!selected.size)return {shaft:{name:`${side}-forearm`,side,start:start.clone(),end:end.clone(),radius:shaftRadius},bulge:{name:`${side}-forearm-bulge`,side,start:start.clone(),end:start.clone(),radius:.001}};
  let minT=Infinity,maxT=-Infinity;for(const index of selected){const t=points[index].clone().sub(start).dot(axis)/lengthSq;minT=Math.min(minT,t);maxT=Math.max(maxT,t);}
  const bulgeStart=start.clone().addScaledVector(axis,minT),bulgeEnd=start.clone().addScaledVector(axis,maxT);let bulgeRadius=.0;
  for(const index of selected)bulgeRadius=Math.max(bulgeRadius,referenceDistanceToSegment(points[index],bulgeStart,bulgeEnd,counts));
  return {shaft:{name:`${side}-forearm`,side,start:start.clone(),end:end.clone(),radius:shaftRadius},bulge:{name:`${side}-forearm-bulge`,side,start:bulgeStart,end:bulgeEnd,radius:bulgeRadius+.002}};
}

function referenceArmCapsules(controller){
  const counts={distanceToCalls:0},expected=[];
  controller.actor.updateMatrixWorld(true);
  for(const arm of controller.arms){
    const shoulder=arm.shoulder.getWorldPosition(new THREE.Vector3()),elbow=arm.elbow.getWorldPosition(new THREE.Vector3()),wrist=arm.hand.getWorldPosition(new THREE.Vector3());
    const upperRadius=referenceMeshCapsuleRadius(controller.actor.getObjectByName(`office-${arm.side}-shoulder-joint`),shoulder,elbow,arm.upperRadius,counts);
    const forearm=referenceForearmCapsuleSet(controller.actor.getObjectByName(`office-${arm.side}-elbow-joint`),elbow,wrist,arm.side,counts);
    expected.push({name:`${arm.side}-upper-arm`,side:arm.side,start:shoulder,end:elbow,radius:upperRadius},forearm.shaft,forearm.bulge);
  }
  return {expected,counts};
}

function trackMeshWorldCalls(mesh){
  const originals={updateWorldMatrix:mesh.updateWorldMatrix,localToWorld:mesh.localToWorld};
  const calls={updateWorldMatrix:0,localToWorld:0};
  mesh.updateWorldMatrix=function(...args){calls.updateWorldMatrix++;return originals.updateWorldMatrix.apply(this,args);};
  mesh.localToWorld=function(...args){calls.localToWorld++;return originals.localToWorld.apply(this,args);};
  return {calls,restore(){mesh.updateWorldMatrix=originals.updateWorldMatrix;mesh.localToWorld=originals.localToWorld;}};
}

function distanceToSegment(point,start,end){
  const axis=end.clone().sub(start),lengthSq=axis.lengthSq(),t=lengthSq<1e-10?0:clamp(point.clone().sub(start).dot(axis)/lengthSq,0,1);
  return point.distanceTo(start.clone().addScaledVector(axis,t));
}

function assertSkinnedVerticesCovered(mesh,capsules,label){
  mesh.skeleton.update();mesh.updateWorldMatrix(true,false);const point=new THREE.Vector3(),count=mesh.geometry.attributes.position.count;
  for(let i=0;i<count;i++){
    mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);
    assert.ok(capsules.some(capsule=>distanceToSegment(point,capsule.start,capsule.end)<=capsule.radius+1e-8),`${label} deformed vertex ${i} is outside its arm capsule set`);
  }
}

test('actual arm GLB capsules retain exact reference output across poses while reusing world transforms and per-vertex distance work',async t=>{
  const actor=await loadActor(),controller=new TycoonArmContact(actor),parent=new THREE.Group();
  assert.equal(controller.valid,true,'the actual actor-rig-v3 supports arm capsule extraction');
  const armMeshes=['left','right'].flatMap(side=>[`office-${side}-shoulder-joint`,`office-${side}-elbow-joint`].map(name=>actor.getObjectByName(name)));
  assert.ok(armMeshes.every(mesh=>mesh?.isSkinnedMesh),'both actual GLB arms contain skinned shoulder and forearm meshes');
  parent.add(actor);

  const poses=[
    ['bind pose',()=>{}],
    ['changed actor parent transform',()=>{parent.position.set(.37,-.12,.61);parent.rotation.set(.21,.44,-.16);parent.scale.setScalar(1.17);}],
    ['deformed shoulder and elbow bones',()=>{
      const leftShoulder=actor.getObjectByName('office-left-shoulder'),rightElbow=actor.getObjectByName('office-right-elbow');
      leftShoulder.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.11));
      rightElbow.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.14));
    }],
    ['deformed forearm mesh matrix',()=>{
      const mesh=actor.getObjectByName('office-left-elbow-joint');mesh.position.add(new THREE.Vector3(.013,.009,-.011));mesh.rotation.y+=.025;mesh.scale.set(1.025,.985,1.015);
    }],
  ];

  for(const [pose,applyPose] of poses){
    applyPose();parent.updateMatrixWorld(true);actor.updateMatrixWorld(true);
    const {expected,counts:referenceCounts}=referenceArmCapsules(controller),worldTrackers=armMeshes.map(trackMeshWorldCalls),originalDistanceTo=THREE.Vector3.prototype.distanceTo;
    let actualDistanceToCalls=0,actual;
    THREE.Vector3.prototype.distanceTo=function(...args){actualDistanceToCalls++;return originalDistanceTo.apply(this,args);};
    try{actual=controller.capsules().filter(capsule=>/(upper-arm|forearm)/.test(capsule.name));}
    finally{THREE.Vector3.prototype.distanceTo=originalDistanceTo;}
    const worldCounts=worldTrackers.map(tracker=>({...tracker.calls}));worldTrackers.forEach(tracker=>tracker.restore());

    t.diagnostic(JSON.stringify({pose,verticesPerMesh:armMeshes.map(mesh=>mesh.geometry.attributes.position.count),worldCounts,referenceDistanceToCalls:referenceCounts.distanceToCalls,actualDistanceToCalls}));
    assert.deepEqual(actual.map(capsule=>({...capsule,start:capsule.start.toArray(),end:capsule.end.toArray()})),expected.map(capsule=>({...capsule,start:capsule.start.toArray(),end:capsule.end.toArray()})),`${pose} capsule order, coordinates and radii must match the frozen reference exactly`);
    assert.ok(worldCounts.every(calls=>calls.updateWorldMatrix===1&&calls.localToWorld===0),`${pose} updates each skinned mesh world matrix once and never repeats localToWorld: ${JSON.stringify(worldCounts)}`);
    assert.ok(actualDistanceToCalls<referenceCounts.distanceToCalls,`${pose} evaluates fewer point-to-segment distances (${actualDistanceToCalls} vs ${referenceCounts.distanceToCalls})`);

    for(const side of ['left','right']){
      const shoulder=actor.getObjectByName(`office-${side}-shoulder-joint`),forearm=actor.getObjectByName(`office-${side}-elbow-joint`);
      assertSkinnedVerticesCovered(shoulder,actual.filter(capsule=>capsule.name===`${side}-upper-arm`),`${pose} ${side} shoulder`);
      assertSkinnedVerticesCovered(forearm,actual.filter(capsule=>capsule.name===`${side}-forearm`||capsule.name===`${side}-forearm-bulge`),`${pose} ${side} forearm`);
    }
  }
});
