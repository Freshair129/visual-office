import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CharacterLibrary,updateCharacter,disposeCharacter,presentedAction} from '../web/characters/runtime.js';
import {characterAppearance,resolveAppearance,characterClip} from '../web/characters/runtime-catalog.js';

function source(){
 const scene=new T.Group(),hip=new T.Bone();hip.name='Hips';scene.add(hip);
 const geometry=new T.BoxGeometry(.2,.3,.2),n=geometry.attributes.position.count;
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(Array(n).fill([0,0,0,0]).flat(),4));
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(Array(n).fill([1,0,0,0]).flat(),4));
 const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial());mesh.name='body';scene.add(mesh);mesh.bind(new T.Skeleton([hip]));
 const animations=['idle','walking','seated'].map((name,i)=>new T.AnimationClip(name,1,[new T.VectorKeyframeTrack('Hips.position',[0,1],[0,.8-i*.1,0,0,.8-i*.1,0])]));
 return {scene,animations};
}
test('temporary appearances are allowlisted presentation, never roles or arbitrary URLs',()=>{
 assert.equal(characterAppearance('zuri').path,'./assets/models/characters/candidates/zuri-face-r4.glb');
 assert.equal(characterAppearance('zuri').metadata,'./assets/models/characters/candidates/zuri-face-r4.json');
 assert.equal(characterAppearance('https://evil/model.glb'),null);
 assert.equal(resolveAppearance({kind:'avatar-01'}),'staff-a');
 assert.equal(resolveAppearance({kind:'avatar-02',appearance:'wangjai'}),'wangjai');
 assert.equal(characterClip('drinking',['idle','walking','seated']),'idle');
 assert.equal(characterClip('seated_work',['idle','walking','seated']),'seated');
});
test('instances share source geometry but own bones, materials and animation state',async()=>{
 let loads=0;const data=source(),library=new CharacterLibrary({load:async()=>{loads++;return data;}});
 const a=library.create('zuri'),b=library.create('zuri');await Promise.all([a.userData.runtimeCharacter.ready,b.userData.runtimeCharacter.ready]);
 const aa=a.getObjectByName('body'),bb=b.getObjectByName('body');assert.equal(loads,1);
 assert.equal(aa.geometry,bb.geometry);assert.notEqual(aa.material,bb.material);assert.notEqual(aa.skeleton,bb.skeleton);
 a.position.set(4,0,3);updateCharacter(a,{action:'seated',dt:0,time:0});updateCharacter(b,{action:'walking',dt:0,time:0});
 assert.notEqual(a.getObjectByName('Hips').position.y,b.getObjectByName('Hips').position.y);
 assert.deepEqual(a.position.toArray(),[4,0,3]);assert.equal(presentedAction(a,'seated'),'seated');
 updateCharacter(a,{action:'drinking',dt:0,time:0});assert.equal(presentedAction(a,'drinking'),'idle');
 let released=0;data.scene.getObjectByName('body').geometry.addEventListener('dispose',()=>released++);
 disposeCharacter(a);assert.equal(released,0);assert.ok(b.getObjectByName('body'));
 await library.dispose();assert.equal(released,1);assert.equal(b.children.length,0);
});
test('late load cannot resurrect a disposed actor; failed load retries without removing fallback',async()=>{
 let finish;const library=new CharacterLibrary({load:()=>new Promise(r=>finish=r)}),a=library.create('zuri');
 await Promise.resolve();disposeCharacter(a);finish(source());await a.userData.runtimeCharacter.ready;
 assert.equal(a.children.length,0);await library.dispose();
 let tries=0;const retry=new CharacterLibrary({load:async()=>{if(++tries===1)throw Error('offline');return source();}});
 const bad=retry.create('staff-a');await bad.userData.runtimeCharacter.ready;
 assert.equal(bad.userData.runtimeCharacter.status,'fallback');assert.ok(bad.children.length);
 const good=retry.create('staff-a');await good.userData.runtimeCharacter.ready;assert.equal(good.userData.runtimeCharacter.status,'ready');
 await retry.dispose();
});

test('a missing external character file keeps the procedural runtime actor visible',async()=>{
 const manifest=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../web/assets/models/characters/lod/manifest.json',import.meta.url),'utf8'));
 const requests=[],library=new CharacterLibrary({fetcher:async path=>{requests.push(path);return path.endsWith('.json')?{ok:true,json:async()=>manifest}:{ok:false};},parse:()=>assert.fail('a missing external character must not be parsed')});
 const actor=library.create('zuri');await actor.userData.runtimeCharacter.ready;
 assert.equal(actor.userData.runtimeCharacter.status,'fallback');assert.ok(actor.userData.runtimeCharacter.fallback);
 assert.ok(actor.userData.runtimeCharacter.fallback.children.length>0);assert.match(actor.userData.runtimeCharacter.error,/unavailable/);
 assert.deepEqual(requests,['./assets/models/characters/lod/manifest.json','./assets/models/characters/lod/zuri-lod1.glb']);
 await library.dispose();
});

test('metadata validation rejects corrupt bytes before parsing and never fetches unregistered URLs',async()=>{
 let parsed=0;const requests=[];const library=new CharacterLibrary({parse:()=>{parsed++;},fetcher:async url=>{requests.push(url);return url.endsWith('.json')?{ok:true,json:async()=>({assets:[{id:'zuri',file:'zuri-lod1.glb',lod:1,bytes:4,sha256:'a'.repeat(64)}]})}:{ok:true,arrayBuffer:async()=>new Uint8Array(4).buffer};}});
 const a=library.create('zuri');await a.userData.runtimeCharacter.ready;assert.equal(a.userData.runtimeCharacter.status,'fallback');assert.equal(parsed,0);assert.match(a.userData.runtimeCharacter.error,/hash mismatch/);assert.ok(requests.every(p=>p.startsWith('./assets/models/characters/')));await library.dispose();
});
