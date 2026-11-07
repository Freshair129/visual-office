import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {measureSeatContact} from '../web/tycoon-seat-contact.js';
import {createSeatFitSearch,fitSeatFeet} from '../web/tycoon-seat-fit.js';
import {tycoonGround,tycoonWorld} from '../web/tycoon-blueprint.js';
import {createTycoonRoom} from '../web/tycoon-state.js';

async function setup(){
  const room=createTycoonRoom('projects');
  const models=await Promise.all(['actor-rig-v3','desk-v3','chair'].map(async(kind,index)=>{
    const bytes=await readFile(index<2?`web/assets/models/tycoon-factory/${kind}.glb`:'web/assets/models/tycoon/chair.glb');
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const model=gltf.scene,object=index===0?null:room.objects.find(o=>o.id===(index===1?'desk-1':'chair-1'));
    model.userData.instanceId=index===0?'demo-agent':object.id;
    if(object){model.position.set(object.x,object.y,object.z);model.rotation.y=object.rotation;model.scale.setScalar(object.scale);}
    return model;
  }));
  const scene={ready:true,activity:new TycoonActivity(room),assembly:{owned:models},collisionWorld:new TycoonCollisionWorld(models)};
  const inspect=scene.collisionWorld.inspectCapsules.bind(scene.collisionWorld),keys=new Set();let calls=0,duplicates=0;
  scene.collisionWorld.inspectCapsules=(capsules,options)=>{
    calls++;const key=JSON.stringify([options,capsules.map(c=>[c.name,...c.start.toArray(),...c.end.toArray(),c.radius])]);
    if(keys.has(key))duplicates++;keys.add(key);return inspect(capsules,options);
  };
  return {scene,counts:()=>({calls,duplicates})};
}

test('seat fitting never repeats an identical static-world shoe query within one search',async()=>{
  const {scene,counts}=await setup();
  assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);
  assert.ok(counts().calls>0,'real geometry queries performed');
  assert.equal(counts().duplicates,0,'entry-flex candidates reuse identical shoe geometry results');
  const station=scene.activity.station;
  assert.equal(station.footPlacementDiagnostic.ok,true);
  assert.ok(station.footPlacementDiagnostic.seatedReach.ok);
  assert.ok(station.footPlacementDiagnostic.standingReach.ok);
});

test('restarting an unchanged station reuses measured fit while a new world is checked again',async()=>{
  const {scene,counts}=await setup();
  assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);
  const firstCalls=counts().calls,firstAnchor={...scene.activity.station.footAnchor};
  scene.activity.stop();
  assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);
  assert.equal(counts().calls,firstCalls,'unchanged collision snapshot and rig have no repeated fit search');
  assert.deepEqual(scene.activity.station.footAnchor,firstAnchor);
  const actor=scene.assembly.owned[0],newWorld=new TycoonCollisionWorld(scene.assembly.owned);let newQueries=0;
  const inspect=newWorld.inspectCapsules.bind(newWorld);newWorld.inspectCapsules=(...args)=>{newQueries++;return inspect(...args);};
  scene.collisionWorld=newWorld;actor.userData.contact.bindCollisionWorld(newWorld);scene.activity.stop();
  assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);
  assert.ok(newQueries>0,'changed world cannot reuse an earlier geometry proof');
});

