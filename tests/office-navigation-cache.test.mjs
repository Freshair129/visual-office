import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createOfficeNavigation} from '../web/office-navigation.js';
import {defaultBlueprintPlan,toggleBlueprintDoor} from '../web/office-blueprint-state.js';
import {blueprintPoint} from '../web/office-blueprints.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';
import {TycoonAssembly,tycoonSceneObjects} from '../web/tycoon-scene.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {createTycoonNavigation,tycoonEditorRoom} from '../web/tycoon-blueprint.js';
import {TYCOON_BLUEPRINT_OPTIONS,TYCOON_COORDINATE_BOUNDS} from '../web/office-design-limits.js';

const officeRoom=(objects=[])=>({schemaVersion:'office-room/v1',background:'office',objects});
const object=(id,kind,x,y,scale=1,flip=false)=>({id,kind,x,y,scale,flip});
const copy=value=>structuredClone(value);

function cacheFixture(){
  const room=officeRoom([
    object('desk-a','work-desk',66,43,.62),
    object('chair-a','task-chair',69.2,40.5,.72,true),
    object('chair-b','task-chair',71.6,40.5,.72,false),
  ]);
  room.navigation={version:1,routes:[],forbidden:[{id:'restricted',points:[
    {x:52,y:43},{x:54,y:43},{x:54,y:45},{x:52,y:45},
  ]}],stations:[]};
  return room;
}

function countWork(stats){
  return stats.isWalkable.computations+stats.segmentWalkable.computations;
}

test('cold A* skips closed and dominated neighbors before collision queries',()=>{
  const room=officeRoom([object('desk-a','work-desk',66,43,.62)]);
  const navigation=createOfficeNavigation(copy(room),{cacheQueries:false});
  const before=navigation.getQueryCacheStats();
  const path=navigation.findLocalPath({x:58,y:43},{x:74,y:43});
  const after=navigation.getQueryCacheStats();
  assert.deepEqual(path,[
    {x:58,y:43},{x:63,y:37.5},{x:69.75,y:38.25},{x:74,y:43},
  ],'early dominance checks preserve exact path geometry and tie order');
  const work=countWork(after)-countWork(before);
  assert.ok(work<7895,`cold A* should avoid collision queries for rejected neighbors (${work} vs pre-optimization 7895)`);
});

