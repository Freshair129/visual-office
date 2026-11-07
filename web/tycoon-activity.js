// Local simulation only. No business roster, role, or run state is written.
import {createTycoonNavigation,tycoonPlan,tycoonGround,tycoonWorld,applyTycoonPlan} from './tycoon-blueprint.js';
import {TYCOON_ASSETS} from './tycoon-models.js';
import {TYCOON_BLUEPRINT_OPTIONS} from './office-design-limits.js';
import {blueprintDoorOccupied,blueprintLayout} from './office-blueprints.js';
import {toggleBlueprintDoor} from './office-blueprint-state.js';
const copy=p=>({x:p.x,y:p.y});
const footprintSize=o=>o.asset?[o.asset.size[0],o.asset.size[2]]:TYCOON_ASSETS[o.kind]?.footprint||[.5,.5];
function footprintClearance(point,object){
 const p=tycoonWorld(point),dx=p.x-object.x,dz=p.z-object.z,c=Math.cos(object.rotation),s=Math.sin(object.rotation),x=c*dx-s*dz,z=s*dx+c*dz,size=footprintSize(object),outsideX=Math.max(0,Math.abs(x)-size[0]*object.scale/2),outsideZ=Math.max(0,Math.abs(z)-size[1]*object.scale/2);
 return Math.hypot(outsideX,outsideZ);
}
function segmentClearOfFootprint(a,b,object,margin=.12){
 const from=tycoonWorld(a),to=tycoonWorld(b),steps=Math.max(1,Math.ceil(from.distanceTo(to)/.04));
 for(let i=0;i<=steps;i++){const t=i/steps,p=tycoonGround({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t});if(footprintClearance(p,object)<margin)return false;}
 return true;
}
// A walkable root alone can leave a planted leg beside a wall end. Reserve
// room for the final foot adjustment before choosing a desk departure endpoint.
function canSettleAt(nav,point){
 if(!nav.isWalkable(point))return false;
 const center=tycoonWorld(point),margin=.20;
 for(let i=0;i<16;i++){const angle=i*Math.PI/8;if(!nav.isWalkable(tycoonGround({x:center.x+Math.cos(angle)*margin,z:center.z+Math.sin(angle)*margin})))return false;}
 return true;
}
export function canTycoonWalk(room,point){try{return createTycoonNavigation(room).isWalkable(tycoonGround(point));}catch{return false;}}
export function changeTycoonDoor(room,id,positions=[]){
 try{const plan=tycoonPlan(room),door=blueprintLayout(plan,TYCOON_BLUEPRINT_OPTIONS).doors.find(d=>d.id===id);if(!door)throw Error('ไม่พบประตู');
  if(door.open&&blueprintDoorOccupied(plan,id,positions,TYCOON_BLUEPRINT_OPTIONS))return {ok:false,message:'มีตัวละครอยู่ตรงประตู · ให้เดินพ้นหรือหยุดทดสอบก่อน'};
  return {ok:true,room:applyTycoonPlan(room,toggleBlueprintDoor(plan,id,TYCOON_BLUEPRINT_OPTIONS)),message:door.open?'ปิดประตูแล้ว':'เปิดประตูแล้ว'};
 }catch(error){return {ok:false,message:error.message};}
}
export class TycoonActivity{
 constructor(room,{onStatus}={}){this.onStatus=onStatus;this.reservations=new Set();this.setRoom(room);}
 setRoom(room){this.stop();this.room=room;this.nav=createTycoonNavigation(room);}
 get positions(){return this.snapshot?[this.snapshot.position]:[];}
 say(message){this.onStatus?.(message);return message;}
 stop(){this.snapshot=null;this.path=[];this.station=null;this.approachStage=null;this.seatApproachTotalM=0;this.seatApproachTravelledM=0;this.reservations.clear();this.phase='idle';this.elapsed=0;this.poseReady=undefined;this.headingReady=undefined;this.entryFeetReady=undefined;this.workContactReady=undefined;this.transitArmsReady=undefined;this.settleFeetReady=undefined;this.departureFeetReady=undefined;}
 blockMotion(message,position,heading){
  if(!this.snapshot)return this.say(message);
  if(position)this.snapshot.position=copy(position);if(Number.isFinite(heading))this.snapshot.heading=heading;
  this.snapshot.clip='idle';this.snapshot.status=message;this.phase='blocked';this.path=[];this.index=0;this.station=null;this.reservations.clear();this.elapsed=0;this.poseReady=false;this.headingReady=undefined;this.entryFeetReady=undefined;this.departureFeetReady=undefined;
  return this.say(message);
 }
 startRoute(points){
  this.stop();if(!Array.isArray(points)||points.length<2||points.some(p=>!this.nav.isWalkable(p)))return {ok:false,message:this.say('จุดเริ่มหรือปลายทางถูกกีดขวาง · ย้ายจุดก่อนทดสอบ')};
  let path=[copy(points[0])];for(let i=1;i<points.length;i++){const leg=this.nav.findLocalPath(points[i-1],points[i]);if(leg.length<2)return {ok:false,message:this.say('ไม่มีเส้นทางผ่านได้ · ตรวจผนัง ประตู และพื้นที่ห้ามเดิน')};path.push(...leg.slice(1));}
  this.begin(path);return {ok:true,message:this.say('กำลังลองเดินในฉาก GLB · ใช้ผนังและประตูจริง')};
 }
 begin(path){this.path=path.map(copy);this.index=1;this.phase='walking';this.elapsed=0;this.snapshot={position:copy(path[0]),heading:0,clip:'walk',status:'กำลังเดิน'};}
 startStation(id,{startPoint}={}){
  const previous=startPoint===undefined?this.snapshot?.position:startPoint,captured=previous?copy(previous):previous;this.stop();const station=this.nav.stations.find(s=>s.id===id||s.objectId===id);
  if(!station)return {ok:false,message:this.say('จุดนั่งหรือจุดเข้าถึงไม่ปลอดภัย · ตรวจตำแหน่งก่อนทดสอบ')};
  const candidates=(captured?[captured]:[this.nav.spawnPoint]).filter(p=>p&&this.nav.isWalkable(p));
   let path;for(const start of candidates){const route=this.nav.findLocalPath(start,station.position);if(route.length){path=route.length===1?[route[0],route[0]]:route;break;}}
  if(!path)return {ok:false,message:this.say('ไปยังจุดใช้งานไม่ได้ · เปิดประตูหรือแก้ทางเดิน')};
  this.station=station;this.approachStage=null;this.workContactReady=undefined;this.reservations.add(station.seatObjectId||station.objectId);this.begin(path);
  return {ok:true,message:this.say('กำลังทดสอบเข้าจุดใช้งาน → นั่ง / พัก → ลุกกลับ')};
 }
  transition(phase,clip,status){this.phase=phase;this.elapsed=0;this.departureFeetReady=undefined;Object.assign(this.snapshot,{clip,status,seatHeight:['entering','sit','working','standing'].includes(phase)?(this.station?.seatHeight??.551132):null});this.say(status);}
 tick(dt){
  if(!this.snapshot||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);this.elapsed+=dt;
  if(this.phase==='settling'){if(this.poseReady!==false&&this.settleFeetReady!==false)this.finish();return;}
  if(this.phase==='walking'&&this.transitArmsReady===false){this.snapshot.clip='idle';this.snapshot.status='เตรียมท่าแขนก่อนเดิน';return;}
  if(this.phase==='walking'&&this.snapshot.status==='เตรียมท่าแขนก่อนเดิน'){this.snapshot.clip='walk';this.snapshot.status='เดินไปจุดใช้งาน';}
  if(this.phase==='entering'&&this.entryFeetReady===false){this.snapshot.heading=this.station?.heading??this.snapshot.heading;return;}
  // The physical scene latches this only after a swept, two-foot transfer.
  if(this.phase==='leaving'&&this.departureFeetReady===false){this.snapshot.heading=this.station?.heading??this.snapshot.heading;return;}
  if(this.phase==='turning'){
   this.snapshot.heading=this.station?.heading??this.snapshot.heading;
   if(this.elapsed>=.55&&this.poseReady!==false&&this.headingReady!==false){const current=this.snapshot.position,ignore=[this.station?.seatObjectId,this.station?.objectId].filter(Boolean);if(this.station?.type==='desk'&&this.station.seatRoot&&this.station.seat&&this.station.footAnchor){const root=tycoonWorld(this.station.seatRoot),seat=tycoonWorld(this.station.seat),foot=tycoonWorld(this.station.footAnchor),front=foot.sub(seat).setY(0).normalize(),outerWorld={x:root.x+front.x*.06,z:root.z+front.z*.06},outer=tycoonGround(outerWorld),deskSide=tycoonGround({x:tycoonWorld(current).x,z:outerWorld.z}),path=[copy(current),deskSide,outer,copy(this.station.seatRoot)];if(!path.slice(1).every((p,i)=>this.nav.isSegmentWalkable(path[i],p,{ignoreIds:ignore})))return this.blockMotion('ไม่มีทางจัดแนวหน้าที่นั่งอย่างปลอดภัย',current,this.station.heading);this.approachStage='desk-side-align';this.path=path;this.index=1;this.seatApproachTotalM=path.slice(1).reduce((sum,p,i)=>sum+tycoonWorld(p).distanceTo(tycoonWorld(path[i])),0);this.seatApproachTravelledM=0;this.snapshot.seatApproachBlend=0;this.transition('approaching-seat','walk','จัดตำแหน่งที่ด้านหน้าโต๊ะ');}else{const anchor=this.station?.footAnchor;if(!anchor||!this.nav.isSegmentWalkable(current,anchor,{ignoreIds:ignore}))return this.blockMotion('ไม่มีตำแหน่งจัดแนวหน้าที่นั่งอย่างปลอดภัย',current,this.station?.heading);this.approachStage='front-align';this.path=[copy(current),copy(anchor)];this.index=1;this.transition('walking','walk','หันหน้าเข้าหาที่นั่งแล้ว');}}
   else if(this.elapsed>2.5&&this.poseReady===false)return this.blockMotion('ไม่สามารถจัดแนวเท้าและทิศทางก่อนนั่งได้',this.snapshot.position,this.station?.heading);
   return;
  }
  if(this.phase==='standing'&&this.station?.seat&&this.station.footAnchor){
   const seat=tycoonWorld(this.station.seatRoot||this.station.seat),anchor=tycoonWorld(this.station.footAnchor),dx=anchor.x-tycoonWorld(this.station.seat).x,dz=anchor.z-tycoonWorld(this.station.seat).z,length=Math.hypot(dx,dz),front={x:dx/length,z:dz/length},standingAdvance=this.station.type==='desk'?.08:.28,target=tycoonGround({x:seat.x+front.x*standingAdvance,z:seat.z+front.z*standingAdvance}),position=this.snapshot.position,from=tycoonWorld(position),to=tycoonWorld(target),distance=from.distanceTo(to);
   const maxStep=dt*.35;
   // Navigation still blocks the desk; current-frame limb sweeps decide physical clearance.
   const step=Math.min(distance,maxStep),world=distance<1e-7?to:from.clone().lerp(to,step/distance),next=tycoonGround(world);
   if(distance>1e-7&&this.nav.isSegmentWalkable(position,next,{ignoreIds:[this.station.seatObjectId].filter(Boolean)}))this.snapshot.position=next;
   this.snapshot.heading=this.station.heading;
  }
  if(['walking','approaching-seat','entering','leaving'].includes(this.phase)){
   const next=this.path[this.index],position=this.snapshot.position;
   if(!next)return this.arrive();const a=tycoonWorld(position),b=tycoonWorld(next),distance=a.distanceTo(b),step=Math.min(distance,dt*.85),world=distance<1e-7?b:a.clone().lerp(b,step/distance),p=tycoonGround(world);
    const terminalCorridor=['front-corner','front-align','seat-entry','desk-side-align'].includes(this.approachStage),ignoreIds=(this.phase==='walking'&&terminalCorridor)||(this.phase==='entering'&&['seat-entry','desk-side-align'].includes(this.approachStage))?[this.station?.seatObjectId,this.station?.objectId].filter(Boolean):[this.station?.seatObjectId].filter(Boolean);
   if(!this.nav.isSegmentWalkable(position,p,{ignoreIds})){this.stop();this.say('หยุดแล้ว · เส้นทางเปลี่ยนหรือมีสิ่งกีดขวาง');return;}
    this.snapshot.heading=(['approaching-seat','entering','leaving'].includes(this.phase)||['front-align','desk-approach','desk-side-align'].includes(this.approachStage))&&Number.isFinite(this.station?.heading)?this.station.heading:Math.atan2(b.x-a.x,b.z-a.z);this.snapshot.position=p;if(this.phase==='approaching-seat'&&this.seatApproachTotalM>0){this.seatApproachTravelledM=Math.min(this.seatApproachTotalM,this.seatApproachTravelledM+step);this.snapshot.seatApproachBlend=this.seatApproachTravelledM/this.seatApproachTotalM;}if(distance<=step+.00001)this.index++;
   if(this.index>=this.path.length)this.arrive();return;
  }
  if(this.phase==='sit'&&this.elapsed>=.8&&this.poseReady!==false&&this.workContactReady!==false){const isDesk=this.station?.type==='desk';this.transition('working',isDesk?'seated_work':'sitting',isDesk?'กำลังทดลองนั่งทำงาน':'กำลังนั่งพัก');}
  else if(this.phase==='working'&&this.workContactReady===false)this.transition('sit','sit_down','กำลังปรับท่ามือให้สัมผัสโต๊ะ');
  else if(this.phase==='working'&&this.elapsed>=3)this.transition('standing','stand_up','กำลังลุกจากที่นั่ง');
  else if((this.phase==='standing'&&this.elapsed>=.8&&this.poseReady!==false)||(this.phase==='rest'&&this.elapsed>=2)){
     if(this.station.seat){const ignoreIds=[this.station.seatObjectId].filter(Boolean);let exitTarget=this.station.position,exitRoute=null;
      if(this.station.type==='desk'&&this.station.footAnchor){const seat=tycoonWorld(this.station.seat),front=tycoonWorld(this.station.footAnchor).sub(seat).setY(0).normalize(),side={x:front.z,z:-front.x},current=tycoonWorld(this.station.position),sideAmount=(current.x-seat.x)*side.x+(current.z-seat.z)*side.z,desk=this.room.objects.find(o=>o.id===this.station.objectId),deskCenter=desk?tycoonWorld(tycoonGround(desk)):current,deskSide=(deskCenter.x-seat.x)*side.x+(deskCenter.z-seat.z)*side.z,sign=Math.abs(sideAmount)>.15?Math.sign(sideAmount):(deskSide>0?-1:1),candidates=[{x:current.x+side.x*sign*.3-front.x*.12,z:current.z+side.z*sign*.3-front.z*.12},{x:current.x-front.x*.12,z:current.z-front.z*.12},{x:current.x-front.x*.2,z:current.z-front.z*.2},{x:current.x-front.x*.3,z:current.z-front.z*.3},{x:current.x+side.x*sign*.15-front.x*.2,z:current.z+side.z*sign*.15-front.z*.2},{x:current.x-side.x*sign*.15-front.x*.2,z:current.z-side.z*sign*.15-front.z*.2}];
       for(const point of candidates){const candidate=tycoonGround(point);if(!canSettleAt(this.nav,candidate))continue;const route=this.nav.findLocalPath(this.snapshot.position,candidate,{ignoreIds});if(route.length){exitTarget=candidate;exitRoute=route;break;}}
       if(!exitRoute)return this.blockMotion('ไม่มีเส้นทางออกจากโต๊ะที่ปลอดภัย',this.snapshot.position,this.snapshot.heading);
      }
      const route=exitRoute||this.nav.findLocalPath(this.snapshot.position,exitTarget,{ignoreIds});if(!route.length)return this.blockMotion('ไม่มีเส้นทางออกจากจุดนั่งที่ปลอดภัย',this.snapshot.position,this.snapshot.heading);this.path=route.length===1?[route[0],route[0]]:route;this.index=1;this.transition('leaving','walk','เดินกลับสู่ทางเดิน');}
   else this.finish();
  }
 }
 arrive(){
  if(this.phase==='leaving'||!this.station){this.transition('settling','idle','จัดเท้าให้มั่นคงหลังหยุด');return;}
   if(this.phase==='approaching-seat'&&this.station.type==='desk'&&this.approachStage==='desk-side-align'){
    this.approachStage='seat-entry';this.path=[copy(this.snapshot.position),copy(this.snapshot.position)];this.index=1;this.transition('entering','walk','เข้าจุดนั่ง');return;
   }
   if(this.phase==='walking'&&this.station.seat){
    this.snapshot.heading=this.station.heading;const ignoreIds=[this.station.seatObjectId].filter(Boolean);
    if(this.approachStage==='front-corner'){
     if(this.station.type==='desk'){this.approachStage='front-facing';this.path=[];this.index=0;this.transition('turning','idle','จัดทิศทางที่มุมด้านข้างก่อนเข้าที่นั่ง');return;}
     const anchor=copy(this.station.footAnchor);if(!this.nav.isSegmentWalkable(this.snapshot.position,anchor,{ignoreIds:[this.station.seatObjectId,this.station.objectId].filter(Boolean)}))return this.blockMotion('ไม่มีทางจัดแนวเข้าที่นั่งอย่างปลอดภัย',this.snapshot.position,this.snapshot.heading);this.approachStage='front-facing';this.path=[];this.index=0;this.transition('turning','idle','จัดทิศทางก่อนเข้าที่นั่ง');return;
    }
    if(this.approachStage==='front-align'){
     const terminalIgnore=[this.station.seatObjectId,this.station.objectId].filter(Boolean),target=this.station.seatRoot||this.station.seat,direct=this.nav.isSegmentWalkable(this.snapshot.position,target,{ignoreIds:terminalIgnore}),route=direct?[copy(this.snapshot.position),copy(target)]:this.nav.findLocalPath(this.snapshot.position,target,{ignoreIds:terminalIgnore}),desk=this.room.objects.find(o=>o.id===this.station.objectId&&o.kind==='desk'),routeLength=route.slice(1).reduce((sum,p,i)=>sum+tycoonWorld(p).distanceTo(tycoonWorld(route[i])),0),start=tycoonWorld(this.snapshot.position),end=tycoonWorld(target),axis=end.clone().sub(start),lateralClear=route.slice(1,-1).every(p=>{const delta=tycoonWorld(p).sub(start),t=Math.max(0,Math.min(1,delta.dot(axis)/Math.max(1e-8,axis.lengthSq())));return delta.distanceTo(start.clone().addScaledVector(axis,t))<=.08;}),meshClear=!!route.length&&routeLength<=.8&&lateralClear&&(!desk||route.slice(1).every((p,i)=>segmentClearOfFootprint(route[i],p,desk,.12)));if(!route.length||!meshClear)return this.blockMotion('ไม่มีเส้นทางเข้าที่นั่งจากด้านหน้า',this.snapshot.position,this.station.heading);this.approachStage='seat-entry';this.path=route.length===1?[route[0],route[0]]:route;this.index=1;this.transition('entering','walk','เข้าจุดนั่ง');return;
    }
    if(this.station.footAnchor){
     const anchor=tycoonWorld(this.station.footAnchor),seat=tycoonWorld(this.station.seat),front=anchor.clone().sub(seat).setY(0).normalize(),current=tycoonWorld(this.snapshot.position),align=this.station.footAnchor;
     if(current.distanceTo(anchor)>.1){
      if(this.station.type==='desk'){
       this.approachStage='front-facing';this.path=[];this.index=0;this.transition('turning','idle','จัดทิศทางที่ด้านข้างก่อนเข้าที่นั่ง');return;
      }
      const chair=this.room.objects.find(o=>o.id===this.station.seatObjectId),desk=this.room.objects.find(o=>o.id===this.station.objectId&&o.kind==='desk'),sideAxis={x:front.z,z:-front.x},sideSign=(current.x-seat.x)*sideAxis.x+(current.z-seat.z)*sideAxis.z>=0?1:-1,side={x:sideAxis.x*sideSign,z:sideAxis.z*sideSign};
      const size=chair?footprintSize(chair):[.5,.5],c=Math.cos(chair?.rotation||0),s=Math.sin(chair?.rotation||0),sideExtent=(Math.abs(side.x*c-side.z*s)*size[0]+Math.abs(side.x*s+side.z*c)*size[1])*(chair?.scale||1)/2,cornerWorld={x:anchor.x+side.x*(sideExtent+.14),z:anchor.z+side.z*(sideExtent+.14)},corner=tycoonGround({x:cornerWorld.x,z:cornerWorld.z}),ignore=[this.station.seatObjectId,this.station.objectId].filter(Boolean),short=tycoonWorld(corner).distanceTo(current)<=.9&&tycoonWorld(align).distanceTo(tycoonWorld(corner))<=.8,navClear=short&&this.nav.isSegmentWalkable(this.snapshot.position,corner,{ignoreIds:ignore})&&this.nav.isSegmentWalkable(corner,align,{ignoreIds:ignore}),meshClear=short&&(!chair||(segmentClearOfFootprint(this.snapshot.position,corner,chair)&&segmentClearOfFootprint(corner,align,chair)))&&(!desk||(segmentClearOfFootprint(this.snapshot.position,corner,desk)&&segmentClearOfFootprint(corner,align,desk)));
      if(navClear&&meshClear){this.approachStage='front-corner';this.snapshot.clip='idle';this.path=[copy(this.snapshot.position),corner];this.index=1;return;}
      const terminalIgnore=[this.station.seatObjectId,this.station.objectId].filter(Boolean),directToFront=this.nav.isSegmentWalkable(this.snapshot.position,align,{ignoreIds:terminalIgnore}),route=directToFront?[copy(this.snapshot.position),copy(align)]:this.nav.findLocalPath(this.snapshot.position,align,{ignoreIds:terminalIgnore});if(route.length>1){this.approachStage='front-facing';this.path=[];this.index=0;this.transition('turning','idle','จัดทิศทางก่อนเข้าที่นั่ง');return;}return this.blockMotion('ไม่มีทางเข้าตำแหน่งจัดแนวหน้าเก้าอี้อย่างปลอดภัย',this.snapshot.position,this.snapshot.heading);
     }
    }
    const route=this.nav.findLocalPath(this.snapshot.position,this.station.seatRoot||this.station.seat,{ignoreIds});if(!route.length)return this.blockMotion('ไม่มีเส้นทางเข้าที่นั่งอย่างปลอดภัย',this.snapshot.position,this.snapshot.heading);this.path=route.length===1?[route[0],route[0]]:route;this.index=1;this.transition('entering','walk','เข้าจุดนั่ง');return;
   }
  if(this.phase==='entering'&&this.approachStage==='seat-entry')this.approachStage=null;
  if(this.station.seat){this.snapshot.heading=this.station.heading;this.transition('sit','sit_down','กำลังนั่ง');}
  else this.transition('rest','talk','กำลังทดลองใช้มุมพัก');
 }
 finish(){this.reservations.clear();this.station=null;this.path=[];this.transition('done','idle','ทดสอบเสร็จแล้ว · ไม่มีการเปลี่ยนข้อมูลธุรกิจ');delete this.snapshot.seatFootOffsetM;}
}
