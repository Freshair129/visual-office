import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectGlb, validateManifest} from '../scripts/asset-factory/validate.mjs';

test('inspects the actual actor GLB and verifies its skin and clip coverage', async () => {
  const bytes = await readFile(new URL('../web/assets/models/tycoon/actor.glb', import.meta.url));
  const result = inspectGlb(bytes);
  assert.ok(result.meshes > 0);
  assert.ok(result.animations.includes('walk'));
  assert.equal(result.skins, 2);
  assert.ok(!result.animations.includes('waving'));
});

test('rejects truncated, incorrectly declared, or non-GLB data', () => {
  assert.throws(() => inspectGlb(Buffer.from('glTF')));
  const bytes = Buffer.alloc(20); bytes.write('glTF'); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(999, 8);
  assert.throws(() => inspectGlb(bytes));
});

test('rejects a GLB with a malformed trailing chunk', () => {
  const json = Buffer.from(JSON.stringify({asset:{version:'2.0'},meshes:[{}]}));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
  const bytes = Buffer.alloc(20 + padded.length + 8);
  bytes.write('glTF'); bytes.writeUInt32LE(2,4); bytes.writeUInt32LE(bytes.length,8);
  bytes.writeUInt32LE(padded.length,12); bytes.write('JSON',16); padded.copy(bytes,20);
  bytes.writeUInt32LE(20,20+padded.length); bytes.write('BIN\0',24+padded.length);
  assert.throws(() => inspectGlb(bytes), /chunk/);
});

test('rejects a GLB with an empty mesh', () => {
  const json = Buffer.from(JSON.stringify({asset:{version:'2.0'},meshes:[{}]}));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
  const bytes = Buffer.alloc(20 + padded.length);
  bytes.write('glTF'); bytes.writeUInt32LE(2,4); bytes.writeUInt32LE(bytes.length,8);
  bytes.writeUInt32LE(padded.length,12); bytes.write('JSON',16); padded.copy(bytes,20);
  assert.throws(() => inspectGlb(bytes), /primitives/);
});

test('rejects a primitive without a position accessor', () => {
  const json = Buffer.from(JSON.stringify({asset:{version:'2.0'},meshes:[{primitives:[{}]}]}));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
  const bytes = Buffer.alloc(20 + padded.length);
  bytes.write('glTF'); bytes.writeUInt32LE(2,4); bytes.writeUInt32LE(bytes.length,8);
  bytes.writeUInt32LE(padded.length,12); bytes.write('JSON',16); padded.copy(bytes,20);
  assert.throws(() => inspectGlb(bytes), /position accessor/);
});

test('rejects duplicate identifiers, unsafe paths and missing file content', async () => {
  const manifest = {assets: [
    {id:'one', kind:'desk', file:'desk.glb', sha256:'0'.repeat(64)},
    {id:'one', kind:'other', file:'../outside.glb', sha256:'0'.repeat(64)},
  ]};
  const result = await validateManifest(manifest, async () => { throw Error('missing'); });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(x => x.includes('duplicate')));
  assert.ok(result.errors.some(x => x.includes('unsafe')));
  assert.ok(result.errors.some(x => x.includes('missing')));
});
