import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {characterReference} from '../web/characters/sheet-reference.js';
import {externalAssetTest} from './external-assets-helper.mjs';

externalAssetTest('lab reference crops retain byte-identical approved sheets and stay within their pixels',[
 ...['zuri','wangjai','office-staff'].map(name=>`docs/game-design/characters/2026-10-25-brand-study/${name}-sheet-v1.png`),
 ...['zuri','wangjai','office-staff'].map(name=>`web/assets/models/characters/references/${name}-sheet-v1.png`),
],async()=>{
  for(const id of ['zuri','wangjai','staff-a','staff-b']){
    const ref=characterReference(id),file=ref.src.split('/').at(-1);
    const approved=await readFile(new URL(`../docs/game-design/characters/2026-10-25-brand-study/${file}`,import.meta.url));
    const published=await readFile(new URL(`../web/assets/models/characters/references/${file}`,import.meta.url));
    assert.equal(published.equals(approved),true,`${id}: reference must not alter approved artwork`);
    const width=published.readUInt32BE(16),height=published.readUInt32BE(20);
    for(const view of ['front','face','sheet']){
      const {box:[x,y,w,h]}=characterReference(id,view);
      assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=width&&y+h<=height,`${id}/${view}: bounded crop`);
    }
  }
});

test('reference selection is allowlisted and each caller receives independent crop state',()=>{
  assert.equal(characterReference('../../private'),null);assert.equal(characterReference('__proto__'),null);
  const a=characterReference('zuri');a.box[0]=-999;
  assert.ok(characterReference('zuri').box[0]>=0);
  assert.deepEqual(characterReference('zuri','unknown'),characterReference('zuri','front'));
});

externalAssetTest('Tripo comparison uses labelled captured pixels only for Zuri with their actual dimensions',[
 ...['tripo-front-preview.jpg','tripo-face-preview.jpg'].map(name=>`web/assets/models/characters/references/${name}`),
 ...['tripo-front-preview.jpg','tripo-face-preview.jpg'].map(name=>`docs/game-design/characters/2026-10-25-brand-study/local-refinement/${name}`),
],async()=>{
  for(const view of ['tripo-front','tripo-face']){
    const ref=characterReference('zuri',view),file=ref.src.split('/').at(-1);
    assert.match(ref.caption,/Tripo/);assert.equal(ref.kind,'preview-screenshot');
    const bytes=await readFile(new URL(`../web/assets/models/characters/references/${file}`,import.meta.url));
    assert.deepEqual(bytes,await readFile(new URL(`../docs/game-design/characters/2026-10-25-brand-study/local-refinement/${file}`,import.meta.url)),'reference pixels are retained unchanged');
    assert.equal(bytes.readUInt16BE(0),0xffd8);
    let frame=2;while(frame<bytes.length){const marker=bytes.readUInt16BE(frame);if([0xffc0,0xffc1,0xffc2].includes(marker))break;frame+=2+bytes.readUInt16BE(frame+2);}
    assert.ok(frame<bytes.length,'JPEG frame exists');assert.equal(ref.width,bytes.readUInt16BE(frame+7));assert.equal(ref.height,bytes.readUInt16BE(frame+5));
    const [x,y,w,h]=ref.box;assert.ok(x>0&&y>0&&w>0&&h>0&&x+w<=ref.width&&y+h<=ref.height);
  }
  assert.deepEqual(characterReference('staff-a','tripo-face'),characterReference('staff-a','front'));
});
