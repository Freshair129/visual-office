import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {tycoonGround,tycoonWorld} from '../web/tycoon-blueprint.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {measureSeatContact} from '../web/tycoon-seat-contact.js';
import * as seatFit from '../web/tycoon-seat-fit.js';
import {createTycoonRoom} from '../web/tycoon-state.js';

async function measuredDefaultLargeChairFit(){
  const room=createTycoonRoom('projects'),chairData=room.objects.find(object=>object.id==='chair-1'),deskData=room.objects.find(object=>object.id==='desk-1');
  chairData.scale=1.25;
  const paths=['web/assets/models/tycoon-factory/actor-rig-v3.glb','web/assets/models/tycoon-factory/desk-v3.glb','web/assets/models/tycoon/chair.glb'];
  const models=await Promise.all(paths.map(async(path,index)=>{
    const bytes=await readFile(path),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const model=gltf.scene,data=index===0?null:index===1?deskData:chairData;
    model.userData.instanceId=data?.id||'demo-agent';
    if(data){model.position.set(data.x,data.y,data.z);model.rotation.y=data.rotation;model.scale.setScalar(data.scale);}
    return model;
  }));
  const [actor,desk,chair]=models,world=new TycoonCollisionWorld([chair,desk]),probe=new ProbeContact(actor,world),activity=new TycoonActivity(room);
  const station=activity.nav.stations.find(item=>item.objectId==='desk-1');
  assert.ok(station?.seat&&station?.footAnchor,'the default large-chair desk station has measured anchors');
  const point=tycoonWorld(station.seat),front=tycoonWorld(station.footAnchor).sub(point).setY(0).normalize(),seat=measureSeatContact(chair,point,station.seatHeight);
  assert.ok(seat.ok,'the actual GLB chair top is measurable');
  const options={point,root:tycoonWorld(station.seatRoot||station.seat),heading:station.heading,seatHeight:seat.height,
    seatExtent:world.topSurfaceExtent(station.seatObjectId,point,front),chairExtent:world.projectionExtent(station.seatObjectId,point,front),
    shoeRear:probe.shoeRearExtent(station.heading,front),front,clearanceM:.005,stepM:.005,maxDistance:.78};
  assert.ok(options.seatExtent>0&&options.chairExtent>0&&options.shoeRear>0,'fit dimensions come from the actual GLBs');
  return {probe,world,options,activity,chair};
}

async function fitWithRootTrials(input,search){
  const {probe,options,activity,chair}=input;let fit=await search(options),fittedRoot=options.root.clone(),additionalRootAdvanceM=0;
  const rootTrials=[];
  if(!fit.selected&&probe.pelvisSupportOffset){
    const offset=probe.pelvisSupportOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0),options.heading);
    for(const advance of [.02,.04,.06,.08,.10]){
      const candidate=options.root.clone().addScaledVector(options.front,advance),supportPoint=candidate.clone().add(offset);
      const support=measureSeatContact(chair,supportPoint,options.seatHeight),corridor=activity.nav.isSegmentWalkable(
        tycoonGround(options.root),tycoonGround(candidate),{ignoreIds:['chair-1','desk-1']});
      const trial={advanceM:advance,seatSupport:support,corridor,footFit:false};rootTrials.push(trial);
      if(!support.ok||Math.abs(support.height-options.seatHeight)>.003||!corridor)continue;
      const alternative=await search({...options,root:candidate});trial.footFit=!!alternative.selected;
      if(alternative.selected){fit=alternative;fittedRoot=candidate;additionalRootAdvanceM=advance;break;}
    }
  }
  return {fit,fittedRoot,additionalRootAdvanceM,rootTrials};
}

test('seat-fit step API exposes the named iterator and cooperative runner',()=>{
  assert.equal(typeof seatFit.createSeatFitSteps,'function','createSeatFitSteps is exported');
  assert.equal(typeof seatFit.runSeatFitSteps,'function','runSeatFitSteps is exported');
});