test('certified negative-candidate pruning preserves the first admitted target and has a reference mode',()=>{
  const probe={restPelvis:1,legs:[{a:.5,b:.5,x:0,ankleY:0,hipOffset:new THREE.Vector3(),ankleRest:new THREE.Quaternion(),
    shoe:{a:new THREE.Vector3(),b:new THREE.Vector3(.1,0,0),radius:.1}}],
  footReachAtAnchor:()=>({ok:true,legs:[{ok:true,requiredM:.5}]}),
  shoeCapsulesAtAnchor:anchor=>[{name:'left-shoe',side:'left',start:anchor.clone(),end:anchor.clone(),radius:.1}]};
  let calls=0;
  const world={inspectCapsules(capsules){
    calls++;const distance=capsules[0].start.x,clearance=-.02+(distance-.015),ok=clearance>=-.001;
    return {ok,minClearanceM:clearance,hit:ok?null:{objectId:'fixed-chair-triangle',mesh:'chair',limb:'left-shoe',clearanceM:clearance}};
  }};
  const options={point:new THREE.Vector3(),root:new THREE.Vector3(.2,.5,.3),heading:0,seatHeight:.5,
    seatExtent:.01,chairExtent:.2,shoeRear:.1,front:new THREE.Vector3(1,0,0),clearanceM:.005,stepM:.005,maxDistance:.04};
  const savedRoot=options.root.clone();
  const optimized=fitSeatFeet(probe,world,{...options,useCollisionBounds:true}),optimizedCalls=calls;
  const reference=fitSeatFeet(probe,world,{...options,useCollisionBounds:false}),referenceCalls=calls-optimizedCalls;

  assert.ok(optimized.selected&&reference.selected,'both modes find a reachable, collision-free candidate');
  assert.equal(optimized.selected.distance,.04,'candidate enumeration retains the first full-clearance target');
  assert.equal(optimized.selected.distance,reference.selected.distance);
  assert.deepEqual(optimized.selected.anchor.toArray(),reference.selected.anchor.toArray());
  assert.equal(optimized.selected.entryFlexM,reference.selected.entryFlexM);
  assert.equal(optimized.selected.footWidthScale,reference.selected.footWidthScale);
  assert.equal(optimized.selected.footToeOutRad,reference.selected.footToeOutRad);
  assert.equal(optimized.selected.clearance,reference.selected.clearance);
  assert.equal(optimized.selected.tests,reference.selected.tests,'provably blocked anchors still retain candidate ordering/count');
  assert.equal(JSON.stringify(optimized.selected),JSON.stringify(reference.selected),'the first admitted target serializes identically');
  assert.equal(optimized.reachQueries,reference.reachQueries,'reach tests stay complete at every candidate anchor');
  assert.equal(optimizedCalls,3,'query the first anchor beyond the certified collision range and the chosen anchor exactly');
  assert.ok(optimizedCalls<referenceCalls,`certified skips reduce exact geometry calls (${optimizedCalls} vs ${referenceCalls})`);
  assert.deepEqual(options.root.toArray(),savedRoot.toArray(),'the fitter leaves the supplied chair root unchanged');
  assert.equal(reference.cacheHit,false,'the no-pruning reference has a distinct cache key');
  assert.equal(fitSeatFeet(probe,world,{...options,useCollisionBounds:true}).cacheHit,true);
  assert.equal(fitSeatFeet(probe,world,options).cacheHit,true,'omitting the option keeps the production default optimized');
  assert.equal(fitSeatFeet(probe,world,{...options,useCollisionBounds:false}).cacheHit,true);
});

test('warm fit-cache hits report zero repeated pruning and preserve cumulative search work',()=>{
  const probe={restPelvis:1,legs:[{a:.5,b:.5,x:0,ankleY:0,hipOffset:new THREE.Vector3(),ankleRest:new THREE.Quaternion(),
    shoe:{a:new THREE.Vector3(),b:new THREE.Vector3(.1,0,0),radius:.1}}],
  footReachAtAnchor:()=>({ok:true,legs:[{ok:true,requiredM:.5}]}),
  shoeCapsulesAtAnchor:anchor=>[{name:'left-shoe',side:'left',start:anchor.clone(),end:anchor.clone(),radius:.1}]};
  let calls=0;
  const world={inspectCapsules(capsules){
    calls++;const distance=capsules[0].start.x,clearance=-.02+(distance-.015),ok=clearance>=-.001;
    return {ok,minClearanceM:clearance,hit:ok?null:{objectId:'fixed-chair-triangle',mesh:'chair',limb:'left-shoe',clearanceM:clearance}};
  }};
  const options={point:new THREE.Vector3(),root:new THREE.Vector3(.2,.5,.3),heading:0,seatHeight:.5,
    seatExtent:.01,chairExtent:.2,shoeRear:.1,front:new THREE.Vector3(1,0,0),clearanceM:.005,stepM:.005,maxDistance:.04};
  const search=createSeatFitSearch(probe,world),cold=search({...options,useCollisionBounds:true}),coldCalls=calls;
  assert.ok(cold.selected,'cold fit selects a target');
  assert.ok(cold.geometryPruned>0,'the cold result carries real certified pruning work');
  assert.equal(cold.sessionGeometryPruned,cold.geometryPruned);

  const warm=search({...options,useCollisionBounds:true});
  assert.equal(warm.cacheHit,true);
  assert.equal(warm.geometryQueries,0);
  assert.equal(warm.geometryPruned,0,'a cache hit performs no new pruning work');
  assert.equal(warm.reachQueries,0);
  assert.equal(warm.sessionGeometryQueries,cold.sessionGeometryQueries);
  assert.equal(warm.sessionGeometryPruned,cold.sessionGeometryPruned,
    'cumulative pruning work is unchanged on the warm hit');
  assert.equal(calls,coldCalls,'no capsule queries are repeated');
});

