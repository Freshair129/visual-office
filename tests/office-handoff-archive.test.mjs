import test from 'node:test';
import assert from 'node:assert/strict';
import {readHandoffArchive} from '../scripts/office-handoff-archive.mjs';
import {handoffZip} from '../web/office-handoff-assets.js';

const manifest={entities:[],contentHash:'test'};
test('archive contains decodable manifest, schema and empty external crosswalk',()=>{
  const files=readHandoffArchive(handoffZip(manifest,new Map(),{type:'object'}));
  assert.equal(files.size,4);
  assert.deepEqual(JSON.parse(files.get('manifest.json')),manifest);
  assert.deepEqual(JSON.parse(files.get('id-map.json')),[]);
});
test('corrupt payload, directory offset, truncated archive and extra trailer are rejected',()=>{
  const source=Buffer.from(handoffZip(manifest,new Map(),{type:'object'}));
  const payload=Buffer.from(source);payload[30+'manifest.json'.length]^=1;
  assert.throws(()=>readHandoffArchive(payload),/CRC/);
  const directory=Buffer.from(source);directory.writeUInt32LE(1,directory.length-6);
  assert.throws(()=>readHandoffArchive(directory),/directory/);
  assert.throws(()=>readHandoffArchive(source.subarray(0,source.length-1)));
  assert.throws(()=>readHandoffArchive(Buffer.concat([source,Buffer.from([0])])));
});
