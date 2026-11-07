import {drainPoseSteps} from './tycoon-pose-transaction.js';
// Transient world geometry for the local Tycoon probe's articulated lower body.
// @tested tests/tycoon-sweep-cache.test.mjs, tests/tycoon-collision-scratch.test.mjs, tests/tycoon-collision-witness.test.mjs
import * as THREE from 'three';

const EPSILON=1e-10;
const supportedPhases=new Set(['sit','working','standing']);
// A batch lives only for one pose-repair pass. Values never cross worlds or
// changed support options; exact endpoint/radius keys include every query input.
// Keep triangle references private: public diagnostics remain detached, while a full ordered sweep can seed one bounded repair batch.
const sweepBatches=new WeakMap(),capsuleBatches=new WeakMap(),orderedInspectionWitnesses=new WeakMap(),orderedSweepWitnesses=new WeakMap(),SWEEP_CACHE_LIMIT=4096,SWEEP_WITNESS_LIMIT=16;
const SWEEP_INTERPOLATION_SAMPLE_LIMIT=SWEEP_CACHE_LIMIT;
const supportKey=options=>JSON.stringify([options.phase||'unknown',options.seatObjectId,options.seatPoint?.x,options.seatPoint?.y,options.seatPoint?.z,options.seatHeight,options.seatSupportRadius??.28,!!options.allowSeatSupport]);
const capsuleKey=c=>JSON.stringify([c.name,c.side,c.start.x,c.start.y,c.start.z,c.end.x,c.end.y,c.end.z,c.radius]);
const witnessKey=(name,side)=>JSON.stringify([name||null,side||null]);

function isSweepSnapshotScalar(value){return value==null||typeof value==='string'||typeof value==='number'||typeof value==='boolean';}
function isCacheableSweepCapsule(c){return isSweepSnapshotScalar(c.name)&&isSweepSnapshotScalar(c.side)&&[c.start.x,c.start.y,c.start.z,c.end.x,c.end.y,c.end.z,c.radius].every(Number.isFinite);}
function snapshotSweepCapsule(c){return {name:c.name,side:c.side,startX:c.start.x,startY:c.start.y,startZ:c.start.z,endX:c.end.x,endY:c.end.y,endZ:c.end.z,radius:c.radius};}
function sameSweepSnapshot(snapshot,c){
 return !!snapshot&&!!c&&Object.is(snapshot.name,c.name)&&Object.is(snapshot.side,c.side)&&Object.is(snapshot.startX,c.start.x)&&Object.is(snapshot.startY,c.start.y)&&Object.is(snapshot.startZ,c.start.z)&&
  Object.is(snapshot.endX,c.end.x)&&Object.is(snapshot.endY,c.end.y)&&Object.is(snapshot.endZ,c.end.z)&&Object.is(snapshot.radius,c.radius);
}
function removeSweepInterpolationTrack(batch,key){
 const track=batch.interpolationTracks.get(key);if(!track)return;
 batch.interpolationTracks.delete(key);batch.interpolationSamples-=track.sampleCount;
}
function rememberSweepInterpolationTrack(batch,key,track){
 removeSweepInterpolationTrack(batch,key);batch.interpolationTracks.set(key,track);
 while(batch.interpolationTracks.size>SWEEP_CACHE_LIMIT){const oldest=batch.interpolationTracks.keys().next().value;removeSweepInterpolationTrack(batch,oldest);}
}
function getSweepInterpolationTrack(batch,key,from,to){
 if(!isCacheableSweepCapsule(from)||!isCacheableSweepCapsule(to)){removeSweepInterpolationTrack(batch,key);return null;}
 const cached=batch.interpolationTracks.get(key);
 if(cached&&sameSweepSnapshot(cached.from,from)&&sameSweepSnapshot(cached.to,to)){
  batch.interpolationTracks.delete(key);batch.interpolationTracks.set(key,cached);return cached;
 }
 return resetSweepInterpolationTrack(batch,key,from,to);
}
function resetSweepInterpolationTrack(batch,key,from,to){
 const track={from:snapshotSweepCapsule(from),to:snapshotSweepCapsule(to),samples:[],sampleSnapshots:[],keys:[],sampleCount:0};
 rememberSweepInterpolationTrack(batch,key,track);return track;
}
function cacheSweepInterpolationSample(batch,key,track,index,capsule){
 if(batch.interpolationTracks.get(key)!==track)return false;
 while(batch.interpolationSamples>=SWEEP_INTERPOLATION_SAMPLE_LIMIT){
  const oldest=[...batch.interpolationTracks.keys()].find(candidate=>candidate!==key);
  if(oldest===undefined)return false;
  removeSweepInterpolationTrack(batch,oldest);
 }
 track.samples[index]=capsule;track.sampleSnapshots[index]=snapshotSweepCapsule(capsule);track.keys[index]=capsuleKey(capsule);track.sampleCount++;batch.interpolationSamples++;return true;
}
function interpolateSweepCapsule(from,to,t){
 return {name:to.name,side:to.side,start:from.start.clone().lerp(to.start,t),end:from.end.clone().lerp(to.end,t),radius:Math.max(from.radius,to.radius)};
}