const externalCatalog=JSON.parse(await readFile('tests/fixtures/external-chairs/fixtures.json','utf8'));
const parityCases=[
  {name:'bundled default',scale:1},
  {name:'bundled scale 0.75',scale:.75},
  {name:'bundled scale 1.25',scale:1.25},
  ...externalCatalog.fixtures.map(fixture=>({name:fixture.id,scale:1.1,fixture})),
];

async function measuredFitCase({scale,fixture}){
  const room=createTycoonRoom('projects'),chairData=room.objects.find(object=>object.id==='chair-1'),deskData=room.objects.find(object=>object.id==='desk-1');
  chairData.scale=scale;
  let chairPath='web/assets/models/tycoon/chair.glb';
  if(fixture){
    const heading=chairData.rotation+Math.PI;
    chairData.kind='custom';
    chairData.asset={id:fixture.provenance.glb.sha256,name:fixture.name,category:'chair',size:fixture.measured.gltfSize,
      sourceSize:fixture.measured.gltfSize,origin:[0,0,0],interaction:structuredClone(fixture.interaction)};
    chairData.rotation=heading-fixture.interaction.heading;
    chairPath=`tests/fixtures/external-chairs/${fixture.file}`;
  }
  const paths=['web/assets/models/tycoon-factory/actor-rig-v3.glb','web/assets/models/tycoon-factory/desk-v3.glb',chairPath];
  const models=await Promise.all(paths.map(async(path,index)=>{
    const bytes=await readFile(path),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const model=gltf.scene,data=index===0?null:index===1?deskData:chairData;
    model.userData.instanceId=data?.id||'demo-agent';
    if(data){model.position.set(data.x,data.y,data.z);model.rotation.y=data.rotation;model.scale.setScalar(data.scale);}
    return model;
  }));
  const [actor,desk,chair]=models,world=new TycoonCollisionWorld([chair,desk]),probe=new ProbeContact(actor,world),activity=new TycoonActivity(room);
  const station=activity.nav.stations.find(item=>item.objectId==='desk-1');
  assert.ok(station?.seat&&station?.footAnchor,`actual ${fixture?.id||'bundled'} chair station is available`);
  const point=tycoonWorld(station.seat),front=tycoonWorld(station.footAnchor).sub(point).setY(0).normalize();
  const seatContact=measureSeatContact(chair,point,station.seatHeight);
  assert.ok(seatContact.ok,`actual ${fixture?.id||'bundled'} seat surface is measurable`);
  const options={point,root:tycoonWorld(station.seatRoot||station.seat),heading:station.heading,seatHeight:seatContact.height,
    seatExtent:world.topSurfaceExtent(station.seatObjectId,point,front),chairExtent:world.projectionExtent(station.seatObjectId,point,front),
    shoeRear:probe.shoeRearExtent(station.heading,front),front,clearanceM:.005,stepM:.005,maxDistance:.78};
  assert.ok(options.seatExtent>0&&options.chairExtent>0&&options.shoeRear>0,`actual ${fixture?.id||'bundled'} fit extents are measured`);
  return {probe,world,options,activity,chair};
}

