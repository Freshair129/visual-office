import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonAssembly,TycoonScene} from '../web/tycoon-scene.js';

async function actor() {
  const bytes=await readFile(new URL('../web/assets/models/tycoon-factory/actor-rig-v3.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.animations=gltf.animations;return gltf.scene;
}

test('rigged asset exports its named clips and independent in-place skeletons',async()=>{
  const source=await actor();const names=new Set(source.animations.map(c=>c.name));
  for(const name of ['idle','walk','sit_down','seated_work','stand_up','sitting','typing','waving','thinking','working','waiting','celebrating','blocked','error'])assert.ok(names.has(name),name);
  for(const [name,seconds] of Object.entries({idle:3,walk:.9,sit_down:.8,seated_work:2.4,stand_up:.8,talk:2.5,gesture_point:1.2})){
    const clip=source.animations.find(c=>c.name===name);assert.ok(clip,`${name} clip missing`);assert.ok(Math.abs(clip.duration-seconds)<.002,`${name} duration: ${clip.duration}`);
  }
  let sourceSkin;source.traverse(o=>{if(o.isSkinnedMesh&&!sourceSkin)sourceSkin=o;});assert.ok(sourceSkin);
  const stage=new THREE.Group(),assembly=new TycoonAssembly(stage,async()=>source);
  await assembly.replace([{id:'first',kind:'actor',clip:'idle'},{id:'second',kind:'actor',clip:'idle'}]);
  const [first,second]=assembly.owned;
  let skin1,skin2;first.traverse(o=>{if(o.isSkinnedMesh&&!skin1)skin1=o;});second.traverse(o=>{if(o.isSkinnedMesh&&!skin2)skin2=o;});
  assert.notEqual(skin1.skeleton,skin2.skeleton);assert.notEqual(skin1.skeleton.bones[0],skin2.skeleton.bones[0]);
  const a=first.getObjectByName('office-right-shoulder'),b=second.getObjectByName('office-right-shoulder');
  const before=b.quaternion.clone();first.userData.mixer.stopAllAction();first.userData.mixer.clipAction(source.animations.find(c=>c.name==='waving')).play();first.userData.mixer.update(.2);
  assert.ok(a.quaternion.angleTo(before)>.1);assert.deepEqual(b.quaternion.toArray(),before.toArray());
  assert.deepEqual(first.position.toArray(),[0,0,0]);
  const boneTexture=new THREE.Texture();let disposed=0;boneTexture.addEventListener('dispose',()=>disposed++);skin1.skeleton.boneTexture=boneTexture;
  assembly.dispose();assert.equal(disposed,1,'instance-owned skeleton GPU data is released');
});

test('existing scene loads the versioned rigged actor and fixed desk without altering room data',async t=>{
  const previous=globalThis.fetch,requests=[];t.after(()=>{globalThis.fetch=previous;});
  globalThis.fetch=async url=>{
    requests.push(String(url));const name=String(url).split('/').pop();
    const bytes=await readFile(new URL('../web/assets/models/tycoon-factory/'+name,import.meta.url));
    return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
  };
  const scene={cache:new Map()};
  const character=await TycoonScene.prototype.loadAsset.call(scene,'actor');
  const desk=await TycoonScene.prototype.loadAsset.call(scene,'desk');
  assert.ok(character.animations.some(c=>c.name==='waving'));assert.ok(desk.children.length);
  assert.deepEqual(requests,['./assets/models/tycoon-factory/actor-rig-v3.glb','./assets/models/tycoon-factory/desk-v3.glb']);
});

test('rigged candidate contains no collapsed triangles',async()=>{
  const model=await actor(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let collapsed=0,triangles=0;
  model.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,p=g.getAttribute('position'),index=g.index,n=index?.count||p.count;
    for(let i=0;i<n;i+=3){const read=j=>index?index.getX(i+j):i+j;a.fromBufferAttribute(p,read(0));b.fromBufferAttribute(p,read(1));c.fromBufferAttribute(p,read(2));triangles++;if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-16)collapsed++;}
  });
  assert.ok(triangles>0);assert.equal(collapsed,0,`${collapsed} collapsed triangles`);
});

test('exported animation keeps shoes grounded and supports straight walking at navigation speed',async()=>{
  const model=await actor(),shoes=['left','right'].map(s=>model.getObjectByName(`office-${s}-shoe`));
  assert.ok(shoes.every(s=>s?.isSkinnedMesh));
  for(const name of ['idle','walk','sit_down','sitting','typing','waving','stand_up']){
    const clip=model.animations.find(c=>c.name===name),mixer=new THREE.AnimationMixer(model),action=mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce,0);action.clampWhenFinished=true;action.play();const samples=[];
    for(let frame=0;frame<=Math.round(clip.duration*30);frame++){
      mixer.setTime(frame/30);model.updateMatrixWorld(true);
      const sample=shoes.map(shoe=>{shoe.skeleton.update();const positions=[];
        for(let i=0;i<shoe.geometry.attributes.position.count;i++){const p=new THREE.Vector3();shoe.getVertexPosition(i,p);shoe.localToWorld(p);positions.push(p);}
        const bottom=Math.min(...positions.map(p=>p.y)),sole=positions.filter(p=>p.y<=bottom+.01);
        return {bottom,center:sole.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/sole.length)};
      });
      assert.ok(sample.every(s=>s.bottom>=-.005),`${name} foot penetrates floor at ${frame}`);
      assert.ok(Math.min(...sample.map(s=>s.bottom))<=.005,`${name} both feet off floor at ${frame}`);
      if(name!=='walk')assert.ok(sample.every(s=>s.bottom<=.005),`${name} lifted a foot at ${frame}`);
      samples.push(sample);
    }
    if(name==='walk'){
      const count=[0,0];for(let i=1;i<samples.length;i++)for(let j=0;j<2;j++){
        const a=samples[i-1][j],b=samples[i][j];if(a.bottom<=.02&&b.bottom<=.02){count[j]++;const delta=b.center.clone().sub(a.center);delta.z+=.85/30;assert.ok(Math.hypot(delta.x,delta.z)<.005,`contact slide at ${i}`);}
      }assert.ok(count.every(n=>n>=10),`insufficient planted-foot samples: ${count}`);
    }
    mixer.stopAllAction();mixer.uncacheRoot(model);
  }
});

test('sitting pelvis reaches the default chair seat without lifting the feet',async()=>{
  const model=await actor(),clip=model.animations.find(c=>c.name==='sitting'),mixer=new THREE.AnimationMixer(model);
  mixer.clipAction(clip).play();mixer.setTime(.5);model.updateMatrixWorld(true);
  const pelvis=model.getObjectByName('office-pelvis');assert.ok(pelvis?.isSkinnedMesh);pelvis.skeleton.update();
  let bottom=Infinity;for(let i=0;i<pelvis.geometry.attributes.position.count;i++){const p=new THREE.Vector3();pelvis.getVertexPosition(i,p);pelvis.localToWorld(p);bottom=Math.min(bottom,p.y);}
  const defaultSeat=.551132;assert.ok(Math.abs(bottom-defaultSeat)<.02,`pelvis ${bottom}, seat ${defaultSeat}`);
  mixer.stopAllAction();mixer.uncacheRoot(model);
});