function rememberWitness(batch,witness){
 if(!witness)return;
 const key=witnessKey(witness.name,witness.side);batch.witnesses.delete(key);batch.witnesses.set(key,witness);
 if(batch.witnesses.size>SWEEP_WITNESS_LIMIT)batch.witnesses.delete(batch.witnesses.keys().next().value);
}

function snapshotWorklist(world,state,bounds){
 state.bounds=bounds instanceof THREE.Box3&&!bounds.isEmpty()?bounds.clone():null;
 state.meshes=world.meshes;
 state.setupBoundsTests=0;
 state.setupReported=false;
 if(!state.bounds)return;
 state.meshes=[];
 for(const mesh of world.meshes){state.setupBoundsTests++;if(state.bounds.intersectsBox(mesh.bounds))state.meshes.push(mesh);}
}

function closestSegmentSegment(p1,q1,p2,q2,scratch){
 const {u,v,w,segmentPoint,edgePoint,result}=scratch;u.copy(q1).sub(p1);v.copy(q2).sub(p2);w.copy(p1).sub(p2);const a=u.dot(u),b=u.dot(v),c=v.dot(v),d=u.dot(w),e=v.dot(w);
 if(a<EPSILON&&c<EPSILON){segmentPoint.copy(p1);edgePoint.copy(p2);result.segmentPoint=segmentPoint;result.edgePoint=edgePoint;result.distanceSq=p1.distanceToSquared(p2);return result;}
 if(a<EPSILON){edgePoint.copy(p2).addScaledVector(v,THREE.MathUtils.clamp(e/c,0,1));segmentPoint.copy(p1);result.segmentPoint=segmentPoint;result.edgePoint=edgePoint;result.distanceSq=p1.distanceToSquared(edgePoint);return result;}
 if(c<EPSILON){segmentPoint.copy(p1).addScaledVector(u,THREE.MathUtils.clamp(-d/a,0,1));edgePoint.copy(p2);result.segmentPoint=segmentPoint;result.edgePoint=edgePoint;result.distanceSq=p2.distanceToSquared(segmentPoint);return result;}
 const denominator=a*c-b*b;let sn,sd=denominator,tn,td=denominator;
 if(denominator<EPSILON){sn=0;sd=1;tn=e;td=c;}else{sn=b*e-c*d;tn=a*e-b*d;if(sn<0){sn=0;tn=e;td=c;}else if(sn>sd){sn=sd;tn=e+b;td=c;}}
 if(tn<0){tn=0;if(-d<0)sn=0;else if(-d>a)sn=sd;else{sn=-d;sd=a;}}
 else if(tn>td){tn=td;if(-d+b<0)sn=0;else if(-d+b>a)sn=sd;else{sn=-d+b;sd=a;}}
 const s=Math.abs(sn)<EPSILON?0:sn/sd,t=Math.abs(tn)<EPSILON?0:tn/td;
 segmentPoint.copy(p1).addScaledVector(u,s);edgePoint.copy(p2).addScaledVector(v,t);
 result.segmentPoint=segmentPoint;result.edgePoint=edgePoint;result.distanceSq=segmentPoint.distanceToSquared(edgePoint);return result;
}

function closestSegmentTriangle(start,end,triangle,scratch){
 const {delta,ray,rayHit,startTrianglePoint,endTrianglePoint,closestSegmentPoint,closestTrianglePoint,result,edge}=scratch;
 delta.copy(end).sub(start);const length=delta.length();
 if(length>EPSILON){
  ray.origin.copy(start);ray.direction.copy(delta).multiplyScalar(1/length);
  const hit=ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,rayHit);
  if(hit&&hit.distanceToSquared(start)<=length*length+EPSILON){result.segmentPoint.copy(hit);result.trianglePoint.copy(hit);result.distanceSq=0;return result;}
 }
 triangle.shape.closestPointToPoint(start,startTrianglePoint);closestSegmentPoint.copy(start);closestTrianglePoint.copy(startTrianglePoint);
 let closestDistanceSq=closestSegmentPoint.distanceToSquared(closestTrianglePoint);
 triangle.shape.closestPointToPoint(end,endTrianglePoint);const endDistanceSq=end.distanceToSquared(endTrianglePoint);
 if(endDistanceSq<closestDistanceSq){closestDistanceSq=endDistanceSq;closestSegmentPoint.copy(end);closestTrianglePoint.copy(endTrianglePoint);}
 for(let i=0;i<3;i++){
  const a=i===0?triangle.a:i===1?triangle.b:triangle.c,b=i===0?triangle.b:i===1?triangle.c:triangle.a;
  const pair=closestSegmentSegment(start,end,a,b,edge);
  if(pair.distanceSq<closestDistanceSq){closestDistanceSq=pair.distanceSq;closestSegmentPoint.copy(pair.segmentPoint);closestTrianglePoint.copy(pair.edgePoint);}
 }
 result.segmentPoint.copy(closestSegmentPoint);result.trianglePoint.copy(closestTrianglePoint);result.distanceSq=closestDistanceSq;return result;
}

