import {drainPoseSteps} from './tycoon-pose-transaction.js';
import {TycoonCollisionWorld} from './tycoon-limb-collision.js';
// @spec Office Tycoon probe — preserve articulated arm lengths and report measured desktop contact.
// @tested tests/tycoon-arm-contact.test.mjs, tests/tycoon-contact.test.mjs
// @tested tests/tycoon-forearm-capsule-work.test.mjs
import * as THREE from 'three';

const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
const transitPhases=new Set(['approaching-seat','walking','turning']);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function aim(joint,child,target){
 const origin=joint.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
 const world=joint.getWorldQuaternion(Q()).premultiply(Q().setFromUnitVectors(from,to));
 joint.quaternion.copy(joint.parent.getWorldQuaternion(Q()).invert().multiply(world));joint.updateWorldMatrix(true,true);
}
function palmShape(actor,arm){
 const mesh=actor.getObjectByName(`office-${arm.side}-palm`);if(!mesh?.isSkinnedMesh)return null;
 mesh.skeleton.update();const inverse=arm.hand.matrixWorld.clone().invert(),points=[],point=V(),bounds=new THREE.Box3();
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point);mesh.localToWorld(point);point.applyMatrix4(inverse);points.push(point.clone());bounds.expandByPoint(point);}
 const minY=Math.min(...points.map(p=>p.y)),bottom=points.filter(p=>p.y<minY+.001),contact=bottom.reduce((sum,p)=>sum.add(p),V()).multiplyScalar(1/bottom.length),center=bounds.getCenter(V());
 const radius=Math.max(...points.map(p=>Math.hypot(p.y-center.y,p.z-center.z))),collisionStart=new THREE.Vector3(bounds.min.x,center.y,center.z),collisionEnd=new THREE.Vector3(bounds.max.x,center.y,center.z);
 return {mesh,bounds,center,bottom:contact,radius,maxVertexDistance:radius,collisionCenter:center.clone(),collisionStart,collisionEnd};
}
function meshCapsuleRadius(mesh,start,end,fallback){
 if(!mesh?.isSkinnedMesh)return fallback;
 mesh.skeleton.update();const axis=end.clone().sub(start),lengthSq=axis.lengthSq();if(lengthSq<1e-10)return fallback;mesh.updateWorldMatrix(true,false);
 const point=V();let furthest=0;
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){
  mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);const t=clamp(point.clone().sub(start).dot(axis)/lengthSq,0,1),nearest=start.clone().addScaledVector(axis,t);furthest=Math.max(furthest,point.distanceTo(nearest));
 }
 return Math.max(fallback,furthest+.002);
}
function distanceToSegment(point,start,end,axis=null,lengthSq=null){axis??=end.clone().sub(start);lengthSq??=axis.lengthSq();const t=lengthSq<1e-10?0:clamp(point.clone().sub(start).dot(axis)/lengthSq,0,1);return point.distanceTo(start.clone().addScaledVector(axis,t));}
function cloneCapsules(capsules){return capsules?.map(capsule=>({...capsule,start:capsule.start.clone(),end:capsule.end.clone()}))||null;}
function forearmCapsuleSet(mesh,start,end,side){
 const shaftRadius=.076;
 if(!mesh?.isSkinnedMesh)return {shaft:{name:`${side}-forearm`,side,start:start.clone(),end:end.clone(),radius:shaftRadius},bulge:{name:`${side}-forearm-bulge`,side,start:start.clone(),end:start.clone(),radius:.001}};
 mesh.skeleton.update();mesh.updateWorldMatrix(true,false);const geometry=mesh.geometry,count=geometry.index?.count||geometry.attributes.position.count,points=new Array(geometry.attributes.position.count),point=V();
 for(let i=0;i<points.length;i++){mesh.getVertexPosition(i,point);points[i]=point.applyMatrix4(mesh.matrixWorld).clone();}
 const axis=end.clone().sub(start),lengthSq=axis.lengthSq(),shaftDistances=new Float64Array(points.length),selected=new Set();
 for(let i=0;i<points.length;i++)shaftDistances[i]=distanceToSegment(points[i],start,end,axis,lengthSq);
 const triangleIndices=i=>[geometry.index?.getX(i)??i,geometry.index?.getX(i+1)??i+1,geometry.index?.getX(i+2)??i+2];
 for(let i=0;i+2<count;i+=3){const indices=triangleIndices(i);if(indices.some(index=>shaftDistances[index]>shaftRadius))indices.forEach(index=>selected.add(index));}
 if(!selected.size)return {shaft:{name:`${side}-forearm`,side,start:start.clone(),end:end.clone(),radius:shaftRadius},bulge:{name:`${side}-forearm-bulge`,side,start:start.clone(),end:start.clone(),radius:.001}};
 let minT=Infinity,maxT=-Infinity;for(const index of selected){const t=points[index].clone().sub(start).dot(axis)/lengthSq;minT=Math.min(minT,t);maxT=Math.max(maxT,t);}
 const bulgeStart=start.clone().addScaledVector(axis,minT),bulgeEnd=start.clone().addScaledVector(axis,maxT),bulgeAxis=bulgeEnd.clone().sub(bulgeStart),bulgeLengthSq=bulgeAxis.lengthSq();let bulgeRadius=.0;
 for(const index of selected)bulgeRadius=Math.max(bulgeRadius,distanceToSegment(points[index],bulgeStart,bulgeEnd,bulgeAxis,bulgeLengthSq));
 return {shaft:{name:`${side}-forearm`,side,start:start.clone(),end:end.clone(),radius:shaftRadius},bulge:{name:`${side}-forearm-bulge`,side,start:bulgeStart,end:bulgeEnd,radius:bulgeRadius+.002}};
}
function cloneTargets(value){return value?.map(v=>v.clone())||null;}

