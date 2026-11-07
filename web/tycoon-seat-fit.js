// Measured static-world seat/foot fitting. Pose collision sweeps still run every frame.
// @tested tests/tycoon-seat-fit-cache.test.mjs, tests/tycoon-seat-fit-keys.test.mjs
import * as THREE from 'three';

const fitsByProbe=new WeakMap();
const directionsByStation=new WeakMap();
const COPY_LIMIT=32;
const ENTRY_FLEXES=[0,.01,.02,.03,.04];
const FOOT_TOE_OUTS=[0,Math.PI/18,-Math.PI/18,Math.PI/9,-Math.PI/9,Math.PI/6,-Math.PI/6];
const FOOT_WIDTH_SCALES=[1,.9,.8,1.1,1.2];
const anchorKey=station=>JSON.stringify([station.seat,station.seatRoot,station.footAnchor]);
export function measuredSeatDirection(station,world,direction){
  const prior=directionsByStation.get(station);
  return prior?.world===world&&prior.key===anchorKey(station)?prior.direction.clone():direction;
}
export function measuredSeatRoot(station,world,root){
  const prior=directionsByStation.get(station);
  return prior?.world===world&&prior.key===anchorKey(station)&&prior.root?prior.root.clone():root;
}
export function rememberSeatDirection(station,world,direction,root){
  // Retain the measured direction across a world→editor→world anchor round trip.
  // Edited anchors or a different world invalidate it without rounding geometry.
  directionsByStation.set(station,{world,key:anchorKey(station),direction:direction.clone(),root:root?.clone()});
}
function copyFit(value){
  const copy=structuredClone(value);
  if(copy.selected)copy.selected.anchor=new THREE.Vector3().copy(copy.selected.anchor);
  return copy;
}
function fitCache(probe,world){
  let worlds=fitsByProbe.get(probe);if(!worlds){worlds=new WeakMap();fitsByProbe.set(probe,worlds);}
  let cache=worlds.get(world);if(!cache){cache=new Map();worlds.set(world,cache);}return cache;
}