function createClosestScratch(){
 const vector=()=>new THREE.Vector3();
 return {delta:vector(),ray:new THREE.Ray(),rayHit:vector(),startTrianglePoint:vector(),endTrianglePoint:vector(),
  closestSegmentPoint:vector(),closestTrianglePoint:vector(),result:{segmentPoint:vector(),trianglePoint:vector(),distanceSq:Infinity},
  edge:{u:vector(),v:vector(),w:vector(),segmentPoint:vector(),edgePoint:vector(),result:{segmentPoint:null,edgePoint:null,distanceSq:Infinity}}};
}

function vertexWorld(mesh,index,target){
 if(mesh.isSkinnedMesh)mesh.getVertexPosition(index,target);
 else target.fromBufferAttribute(mesh.geometry.attributes.position,index);
 return target.applyMatrix4(mesh.matrixWorld);
}

function meshTriangles(mesh,objectId){
 const geometry=mesh.geometry,position=geometry?.attributes?.position;if(!position)return null;
 mesh.updateWorldMatrix(true,false);if(mesh.isSkinnedMesh)mesh.skeleton.update();
 const index=geometry.index,start=Math.max(0,geometry.drawRange.start||0),available=index?.count??position.count,requested=Number.isFinite(geometry.drawRange.count)?geometry.drawRange.count:available-start,end=Math.min(available,start+requested),triangles=[],bounds=new THREE.Box3(),box=new THREE.Box3();
 const indexAt=i=>index?index.getX(i):i;
 for(let i=start;i+2<end;i+=3){
  const a=vertexWorld(mesh,indexAt(i),new THREE.Vector3()),b=vertexWorld(mesh,indexAt(i+1),new THREE.Vector3()),c=vertexWorld(mesh,indexAt(i+2),new THREE.Vector3());
  const shape=new THREE.Triangle(a,b,c),normal=shape.getNormal(new THREE.Vector3());if(normal.lengthSq()<EPSILON)continue;
  box.setFromPoints([a,b,c]);bounds.union(box);
  triangles.push({a,b,c,shape,normal,bounds:box.clone()});
 }
 return triangles.length?{objectId,meshName:mesh.name||'mesh',bounds,triangles}:null;
}

function rootsToMeshes(roots){
 const meshes=[];
 for(const root of roots||[]){
  const objectId=root?.userData?.instanceId||root?.name||'object';
  if(!root?.isObject3D||!root.visible||objectId==='demo-agent'||objectId==='floor'||root.userData?.limbCollision===false)continue;
  root.updateWorldMatrix(true,true);
  root.traverse(node=>{
   if(!node.isMesh||!node.visible||node.userData?.limbCollision===false)return;
   const geometry=meshTriangles(node,objectId);if(geometry)meshes.push(geometry);
  });
 }
 return meshes;
}

function queryBox(capsule,target){
 target.min.copy(capsule.start).min(capsule.end).addScalar(-capsule.radius);
 target.max.copy(capsule.start).max(capsule.end).addScalar(capsule.radius);
 return target;
}

function isAllowedSeatContact(capsule,mesh,triangle,options,closest){
 if(options.seatObjectId!==mesh.objectId||(!supportedPhases.has(options.phase)&&!(options.phase==='entering'&&options.allowSeatSupport))||!capsule.name?.endsWith('-thigh')||triangle.normal.y<.8||!options.seatPoint||!Number.isFinite(options.seatHeight))return false;
 const surface=closest.trianglePoint,centerline=closest.segmentPoint,radius=options.seatSupportRadius??.28;
 if(Math.abs(surface.y-options.seatHeight)>.025||centerline.y<options.seatHeight-.01)return false;
 return Math.hypot(surface.x-options.seatPoint.x,surface.z-options.seatPoint.z)<=radius;
}

