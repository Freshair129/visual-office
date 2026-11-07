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

const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8'));
const models=new Map();
async function load(kind){
  if(!models.has(kind))models.set(kind,(async()=>{
    const factory=TYCOON_FACTORY_ASSETS[kind],asset=factory||manifest.assets.find(item=>item.kind===kind);
    const bytes=await readFile(`web/assets/models/${factory?'tycoon-factory':'tycoon'}/${asset.file}`);
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    gltf.scene.animations=gltf.animations;return gltf.scene;
  })());
  return models.get(kind);
}
async function fixture(){
  const room=createTycoonRoom('projects');room.objects.find(object=>object.id==='chair-1').scale=1.25;
  const assembly=new TycoonAssembly(new THREE.Group(),load);
  await assembly.replace([...tycoonSceneObjects('projects',room),{id:'demo-agent',kind:'actor',clip:'idle'}]);
  const actor=assembly.owned.find(object=>object.userData.instanceId==='demo-agent');actor.visible=false;
  return Object.assign(Object.create(TycoonScene.prototype),{ready:true,disposed:false,sceneGeneration:1,room,assembly,activity:new TycoonActivity(room),
    collisionWorld:new TycoonCollisionWorld(assembly.owned)});
}
async function waitFor(predicate){
  for(let attempt=0;attempt<100;attempt++){
    if(predicate())return;
    await new Promise(setImmediate);
  }
  assert.fail('cooperative start did not reach its controlled yield');
}

test('cold selected-station start yields before real GLB fitting and starts only after fit and route completion',async()=>{
  const scene=await fixture(),actor=scene.assembly.owned.find(object=>object.userData.instanceId==='demo-agent');
  const inventory=JSON.stringify(scene.room),station=scene.activity.nav.stations.find(item=>item.objectId==='desk-1'),startPoint={...scene.activity.nav.spawnPoint};
  scene.activity.nav.findLocalPath(startPoint,station.position);
  scene.activity.snapshot={position:{...startPoint},heading:0,clip:'walk',status:'walking'};scene.activity.phase='walking';
  let release,turns=0,clock=0;
  try{
    assert.equal(typeof TycoonScene.prototype.startStationAsync,'function','selected Studio start must have an asynchronous API');
    const pending=TycoonScene.prototype.startStationAsync.call(scene,'desk-1',{budgetMs:0,now:()=>clock++,yieldTurn:()=>{
      turns++;if(turns===1)return new Promise(resolve=>release=resolve);return Promise.resolve();
    }});
    let done=false;const settled=pending.then(value=>({value}),error=>({error})).finally(()=>done=true);
    await waitFor(()=>release||done);
    if(typeof release!=='function'){const outcome=await settled;assert.fail(`async start settled before a yield: ${outcome.error?.stack||JSON.stringify(outcome.value)}`);}
    assert.equal(scene.activity.snapshot,null,'previous motion is stopped while selected preparation is pending');
    assert.equal(actor.visible,false,'no partially fitted actor is rendered during a scheduler yield');
    assert.equal(JSON.stringify(scene.room),inventory,'the cooperative fit does not mutate saved room inventory');
    release();
    const result=await settled;
    assert.ok(result.value?.ok,`cold real-GLB selected start should complete: ${result.error?.message||result.value?.message}`);
    assert.ok(turns>0,'the selected GLB start returns to the event loop before fitting');
    assert.deepEqual(scene.activity.path[0],startPoint,'the captured previous position seeds the completed route');
    assert.equal(scene.activity.station?.objectId,'desk-1');
    assert.equal(actor.visible,false,'the transient probe remains hidden until a checked pose is rendered');
    assert.equal(JSON.stringify(scene.room),inventory,'starting a local station never changes room inventory');
  }finally{scene.assembly.dispose();}
});

