import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createHumanCharacter,poseHumanCharacter} from '../web/characters/human.js';

test('Zuri skin and hair retain soft dielectric highlights instead of flat chalk or metal',()=>{
  const root=createHumanCharacter('zuri');
  for(const [name,min,max]of [['sculpted-face',.4,.65],['hair-volume',.25,.48]]){
    const material=root.getObjectByName(name).material;
    assert.ok(material.isMeshPhysicalMaterial,`${name}: physical surface`);
    assert.equal(material.metalness,0);
    assert.ok(material.roughness>=min&&material.roughness<=max,`${name}: bounded sheen`);
    assert.ok(material.clearcoat<=.15,'skin and hair must not look lacquered');
  }
});

test('Zuri swept fringe has curved depth and a softly varying edge, not a straight cut plane',()=>{
  const root=createHumanCharacter('zuri'),fringe=root.getObjectByName('swept-fringe-surface');
  assert.ok(fringe,'separate swept fringe supports curved silhouette');
  const p=fringe.geometry.attributes.position,uv=fringe.geometry.attributes.uv,edge=[];
  for(let i=0;i<p.count;i++)if(uv.getY(i)>.99)edge.push([p.getX(i),p.getY(i),p.getZ(i)]);
  assert.ok(Math.max(...edge.map(p=>p[1]))-Math.min(...edge.map(p=>p[1]))>.018);
  assert.ok(new T.Box3().setFromBufferAttribute(p).getSize(new T.Vector3()).z>.065);
  assert.ok(p.count<4000,'curved hair does not consume the runtime budget');
});

test('closed Zuri face and bob surfaces have coincident seam vertices and continuous shading normals',()=>{
  const root=createHumanCharacter('zuri');
  for(const name of ['sculpted-face','hair-volume','bob-inner-volume','bob-turned-under-edge']){
    const geometry=root.getObjectByName(name).geometry,{position:p,normal:n}=geometry.attributes;let start=-1,pairs=0;
    const stride=Math.max(...geometry.index.array.slice(0,3));
    for(let i=0;i<p.count;i++){
      // The face UV is projected; recover row topology from the first triangle.
      if(i%stride===0)start=i;
      if(i%stride===stride-1){
        const a=new T.Vector3().fromBufferAttribute(p,start),b=new T.Vector3().fromBufferAttribute(p,i);
        assert.ok(a.distanceTo(b)<1e-6,`${name}: open seam ${a.distanceTo(b)} m`);
        assert.ok(new T.Vector3().fromBufferAttribute(n,start).distanceTo(new T.Vector3().fromBufferAttribute(n,i))<1e-5,`${name}: visible normal seam`);pairs++;
      }
    }
    assert.ok(pairs>=5);
  }
});

test('Zuri local reconstruction is rounded geometry with front-only facial projection',()=>{
  const root=createHumanCharacter('zuri'),face=root.getObjectByName('sculpted-face');
  assert.equal(root.userData.authorship,'local-zuri-sculpt-v1');
  const b=new T.Box3().setFromObject(face),size=b.getSize(new T.Vector3());
  assert.ok(size.z>.16&&size.x>.18&&size.y>.25,'head has actual volume, not an image plane');
  const p=face.geometry.attributes.position,uv=face.geometry.attributes.uv;
  let back=0;for(let i=0;i<p.count;i++)if(p.getZ(i)<-.04){back++;assert.ok(uv.getX(i)<.02&&uv.getY(i)<.02,'back cannot repeat eyes or mouth');}
  assert.ok(back>100);assert.ok(root.getObjectByName('anatomical-right-orange-clip').position.x<0);
});
test('Zuri painted eyes close behind geometry and reopen without changing root or identity',()=>{
  const root=createHumanCharacter('zuri');root.position.set(2,0,3);
  poseHumanCharacter(root,{action:'idle',time:0});const lid=root.getObjectByName('blink-cover--1'),open=lid.scale.y;
  poseHumanCharacter(root,{action:'idle',time:5.1*4/(2*Math.PI)});
  assert.ok(lid.scale.y>.98&&open<.01);
  poseHumanCharacter(root,{action:'walking',time:.4});assert.ok(lid.scale.y<.01);
  assert.deepEqual(root.position.toArray(),[2,0,3]);assert.equal(root.userData.characterId,'zuri');
});

test('Zuri eyewear and clip rest on their authored surfaces instead of floating off the head',()=>{
  const root=createHumanCharacter('zuri');root.updateMatrixWorld(true);
  const head=root.getObjectByName('head'),direction=new T.Vector3(0,0,1).transformDirection(head.matrixWorld);
  for(const [name,surface,maxGap]of [['round-glasses-left','sculpted-face',.012],['round-glasses-right','sculpted-face',.012],['anatomical-right-orange-clip','hair-volume',.018]]){
    const accessory=root.getObjectByName(name),targets=[root.getObjectByName(surface)],p=accessory.geometry.attributes.position;let hits=0;
    if(name==='anatomical-right-orange-clip')targets.push(root.getObjectByName('swept-fringe-surface'));
    for(let i=0;i<p.count;i+=4){
      const vertex=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(accessory.matrixWorld);
      const origin=vertex.clone().addScaledVector(direction,.1),hit=new T.Raycaster(origin,direction.clone().negate()).intersectObjects(targets,false)[0];
      assert.ok(hit,`${name}: no supporting surface beneath vertex ${i}`);hits++;
      const gap=hit.distance-.1;assert.ok(gap>-.002&&gap<maxGap,`${name} gap ${gap} m at vertex ${i}`);
    }
    assert.ok(hits>=30);
  }
});
