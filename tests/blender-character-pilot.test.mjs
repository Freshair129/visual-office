import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {externalAssetTest} from './external-assets-helper.mjs';

externalAssetTest('Blender pilot is self-contained, measured and isolated from prior Zuri',['web/assets/models/characters/reviews/zuri-blender-pilot.glb','web/assets/models/characters/zuri.glb'],async()=>{
  const root=new URL('../web/assets/models/characters/',import.meta.url);
  const bytes=await readFile(new URL('reviews/zuri-blender-pilot.glb',root));
  const meta=JSON.parse(await readFile(new URL('reviews/zuri-blender-pilot.json',root),'utf8'));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);
  assert.equal(bytes.length,meta.bytes);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.equal(gltf.animations?.length||0,0);
  assert.ok(gltf.nodes.some(n=>n.name==='Zuri_MPFB_Face'));
  assert.ok(!gltf.nodes.some(n=>/Editable_Base|sculpted-face|ReviewCamera/.test(n.name||'')));
  for(const item of [...gltf.buffers,...(gltf.images||[])])assert.equal(item.uri,undefined);
  const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0);
  assert.equal(triangles,meta.triangles);assert.ok(triangles<150000);assert.ok(bytes.length<15*1024*1024);
  assert.equal(meta.floorAdoption,false);assert.equal(meta.artApproved,false);
  const prior=await readFile(new URL('zuri.glb',root));
  assert.equal(createHash('sha256').update(prior).digest('hex'),'70978ebebfd79314951243e233a08f0e01ae02ba183d9dbb3d0dd4c529dd7499');
});

externalAssetTest('corrected head is a portable static revision and preserves rejected evidence',['web/assets/models/characters/reviews/zuri-head-revision.glb','web/assets/models/characters/reviews/zuri-blender-pilot.glb'],async()=>{
  const root=new URL('../web/assets/models/characters/reviews/',import.meta.url);
  const bytes=await readFile(new URL('zuri-head-revision.glb',root));
  const meta=JSON.parse(await readFile(new URL('zuri-head-revision.json',root),'utf8'));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);
  assert.equal(meta.bytes,bytes.length);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  const names=new Set(gltf.nodes.map(n=>n.name));
  for(const name of ['Zuri_Refined_Head','Short_neck','Eye_inset_1','Eye_inset_-1','Fringe_foundation','Amber_hair_clip'])assert.ok(names.has(name),name);
  for(const name of names)assert.ok(!/Zuri_MPFB|sculpted-face|hair-volume|swept-fringe-surface|ReviewCamera/.test(name||''),name);
  assert.equal(gltf.animations?.length||0,0);
  assert.ok(gltf.images.length>=2);
  for(const item of [...gltf.buffers,...gltf.images])assert.equal(item.uri,undefined);
  const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
  assert.equal(triangles,meta.triangles);assert.ok(triangles<150000);
  assert.ok(bytes.length<15*1024*1024);
  assert.equal(meta.artApproved,false);assert.equal(meta.floorAdoption,false);
  const rejected=await readFile(new URL('zuri-blender-pilot.glb',root));
  assert.equal(createHash('sha256').update(rejected).digest('hex'),'de69ba1c10b605bc59d4b062d4f2262031c842317cf032b66b4700af5d3bd12e');
});
