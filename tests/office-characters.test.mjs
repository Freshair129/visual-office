import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createOfficeCharacter,updateOfficeCharacter,disposeOfficeCharacter} from '../web/office-characters.js';

const create=(index=0)=>createOfficeCharacter(index);
const rigOf=group=>group.userData.officeCharacter.rig;
const worldPosition=(object)=>{object.updateWorldMatrix(true,false);return object.getWorldPosition(new THREE.Vector3());};
const triangleCount=group=>{
  let total=0;
  group.traverse(object=>{
    if(!object.isMesh)return;
    const geometry=object.geometry;
    total+=geometry.index?geometry.index.count/3:(geometry.getAttribute('position')?.count??0)/3;
  });
  return total;
};
test('clothing is genuinely skinned connected topology with no capsule segments or joint balls',()=>{
 const group=create();try{
  const garments=[];group.traverse(n=>{if(n.isSkinnedMesh)garments.push(n);assert.notEqual(n.geometry?.type,'CapsuleGeometry');assert.ok(!/-(knee|elbow|shoulder)-joint$/.test(n.name));});
  assert.equal(garments.length,2,'one connected shirt with sleeves and one connected pair of trousers');
  for(const garment of garments){
   const g=garment.geometry,adj=Array.from({length:g.attributes.position.count},()=>new Set());
   for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(j=>g.index.getX(i+j));for(const a of ids)for(const b of ids)if(a!==b)adj[a].add(b);}
   const reached=new Set([0]),queue=[0];for(let q=0;q<queue.length;q++)for(const v of adj[queue[q]])if(!reached.has(v)){reached.add(v);queue.push(v);}
   assert.equal(reached.size,g.attributes.position.count,`${garment.name} has no disconnected sleeve/leg pieces`);
   const weights=g.attributes.skinWeight,indices=g.attributes.skinIndex;let blended=0;
   for(let i=0;i<weights.count;i++){const ws=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];assert.ok(Math.abs(ws.reduce((a,b)=>a+b,0)-1)<1e-6);if(ws.filter(w=>w>0).length>1)blended++;assert.ok(indices.getX(i)<garment.skeleton.bones.length);}
   assert.ok(blended>30,`${garment.name} deforms across blended seams`);
  }
 }finally{disposeOfficeCharacter(group);}
});

test('builds twelve neutral adult variants from palettes and hair shapes, with repeatable selection',()=>{
  const characters=Array.from({length:12},(_,index)=>create(index));
  const wrapped=create(12);
  try{
    const variants=characters.map(group=>group.userData.officeCharacter);
    assert.deepEqual(variants.map(value=>value.variant),Array.from({length:12},(_,index)=>index));
    assert.equal(new Set(variants.map(value=>value.hairStyle)).size,6);
    const shirtColors=characters.map(group=>{
      let color;
      group.traverse(object=>{if(object.name==='office-shirt')color=object.material.color.getHex();});
      return color;
    });
    assert.equal(new Set(shirtColors).size,12);
    assert.ok(characters.every(group=>triangleCount(group)<18_000));
    assert.equal(wrapped.userData.officeCharacter.variant,0);
    assert.equal(wrapped.userData.officeCharacter.hairStyle,variants[0].hairStyle);
    assert.ok(characters.every(group=>group.isGroup));
    assert.ok(characters.every(group=>group.userData.officeCharacter.identity===undefined));
  }finally{characters.forEach(disposeOfficeCharacter);disposeOfficeCharacter(wrapped);}
});

test('walking articulates opposite arms and legs while preserving the externally placed root',()=>{
  const group=create(2),root=new THREE.Vector3(3.5,1.25,-7);
  group.position.copy(root);
  const rig=rigOf(group);
  try{
    updateOfficeCharacter(group,{action:'walking',time:0.4,heading:Math.PI/3});
    const first={leftLeg:rig.legs.left.hip.rotation.x,rightLeg:rig.legs.right.hip.rotation.x,leftArm:rig.arms.left.shoulder.rotation.x,rightArm:rig.arms.right.shoulder.rotation.x,bob:rig.body.position.y};
    assert.notEqual(first.leftLeg,first.rightLeg);
    assert.notEqual(first.leftArm,first.rightArm);
    assert.equal(group.rotation.y,Math.PI/3);
    assert.ok(Math.abs(first.bob-rig.standingHipHeight)<0.05);
    updateOfficeCharacter(group,{action:'walking',time:1.1,heading:-0.4});
    assert.notEqual(rig.legs.left.hip.rotation.x,first.leftLeg);
    assert.deepEqual(group.position.toArray(),root.toArray());
    assert.ok([group.position.x,group.position.y,group.position.z,group.rotation.x,group.rotation.y,group.rotation.z].every(Number.isFinite));
  }finally{disposeOfficeCharacter(group);}
});

