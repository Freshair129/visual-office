import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createTycoonModel,TYCOON_ASSETS} from '../web/tycoon-models.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createTycoonNavigation,tycoonWorld,TYCOON_BUNDLED_SOFA_SEAT_HEIGHT_M} from '../web/tycoon-blueprint.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {measureSeatContact} from '../web/tycoon-seat-contact.js';
test('complete modular kit has positive metric dimensions and ground-aligned pivots',()=>{
  assert.equal(Object.keys(TYCOON_ASSETS).length,24);
  for(const [kind,meta] of Object.entries(TYCOON_ASSETS)){
    const model=createTycoonModel(kind),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(bounds.min.y)<.001,kind+' pivot');
    for(const [i,axis] of ['x','y','z'].entries())assert.ok(Math.abs(size[axis]-meta.size[i])<.002,kind+' '+axis);
  }
});
test('desk is independent from chair and catalog rejects arbitrary model keys',()=>{
  const desk=createTycoonModel('desk');let chair=false;desk.traverse(n=>{if(/chair/i.test(n.name))chair=true;});assert.equal(chair,false);
  assert.throws(()=>createTycoonModel('../../secret'));
});
test('actor GLB source has seven named clips and root translation stays caller-owned',()=>{
  const model=createTycoonModel('actor');assert.deepEqual(model.animations.map(c=>c.name),['idle','walk','sit_down','seated_work','stand_up','talk','gesture_point']);
  assert.ok(model.animations.every(c=>c.tracks.length>0));assert.ok(model.animations.every(c=>c.tracks.every(t=>!t.name.startsWith('tycoon-actor.'))));
});
test('exported GLB files match catalog hashes, contain meshes and actor animation channels',async()=>{
  const base=new URL('../web/assets/models/tycoon/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('manifest.json',base),'utf8'));
  assert.equal(manifest.assets.length,24);
  for(const asset of manifest.assets){const bytes=await fs.readFile(new URL(asset.file,base));assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));assert.ok(json.meshes.length>0);if(asset.kind==='actor'){assert.equal(json.animations.length,7);assert.ok(json.animations.every(a=>a.channels.length>0));}}
});

test('bundled sofa station height matches its actual seat GLB at supported uniform scales',async()=>{
  const bytes=await fs.readFile(new URL('../web/assets/models/tycoon/sofa.glb',import.meta.url));
  const {scene:model}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const original=createTycoonRoom('lobby'),sofa=original.objects.find(object=>object.kind==='sofa');
  for(const scale of [.75,1,1.25]){
    const room=structuredClone(original);room.objects=[{...sofa,scale}];
    const station=createTycoonNavigation(room).stations.find(item=>item.objectId===sofa.id);
    assert.ok(station,`sofa station must be reachable at scale ${scale}`);
    model.position.set(sofa.x,sofa.y,sofa.z);model.rotation.y=sofa.rotation;model.scale.setScalar(scale);
    const measured=measureSeatContact(model,tycoonWorld(station.seat),station.seatHeight);
    assert.equal(measured.ok,true,`actual sofa admission at scale ${scale}: ${JSON.stringify(measured)}`);
    assert.ok(Math.abs(measured.height-station.seatHeight)<1e-6);
    assert.ok(Math.abs(station.seatHeight-TYCOON_BUNDLED_SOFA_SEAT_HEIGHT_M*scale)<1e-6);
  }
});

test('loaded actor GLB binds a continuous skin and its walk/sit clips deform garment vertices',async()=>{
 const bytes=await fs.readFile(new URL('../web/assets/models/tycoon/actor.glb',import.meta.url)),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject));
 const skins=[];gltf.scene.traverse(n=>{if(n.isSkinnedMesh)skins.push(n);});assert.equal(skins.length,2);
 const mixer=new THREE.AnimationMixer(gltf.scene),snapshot=()=>{gltf.scene.updateMatrixWorld(true);for(const skin of skins)skin.skeleton.update();return skins.map(s=>Array.from({length:s.geometry.attributes.position.count},(_,i)=>s.getVertexPosition(i,new THREE.Vector3())));};
 try{
  const idle=mixer.clipAction(gltf.animations.find(a=>a.name==='idle'));idle.play();mixer.update(.1);const rest=snapshot();
  for(const name of ['walk','seated_work']){
   mixer.stopAllAction();const clip=gltf.animations.find(a=>a.name===name);mixer.clipAction(clip).reset().play();mixer.update(name==='walk'?.3:.8);const posed=snapshot();
   assert.ok(posed.every((vertices,m)=>vertices.some((p,i)=>p.distanceTo(rest[m][i])>.02)),`${name} actually deforms both garments`);
   assert.ok(posed.flat().every(p=>p.toArray().every(Number.isFinite)));
  }
 }finally{mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);const geometries=new Set(),materials=new Set(),skeletons=new Set();gltf.scene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)for(const m of [].concat(n.material))materials.add(m);if(n.skeleton)skeletons.add(n.skeleton);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());}
});
