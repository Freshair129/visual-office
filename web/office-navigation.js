import {rotateGroundPoint} from './office-rotation.js';
import {createPlacementGrid} from './office-placement-grid.js';
import {isOfficeSheet,sheetYaw} from './office-scene-sheet.js';
import {deriveSheetBlockers} from './office-sheet-bounds.js';
import {physicalSkeletonRoom,adjustedWallSpan,SKELETON_WALLS} from './office-skeleton-parts.js';
// @tested tests/office-navigation-scheduling.test.mjs, tests/office-navigation-cache.test.mjs
import {resolveNavigationCoordinateBounds,validateOfficeNavigation} from './office-nav-state.js';
import {LEGACY_COORDINATE_BOUNDS} from './office-design-limits.js';
import {officeArchitectureFootprints} from './office-architecture.js';
import {blueprintLayout,isOfficeBlueprint} from './office-blueprints.js';
import {isBlueprintInput} from './office-blueprint-state.js';
import {groundToWorld,worldToGround} from './office-projection.js';

const SCREEN_X_PER_METRE=3.535;
const SCREEN_Y_PER_METRE=2.758;
const ACTOR_CLEARANCE_METRES=.3;
const WALL_CLEARANCE_PERCENT=1.1;
const GRID_STEP=.75;
const MAX_OBJECTS=40;
const MAX_IGNORE_IDS=40;
const MAX_EXPANSIONS=16000;
const MAX_POINT_QUERY_CACHE_ENTRIES=2048;
const MAX_SEGMENT_QUERY_CACHE_ENTRIES=2048;
const MAX_LOCAL_PATH_CACHE_ENTRIES=64;
const BLOCKER_SPATIAL_CELL_SIZE=8;

const ZONE_DEFINITIONS=[
  {id:'work',type:'work',polygon:[[58,24],[90,42],[66,63],[41,43]]},
  {id:'corridor',type:'corridor',polygon:[[54,44],[55,47],[50,51],[44,55],[40,58],[34,59],[30,56],[33,52],[38,48],[43,44],[48,42]]},
  {id:'lounge',type:'lounge',polygon:[[31,49],[43,57],[59,74],[38,93],[8,72],[10,62]]},
];
const WALL_SEGMENTS=[
  {id:'wall-left-rear',from:[23.7,37.5],to:[31.2,44.8]},
  {id:'wall-left-doorway',from:[39.5,55],to:[44.8,60.5]},
  {id:'wall-main-rear',from:[44.8,60.5],to:[66.4,81]},
  {id:'wall-main-front',from:[66.4,81],to:[98,52]},
];

const FOOTPRINTS={
  'work-desk':{type:'desk',width:1.8,depth:.85,referenceScale:.62,station:'desk'},
  desk:{type:'desk',width:1.8,depth:.85,referenceScale:.62,station:'desk'},
  'task-chair':{type:'chair',width:1.04,depth:.95,referenceScale:.72},
  chair:{type:'chair',width:1.04,depth:.95,referenceScale:.72},
  // The shared GLB footprint is 2.05 x 1.05 m; the floor places it at yaw PI/2.
  'team-sofa':{type:'sofa',width:1.05,depth:2.05,referenceScale:1,station:'sofa'},
  printer:{type:'printer',width:.95,depth:.9,referenceScale:1},
  plant:{type:'plant',width:.7,depth:.7,referenceScale:1},
  whiteboard:{type:'whiteboard',width:1.95,depth:.65,referenceScale:1},
  'water-cooler':{type:'water-cooler',width:.7,depth:.7,referenceScale:1,station:'water'},
  watercooler:{type:'water-cooler',width:.7,depth:.7,referenceScale:1,station:'water'},
  'water-dispenser':{type:'water-cooler',width:.7,depth:.7,referenceScale:1,station:'water'},
};

const copyPoint=point=>({x:point.x,y:point.y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const exactValueKey=value=>{
  if(typeof value==='number')return `n:${Object.is(value,-0)?'-0':String(value)}`;
  if(typeof value==='string')return `s:${JSON.stringify(value)}`;
  if(typeof value==='boolean')return `b:${value}`;
  if(value===undefined)return 'u:';
  if(value===null)return 'null:';
  if(typeof value==='bigint')return `i:${value}`;
  if(typeof value==='symbol')return `y:${String(value)}`;
  return `o:${Object.prototype.toString.call(value)}`;
};
const exactPointKey=point=>`${exactValueKey(point?.x)},${exactValueKey(point?.y)}`;
const pointOnSegment=(point,a,b)=>Math.abs(cross(a,b,point))<1e-8&&
  point.x>=Math.min(a.x,b.x)-1e-8&&point.x<=Math.max(a.x,b.x)+1e-8&&
  point.y>=Math.min(a.y,b.y)-1e-8&&point.y<=Math.max(a.y,b.y)+1e-8;

function boundedQueryCache(maxEntries){
  return {
    values:new Map(),maxEntries,
    get(key){
      if(!this.values.has(key))return {found:false,value:undefined};
      const value=this.values.get(key);
      this.values.delete(key);this.values.set(key,value);
      return {found:true,value};
    },
    set(key,value){
      this.values.delete(key);this.values.set(key,value);
      if(this.values.size>this.maxEntries)this.values.delete(this.values.keys().next().value);
    },
  };
}

function pointInPolygon(point,polygon){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i];
    if(pointOnSegment(point,a,b))return true;
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}

function segmentsIntersect(a,b,c,d){
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  if(((abC>0&&abD<0)||(abC<0&&abD>0))&&((cdA>0&&cdB<0)||(cdA<0&&cdB>0)))return true;
  return (Math.abs(abC)<1e-8&&pointOnSegment(c,a,b))||
    (Math.abs(abD)<1e-8&&pointOnSegment(d,a,b))||
    (Math.abs(cdA)<1e-8&&pointOnSegment(a,c,d))||
    (Math.abs(cdB)<1e-8&&pointOnSegment(b,c,d));
}

function segmentHitsPolygon(a,b,polygon){
  if(pointInPolygon(a,polygon)||pointInPolygon(b,polygon))return true;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++)if(segmentsIntersect(a,b,polygon[j],polygon[i]))return true;
  return false;
}

