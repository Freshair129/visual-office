import {LEGACY_COORDINATE_BOUNDS,TYCOON_COORDINATE_BOUNDS} from './office-design-limits.js';

const ID_PATTERN=/^[a-zA-Z0-9_-]{1,60}$/;
const STATION_KINDS=new Set(['work-desk','desk','team-sofa','water-cooler','watercooler','water-dispenser']);
export {TYCOON_COORDINATE_BOUNDS};

function record(value,allowedKeys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowedKeys.includes(key)))
    throw Error(`${label} contains an invalid shape or unknown key`);
}

function validId(value,label){
  if(typeof value!=='string'||!ID_PATTERN.test(value))throw Error(`${label} must be a bounded identifier`);
  return value;
}

const sameBounds=(a,b)=>a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length===4&&
  a.minX===b.minX&&a.maxX===b.maxX&&a.minY===b.minY&&a.maxY===b.maxY;

export function resolveNavigationCoordinateBounds(value){
  if(value===undefined||sameBounds(value,LEGACY_COORDINATE_BOUNDS))return LEGACY_COORDINATE_BOUNDS;
  if(sameBounds(value,TYCOON_COORDINATE_BOUNDS))return TYCOON_COORDINATE_BOUNDS;
  throw Error('navigation coordinate bounds must match a supported bounded profile');
}

function validatePoint(value,label,bounds){
  record(value,['x','y'],label);
  if(Object.keys(value).length!==2||!Number.isFinite(value.x)||!Number.isFinite(value.y)||
    value.x<bounds.minX||value.x>bounds.maxX||value.y<bounds.minY||value.y>bounds.maxY){
    const range=bounds===LEGACY_COORDINATE_BOUNDS?'0..100':`${bounds.minX}..${bounds.maxX} / ${bounds.minY}..${bounds.maxY}`;
    throw Error(`${label} must use finite ${range} coordinates`);
  }
  return {x:value.x,y:value.y};
}

const samePoint=(a,b)=>a.x===b.x&&a.y===b.y;
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function onSegment(point,a,b){
  return Math.abs(cross(a,b,point))<1e-9&&point.x>=Math.min(a.x,b.x)-1e-9&&point.x<=Math.max(a.x,b.x)+1e-9&&
    point.y>=Math.min(a.y,b.y)-1e-9&&point.y<=Math.max(a.y,b.y)+1e-9;
}
function intersects(a,b,c,d){
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  if(((abC>0&&abD<0)||(abC<0&&abD>0))&&((cdA>0&&cdB<0)||(cdA<0&&cdB>0)))return true;
  return (Math.abs(abC)<1e-9&&onSegment(c,a,b))||(Math.abs(abD)<1e-9&&onSegment(d,a,b))||
    (Math.abs(cdA)<1e-9&&onSegment(a,c,d))||(Math.abs(cdB)<1e-9&&onSegment(b,c,d));
}

function validatePolygon(points,label){
  if(points.length<3||points.length>24)throw Error(`${label} must contain 3..24 points`);
  for(let i=0;i<points.length;i++){
    if(samePoint(points[i],points[(i+1)%points.length]))throw Error(`${label} has a zero-length edge`);
  }
  let twiceArea=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];twiceArea+=a.x*b.y-b.x*a.y;
  }
  if(Math.abs(twiceArea)<1e-6)throw Error(`${label} is degenerate`);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    if(j===i+1||(i===0&&j===points.length-1))continue;
    if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))
      throw Error(`${label} self-intersects`);
  }
}

function objectMap(objects){
  if(!Array.isArray(objects))return new Map();
  return new Map(objects.filter(item=>item&&typeof item.id==='string').map(item=>[item.id,item]));
}

export function validateOfficeNavigation(value,objects=[],options={}){
  if(!options||typeof options!=='object'||Array.isArray(options))throw Error('navigation options must be an object');
  const bounds=resolveNavigationCoordinateBounds(options.coordinateBounds);
  record(value,['version','routes','forbidden','stations'],'navigation');
  if(value.version!==1||!Array.isArray(value.routes)||value.routes.length>16||
    !Array.isArray(value.forbidden)||value.forbidden.length>16||
    !Array.isArray(value.stations)||value.stations.length>40)
    throw Error('navigation must be version 1 with bounded routes, forbidden areas, and stations');

  const objectById=objectMap(objects),reservedIds=new Set(objectById.keys()),routeIds=new Set();
  const routes=value.routes.map((route,index)=>{
    record(route,['id','points'],`route ${index+1}`);
    const id=validId(route.id,`route ${index+1} id`);
    if(reservedIds.has(id)||routeIds.has(id))throw Error(`route id ${id} is duplicated`);
    routeIds.add(id);
    if(!Array.isArray(route.points)||route.points.length<2||route.points.length>32)
      throw Error(`route ${id} must contain 2..32 points`);
    const points=route.points.map((point,pointIndex)=>validatePoint(point,`route ${id} point ${pointIndex+1}`,bounds));
    for(let i=1;i<points.length;i++)if(samePoint(points[i-1],points[i]))throw Error(`route ${id} has a zero-length segment`);
    return {id,points};
  });

  const forbidden=value.forbidden.map((area,index)=>{
    record(area,['id','points'],`forbidden area ${index+1}`);
    const id=validId(area.id,`forbidden area ${index+1} id`);
    if(reservedIds.has(id)||routeIds.has(id))throw Error(`forbidden id ${id} is duplicated`);
    routeIds.add(id);
    if(!Array.isArray(area.points))throw Error(`forbidden area ${id} must contain a polygon`);
    const points=area.points.map((point,pointIndex)=>validatePoint(point,`forbidden area ${id} point ${pointIndex+1}`,bounds));
    validatePolygon(points,`forbidden area ${id}`);
    return {id,points};
  });

  const stationIds=new Set();
  const stations=value.stations.map((station,index)=>{
    record(station,['objectId','approach','seat'],`station ${index+1}`);
    const objectId=validId(station.objectId,`station ${index+1} objectId`),target=objectById.get(objectId);
    if(!target)throw Error(`station ${objectId} references a missing object`);
    if(!STATION_KINDS.has(target.kind))throw Error(`station ${objectId} must reference a desk, sofa, or water cooler`);
    if(stationIds.has(objectId))throw Error(`station ${objectId} is duplicated`);
    stationIds.add(objectId);
    if(!Object.hasOwn(station,'approach'))throw Error(`station ${objectId} needs an approach point`);
    if(Object.hasOwn(station,'seat')&&['water-cooler','watercooler','water-dispenser'].includes(target.kind))
      throw Error(`station ${objectId} is a water cooler and cannot define a seat`);
    const result={objectId,approach:validatePoint(station.approach,`station ${objectId} approach`,bounds)};
    if(Object.hasOwn(station,'seat'))result.seat=validatePoint(station.seat,`station ${objectId} seat`,bounds);
    return result;
  });

  return {version:1,routes,forbidden,stations};
}

export function normalizeOfficeNavigation(value,objects=[],options={}){
  if(value===undefined||value===null)return undefined;
  try{return validateOfficeNavigation(value,objects,options);}catch{return undefined;}
}
