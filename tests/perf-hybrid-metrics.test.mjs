import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {evaluateCharacter, evaluateScene, summarizeIntervals, PROPOSED_INVENTORY_LIMITS} from '../scripts/perf-hybrid-metrics.mjs';
import {hybridPerformanceFixture} from '../scripts/perf-hybrid-fixture.mjs';
import {observeInitialHybridDraw,observeCharacterLoads} from '../scripts/perf-hybrid-observer.mjs';
import {departmentStarterRoom, parseRoomJSON} from '../web/hybrid-state.js';
import {domainFloors} from '../web/domain-office.js';
import {HybridOffice3D} from '../web/hybrid-office-3d.js';
import {CharacterLibrary} from '../web/characters/runtime.js';
import {externalAssetTest} from './external-assets-helper.mjs';

function glbTriangles(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  return doc.meshes.flatMap(mesh => mesh.primitives).reduce((n, primitive) => {
    assert.equal(primitive.mode ?? 4, 4);
    const count = doc.accessors[primitive.indices ?? primitive.attributes.POSITION].count;
    assert.equal(count % 3, 0);
    return n + count / 3;
  }, 0);
}

test('interval summary uses Tycoon quantiles, strict long-frame thresholds and no fake empty result', () => {
  assert.deepEqual(summarizeIntervals([]), {count:0,p50Ms:null,p95Ms:null,p99Ms:null,maxMs:null,fps:null,over35Ms:0,over40Ms:0,over50Ms:0,over100Ms:0});
  const result = summarizeIntervals([100, 16, 35, 40, 50, 101, 20, 17, 18, 19]);
  assert.equal(result.p50Ms, 35);
  assert.equal(result.p95Ms, 101);
  assert.equal(result.p99Ms, 101);
  assert.deepEqual([result.over35Ms,result.over40Ms,result.over50Ms,result.over100Ms], [4,3,2,1]);
  assert.throws(() => summarizeIntervals([16, NaN]), /nonnegative/);
  assert.equal(summarizeIntervals([0]).fps, null, 'quantized identical draw timestamps do not imply infinite FPS');
  assert.throws(() => summarizeIntervals([-1]), /nonnegative/);
});

test('scene payload counts each unique loaded asset once and triangles per instance', () => {
  const assets = [{id:'a',bytes:10,triangles:7},{id:'b',bytes:20,triangles:11}];
  const limits = {characterBytes:20,characterTriangles:11,floorUniqueCharacterBytes:30};
  assert.deepEqual(evaluateScene(['a','b','a'], assets, limits), {instances:3,uniqueAssets:2,uniqueBytes:30,instanceTriangles:25,payloadPass:true});
  assert.equal(evaluateScene(['a','b'], assets, {...limits,floorUniqueCharacterBytes:29}).payloadPass, false);
  assert.equal(evaluateCharacter({bytes:21,triangles:11}, limits).bytesPass, false);
  assert.equal(evaluateCharacter({bytes:20,triangles:12}, limits).trianglesPass, false);
  assert.throws(() => evaluateScene(['missing'], assets), /Unknown/);
  assert.throws(() => evaluateScene(['a'], [...assets,assets[0]]), /Duplicate/);
});

test('browser fixtures use a current four-role floor and a valid unsaved twelve-role stress room', () => {
  const dependencies = {domainFloors, departmentStarterRoom, parseRoomJSON};
  for (const [count,objects] of [[4,16],[12,40]]) {
    const room = hybridPerformanceFixture(count, dependencies);
    const avatars = room.objects.filter(object => object.appearance);
    assert.equal(room.objects.length, objects);
    assert.equal(avatars.length, count);
    assert.deepEqual(avatars.map(object => object.appearance), Array.from({length:count}, (_, i) => ['zuri','wangjai','staff-a','staff-b'][i % 4]));
    assert.equal(room.objects.filter(object => object.kind === 'work-desk').length, count);
    assert.equal(room.objects.filter(object => object.kind === 'task-chair').length, count);
    assert.equal('agents' in room, false);
  }
  assert.throws(() => hybridPerformanceFixture(40, dependencies), /four or twelve/);
});