test('Projects route and first desk path preserve reference geometry while pruning blocker checks',async()=>{
  const sceneRoom=createTycoonRoom('projects'),navRoom=structuredClone(sceneRoom);
  navRoom.objects.push({id:'custom-nav-fixture',kind:'custom',x:11.1,y:0,z:6.7,rotation:.61,scale:1,intent:'decor',
    asset:{id:'custom-nav-fixture',name:'Custom nav fixture',category:'decor',size:[1.1,1,.7],interaction:{mode:'none'}}});
  const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8')),loaded=new Map();
  const load=kind=>{
    if(!loaded.has(kind))loaded.set(kind,(async()=>{
      const factory=TYCOON_FACTORY_ASSETS[kind],meta=factory||manifest.assets.find(asset=>asset.kind===kind);
      assert.ok(meta,`actual GLB metadata for ${kind}`);
      const bytes=await readFile(`web/assets/models/${factory?'tycoon-factory':'tycoon'}/${meta.file}`);
      const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
      gltf.scene.animations=gltf.animations;return gltf.scene;
    })());
    return loaded.get(kind);
  };
  const assembly=new TycoonAssembly(new THREE.Group(),load);
  try{
    const sceneObjects=[...tycoonSceneObjects('projects',sceneRoom),{id:'demo-agent',kind:'actor',clip:'idle',optional:false}];
    await assembly.replace(sceneObjects);
    assert.equal(assembly.owned.length,sceneObjects.length,'the actual Projects room GLBs and actor load');

    const activity=new TycoonActivity(navRoom),production=activity.nav;
    assert.ok(navRoom.objects.some(object=>Math.abs(object.rotation)>.1),'the room contains rotated furniture');
    assert.ok(production.blockers.some(blocker=>blocker.id==='custom-nav-fixture'&&blocker.type==='prop'&&blocker.polygon.length===4),
      'the room contributes a rotated custom footprint');
    assert.ok(navRoom.blueprintPlan.partitions.some(partition=>partition.door),'the Projects plan contains door geometry');
    assert.ok(production.blockers.some(blocker=>blocker.type==='wall')&&production.blockers.some(blocker=>blocker.id.startsWith('metric-wall-')),
      'the room navigation includes wall and door blockers');

    const route=production.suggestRoute();
    assert.ok(route.length>1,'the actual full-room route is available');
    const sourceBlockers=production.blockers.filter(blocker=>blocker.type==='prop'||blocker.id.startsWith('metric-'));
    const options={objectBlockers:sourceBlockers,coordinateBounds:TYCOON_COORDINATE_BOUNDS,blueprintOptions:TYCOON_BLUEPRINT_OPTIONS};
    const cached=createOfficeNavigation(tycoonEditorRoom(navRoom),options);
    const reference=createOfficeNavigation(tycoonEditorRoom(navRoom),{...options,cacheQueries:false});
    const cachedBefore=cached.getQueryCacheStats(),referenceBefore=reference.getQueryCacheStats();
    const cachedRoute=cached.findLocalPath(route[0],route.at(-1));
    const referenceRoute=reference.findLocalPath(route[0],route.at(-1));
    assert.deepEqual(cachedRoute,route,'the optimized A* route matches the actual Projects route');
    assert.deepEqual(cachedRoute,referenceRoute,'reference mode returns the same actual-room route');

    assert.equal(activity.startRoute(route).ok,true);
    for(let frame=0;activity.phase!=='done'&&activity.phase!=='blocked'&&frame<5000;frame++)activity.tick(1/30);
    assert.equal(activity.phase,'done','the simulated route reaches its actual endpoint');
    const stationStart={...activity.snapshot.position},station=production.stations.find(item=>item.objectId==='desk-1');
    assert.ok(station,'the actual desk station exists');
    assert.equal(activity.startStation('desk-1').ok,true,'the first actual desk lifecycle can start');
    const actualStationPath=activity.path;
    const cachedStationPath=cached.findLocalPath(stationStart,station.position);
    const referenceStationPath=reference.findLocalPath(stationStart,station.position);
    assert.deepEqual(actualStationPath,referenceStationPath,'the first station path matches the uncached reference');
    assert.deepEqual(cachedStationPath,referenceStationPath,'cached and reference station paths match exactly');

    const cachedAfter=cached.getQueryCacheStats(),referenceAfter=reference.getQueryCacheStats();
    const work=stats=>stats.isWalkable.blockerChecks+stats.segmentWalkable.blockerChecks;
    const cachedChecks=work(cachedAfter)-work(cachedBefore),referenceChecks=work(referenceAfter)-work(referenceBefore);
    assert.ok(Number.isFinite(cachedChecks)&&Number.isFinite(referenceChecks),'navigation exposes collision narrow-phase work counts');
    assert.ok(cachedChecks<referenceChecks,
      `immutable spatial broadphase reduces exact blocker checks (${cachedChecks} vs ${referenceChecks})`);
  }finally{assembly.dispose();}
});

test('cached point, segment and grid-path queries match the uncached reference and reduce real search work',()=>{
  const room=officeRoom([object('desk-a','work-desk',66,43,.62)]);
  const cached=createOfficeNavigation(copy(room));
  const reference=createOfficeNavigation(copy(room),{cacheQueries:false});
  const cachedBefore=cached.getQueryCacheStats(),referenceBefore=reference.getQueryCacheStats();
  const from={x:58,y:43},to={x:74,y:43};

  const cachedPath=cached.findLocalPath(from,to),referencePath=reference.findLocalPath(from,to);
  assert.ok(cachedPath.length>2,'the case must run A* around the desk');
  assert.deepEqual(cachedPath,referencePath,'memoization must keep exact path geometry');
  const cachedAfter=cached.getQueryCacheStats(),referenceAfter=reference.getQueryCacheStats();
  const cachedWork=countWork(cachedAfter)-countWork(cachedBefore);
  const referenceWork=countWork(referenceAfter)-countWork(referenceBefore);
  assert.ok(cachedWork<referenceWork,`memoized search should compute fewer point/segment checks (${cachedWork} vs ${referenceWork})`);

  const repeatedBefore=cached.getQueryCacheStats();
  const detached=cached.findLocalPath(from,to);
  const repeatedAfter=cached.getQueryCacheStats();
  assert.deepEqual(detached,cachedPath);
  assert.equal(repeatedAfter.findLocalPath.computations,repeatedBefore.findLocalPath.computations,
    'an identical directed path query should reuse the completed grid result');
  assert.equal(repeatedAfter.findLocalPath.hits,repeatedBefore.findLocalPath.hits+1);
});

