import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene,TycoonAssembly,tycoonSceneObjects} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';
const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8')),models=new Map();
async function load(kind){if(!models.has(kind))models.set(kind,(async()=>{const f=TYCOON_FACTORY_ASSETS[kind],meta=f||manifest.assets.find(a=>a.kind===kind),bytes=await readFile(`web/assets/models/${f?'tycoon-factory':'tycoon'}/${meta.file}`),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');g.scene.animations=g.animations;return g.scene;})());return models.get(kind);}
async function replay(cached,{fullMatrices=false}={}){
 const room=createTycoonRoom('projects');room.objects.find(o=>o.id==='chair-1').scale=1.25;
 const assembly=new TycoonAssembly(new THREE.Group(),load);await assembly.replace([...tycoonSceneObjects('projects',room),{id:'demo-agent',kind:'actor',clip:'idle'}]);
 const actor=assembly.owned.find(o=>o.userData.instanceId==='demo-agent'),activity=new TycoonActivity(room),world=new TycoonCollisionWorld(assembly.owned),scene={ready:true,room,assembly,activity,collisionWorld:world,play:TycoonScene.prototype.play};
 if(!cached)world.createSweepBatch=()=>null;
 const sweep=world.sweepCapsules.bind(world),hash=createHash('sha256'),phases=new Set();let triangles=0,hits=0,started=false,done=false,actorUpdates=0,maxActorUpdates=0;
 const updateActor=actor.updateMatrixWorld.bind(actor);actor.updateMatrixWorld=(...args)=>{actorUpdates++;return updateActor(...args);};
 world.sweepCapsules=(...args)=>{const r=sweep(...args);triangles+=r.testedTriangles;hits+=r.cacheHits||0;return r;};
 try{
  assert.equal(TycoonScene.prototype.startWalk.call(scene,activity.nav.suggestRoute()).ok,true);
  for(let frame=0;frame<5000;frame++){
   if(fullMatrices&&actor.userData.contact&&!actor.userData.contact.fullMatrixReference){const c=actor.userData.contact,collect=c.limbCapsules.bind(c);c.updateLegWorld=()=>actor.updateMatrixWorld(true);c.limbCapsules=arms=>collect(arms);c.fullMatrixReference=true;}
   actorUpdates=0;TycoonScene.prototype.updateProbe.call(scene,actor,1/30);maxActorUpdates=Math.max(maxActorUpdates,actorUpdates);assert.notEqual(activity.phase,'blocked',JSON.stringify(scene.collisionDiagnostics));
   const contact=actor.userData.contact,d=actor.userData.limbCollisionDiagnostics;assert.notEqual(d?.ok,false);
   phases.add(activity.phase);hash.update(JSON.stringify({phase:activity.phase,position:actor.position.toArray(),feet:contact.legs.map(l=>l.point.toArray()),capsules:contact.safePose?.segments.map(c=>[c.name,c.start.toArray(),c.end.toArray(),c.radius]),hit:d?.hit,minClearanceM:d?.minClearanceM}));
   if(activity.phase==='done'){if(started){done=true;break;}assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);started=true;phases.clear();}
  }
  assert.ok(done,'actual large-chair route→desk lifecycle completes');for(const p of ['entering','sit','working','standing','leaving','settling','done'])assert.ok(phases.has(p),p);
  return {hash:hash.digest('hex'),triangles,hits,maxActorUpdates};
 }finally{assembly.dispose();}
}
test('large-chair repair memo preserves every accepted pose and contact while reducing executed triangle tests',async()=>{
 const cached=await replay(true),reference=await replay(false);assert.equal(cached.hash,reference.hash,'exact accepted poses/feet/clearance at every sampled frame');
 assert.ok(cached.hits>1000,`actual repair must reuse checked samples: ${JSON.stringify(cached)}`);
 assert.ok(cached.triangles<reference.triangles*.75,`geometry work: cached=${JSON.stringify(cached)} reference=${JSON.stringify(reference)}`);
});
test('leg-only repair refreshes changed branches without rebuilding the whole actor for every candidate',async t=>{
 const scoped=await replay(true),reference=await replay(true,{fullMatrices:true});
 t.diagnostic(JSON.stringify({scoped,reference}));
 assert.equal(scoped.hash,reference.hash,'scoped bone matrices retain the exact accepted pose at every frame');
 assert.ok(reference.maxActorUpdates>500,'the reference exercises the full actor rebuild burst');
 assert.ok(scoped.maxActorUpdates<reference.maxActorUpdates*.25,`scoped=${JSON.stringify(scoped)}, full=${JSON.stringify(reference)}`);
});