test('initial draw observer records real Hybrid scene draw calls and restores the scene method', t => {
  let clock = 0, draws = 0;
  const original = HybridOffice3D.prototype.draw;
  const observer = observeInitialHybridDraw(HybridOffice3D.prototype, 2, () => clock);
  t.after(observer.restore);
  const scene = Object.assign(Object.create(HybridOffice3D.prototype), {models:new Map(), scene:{}, camera:{}, renderer:{render:() => { clock += 3; draws++; }}});
  scene.draw();
  assert.equal(observer.result().firstCharacterDraw, null);
  scene.models.set('a', {userData:{runtimeCharacter:{status:'ready'}}});
  scene.draw();
  assert.deepEqual(observer.result().firstCharacterDraw, {startMs:3,cpuSubmissionMs:3,readyCharacters:1});
  scene.models.set('b', {userData:{runtimeCharacter:{status:'ready'}}});
  scene.unavailable = true;
  scene.draw();
  assert.equal(observer.result().firstAllReadyDraw, null);
  scene.unavailable = false;
  scene.draw();
  assert.deepEqual(observer.result().firstAllReadyDraw, {startMs:6,cpuSubmissionMs:3,readyCharacters:2});
  assert.equal(draws, 3);
  observer.restore();
  assert.equal(HybridOffice3D.prototype.draw, original);
});

externalAssetTest('load observer wraps the real concurrent loader without breaking shared manifest or per-asset bytes', ['zuri','wangjai','staff-a','staff-b'].map(id=>`web/assets/models/characters/lod/${id}-lod1.glb`), async t => {
  const base = new URL('../web/assets/models/characters/lod/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));
  let clock=0,manifests=0;
  const original = CharacterLibrary.prototype.loadAsset;
  const observer = observeCharacterLoads(CharacterLibrary.prototype, 'lod1', () => ++clock, () => { throw Error('original path not expected'); });
  t.after(observer.restore);
  const library = new CharacterLibrary({
    fetcher:async path=>{
      if(path.endsWith('.json')){manifests++;return {ok:true,json:async()=>manifest};}
      const bytes=await readFile(new URL(path.split('/').at(-1),base));
      return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    },
    parse:()=>({scene:{traverse(){},removeFromParent(){}},animations:[]}),
  });
  await Promise.all(['zuri','wangjai','staff-a','staff-b'].map(id=>library.source(id)));
  assert.equal(manifests,1);
  assert.equal(observer.entries.length,4);
  for(const entry of observer.entries){
    assert.equal(entry.fetches.filter(fetch=>fetch.bytes>0).length,1);
    assert.equal(entry.fetches.find(fetch=>fetch.bytes>0).bytes,manifest.assets.find(asset=>asset.id===entry.id).bytes);
    assert.ok(entry.parseMs>0);
    assert.ok(entry.sourceReadyMs>=entry.startMs);
  }
  observer.restore();
  assert.equal(CharacterLibrary.prototype.loadAsset,original);
  await library.dispose();
});

externalAssetTest('shipped LOD files match manifest hashes, geometry counts and provisional inventory ceilings', [
 'web/assets/models/characters/lod/zuri-lod1.glb','web/assets/models/characters/lod/wangjai-lod1.glb','web/assets/models/characters/lod/staff-a-lod1.glb','web/assets/models/characters/lod/staff-b-lod1.glb',
 'web/assets/models/characters/candidates/zuri-face-r4.glb','web/assets/models/characters/wangjai.glb','web/assets/models/characters/staff-a.glb','web/assets/models/characters/staff-b.glb',
], async () => {
  const base = new URL('../web/assets/models/characters/lod/', import.meta.url);
  const characterBase = new URL('../web/assets/models/characters/', import.meta.url);
  const sources = {zuri:'candidates/zuri-face-r4.glb',wangjai:'wangjai.glb','staff-a':'staff-a.glb','staff-b':'staff-b.glb'};
  const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));
  assert.deepEqual(manifest.assets.map(a => a.id).sort(), ['staff-a','staff-b','wangjai','zuri']);
  for (const asset of manifest.assets) {
    assert.equal(asset.file, `${asset.id}-lod1.glb`);
    const bytes = await readFile(new URL(asset.file, base));
    assert.equal(bytes.length, asset.bytes, `${asset.id} size`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `${asset.id} hash`);
    assert.equal(glbTriangles(bytes), asset.triangles, `${asset.id} triangles`);
    assert.equal(asset.source, `web/assets/models/characters/${sources[asset.id]}`);
    const original = await readFile(new URL(sources[asset.id], characterBase));
    assert.equal(original.length, asset.before.bytes, `${asset.id} original size`);
    assert.equal(createHash('sha256').update(original).digest('hex'), asset.before.sha256, `${asset.id} original hash`);
    assert.equal(glbTriangles(original), asset.before.triangles, `${asset.id} original triangles`);
    const evaluation = evaluateCharacter(asset);
    assert.ok(evaluation.bytesPass && evaluation.trianglesPass, `${asset.id} exceeds proposed inventory ceiling`);
  }
  const scene = evaluateScene(manifest.assets.map(a => a.id), manifest.assets);
  assert.equal(scene.uniqueBytes, manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0));
  assert.ok(scene.payloadPass, `floor exceeds ${PROPOSED_INVENTORY_LIMITS.floorUniqueCharacterBytes} bytes`);
});