test('cached query answers preserve rotated blockers, forbidden areas and exact coordinates',()=>{
  const room=cacheFixture();
  const cached=createOfficeNavigation(copy(room));
  const reference=createOfficeNavigation(copy(room),{cacheQueries:false});
  const points=[
    {x:43,y:48},{x:32,y:56},{x:66,y:43},{x:69.2,y:40.5},
    {x:52-5e-8,y:44},{x:52,y:44},{x:53,y:44},
  ];
  const ignores=[[],['desk-a'],['chair-a','desk-a','chair-a'],['desk-a','chair-a'],['restricted']];
  for(const point of points)for(const ignoreIds of ignores){
    assert.equal(cached.isWalkable(point,{ignoreIds}),reference.isWalkable(point,{ignoreIds}),
      `point ${JSON.stringify(point)} with ${JSON.stringify(ignoreIds)}`);
  }

  const outside={x:52-5e-8,y:44},inside={x:52,y:44};
  const exactRoom=officeRoom();exactRoom.navigation=copy(room.navigation);
  const exact=createOfficeNavigation(exactRoom),exactBefore=exact.getQueryCacheStats();
  assert.equal(exact.isWalkable(outside),true,'a point just outside the forbidden boundary remains open');
  const afterOutside=exact.getQueryCacheStats();
  assert.equal(exact.isWalkable(inside),false,'the exact forbidden boundary stays blocked');
  const afterInside=exact.getQueryCacheStats();
  assert.equal(afterOutside.isWalkable.computations,exactBefore.isWalkable.computations+1);
  assert.equal(afterInside.isWalkable.computations,afterOutside.isWalkable.computations+1,
    'nearby exact coordinates must not collide in a rounded cache key');

  const canonicalPoint={x:60.123456,y:39.654321};
  const beforeCanonical=cached.getQueryCacheStats();
  const withOrderedIds=cached.isWalkable(canonicalPoint,{ignoreIds:['chair-a','desk-a','chair-a']});
  const afterOrdered=cached.getQueryCacheStats();
  const withCanonicalIds=cached.isWalkable(canonicalPoint,{ignoreIds:['desk-a','chair-a']});
  const afterCanonical=cached.getQueryCacheStats();
  assert.equal(withOrderedIds,withCanonicalIds);
  assert.equal(afterCanonical.isWalkable.computations,afterOrdered.isWalkable.computations,
    'ignore id order and duplicates map to the same effective ignore set');
  assert.equal(afterCanonical.isWalkable.hits,afterOrdered.isWalkable.hits+1);

  const segments=[
    [{x:43,y:48},{x:32,y:56},[]],
    [{x:32,y:56},{x:43,y:48},[]],
    [{x:58,y:43},{x:74,y:43},['desk-a']],
    [{x:58,y:43},{x:74,y:43},['chair-a','desk-a','chair-a']],
    [outside,inside,['restricted']],
  ];
  for(const [a,b,ignoreIds] of segments){
    assert.equal(cached.isSegmentWalkable(a,b,{ignoreIds}),reference.isSegmentWalkable(a,b,{ignoreIds}),
      `directed segment ${JSON.stringify(a)} to ${JSON.stringify(b)} with ${JSON.stringify(ignoreIds)}`);
  }

  const directed=createOfficeNavigation(officeRoom());
  directed.isSegmentWalkable({x:43,y:48},{x:32,y:56});
  const forwardStats=directed.getQueryCacheStats();
  directed.isSegmentWalkable({x:32,y:56},{x:43,y:48});
  const reverseStats=directed.getQueryCacheStats();
  assert.equal(reverseStats.segmentWalkable.computations,forwardStats.segmentWalkable.computations+1,
    'reversing a segment keeps a separate directed cache key');

  for(const [a,b,ignoreIds] of [
    [{x:43,y:48},{x:32,y:56},[]],
    [{x:58,y:43},{x:74,y:43},['desk-a']],
    [{x:60,y:41},{x:73,y:45},['chair-a','desk-a','chair-a']],
  ])assert.deepEqual(cached.findLocalPath(a,b,{ignoreIds}),reference.findLocalPath(a,b,{ignoreIds}));
});

