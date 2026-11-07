// @spec Office Tycoon v0.2 — shared metric GLB structure and local navigation.
import {defaultBlueprintPlan,validateBlueprintPlan} from './office-blueprint-state.js';
import {blueprintLayout} from './office-blueprints.js';
import {groundToWorld,worldToGround} from './office-projection.js';
import {createOfficeNavigation} from './office-navigation.js';
import {TYCOON_ASSETS} from './tycoon-models.js';
import {TYCOON_BLUEPRINT_OPTIONS,TYCOON_COORDINATE_BOUNDS} from './office-design-limits.js';
const copy=v=>JSON.parse(JSON.stringify(v));
export const TYCOON_BUNDLED_CHAIR_SEAT_HEIGHT_M=0.4792452947742871;
export const TYCOON_BUNDLED_SOFA_SEAT_HEIGHT_M=0.4749999706827424;
// Legacy authoring map is centred at (-2,-2); GLB world is centred at (0,0).
// Keep this translation at the boundary so saved plans and navigation stay reusable.
export const tycoonGround=p=>worldToGround({x:p.x-2,z:p.z-2});
export const tycoonWorld=p=>{const v=groundToWorld(p);v.x+=2;v.z+=2;return v;};
export function tycoonPlan(room){
 if(room.blueprintPlan)return validateBlueprintPlan(room.blueprintPlan,TYCOON_BLUEPRINT_OPTIONS);
 const plan=defaultBlueprintPlan('medium');plan.width=room.width;plan.depth=room.depth;plan.originX=-room.width/2-2;plan.originZ=-room.depth/2-2;
 plan.windows=plan.windows.filter(w=>w.offset+w.width<plan.width-.2);return validateBlueprintPlan(plan);
}
export function applyTycoonPlan(room,plan){const clean=validateBlueprintPlan(plan,TYCOON_BLUEPRINT_OPTIONS);return {...copy(room),width:clean.width,depth:clean.depth,blueprintPlan:clean};}
export function tycoonEditorRoom(room){return {background:'office',blueprint:tycoonPlan(room).base,blueprintPlan:tycoonPlan(room),navigation:room.navigation,objects:room.objects.map(o=>({...o,kind:o.kind==='custom'?(o.asset.interaction.mode==='seat'?'team-sofa':o.asset.interaction.mode==='stand'?'water-cooler':'custom'):({sofa:'team-sofa',coffee:'water-cooler',chair:'task-chair'})[o.kind]||o.kind,...tycoonGround(o),tycoon:o}))};}
export function tycoonFootprint(o,padding=0){
 const size=o.asset?[o.asset.size[0],o.asset.size[2]]:TYCOON_ASSETS[o.kind]?.footprint||[.5,.5],c=Math.cos(o.rotation),s=Math.sin(o.rotation),w=size[0]*o.scale/2+padding,d=size[1]*o.scale/2+padding;
 return [[-w,-d],[w,-d],[w,d],[-w,d]].map(([x,z])=>tycoonGround({x:o.x+c*x+s*z,z:o.z-s*x+c*z}));
}
export function tycoonStructure(room){
 if(!room.blueprintPlan&&(room.width<8||room.width>16||room.depth>10))return [
  {id:'floor',kind:'floor',y:-.1,size:[room.width,1,room.depth]},
  {id:'legacy-rear',kind:'wall',z:-room.depth/2,size:[room.width,1,1]},
  {id:'legacy-left',kind:'wall',x:-room.width/2,rotation:Math.PI/2,size:[room.depth,1,1]},
  {id:'legacy-front',kind:'wall',z:room.depth/2,size:[room.width,.23,1]},
  {id:'legacy-right',kind:'wall',x:room.width/2,rotation:Math.PI/2,size:[room.depth,.23,1]},
 ];
 const plan=tycoonPlan(room),layout=blueprintLayout(plan,TYCOON_BLUEPRINT_OPTIONS),items=[{id:'floor',kind:'floor',x:plan.originX+plan.width/2+2,z:plan.originZ+plan.depth/2+2,y:-.1,size:[plan.width,1,plan.depth]}];
 const part=(id,kind,x,y,z,width,height,depth,rotation=0,intent)=>{const size=TYCOON_ASSETS[kind].size;items.push({id,kind,x,y,z,size:[width/size[0],height/size[1],depth/size[2]],rotation,intent});};
 for(const wall of layout.walls){
  const a=tycoonWorld({x:wall.start[0],y:wall.start[1]}),b=tycoonWorld({x:wall.end[0],y:wall.end[1]}),length=a.distanceTo(b),angle=-Math.atan2(b.z-a.z,b.x-a.x),ux=(b.x-a.x)/length,uz=(b.z-a.z)/length;
  const span=(suffix,start,end,bottom,top)=>{if(end-start<.001||top-bottom<.001)return;const u=(start+end)/2;part(`wall:${wall.id}:${suffix}`,'wall',a.x+ux*u,bottom,a.z+uz*u,end-start,top-bottom,.2,angle);};
  let cursor=0;
  for(const [i,w] of [...wall.windows].sort((x,y)=>x.fraction-y.fraction).entries()){
   const start=w.fraction*length-w.width/2,end=start+w.width;span(`solid-${i}`,cursor,start,0,wall.height);span(`sill-${i}`,start,end,0,w.sill);span(`header-${i}`,start,end,w.top,wall.height);
   const u=(start+end)/2;part(`window:${w.id}`,'window',a.x+ux*u,w.sill,a.z+uz*u,w.width,w.top-w.sill,.2,angle);cursor=end;
  }span('end',cursor,length,0,wall.height);
 }
 for(const door of layout.doors){
  const a=tycoonWorld({x:door.start[0],y:door.start[1]}),b=tycoonWorld({x:door.end[0],y:door.end[1]}),angle=-Math.atan2(b.z-a.z,b.x-a.x),x=(a.x+b.x)/2,z=(a.z+b.z)/2;
  part(`door:${door.id}:frame`,'door-frame',x,0,z,door.widthMeters+.16,2.35,.2,angle,'door');
  if(!door.open)part(`door:${door.id}:panel`,'door',x,0,z,door.widthMeters,2.2,.06,angle,'door');
 }
 return items;
}
const distance=(a,b)=>groundToWorld(a).distanceTo(groundToWorld(b));
const TYCOON_NAVIGATION_CACHE_LIMIT=8;
const tycoonNavigationCache=new Map();