const BVH_LEAF_TRIANGLE_LIMIT=8;

function buildTriangleIndex(triangles){
 if(!triangles.length)return null;
 const center=(index,axis)=>{const bounds=triangles[index].bounds;return (bounds.min.getComponent(axis)+bounds.max.getComponent(axis))*.5;};
 const build=indices=>{
  const bounds=new THREE.Box3().makeEmpty();for(const index of indices)bounds.union(triangles[index].bounds);
  if(indices.length<=BVH_LEAF_TRIANGLE_LIMIT)return {bounds,indices};
  const spanX=bounds.max.x-bounds.min.x,spanY=bounds.max.y-bounds.min.y,spanZ=bounds.max.z-bounds.min.z,axis=spanX>=spanY&&spanX>=spanZ?0:spanY>=spanZ?1:2;
  indices.sort((a,b)=>center(a,axis)-center(b,axis)||a-b);
  const middle=indices.length>>1;
  return {bounds,left:build(indices.slice(0,middle)),right:build(indices.slice(middle))};
 };
 return build(triangles.map((_,index)=>index));
}

function indexedTriangleCandidates(root,triangles,query,stack,candidates,record){
 stack.length=0;candidates.length=0;stack.push(root);
 while(stack.length){
  const node=stack.pop();record.boundsTests++;if(!query.intersectsBox(node.bounds))continue;
  if(node.indices){
   for(const index of node.indices){record.boundsTests++;if(query.intersectsBox(triangles[index].bounds))candidates.push(index);}
  }else{stack.push(node.right,node.left);}
 }
 candidates.sort((a,b)=>a-b);return candidates;
}