test('closed-door and forbidden geometry stays authoritative, and each new geometry gets a fresh cache',()=>{
  const plan=defaultBlueprintPlan('medium');
  plan.partitions=[{id:'divide',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4,open:true}}];
  const closedPlan=toggleBlueprintDoor(plan,'partition:divide');
  const roomFor=value=>({schemaVersion:'office-room/v1',background:'office',blueprint:'medium',blueprintPlan:value,
    objects:[],navigation:{version:1,routes:[],forbidden:[{id:'sealed-area',points:[
      {x:51,y:44},{x:52,y:44},{x:52,y:45},{x:51,y:45},
    ]}],stations:[]}});
  const a=blueprintPoint(plan,4,4.7),b=blueprintPoint(plan,6,4.7);
  const open=createOfficeNavigation(roomFor(plan));
  const closed=createOfficeNavigation(roomFor(closedPlan));
  const openReference=createOfficeNavigation(roomFor(plan),{cacheQueries:false});
  const closedReference=createOfficeNavigation(roomFor(closedPlan),{cacheQueries:false});

  assert.equal(open.isSegmentWalkable(a,b),openReference.isSegmentWalkable(a,b));
  assert.equal(closed.isSegmentWalkable(a,b),closedReference.isSegmentWalkable(a,b));
  assert.equal(open.isSegmentWalkable(a,b),true,'the open interior door permits its crossing');
  assert.equal(closed.isSegmentWalkable(a,b),false,'the closed interior door blocks the same segment');
  assert.deepEqual(open.findLocalPath(a,b),openReference.findLocalPath(a,b));
  assert.deepEqual(closed.findLocalPath(a,b),closedReference.findLocalPath(a,b));
  assert.equal(closed.isWalkable({x:51.5,y:44},{ignoreIds:['sealed-area']}),false,
    'forbidden areas remain blockers even when their ids are requested for ignore');

  const changed=createOfficeNavigation(roomFor(closedPlan));
  const changedBefore=changed.getQueryCacheStats();
  assert.equal(changed.isSegmentWalkable(a,b),false);
  const changedAfter=changed.getQueryCacheStats();
  assert.equal(changedAfter.segmentWalkable.computations,changedBefore.segmentWalkable.computations+1,
    'a new world must compute its own answer rather than reuse another world cache');
});

test('cached paths are detached and captured geometry does not follow caller mutations',()=>{
  const room=officeRoom([object('desk-a','work-desk',66,43,.62)]);
  const navigation=createOfficeNavigation(room);
  const from={x:58,y:43},to={x:74,y:43};
  const expected=navigation.findLocalPath(from,to);
  const first=navigation.findLocalPath(from,to);
  first[0].x+=100;
  first.pop();
  assert.deepEqual(navigation.findLocalPath(from,to),expected,'mutating a returned path cannot alter the cached copy');

  const objectBlockers=[{id:'mutable-wall',objectId:'mutable-wall',kind:'wall',type:'wall',
    segment:[{x:56,y:40},{x:56,y:48}],radius:.5,center:{x:56,y:44},polygon:[]}];
  const withWall=createOfficeNavigation(officeRoom(),{objectBlockers});
  assert.equal(withWall.isWalkable({x:56,y:44}),false);
  objectBlockers[0].segment[0].x=80;
  objectBlockers[0].segment[1].x=80;
  withWall.blockers.find(blocker=>blocker.id==='mutable-wall').segment[0].x=90;
  assert.equal(withWall.isWalkable({x:80,y:44}),true,'the captured collision segment is private after construction');
  assert.equal(withWall.isWalkable({x:56,y:44}),false,'returned blocker edits cannot change collision geometry');
});

test('point, segment and path memo tables stay bounded and evict old entries',()=>{
  const navigation=createOfficeNavigation(officeRoom());
  const pointLimit=navigation.getQueryCacheStats().isWalkable.maxEntries;
  const firstPoint={x:1000,y:-1000};
  for(let index=0;index<=pointLimit;index++)navigation.isWalkable({x:1000+index,y:-1000-index});
  let stats=navigation.getQueryCacheStats();
  assert.equal(stats.isWalkable.entries,pointLimit);
  const pointComputations=stats.isWalkable.computations;
  navigation.isWalkable(firstPoint);
  assert.equal(navigation.getQueryCacheStats().isWalkable.computations,pointComputations+1,
    'the least-recently-used point entry is evicted at capacity');

  const segmentLimit=navigation.getQueryCacheStats().segmentWalkable.maxEntries;
  const firstSegment=[{x:2000,y:-2000},{x:2001,y:-1999}];
  for(let index=0;index<=segmentLimit;index++)navigation.isSegmentWalkable(
    {x:2000+index,y:-2000},{x:2001+index,y:-1999});
  stats=navigation.getQueryCacheStats();
  assert.equal(stats.segmentWalkable.entries,segmentLimit);
  const segmentComputations=stats.segmentWalkable.computations;
  navigation.isSegmentWalkable(...firstSegment);
  assert.equal(navigation.getQueryCacheStats().segmentWalkable.computations,segmentComputations+1,
    'the least-recently-used directed segment entry is evicted at capacity');

  const pathLimit=navigation.getQueryCacheStats().findLocalPath.maxEntries;
  const firstPath=[{x:3000,y:-3000},{x:3001,y:-2999}];
  for(let index=0;index<=pathLimit;index++)navigation.findLocalPath(
    {x:3000+index,y:-3000},{x:3001+index,y:-2999});
  stats=navigation.getQueryCacheStats();
  assert.equal(stats.findLocalPath.entries,pathLimit);
  const pathComputations=stats.findLocalPath.computations;
  navigation.findLocalPath(...firstPath);
  assert.equal(navigation.getQueryCacheStats().findLocalPath.computations,pathComputations+1,
    'the least-recently-used local path entry is evicted at capacity');
});
