import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene,TycoonAssembly,tycoonSceneObjects} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8'));
const models=new Map();
async function load(kind){
 if(!models.has(kind))models.set(kind,(async()=>{
  const factory=TYCOON_FACTORY_ASSETS[kind],meta=factory||manifest.assets.find(asset=>asset.kind===kind),bytes=await readFile(`web/assets/models/${factory?'tycoon-factory':'tycoon'}/${meta.file}`),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.animations=gltf.animations;return gltf.scene;
 })());
 return models.get(kind);
}

async function replay(){
 const room=createTycoonRoom('projects');room.objects.find(object=>object.id==='chair-1').scale=1.25;
 const objects=[...tycoonSceneObjects('projects',room),{id:'demo-agent',kind:'actor',clip:'idle'}];
 // Resolve each asset before Assembly.replace so Promise.all's completion timing cannot change collision root order.
 for(const kind of new Set(objects.map(object=>object.kind)))await load(kind);
 const assembly=new TycoonAssembly(new THREE.Group(),load);await assembly.replace(objects);
 const actor=assembly.owned.find(object=>object.userData.instanceId==='demo-agent'),activity=new TycoonActivity(room),world=new TycoonCollisionWorld(assembly.owned),scene={ready:true,room,assembly,activity,collisionWorld:world,play:TycoonScene.prototype.play};
 const hash=createHash('sha256'),phases=new Set();let started=false,done=false,current={world:0,parent:0,children:0,actor:0},totals={world:0,parent:0,children:0,actor:0},maxima={world:0,parent:0,children:0,actor:0};
 actor.traverse(object=>{
  const update=object.updateWorldMatrix;
  object.updateWorldMatrix=function(updateParents,updateChildren){current.world++;if(updateParents===true)current.parent++;if(updateChildren===true)current.children++;return update.call(this,updateParents,updateChildren);};
 });
 const updateActor=actor.updateMatrixWorld.bind(actor);
 actor.updateMatrixWorld=(...args)=>{current.actor++;return updateActor(...args);};
 try{
  assert.equal(TycoonScene.prototype.startWalk.call(scene,activity.nav.suggestRoute()).ok,true);
  for(let frame=0;frame<5000;frame++){
   current={world:0,parent:0,children:0,actor:0};
   TycoonScene.prototype.updateProbe.call(scene,actor,1/30);
   for(const key of Object.keys(totals)){totals[key]+=current[key];maxima[key]=Math.max(maxima[key],current[key]);}
   assert.notEqual(activity.phase,'blocked',JSON.stringify(scene.collisionDiagnostics));
   const contact=actor.userData.contact,diagnostic=actor.userData.limbCollisionDiagnostics;assert.notEqual(diagnostic?.ok,false);
   phases.add(activity.phase);
   hash.update(JSON.stringify({phase:activity.phase,position:actor.position.toArray(),feet:contact.legs.map(leg=>leg.point.toArray()),capsules:contact.safePose?.segments.map(capsule=>[capsule.name,capsule.start.toArray(),capsule.end.toArray(),capsule.radius]),hit:diagnostic?.hit,minClearanceM:diagnostic?.minClearanceM}));
   if(activity.phase==='done'){
    if(started){done=true;break;}
    assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);started=true;phases.clear();
   }
  }
  assert.ok(done,'actual 1.25 chair route→desk lifecycle completes');
  for(const phase of ['entering','sit','working','standing','leaving','settling','done'])assert.ok(phases.has(phase),phase);
  return {hash:hash.digest('hex'),totals,maxima};
 }finally{assembly.dispose();}
}

test('fresh leg matrix reads preserve the exact accepted 1.25 chair lifecycle while avoiding repeated ancestor refreshes',async()=>{
 const result=await replay();
 const reference={hash:'a106ee7051e2d510dc256d868a3c64769dc676db7eaafedd41d423ec726e67ae',totalWorld:2547683,totalParentRefresh:2497398,maxWorldFrame:99542,maxParentFrame:94378,totalActorRefresh:54111};
 assert.equal(result.hash,reference.hash,'accepted root, feet, capsule, hit and clearance samples match the pre-change 1.25 chair lifecycle');
 assert.ok(result.totals.world<reference.totalWorld*.75,JSON.stringify(result));
 assert.ok(result.totals.parent<reference.totalParentRefresh*.7,JSON.stringify(result));
 assert.ok(result.maxima.world<reference.maxWorldFrame*.25,JSON.stringify(result));
 assert.ok(result.maxima.parent<reference.maxParentFrame*.25,JSON.stringify(result));
 assert.ok(result.totals.actor<reference.totalActorRefresh*.95,JSON.stringify(result));
});

test('public leg pose hint refreshes a scaled actor under a changed parent transform',async()=>{
 const actor=cloneSkeleton(await load('actor')),parent=new THREE.Group();actor.scale.setScalar(1.25);parent.add(actor);parent.updateMatrixWorld(true);
 const contact=new ProbeContact(actor);assert.equal(contact.update({heading:0,seatHeight:.551132},'walking',1/30).ok,true);
 const before=contact.legs[0].hip.getWorldPosition(new THREE.Vector3()),hint={offsets:contact.legs.map(()=>new THREE.Vector3()),poleElevations:[0,0]};
 parent.position.x=.03;
 const [thigh]=contact.limbCapsules();
 assert.ok(Math.abs((thigh.start.x-before.x)-.03)<1e-8,'public capsule collection refreshes a changed ancestor before reading matrices');
 parent.position.x=.06;
 assert.equal(contact.applyLegPoseHint(hint),true,'public helper refreshes all ancestors before the local solve');
 const after=contact.legs[0].hip.getWorldPosition(new THREE.Vector3());
 assert.ok(Math.abs((after.x-before.x)-.06)<1e-8,`scaled rig follows the refreshed parent transform: ${before.x} → ${after.x}`);
 assert.ok(contact.limbCapsules().every(capsule=>[...capsule.start,...capsule.end].every(Number.isFinite)));
});
