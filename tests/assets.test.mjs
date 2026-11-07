import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,Vector3} from 'three';
import {makeAvatar} from '../web/models.js';
import {OFFICE_ASSETS,PLACEABLE_STUDIO_GLBS,STUDIO_MODEL_METADATA} from '../web/office-assets.js';
import {externalAssetTest} from './external-assets-helper.mjs';
globalThis.ProgressEvent=class {constructor(type,options){this.type=type;Object.assign(this,options)}};

test('all generated glTF assets load, have bounded finite geometry, and need no remote assets',async()=>{
 for(const [name,max] of [['room',20],['desk',4],['floor-tile',3]]){
  const raw=await readFile(`web/assets/models/${name}.gltf`,'utf8');const json=JSON.parse(raw);
  assert.equal(json.asset.version,'2.0');assert.ok(json.buffers.every(b=>b.uri.startsWith('data:')));
  const gltf=await new GLTFLoader().parseAsync(raw,'');const bounds=new Box3().setFromObject(gltf.scene).getSize(new Vector3());
  for(const dim of bounds.toArray())assert.ok(Number.isFinite(dim)&&dim>0&&dim<max);
  let meshes=0;gltf.scene.traverse(m=>{if(m.isMesh){meshes++;assert.ok(m.geometry.attributes.position.count>0)}});assert.ok(meshes>0);
 }
});
externalAssetTest('asset library IDs, previews and placeable GLB manifest entries are stable and local',[
 'web/assets/office-world/hybrid/props/chair.png','web/assets/studio-styles/soft3d/plant.png',
],async()=>{
 const manifest=JSON.parse(await readFile('web/assets/models/studio/manifest.json','utf8'));
 const completeOfficeKit=[
  'visual-office.chair.ergonomic.v1','visual-office.meeting-table.standard.v1','visual-office.sofa.lounge.v1',
  'visual-office.coffee-table.studio.v1','visual-office.cabinet.studio.v1','visual-office.reception-counter.standard.v1',
  'visual-office.bookcase.standard.v1','visual-office.floor-lamp.standard.v1','visual-office.whiteboard.standard.v1',
  'visual-office.coffee-station.standard.v1','visual-office.elevator.bay.v1',
 ];
 assert.ok(completeOfficeKit.every(id=>OFFICE_ASSETS.some(asset=>asset.assetId===id)), 'the catalog should include the complete common office furniture and fixture set');
 for(const id of completeOfficeKit){
  const item=manifest.assets.find(asset=>asset.assetId===id);
  assert.ok(item,`Manifest is missing ${id}`);assert.equal(item.footprint?.length,2);assert.equal(item.anchors?.ground?.length,3);
  assert.ok(item.triangles<8000&&item.bytes<300*1024,`${id} should stay lightweight for the mobile Office scene`);
 }
 assert.equal(manifest.assets.length,Object.keys(STUDIO_MODEL_METADATA).length,'all source model entries should export into the manifest');
 for(const asset of OFFICE_ASSETS){
  assert.match(asset.assetId,/^visual-office\.[a-z0-9.-]+\.v1$/);
  assert.ok(asset.name&&asset.description&&asset.category);
  const preview=asset.preview.replace(/^\.\//,'web/');await access(preview);
 }
 const deskPreviews=OFFICE_ASSETS.filter(asset=>asset.assetId.startsWith('visual-office.desk.')).map(asset=>asset.preview);
 assert.equal(new Set(deskPreviews).size,deskPreviews.length,'each desk model should have its own visual preview');
 assert.equal(new Set(OFFICE_ASSETS.map(asset=>asset.assetId)).size,OFFICE_ASSETS.length);
 for(const asset of PLACEABLE_STUDIO_GLBS){
  const metadata=Object.values(STUDIO_MODEL_METADATA).find(row=>row.assetId===asset.assetId);
  assert.ok(metadata?.placeable);assert.equal(asset.renderer,'gltf');
  const entry=manifest.assets.find(row=>row.assetId===asset.assetId);
  assert.ok(entry,`Manifest is missing ${asset.assetId}`);assert.equal(entry.placeable,true);
  const bytes=await readFile(`web/assets/models/studio/${entry.file}`);
  const glb=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bounds=new Box3().setFromObject(glb.scene).getSize(new Vector3());
  for(const dimension of bounds.toArray())assert.ok(Number.isFinite(dimension)&&dimension>0&&dimension<10,`${asset.assetId} should have real, bounded 3D geometry`);
  let meshes=0;glb.scene.traverse(node=>{if(node.isMesh){meshes++;assert.ok(node.geometry.attributes.position.count>0);assert.ok(node.geometry.attributes.uv?.count>0,`${asset.assetId} should retain UVs for Studio surface textures`)}});assert.ok(meshes>0,`${asset.assetId} should contain mesh geometry`);
 }
 assert.ok(manifest.assets.filter(asset=>asset.placeable===false).length>=4);
});
test('avatar variants have independent articulated limbs and full standing geometry',()=>{
 for(const hair of ['short','bob','bun']){
  const a=makeAvatar({hair,glasses:true});const b=makeAvatar({hair,glasses:false});
  for(const limb of ['leftArm','rightArm','leftLeg','rightLeg','head','body']){assert.ok(a.userData[limb]);assert.notEqual(a.userData[limb],b.userData[limb])}
  const size=new Box3().setFromObject(a).getSize(new Vector3());assert.ok(size.y>1.5&&size.y<2.2);
 }
});
test('entry page references existing assets and has unique interactive IDs',async()=>{
 const html=await readFile('web/index.html','utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 const external=new Set(JSON.parse(await readFile('asset-store/manifest.json','utf8')).assets.map(asset=>asset.path));
 for(const match of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)){
  const path=`web/${match[1]}`;
  try{await access(path);}catch(error){if(error.code!=='ENOENT'||!external.has(path))throw error;}
 }
 const app=await readFile('web/app.js','utf8');for(const match of app.matchAll(/\$\('#([\w-]+)'\)/g))assert.ok(ids.includes(match[1])||['scene','scene-loading'].includes(match[1]),`Missing DOM target ${match[1]}`);
 const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));assert.equal(hosting.r2,'BUCKET');
});
test('browser vendor build includes the rounded-box addon imported by Design Studio',async()=>{
 const build=await readFile('scripts/build-assets.mjs','utf8');
 assert.match(build,/geometries\/RoundedBoxGeometry\.js/);
 const {RoundedBoxGeometry}=await import('../web/vendor/addons/geometries/RoundedBoxGeometry.js');
 assert.equal(typeof RoundedBoxGeometry,'function');
});

test('browser vendor build includes skeleton cloning required by animated GLB instances',async()=>{
 const build=await readFile('scripts/build-assets.mjs','utf8');assert.match(build,/utils\/SkeletonUtils\.js/);
 const {clone}=await import('../web/vendor/addons/utils/SkeletonUtils.js');assert.equal(typeof clone,'function');
});
