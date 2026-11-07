import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {HUMAN_DESK} from '../web/characters/lab-furniture.js';
import {externalAssetTest} from './external-assets-helper.mjs';

globalThis.self=globalThis;
// Node checks embedded PNG identity/bounds separately; actual image decoding is
// tested in the browser, never claimed by this headless bitmap placeholder.
globalThis.createImageBitmap=async()=>({width:512,height:512,close(){}});
const dir=new URL('../web/assets/models/characters/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',dir)));
externalAssetTest('Lab baseline remains the exact pre-refinement Zuri and has portable matching metadata',['web/assets/models/characters/reviews/zuri-before-refinement.glb'],async()=>{
  const bytes=await readFile(new URL('reviews/zuri-before-refinement.glb',dir));
  const meta=JSON.parse(await readFile(new URL('reviews/zuri-before-refinement.json',dir)));
  const expected='8955b1cafa2b482a3bf6c09e7800b56317e8b27918826378328599de43543810';
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);
  assert.equal(meta.sha256,expected);assert.equal(meta.bytes,bytes.length);
  assert.notEqual(meta.sha256,manifest.assets.find(a=>a.id==='zuri').sha256);
});
for(const id of ['zuri','wangjai','staff-a','staff-b'])externalAssetTest(`${id}: portable GLB bytes, animation and independent loaded clone`,[
 `web/assets/models/characters/${id}.glb`,...(id==='zuri'?['docs/game-design/characters/2026-10-25-brand-study/local-rebuild/zuri-face-albedo-v1.png']:[]),
],async()=>{
  const meta=manifest.assets.find(a=>a.id===id),bytes=await readFile(new URL(meta.file,dir));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(meta.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(meta.bytes,bytes.length);
  assert.ok(bytes.length<5*1024*1024);assert.ok(meta.triangles<120000);
  const len=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+len));
  assert.ok(json.buffers.every(b=>!b.uri));assert.ok((json.images||[]).every(i=>i.bufferView!==undefined&&!i.uri));
  const loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  loaded.scene.traverse(n=>{if(n.isMesh){const normal=n.geometry.attributes.normal;assert.ok(normal);for(let i=0;i<normal.count;i++){const length=Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i));assert.ok(Math.abs(length-1)<.002,`${id}/${n.name}: invalid normal ${length}`);}}});
  assert.deepEqual(loaded.animations.map(c=>c.name),['idle','walking','seated','wave','point']);
  assert.ok(loaded.animations.every(c=>c.duration>0),'static poses still have a positive playback interval');
  const a=clone(loaded.scene),b=clone(loaded.scene),mix=new T.AnimationMixer(a),skins=[];a.traverse(n=>{if(n.isSkinnedMesh)skins.push(n);});
  const animated=a.getObjectByName(id==='wangjai'?'wangjai-left-leg':'left-hip');assert.ok(animated);
  const before=b.getObjectByName(animated.name).quaternion.clone(),orig=animated.quaternion.clone();
  mix.clipAction(loaded.animations.find(c=>c.name==='walking')).play();mix.update(.27);a.updateMatrixWorld(true);
  assert.ok(!animated.quaternion.equals(orig));assert.ok(b.getObjectByName(animated.name).quaternion.equals(before));
  if(id!=='wangjai'){
    assert.ok(skins.length>=3);assert.notEqual(skins[0].skeleton,b.getObjectByName(skins[0].name).skeleton);
    const leg=a.getObjectByName('left-trouser-leg'),p=leg.geometry.attributes.position;leg.skeleton.update();let changes=0;
    for(let i=0;i<p.count;i+=17){const original=new T.Vector3().fromBufferAttribute(p,i),v=original.clone();leg.applyBoneTransform(i,v);assert.ok(v.toArray().every(Number.isFinite));if(v.distanceTo(original)>.02)changes++;}assert.ok(changes>5,'exported skin actually deforms');
    mix.stopAllAction();mix.clipAction(loaded.animations.find(c=>c.name==='seated')).play();
    const scale=id==='staff-b'?1.08125:1;
    for(let t=0;t<4;t+=.2){
      mix.setTime(t);a.updateMatrixWorld(true);
      for(const skin of skins)skin.skeleton.update();
      a.traverse(n=>{
        if(!n.isMesh||!/(sleeve|cuff|forearm|palm|finger|thumb|nail)/.test(n.name))return;
        const v=new T.Vector3(),p=n.geometry.attributes.position,d=HUMAN_DESK;
        for(let i=0;i<p.count;i++){
          v.fromBufferAttribute(p,i);if(n.isSkinnedMesh)n.applyBoneTransform(i,v);v.applyMatrix4(n.matrixWorld).divideScalar(scale);
          const inside=Math.abs(v.x)<d.width/2&&Math.abs(v.y-d.y)<d.thickness/2&&Math.abs(v.z-d.z)<d.depth/2;
          assert.equal(inside,false,`${id}/${n.name}: exported arm penetrates reference tabletop at ${t}`);
        }
      });
      for(const side of ['left','right']){
        const sole=new T.Box3().setFromObject(a.getObjectByName(`${side}-shoe-sole`),true);
        assert.ok(Math.abs(sole.min.y)<.001,`${id}: exported seated sole contacts ground`);
        for(const part of ['palm','finger-0','finger-1','finger-2','finger-3']){
          const bounds=new T.Box3().setFromObject(a.getObjectByName(`${side}-${part}`),true);
          assert.ok(bounds.min.y/scale>=.7675,`${id}: exported ${side}-${part} penetrates work surface`);
          assert.ok(bounds.max.y/scale<.85,`${id}: exported hand floats above desk`);
        }
      }
    }
    mix.stopAllAction();mix.clipAction(loaded.animations.find(c=>c.name==='idle')).play();
    mix.setTime(0);const open=a.getObjectByName('eyelid-rig--1').scale.y;
    mix.setTime(5.1*4/(Math.PI*2));
    assert.ok(a.getObjectByName('eyelid-rig--1').scale.y<open*.15,'exported idle has a brief blink');
  }
  if(id==='zuri'){
    assert.equal(json.images.length,3);const bv=json.bufferViews[json.images[0].bufferView],start=28+len+bv.byteOffset;
    assert.deepEqual([...bytes.subarray(start,start+8)],[137,80,78,71,13,10,26,10]);assert.equal(bytes.readUInt32BE(start+16),512);
    assert.ok(json.materials.find(m=>m.name==='windowpane-knit').pbrMetallicRoughness.baseColorTexture);
    const faceMaterial=json.materials.find(m=>m.name==='zuri-painted-face');
    assert.ok(faceMaterial.pbrMetallicRoughness.roughnessFactor<=.65);
    assert.ok(faceMaterial.extensions.KHR_materials_specular,'portable facial sheen');
    assert.ok(json.materials.find(m=>m.name==='brown-hair').extensions.KHR_materials_anisotropy,'portable strand highlights');
    assert.ok(faceMaterial?.pbrMetallicRoughness.baseColorTexture,'local sculpture carries its original face albedo');
    const faceImage=json.images[json.textures[faceMaterial.pbrMetallicRoughness.baseColorTexture.index].source];
    assert.equal(faceImage.name,'original-zuri-face-albedo');
    const faceView=json.bufferViews[faceImage.bufferView];
    const expected=await readFile(new URL('../docs/game-design/characters/2026-10-25-brand-study/local-rebuild/zuri-face-albedo-v1.png',import.meta.url));
    assert.deepEqual(bytes.subarray(28+len+faceView.byteOffset,28+len+faceView.byteOffset+faceView.byteLength),expected,'embedded albedo is the preserved original source');
  }
  if(id!=='wangjai'){
    const hairImage=json.images.find(i=>i.name==='original-hair-fibres');assert.ok(hairImage);
    const bv=json.bufferViews[hairImage.bufferView],start=28+len+bv.byteOffset;
    assert.deepEqual([...bytes.subarray(start,start+8)],[137,80,78,71,13,10,26,10]);
    assert.equal(bytes.readUInt32BE(start+16),256);assert.equal(bytes.readUInt32BE(start+20),512);
    for(const name of ['brown-hair','hair-dark','hair-mid','hair-light']){
      const index=json.materials.find(m=>m.name===name).pbrMetallicRoughness.baseColorTexture.index;
      assert.equal(json.images[json.textures[index].source],hairImage,'hair and cardigan use separate embedded albedo');
    }
    assert.equal(loaded.scene.getObjectByName('sculpted-face').userData.receiveShadow,false);
    assert.equal(loaded.scene.getObjectByName('upper-lash--1').userData.castShadow,false);
  }
});

externalAssetTest('all exported animation loops return to the first transform',['web/assets/models/characters/zuri.glb','web/assets/models/characters/wangjai.glb','web/assets/models/characters/staff-a.glb','web/assets/models/characters/staff-b.glb'],async()=>{
  for(const meta of manifest.assets){
    const bytes=await readFile(new URL(meta.file,dir)),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    for(const c of g.animations)for(const track of c.tracks){const n=track.getValueSize(),v=track.values;for(let k=0;k<n;k++)assert.ok(Math.abs(v[k]-v[v.length-n+k])<.001,`${meta.id}/${c.name}/${track.name} loop seam`);}
  }
});