function pointSegmentDistance(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,lengthSquared=dx*dx+dy*dy;
  if(!lengthSquared)return distance(point,a);
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/lengthSquared));
  return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
}

function segmentDistance(a,b,c,d){
  if(segmentsIntersect(a,b,c,d))return 0;
  return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),
    pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}

function makeWallBlocker(wall){
  const from={x:wall.from[0],y:wall.from[1]},to={x:wall.to[0],y:wall.to[1]},dx=to.x-from.x,dy=to.y-from.y;
  const length=Math.hypot(dx,dy),nx=-dy/length*WALL_CLEARANCE_PERCENT,ny=dx/length*WALL_CLEARANCE_PERCENT;
  const ux=dx/length*WALL_CLEARANCE_PERCENT,uy=dy/length*WALL_CLEARANCE_PERCENT;
  const a={x:from.x-ux,y:from.y-uy},b={x:to.x+ux,y:to.y+uy};
  return {id:wall.id,objectId:wall.id,kind:'wall',type:'wall',segment:[from,to],radius:WALL_CLEARANCE_PERCENT,
    center:{x:(from.x+to.x)/2,y:(from.y+to.y)/2},scale:1,flip:false,
    polygon:[[a.x+nx,a.y+ny],[b.x+nx,b.y+ny],[b.x-nx,b.y-ny],[a.x-nx,a.y-ny]]};
}

function makeBlocker(object,footprint,clearance=ACTOR_CLEARANCE_METRES){
  const scale=object.scale/footprint.referenceScale;
  const rotated=object.flip&&['desk','chair'].includes(footprint.type);
  const halfWidth=(rotated?footprint.depth:footprint.width)*scale/2+clearance;
  const halfDepth=(rotated?footprint.width:footprint.depth)*scale/2+clearance;
  const polygon=[];
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const dx=sx*halfWidth,dz=sz*halfDepth;
    polygon.push([
      object.x+SCREEN_X_PER_METRE*(dx-dz),
      object.y+SCREEN_Y_PER_METRE*(dx+dz),
    ]);
  }
  // Keep the vertices in boundary order for hit testing and external inspection.
  const center={x:object.x,y:object.y};
  polygon.sort((a,b)=>Math.atan2(a[1]-center.y,a[0]-center.x)-Math.atan2(b[1]-center.y,b[0]-center.x));
  return {id:object.id,objectId:object.id,kind:object.kind,type:footprint.type,polygon,
    center,scale:object.scale,flip:object.flip===true,halfWidth,halfDepth};
}

function blockerAabb(blocker,polygon){
  const points=blocker.type==='wall'?blocker.segment:polygon;
  if(!Array.isArray(points)||points.length===0)return null;
  const radius=blocker.type==='wall'&&Number.isFinite(blocker.radius)?Math.max(0,blocker.radius):0;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const point of points){
    const x=Array.isArray(point)?point[0]:point.x,y=Array.isArray(point)?point[1]:point.y;
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  return {minX:minX-radius,minY:minY-radius,maxX:maxX+radius,maxY:maxY+radius};
}

function overlapsAabb(a,b){return a.minX<=b.maxX&&a.maxX>=b.minX&&a.minY<=b.maxY&&a.maxY>=b.minY;}
function containsPointAabb(bounds,point){return point.x>=bounds.minX&&point.x<=bounds.maxX&&point.y>=bounds.minY&&point.y<=bounds.maxY;}
function createBlockerSpatialIndex(blockers,polygonCache){
  const entries=blockers.map((blocker,index)=>({blocker,index,bounds:blockerAabb(blocker,polygonCache.get(blocker.id))}));
  const cells=new Map(),cellCoordinate=value=>Math.floor(value/BLOCKER_SPATIAL_CELL_SIZE),cellKey=(x,y)=>`${x},${y}`;
  for(const entry of entries){
    if(!entry.bounds)continue;
    const minX=cellCoordinate(entry.bounds.minX),maxX=cellCoordinate(entry.bounds.maxX),
      minY=cellCoordinate(entry.bounds.minY),maxY=cellCoordinate(entry.bounds.maxY);
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const key=cellKey(x,y);let bucket=cells.get(key);
      if(!bucket){bucket=[];cells.set(key,bucket);}
      bucket.push(entry);
    }
  }
  const pointCandidates=point=>cells.get(cellKey(cellCoordinate(point.x),cellCoordinate(point.y)))||[];
  const segmentCandidates=(a,b)=>{
    const bounds={minX:Math.min(a.x,b.x),minY:Math.min(a.y,b.y),maxX:Math.max(a.x,b.x),maxY:Math.max(a.y,b.y)},
      minX=cellCoordinate(bounds.minX),maxX=cellCoordinate(bounds.maxX),minY=cellCoordinate(bounds.minY),maxY=cellCoordinate(bounds.maxY);
    if(minX===maxX&&minY===maxY)return (cells.get(cellKey(minX,minY))||[]).filter(entry=>overlapsAabb(bounds,entry.bounds));
    const found=new Set(),candidates=[];
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)for(const entry of cells.get(cellKey(x,y))||[]){
      if(found.has(entry.index))continue;
      found.add(entry.index);
      if(overlapsAabb(bounds,entry.bounds))candidates.push(entry);
    }
    candidates.sort((left,right)=>left.index-right.index);
    return candidates;
  };
  return {pointCandidates,segmentCandidates};
}