test('seated work uses a 0.66 m seat anchor, bent knees, forward typing hands and a stable head height',()=>{
  const group=create(4),rig=rigOf(group);
  try{
    updateOfficeCharacter(group,{action:'seated',time:9,heading:0});
    group.updateMatrixWorld(true);
    assert.ok(Math.abs(rig.body.position.y-0.66)<1e-9);
    assert.ok(Math.abs(rig.legs.left.knee.rotation.x-Math.acos((.66-.01-.44-.06)/.43))<0.02);
    assert.ok(Math.abs(rig.legs.right.knee.rotation.x-Math.acos((.66-.01-.44-.06)/.43))<0.02);
    const hands=[worldPosition(rig.arms.left.hand),worldPosition(rig.arms.right.hand)];
    assert.ok(hands.every(point=>point.y>0.75&&point.y<.98));
    assert.ok(hands.every(point=>point.z>0.18));
    const head=worldPosition(rig.head);
    assert.ok(head.y>1.05&&head.y<1.38,`seated head center was ${head.y.toFixed(3)}m`);
    for(const side of ['left','right']){
      const shoeBounds=new THREE.Box3().setFromObject(rig.legs[side].shoe);
      assert.ok(Math.abs(shoeBounds.min.y)<0.03,`${side} shoe should meet the floor, min y=${shoeBounds.min.y.toFixed(3)}m`);
    }
    assert.equal(rig.arms.right.mug.visible,false);
    assert.deepEqual(group.position.toArray(),[0,0,0]);
  }finally{disposeOfficeCharacter(group);}
});

test('thinking, drinking, sofa-resting and idle set coherent distinct poses without root translation',()=>{
  const group=create(8),rig=rigOf(group),root=new THREE.Vector3(-2,0.2,4);
  group.position.copy(root);
  try{
    const poses=[];
    for(const action of ['idle','thinking','drinking','resting']){
      updateOfficeCharacter(group,{action,time:12.5,heading:0.25});
      group.updateMatrixWorld(true);
      poses.push([rig.body.position.y,rig.arms.right.shoulder.rotation.x,rig.arms.right.elbow.rotation.x,rig.head.rotation.x]);
      assert.equal(rig.arms.right.mug.visible,action==='drinking');
      if(action==='resting'){
        assert.ok(Math.abs(rig.body.position.y-0.62)<1e-9);
        for(const side of ['left','right']){
          const shoeBounds=new THREE.Box3().setFromObject(rig.legs[side].shoe);
          const relativeSoleY=shoeBounds.min.y-root.y;
          assert.ok(Math.abs(relativeSoleY)<0.03,`${side} sofa-rest shoe should meet the root ground plane, relative min y=${relativeSoleY.toFixed(3)}m`);
        }
      }
      assert.deepEqual(group.position.toArray(),root.toArray());
      assert.ok([rig.body.position.y,...poses.at(-1)].every(Number.isFinite));
    }
    assert.equal(new Set(poses.map(pose=>pose.join(','))).size,4);
    updateOfficeCharacter(group,{action:'unknown',time:0,heading:0});
    assert.equal(rig.body.position.y,rig.standingHipHeight);
    updateOfficeCharacter(group,{action:'seated',time:0,heading:0,seatHeight:0.52});
    assert.ok(Math.abs(rig.body.position.y-0.52)<1e-9);
    assert.deepEqual(group.position.toArray(),root.toArray());
  }finally{disposeOfficeCharacter(group);}
});

test('geometry stays finite and below the per-character triangle budget across every pose',()=>{
  const group=create(10),rig=rigOf(group);
  try{
    for(const action of ['idle','walking','seated','thinking','drinking','resting']){
      updateOfficeCharacter(group,{action,time:2.75,heading:0.7});
      group.updateMatrixWorld(true);
      if(action==='idle'){
        const bounds=new THREE.Box3().setFromObject(group);
        assert.ok(bounds.max.y-bounds.min.y>1.6&&bounds.max.y-bounds.min.y<1.75,`adult stature was ${(bounds.max.y-bounds.min.y).toFixed(3)}m`);
      }
      assert.ok(triangleCount(group)<18_000,`${triangleCount(group)} triangles for ${action}`);
      group.traverse(object=>{
        for(const vector of [object.position,object.rotation,object.scale])
          assert.ok([vector.x,vector.y,vector.z].every(Number.isFinite),`${object.name} has non-finite transform`);
        if(object.isMesh){
          const position=object.geometry.getAttribute('position');
          for(let index=0;index<position.count;index++)
            assert.ok(Number.isFinite(position.getX(index))&&Number.isFinite(position.getY(index))&&Number.isFinite(position.getZ(index)));
        }
      });
    }
  }finally{disposeOfficeCharacter(group);}
});

