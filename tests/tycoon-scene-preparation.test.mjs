import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene,TycoonAssembly,tycoonSceneObjects} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';
const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8')),models=new Map();
async function load(kind){if(!models.has(kind))models.set(kind,(async()=>{const f=TYCOON_FACTORY_ASSETS[kind],meta=f||manifest.assets.find(a=>a.kind===kind),bytes=await readFile(`web/assets/models/${f?'tycoon-factory':'tycoon'}/${meta.file}`),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');g.scene.animations=g.animations;return g.scene;})());return models.get(kind);}
async function fixture(){const room=createTycoonRoom('projects');room.objects.find(o=>o.id==='chair-1').scale=1.25;const assembly=new TycoonAssembly(new THREE.Group(),load);await assembly.replace([...tycoonSceneObjects('projects',room),{id:'demo-agent',kind:'actor',clip:'idle'}]);return {ready:false,disposed:false,sceneGeneration:1,room,assembly,activity:new TycoonActivity(room),collisionWorld:new TycoonCollisionWorld(assembly.owned),play:TycoonScene.prototype.play};}
test('cooperative initialization warms real seat fits while keeping readiness, inventory and motion honest',async()=>{
 const scene=await fixture(),actor=scene.assembly.owned.find(o=>o.userData.instanceId==='demo-agent'),before=JSON.stringify(scene.room);let turns=0,clock=0;
 try{
  assert.equal(typeof TycoonScene.prototype.prepareStations,'function','scene preparation must be cooperative');
  const records=await TycoonScene.prototype.prepareStations.call(scene,actor,{now:()=>++clock,yieldTurn:async()=>{turns++;assert.equal(scene.ready,false);assert.equal(scene.activity.snapshot,null);}});
  assert.ok(turns>1,'actual fitting yields multiple event-loop turns');assert.ok(records.length>0);assert.ok(records.every(r=>r.result.ok));
  assert.equal(JSON.stringify(scene.room),before,'preparation never saves or rewrites inventory');assert.equal(scene.activity.snapshot,null,'preparation never starts a lifecycle');
  scene.ready=true;assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);
  assert.equal(scene.activity.station.footPlacementDiagnostic.cacheHit,true,'the first interactive desk start uses its checked fit');
  assert.equal(scene.activity.station.footPlacementDiagnostic.geometryQueries,0,'no hidden first-use fitting burst');
 }finally{scene.assembly.dispose();}
});
for(const kind of ['disposed','world','generation'])test(`stale ${kind} initialization stops at its next yield and publishes no stale fit`,async()=>{
 const scene=await fixture(),actor=scene.assembly.owned.find(o=>o.userData.instanceId==='demo-agent');let release,clock=0;
 try{
  assert.equal(typeof TycoonScene.prototype.prepareStations,'function');
  const pending=TycoonScene.prototype.prepareStations.call(scene,actor,{now:()=>++clock,yieldTurn:()=>new Promise(r=>{release=r;})});
  await new Promise(setImmediate);assert.equal(typeof release,'function','the actual fit reaches a cooperative boundary');
  if(kind==='disposed')scene.disposed=true;else if(kind==='world')scene.collisionWorld=new TycoonCollisionWorld([]);else scene.sceneGeneration++;
  release();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(scene.activity.nav.stations[0].footPlacementDiagnostic,undefined,'a cancelled first fit is not published');assert.equal(scene.activity.snapshot,null);
 }finally{scene.assembly.dispose();}
});
test('repeated Studio scene refreshes remain ready without loading every seat fit again',async()=>{
 const scene=await fixture(),prepare=TycoonScene.prototype.prepareStations;let preparations=0;
 scene.editor={cancel(){},highlight(){}};scene.reset=()=>{};scene.fit=()=>{};TycoonScene.prototype.prepareStations=async()=>{preparations++;return [];};
 try{for(let edit=0;edit<3;edit++){await TycoonScene.prototype.setScene.call(scene,'projects',scene.room,{preserveCamera:true});assert.equal(scene.ready,true);}assert.equal(preparations,0,'Studio edits/undo/redo must not await all-seat prewarming');}
 finally{TycoonScene.prototype.prepareStations=prepare;scene.assembly.dispose();}
});