test('Stop during a controlled cold GLB fit cancels the selected start before motion begins',async()=>{
  const scene=await fixture(),actor=scene.assembly.owned.find(object=>object.userData.instanceId==='demo-agent');
  const inventory=JSON.stringify(scene.room);let release,turns=0,clock=0;
  try{
    assert.equal(typeof TycoonScene.prototype.startStationAsync,'function','selected Studio start must have an asynchronous API');
    const pending=TycoonScene.prototype.startStationAsync.call(scene,'desk-1',{budgetMs:0,now:()=>clock++,yieldTurn:()=>{
      turns++;if(turns===1)return new Promise(resolve=>release=resolve);return Promise.resolve();
    }});
    let done=false;const settled=pending.then(value=>({value}),error=>({error})).finally(()=>done=true);
    await waitFor(()=>release||done);
    if(typeof release!=='function'){const outcome=await settled;assert.fail(`async start settled before a yield: ${outcome.error?.stack||JSON.stringify(outcome.value)}`);}
    TycoonScene.prototype.stopTest.call(scene);
    release();
    const result=await settled;
    assert.ok(result.error?.name==='AbortError'||result.value?.cancelled||result.value?.stale,
      'Stop returns a cancellation outcome instead of a successful start');
    assert.equal(scene.activity.snapshot,null,'cancelled cold fitting never starts a lifecycle');
    assert.equal(actor.visible,false,'cancelled cold fitting leaves the transient actor hidden');
    assert.equal(JSON.stringify(scene.room),inventory,'cancellation never changes saved room inventory');
  }finally{scene.assembly.dispose();}
});

test('a reentrant newer activity survives when startStation invalidates the completing request',async()=>{
  const fit=TycoonScene.prototype.fitStation;let scene;
  TycoonScene.prototype.fitStation=function*(){return {ok:true};};
  const station={id:'desk-1',objectId:'desk-1',position:{x:2,y:3}};
  const activity={nav:{stations:[station],spawnPoint:{x:0,y:0},isWalkable:()=>true,
      findLocalPathSteps(from,to){return (function*(){return [{...from},{...to}];})();}},
    snapshot:{position:{x:0,y:0}},stops:0,
    stop(){this.stops++;this.snapshot=null;},
    startStation(){this.snapshot={position:{x:90,y:91},status:'newer activity'};scene.cancelStationStart();return {ok:true,message:'station started'};}};
  const actor={visible:false,userData:{instanceId:'demo-agent'}};
  scene=Object.assign(Object.create(TycoonScene.prototype),{ready:true,disposed:false,sceneGeneration:1,room:{},activity,collisionWorld:{},assembly:{owned:[actor]}});
  try{
    const result=await scene.startStationAsync('desk-1',{budgetMs:100,now:()=>0,yieldTurn:async()=>{}});
    assert.equal(result.cancelled,true,`the selected start reports its now-stale completion: ${JSON.stringify(result)}`);
    assert.deepEqual(activity.snapshot,{position:{x:90,y:91},status:'newer activity'},'a stale completion cannot stop a replacement activity');
    assert.equal(activity.stops,1,'only the explicit initial stop occurs');
  }finally{TycoonScene.prototype.fitStation=fit;}
});

function cooperativeScene(){
  const station={id:'desk-1',objectId:'desk-1',position:{x:2,y:3}},nav={stations:[station],spawnPoint:{x:0,y:0},
    isWalkable:()=>true,findLocalPathSteps(from,to){return (function*(){return [{...from},{...to}];})();}};
  const activity={nav,snapshot:{position:{x:1,y:2}},stops:0,startCalls:[],
    stop(){this.stops++;this.snapshot=null;},
    startStation(id,options){this.startCalls.push({id,startPoint:options?.startPoint&&{...options.startPoint}});this.snapshot={position:{x:8,y:9},status:'station'};return {ok:true,message:'station started'};},
    startRoute(){this.snapshot={position:{x:6,y:7},status:'walk'};return {ok:true,message:'walk started'};}};
  const actor={visible:false,userData:{instanceId:'demo-agent'}};
  const scene=Object.assign(Object.create(TycoonScene.prototype),{ready:true,disposed:false,sceneGeneration:1,room:{id:'room-1'},activity,
    collisionWorld:{id:'world-1'},assembly:{owned:[actor]}});
  return {scene,activity,actor};
}
async function startAtControlledYield(scene){
  let release;const pending=scene.startStationAsync('desk-1',{budgetMs:100,now:()=>0,yieldTurn:()=>new Promise(resolve=>release=resolve)});
  const settled=pending.then(value=>({value}),error=>({error}));
  await waitFor(()=>release);
  return {release,settled};
}