// Physical planning footprints (without navigation's actor padding), shared by structural authoring.
export function officeObjectFootprint(object){
  const footprint=FOOTPRINTS[object.kind]||(object.kind==='wayfinding-arrow'?{type:'marker',width:1.2,depth:.7,referenceScale:1}:
    /^avatar-\d\d$/.test(object.kind)?{type:'avatar',width:1.6,depth:1.6,referenceScale:.82}:null);
  if(!footprint)return [{x:object.x,y:object.y}];
  const {halfWidth,halfDepth}=makeBlocker(object,footprint,0),center=groundToWorld(object);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>worldToGround({x:center.x+x*halfWidth,z:center.z+z*halfDepth}));
}

function pointWithinFootprint(point,object,footprint,padding=0,coordinateBounds=LEGACY_COORDINATE_BOUNDS){
  if(!withinRoom(point,coordinateBounds)||!object||!footprint||!Number.isFinite(object.scale))return false;
  if(object.rotation)point=rotateGroundPoint(point,object,-object.rotation);
  const screenX=(point.x-object.x)/SCREEN_X_PER_METRE,screenY=(point.y-object.y)/SCREEN_Y_PER_METRE;
  const worldX=(screenX+screenY)/2,worldZ=(screenY-screenX)/2;
  const scale=object.scale/footprint.referenceScale;
  let width=footprint.width*scale,depth=footprint.depth*scale;
  if(object.flip&&['desk','chair'].includes(footprint.type))[width,depth]=[depth,width];
  return Math.abs(worldX)<=width/2+padding&&Math.abs(worldZ)<=depth/2+padding;
}

function withinRoom(point,bounds=LEGACY_COORDINATE_BOUNDS){
  return !!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&
    point.x>=bounds.minX&&point.x<=bounds.maxX&&point.y>=bounds.minY&&point.y<=bounds.maxY;
}

function gridForBounds(bounds){
  const firstX=Math.ceil(bounds.minX/GRID_STEP),lastX=Math.floor(bounds.maxX/GRID_STEP);
  const firstY=Math.ceil(bounds.minY/GRID_STEP),lastY=Math.floor(bounds.maxY/GRID_STEP);
  return {originX:firstX*GRID_STEP,originY:firstY*GRID_STEP,width:lastX-firstX+1,height:lastY-firstY+1};
}

function makeIgnoreSet(ignoreIds){
  if(!Array.isArray(ignoreIds))return new Set();
  return new Set(ignoreIds.slice(0,MAX_IGNORE_IDS).filter(id=>typeof id==='string'&&id.length<=60));
}

function createHeap(){
  const values=[];
  return {
    get size(){return values.length;},
    push(value){
      let index=values.push(value)-1;
      while(index>0){const parent=(index-1)>>1;if(values[parent].f<=value.f)break;values[index]=values[parent];index=parent;}
      values[index]=value;
    },
    pop(){
      if(!values.length)return null;
      const first=values[0],last=values.pop();
      if(values.length){let index=0;while(true){const left=index*2+1,right=left+1;if(left>=values.length)break;const child=right<values.length&&values[right].f<values[left].f?right:left;if(values[child].f>=last.f)break;values[index]=values[child];index=child;}values[index]=last;}
      return first;
    },
  };
}

function worldOffset(dx,dz){return {x:SCREEN_X_PER_METRE*(dx-dz),y:SCREEN_Y_PER_METRE*(dx+dz)};}

function stationCandidates(object,blocker,preferred){
  const result=[preferred];
  const outward=.5;
  for(const [dx,dz] of [
    [blocker.halfWidth+outward,0],[-blocker.halfWidth-outward,0],
    [0,blocker.halfDepth+outward],[0,-blocker.halfDepth-outward],
  ]){
    const offset=worldOffset(object.flip?-dx:dx,dz);
    result.push({x:object.x+offset.x,y:object.y+offset.y});
  }
  return result;
}

function nearestSafePoint(preferred,candidates,isWalkable,bounds){
  if(withinRoom(preferred,bounds)&&isWalkable(preferred))return preferred;
  for(let radius=.25;radius<=8;radius+=.25){
    const samples=[];
    for(let i=0;i<24;i++){
      const angle=i*Math.PI/12,point={x:preferred.x+Math.cos(angle)*radius,y:preferred.y+Math.sin(angle)*radius};
      if(withinRoom(point,bounds)&&isWalkable(point))samples.push(point);
    }
    if(samples.length)return samples[0];
  }
  const ordered=candidates.filter(point=>withinRoom(point,bounds)&&isWalkable(point));
  if(ordered.length)return ordered.sort((a,b)=>distance(a,preferred)-distance(b,preferred))[0];
  return null;
}