export class TycoonArmContact{
 constructor(actor,collisionWorld=null){
  this.actor=actor;this.collisionWorld=collisionWorld;this.torso=actor.getObjectByName('office-torso-pivot');actor.updateMatrixWorld(true);
  this.arms=['left','right'].map((side,index)=>({side,index,shoulder:actor.getObjectByName(`office-${side}-shoulder`),elbow:actor.getObjectByName(`office-${side}-elbow`),hand:actor.getObjectByName(`office-${side}-hand`)}));
  this.valid=!!this.torso?.isBone&&this.arms.every(a=>a.shoulder?.isBone&&a.elbow?.isBone&&a.hand?.isBone);
  if(this.valid)for(const arm of this.arms){const a=arm.shoulder.getWorldPosition(V()),b=arm.elbow.getWorldPosition(V()),c=arm.hand.getWorldPosition(V());arm.upperLength=a.distanceTo(b);arm.forearmLength=b.distanceTo(c);arm.rest=[arm.shoulder.quaternion.clone(),arm.elbow.quaternion.clone(),arm.hand.quaternion.clone()];arm.handActorRest=actor.getWorldQuaternion(Q()).invert().multiply(arm.hand.getWorldQuaternion(Q()));arm.upperRadius=.08;arm.forearmRadius=.073;arm.palm=palmShape(actor,arm);if(!arm.palm)this.valid=false;}
  this.restTorso=this.torso?.quaternion.clone()||Q();this.reset();
 }
 reset(){if(this.valid){this.torso.quaternion.copy(this.restTorso);for(const arm of this.arms)[arm.shoulder,arm.elbow,arm.hand].forEach((bone,i)=>bone.quaternion.copy(arm.rest[i]));this.actor.updateMatrixWorld(true);}this.active=false;this.phase=null;this.leanApplied=0;this.currentTargets=null;this.targetRootPosition=null;this.targetRootRotation=null;this.transitTargetReached=false;this.baseTorso=null;this.lapStage=0;this.safeArmCapsules=null;this.workElbowPoleAngles=[0,0];this.workElbowPoleSearch=[];this.workStage=-1;this.workStartCenters=null;this.workSurfaces=null;this.workExitStage=-1;this.workExitCenters=null;this.supportSearchDiagnostics=null;this.deskObjectId=null;this.lastDiagnostic={ok:true,status:'inactive',targetMode:null,handTargetErrorM:{left:null,right:null,max:null},armReachRangesM:{},armBoneLengthErrorM:{},torsoLeanRad:0,collisionHit:null,collision:{sampleCount:0,minClearanceM:null},contacts:{}};}
 capturePose(){return {torso:this.torso.quaternion.clone(),arms:this.arms.map(a=>[a.shoulder.quaternion.clone(),a.elbow.quaternion.clone(),a.hand.quaternion.clone()])};}
 restorePose(pose){if(!pose||!this.valid)return;this.torso.quaternion.copy(pose.torso);this.arms.forEach((a,i)=>[a.shoulder,a.elbow,a.hand].forEach((bone,j)=>bone.quaternion.copy(pose.arms[i][j])));this.actor.updateMatrixWorld(true);}
 captureInternal(){return {active:this.active,phase:this.phase,leanApplied:this.leanApplied,currentTargets:cloneTargets(this.currentTargets),targetRootPosition:this.targetRootPosition?.clone()||null,targetRootRotation:this.targetRootRotation?.clone()||null,transitTargetReached:this.transitTargetReached,baseTorso:this.baseTorso?.clone()||null,lapStage:this.lapStage,safeArmCapsules:cloneCapsules(this.safeArmCapsules),workElbowPoleAngles:[...(this.workElbowPoleAngles||[0,0])],workElbowPoleSearch:structuredClone(this.workElbowPoleSearch||[]),workStage:this.workStage,workStartCenters:cloneTargets(this.workStartCenters),workSurfaces:this.workSurfaces?.map(surface=>({point:surface.point.clone(),normal:surface.normal.clone(),meshName:surface.meshName}))||null,workExitStage:this.workExitStage,workExitCenters:cloneTargets(this.workExitCenters),deskObjectId:this.deskObjectId,lastDiagnostic:structuredClone(this.lastDiagnostic)};}
 restoreInternal(snapshot){if(!snapshot)return;this.active=snapshot.active;this.phase=snapshot.phase;this.leanApplied=snapshot.leanApplied;this.currentTargets=cloneTargets(snapshot.currentTargets);this.targetRootPosition=snapshot.targetRootPosition?.clone()||null;this.targetRootRotation=snapshot.targetRootRotation?.clone()||null;this.transitTargetReached=!!snapshot.transitTargetReached;this.baseTorso=snapshot.baseTorso?.clone()||null;this.lapStage=snapshot.lapStage||0;this.safeArmCapsules=cloneCapsules(snapshot.safeArmCapsules);this.workElbowPoleAngles=[...(snapshot.workElbowPoleAngles||[0,0])];this.workElbowPoleSearch=structuredClone(snapshot.workElbowPoleSearch||[]);this.workStage=snapshot.workStage??-1;this.workStartCenters=cloneTargets(snapshot.workStartCenters);this.workSurfaces=snapshot.workSurfaces?.map(surface=>({point:surface.point.clone(),normal:surface.normal.clone(),meshName:surface.meshName}))||null;this.workExitStage=snapshot.workExitStage??-1;this.workExitCenters=cloneTargets(snapshot.workExitCenters);this.deskObjectId=snapshot.deskObjectId||null;this.lastDiagnostic=structuredClone(snapshot.lastDiagnostic);}
 capsules(){
  if(!this.valid)return [];this.actor.updateMatrixWorld(true);const result=[],rootRotation=this.actor.getWorldQuaternion(Q());
  for(const arm of this.arms){const shoulder=arm.shoulder.getWorldPosition(V()),elbow=arm.elbow.getWorldPosition(V()),wrist=arm.hand.getWorldPosition(V()),rotation=arm.hand.getWorldQuaternion(Q()),start=arm.palm.collisionStart.clone().applyQuaternion(rotation).add(wrist),end=arm.palm.collisionEnd.clone().applyQuaternion(rotation).add(wrist),upperRadius=meshCapsuleRadius(this.actor.getObjectByName(`office-${arm.side}-shoulder-joint`),shoulder,elbow,arm.upperRadius),forearm=forearmCapsuleSet(this.actor.getObjectByName(`office-${arm.side}-elbow-joint`),elbow,wrist,arm.side);
   result.push({name:`${arm.side}-upper-arm`,side:arm.side,start:shoulder,end:elbow,radius:upperRadius});
   result.push(forearm.shaft,forearm.bulge);
   result.push({name:`${arm.side}-palm`,side:arm.side,start,end,radius:arm.palm.radius});
  }
  return result;
 }
 #measure(phase,lean,surfaces,targets){
  const errors={},ranges={},lengthErrors={},contacts={};let max=0;
  this.actor.updateMatrixWorld(true);const actorRotation=this.actor.getWorldQuaternion(Q());
  for(let i=0;i<this.arms.length;i++){
   const arm=this.arms[i],surface=surfaces[i],target=targets[i],shoulder=arm.shoulder.getWorldPosition(V()),elbow=arm.elbow.getWorldPosition(V()),wrist=arm.hand.getWorldPosition(V()),handRotation=arm.hand.getWorldQuaternion(Q()),actualBottom=arm.palm.bottom.clone().applyQuaternion(handRotation).add(wrist),center=arm.palm.center.clone().applyQuaternion(handRotation).add(wrist),error=actualBottom.distanceTo(surface.point);
   errors[arm.side]=error;max=Math.max(max,error);ranges[arm.side]={requiredM:shoulder.distanceTo(target),minM:Math.abs(arm.upperLength-arm.forearmLength)+.035,maxM:arm.upperLength+arm.forearmLength-.015};
   lengthErrors[arm.side]={upperM:Math.abs(shoulder.distanceTo(elbow)-arm.upperLength),forearmM:Math.abs(elbow.distanceTo(wrist)-arm.forearmLength)};
   contacts[arm.side]={surfacePoint:surface.point.toArray(),surfaceNormal:surface.normal.toArray(),surfaceMesh:surface.meshName,palmCenter:center.toArray(),palmBottom:actualBottom.toArray(),wrist:wrist.toArray(),targetWrist:target.toArray()};
  }
  return {ok:true,status:max<=.005?'contact':'approaching',phase,targetMode:'desktop-top-support',deskObjectId:this.deskObjectId,handTargetErrorM:{...errors,max},armReachRangesM:ranges,armBoneLengthErrorM:lengthErrors,torsoLeanRad:lean,collisionHit:null,collision:{sampleCount:0,minClearanceM:null},contacts,supportSearch:this.supportSearchDiagnostics||{}};
 }
 *#clearDesktopSupportSteps(side,deskObjectId,reference,reachable=null){
  const frame=this.collisionWorld?.topSurfaceFrame(deskObjectId);if(!frame)return null;
  const projection=(reference.x-frame.center.x)*frame.majorAxis.x+(reference.z-frame.center.z)*frame.majorAxis.z,sign=Math.abs(projection)>.02?Math.sign(projection):(side==='left'?-1:1),outward=frame.majorAxis.clone().multiplyScalar(sign);
  const arm=this.arms.find(item=>item.side===side),radius=arm.palm.radius,rootRotation=this.actor.getWorldQuaternion(Q()),handRotation=rootRotation.multiply(arm.handActorRest),localCenter=arm.palm.collisionCenter.clone().applyQuaternion(handRotation),localStart=arm.palm.collisionStart.clone().applyQuaternion(handRotation),localEnd=arm.palm.collisionEnd.clone().applyQuaternion(handRotation),attempts=[],inward=outward.clone().negate(),sideSign=Math.sign(projection)|| (side==='left'?-1:1),minimumSide=.12;
  for(const [direction,name] of [[inward,'inward'],[outward,'outward']])for(let offset=0;offset<=.5001;offset+=.025){yield;const query=reference.clone().addScaledVector(direction,offset),surface=this.collisionWorld.topSurfacePoint(deskObjectId,query,{edgeInset:.025});if(!surface)continue;
   const reach=reachable?.(surface),withinReach=typeof reach==='object'?reach?.ok:reach;if(reachable&&!withinReach){attempts.push({direction:name,offsetM:offset,point:surface.point.toArray(),reason:'outside-arm-range',...(typeof reach==='object'?{requiredM:reach.requiredM,maxM:reach.maxM}: {})});continue;}
   const sideDistance=(surface.point.x-frame.center.x)*frame.majorAxis.x+(surface.point.z-frame.center.z)*frame.majorAxis.z;if(sideDistance*sideSign<minimumSide)continue;
   const wrist=surface.point.clone().addScaledVector(surface.normal,radius+.002).sub(localCenter),capsule={name:`${side}-palm`,side,start:localStart.clone().add(wrist),end:localEnd.clone().add(wrist),radius},clearance=this.collisionWorld.inspectCapsules([capsule]);if(clearance.ok){this.supportSearchDiagnostics??={};this.supportSearchDiagnostics[side]={direction:name,offsetM:offset,point:surface.point.toArray(),attempts};return surface;}attempts.push({direction:name,offsetM:offset,point:surface.point.toArray(),hit:clearance.hit});
  }
  this.supportSearchDiagnostics??={};this.supportSearchDiagnostics[side]=attempts;
  return null;
 }
 #workingElbowPole(arm,target){
  const shoulder=arm.shoulder.getWorldPosition(V()),axis=target.clone().sub(shoulder).normalize(),actorRotation=this.actor.getWorldQuaternion(Q()),inward=new THREE.Vector3(arm.index===0?1:-1,0,0).applyQuaternion(actorRotation),forward=new THREE.Vector3(0,0,1).applyQuaternion(actorRotation),pole=inward.multiplyScalar(.45).addScaledVector(up,.85).addScaledVector(forward,.1);
  pole.addScaledVector(axis,-pole.dot(axis));if(pole.lengthSq()<1e-8)pole.copy(inward).addScaledVector(axis,-inward.dot(axis));pole.normalize();return {shoulder,axis,pole};
 }
 #aimWorkingArm(arm,target,poleAngle=0){
  const {shoulder,axis,pole}=this.#workingElbowPole(arm,target),distance=shoulder.distanceTo(target),along=(arm.upperLength**2-arm.forearmLength**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,arm.upperLength**2-along**2));
  pole.applyQuaternion(Q().setFromAxisAngle(axis,poleAngle));const elbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,height);
  aim(arm.shoulder,arm.elbow,elbow);aim(arm.elbow,arm.hand,target);this.actor.updateMatrixWorld(true);const desired=this.actor.getWorldQuaternion(Q()).multiply(arm.handActorRest);arm.hand.quaternion.copy(arm.hand.parent.getWorldQuaternion(Q()).invert().multiply(desired));this.actor.updateMatrixWorld(true);
 }
 #workingBoneCapsules(){return this.capsules().filter(capsule=>/(upper-arm|forearm)/.test(capsule.name));}
 *#workingBoneClearanceSteps(phase){
  const capsules=this.#workingBoneCapsules(),previous=this.safeArmCapsules?.filter(capsule=>/(upper-arm|forearm)/.test(capsule.name));
  const endpoint=this.collisionWorld.inspectCapsules(capsules,{phase});if(!endpoint.ok)return endpoint;
  if(previous?.length===capsules.length)return this.collisionWorld.sweepCapsules===TycoonCollisionWorld.prototype.sweepCapsules?yield* this.collisionWorld.sweepCapsulesSteps(previous,capsules,{phase}):this.collisionWorld.sweepCapsules(previous,capsules,{phase});
  return endpoint;
 }
 *#resolveWorkingElbowPolesSteps(phase){
  this.workElbowPoleSearch=[];if(!this.collisionWorld)return {ok:true,hit:null};
  let clearance=yield* this.#workingBoneClearanceSteps(phase);if(clearance.ok)return clearance;
  const sideIndex=this.arms.findIndex(arm=>arm.side===clearance.hit?.side),hitName=clearance.hit?.limb||'';
  if(sideIndex<0||!/(upper-arm|forearm)/.test(hitName))return clearance;
  const arm=this.arms[sideIndex],target=this.currentTargets[sideIndex],currentAngle=this.workElbowPoleAngles[sideIndex]||0,{axis,pole}=this.#workingElbowPole(arm,target),normal=clearance.hit?.surfaceNormal?new THREE.Vector3(...clearance.hit.surfaceNormal):up.clone();
  normal.addScaledVector(axis,-normal.dot(axis));const candidates=[],add=angle=>{const wrapped=Math.atan2(Math.sin(angle),Math.cos(angle));if(Math.abs(Math.atan2(Math.sin(wrapped-currentAngle),Math.cos(wrapped-currentAngle)))<1e-5||candidates.some(existing=>Math.abs(Math.atan2(Math.sin(existing-wrapped),Math.cos(existing-wrapped)))<1e-5))return;candidates.push(wrapped);};
  if(normal.lengthSq()>1e-8){normal.normalize();const toward=Math.atan2(axis.dot(pole.clone().cross(normal)),pole.dot(normal));add(toward);add(toward+Math.PI);for(const step of [15,30,45,60].map(THREE.MathUtils.degToRad)){add(toward-step);add(toward+step);}}
  for(const degrees of [0,15,-15,30,-30,45,-45,60,-60,90,-90,120,-120,150,-150,180])add(THREE.MathUtils.degToRad(degrees));
  let bestAngle=currentAngle,bestClearance=clearance.hit?.clearanceM??-Infinity;
  const tryAngle=function*(poleAngle){
   yield;
   this.#aimWorkingArm(arm,target,poleAngle);const trial=yield* this.#workingBoneClearanceSteps(phase),residual=trial.hit?.clearanceM??trial.minClearanceM??Infinity,record={side:arm.side,poleOffsetRad:poleAngle,ok:trial.ok,hit:trial.hit?{limb:trial.hit.limb,clearanceM:trial.hit.clearanceM,mesh:trial.hit.mesh}:null};this.workElbowPoleSearch.push(record);
   if(residual>bestClearance){bestClearance=residual;bestAngle=poleAngle;}
   if(trial.ok){this.workElbowPoleAngles[sideIndex]=poleAngle;return trial;}
   return null;
  };
  for(const poleAngle of candidates){const accepted=yield* tryAngle.call(this,poleAngle);if(accepted)return accepted;}
  const refinement=[],addRefined=angle=>{const wrapped=Math.atan2(Math.sin(angle),Math.cos(angle));if(Math.abs(Math.atan2(Math.sin(wrapped-currentAngle),Math.cos(wrapped-currentAngle)))<1e-5||candidates.some(existing=>Math.abs(Math.atan2(Math.sin(existing-wrapped),Math.cos(existing-wrapped)))<1e-5)||refinement.some(existing=>Math.abs(Math.atan2(Math.sin(existing-wrapped),Math.cos(existing-wrapped)))<1e-5))return;refinement.push(wrapped);};
  for(const degrees of [-5,-4,-3,-2,-1.5,-1,-.5,.5,1,1.5,2,3,4,5])addRefined(bestAngle+THREE.MathUtils.degToRad(degrees));
  for(const poleAngle of refinement){const accepted=yield* tryAngle.call(this,poleAngle);if(accepted)return accepted;}
  this.workElbowPoleAngles[sideIndex]=currentAngle;this.#aimWorkingArm(arm,target,currentAngle);return clearance;
 }
 applyLap(phase,dt,seatHeight,seatObjectId,seatPoint,seatFootAnchor){
  if(!this.valid)return {ok:false,diagnostic:{...this.lastDiagnostic,ok:false,status:'unavailable',reason:'unsupported-arm-rig',phase}};
  this.transitTargetReached=false;this.actor.updateMatrixWorld(true);const enteringControl=!this.active||this.phase!==phase,baseTorso=enteringControl?(this.active&&this.baseTorso?this.baseTorso.clone():this.torso.quaternion.clone()):(this.baseTorso?.clone()||this.torso.quaternion.clone());
  if(enteringControl){const previousPhase=this.phase;this.torso.quaternion.copy(baseTorso);this.actor.updateMatrixWorld(true);if(!this.active)this.currentTargets=this.arms.map(arm=>arm.hand.getWorldPosition(V()));if(phase==='entering')this.lapStage=0;else if(previousPhase==='working'){this.lapStage=2;this.workExitStage=0;this.workExitCenters=null;}else if(transitPhases.has(phase)){if(!transitPhases.has(previousPhase)){this.lapStage=0;this.currentTargets=this.arms.map(arm=>arm.hand.getWorldPosition(V()));this.targetRootPosition=null;this.targetRootRotation=null;}}else if(previousPhase!=='entering')this.lapStage=2;this.active=true;this.phase=phase;this.baseTorso=baseTorso.clone();}
  if(this.workExitStage<0)this.leanApplied=Math.max(0,this.leanApplied-dt*.9);this.torso.quaternion.copy(baseTorso).multiply(Q().setFromAxisAngle(new THREE.Vector3(1,0,0),this.leanApplied));this.actor.updateMatrixWorld(true);
  const actorRotation=this.actor.getWorldQuaternion(Q()),root=this.actor.getWorldPosition(V());
  if(transitPhases.has(phase)){
   if(this.currentTargets&&this.targetRootPosition&&this.targetRootRotation){const deltaRotation=actorRotation.clone().multiply(this.targetRootRotation.clone().invert());this.currentTargets=this.currentTargets.map(target=>target.clone().sub(this.targetRootPosition).applyQuaternion(deltaRotation).add(root));}
   this.targetRootPosition=root.clone();this.targetRootRotation=actorRotation.clone();
  }
  const seatBounds=this.collisionWorld?.objectBounds(seatObjectId),seatCenter=seatBounds?.center||seatPoint||root,front=seatPoint&&seatFootAnchor?seatFootAnchor.clone().sub(seatPoint).setY(0).normalize():root.clone().sub(seatCenter).setY(0).normalize(),side=new THREE.Vector3(front.z,0,-front.x),halfFront=seatBounds?Math.abs(front.x)*seatBounds.halfSize.x+Math.abs(front.z)*seatBounds.halfSize.z:0,halfSide=seatBounds?Math.abs(side.x)*seatBounds.halfSize.x+Math.abs(side.z)*seatBounds.halfSize.z:0,pad=Math.max(...this.arms.map(arm=>arm.palm.radius))+.025;
  const centersFor=which=>this.arms.map(arm=>{
   const shoulder=arm.shoulder.getWorldPosition(V()),height=Math.max((seatHeight??.551132)+.30,shoulder.y-.40),frontReach=phase==='leaving' ? .15 : .18;
   if(transitPhases.has(phase)){
    // Carry hands just outside the shirt front while keeping the palms close to the torso width.
    const localSide=arm.index===0?-.06:.06,center=root.clone().add(new THREE.Vector3(localSide,0,.18).applyQuaternion(actorRotation));center.y=height;return center;
   }
   const center=which==='corner'&&seatBounds?seatCenter.clone().addScaledVector(front,halfFront+pad).addScaledVector(side,(arm.index===0?-1:1)*(halfSide+pad)):root.clone().addScaledVector(front,frontReach).addScaledVector(side,(arm.index===0?-1:1)*.09);center.y=height;return center;
  });
  const currentCenters=this.arms.map(arm=>arm.palm.collisionCenter.clone().applyQuaternion(arm.hand.getWorldQuaternion(Q())).add(arm.hand.getWorldPosition(V()))),sideCenters=seatBounds?this.arms.map((arm,i)=>{const current=currentCenters[i],frontCoord=Math.max((current.x-seatCenter.x)*front.x+(current.z-seatCenter.z)*front.z,halfFront+pad),shoulder=arm.shoulder.getWorldPosition(V()),height=Math.max((seatHeight??.551132)+.30,shoulder.y-.40);return seatCenter.clone().addScaledVector(front,frontCoord).addScaledVector(side,(arm.index===0?-1:1)*(halfSide+pad)).setY(height);}):null;
  if(this.workExitStage===0&&!this.workExitCenters){const worldRotation=this.actor.getWorldQuaternion(Q());this.workExitCenters=this.arms.map((arm,i)=>this.currentTargets?.[i]?this.currentTargets[i].clone().add(arm.palm.collisionCenter.clone().applyQuaternion(worldRotation.clone().multiply(arm.handActorRest))):currentCenters[i].clone());}
  const wristTargets=centers=>this.arms.map((arm,i)=>{const rotation=actorRotation.clone().multiply(arm.handActorRest),offset=arm.palm.collisionCenter.clone().applyQuaternion(rotation);return centers[i].clone().sub(offset);});
  const transitCenters=stage=>this.arms.map((arm,i)=>{
   const local=currentCenters[i].clone().sub(root).applyQuaternion(actorRotation.clone().invert()),sideSign=arm.index===0?-1:1,shoulder=arm.shoulder.getWorldPosition(V()),height=Math.max((seatHeight??.551132)+.30,shoulder.y-.40);
   if(stage===0){/* keep the authored lateral hang as the clearance pose */}
   else if(stage===1){local.x=sideSign*.30;local.y=height-root.y;local.z=.18;}
   else{local.x=sideSign*.06;local.y=height-root.y;local.z=.18;}
   return root.clone().add(local.applyQuaternion(actorRotation));
  });
  const frontCenters=centersFor('front'),cornerCenters=centersFor('corner'),reachable=centers=>wristTargets(centers).every((target,i)=>{const shoulder=this.arms[i].shoulder.getWorldPosition(V()),distance=shoulder.distanceTo(target),maximum=this.arms[i].upperLength+this.arms[i].forearmLength-.025;return distance<maximum;});
  let desiredCenters=frontCenters,stageTarget='front';
  if(transitPhases.has(phase)&&this.lapStage<2){desiredCenters=transitCenters(this.lapStage);stageTarget=this.lapStage===0?'transit-lateral':'transit-forward';}
  else if(this.workExitStage===0&&this.workExitCenters&&this.workSurfaces){desiredCenters=this.workExitCenters.map((center,i)=>center.clone().addScaledVector(this.workSurfaces[i].normal,.10));stageTarget='work-exit-lift';}
  else if(this.workExitStage===1&&this.workExitCenters&&this.workSurfaces){desiredCenters=this.workExitCenters.map((center,i)=>center.clone().addScaledVector(this.workSurfaces[i].normal,.10).addScaledVector(front,-.16));stageTarget='work-exit-retreat';}
  else if(this.lapStage===0&&seatBounds&&root.distanceTo(seatCenter)<1.2&&reachable(sideCenters)){desiredCenters=sideCenters;stageTarget='side';}
  else if(this.lapStage===1&&seatBounds){desiredCenters=cornerCenters;stageTarget='corner';}
  if(stageTarget==='transit-lateral'){
   this.lapStage=1;this.currentTargets=this.arms.map(arm=>arm.hand.getWorldPosition(V()));this.lastDiagnostic={ok:true,status:'clearance-only',phase,targetMode:'lap-clearance',lapStage:this.lapStage,workExitStage:this.workExitStage,handTargetErrorM:{left:null,right:null,max:null},armReachRangesM:{},armBoneLengthErrorM:{},torsoLeanRad:this.leanApplied,collisionHit:null,collision:{sampleCount:0,minClearanceM:null},contacts:{}};return {ok:true,diagnostic:this.lastDiagnostic};
  }
  const targets=wristTargets(desiredCenters),targetRanges=this.arms.map((arm,i)=>{const shoulder=arm.shoulder.getWorldPosition(V()),requiredM=shoulder.distanceTo(targets[i]),maxM=arm.upperLength+arm.forearmLength-.025;return {requiredM,maxM};});
  if(targetRanges.some(range=>range.requiredM>range.maxM)&&phase==='entering'&&seatPoint&&root.distanceTo(seatPoint)>.4){this.torso.quaternion.copy(baseTorso);this.actor.updateMatrixWorld(true);this.active=false;this.phase=null;this.currentTargets=null;this.baseTorso=null;this.lastDiagnostic={ok:true,status:'approaching',phase,targetMode:'lap-clearance',reason:'lap-target-pending-entry',handTargetErrorM:{left:null,right:null,max:null},armReachRangesM:Object.fromEntries(this.arms.map((arm,i)=>[arm.side,targetRanges[i]])),armBoneLengthErrorM:{},torsoLeanRad:0,collisionHit:null,collision:{sampleCount:0,minClearanceM:null},contacts:{}};return {ok:true,diagnostic:this.lastDiagnostic};}
  const move=dt*.85;
  this.currentTargets=this.currentTargets.map((target,i)=>{const delta=targets[i].clone().sub(target),length=delta.length();return length<=move?targets[i]:target.addScaledVector(delta,move/length);});
  const reach={},lengthErrors={};
  for(let i=0;i<this.arms.length;i++){
   const arm=this.arms[i],shoulder=arm.shoulder.getWorldPosition(V()),target=this.currentTargets[i],delta=target.clone().sub(shoulder),distance=delta.length(),min=Math.abs(arm.upperLength-arm.forearmLength)+.001,max=arm.upperLength+arm.forearmLength-.001;reach[arm.side]={requiredM:distance,minM:min,maxM:max};
   if(distance<min||distance>max){const diagnostic={ok:false,status:'unreachable',reason:'lap-target-outside-arm-range',phase,targetMode:'lap-clearance',handTargetErrorM:{left:null,right:null,max:null},armReachRangesM:reach,armBoneLengthErrorM:lengthErrors,torsoLeanRad:this.leanApplied,collisionHit:null,collision:{sampleCount:0,minClearanceM:null},contacts:{}};this.lastDiagnostic=diagnostic;return {ok:false,diagnostic};}
   const axis=delta.normalize(),handRotation=actorRotation.clone(),inward=new THREE.Vector3(arm.index===0?1:-1,0,0).applyQuaternion(handRotation),forward=new THREE.Vector3(0,0,1).applyQuaternion(handRotation),pole=inward.multiplyScalar(stageTarget==='transit-forward'?-.3:.3).addScaledVector(forward,.7);pole.addScaledVector(axis,-pole.dot(axis));if(pole.lengthSq()<1e-8)pole.copy(forward).addScaledVector(axis,-forward.dot(axis));pole.normalize();
   const along=(arm.upperLength**2-arm.forearmLength**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,arm.upperLength**2-along**2)),elbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,height);
   aim(arm.shoulder,arm.elbow,elbow);aim(arm.elbow,arm.hand,target);this.actor.updateMatrixWorld(true);const desiredHand=handRotation.multiply(arm.handActorRest);arm.hand.quaternion.copy(arm.hand.parent.getWorldQuaternion(Q()).invert().multiply(desiredHand));this.actor.updateMatrixWorld(true);
   lengthErrors[arm.side]={upperM:Math.abs(arm.shoulder.getWorldPosition(V()).distanceTo(arm.elbow.getWorldPosition(V()))-arm.upperLength),forearmM:Math.abs(arm.elbow.getWorldPosition(V()).distanceTo(arm.hand.getWorldPosition(V()))-arm.forearmLength)};
  }
  const contacts={};let targetReached=true;for(let i=0;i<this.arms.length;i++){const arm=this.arms[i],wrist=arm.hand.getWorldPosition(V()),rotation=arm.hand.getWorldQuaternion(Q()),center=arm.palm.collisionCenter.clone().applyQuaternion(rotation).add(wrist);contacts[arm.side]={targetWrist:targets[i].toArray(),palmCenter:center.toArray(),targetPalmCenter:desiredCenters[i].toArray()};if(center.distanceTo(desiredCenters[i])>.045)targetReached=false;}
  if(targetReached&&stageTarget==='work-exit-lift')this.workExitStage=1;else if(targetReached&&stageTarget==='work-exit-retreat'){this.workExitStage=-1;this.workExitCenters=null;this.workSurfaces=null;}else if(targetReached&&stageTarget==='side')this.lapStage=1;else if(targetReached&&stageTarget==='transit-lateral')this.lapStage=1;else if(targetReached&&stageTarget==='transit-forward')this.lapStage=2;else if(targetReached&&(stageTarget==='corner'||stageTarget==='front'))this.lapStage=2;
  this.transitTargetReached=transitPhases.has(phase)&&stageTarget==='front'&&this.lapStage===2&&targetReached;
  this.lastDiagnostic={ok:true,status:'clearance-only',phase,targetMode:'lap-clearance',lapStage:this.lapStage,workExitStage:this.workExitStage,workExitState:{hasSurfaces:!!this.workSurfaces?.length,hasCenters:!!this.workExitCenters?.length},handTargetErrorM:{left:null,right:null,max:null},armReachRangesM:reach,armBoneLengthErrorM:lengthErrors,torsoLeanRad:this.leanApplied,collisionHit:null,collision:{sampleCount:0,minClearanceM:null},contacts};return {ok:true,diagnostic:this.lastDiagnostic};
 }
 applyWorking(...args){return drainPoseSteps(this.applyWorkingSteps(...args));}
 *applyWorkingSteps(phase,deskObjectId,dt){
  if(!this.valid)return {ok:false,diagnostic:{...this.lastDiagnostic,ok:false,status:'unavailable',reason:'unsupported-arm-rig',phase}};
  this.transitTargetReached=false;this.actor.updateMatrixWorld(true);const startCenters=this.arms.map(arm=>arm.palm.collisionCenter.clone().applyQuaternion(arm.hand.getWorldQuaternion(Q())).add(arm.hand.getWorldPosition(V()))),enteringControl=!this.active||this.phase!=='working',baseTorso=enteringControl?(this.active&&this.baseTorso?this.baseTorso.clone():this.torso.quaternion.clone()):(this.baseTorso?.clone()||this.torso.quaternion.clone()),actorRotation=this.actor.getWorldQuaternion(Q());
  const maxLean=.78,rotationX=()=>Q().setFromAxisAngle(new THREE.Vector3(1,0,0),maxLean),palmWristTarget=(arm,surface)=>{const rootRotation=this.actor.getWorldQuaternion(Q()),handRotation=rootRotation.multiply(arm.handActorRest),normalLocal=surface.normal.clone().applyQuaternion(handRotation.clone().invert()).normalize(),centerFromBottom=arm.palm.center.clone().sub(arm.palm.bottom),gap=Math.max(.002,arm.palm.radius-centerFromBottom.dot(normalLocal)+.002),contactPoint=surface.point.clone().addScaledVector(surface.normal,gap),localBottom=arm.palm.bottom.clone().applyQuaternion(handRotation);return contactPoint.sub(localBottom);};
  let surfaces=this.active&&this.phase==='working'&&this.deskObjectId===deskObjectId&&this.workSurfaces?.length===this.arms.length?this.workSurfaces.map(surface=>({...surface,point:surface.point.clone(),normal:surface.normal.clone()})):null;
  if(!surfaces){this.torso.quaternion.copy(baseTorso).multiply(rotationX());this.actor.updateMatrixWorld(true);const refs=this.arms.map(arm=>arm.shoulder.getWorldPosition(V()));surfaces=[];for(let i=0;i<refs.length;i++)surfaces.push(yield* this.#clearDesktopSupportSteps(this.arms[i].side,deskObjectId,refs[i],surface=>{const arm=this.arms[i],shoulder=arm.shoulder.getWorldPosition(V()),requiredM=shoulder.distanceTo(palmWristTarget(arm,surface)),minM=Math.abs(arm.upperLength-arm.forearmLength)+.035,maxM=arm.upperLength+arm.forearmLength-.015;return {ok:requiredM>=minM&&requiredM<=maxM,requiredM,maxM};}));this.torso.quaternion.copy(baseTorso);this.actor.updateMatrixWorld(true);}
  if(surfaces.some(surface=>!surface)){
   const diagnostic={ok:false,status:'unreachable',reason:'desktop-support-surface-unavailable',phase,targetMode:'desktop-top-support',deskObjectId,handTargetErrorM:{left:null,right:null,max:null},armReachRangesM:{},armBoneLengthErrorM:{},torsoLeanRad:0,collisionHit:null,collision:{sampleCount:0,minClearanceM:null},contacts:{},supportSearch:this.supportSearchDiagnostics||{}};this.lastDiagnostic=diagnostic;return {ok:false,diagnostic};
  }
  const targetsAtLean=lean=>{
   this.torso.quaternion.copy(baseTorso).multiply(Q().setFromAxisAngle(new THREE.Vector3(1,0,0),lean));this.actor.updateMatrixWorld(true);
   return this.arms.map((arm,i)=>{const rootRotation=this.actor.getWorldQuaternion(Q()),handRotation=rootRotation.multiply(arm.handActorRest),normalLocal=surfaces[i].normal.clone().applyQuaternion(handRotation.clone().invert()).normalize(),centerFromBottom=arm.palm.center.clone().sub(arm.palm.bottom),gap=Math.max(.002,arm.palm.radius-centerFromBottom.dot(normalLocal)+.002),contactPoint=surfaces[i].point.clone().addScaledVector(surfaces[i].normal,gap),localBottom=arm.palm.bottom.clone().applyQuaternion(handRotation);return contactPoint.sub(localBottom);});
  };
  let targetLean=null,fullTargets=null,reach={};
  for(let lean=0;lean<=maxLean+.0001;lean+=.01){yield;const targets=targetsAtLean(lean);this.actor.updateMatrixWorld(true);let feasible=true;
   for(let i=0;i<this.arms.length;i++){const arm=this.arms[i],shoulder=arm.shoulder.getWorldPosition(V()),distance=shoulder.distanceTo(targets[i]),min=Math.abs(arm.upperLength-arm.forearmLength)+.035,max=arm.upperLength+arm.forearmLength-.015;reach[arm.side]={requiredM:distance,minM:min,maxM:max,shoulder:shoulder.toArray(),target:targets[i].toArray()};if(distance<min||distance>max)feasible=false;}
   if(feasible){targetLean=lean;fullTargets=targets;break;}
  }
  if(targetLean===null){const targets=targetsAtLean(maxLean);this.actor.updateMatrixWorld(true);const ranges={};for(let i=0;i<this.arms.length;i++){const arm=this.arms[i],shoulder=arm.shoulder.getWorldPosition(V());ranges[arm.side]={...reach[arm.side],requiredM:shoulder.distanceTo(targets[i]),shoulder:shoulder.toArray(),target:targets[i].toArray()};}this.torso.quaternion.copy(baseTorso);this.actor.updateMatrixWorld(true);
   const diagnostic={ok:false,status:'unreachable',reason:'desktop-target-outside-arm-range',phase,targetMode:'desktop-top-support',deskObjectId,handTargetErrorM:{left:null,right:null,max:null},armReachRangesM:ranges,armBoneLengthErrorM:{},torsoLeanRad:maxLean,collisionHit:null,collision:{sampleCount:0,minClearanceM:null},contacts:surfaces.map(surface=>({surfacePoint:surface.point.toArray(),surfaceNormal:surface.normal.toArray(),surfaceMesh:surface.meshName})),supportSearch:this.supportSearchDiagnostics||{}};this.lastDiagnostic=diagnostic;this.active=false;return {ok:false,diagnostic};
  }
  this.torso.quaternion.copy(baseTorso);this.actor.updateMatrixWorld(true);
  if(enteringControl){if(!this.active)this.currentTargets=this.arms.map(arm=>arm.hand.getWorldPosition(V()));if(this.phase!=='lap'&&!this.active)this.leanApplied=0;this.active=true;this.baseTorso=baseTorso.clone();this.workStage=0;this.workStartCenters=startCenters.map(center=>center.clone());this.workSurfaces=surfaces.map(surface=>({point:surface.point.clone(),normal:surface.normal.clone(),meshName:surface.meshName}));this.workExitStage=-1;this.workExitCenters=null;}
  this.phase='working';this.deskObjectId=deskObjectId;const leanGoal=this.workStage===0?Math.min(targetLean,.25):targetLean;this.leanApplied+=clamp(leanGoal-this.leanApplied,-dt*.9,dt*.9);
  const workingTargets=targetsAtLean(this.leanApplied),rootRotation=this.actor.getWorldQuaternion(Q()),forward=new THREE.Vector3(0,0,1).applyQuaternion(rootRotation).setY(0).normalize(),supportCenters=workingTargets.map((target,i)=>target.clone().add(this.arms[i].palm.collisionCenter.clone().applyQuaternion(rootRotation.clone().multiply(this.arms[i].handActorRest)))),hoverCenters=supportCenters.map((center,i)=>center.clone().setY(Math.max(center.y,surfaces[i].point.y+this.arms[i].palm.radius+.035))),liftStartCenters=this.workStartCenters.map((center,i)=>center.clone().setY(Math.max(center.y,surfaces[i].point.y+this.arms[i].palm.radius+.035))),preclearCenters=liftStartCenters.map(center=>center.clone().addScaledVector(forward,.1)),wristTargets=centers=>centers.map((center,i)=>center.clone().sub(this.arms[i].palm.collisionCenter.clone().applyQuaternion(rootRotation.clone().multiply(this.arms[i].handActorRest))));
  const stageTargets=()=>wristTargets(this.workStage===0?liftStartCenters:this.workStage===1?preclearCenters:this.workStage===2?hoverCenters:supportCenters);
  let waypoints=stageTargets();if(this.workStage<3&&this.currentTargets.every((target,i)=>target.distanceTo(waypoints[i])<.025)){this.workStage++;waypoints=stageTargets();}
  const move=dt*(this.workStage===3?.22:.4);
  this.currentTargets=this.currentTargets.map((target,i)=>{const delta=waypoints[i].clone().sub(target),length=delta.length();return length<=move?waypoints[i]:target.addScaledVector(delta,move/length);});
  for(let i=0;i<this.arms.length;i++){
   const arm=this.arms[i],shoulder=arm.shoulder.getWorldPosition(V()),target=this.currentTargets[i],delta=target.clone().sub(shoulder),distance=delta.length(),min=Math.abs(arm.upperLength-arm.forearmLength)+.001,max=arm.upperLength+arm.forearmLength-.001;
   if(distance<min||distance>max){const diagnostic={ok:false,status:'unreachable',reason:'intermediate-arm-target-outside-range',phase,targetMode:'desktop-top-support',deskObjectId,handTargetErrorM:{left:null,right:null,max:null},armReachRangesM:{[arm.side]:{requiredM:distance,minM:min,maxM:max}},armBoneLengthErrorM:{},torsoLeanRad:this.leanApplied,collisionHit:null,collision:{sampleCount:0,minClearanceM:null},contacts:{}};this.lastDiagnostic=diagnostic;return {ok:false,diagnostic};}
   this.#aimWorkingArm(arm,target,this.workElbowPoleAngles[i]||0);
  }
  const elbowClearance=yield* this.#resolveWorkingElbowPolesSteps(phase),diagnostic=this.#measure(phase,this.leanApplied,surfaces,this.currentTargets);diagnostic.armReachRangesM={...reach};diagnostic.targetLeanRad=targetLean;diagnostic.approachStage=this.workStage;diagnostic.workElbowPoleAngles=[...this.workElbowPoleAngles];diagnostic.workElbowPoleSearch=[...this.workElbowPoleSearch];diagnostic.workElbowPoleClear=elbowClearance.ok;diagnostic.workElbowPoleClearance={hasWorld:!!this.collisionWorld,hit:elbowClearance.hit?{limb:elbowClearance.hit.limb,clearanceM:elbowClearance.hit.clearanceM}:null,sampleCount:elbowClearance.sampleCount??1,previousBoneCapsules:this.safeArmCapsules?.filter(capsule=>/(upper-arm|forearm)/.test(capsule.name)).length||0,currentBoneCapsules:this.#workingBoneCapsules().length};diagnostic.collision={sampleCount:elbowClearance.sampleCount??1,minClearanceM:elbowClearance.minClearanceM??null};this.lastDiagnostic=diagnostic;return {ok:true,diagnostic};
 }
 setCollision(collision){if(collision?.ok===true)this.safeArmCapsules=cloneCapsules(this.capsules());this.lastDiagnostic={...this.lastDiagnostic,collisionHit:collision?.hit||null,collision:{sampleCount:collision?.sampleCount??0,minClearanceM:collision?.minClearanceM??null}};if(collision?.ok===false)this.lastDiagnostic={...this.lastDiagnostic,ok:false,status:'collision'};}
}