test('dispose releases each owned geometry and material once and detaches the character',()=>{
  const scene=new THREE.Group(),group=create(1);scene.add(group);
  const geometries=new Set(),materials=new Set(),counts=new Map();
  group.traverse(object=>{
    if(!object.isMesh)return;
    geometries.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
  });
  for(const resource of [...geometries,...materials]){
    const dispose=resource.dispose.bind(resource);
    resource.dispose=()=>{counts.set(resource,(counts.get(resource)??0)+1);dispose();};
  }
  disposeOfficeCharacter(group);
  disposeOfficeCharacter(group);
  assert.equal(scene.children.includes(group),false);
  assert.equal(group.children.length,0);
  assert.equal(counts.size,geometries.size+materials.size);
  assert.ok([...counts.values()].every(count=>count===1));
});
test('skin deformation retains shared seams and correct root transforms through every office pose',()=>{
 const group=create();try{
  const garments=group.userData.officeCharacter.garments.meshes,counts=garments.map(m=>m.geometry.attributes.position.count);
  for(const action of ['idle','walking','seated','resting','thinking','drinking']){
   updateOfficeCharacter(group,{action,time:.4,walkDistance:.27,seatHeight:.65});group.updateMatrixWorld(true);
   for(const [j,m]of garments.entries()){
    assert.equal(m.geometry.attributes.position.count,counts[j]);const vertices=Array.from({length:counts[j]},(_,i)=>m.getVertexPosition(i,new THREE.Vector3()));
    for(const p of vertices){assert.ok(p.toArray().every(Number.isFinite));assert.ok(m.boundingBox.clone().expandByScalar(1e-5).containsPoint(p),'fast per-bone bounds contain every actual deformed vertex');}
    const edgeCounts=new Map();for(let i=0;i<m.geometry.index.count;i+=3){const ids=[0,1,2].map(k=>m.geometry.index.getX(i+k)),normal=new THREE.Vector3().subVectors(vertices[ids[1]],vertices[ids[0]]).cross(new THREE.Vector3().subVectors(vertices[ids[2]],vertices[ids[0]]));assert.ok(normal.length()>1e-9,'deformed triangle keeps a finite nonzero normal');for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[a,b].sort((x,y)=>x-y).join(':');edgeCounts.set(key,(edgeCounts.get(key)||0)+1);}}
    assert.ok([...edgeCounts.values()].every(n=>n<=2),'no non-manifold garment seam');
   }
  }
  updateOfficeCharacter(group,{action:'seated',seatHeight:.65});const before=garments.map(m=>m.getVertexPosition(10,new THREE.Vector3()));
  group.position.set(4,1,-3);group.scale.setScalar(1.2);updateOfficeCharacter(group,{action:'seated',seatHeight:.65,heading:.8});group.updateMatrixWorld(true);
  for(const [i,m]of garments.entries()){const actual=m.getVertexPosition(10,new THREE.Vector3()).applyMatrix4(m.matrixWorld),expected=before[i].applyMatrix4(group.matrixWorld);assert.ok(actual.distanceTo(expected)<1e-6,'bind matrices apply root transform exactly once');}
 }finally{disposeOfficeCharacter(group);}
});
test('front scalp leaves eyes, nose and smile visible and relaxed elbows bend forward',()=>{
 for(let variant=0;variant<12;variant++){
  const group=create(variant);try{
   updateOfficeCharacter(group,{action:'idle',time:0});group.updateMatrixWorld(true);
   for(const name of ['office-eye-left','office-eye-right','office-nose']){
    const feature=group.getObjectByName(name),p=feature.getWorldPosition(new THREE.Vector3()),ray=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,0,1)),new THREE.Vector3(0,0,-1));const hit=ray.intersectObject(group,true)[0];assert.ok(hit&&!hit.object.name.startsWith('office-hair'),`${variant}: ${name} is not buried in the scalp`);
   }
   assert.ok(group.userData.officeCharacter.rig.arms.left.elbow.rotation.x<0);
  }finally{disposeOfficeCharacter(group);}
 }
});
test('disposing a rendered skin releases its skeleton bone texture exactly once',()=>{
 const group=create(),skeleton=group.userData.officeCharacter.garments.skeleton;skeleton.computeBoneTexture();let disposed=0;skeleton.boneTexture.addEventListener('dispose',()=>disposed++);
 disposeOfficeCharacter(group);disposeOfficeCharacter(group);assert.equal(disposed,1);
});