export function fitSeatFeet(probe,world,options){return drainSeatFitSteps(searchSeatFeetSteps(probe,world,options,new Map()));}
export function createSeatFitSearch(probe,world){
  const search=createSeatFitSteps(probe,world);
  return options=>drainSeatFitSteps(search(options));
}
export function createSeatFitSteps(probe,world){
  const shoesByPrefix=new Map(),session={geometryQueries:0,geometryPruned:0};
  return options=>(function*(){
    const result=yield* searchSeatFeetSteps(probe,world,options,shoesByPrefix,session);
    return {...result,sessionGeometryQueries:session.geometryQueries,sessionGeometryPruned:session.geometryPruned};
  })();
}
function drainSeatFitSteps(iterator){let step;do{step=iterator.next();}while(!step.done);return step.value;}
function abortSeatFitSteps(){const error=new Error('Seat fit search was cancelled');error.name='AbortError';return error;}
export async function runSeatFitSteps(iterator,{budgetMs=2,now=()=>performance.now(),yieldTurn=()=>new Promise(resolve=>setTimeout(resolve,0)),isCurrent=()=>true}={}){
  let sliceStart=now();
  while(true){
    if(!isCurrent())throw abortSeatFitSteps();
    for(let count=0;count<8;count++){
      const step=iterator.next();if(step.done)return step.value;
    }
    if(now()-sliceStart>=budgetMs){
      await yieldTurn();if(!isCurrent())throw abortSeatFitSteps();sliceStart=now();
    }
  }
}
function* searchSeatFeetSteps(probe,world,options,shoeChecksByPrefix,session=null){
  const {point,root,heading,seatHeight,seatExtent,chairExtent,shoeRear,front,clearanceM=.005,stepM=.005,maxDistance=.78}=options;
  const useCollisionBounds=options.useCollisionBounds!==false;
  const cache=fitCache(probe,world),key=JSON.stringify([
    point.toArray(),root.toArray(),heading,seatHeight,seatExtent,chairExtent,shoeRear,front.toArray(),clearanceM,stepM,maxDistance,useCollisionBounds,
    probe.restPelvis,probe.legs.map(l=>[l.a,l.b,l.x,l.ankleY,l.hipOffset.toArray(),l.ankleRest.toArray(),l.shoe?.a.toArray(),l.shoe?.b.toArray(),l.shoe?.radius]),
  ]);
  if(cache.has(key)){
    const value=cache.get(key);cache.delete(key);cache.set(key,value);
    return {...copyFit(value),cacheHit:true,geometryQueries:0,geometryPruned:0,reachQueries:0};
  }
  const firstDistance=seatExtent+clearanceM,seatedChecks=new Map(),standingChecks=new Map();
  const shoePrefix=JSON.stringify([point.toArray(),front.toArray(),heading,firstDistance,stepM,useCollisionBounds,probe.legs.map(l=>[l.x,l.ankleY,l.ankleRest.toArray(),l.shoe?.a.toArray(),l.shoe?.b.toArray(),l.shoe?.radius])]);
  let shoeChecks=shoeChecksByPrefix.get(shoePrefix);
  if(!shoeChecks){shoeChecks=new Map();shoeChecksByPrefix.set(shoePrefix,shoeChecks);}
  const collisionRangesByShape=new Map(),witnessIndexesByShape=new Map(),prunedShoeChecks=new Map();
  const maxIndex=Math.floor((maxDistance-firstDistance)/stepM);
  const translationPerDistance=Math.hypot(front.x,front.z);
  let selected=null,candidates=0,lastCandidate=null,lastReachableCandidate=null,geometryQueries=0,geometryPruned=0,reachQueries=0;
  const rememberCollisionWitness=(shapeKey,index,clearance)=>{
    const hitClearanceM=clearance.hit?.clearanceM;
    if(clearance.ok!==false||!Number.isFinite(hitClearanceM)||hitClearanceM>=-.001)return;
    let known=witnessIndexesByShape.get(shapeKey);
    if(!known){known=new Set();witnessIndexesByShape.set(shapeKey,known);}
    if(known.has(index))return;
    known.add(index);
    let radius=0;
    for(let offset=1;offset<=maxIndex;offset++){
      if(!(hitClearanceM+offset*stepM*translationPerDistance<-.001-1e-9))break;
      radius=offset;
    }
    const range={start:Math.max(0,index-radius),end:Math.min(maxIndex,index+radius),index,
      clearanceM:hitClearanceM,hit:clearance.hit};
    let ranges=collisionRangesByShape.get(shapeKey);
    if(!ranges){ranges=[];collisionRangesByShape.set(shapeKey,ranges);}
    ranges.push(range);
  };
  const collisionCertificate=(shapeKey,index)=>{
    const range=collisionRangesByShape.get(shapeKey)?.find(candidate=>index>=candidate.start&&index<=candidate.end);
    if(!range)return null;
    const upperBoundM=range.clearanceM+Math.abs(index-range.index)*stepM*translationPerDistance;
    return upperBoundM<-.001-1e-9?{hit:range.hit,clearanceUpperBoundM:upperBoundM}:null;
  };
  for(let entryFlexIndex=0;entryFlexIndex<ENTRY_FLEXES.length;entryFlexIndex++){
    const entryFlexM=ENTRY_FLEXES[entryFlexIndex];
    for(let toeOutIndex=0;toeOutIndex<FOOT_TOE_OUTS.length;toeOutIndex++){
      const footToeOutRad=FOOT_TOE_OUTS[toeOutIndex];
      for(let widthIndex=0;widthIndex<FOOT_WIDTH_SCALES.length;widthIndex++){
        const footWidthScale=FOOT_WIDTH_SCALES[widthIndex];
        for(let i=0;i<=maxIndex;i++){
          yield;
          const distance=firstDistance+i*stepM,anchor=new THREE.Vector3(point.x+front.x*distance,0,point.z+front.z*distance);
          const seatedKey=`${footWidthScale}:${i}`,standingKey=`${entryFlexM}:${seatedKey}`;
          if(!seatedChecks.has(seatedKey)){seatedChecks.set(seatedKey,probe.footReachAtAnchor(anchor,root,heading,seatHeight,footWidthScale));reachQueries++;}
          if(!standingChecks.has(standingKey)){standingChecks.set(standingKey,probe.footReachAtAnchor(anchor,root,heading,probe.restPelvis-.08-entryFlexM,footWidthScale));reachQueries++;}
          const seatedReach=seatedChecks.get(seatedKey),standingReach=standingChecks.get(standingKey);
          if(!seatedReach.ok||!standingReach.ok){lastCandidate={distance,entryFlexM,footWidthScale,footToeOutRad,seatedReach,standingReach};if(standingReach.legs.every(leg=>!leg.ok))break;continue;}
          candidates++;
          // Flex changes hip reach, not these shoe capsules. Check each exact target once.
          const shapeKey=toeOutIndex*FOOT_WIDTH_SCALES.length+widthIndex;
          let exactByDistance=shoeChecks.get(shapeKey);
          if(!exactByDistance){exactByDistance=new Map();shoeChecks.set(shapeKey,exactByDistance);}
          const exactClearance=exactByDistance.get(i);
          let prunedByDistance=prunedShoeChecks.get(shapeKey);
          let certificate=prunedByDistance?.get(i);
          if(exactClearance&&useCollisionBounds)rememberCollisionWitness(shapeKey,i,exactClearance);
          if(!exactClearance&&!certificate&&useCollisionBounds){
            certificate=collisionCertificate(shapeKey,i);
            if(certificate){if(!prunedByDistance){prunedByDistance=new Map();prunedShoeChecks.set(shapeKey,prunedByDistance);}prunedByDistance.set(i,certificate);geometryPruned++;if(session)session.geometryPruned++;}
          }
          if(certificate&&!exactClearance){
            lastCandidate={distance,entryFlexM,footWidthScale,footToeOutRad,seatedReach,standingReach,
              collisionPruned:true,clearanceUpperBoundM:certificate.clearanceUpperBoundM,hit:certificate.hit};lastReachableCandidate=lastCandidate;continue;
          }
          if(!exactClearance){
            const clearance=world.inspectCapsules(probe.shoeCapsulesAtAnchor(anchor,heading,footWidthScale,footToeOutRad),{phase:'entering'});
            exactByDistance.set(i,clearance);geometryQueries++;if(session)session.geometryQueries++;
            if(useCollisionBounds)rememberCollisionWitness(shapeKey,i,clearance);
          }
          const clearance=exactClearance||exactByDistance.get(i),minimum=clearance.minClearanceM??Infinity;
          lastCandidate={distance,entryFlexM,footWidthScale,footToeOutRad,seatedReach,standingReach,clearance:minimum,hit:clearance.hit};lastReachableCandidate=lastCandidate;
          if(clearance.ok&&minimum>=clearanceM){selected={distance,anchor,entryFlexM,footWidthScale,footToeOutRad,seatedReach,standingReach,clearance:minimum===Infinity?null:minimum,tests:candidates};break;}
        }
        if(selected)break;
      }
      if(selected)break;
    }
    if(selected)break;
  }
  const result={selected,candidates,lastCandidate,lastReachableCandidate,geometryQueries,geometryPruned,reachQueries,cacheHit:false};
  if(selected){cache.set(key,copyFit(result));while(cache.size>COPY_LIMIT)cache.delete(cache.keys().next().value);}
  return result;
}