test('default selected preparation uses the browser cooperative scheduler and stays cancellable',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'scheduler'),{scene,activity}=cooperativeScene();
  let calls=0,release,pending;const browserScheduler={yield(){assert.equal(this,browserScheduler);calls++;return new Promise(resolve=>release=resolve);}};
  Object.defineProperty(globalThis,'scheduler',{configurable:true,value:browserScheduler});
  try{
    pending=scene.startStationAsync('desk-1');
    assert.equal(calls,1,'the first preparation turn should use scheduler.yield when the browser provides it');
    assert.equal(activity.snapshot,null);scene.stopTest();release();
    assert.equal((await pending).cancelled,true);assert.equal(activity.startCalls.length,0);
  }finally{
    scene.stopTest();release?.();await pending?.catch(()=>{});
    if(descriptor)Object.defineProperty(globalThis,'scheduler',descriptor);else delete globalThis.scheduler;
  }
});

test('default selected preparation retains a timer fallback when the browser scheduler is unavailable',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'scheduler'),fit=TycoonScene.prototype.fitStation,{scene,activity}=cooperativeScene();
  Object.defineProperty(globalThis,'scheduler',{configurable:true,value:undefined});
  TycoonScene.prototype.fitStation=function*(){return {ok:true};};
  try{
    const pending=scene.startStationAsync('desk-1');assert.equal(activity.startCalls.length,0,'fallback still yields before work');
    assert.equal((await pending).ok,true);assert.equal(activity.startCalls.length,1);
  }finally{TycoonScene.prototype.fitStation=fit;if(descriptor)Object.defineProperty(globalThis,'scheduler',descriptor);else delete globalThis.scheduler;}
});

test('a replacement station start cancels the old request and inherits its captured start point',async()=>{
  const {scene,activity}=cooperativeScene(),original={...activity.snapshot.position};
  const first=await startAtControlledYield(scene);
  const second=await scene.startStationAsync('desk-1',{budgetMs:100,now:()=>0,yieldTurn:async()=>{}});
  assert.equal(second.ok,true);
  assert.deepEqual(activity.startCalls[0],{id:'desk-1',startPoint:original});
  first.release();
  const old=await first.settled;
  assert.equal(old.value?.cancelled,true,'the replaced request settles as cancelled');
  assert.equal(activity.snapshot.status,'station','the older request cannot overwrite the newer start');
});

test('Stop, walk, room, world, activity, navigation, setScene and disposal cancel a controlled request',async()=>{
  const cases=[
    ['Stop',async scene=>scene.stopTest()],
    ['walk',async scene=>scene.startWalk([])],
    ['room',async scene=>{scene.room={id:'room-2'};}],
    ['world',async scene=>{scene.collisionWorld={id:'world-2'};}],
    ['activity',async scene=>{scene.activity={...scene.activity};}],
    ['navigation',async scene=>{scene.activity.nav={...scene.activity.nav};}],
    ['generation',async scene=>{scene.sceneGeneration++;}],
    ['setScene',async scene=>{
      scene.reset=()=>{};scene.fit=()=>{};scene.assembly.replace=async()=>{scene.assembly.owned=[];};
      await TycoonScene.prototype.setScene.call(scene,'projects',{width:12,depth:8,objects:[]},{preserveCamera:true,allowProbe:false});
    }],
    ['disposal',async scene=>{
      scene.resizeObserver={disconnect(){}};scene.renderer={domElement:{removeEventListener(){},remove(){}},setAnimationLoop(){},dispose(){}};
      scene.cache=new Map();scene.assembly.dispose=()=>{};
      TycoonScene.prototype.dispose.call(scene);await scene.disposal;
    }],
  ];
  for(const [label,invalidate] of cases){
    const {scene,activity,actor}=cooperativeScene(),pending=await startAtControlledYield(scene);
    await invalidate(scene);pending.release();const result=await pending.settled;
    assert.ok(result.error?.name==='AbortError'||result.value?.cancelled,
      `${label} settles the pending request as cancelled`);
    assert.equal(activity.startCalls.length,0,`${label} prevents stale station motion`);
    if(label!=='disposal')assert.equal(actor.visible,false,`${label} leaves the probe hidden`);
  }
});
