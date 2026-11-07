import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {characterModelPath,availableCharacterActions,isImportedCharacter,selectedCharacterAction} from '../web/characters/lab-state.js';
import {externalAssetTest} from './external-assets-helper.mjs';

test('switching from a five-action character falls back to idle for the three-action adaptation',()=>{
  const clips=['idle','walking','seated'].map(name=>({name}));
  for(const previous of ['wave','point'])assert.equal(selectedCharacterAction(clips,previous),'idle');
  assert.equal(selectedCharacterAction(clips,'seated'),'seated');
  assert.equal(selectedCharacterAction([],'walking'),null);
});

test('Zuri adaptation is a separate Lab choice and cannot replace a floor identity',async()=>{
  assert.equal(characterModelPath('zuri-anime'),'./assets/models/characters/candidates/zuri-anime.glb');
  assert.equal(isImportedCharacter('zuri-anime'),true);
  assert.equal(characterModelPath('zuri-anime','before'),null);
  assert.equal(characterModelPath('zuri-anime/../zuri'),null);
  const m=JSON.parse(await readFile(new URL('../web/assets/models/characters/manifest.json',import.meta.url)));
  assert.ok(!m.assets.some(a=>a.id==='zuri-anime'));
});

externalAssetTest('adaptation has embedded assets, provenance, real skin and exactly the reviewed motion studies',['web/assets/models/characters/candidates/zuri-anime.glb','web/assets/models/characters/candidates/anime.glb'],async()=>{
  const root=new URL('../web/assets/models/characters/candidates/',import.meta.url);
  const bytes=await readFile(new URL('zuri-anime.glb',root));
  const meta=JSON.parse(await readFile(new URL('zuri-anime.json',root)));
  const base=await readFile(new URL('anime.glb',root));
  const g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);
  assert.equal(createHash('sha256').update(base).digest('hex'),meta.baseGlbSha256);
  assert.notEqual(meta.sha256,meta.baseGlbSha256);
  assert.equal(meta.bytes,bytes.length);assert.equal(meta.artApproved,false);assert.equal(meta.floorAdoption,false);
  assert.ok(g.skins.length>0);assert.ok(g.skins[0].joints.length<100);
  assert.deepEqual(availableCharacterActions(g.animations),['idle','walking','seated']);
  assert.ok(g.animations.every(a=>a.channels.length>0));
  assert.ok(g.images.every(i=>i.bufferView!==undefined&&!i.uri));
  assert.ok(g.buffers.every(b=>!b.uri));
  assert.match(g.asset.copyright,/3dquads blender/);
  assert.ok(g.nodes.some(n=>n.name.startsWith('Zuri_Glasses_Rim')));
  assert.ok(g.nodes.some(n=>n.name==='Zuri_Orange_Clip'));
  assert.ok(!g.nodes.some(n=>n.name==='h.tail.1'));
});