function runFitWithRootTrials({probe,world,options,activity,chair},useCollisionBounds){
  const search=createSeatFitSearch(probe,world),fitOptions={...options,useCollisionBounds};
  let fit=search(fitOptions),fittedRoot=options.root.clone(),additionalRootAdvanceM=0;
  const rootTrials=[];
  if(!fit.selected&&probe.pelvisSupportOffset){
    const offset=probe.pelvisSupportOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0),options.heading);
    for(const advance of [.02,.04,.06,.08,.10]){
      const candidate=options.root.clone().addScaledVector(options.front,advance),supportPoint=candidate.clone().add(offset);
      const support=measureSeatContact(chair,supportPoint,options.seatHeight);
      const corridor=activity.nav.isSegmentWalkable(tycoonGround(options.root),tycoonGround(candidate),
        {ignoreIds:['chair-1','desk-1']});
      const trial={advanceM:advance,seatSupport:support,corridor,footFit:false};rootTrials.push(trial);
      if(!support.ok||Math.abs(support.height-options.seatHeight)>.003||!corridor)continue;
      const alternative=search({...fitOptions,root:candidate});trial.footFit=!!alternative.selected;
      if(alternative.selected){fit=alternative;fittedRoot=candidate;additionalRootAdvanceM=advance;break;}
    }
  }
  return {fit,fittedRoot,additionalRootAdvanceM,rootTrials};
}

for(const spec of parityCases)test(`actual ${spec.name} GLB keeps selected seat fit identical with certified pruning`,async()=>{
  const input=await measuredFitCase(spec),{probe,world,options}=input,root=options.root.clone();let geometryCalls=0;
  const inspect=world.inspectCapsules.bind(world);world.inspectCapsules=(...args)=>{geometryCalls++;return inspect(...args);};
  const optimizedResult=runFitWithRootTrials(input,true),optimized=optimizedResult.fit,optimizedCalls=geometryCalls;
  const referenceResult=runFitWithRootTrials(input,false),reference=referenceResult.fit,referenceCalls=geometryCalls-optimizedCalls;
  assert.ok(optimized.selected&&reference.selected,`${spec.name}: both search modes admit a target`);
  assert.equal(reference.cacheHit,false,`${spec.name}: reference search is not returned from the optimized fit cache`);
  assert.deepEqual({distance:optimized.selected.distance,entryFlexM:optimized.selected.entryFlexM,
    footWidthScale:optimized.selected.footWidthScale,footToeOutRad:optimized.selected.footToeOutRad,
    clearance:optimized.selected.clearance,tests:optimized.selected.tests,anchor:optimized.selected.anchor.toArray()},
  {distance:reference.selected.distance,entryFlexM:reference.selected.entryFlexM,
    footWidthScale:reference.selected.footWidthScale,footToeOutRad:reference.selected.footToeOutRad,
    clearance:reference.selected.clearance,tests:reference.selected.tests,anchor:reference.selected.anchor.toArray()},
  `${spec.name}: first admitted parameters and exact foot anchor`);
  assert.deepEqual(options.root.toArray(),root.toArray(),`${spec.name}: both searches preserve the selected chair root`);
  assert.equal(optimizedResult.additionalRootAdvanceM,referenceResult.additionalRootAdvanceM,
    `${spec.name}: root-trial selection remains unchanged`);
  assert.deepEqual(optimizedResult.fittedRoot.toArray(),referenceResult.fittedRoot.toArray(),
    `${spec.name}: fitted chair roots remain identical`);
  assert.equal(JSON.stringify(optimizedResult.rootTrials),JSON.stringify(referenceResult.rootTrials),
    `${spec.name}: every root-trial record remains byte-for-byte identical`);
  assert.equal(JSON.stringify(optimized.selected),JSON.stringify(reference.selected),
    `${spec.name}: the first admitted target remains byte-for-byte identical`);
  assert.ok(optimizedCalls<=referenceCalls,`${spec.name}: certified pruning does not add geometry queries (${optimizedCalls} vs ${referenceCalls})`);
});