export function createOfficeNavigation(room,{objectBlockers,includeObjectStations=false,coordinateBounds:boundsOption,blueprintOptions,cacheQueries:cacheQueriesOption=true}={}){
  const coordinateBounds=resolveNavigationCoordinateBounds(boundsOption),grid=gridForBounds(coordinateBounds);
  const isWithinRoom=point=>withinRoom(point,coordinateBounds);
  if(isOfficeSheet(room)&&!objectBlockers){objectBlockers=deriveSheetBlockers(room);includeObjectStations=true;}
  const authoredRoom=room,baseNavigation=room.skeletonParts?.length&&!room.blueprint&&!room.blueprintPlan?createOfficeNavigation({...room,skeletonParts:undefined}):null,seatOwners=baseNavigation?new Map(baseNavigation.stations.filter(s=>s.seatObjectId).map(s=>[s.objectId,s.seatObjectId])):null;room=physicalSkeletonRoom(room,{seatOwners});
  const shape=room?.blueprintPlan||room?.blueprint;
  const blueprint=isBlueprintInput(shape)?blueprintLayout(shape,blueprintOptions):null;
  const zones=(blueprint?.zones||ZONE_DEFINITIONS).map(zone=>({id:zone.id,type:zone.type,polygon:zone.polygon.map(point=>[...point])}));
  const zonePolygons=zones.map(zone=>zone.polygon.map(([x,y])=>({x,y})));
  const seenIds=new Set(),objects=Array.isArray(room?.objects)?room.objects.slice(0,objectBlockers?80:MAX_OBJECTS):[],validObjects=[];
  const issues=[];
  let authoredNavigation;
  if(room?.navigation!==undefined){
    try{authoredNavigation=validateOfficeNavigation(room.navigation,objects,{coordinateBounds});}
    catch(error){
      const message=String(error?.message||'Authored navigation is invalid.');
      const stationMatch=/^station ([a-zA-Z0-9_-]{1,60})\b/i.exec(message);
      issues.push({objectId:stationMatch?.[1]||null,message:`Navigation config: ${message}`});
    }
  }
  // Trusted renderer adapter supplies measured, padded polygons for catalog GLBs.
  // Not a field accepted in scene imports; legacy callers retain their existing footprints.
  const blockers=objectBlockers?objectBlockers.map(b=>({...b,
    ...(Array.isArray(b.segment)?{segment:b.segment.map(copyPoint)}:{}),
    polygon:b.polygon.map(p=>[...p]),
  })):[];
  for(const object of objects){
    if(objectBlockers&&!includeObjectStations)break;
    if(!object||typeof object.id!=='string'||object.id.length>60||seenIds.has(object.id)||
      !isWithinRoom(object))continue;
    seenIds.add(object.id);
    const footprint=FOOTPRINTS[object.kind];
    if(!footprint||!Number.isFinite(object.scale)||object.scale<.3||object.scale>2.25)continue;
    validObjects.push(object);
    if(!objectBlockers)blockers.push(makeBlocker(object,footprint));
  }
  const legacyWalls=SKELETON_WALLS.filter((w,i)=>i<4||authoredRoom.skeletonParts?.some(p=>p.id===`wall:${w.id}`)).map((w,i)=>{const span=adjustedWallSpan(w,authoredRoom.skeletonParts);return {id:i<4?WALL_SEGMENTS[i].id:`wall-${w.id}`,from:[span.from.x,span.from.y],to:[span.to.x,span.to.y]};});
  blockers.push(...(blueprint?[...blueprint.walls,...blueprint.closedDoors].map(w=>({id:`wall-${w.id}`,from:w.start,to:w.end})):legacyWalls).map(makeWallBlocker));
  for(const fixture of officeArchitectureFootprints(ACTOR_CLEARANCE_METRES,shape,authoredRoom.skeletonParts)){
    const id=`architecture-${fixture.id}`;
    blockers.push({id,objectId:id,kind:'architecture',type:'architecture',
      polygon:fixture.polygon.map(point=>[...point]),center:copyPoint(fixture.center),scale:1,flip:false});
  }
  for(const area of authoredNavigation?.forbidden||[]){
    blockers.push({id:area.id,objectId:area.id,kind:'forbidden',type:'forbidden',polygon:area.points.map(point=>[point.x,point.y]),
      center:{x:area.points.reduce((sum,point)=>sum+point.x,0)/area.points.length,
        y:area.points.reduce((sum,point)=>sum+point.y,0)/area.points.length},scale:1,flip:false});
  }

  function walkableArea(point){
    if(!zonePolygons.some(polygon=>pointInPolygon(point,polygon)))return false;
    for(let i=0;i<16;i++){
      const angle=i*Math.PI/8,edge={x:point.x+Math.cos(angle)*WALL_CLEARANCE_PERCENT,y:point.y+Math.sin(angle)*WALL_CLEARANCE_PERCENT};
      if(!zonePolygons.some(polygon=>pointInPolygon(edge,polygon)))return false;
    }
    return true;
  }

  const polygonCache=new Map(blockers.map(blocker=>[blocker.id,blocker.polygon.map(([x,y])=>({x,y}))]));
  const blockerSpatialIndex=createBlockerSpatialIndex(blockers,polygonCache);
  const cacheQueries=cacheQueriesOption!==false;
  const queryCaches={
    isWalkable:boundedQueryCache(MAX_POINT_QUERY_CACHE_ENTRIES),
    segmentWalkable:boundedQueryCache(MAX_SEGMENT_QUERY_CACHE_ENTRIES),
    findLocalPath:boundedQueryCache(MAX_LOCAL_PATH_CACHE_ENTRIES),
  };
  const queryStats={
    isWalkable:{hits:0,computations:0,blockerChecks:0},
    segmentWalkable:{hits:0,computations:0,blockerChecks:0},
    findLocalPath:{hits:0,computations:0},
  };
  const ignoreKey=ignoreIds=>JSON.stringify([...makeIgnoreSet(ignoreIds)].sort());
  const memoizedQuery=(kind,key,compute,copyResult=value=>value)=>{
    const cache=queryCaches[kind];
    if(cacheQueries){
      const entry=cache.get(key);
      if(entry.found){queryStats[kind].hits++;return copyResult(entry.value);}
    }
    queryStats[kind].computations++;
    const result=compute();
    if(cacheQueries)cache.set(key,copyResult(result));
    return copyResult(result);
  };
  const shouldIgnore=(blocker,ignored)=>!['wall','forbidden','architecture'].includes(blocker.type)&&
    (ignored.has(blocker.id)||ignored.has(blocker.objectId));
  const placement=room.placementGrid&&isOfficeSheet(room)?createPlacementGrid(room):null;
  function computeWalkable(point,{ignoreIds=[]}={}){
    if(!isWithinRoom(point)||!walkableArea(point)||placement?.isOccupied(point,{ignoreIds}))return false;
    const ignored=makeIgnoreSet(ignoreIds);
    for(const entry of blockerSpatialIndex.pointCandidates(point)){
      if(!containsPointAabb(entry.bounds,point))continue;
      const blocker=entry.blocker;
      if(shouldIgnore(blocker,ignored))continue;
      queryStats.isWalkable.blockerChecks++;
      if(blocker.type==='wall'){
        if(pointSegmentDistance(point,blocker.segment[0],blocker.segment[1])<=blocker.radius)return false;
        continue;
      }
      if(pointInPolygon(point,polygonCache.get(blocker.id)))return false;
    }
    return true;
  }

  function isWalkable(point,{ignoreIds=[]}={}){
    const key=`${exactPointKey(point)}|${ignoreKey(ignoreIds)}`;
    return memoizedQuery('isWalkable',key,()=>computeWalkable(point,{ignoreIds}));
  }

  function computeSegmentWalkable(a,b,ignoreIds){
    if(placement?.segmentOccupied(a,b,{ignoreIds}))return false;
    if(!isWithinRoom(a)||!isWithinRoom(b)||!isWalkable(a,{ignoreIds})||!isWalkable(b,{ignoreIds}))return false;
    const ignored=makeIgnoreSet(ignoreIds);
    for(const entry of blockerSpatialIndex.segmentCandidates(a,b)){
      const blocker=entry.blocker;
      if(shouldIgnore(blocker,ignored))continue;
      queryStats.segmentWalkable.blockerChecks++;
      if(blocker.type==='wall'){
        if(segmentDistance(a,b,blocker.segment[0],blocker.segment[1])<=blocker.radius)return false;
      }else if(segmentHitsPolygon(a,b,polygonCache.get(blocker.id)))return false;
    }
    const steps=Math.max(1,Math.ceil(distance(a,b)/.35));
    for(let i=1;i<steps;i++){
      const t=i/steps;
      if(!isWalkable({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},{ignoreIds}))return false;
    }
    return true;
  }

  function segmentWalkable(a,b,ignoreIds){
    const key=`${exactPointKey(a)}>${exactPointKey(b)}|${ignoreKey(ignoreIds)}`;
    return memoizedQuery('segmentWalkable',key,()=>computeSegmentWalkable(a,b,ignoreIds));
  }

  const seatInFootprint=(point,object,footprint,padding=0)=>{
    if(!isOfficeSheet(room))return pointWithinFootprint(point,object,footprint,padding,coordinateBounds);
    const b=blockers.find(b=>b.id===object.id);if(!b||!withinRoom(point))return false;const points=b.polygon.map(([x,y])=>groundToWorld({x,y})),p=groundToWorld(point),inset=ACTOR_CLEARANCE_METRES-padding;
    return p.x>=Math.min(...points.map(p=>p.x))+inset-1e-7&&p.x<=Math.max(...points.map(p=>p.x))-inset+1e-7&&p.z>=Math.min(...points.map(p=>p.z))+inset-1e-7&&p.z<=Math.max(...points.map(p=>p.z))-inset+1e-7;
  };
  const stations=[],assignedChairs=new Set();
  const customStations=new Map((authoredNavigation?.stations||[]).map(station=>[station.objectId,station]));
  for(const object of validObjects){
    if(!object||typeof object.id!=='string')continue;
    const footprint=FOOTPRINTS[object.kind];
    if(!footprint?.station)continue;
    const blocker=blockers.find(candidate=>candidate.id===object.id);
    if(!blocker)continue;
    const mirrored=!isOfficeSheet(room)&&object.flip===true;
    const seat=footprint.station==='desk'?{x:object.x+(mirrored?-3.2:3.2),y:object.y-2.5}:undefined;
    let preferred=blueprint&&footprint.station==='desk'
      ?{x:object.x+worldOffset(0,2.05).x,y:object.y+worldOffset(0,2.05).y}:footprint.station==='desk'
      ?{x:object.x+(mirrored?-3:3),y:object.y-2.5}
      :footprint.station==='water'?{x:object.x-3.6,y:object.y+2.8}:{x:object.x+(mirrored?-3.8:3.8),y:object.y+3};
    if(object.rotation||isOfficeSheet(room)&&object.flip)preferred=rotateGroundPoint(preferred,object,(object.rotation||0)+(isOfficeSheet(room)&&object.flip?180:0));
    const position=nearestSafePoint(preferred,stationCandidates(object,blocker,preferred),isWalkable,coordinateBounds);
    const station={id:`${footprint.station}:${object.id}`,objectId:object.id,type:footprint.station,
      ...(position?{position:copyPoint(position)}:{})};
    if(seat){
      const nearestChair=(seatOwners?.has(object.id)?validObjects.find(item=>item.id===seatOwners.get(object.id)):null)||validObjects.filter(item=>!assignedChairs.has(item.id)&&item.id!==object.id&&['task-chair','chair'].includes(item.kind)&&
        Number.isFinite(item.x)&&Number.isFinite(item.y)).sort((a,b)=>distance(a,object)-distance(b,object))[0];
      if(nearestChair&&(seatOwners?.get(object.id)===nearestChair.id||distance(nearestChair,object)<8)&&isWalkable(nearestChair,{ignoreIds:[nearestChair.id]})){station.seatObjectId=nearestChair.id;station.seat=copyPoint(nearestChair);}
    }
    const custom=customStations.get(object.id);
    if(custom){
      if(!isWalkable(custom.approach)){
        issues.push({objectId:object.id,message:'Custom approach is blocked or outside the walkable floor.'});
        continue;
      }
      if(custom.seat){
        let seatObjectId=station.seatObjectId;
        if(footprint.station==='desk'){
          const chair=seatObjectId&&validObjects.find(item=>item.id===seatObjectId),chairFootprint=chair&&FOOTPRINTS[chair.kind];
          if(!chair||chairFootprint?.type!=='chair'){
            issues.push({objectId:object.id,message:'Custom desk seat needs a matched chair.'});
            continue;
          }
          if(!seatInFootprint(custom.seat,chair,chairFootprint,ACTOR_CLEARANCE_METRES)){
            issues.push({objectId:object.id,message:'Custom desk seat must stay inside its matched chair footprint.'});
            continue;
          }
        }
        if(footprint.station==='sofa'){
          if(!seatInFootprint(custom.seat,object,footprint)){
            issues.push({objectId:object.id,message:'Custom sofa seat must stay inside the sofa footprint.'});
            continue;
          }
          seatObjectId=object.id;
        }
        const ignoreSeat=seatObjectId?[seatObjectId]:[];
        if(!isWalkable(custom.seat,{ignoreIds:ignoreSeat})){
          issues.push({objectId:object.id,message:'Custom seat is blocked or outside the walkable floor.'});
          continue;
        }
        station.seat=copyPoint(custom.seat);
        if(seatObjectId)station.seatObjectId=seatObjectId;
      }
      station.position=copyPoint(custom.approach);
      station.custom=true;
    }else if(!position)continue;
    if(station.seatObjectId&&footprint.station==='desk')assignedChairs.add(station.seatObjectId);
    if(footprint.station==='desk'&&station.seatObjectId){
      const chair=validObjects.find(o=>o.id===station.seatObjectId);
      station.seatHeight=.66*(chair.scale/.72);
    }
    if(footprint.station==='sofa'&&isOfficeSheet(room)){
      const yaw=sheetYaw(object),scale=object.scale;
      const local=(x,z)=>{const origin=groundToWorld(object);origin.x+=scale*(x*Math.cos(yaw)+z*Math.sin(yaw));origin.z+=scale*(-x*Math.sin(yaw)+z*Math.cos(yaw));return worldToGround(origin);};
      station.heading=yaw+Math.PI;station.seatHeight=.725*scale;
      // Authored seat coordinates remain the only seat when a user supplied one.
      if(!custom?.seat){
        for(const [slot,x]of [['left',-.51],['right',.51]]){
          const seat=local(x,-.16),preferred=local(x,-1.05);
          const approach=custom?.approach||nearestSafePoint(preferred,stationCandidates(object,blocker,preferred),isWalkable);
          if(!approach||!isWalkable(seat,{ignoreIds:[object.id]})||!findLocalPath(approach,seat,{ignoreIds:[object.id]}).length)continue;
          stations.push({...station,id:`${station.id}:${slot}`,slot,seat,position:copyPoint(approach),seatObjectId:object.id});
        }
        continue;
      }
    }
    stations.push(station);
  }

  function* findGridConnectionSteps(point,ignoreIds){
    const centerX=Math.round((point.x-grid.originX)/GRID_STEP);
    const centerY=Math.round((point.y-grid.originY)/GRID_STEP);
    for(let radius=0;radius<=8;radius++){
      const candidates=[];
      for(let y=centerY-radius;y<=centerY+radius;y++)for(let x=centerX-radius;x<=centerX+radius;x++){
        yield;
        if(x<0||y<0||x>=grid.width||y>=grid.height||Math.max(Math.abs(x-centerX),Math.abs(y-centerY))!==radius)continue;
        const candidate={x:grid.originX+x*GRID_STEP,y:grid.originY+y*GRID_STEP};
        if(isWalkable(candidate,{ignoreIds})&&segmentWalkable(point,candidate,ignoreIds))candidates.push({x,y,point:candidate,distance:distance(point,candidate)});
      }
      if(candidates.length){candidates.sort((a,b)=>a.distance-b.distance);return candidates[0];}
    }
    return null;
  }

  function* computeLocalPathSteps(from,to,{ignoreIds=[]}={}){
    yield;
    if(!isWithinRoom(from)||!isWithinRoom(to)||!isWalkable(from,{ignoreIds})||!isWalkable(to,{ignoreIds}))return [];
    const start=copyPoint(from),goal=copyPoint(to);
    if(distance(start,goal)<1e-8)return [start];
    if(segmentWalkable(start,goal,ignoreIds))return [start,goal];
    const startCell=yield* findGridConnectionSteps(start,ignoreIds),goalCell=yield* findGridConnectionSteps(goal,ignoreIds);
    if(!startCell||!goalCell)return [];
    const startIndex=startCell.y*grid.width+startCell.x,goalIndex=goalCell.y*grid.width+goalCell.x;
    const count=grid.width*grid.height,gScore=new Float64Array(count),cameFrom=new Int32Array(count),closed=new Uint8Array(count);
    gScore.fill(Infinity);cameFrom.fill(-1);
    const heap=createHeap(),heuristic=(x,y)=>{
      const dx=Math.abs(x-goalCell.x),dy=Math.abs(y-goalCell.y),small=Math.min(dx,dy);
      return dx+dy+(Math.SQRT2-2)*small;
    };
    gScore[startIndex]=0;heap.push({index:startIndex,g:0,f:heuristic(startCell.x,startCell.y)});
    let expanded=0,reached=false;
    while(heap.size&&expanded<MAX_EXPANSIONS){
      yield;
      const current=heap.pop();
      if(closed[current.index]||current.g!==gScore[current.index])continue;
      if(current.index===goalIndex){reached=true;break;}
      closed[current.index]=1;expanded++;
      const x=current.index%grid.width,y=Math.floor(current.index/grid.width),origin={x:grid.originX+x*GRID_STEP,y:grid.originY+y*GRID_STEP};
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(dx===0&&dy===0)continue;
        const nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=grid.width||ny>=grid.height)continue;
        const index=ny*grid.width+nx;if(closed[index])continue;
        const cost=dx&&dy?Math.SQRT2:1,tentative=current.g+cost;
        if(tentative>=gScore[index])continue;
        const next={x:grid.originX+nx*GRID_STEP,y:grid.originY+ny*GRID_STEP};
        if(!isWalkable(next,{ignoreIds}))continue;
        if(dx&&dy){
          if(!isWalkable({x:grid.originX+nx*GRID_STEP,y:origin.y},{ignoreIds})||
            !isWalkable({x:origin.x,y:grid.originY+ny*GRID_STEP},{ignoreIds}))continue;
        }
        if(!segmentWalkable(origin,next,ignoreIds))continue;
        cameFrom[index]=current.index;gScore[index]=tentative;
        heap.push({index,g:tentative,f:tentative+heuristic(nx,ny)});
      }
    }
    if(!reached)return [];
    const reverse=[goalIndex];
    for(let current=goalIndex;current!==startIndex;){yield;current=cameFrom[current];if(current<0)return [];reverse.push(current);}
    reverse.reverse();
    const route=[start,...reverse.map(index=>({x:grid.originX+(index%grid.width)*GRID_STEP,y:grid.originY+Math.floor(index/grid.width)*GRID_STEP})),goal];
    const simplified=[route[0]];
    for(let current=0;current<route.length-1;){
      let next=route.length-1;
      while(next>current+1){yield;if(segmentWalkable(route[current],route[next],ignoreIds))break;next--;}
      yield;
      if(!segmentWalkable(route[current],route[next],ignoreIds))return [];
      if(distance(simplified.at(-1),route[next])>1e-8)simplified.push(route[next]);
      current=next;
    }
    return simplified.map(copyPoint);
  }

  function copyPath(path){return path.map(copyPoint);}
  function findLocalPathSteps(from,to,{ignoreIds=[]}={}){
    // Capture caller-owned inputs before returning an iterator that may span turns.
    const start=from==null?from:copyPoint(from),goal=to==null?to:copyPoint(to),ignored=[...makeIgnoreSet(ignoreIds)];
    return (function*(){
      const key=`${exactPointKey(start)}>${exactPointKey(goal)}|${ignoreKey(ignored)}`,cache=queryCaches.findLocalPath;
      if(cacheQueries){const entry=cache.get(key);if(entry.found){queryStats.findLocalPath.hits++;return copyPath(entry.value);}}
      queryStats.findLocalPath.computations++;
      const result=yield* computeLocalPathSteps(start,goal,{ignoreIds:ignored});
      if(cacheQueries)cache.set(key,copyPath(result));
      return copyPath(result);
    })();
  }
  function findLocalPath(from,to,{ignoreIds=[]}={}){
    const steps=findLocalPathSteps(from,to,{ignoreIds});let step;
    do{step=steps.next();}while(!step.done);return step.value;
  }

  function getQueryCacheStats(){
    return {
      enabled:cacheQueries,
      ...Object.fromEntries(Object.entries(queryCaches).map(([name,cache])=>[name,{
        ...queryStats[name],entries:cache.values.size,maxEntries:cache.maxEntries,
      }])),
    };
  }

  function isSegmentWalkable(a,b,{ignoreIds=[]}={}){
    return segmentWalkable(a,b,ignoreIds);
  }

  function findPath(from,to,{ignoreIds=[]}={}){
    if(!authoredNavigation?.routes.length)return findLocalPath(from,to,{ignoreIds});
    if(!isWithinRoom(from)||!isWithinRoom(to)||!isWalkable(from,{ignoreIds})||!isWalkable(to,{ignoreIds}))return [];
    const start=copyPoint(from),goal=copyPoint(to);
    if(distance(start,goal)<1e-8)return [start];

    const nodes=[],nodeByKey=new Map();
    const addNode=point=>{
      const key=`${point.x},${point.y}`;
      if(nodeByKey.has(key))return nodeByKey.get(key);
      const index=nodes.length;nodes.push(copyPoint(point));nodeByKey.set(key,index);return index;
    };
    const routeEdges=[];
    for(const route of authoredNavigation.routes){
      for(let i=1;i<route.points.length;i++){
        const a=route.points[i-1],b=route.points[i];
        // Keep saved route intent. Replan obstructed edges only for authored interior rooms.
        const points=room.blueprintPlan?.partitions?.length&&!segmentWalkable(a,b,ignoreIds)?findLocalPath(a,b,{ignoreIds}):[a,b];
        const indexes=points.map(addNode);for(let j=1;j<indexes.length;j++)routeEdges.push([indexes[j-1],indexes[j]]);
      }
    }
    const startIndex=nodes.length,goalIndex=startIndex+1;
    nodes.push(start,goal);
    const stateCount=nodes.length*2,adjacency=Array.from({length:stateCount},()=>[]);
    const connect=(a,b,usedEdgeA,usedEdgeB)=>{
      const weight=distance(nodes[a],nodes[b]),from=a*2+usedEdgeA,to=b*2+usedEdgeB;
      adjacency[from].push({to,weight});
    };
    for(const [a,b] of routeEdges){
      if(isWalkable(nodes[a],{ignoreIds})&&isWalkable(nodes[b],{ignoreIds})&&segmentWalkable(nodes[a],nodes[b],ignoreIds)){
        connect(a,b,0,1);connect(b,a,0,1);connect(a,b,1,1);connect(b,a,1,1);
      }
    }
    for(let i=0;i<startIndex;i++){
      if(!isWalkable(nodes[i],{ignoreIds}))continue;
      if(segmentWalkable(start,nodes[i],ignoreIds))connect(startIndex,i,0,0);
      if(segmentWalkable(goal,nodes[i],ignoreIds))connect(i,goalIndex,1,1);
    }

    const startState=startIndex*2,goalState=goalIndex*2+1;
    const costs=new Float64Array(stateCount),previous=new Int32Array(stateCount),closed=new Uint8Array(stateCount);
    costs.fill(Infinity);previous.fill(-1);costs[startState]=0;
    const heap=createHeap();heap.push({index:startState,g:0,f:0});
    let reached=false;
    while(heap.size){
      const current=heap.pop();
      if(closed[current.index]||current.g!==costs[current.index])continue;
      if(current.index===goalState){reached=true;break;}
      closed[current.index]=1;
      for(const edge of adjacency[current.index]){
        const next=edge.to;if(closed[next])continue;
        const cost=current.g+edge.weight;
        if(cost>=costs[next])continue;
        costs[next]=cost;previous[next]=current.index;heap.push({index:next,g:cost,f:cost});
      }
    }
    if(!reached)return [];
    const reverse=[goalState];
    for(let current=goalState;current!==startState;){current=previous[current];if(current<0)return [];reverse.push(current);}
    reverse.reverse();
    const path=[];
    for(const state of reverse){
      const index=Math.floor(state/2),point=index===startIndex?start:index===goalIndex?goal:nodes[index];
      if(!path.length||distance(path.at(-1),point)>1e-8)path.push(copyPoint(point));
    }
    return path;
  }

  return {zones,blockers:blockers.map(blocker=>({...blocker,center:copyPoint(blocker.center),
    ...(blocker.segment?{segment:blocker.segment.map(copyPoint)}:{}),polygon:blocker.polygon.map(point=>[...point])})),
    stations,issues,isWalkable,isSegmentWalkable,findLocalPath,findLocalPathSteps,findPath,getQueryCacheStats};
}

export function createDefaultOfficeNavigation(room){
  const {stations}=createOfficeNavigation({...room,navigation:undefined});
  return {version:1,routes:[],forbidden:[],stations:stations.filter((s,i)=>stations.findIndex(other=>other.objectId===s.objectId)===i).map(station=>({
    objectId:station.objectId,approach:copyPoint(station.position),...(station.seat&&!station.slot?{seat:copyPoint(station.seat)}:{}),
  }))};
}
