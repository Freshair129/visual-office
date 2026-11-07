import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {externalAssetTest} from './external-assets-helper.mjs';
import {AnimationMixer,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

async function loadGeometry(){
  const file=await readFile(new URL('../web/assets/models/characters/candidates/zuri-anime.glb',import.meta.url));
  const size=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+size));
  // Retain the exact geometry, skin and animations. This Node-only check does
  // not decode images or constitute visual verification.
  delete doc.images;delete doc.textures;delete doc.materials;
  for(const m of doc.meshes)for(const p of m.primitives)delete p.material;
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const tail=file.subarray(20+size),h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(20+json.length+tail.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);
  const b=Buffer.concat([h,json,tail]);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
}
function vertices(root,name){
  const points=[];root.traverse(o=>{
    if(!o.isMesh)return;
    let owner=o;while(owner&&!owner.name.startsWith(name))owner=owner.parent;
    if(!owner)return;
    o.skeleton?.update();const a=o.geometry.attributes.position;
    for(let i=0;i<a.count;i++){
      const p=new Vector3().fromBufferAttribute(a,i);if(o.isSkinnedMesh)o.applyBoneTransform(i,p);p.applyMatrix4(o.matrixWorld);
      assert.ok([p.x,p.y,p.z].every(Number.isFinite));points.push(p);
    }
  });assert.ok(points.length>0,name);return points;
}
externalAssetTest('loaded animated soles remain grounded and seated skin meets the chair height',['web/assets/models/characters/candidates/zuri-anime.glb'],async()=>{
  const g=await loadGeometry(),mixer=new AnimationMixer(g.scene);
  for(const name of ['idle','walking','seated']){
    mixer.stopAllAction();const clip=g.animations.find(a=>a.name===name);assert.ok(clip);mixer.clipAction(clip).reset().play();
    for(let i=0;i<12;i++){
      mixer.setTime(clip.duration*i/12);g.scene.updateMatrixWorld(true);
      const feet=vertices(g.scene,'Shoes'),low=Math.min(...feet.map(p=>p.y));
      assert.ok(low>=-.002,`${name} sample ${i}: sole below ground (${low})`);
      assert.ok(low<=.002,`${name} sample ${i}: soles float (${low})`);
    }
    if(name==='seated'){
      const pants=vertices(g.scene,'Pant').filter(p=>Math.abs(p.x)<.18&&p.z>-.235&&p.z<.165);
      assert.ok(pants.length>0);
      const seatBottom=Math.min(...pants.map(p=>p.y));
      assert.ok(seatBottom>=.39&&seatBottom<=.46,`pelvis near chair top .410m: ${seatBottom}`);
      const hands=vertices(g.scene,'Hands'),overDesk=hands.filter(p=>Math.abs(p.x)<.425&&p.z>=.430&&p.z<=.880);
      assert.ok(overDesk.length>0,'seated hands reach the actual reference desk');
      assert.ok(overDesk.every(p=>p.y>=.7655),`hands must not penetrate the .7675m desktop beyond 2mm: min=${Math.min(...overDesk.map(p=>p.y))}`);
      assert.ok(Math.min(...overDesk.map(p=>p.y))<=.81,'hands remain near the work surface');
    }
  }
});
