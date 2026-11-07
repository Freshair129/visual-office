import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWangjai,poseWangjai} from '../web/characters/wangjai.js';

test('Wangjai has a grounded preview scale, smooth curved face and bounded independent resources',()=>{
 const a=createWangjai(),b=createWangjai();const bounds=new THREE.Box3().setFromObject(a);
 assert.ok(Math.abs(bounds.min.y)<1e-5);assert.ok(Math.abs(bounds.max.y-.9)<.002);
 assert.equal(a.userData.previewHeightMetres,.9);assert.equal(Object.keys(a.userData).includes('rig'),false);
 assert.doesNotThrow(()=>JSON.stringify(a.userData));
 const names=new Set();let meshes=0,triangles=0;
 a.traverse(n=>{assert.ok(!names.has(n.name),n.name);names.add(n.name);if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;assert.ok(n.material.isMeshStandardMaterial);assert.ok(n.geometry.attributes.position.array.every(Number.isFinite));assert.notEqual(n.geometry,b.getObjectByName(n.name).geometry);}});
 assert.ok(meshes<=120);assert.ok(triangles<=70000);assert.equal([...names].some(n=>/antenna|wheel/.test(n)),false);
 const face=a.getObjectByName('wangjai-visor').geometry.attributes.position;let min=Infinity,max=-Infinity;for(let i=0;i<face.count;i++){min=Math.min(min,face.getZ(i));max=Math.max(max,face.getZ(i));}assert.ok(max-min>.04,'visor wraps around the egg shell');
 for(const name of ['wangjai-eye-left','wangjai-eye-right','wangjai-smile'])assert.ok(a.getObjectByName(name));
 const shell=a.getObjectByName('wangjai-shell').geometry,positions=shell.attributes.position,normals=shell.attributes.normal;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);if(Math.hypot(x,z)>.02)assert.ok(x*normals.getX(i)+z*normals.getZ(i)>0,'shell normals face outward');}
});

test('five actions animate unique stable pivots without moving the caller root or another instance',()=>{
 const a=createWangjai(),b=createWangjai();a.position.set(3,2,-1);a.rotation.y=.5;const initial=b.userData.rig.rightArm.quaternion.clone();const poses=[];
 for(const action of ['idle','walking','wave','point','seated']){poseWangjai(a,{action,time:.35});a.updateMatrixWorld(true);poses.push(a.userData.rig.rightArm.rotation.toArray().slice(0,3).join(','));assert.deepEqual(a.position.toArray(),[3,2,-1]);assert.equal(a.rotation.y,.5);a.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite)));}
 assert.ok(new Set(poses).size>=4);assert.ok(b.userData.rig.rightArm.quaternion.equals(initial));
 poseWangjai(a,{action:'walking',time:.1});const before=a.userData.rig.leftLeg.rotation.x;poseWangjai(a,{action:'walking',time:.6});assert.notEqual(a.userData.rig.leftLeg.rotation.x,before);
 poseWangjai(a,{action:'idle',time:0});poseWangjai(b,{action:'idle',time:0});assert.ok(a.userData.rig.rightArm.quaternion.equals(b.userData.rig.rightArm.quaternion));
});

test('front facial features stay visible on the curved visor and point retracts deterministically',()=>{
 const root=createWangjai();root.updateMatrixWorld(true);
 for(const name of ['wangjai-eye-left','wangjai-eye-right']){
  const eye=root.getObjectByName(name),p=eye.getWorldPosition(new THREE.Vector3());
  const ray=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,0,1)),new THREE.Vector3(0,0,-1));
  assert.equal(ray.intersectObject(root,true)[0]?.object.name,name,'eye is not hidden inside the shell or visor');
 }
 poseWangjai(root,{action:'point'});assert.equal(root.userData.rig.rightFinger.scale.y,1);
 poseWangjai(root,{action:'wave'});assert.equal(root.userData.rig.rightFinger.scale.y,.18);
 assert.equal(root.userData.rig.rightFinger.visible,true,'exported finger remains present for transform animation');
 poseWangjai(root,{action:'seated'});assert.equal(root.userData.rig.leftLeg.rotation.x,-Math.PI/2);
 const rightHand=root.userData.rig.rightHand.getWorldPosition(new THREE.Vector3());
 poseWangjai(root,{action:'wave',time:.4});assert.ok(root.userData.rig.rightHand.getWorldPosition(new THREE.Vector3()).y>rightHand.y+.1);
});

test('exported clip durations close every animated transform without a loop seam',()=>{
 const root=createWangjai();
 for(const [action,duration]of [['idle',4],['walking',1.12],['wave',2*Math.PI/5],['point',4],['seated',4]]){
  poseWangjai(root,{action,time:0});const first=new Map();root.traverse(n=>first.set(n.name,{position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone()}));
  poseWangjai(root,{action,time:duration});root.traverse(n=>{const start=first.get(n.name);assert.ok(n.position.distanceTo(start.position)<1e-6,`${action}: ${n.name} position`);assert.ok(n.quaternion.angleTo(start.quaternion)<1e-6,`${action}: ${n.name} rotation`);assert.ok(n.scale.distanceTo(start.scale)<1e-6,`${action}: ${n.name} scale`);});
 }
});
