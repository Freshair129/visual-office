import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createHumanCharacter,poseHumanCharacter} from '../web/characters/human.js';
import {HUMAN_DESK} from '../web/characters/lab-furniture.js';

for(const kind of ['zuri','staff-a','staff-b'])test(`${kind}: independent rig, finite skin deformation and stable placement`,()=>{
  const a=createHumanCharacter(kind),b=createHumanCharacter(kind);
  assert.equal(a.userData.characterId,kind);
  assert.doesNotThrow(()=>JSON.stringify(a.userData));
  const skins=[];a.traverse(n=>{if(n.isSkinnedMesh)skins.push(n);});assert.ok(skins.length>=3);
  assert.notEqual(skins[0].skeleton,b.getObjectByName(skins[0].name).skeleton);
  a.position.set(3,0,-5);const before=b.getObjectByName('left-elbow').quaternion.clone();
  let moved=false;
  for(const action of ['idle','walking','seated','wave','point']){
    poseHumanCharacter(a,{action,time:.34});a.updateMatrixWorld(true);
    for(const m of skins){m.skeleton.update();const p=m.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i+=29){v.fromBufferAttribute(p,i);m.applyBoneTransform(i,v);assert.ok([...v].every(Number.isFinite));}}
    moved ||= Math.abs(a.getObjectByName('left-elbow').quaternion.x)>0.01;
    assert.deepEqual(a.position.toArray(),[3,0,-5]);
  }
  assert.ok(moved);assert.ok(b.getObjectByName('left-elbow').quaternion.equals(before));
});
test('Zuri dimension and non-mirrored identity remain distinct from staff',()=>{
  const z=createHumanCharacter('zuri');poseHumanCharacter(z,{action:'idle',time:0});
  const box=new T.Box3().setFromObject(z),size=box.getSize(new T.Vector3());
  assert.ok(size.y>1.59&&size.y<1.71,`height ${size.y}`);assert.ok(Math.abs(box.min.y)<.025);
  assert.ok(z.getObjectByName('anatomical-right-orange-clip').position.x<0);
  assert.ok(z.getObjectByName('round-glasses-left'));assert.ok(z.getObjectByName('cardigan'));
  for(const kind of ['staff-a','staff-b']){const a=createHumanCharacter(kind);assert.equal(a.getObjectByName('anatomical-right-orange-clip'),undefined);assert.equal(a.getObjectByName('cardigan'),undefined);}
  assert.throws(()=>createHumanCharacter('finance-agent'),/Unknown/);
});
test('human outward face normals and bounded smooth topology',()=>{
  const a=createHumanCharacter('zuri'),face=a.getObjectByName('sculpted-face');let z=0,n=0,triangles=0,meshes=0;
  for(let i=0;i<face.geometry.attributes.position.count;i++)if(face.geometry.attributes.position.getZ(i)>.06){z+=face.geometry.attributes.normal.getZ(i);n++;}
  assert.ok(z/n>.5,'front face normals must face camera');
  a.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;meshes++;}});
  assert.ok(triangles<120000,`${triangles} triangles`);assert.ok(meshes<=150);
});
test('walking keeps the supporting sole on the ground through the whole loop',()=>{
  const a=createHumanCharacter('zuri');for(let t=0;t<1.12;t+=.04){poseHumanCharacter(a,{action:'walking',time:t});const min=Math.min(...['left','right'].map(s=>new T.Box3().setFromObject(a.getObjectByName(`${s}-shoe-sole`),true).min.y));assert.ok(Math.abs(min)<.001,`sole at ${min} for ${t}`);}
});

test('greeting raises the palm beside the face with a bent elbow rather than pointing forward',()=>{
  const actor=createHumanCharacter('zuri'),hand=new T.Vector3(),shoulder=new T.Vector3(),elbow=new T.Vector3();
  for(let t=0;t<Math.PI*2/5;t+=.1){
    poseHumanCharacter(actor,{action:'wave',time:t});
    actor.getObjectByName('right-hand').getWorldPosition(hand);
    actor.getObjectByName('right-shoulder').getWorldPosition(shoulder);
    actor.getObjectByName('right-elbow').getWorldPosition(elbow);
    assert.ok(hand.y>shoulder.y+.08,'greeting palm must rise above shoulder');
    assert.ok(elbow.y<shoulder.y&&hand.x<shoulder.x-.1,'bent greeting arm remains beside face');
  }
});

test('seated soles stay grounded and actual palms/fingers clear the reference tabletop',()=>{
  for(const kind of ['zuri','staff-a','staff-b']){
    const a=createHumanCharacter(kind),scale=kind==='staff-b'?1.08125:1;
    for(let time=0;time<=4;time+=.2){
      poseHumanCharacter(a,{action:'seated',time});
      a.traverse(n=>{
        if(!n.isMesh||!/(sleeve|cuff|forearm|palm|finger|thumb|nail)/.test(n.name))return;
        const v=new T.Vector3(),p=n.geometry.attributes.position,d=HUMAN_DESK;
        for(let i=0;i<p.count;i++){
          v.fromBufferAttribute(p,i);if(n.isSkinnedMesh)n.applyBoneTransform(i,v);v.applyMatrix4(n.matrixWorld).divideScalar(scale);
          const inside=Math.abs(v.x)<d.width/2&&Math.abs(v.y-d.y)<d.thickness/2&&Math.abs(v.z-d.z)<d.depth/2;
          assert.equal(inside,false,`${kind}/${n.name} penetrates reference desk at ${time}`);
        }
      });
      for(const side of ['left','right']){
        const sole=new T.Box3().setFromObject(a.getObjectByName(`${side}-shoe-sole`),true);
        assert.ok(Math.abs(sole.min.y)<.001,`${kind} ${side} seated sole ${sole.min.y}`);
        for(const part of ['palm','finger-0','finger-1','finger-2','finger-3']){
          const bounds=new T.Box3().setFromObject(a.getObjectByName(`${side}-${part}`),true);
          assert.ok(bounds.min.y/scale>=.7675,`${kind} ${side}-${part} enters tabletop: ${bounds.min.y/scale}`);
          assert.ok(bounds.max.y/scale<.85,`${kind} ${side}-${part} floats above working plane`);
          assert.ok(bounds.max.z/scale>HUMAN_DESK.z-HUMAN_DESK.depth/2&&bounds.max.z/scale<HUMAN_DESK.z+HUMAN_DESK.depth/2,'palm/fingers reach working surface');
        }
      }
    }
  }
});

test('adult staff faces are distinct authored forms instead of cloned Zuri heads',()=>{
  const positions=['zuri','staff-a','staff-b'].map(id=>createHumanCharacter(id).getObjectByName('sculpted-face').geometry.attributes.position.array);
  assert.ok(positions[0].some((v,i)=>v!==positions[1][i]));assert.ok(positions[0].some((v,i)=>v!==positions[2][i]));
});
