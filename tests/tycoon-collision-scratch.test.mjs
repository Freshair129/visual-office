import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {TycoonScene,TycoonAssembly,tycoonSceneObjects} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';

const reference=JSON.parse(await readFile('tests/fixtures/tycoon-firstfit-collision-reference-20261030.json','utf8'));
const rootOrderFixture=JSON.parse(await readFile('tests/fixtures/tycoon-firstfit-collision-root-order-20261030.json','utf8'));
const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8'));
const models=new Map();

async function loadModel(kind){
 if(!models.has(kind))models.set(kind,(async()=>{
  const factory=TYCOON_FACTORY_ASSETS[kind],meta=factory||manifest.assets.find(asset=>asset.kind===kind);
  assert.ok(meta,`actual GLB metadata for ${kind}`);
  const bytes=await readFile(`web/assets/models/${factory?'tycoon-factory/':'tycoon/'}${meta.file}`);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.animations=gltf.animations;return gltf.scene;
 })());
 return models.get(kind);
}

function makeTriangleWorld(){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,-1,1,0,-1,0,0,1],3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.userData.instanceId='triangle-panel';
 mesh.updateMatrixWorld(true);return new TycoonCollisionWorld([mesh]);
}
function capsule(start,end=start,radius=.06){return {name:'test-capsule',start:new THREE.Vector3(...start),end:new THREE.Vector3(...end),radius};}

test('narrowphase scratch is stable per world, isolated across worlds, and avoids query-time Vector3 clones',()=>{
 const first=makeTriangleWorld(),second=makeTriangleWorld(),scratch=first.queryScratch.closest;
 assert.ok(scratch,'collision world owns closest-point scratch vectors and result objects');
 assert.notStrictEqual(scratch,second.queryScratch.closest,'worlds never share mutable narrowphase scratch');
 const scratchObjects=[scratch,scratch.delta,scratch.ray,scratch.rayHit,scratch.startTrianglePoint,scratch.endTrianglePoint,
  scratch.closestSegmentPoint,scratch.closestTrianglePoint,scratch.result,scratch.result.segmentPoint,scratch.result.trianglePoint,
  scratch.edge,scratch.edge.u,scratch.edge.v,scratch.edge.w,scratch.edge.segmentPoint,scratch.edge.edgePoint,scratch.edge.result];

 const originalClone=THREE.Vector3.prototype.clone;let cloneCalls=0;
 THREE.Vector3.prototype.clone=function(){cloneCalls++;return originalClone.call(this);};
 let firstHit;
 try{
  firstHit=first.inspectCapsules([capsule([0,.02,0])],{phase:'walking'});
  assert.equal(firstHit.ok,false,'face capsule reports its collision');
  assert.equal(firstHit.hit.objectId,'triangle-panel');
  assert.strictEqual(first.queryScratch.closest,scratch,'the same world scratch survives a query');
  first.inspectCapsules([capsule([.25,.02,.5])],{phase:'walking'});
 }finally{THREE.Vector3.prototype.clone=originalClone;}
 assert.equal(cloneCalls,0,'the repeated closest-point narrowphase allocates no Vector3 clones');
 assert.deepEqual([scratch,scratch.delta,scratch.ray,scratch.rayHit,scratch.startTrianglePoint,scratch.endTrianglePoint,
  scratch.closestSegmentPoint,scratch.closestTrianglePoint,scratch.result,scratch.result.segmentPoint,scratch.result.trianglePoint,
  scratch.edge,scratch.edge.u,scratch.edge.v,scratch.edge.w,scratch.edge.segmentPoint,scratch.edge.edgePoint,scratch.edge.result],scratchObjects,
  'all hot-path vectors, ray, and result objects are reused');
 const savedHit=structuredClone(firstHit.hit);
 first.inspectCapsules([capsule([.8,.05,.95])],{phase:'walking'});
 assert.deepEqual(firstHit.hit,savedHit,'a later query cannot mutate an earlier hit diagnostic');
});

test('scratch-backed closest-point queries retain face, edge, vertex, and crossing results',()=>{
 const world=makeTriangleWorld();
 const crossing=world.inspectCapsules([capsule([0,-.2,0],[0,.2,0],.01)],{phase:'walking'});
 assert.equal(crossing.ok,false,'a segment crossing the triangle remains blocked');
 assert.equal(crossing.minClearanceM,-.01);

 const face=world.inspectCapsules([capsule([0,.05,0])],{phase:'walking'});
 assert.equal(face.ok,false,'a degenerate capsule centered over the face remains blocked');
 assert.ok(Math.abs(face.minClearanceM+.01)<1e-12);

 const edge=world.inspectCapsules([capsule([.25,.05,.5])],{phase:'walking'});
 assert.equal(edge.ok,false,'a degenerate capsule centered over an edge remains blocked');
 assert.ok(Math.abs(edge.minClearanceM+.01)<1e-12);

 const vertex=world.inspectCapsules([capsule([0,.05,1.03])],{phase:'walking'});
 assert.equal(vertex.ok,false,'near-vertex contact inside the capsule radius remains blocked');
 assert.ok(Math.abs(vertex.minClearanceM-(Math.hypot(.05,.03)-.06))<1e-12);

 const outside=world.inspectCapsules([capsule([.8,.05,.95])],{phase:'walking'});
 assert.equal(outside.ok,true,'a nearby capsule outside the triangle remains clear');
 assert.ok(outside.minClearanceM>0,'positive clearance is retained');
});