function stableNavigationValue(value,stack=new WeakSet()){
 if(value===null)return ['null'];
 const type=typeof value;
 if(type==='undefined')return ['undefined'];
 if(type==='number')return ['number',Number.isNaN(value)?'NaN':Object.is(value,-0)?'-0':String(value)];
 if(type==='string'||type==='boolean')return [type,value];
 if(type==='bigint')return ['bigint',String(value)];
 if(type!=='object')throw Error('Navigation cache input is not serializable');
 if(stack.has(value))throw Error('Navigation cache input is cyclic');
 stack.add(value);
 const result=Array.isArray(value)
  ?['array',value.map(child=>stableNavigationValue(child,stack))]
  :['object',Object.keys(value).sort().map(key=>[key,stableNavigationValue(value[key],stack)])];
 stack.delete(value);
 return result;
}

function tycoonNavigationCacheKey(room){
 try{
  const objects=(Array.isArray(room?.objects)?room.objects:[]).map(object=>{
   if(!object||typeof object!=='object')return object;
   const geometry={id:object.id,kind:object.kind};
   // Actor poses are transient and do not affect navigation. Keep their IDs and order
   // because authored navigation validates IDs against the room inventory.
   if(object.kind!=='actor')Object.assign(geometry,{x:object.x,y:object.y,z:object.z,rotation:object.rotation,scale:object.scale,asset:object.asset});
   return geometry;
  });
  return JSON.stringify(stableNavigationValue({
   width:room?.width,depth:room?.depth,plan:room?.blueprintPlan,navigation:room?.navigation,objects,
  }));
 }catch{return null;}
}

