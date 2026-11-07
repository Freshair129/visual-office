import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,Quaternion,Box3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterLibrary,updateCharacter} from '../web/characters/runtime.js';
import {characterAsset,characterLegs} from '../web/characters/runtime-catalog.js';
import {externalAssetTest} from './external-assets-helper.mjs';
async function loadGeometry(path){
  const file=await readFile(new URL('../web/'+path.replace('./',''),import.meta.url));
  const size=file.readUInt32LE(12),doc=JSON.parse(file.subarray(20,20+size));
  // Retain the exact geometry, skin and animations. This Node-only check does
  // not decode images or constitute visual verification.
  delete doc.images;delete doc.textures;delete doc.materials;
  for(const m of doc.meshes)for(const p of m.primitives)delete p.material;
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const tail=file.subarray(20+size),h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(20+json.length+tail.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);
  const b=Buffer.concat([h,json,tail]);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
}

for(const surface of ['lab','hybrid'])externalAssetTest(`${surface}: short Wangjai rests its body on the seat with unchanged rigid legs and naturally dangling feet`,[`web/${characterAsset('wangjai',surface).path.replace(/^\.\//,'')}`],async()=>{
 const info=characterAsset('wangjai',surface),source=await loadGeometry(info.path),library=new CharacterLibrary({load:async()=>source}),actor=library.create('wangjai');
 await actor.userData.runtimeCharacter.ready;actor.position.set(2,0,3);
 const shell=actor.getObjectByName('wangjai-shell'),sole=actor.getObjectByName('wangjai-left-sole'),hip=actor.getObjectByName('wangjai-left-leg'),ankle=actor.getObjectByName('wangjai-left-ankle');
 assert.ok(shell&&sole&&hip&&ankle);const sourceLength=ankle.position.length();
 for(const scale of [.8,1,1.12])for(const heading of [0,Math.PI/2,Math.PI])for(const height of [.34,.41,.50,.57]){
  actor.scale.setScalar(scale);updateCharacter(actor,{action:'seated',seatHeight:height/scale,heading,time:1,dt:0});actor.updateMatrixWorld(true);
  assert.ok(Math.abs(new Box3().setFromObject(shell,true).min.y-height)<.002,'mascot body touches seat instead of sinking below it');
  const foot=new Box3().setFromObject(sole,true);assert.ok(foot.min.y>0&&foot.min.y<height,'short rigid feet dangle naturally below the seated body');
  assert.ok(Math.abs(hip.getWorldPosition(new Vector3()).distanceTo(ankle.getWorldPosition(new Vector3()))-sourceLength*scale)<1e-5,'do not stretch short mascot legs');
  assert.deepEqual(actor.position.toArray(),[2,0,3]);
 }
 updateCharacter(actor,{action:'idle',time:0,dt:0});assert.ok(Math.abs(new Box3().setFromObject(sole,true).min.y)<.002,'standing resets seat translation');
 await library.dispose();
});

for(const surface of ['lab','hybrid'])for(const id of ['staff-a','staff-b','zuri'])externalAssetTest(surface+' '+id+': loaded GLB feet retain ground contact when fitting different seats and headings',[
 `web/${characterAsset(id,surface).path.replace(/^\.\//,'')}`,
],async()=>{
 const info=characterAsset(id,surface),source=await loadGeometry(info.path),library=new CharacterLibrary({load:async()=>source}),actor=library.create(id);
 await actor.userData.runtimeCharacter.ready;assert.equal(actor.userData.runtimeCharacter.status,'ready');actor.position.set(2,0,3);actor.scale.setScalar(1.12);
 for(const heading of [0,Math.PI/2,Math.PI]){
  updateCharacter(actor,{action:'seated',seatHeight:info.seatHeight,heading,time:1,dt:0});
  const feet=characterLegs(info.family).map(names=>actor.getObjectByName(names[2]));
  const targets=feet.map(f=>({p:f.getWorldPosition(new Vector3()),q:f.getWorldQuaternion(new Quaternion()).normalize()}));
  for(const height of [.34,.41,.5,.57]){
   for(let frame=0;frame<3;frame++)updateCharacter(actor,{action:'seated',seatHeight:height,heading,time:1,dt:0});
   feet.forEach((foot,i)=>{assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(targets[i].p)<.002,`${id} height ${height}: ankle moved`);assert.ok(foot.getWorldQuaternion(new Quaternion()).normalize().angleTo(targets[i].q)<.002,`${id} height ${height} heading ${heading}: sole orientation ${foot.getWorldQuaternion(new Quaternion()).normalize().angleTo(targets[i].q)}`);});
   let sole=Infinity,vertices=0;actor.updateMatrixWorld(true);actor.traverse(mesh=>{if(!mesh.isMesh)return;let owner=mesh,shoe=false;while(owner){if(owner.name.startsWith('Shoes')||owner.name.endsWith('-shoe-sole'))shoe=true;owner=owner.parent;}if(!shoe)return;mesh.skeleton?.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);sole=Math.min(sole,p.y);vertices++;}});
   assert.ok(vertices>0);assert.ok(Math.abs(sole)<.003,`${id} fitted sole must touch ground: ${sole}`);
   assert.deepEqual(actor.position.toArray(),[2,0,3]);
  }
 }
 await library.dispose();
});