test('Projects first-fit diagnostics match the frozen query fixture under its pinned collision-world input order',async()=>{
 const room=createTycoonRoom('projects'),assembly=new TycoonAssembly(new THREE.Group(),loadModel);
 await assembly.replace([...tycoonSceneObjects('projects',room),{id:'demo-agent',kind:'actor',clip:'idle',optional:false}]);
 const inventoryIds=assembly.owned.map(model=>model.userData.instanceId),pinnedIds=rootOrderFixture.rootOrder;
 assert.equal(new Set(inventoryIds).size,inventoryIds.length,'the loaded room has unique object IDs');
 assert.equal(new Set(pinnedIds).size,pinnedIds.length,'the pinned collision-world order has unique object IDs');
 assert.deepEqual([...inventoryIds].sort(),[...pinnedIds].sort(),'the actual room inventory exactly matches the pinned order before ordering collision roots');
 assert.equal(createHash('sha256').update(JSON.stringify(pinnedIds)).digest('hex'),rootOrderFixture.orderedRootIdsSha256,'the pinned root-order provenance hash is intact');
 const rootsById=new Map(assembly.owned.map(model=>[model.userData.instanceId,model])),collisionRoots=pinnedIds.map(id=>rootsById.get(id));
 assert.ok(collisionRoots.every(Boolean),'each pinned root ID resolves to a loaded model');
 const activity=new TycoonActivity(room),collisionWorld=new TycoonCollisionWorld(collisionRoots);
 const actualQueries=[],inspect=collisionWorld.inspectCapsules.bind(collisionWorld);
 collisionWorld.inspectCapsules=function(capsules,options={}){
  const aggregate=inspect(capsules,options);
  for(const item of capsules||[]){
   const single=inspect([item],options);
   actualQueries.push({capsule:{name:item.name,side:item.side||null,start:item.start.toArray(),end:item.end.toArray(),radius:item.radius},
    result:{ok:single.ok,phase:single.phase,checkedCapsules:single.checkedCapsules,testedTriangles:single.testedTriangles,
     checkedMeshes:single.checkedMeshes,sampleCount:single.sampleCount,minClearanceM:single.minClearanceM,hit:single.hit}});
   if(!single.ok)break;
  }
  collisionWorld.lastDiagnostic=aggregate;return aggregate;
 };
 const scene={ready:true,room,assembly,activity,collisionWorld,play:TycoonScene.prototype.play,onStatus(){}};
 try{
  const result=TycoonScene.prototype.startStation.call(scene,'desk-1');
  assert.equal(result.ok,true,'the actual Projects desk remains reachable');
  assert.equal(collisionWorld.meshes.length,reference.provenance.collisionMeshes,'the collision world matches the saved room mesh inventory');
  assert.equal(collisionWorld.meshes.reduce((sum,mesh)=>sum+mesh.triangles.length,0),reference.provenance.collisionTriangles,'the collision world matches the saved triangle inventory');
  const station=activity.nav.stations.find(item=>item.id==='desk-1'||item.objectId==='desk-1');
  const fit=station?.footPlacementDiagnostic;
  assert.ok(fit?.ok,'the actual desk receives a measured foot fit');
  const fitTarget={distanceM:fit.distanceM,footWidthScale:fit.footWidthScale,footToeOutRad:fit.footToeOutRad,entryFlexM:fit.entryFlexM,
   minimumClearanceM:fit.minimumClearanceM,additionalRootAdvanceM:fit.additionalRootAdvanceM,candidateCount:fit.candidateCount,
   geometryQueries:fit.geometryQueries,reachQueries:fit.reachQueries,cacheHit:fit.cacheHit};
  assert.deepEqual(fitTarget,reference.fitTarget,'the chosen foot target and search counts remain exact');
  assert.equal(assembly.owned.length,reference.provenance.loadedModels,'the fixture loads the actual saved 55-model room');
  assert.equal(actualQueries.length,reference.queryRecords.length,'the first fit executes the same ordered capsule count');
  for(let index=0;index<actualQueries.length;index++)assert.equal(JSON.stringify(actualQueries[index]),JSON.stringify(reference.queryRecords[index]),`saved pre-scratch capsule diagnostic ${index}`);
 }finally{assembly.dispose();}
});