export class TycoonCollisionWorld{
 createSweepBatch(options={}, {useWitnesses=false,witnessSeed=null,bounds=null}={}){
  const batch={},state={world:this,support:supportKey(options),queries:new Map(),useWitnesses:useWitnesses===true,witnesses:new Map(),interpolationTracks:new Map(),interpolationSamples:0};
  snapshotWorklist(this,state,bounds);
  if(state.useWitnesses){
   const seed=orderedSweepWitnesses.get(witnessSeed);
   if(seed?.world===this&&seed.support===state.support&&this.meshes.includes(seed.mesh)&&seed.mesh.triangles[seed.triangleIndex]===seed.triangle)rememberWitness(state,seed);
  }
  sweepBatches.set(batch,state);return batch;
 }
 createCapsuleBatch(options={}, {bounds=null}={}){
  const batch={},state={world:this,support:supportKey(options)};
  snapshotWorklist(this,state,bounds);
  capsuleBatches.set(batch,state);return batch;
 }
 #inspectCapsulesOrdered(capsules,options,meshes){
  const {bounds:query,stack,candidates}=this.queryScratch,record={ok:true,phase:options.phase||'unknown',checkedCapsules:0,testedTriangles:0,checkedMeshes:0,boundsTests:0,sampleCount:1,minClearanceM:Infinity,hit:null};
  for(const capsule of capsules||[]){
   record.checkedCapsules++;const bounds=queryBox(capsule,query);
   for(const mesh of meshes){
    record.boundsTests++;if(!bounds.intersectsBox(mesh.bounds))continue;record.checkedMeshes++;
    const triangleCandidates=this.useBvh?indexedTriangleCandidates(mesh.triangleIndex,mesh.triangles,bounds,stack,candidates,record):null,triangleCount=this.useBvh?triangleCandidates.length:mesh.triangles.length;
    for(let i=0;i<triangleCount;i++){
     const triangleIndex=this.useBvh?triangleCandidates[i]:i,triangle=mesh.triangles[triangleIndex];
     if(!this.useBvh){record.boundsTests++;if(!bounds.intersectsBox(triangle.bounds))continue;}
     const closest=closestSegmentTriangle(capsule.start,capsule.end,triangle,this.queryScratch.closest);if(isAllowedSeatContact(capsule,mesh,triangle,options,closest))continue;
     record.testedTriangles++;
     const distance=Math.sqrt(closest.distanceSq),clearance=distance-capsule.radius;
     record.minClearanceM=Math.min(record.minClearanceM,clearance);
     if(clearance<-.001){
      record.ok=false;record.hit={objectId:mesh.objectId,mesh:mesh.meshName,limb:capsule.name,side:capsule.side||null,clearanceM:clearance,distanceM:distance,radiusM:capsule.radius,segmentStart:capsule.start.toArray(),segmentEnd:capsule.end.toArray(),surfaceCenter:triangle.bounds.getCenter(new THREE.Vector3()).toArray(),surfaceBounds:{min:triangle.bounds.min.toArray(),max:triangle.bounds.max.toArray()},surfaceNormal:triangle.normal.toArray()};
      orderedInspectionWitnesses.set(record,{world:this,support:supportKey(options),mesh,triangle,triangleIndex,name:capsule.name,side:capsule.side||null});
      this.lastDiagnostic=record;return record;
     }
    }
   }
  }
  if(!Number.isFinite(record.minClearanceM))record.minClearanceM=null;
  this.lastDiagnostic=record;return record;
 }
 #inspectBatchedCapsules(capsules,options,batch){
  const record={ok:true,phase:options.phase||'unknown',checkedCapsules:0,testedTriangles:0,checkedMeshes:0,boundsTests:0,sampleCount:1,minClearanceM:Infinity,hit:null,scopeChecks:0,scopeMisses:0};
  if(batch.bounds){record.setupBoundsTests=batch.setupReported?0:batch.setupBoundsTests;record.boundsTests+=record.setupBoundsTests;record.worklistMeshes=batch.meshes.length;record.scopeChecks=0;record.scopeMisses=0;batch.setupReported=true;}
  for(const capsule of capsules||[]){
   const query=queryBox(capsule,this.queryScratch.bounds);let meshes=batch.meshes;
   if(batch.bounds){record.scopeChecks++;if(batch.bounds.containsBox(query))meshes=batch.meshes;else{meshes=this.meshes;record.scopeMisses++;}}
   const checked=this.#inspectCapsulesOrdered([capsule],options,meshes);
   record.checkedCapsules+=checked.checkedCapsules;record.testedTriangles+=checked.testedTriangles;record.checkedMeshes+=checked.checkedMeshes;record.boundsTests+=checked.boundsTests;
   record.minClearanceM=Math.min(record.minClearanceM,checked.minClearanceM??Infinity);
   if(!checked.ok){record.ok=false;record.hit=checked.hit;break;}
  }
  if(!Number.isFinite(record.minClearanceM))record.minClearanceM=null;
  this.lastDiagnostic=record;return record;
 }
 #inspectSweepSample(capsules,options,batch,precomputedKeys=null){
  const record={ok:true,phase:options.phase||'unknown',checkedCapsules:0,testedTriangles:0,checkedMeshes:0,boundsTests:0,sampleCount:1,minClearanceM:Infinity,hit:null,cacheHits:0,witnessTests:0,witnessRejections:0,witnessFallbacks:0};
  if(batch.bounds){record.scopeChecks=0;record.scopeMisses=0;}
  for(let capsuleIndex=0;capsuleIndex<capsules.length;capsuleIndex++){
   const capsule=capsules[capsuleIndex],key=precomputedKeys?.[capsuleIndex]??capsuleKey(capsule);let checked=batch.queries.get(key);
   if(checked){record.cacheHits++;record.checkedCapsules++;}
   else{
    const query=queryBox(capsule,this.queryScratch.bounds);let inside=true,meshes=batch.meshes;if(batch.bounds){record.scopeChecks++;inside=batch.bounds.containsBox(query);meshes=inside?batch.meshes:this.meshes;}
    if(batch.bounds&&!inside)record.scopeMisses++;
    if(batch.useWitnesses){
     const witness=batch.witnesses.get(witnessKey(capsule.name,capsule.side));
     if(witness){
      record.boundsTests++;
      if(query.intersectsBox(witness.mesh.bounds)){
       record.checkedMeshes++;record.boundsTests++;
       if(query.intersectsBox(witness.triangle.bounds)){
        const closest=closestSegmentTriangle(capsule.start,capsule.end,witness.triangle,this.queryScratch.closest),allowed=isAllowedSeatContact(capsule,witness.mesh,witness.triangle,options,closest);
        record.witnessTests++;record.testedTriangles++;
        if(!allowed){
         const distance=Math.sqrt(closest.distanceSq),clearance=distance-capsule.radius;
         if(clearance<-.001){
          const {mesh,triangle}=witness;record.checkedCapsules++;record.ok=false;record.witnessRejections++;record.minClearanceM=clearance;
          record.hit={objectId:mesh.objectId,mesh:mesh.meshName,limb:capsule.name,side:capsule.side||null,clearanceM:clearance,distanceM:distance,radiusM:capsule.radius,
           segmentStart:capsule.start.toArray(),segmentEnd:capsule.end.toArray(),surfaceCenter:triangle.bounds.getCenter(new THREE.Vector3()).toArray(),
           surfaceBounds:{min:triangle.bounds.min.toArray(),max:triangle.bounds.max.toArray()},surfaceNormal:triangle.normal.toArray(),method:'triangle-witness'};
          break;
         }
        }
       }
      }
      record.witnessFallbacks++;
     }
    }
    if(record.ok){
     checked=batch.bounds?this.#inspectCapsulesOrdered([capsule],options,meshes):this.inspectCapsules([capsule],options);record.checkedCapsules+=checked.checkedCapsules;record.testedTriangles+=checked.testedTriangles;record.checkedMeshes+=checked.checkedMeshes;record.boundsTests+=checked.boundsTests;
     if(batch.useWitnesses)rememberWitness(batch,orderedInspectionWitnesses.get(checked));
     batch.queries.set(key,{ok:checked.ok,minClearanceM:checked.minClearanceM,hit:checked.hit?structuredClone(checked.hit):null});
     if(batch.queries.size>SWEEP_CACHE_LIMIT)batch.queries.delete(batch.queries.keys().next().value);
    }
   }
   if(!record.ok)break;
   record.minClearanceM=Math.min(record.minClearanceM,checked.minClearanceM??Infinity);
   if(!checked.ok){record.ok=false;record.hit=structuredClone(checked.hit);break;}
  }
  if(!Number.isFinite(record.minClearanceM))record.minClearanceM=null;return record;
 }
 constructor(roots=[],{useBvh=true}={}){this.useBvh=useBvh;this.roots=new Map((roots||[]).filter(root=>root?.isObject3D).map(root=>[root.userData?.instanceId||root.name||'object',root]));this.meshes=rootsToMeshes(roots);if(this.useBvh)for(const mesh of this.meshes)mesh.triangleIndex=buildTriangleIndex(mesh.triangles);this.queryScratch={bounds:new THREE.Box3(),stack:[],candidates:[],closest:createClosestScratch()};this.lastDiagnostic={ok:true,phase:'idle',checkedCapsules:0,testedTriangles:0,checkedMeshes:0,boundsTests:0,sampleCount:0,minClearanceM:null};}
 objectRoot(objectId){return this.roots.get(objectId)||null;}
 objectBounds(objectId){const bounds=new THREE.Box3();for(const mesh of this.meshes)if(mesh.objectId===objectId)bounds.union(mesh.bounds);return bounds.isEmpty()?null:{min:bounds.min.clone(),max:bounds.max.clone(),center:bounds.getCenter(new THREE.Vector3()),halfSize:bounds.getSize(new THREE.Vector3()).multiplyScalar(.5)};}
 projectionExtent(objectId,origin,direction){
  const dx=direction.x,dz=direction.z,length=Math.hypot(dx,dz);if(length<EPSILON)return null;let maximum=-Infinity;
  for(const mesh of this.meshes)if(mesh.objectId===objectId)for(const triangle of mesh.triangles)for(const point of [triangle.a,triangle.b,triangle.c])maximum=Math.max(maximum,((point.x-origin.x)*dx+(point.z-origin.z)*dz)/length);
  return Number.isFinite(maximum)?maximum:null;
 }
 topSurfaceFrame(objectId){
  this.topSurfaceFrames??=new Map();if(this.topSurfaceFrames.has(objectId))return this.topSurfaceFrames.get(objectId);
  const groups=new Map();
  for(const mesh of this.meshes){if(mesh.objectId!==objectId)continue;for(const triangle of mesh.triangles){
   if(triangle.normal.y<.999||triangle.bounds.max.y-triangle.bounds.min.y>.003)continue;
   const y=(triangle.a.y+triangle.b.y+triangle.c.y)/3,key=`${mesh.meshName}:${Math.round(y/.003)}`;
   let group=groups.get(key);if(!group){group={meshName:mesh.meshName,y,area:0,triangles:[],center:new THREE.Vector3()};groups.set(key,group);}
   const area=triangle.shape.getArea(),center=triangle.shape.getMidpoint(new THREE.Vector3());group.area+=area;group.center.addScaledVector(center,area);group.triangles.push(triangle);
  }}
  const group=[...groups.values()].sort((a,b)=>b.area-a.area)[0];if(!group?.area)return null;
  group.center.multiplyScalar(1/group.area);let xx=0,zz=0,xz=0,count=0;for(const triangle of group.triangles)for(const point of [triangle.a,triangle.b,triangle.c]){const dx=point.x-group.center.x,dz=point.z-group.center.z;xx+=dx*dx;zz+=dz*dz;xz+=dx*dz;count++;}
  const angle=.5*Math.atan2(2*xz,xx-zz),frame={center:group.center.clone(),majorAxis:new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),meshName:group.meshName,planeY:group.y,areaM2:group.area,triangles:group.triangles};this.topSurfaceFrames.set(objectId,frame);return frame;
 }
 topSurfaceExtent(objectId,origin,direction){
  const frame=this.topSurfaceFrame(objectId);if(!frame)return null;let maximum=-Infinity;
  for(const triangle of frame.triangles)for(const point of [triangle.a,triangle.b,triangle.c])maximum=Math.max(maximum,(point.x-origin.x)*direction.x+(point.z-origin.z)*direction.z);
  return Number.isFinite(maximum)?maximum:null;
 }
 topSurfacePoint(objectId,reference,{edgeInset=.075}={}){
  const frame=this.topSurfaceFrame(objectId);if(!frame)return null;const {center,majorAxis,meshName,planeY,areaM2,triangles}=frame,query=new THREE.Vector3(reference.x,planeY,reference.z);let closest=null;
  for(const triangle of triangles){const point=triangle.shape.closestPointToPoint(query,new THREE.Vector3()),distance=point.distanceToSquared(query);if(!closest||distance<closest.distanceSq)closest={point,distanceSq:distance,triangle};}
  if(!closest)return null;
  if(edgeInset>0&&closest.distanceSq>1e-8){const inward=new THREE.Vector3(closest.point.x-reference.x,0,closest.point.z-reference.z);if(inward.lengthSq()>1e-8)closest.point.addScaledVector(inward.normalize(),Math.min(edgeInset,Math.sqrt(closest.distanceSq)));}
  return {point:closest.point,normal:closest.triangle.normal.clone(),meshName,planeY,areaM2,center:center.clone(),majorAxis:majorAxis.clone()};
 }
 inspectCapsules(capsules,options={},batchToken=null){
  const state=batchToken&&capsuleBatches.get(batchToken),batch=state?.world===this&&state.support===supportKey(options)?state:null;
  if(batch)return this.#inspectBatchedCapsules(capsules,options,batch);
  const {bounds:query,stack,candidates}=this.queryScratch,record={ok:true,phase:options.phase||'unknown',checkedCapsules:0,testedTriangles:0,checkedMeshes:0,boundsTests:0,sampleCount:1,minClearanceM:Infinity,hit:null};
  for(const capsule of capsules||[]){
   record.checkedCapsules++;const bounds=queryBox(capsule,query);
   for(const mesh of this.meshes){
    record.boundsTests++;if(!bounds.intersectsBox(mesh.bounds))continue;record.checkedMeshes++;
    const triangleCandidates=this.useBvh?indexedTriangleCandidates(mesh.triangleIndex,mesh.triangles,bounds,stack,candidates,record):null,triangleCount=this.useBvh?triangleCandidates.length:mesh.triangles.length;
    for(let i=0;i<triangleCount;i++){
     const triangleIndex=this.useBvh?triangleCandidates[i]:i,triangle=mesh.triangles[triangleIndex];
     if(!this.useBvh){record.boundsTests++;if(!bounds.intersectsBox(triangle.bounds))continue;}
     const closest=closestSegmentTriangle(capsule.start,capsule.end,triangle,this.queryScratch.closest);if(isAllowedSeatContact(capsule,mesh,triangle,options,closest))continue;
     record.testedTriangles++;
     const distance=Math.sqrt(closest.distanceSq),clearance=distance-capsule.radius;
     record.minClearanceM=Math.min(record.minClearanceM,clearance);
     if(clearance<-.001){
      record.ok=false;record.hit={objectId:mesh.objectId,mesh:mesh.meshName,limb:capsule.name,side:capsule.side||null,clearanceM:clearance,distanceM:distance,radiusM:capsule.radius,segmentStart:capsule.start.toArray(),segmentEnd:capsule.end.toArray(),surfaceCenter:triangle.bounds.getCenter(new THREE.Vector3()).toArray(),surfaceBounds:{min:triangle.bounds.min.toArray(),max:triangle.bounds.max.toArray()},surfaceNormal:triangle.normal.toArray()};
      orderedInspectionWitnesses.set(record,{world:this,support:supportKey(options),mesh,triangle,triangleIndex,name:capsule.name,side:capsule.side||null});
      this.lastDiagnostic=record;return record;
     }
    }
   }
  }
  if(!Number.isFinite(record.minClearanceM))record.minClearanceM=null;
  this.lastDiagnostic=record;return record;
 }
 sweepCapsules(...args){return drainPoseSteps(this.sweepCapsulesSteps(...args));}
 *sweepCapsulesSteps(from,to,options={},batch=null){
  const cachedBatch=batch&&sweepBatches.get(batch),queryBatch=cachedBatch?.world===this&&cachedBatch.support===supportKey(options)?cachedBatch:null;
  const previous=new Map((from||[]).map(c=>[`${c.side||''}:${c.name}`,c])),next=new Map((to||[]).map(c=>[`${c.side||''}:${c.name}`,c]));
  if(previous.size!==next.size||[...previous.keys()].some(key=>!next.has(key)))throw new Error('Limb sweep topology changed');
  let travel=0;for(const [key,a] of previous){const b=next.get(key);travel=Math.max(travel,a.start.distanceTo(b.start),a.end.distanceTo(b.end));}
  const maxStep=Math.max(.005,options.maxStepM||.02),requiredSamples=Math.max(1,Math.ceil(travel/maxStep)),maxSamples=Math.max(1,options.maxSamples||40);
  const result={ok:true,phase:options.phase||'unknown',checkedCapsules:next.size,testedTriangles:0,checkedMeshes:0,boundsTests:0,sampleCount:requiredSamples,minClearanceM:Infinity,hit:null};
  if(queryBatch){result.cacheHits=0;if(queryBatch.useWitnesses){result.witnessTests=0;result.witnessRejections=0;result.witnessFallbacks=0;}}
  if(queryBatch?.bounds){result.setupBoundsTests=queryBatch.setupReported?0:queryBatch.setupBoundsTests;result.boundsTests+=result.setupBoundsTests;result.scopeChecks=0;result.scopeMisses=0;result.worklistMeshes=queryBatch.meshes.length;queryBatch.setupReported=true;}
  if(requiredSamples>maxSamples){result.ok=false;result.sampleCount=0;result.requiredSamples=requiredSamples;result.hit={objectId:null,mesh:null,limb:'sweep',side:null,clearanceM:null,travelM:travel,reason:'sweep-range-exceeded'};this.lastDiagnostic=result;return result;}
  const interpolationBatch=queryBatch&&!queryBatch.useWitnesses?queryBatch:null,interpolationPrefix=interpolationBatch?JSON.stringify([requiredSamples,[...previous.keys()]]):null,interpolationTracks=[];
  if(interpolationBatch){let index=0;for(const [key,a] of previous){const b=next.get(key),cacheKey=`${interpolationPrefix}#${index}`;interpolationTracks.push({key:cacheKey,track:getSweepInterpolationTrack(interpolationBatch,cacheKey,a,b),from:a,to:b});index++;}}
  for(let i=0;i<=requiredSamples;i++){
   yield;
   const t=i/requiredSamples,capsules=[],sampleKeys=interpolationBatch?[]:null;let capsuleIndex=0;
   for(const [key,a] of previous){const b=next.get(key),entry=interpolationTracks[capsuleIndex];let capsule=null,sampleKey;
    if(entry?.track&&i in entry.track.samples){
     if(sameSweepSnapshot(entry.track.sampleSnapshots[i],entry.track.samples[i])&&typeof entry.track.keys[i]==='string'){capsule=entry.track.samples[i];sampleKey=entry.track.keys[i];}
     else entry.track=resetSweepInterpolationTrack(interpolationBatch,entry.key,entry.from,entry.to);
    }
    if(!capsule){capsule=interpolateSweepCapsule(a,b,t);if(entry?.track&&cacheSweepInterpolationSample(interpolationBatch,entry.key,entry.track,i,capsule))sampleKey=entry.track.keys[i];}
    capsules.push(capsule);if(sampleKeys)sampleKeys.push(sampleKey);capsuleIndex++;
   }
   const checked=queryBatch?this.#inspectSweepSample(capsules,options,queryBatch,sampleKeys):this.inspectCapsules(capsules,options);result.testedTriangles+=checked.testedTriangles;result.checkedMeshes+=checked.checkedMeshes;result.boundsTests+=checked.boundsTests;result.minClearanceM=Math.min(result.minClearanceM,checked.minClearanceM??Infinity);if(queryBatch){result.cacheHits+=checked.cacheHits;if(queryBatch.bounds){result.scopeChecks+=checked.scopeChecks;result.scopeMisses+=checked.scopeMisses;}if(queryBatch.useWitnesses){result.witnessTests+=checked.witnessTests;result.witnessRejections+=checked.witnessRejections;result.witnessFallbacks+=checked.witnessFallbacks;}}
   if(!checked.ok){result.ok=false;result.hit={...checked.hit,sweepT:t,sampleIndex:i};
    if(!checked.hit.method){const witness=orderedInspectionWitnesses.get(checked);if(witness)orderedSweepWitnesses.set(result,witness);}
    this.lastDiagnostic=result;return result;}
  }
  if(!Number.isFinite(result.minClearanceM))result.minClearanceM=null;
  this.lastDiagnostic=result;return result;
 }
}
