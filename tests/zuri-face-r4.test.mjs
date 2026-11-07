import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {characterModelPath,initialCharacterSelection,characterReviewScope} from '../web/characters/lab-state.js';
import {characterAppearance} from '../web/characters/runtime-catalog.js';
import {AnimationMixer,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {externalAssetTest} from './external-assets-helper.mjs';

test('accepted temporary face uses stable appearance while historical R3 remains Lab comparison',()=>{
 assert.equal(characterModelPath('zuri-face-r4'),'./assets/models/characters/candidates/zuri-face-r4.glb');
 assert.deepEqual(initialCharacterSelection(null),{id:'zuri-face-r4',version:'current'});
 assert.equal(characterAppearance('zuri-face-r4'),null);assert.match(characterReviewScope('zuri-face-r4'),/ชั่วคราว/);
 assert.match(characterReviewScope('zuri-anime'),/ไม่ใช้ในชั้นจริง/);
 assert.equal(characterModelPath('zuri-face-r4/../zuri'),null);
});

externalAssetTest('face correction preserves original revision, embedded dependencies and motion contract',['web/assets/models/characters/candidates/zuri-face-r4.glb','web/assets/models/characters/candidates/zuri-anime.glb'],async()=>{
 const dir=new URL('../web/assets/models/characters/candidates/',import.meta.url),bytes=await readFile(new URL('zuri-face-r4.glb',dir)),meta=JSON.parse(await readFile(new URL('zuri-face-r4.json',dir)));
 const original=await readFile(new URL('zuri-anime.glb',dir)),sha=b=>createHash('sha256').update(b).digest('hex'),g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 assert.equal(sha(original),'c76729078169d44da377e3df3fb3f29d0d0013e14b362a627b3ff75ee9e82cce');
 assert.equal(meta.baselineSha256,sha(original));assert.equal(meta.sha256,sha(bytes));assert.notEqual(meta.sha256,sha(original));
 assert.equal(meta.bytes,bytes.length);assert.equal(meta.revision,4);assert.equal(meta.artApproved,false);assert.equal(meta.floorAdoption,false);
 assert.deepEqual(g.animations.map(a=>a.name).sort(),['idle','seated','walking']);assert.equal(g.skins[0].joints.length,53);
 assert.ok(g.images.every(i=>i.bufferView!==undefined&&!i.uri));assert.ok(g.buffers.every(b=>!b.uri));assert.match(g.asset.copyright,/3dquads blender/);
});

externalAssetTest('face sculpt leaves every exported animation sample and inverse bind matrix unchanged',['web/assets/models/characters/candidates/zuri-anime.glb','web/assets/models/characters/candidates/zuri-face-r4.glb'],async()=>{
 const dir=new URL('../web/assets/models/characters/candidates/',import.meta.url);
 const parse=bytes=>{const size=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+size)),bin:bytes.subarray(28+size)};};
 const before=parse(await readFile(new URL('zuri-anime.glb',dir))),after=parse(await readFile(new URL('zuri-face-r4.glb',dir)));
 const data=(asset,id)=>{const a=asset.json.accessors[id],v=asset.json.bufferViews[a.bufferView];assert.equal(v.byteStride,undefined);const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};const offset=(v.byteOffset||0)+(a.byteOffset||0);return asset.bin.subarray(offset,offset+a.count*widths[a.type]*4);};
 const motion=asset=>asset.json.animations.map(a=>({name:a.name,channels:a.channels.map(c=>{const s=a.samplers[c.sampler];return {node:asset.json.nodes[c.target.node].name,path:c.target.path,interpolation:s.interpolation||'LINEAR',input:data(asset,s.input).toString('hex'),output:data(asset,s.output).toString('hex')};})}));
 assert.deepEqual(motion(after),motion(before));
 assert.deepEqual(data(after,after.json.skins[0].inverseBindMatrices),data(before,before.json.skins[0].inverseBindMatrices));
});

externalAssetTest('actual exported face has a projecting nasal bridge and balanced nose-lip-chin profile',['web/assets/models/characters/candidates/zuri-anime.glb','web/assets/models/characters/candidates/zuri-face-r4.glb'],async()=>{
 const id=process.env.FACE_TEST_ASSET||'zuri-face-r4';assert.ok(['zuri-anime','zuri-face-r4'].includes(id));
 const bytes=await readFile(new URL(`../web/assets/models/characters/candidates/${id}.glb`,import.meta.url));
 const size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size));
 // Geometry/skin proof only: image decoding is exercised separately in browser.
 delete doc.images;delete doc.textures;delete doc.materials;
 for(const m of doc.meshes)for(const p of m.primitives)delete p.material;
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const tail=bytes.subarray(20+size),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+tail.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const b=Buffer.concat([header,json,tail]),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const mixer=new AnimationMixer(g.scene);mixer.clipAction(g.animations.find(a=>a.name==='idle')).play();mixer.setTime(0);g.scene.updateMatrixWorld(true);
 const face=g.scene.getObjectByName('Retopo-Girl');assert.ok(face);face.skeleton.update();
 const points=Array.from({length:face.geometry.attributes.position.count},(_,i)=>face.getVertexPosition(i,new Vector3()).applyMatrix4(face.matrixWorld));
 const front=y=>Math.max(...points.filter(p=>Math.abs(p.x)<.008&&Math.abs(p.y-y)<.003).map(p=>p.z));
 const bridge=front(1.485),nasion=front(1.500),nose=front(1.465),lips=front(1.435),chin=front(1.405);
 assert.ok(bridge>nasion+.004,'nasal bridge must project beyond the nasion instead of lying flat');
 assert.ok(nose>bridge+.012,'nose tip must project naturally beyond its bridge');
 assert.ok(lips>chin+.007,'lips must not collapse behind the chin');
 assert.ok(nose>lips+.006,'nose tip stays ahead of the lips');
 mixer.stopAllAction();mixer.uncacheRoot(g.scene);
});