function cloneNavigationMetadata(value){
 if(Array.isArray(value))return value.map(cloneNavigationMetadata);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,cloneNavigationMetadata(child)]));
 return value;
}

function copyTycoonNavigation(nav){
 return Object.fromEntries(Object.entries(nav).map(([key,value])=>[key,typeof value==='function'?value:cloneNavigationMetadata(value)]));
}

function cacheTycoonNavigation(key,nav){
 if(key===null)return nav;
 const cached=copyTycoonNavigation(nav);
 tycoonNavigationCache.delete(key);
 tycoonNavigationCache.set(key,cached);
 while(tycoonNavigationCache.size>TYCOON_NAVIGATION_CACHE_LIMIT)tycoonNavigationCache.delete(tycoonNavigationCache.keys().next().value);
 return copyTycoonNavigation(cached);
}

export function createTycoonNavigation(room){
 const key=tycoonNavigationCacheKey(room),cached=key===null?null:tycoonNavigationCache.get(key);
 if(cached){tycoonNavigationCache.delete(key);tycoonNavigationCache.set(key,cached);return copyTycoonNavigation(cached);}
 return cacheTycoonNavigation(key,buildTycoonNavigation(room));
}

function buildTycoonNavigation(room){
 const adapted=tycoonEditorRoom(room),blockers=room.objects.filter(o=>o.kind!=='actor').map(o=>({id:o.id,objectId:o.id,kind:o.kind,type:'prop',center:tycoonGround(o),polygon:tycoonFootprint(o,o.kind==='desk' ? .28 : o.kind==='chair'||o.kind==='custom'&&o.asset?.category==='chair' ? .45 : .3).map(p=>[p.x,p.y])}));
 const barrier=(id,start,end,radius)=>{const a=tycoonWorld(start),b=tycoonWorld(end),length=a.distanceTo(b),ux=(b.x-a.x)/length,uz=(b.z-a.z)/length;if(!length)return;const points=[[-.3,-radius],[length+.3,-radius],[length+.3,radius],[-.3,radius]].map(([u,v])=>tycoonGround({x:a.x+ux*u-uz*v,z:a.z+uz*u+ux*v}));blockers.push({id,objectId:id,kind:'architecture',type:'architecture',center:tycoonGround({x:(a.x+b.x)/2,z:(a.z+b.z)/2}),polygon:points.map(p=>[p.x,p.y])});};
  const plan=tycoonPlan(room),layout=blueprintLayout(plan,TYCOON_BLUEPRINT_OPTIONS);
 for(const wall of [...layout.walls,...layout.closedDoors])barrier(`metric-wall-${wall.id}`,{x:wall.start[0],y:wall.start[1]},{x:wall.end[0],y:wall.end[1]},wall.widthMeters?.33:.4);
 for(const area of room.navigation?.forbidden||[])area.points.forEach((p,i)=>barrier(`metric-area-${area.id}-${i}`,p,area.points[(i+1)%area.points.length],.3));
  const nav=createOfficeNavigation(adapted,{objectBlockers:blockers,coordinateBounds:TYCOON_COORDINATE_BOUNDS,blueprintOptions:TYCOON_BLUEPRINT_OPTIONS}),used=new Set(),seeds=[];
 nav.stations.length=0; // This metric adapter owns all station geometry.
  // Pick a walkable origin before stations so generated approaches can be
  // checked for connectivity, not only local clearance.
  for(let z=plan.depth-.6;z>=.6;z-=1)for(let x=.6;x<plan.width-.5;x+=1){const p=tycoonGround({x:plan.originX+x+2,z:plan.originZ+z+2});if(nav.isWalkable(p))seeds.push(p);}
  nav.spawnPoint=seeds[0];
 const reachability=new Map(),connected=p=>{if(!nav.spawnPoint)return true;const key=`${p.x},${p.y}`;if(!reachability.has(key))reachability.set(key,nav.findLocalPath(nav.spawnPoint,p).length>0);return reachability.get(key);};
 const inside=(point,o)=>{const v=tycoonWorld(point),dx=v.x-o.x,dz=v.z-o.z,c=Math.cos(o.rotation),s=Math.sin(o.rotation),size=o.asset?[o.asset.size[0],o.asset.size[2]]:TYCOON_ASSETS[o.kind].footprint;return Math.abs(c*dx-s*dz)<=size[0]*o.scale/2&&Math.abs(s*dx+c*dz)<=size[1]*o.scale/2;};
  for(const o of room.objects.filter(o=>['desk','sofa','coffee'].includes(o.kind))){
  const custom=room.navigation?.stations.find(s=>s.objectId===o.id),chair=o.kind==='desk'?room.objects.filter(c=>(c.kind==='chair'||(c.asset?.category==='chair'&&c.asset.interaction.mode==='seat'))&&!used.has(c.id)&&Math.hypot(c.x-o.x,c.z-o.z)<2).sort((a,b)=>Math.hypot(a.x-o.x,a.z-o.z)-Math.hypot(b.x-o.x,b.z-o.z))[0]:null;
  const seatObject=chair||(o.kind==='sofa'?o:null),anchor=chair?.asset?.interaction?.seat;
  const localAnchor=(object,p)=>tycoonGround({x:object.x+(Math.cos(object.rotation)*p[0]+Math.sin(object.rotation)*p[1])*object.scale,z:object.z+(-Math.sin(object.rotation)*p[0]+Math.cos(object.rotation)*p[1])*object.scale});
  const chairSeat=anchor?localAnchor(chair,anchor):null,chairApproach=chair?.asset?.interaction?.approach?localAnchor(chair,chair.asset.interaction.approach):null;
  const seat=custom?.seat||chairSeat||(seatObject?tycoonGround(seatObject):null),candidates=[];
  const center=seat||tycoonGround(o),world=tycoonWorld(center);
  let front=null;
  if(seatObject){
   // A custom seat's authored facing is independent of a rear/side entry point.
   if(chair?.asset?.interaction)front={x:Math.sin(chair.rotation+chair.asset.interaction.heading),z:Math.cos(chair.rotation+chair.asset.interaction.heading)};
   if(!front&&chairApproach){const p=tycoonWorld(chairApproach),length=Math.hypot(p.x-world.x,p.z-world.z);if(length>.01)front={x:(p.x-world.x)/length,z:(p.z-world.z)/length};}
   if(!front&&chair){const dx=o.x-chair.x,dz=o.z-chair.z,length=Math.hypot(dx,dz);front=length>.01?{x:dx/length,z:dz/length}:{x:-Math.sin(chair.rotation),z:-Math.cos(chair.rotation)};}
   if(!front)front={x:Math.sin(seatObject.rotation),z:Math.cos(seatObject.rotation)};
  }
  let frontApproach=null,footAnchor=null;
  let seatRoot=null;
  if(front&&seatObject){const size=seatObject.asset?[seatObject.asset.size[0],seatObject.asset.size[2]]:TYCOON_ASSETS[seatObject.kind]?.footprint||[.5,.5],c=Math.cos(seatObject.rotation),s=Math.sin(seatObject.rotation),xProjection=front.x*c-front.z*s,zProjection=front.x*s+front.z*c,extent=(Math.abs(xProjection)*size[0]+Math.abs(zProjection)*size[1])*seatObject.scale/2,seatFromCenter=tycoonWorld(tycoonGround(seatObject)),seatFrontDistance=Math.max(0,extent-(world.x-seatFromCenter.x)*front.x-(world.z-seatFromCenter.z)*front.z),importedSeat=seatObject.asset?.interaction?.mode==='seat',seatRootDistance=importedSeat ? .215 : seatObject.kind==='chair' ? .23 : Math.min(.38,seatFrontDistance+.08),footMargin=importedSeat ? .18 : .26;footAnchor=tycoonGround({x:world.x+front.x*(seatFrontDistance+footMargin),z:world.z+front.z*(seatFrontDistance+footMargin)});seatRoot=tycoonGround({x:world.x+front.x*seatRootDistance,z:world.z+front.z*seatRootDistance});const approachMargin=(o.kind==='desk'&&chair?.asset?.interaction?.mode==='seat') ? .26 : .45,distance=seatFrontDistance+approachMargin;frontApproach=tycoonGround({x:world.x+front.x*distance,z:world.z+front.z*distance});}
  if(seatObject&&front){
   const objectCenter=tycoonWorld(tycoonGround(seatObject)),size=seatObject.asset?[seatObject.asset.size[0],seatObject.asset.size[2]]:TYCOON_ASSETS[seatObject.kind]?.footprint||[.5,.5],side={x:front.z,z:-front.x},c=Math.cos(seatObject.rotation),s=Math.sin(seatObject.rotation);
   const extentAlong=direction=>{const xProjection=direction.x*c-direction.z*s,zProjection=direction.x*s+direction.z*c;return (Math.abs(xProjection)*size[0]+Math.abs(zProjection)*size[1])*seatObject.scale/2;};
   for(const direction of [front,side,{x:-side.x,z:-side.z},{x:-front.x,z:-front.z}]){const extent=extentAlong(direction),point=tycoonGround({x:objectCenter.x+direction.x*(extent+.45),z:objectCenter.z+direction.z*(extent+.45)});candidates.push(point);}
   for(const sign of [-1,1]){const lateral={x:side.x*sign,z:side.z*sign},sideOffset=extentAlong(lateral)+.32,frontOffset=extentAlong(front)+.02;candidates.push(tycoonGround({x:objectCenter.x+lateral.x*sideOffset+front.x*frontOffset,z:objectCenter.z+lateral.z*sideOffset+front.z*frontOffset}));if(o.kind==='desk'&&seatObject){const deskSize=o.asset?[o.asset.size[0],o.asset.size[2]]:TYCOON_ASSETS[o.kind].footprint,deskProjectionX=lateral.x*Math.cos(o.rotation)-lateral.z*Math.sin(o.rotation),deskProjectionZ=lateral.x*Math.sin(o.rotation)+lateral.z*Math.cos(o.rotation),deskExtent=(Math.abs(deskProjectionX)*deskSize[0]+Math.abs(deskProjectionZ)*deskSize[1])*o.scale/2,deskCenter=tycoonWorld(tycoonGround(o)),seatToDesk=(deskCenter.x-objectCenter.x)*lateral.x+(deskCenter.z-objectCenter.z)*lateral.z,deskOutside=Math.max(0,seatToDesk)+deskExtent+.31,outerOffset=Math.max(extentAlong(lateral)+.6,deskOutside);candidates.push(tycoonGround({x:objectCenter.x+lateral.x*outerOffset,z:objectCenter.z+lateral.z*outerOffset}));candidates.push(tycoonGround({x:objectCenter.x+lateral.x*outerOffset+front.x*frontOffset,z:objectCenter.z+lateral.z*outerOffset+front.z*frontOffset}));}}
  }else for(const radius of [.85,1.1,1.5,2])for(let i=0;i<16;i++){const angle=i*Math.PI/8;candidates.push(tycoonGround({x:world.x+Math.cos(angle)*radius,z:world.z+Math.sin(angle)*radius}));}
  const ignored=seatObject?[seatObject.id]:[],seatEntry=seatRoot||seat;
  const clearApproach=p=>!!p&&nav.isWalkable(p)&&(!seatEntry||nav.isSegmentWalkable(p,seatEntry,{ignoreIds:ignored}));
  const reachableApproach=p=>clearApproach(p)&&(!footAnchor||distance(p,footAnchor)<=(o.kind==='desk'&&seatObject?1.4:.84))&&connected(p);
   const explicitApproach=custom?.approach||null,anchoredApproach=chairApproach&&reachableApproach(chairApproach)?chairApproach:null;
  const preferredApproach=frontApproach&&reachableApproach(frontApproach)?frontApproach:null;
  const directionScore=p=>{if(!front)return distance(p,center);const v=tycoonWorld(p),dx=v.x-world.x,dz=v.z-world.z,length=Math.hypot(dx,dz)||1;return distance(p,center)+.7*(1-(dx*front.x+dz*front.z)/length);};
  const roomCenter={x:plan.originX+plan.width/2+2,z:plan.originZ+plan.depth/2+2},boundaryClearance=p=>{const v=tycoonWorld(p);return Math.min(plan.width/2-Math.abs(v.x-roomCenter.x),plan.depth/2-Math.abs(v.z-roomCenter.z));};
  const approachOrder=(a,b)=>{const difference=directionScore(a)-directionScore(b);if(Math.abs(difference)>1e-6)return difference;const clearanceDifference=boundaryClearance(b)-boundaryClearance(a);if(Math.abs(clearanceDifference)>1e-6)return clearanceDifference;if(front){const lateral=p=>{const v=tycoonWorld(p);return (v.x-world.x)*front.z-(v.z-world.z)*front.x;},lateralDifference=lateral(b)-lateral(a);if(Math.abs(lateralDifference)>1e-6)return lateralDifference;}const pa=tycoonWorld(a),pb=tycoonWorld(b);return pa.x-pb.x||pa.z-pb.z;};
   const approachLimit=o.kind==='desk'&&seatObject?1.4:.84,potentialApproach=p=>clearApproach(p)&&(!footAnchor||distance(p,footAnchor)<=approachLimit),prefersDeskClearance=o.kind==='desk'&&!!chair?.asset?.interaction;
   const existingApproach=explicitApproach||(prefersDeskClearance?(preferredApproach||anchoredApproach):(anchoredApproach||preferredApproach))||(()=>candidates.filter(potentialApproach).sort(approachOrder).find(connected))();
   const fallbackApproach=()=>{
    if(existingApproach||explicitApproach||o.kind!=='desk'||!seatObject||!footAnchor||!front)return null;
    // Keep the existing choice when it works; larger measured chairs can leave
    // a narrow connected entry band between the finite authored candidates.
    const objectCenter=tycoonWorld(tycoonGround(seatObject)),anchorRadius=distance(footAnchor,tycoonGround(seatObject)),maxRadius=Math.min(1.7,approachLimit+anchorRadius),points=new Map();
    for(let radius=.75;radius<=maxRadius+1e-8;radius+=.05)for(let i=0;i<32;i++){
     const angle=i*Math.PI/16,p=tycoonGround({x:objectCenter.x+Math.cos(angle)*radius,z:objectCenter.z+Math.sin(angle)*radius}),key=`${p.x},${p.y}`;
     if(!points.has(key)&&potentialApproach(p))points.set(key,p);
    }
    return [...points.values()].sort(approachOrder).find(connected)||null;
   };
   const approach=existingApproach||fallbackApproach();
  const problem=o.kind==='desk'&&!chair?'ต้องมีเก้าอี้ใกล้โต๊ะภายใน 2 ม.':!approach||!reachableApproach(approach)?'จุดเข้าถึงถูกกีดขวาง':seat&&(!seatObject||seatObject.y>.05||!inside(seat,seatObject)||!nav.isWalkable(seat,{ignoreIds:ignored})||!nav.isSegmentWalkable(approach,seatEntry,{ignoreIds:ignored}))?'จุดนั่งต้องอยู่บนเก้าอี้หรือโซฟาที่ตั้งบนพื้นและเข้าถึงได้':null;
  if(problem){nav.issues.push({objectId:o.id,message:problem});continue;}
  if(chair)used.add(chair.id);
  const heading=custom?.heading??(chair?.asset?.interaction?chair.rotation+(chair.asset.interaction.heading||0):front?Math.atan2(front.x,front.z):(seatObject?.rotation||0)+(seatObject?.kind==='chair'?Math.PI:0));
  nav.stations.push({id:`station:${o.id}`,objectId:o.id,type:o.kind==='coffee'?'water':o.kind,position:approach,...seat?{seat,seatRoot,seatObjectId:seatObject.id,seatHeight:(seatObject.y||0)+(seatObject.asset?seatObject.asset.interaction.height:seatObject.kind==='chair'?TYCOON_BUNDLED_CHAIR_SEAT_HEIGHT_M:TYCOON_BUNDLED_SOFA_SEAT_HEIGHT_M)*seatObject.scale,footAnchor}:{},heading});
 }
 for(const o of room.objects.filter(o=>o.kind==='custom'&&o.asset.interaction.mode!=='none')){
  const interaction=o.asset.interaction,authored=room.navigation?.stations.find(s=>s.objectId===o.id),c=Math.cos(o.rotation),s=Math.sin(o.rotation);
  const local=p=>tycoonGround({x:o.x+(c*p[0]+s*p[1])*o.scale,z:o.z+(-s*p[0]+c*p[1])*o.scale});
  const approach=authored?.approach||local(interaction.approach),seat=interaction.mode==='seat'?(authored?.seat||local(interaction.seat)):null,ignoreIds=seat?[o.id]:[];
  const seatWorld=seat&&tycoonWorld(seat),dx=seatWorld?seatWorld.x-o.x:0,dz=seatWorld?seatWorld.z-o.z:0;
  const within=!seat||(Math.abs(c*dx-s*dz)<=o.asset.size[0]*o.scale/2&&Math.abs(s*dx+c*dz)<=o.asset.size[2]*o.scale/2);
  if(o.y>.05||!nav.isWalkable(approach)||!within||(seat&&(!nav.isWalkable(seat,{ignoreIds})||!nav.isSegmentWalkable(approach,seat,{ignoreIds})))){nav.issues.push({objectId:o.id,message:'จุดใช้งาน custom ถูกกีดขวางหรืออยู่นอกโมเดลที่ตั้งบนพื้น'});continue;}
  let footAnchor=null;
  let seatRoot=null;
  if(seat){const front={x:Math.sin(o.rotation+(interaction.heading||0)),z:Math.cos(o.rotation+(interaction.heading||0))},width=o.asset.size[0]*o.scale,depth=o.asset.size[2]*o.scale,frontExtent=(Math.abs(front.x*Math.cos(o.rotation)-front.z*Math.sin(o.rotation))*width+Math.abs(front.x*Math.sin(o.rotation)+front.z*Math.cos(o.rotation))*depth)/2,seatCenter=tycoonWorld(tycoonGround(o)),seatFrontDistance=Math.max(0,frontExtent-(seatWorld.x-seatCenter.x)*front.x-(seatWorld.z-seatCenter.z)*front.z),seatRootDistance=.215;footAnchor=tycoonGround({x:seatWorld.x+front.x*(seatFrontDistance+.18),z:seatWorld.z+front.z*(seatFrontDistance+.18)});seatRoot=tycoonGround({x:seatWorld.x+front.x*seatRootDistance,z:seatWorld.z+front.z*seatRootDistance});}
  nav.stations.push({id:`station:${o.id}`,objectId:o.id,type:seat?'sofa':'water',position:approach,...seat?{seat,seatRoot,seatObjectId:o.id,seatHeight:o.y+interaction.height*o.scale,footAnchor}:{},heading:o.rotation+(interaction.heading||0)});
 }
 nav.suggestRoute=()=>{if(!seeds.length)return [];const ordered=seeds.slice(1).sort((a,b)=>distance(seeds[0],b)-distance(seeds[0],a));for(const end of ordered.slice(0,12)){const path=nav.findLocalPath(seeds[0],end);if(path.length>1)return path;}return [];};
 nav.distance=distance;return nav;
}
