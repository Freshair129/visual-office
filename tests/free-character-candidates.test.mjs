import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {characterModelPath,availableCharacterActions,isImportedCharacter} from '../web/characters/lab-state.js';
import {externalAssetTest} from './external-assets-helper.mjs';

test('imported candidates stay separate from Zuri identity, revisions and floor manifest',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../web/assets/models/characters/manifest.json',import.meta.url)));
  for(const id of ['anime','rain']){
    assert.ok(isImportedCharacter(id));
    assert.equal(characterModelPath(id),`./assets/models/characters/candidates/${id}.glb`);
    assert.equal(characterModelPath(id,'blender'),null);
    assert.ok(!manifest.assets.some(a=>a.id===id));
  }
  assert.equal(isImportedCharacter('../../private'),false);
  assert.equal(characterModelPath('../../private'),null);
});

for(const id of ['anime','rain'])externalAssetTest(`${id}: embedded portable GLB matches provenance and does not invent clips`,[`web/assets/models/characters/candidates/${id}.glb`],async()=>{
  const root=new URL('../web/assets/models/characters/candidates/',import.meta.url);
  const data=await readFile(new URL(id+'.glb',root)),meta=JSON.parse(await readFile(new URL(id+'.json',root)));
  assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(4),2);
  assert.equal(data.readUInt32LE(8),data.length);
  const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
  assert.equal(createHash('sha256').update(data).digest('hex'),meta.sha256);
  assert.equal(meta.bytes,data.length);assert.ok(meta.triangles>10000);
  assert.equal(gltf.meshes.length,meta.meshes);
  assert.equal(meta.artApproved,false);assert.equal(meta.floorAdoption,false);
  assert.ok(meta.attribution.length>10);assert.equal(meta.license,id==='rain'?'CC-BY-4.0':'CC0-1.0');
  assert.match(gltf.asset.copyright,id==='rain'?/Blender Foundation/:/3dquads blender/);
  assert.match(gltf.asset.extras.license,/^https:\/\/creativecommons.org\//);
  assert.ok(gltf.images.length>0);assert.ok(gltf.images.every(i=>i.bufferView!==undefined&&!i.uri));
  assert.ok(gltf.buffers.every(b=>!b.uri));
  assert.ok(!(gltf.extensionsRequired||[]).includes('KHR_draco_mesh_compression'));
  assert.deepEqual(availableCharacterActions(gltf.animations||[]),[]);
  assert.equal(meta.animations,0);assert.equal(meta.height,1.65);
  assert.equal(meta.facePoint.length,3);assert.ok(meta.facePoint.every(Number.isFinite));
  assert.ok(meta.faceDistance>.2&&meta.faceDistance<3);
});