test('seat-fit iterator yields before mutating the first candidate',()=>{
  assert.equal(typeof seatFit.createSeatFitSteps,'function','createSeatFitSteps is exported');
  let reachCalls=0,geometryCalls=0;
  const probe={restPelvis:1,legs:[{a:.5,b:.5,x:0,ankleY:0,hipOffset:new THREE.Vector3(),ankleRest:new THREE.Quaternion(),
    shoe:{a:new THREE.Vector3(),b:new THREE.Vector3(.1,0,0),radius:.1}}],
  footReachAtAnchor:()=>{reachCalls++;return {ok:true,legs:[{ok:true,requiredM:.5}]}},
  shoeCapsulesAtAnchor:anchor=>[{name:'left-shoe',side:'left',start:anchor.clone(),end:anchor.clone(),radius:.1}]};
  const world={inspectCapsules(){geometryCalls++;return {ok:true,minClearanceM:.01,hit:null};}};
  const options={point:new THREE.Vector3(),root:new THREE.Vector3(.2,.5,.3),heading:0,seatHeight:.5,
    seatExtent:.01,chairExtent:.2,shoeRear:.1,front:new THREE.Vector3(1,0,0),clearanceM:.005,stepM:.005,maxDistance:.015};
  const iterator=seatFit.createSeatFitSteps(probe,world)(options),first=iterator.next();
  assert.deepEqual(first,{value:undefined,done:false},'the iterator suspends before the first candidate check');
  assert.equal(reachCalls,0);assert.equal(geometryCalls,0,'no reach or geometry work precedes the first yield');
  const completed=iterator.next();
  assert.equal(completed.done,true);assert.equal(completed.value.selected.tests,1);
  assert.equal(reachCalls,2);assert.equal(geometryCalls,1);
  assert.equal(completed.value.geometryQueries,1);assert.equal(completed.value.sessionGeometryQueries,1);
});

test('seat-fit runner yields at its budget and cancellation never resumes the iterator',async()=>{
  assert.equal(typeof seatFit.runSeatFitSteps,'function','runSeatFitSteps is exported');
  let clock=0,nextCalls=0,yields=0;
  const iterator={next(){nextCalls++;return nextCalls===25?{done:true,value:'complete'}:{done:false,value:nextCalls};}};
  const result=await seatFit.runSeatFitSteps(iterator,{budgetMs:2,now:()=>clock++,yieldTurn:async()=>{yields++;}});
  assert.equal(result,'complete');assert.equal(nextCalls,25);assert.equal(yields,1,'two groups of eight calls consume the fake time budget');

  let active=true,cancelClock=0,cancelNextCalls=0,cancelYields=0;
  const cancelledIterator={next(){cancelNextCalls++;return {done:false,value:cancelNextCalls};}};
  await assert.rejects(seatFit.runSeatFitSteps(cancelledIterator,{budgetMs:2,now:()=>cancelClock++,
    yieldTurn:async()=>{cancelYields++;active=false;},isCurrent:()=>active}),error=>error.name==='AbortError');
  assert.equal(cancelYields,1,'the cancellation occurs during the scheduled yield');
  assert.equal(cancelNextCalls,16,'no iterator next call runs after cancellation is observed');

  let preCancelledNextCalls=0;
  await assert.rejects(seatFit.runSeatFitSteps({next(){preCancelledNextCalls++;return {done:false};}},
    {isCurrent:()=>false}),error=>error.name==='AbortError');
  assert.equal(preCancelledNextCalls,0,'a stale request is rejected before the first iterator mutation');
});

test('stepped real GLB seat fit matches synchronous query counts and root-trial records',async t=>{
  for(const name of ['createSeatFitSearch','createSeatFitSteps','runSeatFitSteps'])assert.equal(typeof seatFit[name],'function',`${name} is exported`);
  const syncInput=await measuredDefaultLargeChairFit(),stepInput=await measuredDefaultLargeChairFit();
  const syncSearch=seatFit.createSeatFitSearch(syncInput.probe,syncInput.world),sync=await fitWithRootTrials(syncInput,syncSearch);
  const stepSearch=seatFit.createSeatFitSteps(stepInput.probe,stepInput.world);let clock=0,yieldCount=0;
  const runStep=options=>seatFit.runSeatFitSteps(stepSearch(options),{budgetMs:2,now:()=>clock++,
    yieldTurn:async()=>{yieldCount++;},isCurrent:()=>true});
  const stepped=await fitWithRootTrials(stepInput,runStep);
  t.diagnostic(JSON.stringify({scale:1.25,rootTrials:sync.rootTrials.length,additionalRootAdvanceM:sync.additionalRootAdvanceM,
    candidates:sync.fit.selected?.tests,geometryQueries:sync.fit.sessionGeometryQueries,geometryPruned:sync.fit.sessionGeometryPruned,yieldCount}));
  assert.ok(sync.fit.selected&&stepped.fit.selected,'both sync and stepped actual GLB searches find the same reachable target');
  assert.equal(JSON.stringify(stepped.fit),JSON.stringify(sync.fit),'selected fit, exact diagnostics, and cumulative query/prune counters match');
  assert.equal(stepped.additionalRootAdvanceM,sync.additionalRootAdvanceM,'root advance selection is unchanged');
  assert.deepEqual(stepped.fittedRoot.toArray(),sync.fittedRoot.toArray(),'fitted root coordinates are unchanged');
  assert.equal(JSON.stringify(stepped.rootTrials),JSON.stringify(sync.rootTrials),'ordered root-trial records are unchanged');
  assert.ok(yieldCount>0,'the real candidate iterator returned control to the scheduler');
});
