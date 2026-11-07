import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CHARACTER_APPEARANCES,characterAsset,resolveAppearance} from '../web/characters/runtime-catalog.js';
import {characterModelPath,initialCharacterSelection} from '../web/characters/lab-state.js';
import {CharacterLibrary} from '../web/characters/runtime.js';
import {externalAssetTest} from './external-assets-helper.mjs';

const assetRoot='./assets/models/characters/';
const manifest=JSON.parse(await readFile(new URL('../web/assets/models/characters/lod/manifest.json',import.meta.url),'utf8'));
const bytesFor=path=>readFile(new URL('../web/'+path.replace('./',''),import.meta.url));
const arrayBuffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);

test('Hybrid selects LOD1 while Lab resolves the original R4 and other full-detail characters',()=>{
 for(const {id,path}of CHARACTER_APPEARANCES){
  const hybrid=characterAsset(id),lab=characterAsset(id,'lab');
  assert.equal(hybrid.path,assetRoot+`lod/${id}-lod1.glb`);
  assert.equal(hybrid.manifest,assetRoot+'lod/manifest.json');assert.equal(hybrid.lod,1);
  assert.equal(lab.path,path);assert.equal(hybrid.id,lab.id);assert.equal(hybrid.artApproved,true);
  assert.equal(lab.artApproved,true);assert.equal(hybrid.artApprovedAt,'2026-11-07');
  assert.equal(characterModelPath(id==='zuri'?'zuri-face-r4':id),path);
  assert.equal(resolveAppearance({kind:'avatar-01',appearance:id}),id);
  assert.equal(characterAsset(id,'unregistered'),null);
 }
 assert.equal(initialCharacterSelection(null).id,'zuri-face-r4');
 assert.equal(characterModelPath('zuri-anime'),'./assets/models/characters/candidates/zuri-anime.glb');
 for(const id of ['__proto__','../../private','https://other/model.glb'])assert.equal(characterAsset(id),null);
});

for(const {id}of CHARACTER_APPEARANCES)externalAssetTest(`${id}: the default runtime fetches and validates the real LOD bytes`,[`web/assets/models/characters/lod/${id}-lod1.glb`],async()=>{
 const requests=[];let parsed=0;
 const library=new CharacterLibrary({
  fetcher:async path=>{requests.push(path);return path.endsWith('.json')?
   {ok:true,json:async()=>manifest}:{ok:true,arrayBuffer:async()=>arrayBuffer(await bytesFor(path))};},
  parse:bytes=>{parsed++;assert.equal(new DataView(bytes).getUint32(0,true),0x46546c67);return 'parsed';},
 });
 assert.equal(await library.loadAsset(id),'parsed');assert.equal(parsed,1);
 assert.deepEqual(requests,[assetRoot+'lod/manifest.json',assetRoot+`lod/${id}-lod1.glb`]);
 await library.dispose();
});

externalAssetTest('concurrent appearances share one manifest request while still verifying every GLB',CHARACTER_APPEARANCES.map(({id})=>`web/assets/models/characters/lod/${id}-lod1.glb`),async()=>{
 const requests=[];let parsed=0;
 const library=new CharacterLibrary({
  fetcher:async path=>{requests.push(path);return path.endsWith('.json')?
   {ok:true,json:async()=>manifest}:{ok:true,arrayBuffer:async()=>arrayBuffer(await bytesFor(path))};},
  parse:()=>{parsed++;return {scene:{traverse(){},removeFromParent(){}},animations:[]};},
 });
 await Promise.all(CHARACTER_APPEARANCES.map(({id})=>library.source(id)));
 assert.equal(requests.filter(path=>path.endsWith('.json')).length,1);
 assert.deepEqual(requests.filter(path=>path.endsWith('.glb')).sort(),CHARACTER_APPEARANCES.map(({id})=>characterAsset(id).path).sort());
 assert.equal(parsed,4);
 await library.dispose();
});

externalAssetTest('a failed shared manifest request is evicted so a later load can retry',['web/assets/models/characters/lod/staff-a-lod1.glb'],async()=>{
 let manifestRequests=0;
 const library=new CharacterLibrary({
  fetcher:async path=>path.endsWith('.json')?
   {ok:true,json:async()=>{if(++manifestRequests===1)throw Error('bad JSON');return manifest;}}:
   {ok:true,arrayBuffer:async()=>arrayBuffer(await bytesFor(path))},
  parse:()=>({scene:{traverse(){},removeFromParent(){}},animations:[]}),
 });
 const failed=await Promise.allSettled([library.source('staff-a'),library.source('staff-b')]);
 assert.ok(failed.every(result=>result.status==='rejected'));
 assert.equal(manifestRequests,1);
 await library.source('staff-a');
 assert.equal(manifestRequests,2);
 await library.dispose();
});

externalAssetTest('invalid cached manifest metadata is re-fetched when the appearance is retried',['web/assets/models/characters/lod/zuri-lod1.glb'],async()=>{
 let manifestRequests=0,parsed=0;
 const library=new CharacterLibrary({
  fetcher:async path=>{
   if(path.endsWith('.json'))return {ok:true,json:async()=>{
    const value=structuredClone(manifest);
    if(++manifestRequests===1)value.assets.find(asset=>asset.id==='zuri').file='wrong.glb';
    return value;
   }};
   return {ok:true,arrayBuffer:async()=>arrayBuffer(await bytesFor(path))};
  },
  parse:()=>{parsed++;return {scene:{traverse(){},removeFromParent(){}},animations:[]};},
 });
 await assert.rejects(library.source('zuri'),/metadata/);
 await library.source('zuri');
 assert.equal(manifestRequests,2);assert.equal(parsed,1);
 await library.dispose();
});

for(const failure of ['missing','metadata','size','hash']){
 const run=async()=>{
 const requests=[];let parsed=0;const info=characterAsset('zuri');
 const library=new CharacterLibrary({parse:()=>{parsed++;},fetcher:async path=>{
  requests.push(path);
  if(path.endsWith('.json')){
   const copy=structuredClone(manifest);
   if(failure==='metadata')copy.assets.find(a=>a.id==='zuri').file='../../unregistered.glb';
   return {ok:true,json:async()=>copy};
  }
  if(failure==='missing')return {ok:false};
  let bytes=await bytesFor(path);
  if(failure==='size')bytes=bytes.subarray(1);
  if(failure==='hash'){bytes=Buffer.from(bytes);bytes[bytes.length-1]^=1;}
  return {ok:true,arrayBuffer:async()=>arrayBuffer(bytes)};
 }});
 const actor=library.create('zuri');await actor.userData.runtimeCharacter.ready;
 assert.equal(actor.userData.runtimeCharacter.status,'fallback');assert.ok(actor.userData.runtimeCharacter.fallback);
 assert.match(actor.userData.runtimeCharacter.error,({missing:/unavailable/,metadata:/metadata/,size:/size mismatch/,hash:/hash mismatch/})[failure]);
 assert.equal(parsed,0);assert.deepEqual(requests,failure==='metadata'?[info.manifest]:[info.manifest,info.path]);
 await library.dispose();
 };
 if(['size','hash'].includes(failure))externalAssetTest(`LOD ${failure} keeps the procedural fallback and never parses or loads an original`,['web/assets/models/characters/lod/zuri-lod1.glb'],run);
 else test(`LOD ${failure} keeps the procedural fallback and never parses or loads an original`,run);
}
