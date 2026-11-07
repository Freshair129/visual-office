import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeRoom,makeFloorTile,makeDesk,makeChair} from '../web/models.js';
import {roomSurfaces} from '../web/room-surfaces.js';
import {SurfaceFinish} from '../web/surface-finish.js';

test('uploaded texture UV settings own resources and ignore stale image completions',t=>{
  const oldDocument=globalThis.document,oldImage=globalThis.Image,images=[];
  globalThis.document={createElement:()=>({width:1,height:1,getContext:()=>({fillRect(){},drawImage(){}})})};
  globalThis.Image=class{constructor(){images.push(this);this.naturalWidth=this.naturalHeight=16;}};
  t.after(()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldImage===undefined)delete globalThis.Image;else globalThis.Image=oldImage;});
  const png=Buffer.alloc(33);png.writeUInt32BE(32,16);png.writeUInt32BE(16,20);
  const root=makeRoom(),finish=new SurfaceFinish(root),spec={data:'data:image/png;base64,'+png.toString('base64'),repeatX:2,repeatY:3,offsetX:.1,offsetY:.2,rotation:45,opacity:.5};
  finish.apply({floor:{texture:spec}});
  const material=finish.meshes.get('floor')[0].material,texture=material.map;
  assert.deepEqual(texture.repeat.toArray(),[2,3]);assert.deepEqual(texture.offset.toArray(),[.1,.2]);assert.equal(texture.rotation,Math.PI/4);
  let releases=0;texture.addEventListener('dispose',()=>releases++);const version=texture.version;
  finish.reset();images[0].onload();assert.equal(texture.version,version);assert.equal(releases,1);
  finish.apply({floor:{texture:spec}});const active=finish.meshes.get('floor')[0].material.map;const allocatedWidth=active.image.width;images.at(-1).onload();assert.equal(active.image.width,allocatedWidth);assert.equal(allocatedWidth,32);assert.equal(active.image.height,16);
  finish.dispose();assert.equal(finish.customTextures.size,0);assert.equal(releases,1);
});

test('original room exposes all stable finish targets, including separate window panes and frames',()=>{
  const root=makeRoom(),ids=new Set();root.traverse(n=>{if(n.userData.surfaceId)ids.add(n.userData.surfaceId)});
  assert.deepEqual([...ids].sort(),roomSurfaces.map(s=>s.id).sort());
  assert.equal(makeFloorTile().userData.surfaceId,'floor');
  const finishes=new SurfaceFinish(root);
  for(const s of roomSurfaces)assert.ok(finishes.meshes.get(s.id)?.length,s.id);
  const left=finishes.meshes.get('wall-left')[0],back=finishes.meshes.get('wall-back')[0],source=left.material,backSource=back.material;
  finishes.apply({'wall-left':{color:'#a6b9b3',material:'wood'}});
  assert.notEqual(left.material,source);assert.equal(back.material,backSource);
  assert.equal(left.material.color.getHexString(),'a6b9b3');assert.equal(left.material.map.isDataTexture,true);
  const override=left.material;let disposed=0;override.addEventListener('dispose',()=>disposed++);
  finishes.apply({'wall-left':{color:'#a6b9b3',material:'wood'}});assert.equal(left.material,override);
  finishes.apply({});assert.equal(left.material,source);assert.equal(disposed,1);
  finishes.dispose();assert.equal(disposed,1);
});

test('independent scene finishes never bleed through shared GLTF materials and restore panes exactly',()=>{
  const original=makeRoom(),other=original.clone(true),a=new SurfaceFinish(original),b=new SurfaceFinish(other);
  const id='window-1-glass',mesh=a.meshes.get(id)[0],unchanged=b.meshes.get(id)[0],source=mesh.material;
  assert.equal(unchanged.material,source);
  a.apply({[id]:{color:'#d6ecfa',material:'glass'},floor:{material:'stone'},'lounge-sofa':{material:'fabric'}});
  assert.equal(mesh.material.transparent,true);assert.equal(mesh.material.opacity,.65);
  assert.equal(unchanged.material,source);assert.equal(source.transparent,false);
  const textures=[...a.textures.values()];let disposed=0;textures.forEach(t=>t.addEventListener('dispose',()=>disposed++));
  a.apply({[id]:{material:'original'}});assert.equal(mesh.material.transparent,source.transparent);assert.equal(mesh.material.color.getHex(),source.color.getHex());
  a.dispose();a.dispose();assert.equal(mesh.material,source);assert.equal(disposed,textures.length);
  assert.ok(mesh instanceof THREE.Mesh);b.dispose();
});
test('desk and chair finish masks preserve electronics and hardware while coloring primary furniture surfaces',()=>{
  for(const [root,colors] of [[makeDesk(),['f5efe4','f7f8fa']],[makeChair(),['b1beb9']]]){
    const f=new SurfaceFinish(root,{targetId:'piece',materialColors:colors}),before=new Map();
    root.traverse(n=>{if(n.isMesh)before.set(n,n.material)});
    f.apply({piece:{color:'#e8820c',material:'wood'}});let painted=0,preserved=0;
    for(const [mesh,source] of before){
      if(colors.includes(source.color.getHexString())){assert.equal(mesh.material.color.getHexString(),'e8820c');painted++;}
      else{assert.equal(mesh.material,source);preserved++;}
    }
    assert.ok(painted>0&&preserved>0);f.dispose();
    for(const [mesh,source] of before)assert.equal(mesh.material,source);
  }
});
