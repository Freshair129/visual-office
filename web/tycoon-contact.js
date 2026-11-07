import {drainPoseSteps} from './tycoon-pose-transaction.js';
// Transient probe pose: world-space steps, length-preserving two-bone IK and limb clearance.
// Exported clips still animate the upper body; this owns the pelvis, legs and shoes.
// @tested tests/tycoon-repair-cache.test.mjs, tests/tycoon-capsule-reuse.test.mjs, tests/tycoon-collision-witness.test.mjs, tests/tycoon-swing-planning-cache.test.mjs, tests/tycoon-fresh-matrix.test.mjs
import * as THREE from 'three';
import {TycoonArmContact} from './tycoon-arm-contact.js';
import {TycoonCollisionWorld} from './tycoon-limb-collision.js';

const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),matrixPositionScratch=V(),matrixScaleScratch=V();
const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const smooth=t=>t*t*(3-2*t);
const legPoseHintPhases=new Set(['approaching-seat','entering','sit','working','standing','leaving']);
function freshWorldPosition(object,target=V()){return target.setFromMatrixPosition(object.matrixWorld);}
function freshWorldQuaternion(object,target=Q()){object.matrixWorld.decompose(matrixPositionScratch,target,matrixScaleScratch);return target;}

function aim(joint,child,target){
 const origin=freshWorldPosition(joint),from=freshWorldPosition(child).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
 const world=freshWorldQuaternion(joint).premultiply(Q().setFromUnitVectors(from,to));
 joint.quaternion.copy(freshWorldQuaternion(joint.parent).invert().multiply(world));joint.updateWorldMatrix(false,true);
}

function solve(leg,target,yaw,poleElevation=0){
 const h=freshWorldPosition(leg.hip),delta=target.clone().sub(h),d=delta.length();
 if(d<1e-5||d>leg.a+leg.b+1e-5||d<Math.abs(leg.a-leg.b)-1e-5)throw Error('Probe leg target outside reachable range');
 const axis=delta.divideScalar(d),pole=new THREE.Vector3(Math.sin(yaw)*Math.cos(poleElevation),Math.sin(poleElevation),Math.cos(yaw)*Math.cos(poleElevation));pole.addScaledVector(axis,-pole.dot(axis));
 if(pole.lengthSq()<1e-8)pole.set(1,0,0).addScaledVector(axis,-axis.x);pole.normalize();
 const along=(leg.a*leg.a-leg.b*leg.b+d*d)/(2*d),height=Math.sqrt(Math.max(0,leg.a*leg.a-along*along));
 const knee=h.clone().addScaledVector(axis,along).addScaledVector(pole,height);
 aim(leg.hip,leg.knee,knee);aim(leg.knee,leg.ankle,target);
 const world=Q().setFromAxisAngle(up,leg.yaw).multiply(leg.ankleRest);
 leg.ankle.quaternion.copy(freshWorldQuaternion(leg.ankle.parent).invert().multiply(world));
}

function shoeShape(actor,leg){
 const mesh=actor.getObjectByName(`office-${leg.side}-shoe`);if(!mesh?.isSkinnedMesh)return null;
 mesh.skeleton.update();const inverse=leg.ankle.matrixWorld.clone().invert(),bounds=new THREE.Box3(),point=V();
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point);mesh.localToWorld(point);point.applyMatrix4(inverse);bounds.expandByPoint(point);}
 const size=bounds.getSize(V()),axis=size.x>size.z?'x':'z',index=axis==='x'?0:2,lo=bounds.min.getComponent(index),hi=bounds.max.getComponent(index),crossRadius=Math.max(axis==='x'?size.z:size.x,size.y)/2,radius=crossRadius+.004;
 const center=bounds.getCenter(V()),make=value=>{const p=center.clone();p.setComponent(index,THREE.MathUtils.clamp(value,lo,hi));return p;};
 // Keep the measured radius margin out of the endpoint inset. This encloses rounded toe/heel vertices instead of truncating the capsule at the width-derived radius.
 const a=make(lo+crossRadius),b=make(hi-crossRadius);if(a.distanceToSquared(b)<1e-8){a.setComponent(index,(lo+hi)/2);b.copy(a);}
 return {a,b,radius};
}

function cloneCapsules(capsules){return capsules.map(c=>({...c,start:c.start.clone(),end:c.end.clone()}));}

export class ProbeContact{
 constructor(actor,collisionWorld=null){
  this.actor=actor;this.collisionWorld=collisionWorld;actor.updateMatrixWorld(true);this.body=actor.getObjectByName('office-body');
  this.legs=['left','right'].map(side=>({side,hip:actor.getObjectByName(`office-${side}-hip`),knee:actor.getObjectByName(`office-${side}-knee`),ankle:actor.getObjectByName(`office-${side}-ankle`),thighMesh:actor.getObjectByName(`office-${side}-thigh`),shinMesh:actor.getObjectByName(`office-${side}-knee-joint`)}));
  this.armContact=new TycoonArmContact(actor,collisionWorld);
  this.valid=!!this.body&&!!actor.getObjectByName('office-pelvis')?.isSkinnedMesh&&this.legs.every(l=>l.hip?.isBone&&l.knee?.isBone&&l.ankle?.isBone)&&this.armContact.valid;if(!this.valid)return;
  this.bodyRest=this.body.position.clone();this.bodyRotation=this.body.quaternion.clone();
  for(const l of this.legs){
   const h=l.hip.getWorldPosition(V()),k=l.knee.getWorldPosition(V()),a=l.ankle.getWorldPosition(V());l.a=h.distanceTo(k);l.b=k.distanceTo(a);l.hipOffset=actor.worldToLocal(h.clone());l.x=l.hipOffset.x;l.ankleY=actor.worldToLocal(a.clone()).y;l.ankleRest=actor.getWorldQuaternion(Q()).invert().multiply(l.ankle.getWorldQuaternion(Q()));l.rest=[l.hip.quaternion.clone(),l.knee.quaternion.clone(),l.ankle.quaternion.clone()];l.hipRestPosition=l.hip.position.clone();
   l.thighRadius=.087+.005;l.shinRadius=.073+.005;l.shoe=shoeShape(actor,l);
  }
  const mesh=actor.getObjectByName('office-pelvis');mesh.skeleton.update();this.restPelvis=Infinity;let pelvisLowestWorldY=Infinity;const pelvisVertices=[];
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=mesh.getVertexPosition(i,V());mesh.localToWorld(p);const local=actor.worldToLocal(p.clone());this.restPelvis=Math.min(this.restPelvis,local.y);pelvisLowestWorldY=Math.min(pelvisLowestWorldY,p.y);pelvisVertices.push({worldY:p.y,local});}
  const pelvisSupportBand=pelvisVertices.filter(vertex=>vertex.worldY<=pelvisLowestWorldY+.001);this.pelvisSupportOffset=pelvisSupportBand.reduce((sum,vertex)=>sum.add(vertex.local),V()).multiplyScalar(1/Math.max(1,pelvisSupportBand.length));
  this.reset();
 }
 reset(){this.started=false;this.swing=null;this.swingPlan=null;this.next=0;this.ready=false;this.transitReady=false;this.safePose=null;this.seatedHipPose=null;this.legPoseHint=null;this.departureTargets=null;this.armContact?.reset();this.lastCollision={ok:true,phase:'idle',checkedCapsules:0,testedTriangles:0,sampleCount:0,minClearanceM:null,armContact:this.armContact?.lastDiagnostic||null};}
 bindCollisionWorld(collisionWorld){
  if(this.collisionWorld===collisionWorld&&this.armContact?.collisionWorld===collisionWorld)return false;
  this.restore();this.reset();this.collisionWorld=collisionWorld;if(this.armContact)this.armContact.collisionWorld=collisionWorld;return true;
 }
 restore(){if(!this.valid)return;this.body.position.copy(this.bodyRest);this.body.quaternion.copy(this.bodyRotation);for(const l of this.legs){l.hip.position.copy(l.hipRestPosition);[l.hip,l.knee,l.ankle].forEach((b,i)=>b.quaternion.copy(l.rest[i]));}}
 // The public default retains ancestor refresh. Internal solve candidates pass true only after the actor/pelvis was refreshed and only the leg branch changed.
 updateLegWorld(leg,parentsFresh=false){leg.hip.updateWorldMatrix(!parentsFresh,true);}
 limbCapsules(armCapsules=null,legOnly=false,matricesFresh=false){
  const actor=this.actor;if(!legOnly)actor.updateMatrixWorld(true);const useFreshMatrices=matricesFresh,capsules=[];
  for(const l of this.legs){
   // Public leg-only reads keep their ancestor-refresh behavior; the internal collector opts in only after branch refresh.
   const hip=useFreshMatrices?freshWorldPosition(l.hip):l.hip.getWorldPosition(V()),knee=useFreshMatrices?freshWorldPosition(l.knee):l.knee.getWorldPosition(V()),ankle=useFreshMatrices?freshWorldPosition(l.ankle):l.ankle.getWorldPosition(V());
   capsules.push({name:`${l.side}-thigh`,side:l.side,start:hip,end:knee,radius:l.thighRadius});
   capsules.push({name:`${l.side}-shin`,side:l.side,start:knee.clone(),end:ankle,radius:l.shinRadius});
   if(l.shoe){const origin=ankle,rotation=useFreshMatrices?freshWorldQuaternion(l.ankle):l.ankle.getWorldQuaternion(Q());capsules.push({name:`${l.side}-shoe`,side:l.side,start:l.shoe.a.clone().applyQuaternion(rotation).add(origin),end:l.shoe.b.clone().applyQuaternion(rotation).add(origin),radius:l.shoe.radius});}
  }
  capsules.push(...(armCapsules||this.armContact.capsules()));
  return capsules;
 }
 shoeRearExtent(heading,front){
  if(!this.valid||!Number.isFinite(heading))return null;const direction=front.clone().setY(0),length=direction.length();if(length<1e-10)return null;direction.divideScalar(length);const actorYaw=Q().setFromAxisAngle(up,heading);let extent=-Infinity;
  for(const leg of this.legs){if(!leg.shoe)continue;const ankleYaw=actorYaw.clone().multiply(leg.ankleRest),rearA=-leg.shoe.a.clone().applyQuaternion(ankleYaw).dot(direction),rearB=-leg.shoe.b.clone().applyQuaternion(ankleYaw).dot(direction);extent=Math.max(extent,rearA+leg.shoe.radius,rearB+leg.shoe.radius);}
  return Number.isFinite(extent)?extent:null;
 }
 shoeCapsulesAtAnchor(anchor,heading,footWidthScale=1,footToeOutRad=0){
  if(!this.valid||!Number.isFinite(heading))return [];const actorYaw=Q().setFromAxisAngle(up,heading);
  return this.legs.filter(leg=>leg.shoe).map(leg=>{const ankle=V().set(leg.x*footWidthScale,leg.ankleY,0).applyAxisAngle(up,heading).add(anchor),sign=leg.side==='left'?-1:1,ankleYaw=Q().setFromAxisAngle(up,heading+sign*footToeOutRad).multiply(leg.ankleRest);return {name:`${leg.side}-shoe`,side:leg.side,start:leg.shoe.a.clone().applyQuaternion(ankleYaw).add(ankle),end:leg.shoe.b.clone().applyQuaternion(ankleYaw).add(ankle),radius:leg.shoe.radius};});
 }
 shoeCapsuleAt(leg,anklePosition,yaw){const ankleYaw=Q().setFromAxisAngle(up,yaw).multiply(leg.ankleRest);return {name:`${leg.side}-shoe`,side:leg.side,start:leg.shoe.a.clone().applyQuaternion(ankleYaw).add(anklePosition),end:leg.shoe.b.clone().applyQuaternion(ankleYaw).add(anklePosition),radius:leg.shoe.radius};}
 swingClearanceLift(...args){return drainPoseSteps(ProbeContact.prototype.swingClearanceLiftSteps.call(this,...args));}
 *swingClearanceLiftSteps(leg,from,to,fromYaw,toYaw,phase,allowDetour=true,capsuleBatch=null){
  if(!this.collisionWorld)return {ok:true,lift:.18,attempts:0,minClearanceM:null};const travel=from.distanceTo(to),minimumClearance=.001,maxLift=phase==='approaching-seat'?.5:phase==='leaving'?.42:.36,increment=.01,samples=Math.max(12,Math.min(48,Math.ceil((travel+.72)/.025)));
  if(!capsuleBatch&&this.collisionWorld.createCapsuleBatch){const bounds=new THREE.Box3().setFromPoints([from,to]),shoe=leg.shoe,envelope=shoe?Math.max(shoe.a.length(),shoe.b.length())+shoe.radius:0;bounds.max.y=Math.max(from.y,to.y)+maxLift;bounds.expandByScalar(envelope);capsuleBatch=this.collisionWorld.createCapsuleBatch({phase},{bounds});}
  let lastFailure=null;for(let attempt=0,lift=.18;lift<=maxLift+1e-8;attempt++,lift+=increment){let clear=true,minClearance=Infinity;
   for(let i=0;i<=samples;i++){yield;const u=i/samples,t=smooth(u),ankle=from.clone().lerp(to,t);ankle.y+=lift*Math.sin(Math.PI*t);const yaw=fromYaw+angle(fromYaw,toYaw)*t,capsule=this.shoeCapsuleAt(leg,ankle,yaw),result=this.collisionWorld.inspectCapsules([capsule],{phase},capsuleBatch),minimum=result.minClearanceM??Infinity;if(!result.ok||minimum<minimumClearance){clear=false;lastFailure={lift,sampleIndex:i,progress:t,clearanceM:Number.isFinite(minimum)?minimum:null,hit:result.hit};break;}if(result.minClearanceM!==null)minClearance=Math.min(minClearance,result.minClearanceM);}
   if(clear)return {ok:true,lift,attempts:attempt+1,minClearanceM:Number.isFinite(minClearance)?minClearance:null,sampleCount:samples+1};
  }
  const failure={ok:false,lift:null,attempts:Math.ceil((maxLift-.18)/increment)+1,minClearanceM:null,sampleCount:samples+1,failure:lastFailure};
  if(allowDetour){const routes=[[new THREE.Vector3(from.x,to.y,to.z),to.clone()],[new THREE.Vector3(to.x,from.y,from.z),to.clone()]],hip=leg.hipOffset.clone().applyAxisAngle(up,this.heading).add(this.actor.position);hip.y+=this.pelvis-this.restPelvis;for(const route of routes){let current=from.clone(),yaw=fromYaw,plans=[],clear=true;for(let i=0;i<route.length;i++){const target=route[i],required=hip.distanceTo(target);if(required>leg.a+leg.b-.005||required<Math.abs(leg.a-leg.b)+.005){clear=false;break;}const targetYaw=fromYaw+angle(fromYaw,toYaw)*(i+1)/route.length,plan=yield* this.swingClearanceLiftSteps(leg,current,target,yaw,targetYaw,phase,false,capsuleBatch);if(!plan.ok){clear=false;break;}plans.push(plan);current=target;yaw=targetYaw;}if(clear)return {ok:true,lift:plans[0].lift,attempts:plans.reduce((sum,plan)=>sum+plan.attempts,0),minClearanceM:Math.min(...plans.map(plan=>plan.minClearanceM??Infinity)),sampleCount:plans.reduce((sum,plan)=>sum+plan.sampleCount,0),route,segmentLifts:plans.map(plan=>plan.lift),routeMode:'axis-detour'};}}
  return failure;
 }
 footReachAtAnchor(anchor,seatRoot,heading,seatHeight,footWidthScale=1){
  if(!this.valid||!Number.isFinite(heading)||!Number.isFinite(seatHeight))return {ok:false,reason:'invalid-foot-reach-input'};const yaw=Q().setFromAxisAngle(up,heading),results=[];
  for(const leg of this.legs){const hip=leg.hipOffset.clone().applyQuaternion(yaw).add(seatRoot);hip.y+=seatHeight-this.restPelvis;const ankle=V().set(leg.x*footWidthScale,leg.ankleY,0).applyAxisAngle(up,heading).add(anchor),requiredM=hip.distanceTo(ankle),maxM=leg.a+leg.b-.005,minM=Math.abs(leg.a-leg.b)+.002;results.push({side:leg.side,requiredM,minM,maxM,ok:requiredM<=maxM&&requiredM>=minM});}
  return {ok:results.every(result=>result.ok),legs:results};
 }
 cloneSeatedHipPose(pose=this.seatedHipPose){return pose?{offsets:pose.offsets.map(offset=>offset.clone()),poleElevations:[...pose.poleElevations],maxOffsetM:pose.maxOffsetM}:null;}
 cloneLegPoseHint(hint=this.legPoseHint){return hint?{offsets:hint.offsets.map(offset=>offset.clone()),poleElevations:[...hint.poleElevations]}:null;}
 captureLegPoseHint(poleElevations=this.seatedHipPose?.poleElevations||this.legs.map(()=>0)){
  const offsets=this.legs.map(leg=>leg.hip.position.clone().sub(leg.hipRestPosition));
  if(offsets.some(offset=>!Number.isFinite(offset.x)||!Number.isFinite(offset.y)||!Number.isFinite(offset.z)||offset.length()>.020001)||poleElevations.length!==this.legs.length||poleElevations.some(value=>!Number.isFinite(value)))return null;
  return {offsets,poleElevations:[...poleElevations]};
 }
 applyLegPoseHint(hint=this.legPoseHint){
  if(!hint||hint.offsets.length!==this.legs.length||hint.poleElevations.length!==this.legs.length||hint.offsets.some(offset=>!Number.isFinite(offset.x)||!Number.isFinite(offset.y)||!Number.isFinite(offset.z)||offset.length()>.020001)||hint.poleElevations.some(value=>!Number.isFinite(value)))return false;
  const previous=this.legs.map(leg=>({position:leg.hip.position.clone(),quaternions:[leg.hip.quaternion.clone(),leg.knee.quaternion.clone(),leg.ankle.quaternion.clone()]}));
  try{for(let index=0;index<this.legs.length;index++){const leg=this.legs[index];leg.hip.position.copy(leg.hipRestPosition).add(hint.offsets[index]);[leg.hip,leg.knee,leg.ankle].forEach((bone,boneIndex)=>bone.quaternion.copy(leg.rest[boneIndex]));this.updateLegWorld(leg);solve(leg,leg.point,this.heading,hint.poleElevations[index]);this.updateLegWorld(leg);}return true;}
  catch{this.legs.forEach((leg,index)=>{leg.hip.position.copy(previous[index].position);[leg.hip,leg.knee,leg.ankle].forEach((bone,boneIndex)=>bone.quaternion.copy(previous[index].quaternions[boneIndex]));});this.actor.updateMatrixWorld(true);return false;}
 }
 applySeatedHipPose(pose=this.seatedHipPose){
  if(!pose||pose.offsets.length!==this.legs.length)return false;
  const current=this.legs.map(leg=>({position:leg.hip.position.clone(),quaternions:[leg.hip.quaternion.clone(),leg.knee.quaternion.clone(),leg.ankle.quaternion.clone()]}));
  try{for(let i=0;i<this.legs.length;i++){const leg=this.legs[i];leg.hip.position.copy(leg.hipRestPosition).add(pose.offsets[i]);[leg.hip,leg.knee,leg.ankle].forEach((bone,index)=>bone.quaternion.copy(leg.rest[index]));this.updateLegWorld(leg);solve(leg,leg.point,this.heading,pose.poleElevations[i]);this.updateLegWorld(leg);}return true;}
  catch{this.legs.forEach((leg,index)=>{leg.hip.position.copy(current[index].position);[leg.hip,leg.knee,leg.ankle].forEach((bone,j)=>bone.quaternion.copy(current[index].quaternions[j]));});this.actor.updateMatrixWorld(true);return false;}
 }
 cloneDepartureTargets(targets=this.departureTargets){return targets?{points:targets.points.map(point=>point.clone()),yaws:[...targets.yaws]}:null;}
 captureInternal(){return {started:this.started,heading:this.heading,pelvis:this.pelvis,previous:this.previous?.clone()||null,swing:this.swing?{...this.swing,from:this.swing.from.clone(),to:this.swing.to.clone()}:null,swingPlan:this.swingPlan?{...this.swingPlan}:null,seatedHipPose:this.cloneSeatedHipPose(),legPoseHint:this.cloneLegPoseHint(),departureTargets:this.cloneDepartureTargets(),next:this.next,ready:this.ready,transitReady:this.transitReady,legs:this.legs.map(l=>({point:l.point?.clone()||null,yaw:l.yaw})),arm:this.armContact.captureInternal()};}
 restoreInternal(snapshot){this.started=snapshot.started;this.heading=snapshot.heading;this.pelvis=snapshot.pelvis;this.previous=snapshot.previous?.clone()||null;this.swing=snapshot.swing?{...snapshot.swing,from:snapshot.swing.from.clone(),to:snapshot.swing.to.clone()}:null;this.swingPlan=snapshot.swingPlan?{...snapshot.swingPlan}:null;this.seatedHipPose=this.cloneSeatedHipPose(snapshot.seatedHipPose);this.legPoseHint=this.cloneLegPoseHint(snapshot.legPoseHint);this.departureTargets=this.cloneDepartureTargets(snapshot.departureTargets);this.next=snapshot.next;this.ready=snapshot.ready;this.transitReady=!!snapshot.transitReady;this.legs.forEach((l,i)=>{l.point=snapshot.legs[i].point?.clone()||null;l.yaw=snapshot.legs[i].yaw;});this.armContact.restoreInternal(snapshot.arm);}
 rememberSafePose(segments){
  this.safePose={position:this.actor.position.clone(),quaternion:this.actor.quaternion.clone(),bodyPosition:this.body.position.clone(),bodyQuaternion:this.body.quaternion.clone(),bonePositions:this.legs.map(l=>l.hip.position.clone()),boneQuaternions:this.legs.map(l=>[l.hip.quaternion.clone(),l.knee.quaternion.clone(),l.ankle.quaternion.clone()]),armPose:this.armContact.capturePose(),internal:this.captureInternal(),segments:cloneCapsules(segments)};
 }
 restoreSafePose(){
  if(!this.safePose)return false;const pose=this.safePose;
  this.actor.position.copy(pose.position);this.actor.quaternion.copy(pose.quaternion);this.body.position.copy(pose.bodyPosition);this.body.quaternion.copy(pose.bodyQuaternion);
  this.legs.forEach((l,i)=>{l.hip.position.copy(pose.bonePositions[i]);[l.hip,l.knee,l.ankle].forEach((bone,j)=>bone.quaternion.copy(pose.boneQuaternions[i][j]));});this.armContact.restorePose(pose.armPose);this.restoreInternal(pose.internal);this.actor.updateMatrixWorld(true);return true;
 }
  *workingArmSteps(...args){const arm=this.armContact;return arm.applyWorking===TycoonArmContact.prototype.applyWorking?yield* arm.applyWorkingSteps(...args):arm.applyWorking(...args);}
  *sweepPoseSteps(...args){const world=this.collisionWorld;return world.sweepCapsules===TycoonCollisionWorld.prototype.sweepCapsules?yield* world.sweepCapsulesSteps(...args):world.sweepCapsules(...args);}
  *planSwingSteps(...args){return this.swingClearanceLift===ProbeContact.prototype.swingClearanceLift?yield* this.swingClearanceLiftSteps(...args):this.swingClearanceLift(...args);}
  update(...args){return drainPoseSteps(this.updateSteps(...args));}
  *updateSteps(state,phase,dt,{seatObjectId=null,seatPoint=null,seatFootAnchor=null,seatFootWidthScale=1,seatFootToeOutRad=0,entryFlexM=0,workSurfaceObjectId=null,contactSeatHeight=null,prepareDeparture=false}={}){
   if(!this.valid)throw Error('Unsupported probe skeleton');dt=Math.max(0,Math.min(dt,.1));this.transitReady=false;this.armContact.transitTargetReached=false;if(!['sit','working','standing','leaving'].includes(phase))this.seatedHipPose=null;if(!legPoseHintPhases.has(phase))this.legPoseHint=null;
  const actor=this.actor,root=actor.position.clone();
  if(!this.started){this.heading=state.heading||0;this.pelvis=this.restPelvis-.08;this.previous=root.clone();this.started=true;for(const l of this.legs){l.point=new THREE.Vector3(l.x,l.ankleY,.06).applyAxisAngle(up,this.heading).add(root);l.yaw=this.heading;}}
  this.heading+=THREE.MathUtils.clamp(angle(this.heading,state.heading||0),-dt*3,dt*3);actor.rotation.set(0,this.heading,0);
  const seatNear=phase==='entering'&&seatPoint&&root.distanceTo(seatPoint)<.8;
  const sitting=phase==='sit'||phase==='working';
  const velocity=root.clone().sub(this.previous).multiplyScalar(dt>0?1/dt:0);velocity.y=0;velocity.clampLength(0,.85);this.previous.copy(root);
  const preparingDeparture=phase==='leaving'&&prepareDeparture;
  if(!preparingDeparture)this.departureTargets=null;
  const approachBlend=phase==='approaching-seat'?THREE.MathUtils.clamp(state.seatApproachBlend||0,0,1):0,forwardFoot=['approaching-seat','entering','sit','working','standing','leaving'].includes(phase),seatFit=!!seatObjectId&&forwardFoot,anchorFeet=!!seatFootAnchor&&seatFit&&(['entering','sit','working','standing'].includes(phase)||(phase==='approaching-seat'&&approachBlend>0)),footOffset=phase==='approaching-seat'?.06:forwardFoot?(seatFit&&['entering','sit','working'].includes(phase)?.36:.30):.06,walkGoals=this.legs.map(l=>new THREE.Vector3(l.x,l.ankleY,footOffset).applyAxisAngle(up,this.heading).add(root).addScaledVector(velocity,preparingDeparture?0:.20)),anchorGoals=this.legs.map(l=>new THREE.Vector3(l.x*seatFootWidthScale,l.ankleY,0).applyAxisAngle(up,this.heading).add(new THREE.Vector3(seatFootAnchor?.x||0,0,seatFootAnchor?.z||0))),goals=this.legs.map((l,i)=>phase==='approaching-seat'?walkGoals[i].clone().lerp(anchorGoals[i],approachBlend):anchorFeet?anchorGoals[i]:walkGoals[i]),goalYaws=this.legs.map(l=>this.heading+(anchorFeet?(l.side==='left'?-1:1)*seatFootToeOutRad*(phase==='approaching-seat'?approachBlend:1):0));
  if(preparingDeparture){
   this.departureTargets??={points:goals.map(point=>point.clone()),yaws:[...goalYaws]};
   goals.forEach((point,index)=>point.copy(this.departureTargets.points[index]));goalYaws.splice(0,goalYaws.length,...this.departureTargets.yaws);
  }
  if(!this.swing){
   const threshold=['sit','working'].includes(phase)||velocity.length()<.01?.025:.12;
   for(const i of [this.next,1-this.next]){
    const l=this.legs[i];if(l.point.distanceTo(goals[i])<=threshold&&Math.abs(angle(l.yaw,goalYaws[i]))<=.12)continue;
    let target=goals[i],lift=.18,route=null,segmentLifts=null;this.swingPlan=null;
    const needsClearancePlan=(phase==='entering'&&seatNear)||phase==='approaching-seat'||phase==='leaving';
    if(needsClearancePlan){
     let plan=yield* this.planSwingSteps(l,l.point,target,l.yaw,goalYaws[i],phase),selectedOffset=null;
     if(!plan.ok&&['approaching-seat','leaving'].includes(phase)){
      const forward=new THREE.Vector3(Math.sin(this.heading),0,Math.cos(this.heading)),side=new THREE.Vector3(Math.cos(this.heading),0,-Math.sin(this.heading)),candidates=[[0,.08],[0,-.08],[0,.12],[0,-.12],[0,.16],[0,-.16],[-.05,0],[-.1,0],[-.15,0],[-.2,0],[-.1,.06],[-.1,-.06],[-.15,.08],[-.15,-.08],[-.2,.12],[-.2,-.12],[.05,0],[.1,0],[.15,0],[.2,0],[.1,.06],[.1,-.06],[.15,.08],[.15,-.08],[.15,.12],[.15,-.12]];
      for(const [advance,lateral] of candidates){
       const candidate=target.clone().addScaledVector(forward,advance).addScaledVector(side,lateral),hip=l.hipOffset.clone().applyAxisAngle(up,this.heading).add(root);hip.y+=this.pelvis-this.restPelvis;const required=hip.distanceTo(candidate);
       if(required>l.a+l.b-.005||required<Math.abs(l.a-l.b)+.005)continue;
       const candidatePlan=yield* this.planSwingSteps(l,l.point,candidate,l.yaw,goalYaws[i],phase);
       if(candidatePlan.ok){target=candidate;plan=candidatePlan;goals[i]=candidate;if(preparingDeparture)this.departureTargets.points[i].copy(candidate);selectedOffset={forwardM:advance,lateralM:lateral};break;}
      }
     }
     if(!plan.ok&&phase==='approaching-seat'&&approachBlend<.999){this.swingPlan={phase,side:l.side,from:l.point.toArray(),to:target.toArray(),ok:false,deferred:true,reason:'waiting-for-final-approach-anchor',minClearanceM:plan.failure?.clearanceM??null};continue;}
     this.swingPlan={phase,side:l.side,from:l.point.toArray(),to:target.toArray(),selectedOffset,...plan};
     if(!plan.ok)throw Object.assign(Error('Probe shoe cannot clear the measured furniture during its step'),{swingPlan:this.swingPlan});
     lift=plan.lift;route=plan.route||[target.clone()];segmentLifts=plan.segmentLifts||[lift];
    }
    this.swing={i,time:0,from:l.point.clone(),to:target,route:route||[target.clone()],segmentLifts:segmentLifts||[lift],segmentIndex:0,yaw:l.yaw,toYaw:goalYaws[i],lift,phase};this.next=1-i;break;
   }
  }
  if(this.swing&&((phase==='entering'&&seatNear)||phase==='approaching-seat'||phase==='leaving')){const s=this.swing,l=this.legs[s.i],targetChanged=s.to.distanceTo(goals[s.i])>.025||Math.abs(angle(s.toYaw,goalYaws[s.i]))>.02;if(s.phase!==phase||(phase!=='approaching-seat'&&phase!=='leaving'&&targetChanged)){const plan=yield* this.planSwingSteps(l,l.point,goals[s.i],l.yaw,goalYaws[s.i],phase);this.swingPlan={phase,side:l.side,from:l.point.toArray(),to:goals[s.i].toArray(),replanned:true,...plan};if(!plan.ok)throw Object.assign(Error('Probe shoe cannot clear the measured furniture during its step'),{swingPlan:this.swingPlan});this.swing={i:s.i,time:0,from:l.point.clone(),to:goals[s.i],route:plan.route||[goals[s.i].clone()],segmentLifts:plan.segmentLifts||[plan.lift],segmentIndex:0,yaw:l.yaw,toYaw:goalYaws[s.i],lift:plan.lift,phase};}}
  if(this.swing){const s=this.swing,l=this.legs[s.i],route=s.route?.length?s.route:[s.to],index=s.segmentIndex||0,start=index===0?s.from:route[index-1],target=route[index],lift=s.segmentLifts?.[index]??s.lift,duration=.28/route.length;s.time+=dt;const u=Math.min(1,s.time/duration),t=smooth(u),fraction=(index+t)/route.length;l.point.copy(start).lerp(target,t);l.point.y+=lift*Math.sin(Math.PI*t);l.yaw=s.yaw+angle(s.yaw,s.toYaw)*fraction;if(u===1){l.point.copy(target);if(index+1<route.length){s.segmentIndex=index+1;s.time=0;}else this.swing=null;}}
  const feetReady=!this.swing&&this.legs.every((l,i)=>l.point.distanceTo(goals[i])<.026&&Math.abs(angle(l.yaw,goalYaws[i]))<.13);
  const standing=this.restPelvis-.08-(phase==='entering'&&seatNear?entryFlexM:0),desired=sitting&&(feetReady||phase==='entering')?(state.seatHeight??.551132):sitting?this.pelvis:standing;
  // Standing holds its low pelvis until the feet have returned underneath it.
  const goal=!sitting&&!feetReady?Math.min(this.pelvis,standing):desired;
  this.pelvis+=THREE.MathUtils.clamp(goal-this.pelvis,-dt*.5,dt*.5);
  this.restore();actor.updateMatrixWorld(true);
  const offset=V().set(0,this.pelvis-this.restPelvis,0).applyQuaternion(this.body.parent.getWorldQuaternion(Q()).invert());this.body.position.add(offset);actor.updateMatrixWorld(true);
  let drop=0;
  for(const l of this.legs){const h=l.hip.getWorldPosition(V()),horizontal=Math.hypot(l.point.x-h.x,l.point.z-h.z),reach=l.a+l.b-.002;if(horizontal>=reach)throw Error('Probe step exceeds leg reach');drop=Math.max(drop,h.y-l.point.y-Math.sqrt(reach*reach-horizontal*horizontal));}
  if(drop>0){this.body.position.add(V().set(0,-drop,0).applyQuaternion(this.body.parent.getWorldQuaternion(Q()).invert()));actor.updateMatrixWorld(true);}
  for(const l of this.legs){solve(l,l.point,this.heading);this.updateLegWorld(l,true);}
  if(['sit','working'].includes(phase)&&this.seatedHipPose&&!this.applySeatedHipPose())this.seatedHipPose=null;
  this.ready=feetReady&&Math.abs(this.pelvis-desired)<.001&&drop<.001;
  let armResult={ok:true};
  if(['sit','working'].includes(phase)&&workSurfaceObjectId&&this.ready&&this.armContact.lapStage>=2)armResult=yield* this.workingArmSteps(phase,workSurfaceObjectId,dt);
  else if(workSurfaceObjectId&&seatObjectId&&seatPoint&&seatFootAnchor&&['walking','turning'].includes(phase))armResult=this.armContact.applyLap(phase,dt,state.seatHeight??contactSeatHeight,seatObjectId,seatPoint,seatFootAnchor);
  else if(['approaching-seat','entering','sit','standing','leaving'].includes(phase)||(phase==='working'&&!workSurfaceObjectId))armResult=this.armContact.applyLap(phase,dt,state.seatHeight??contactSeatHeight,seatObjectId,seatPoint,seatFootAnchor);
  else{this.armContact.active=false;this.armContact.lastDiagnostic={...this.armContact.lastDiagnostic,ok:true,status:'clearance-only',phase,collisionHit:null};}
  if(!armResult.ok){const safePosition=this.safePose?.position.clone()||null,attemptedPosition=actor.position.clone();this.restoreSafePose();this.armContact.lastDiagnostic=armResult.diagnostic;this.lastCollision={ok:false,phase,checkedCapsules:0,testedTriangles:0,sampleCount:0,minClearanceM:null,hit:{objectId:workSurfaceObjectId||null,mesh:null,limb:'arm-contact',side:null,clearanceM:null,reason:armResult.diagnostic.reason},stepBackoffM:safePosition?attemptedPosition.distanceTo(safePosition):null,safeRoot:safePosition?.toArray()||null,attemptedRoot:attemptedPosition.toArray(),armContact:this.armContact.lastDiagnostic};return {ok:false,ready:false,collision:this.lastCollision};}
  // Hip/knee candidates below never modify the torso or arms. Extract their
  // current measured capsules once for this pass; the next update reads anew.
  const armCapsules=this.armContact.capsules(),collectSegments=()=>this.limbCapsules(armCapsules,true,true),segments=collectSegments(),from=this.safePose?.segments||segments,activeSwingPlan=this.swingPlan?{...this.swingPlan}:null;
  const sweepOptions={phase,seatObjectId,seatPoint,seatHeight:state.seatHeight,seatSupportRadius:.32,allowSeatSupport:!!seatNear};
  this.lastCollision=(this.collisionWorld?yield* this.sweepPoseSteps(from,segments,sweepOptions):null)||{ok:true,phase,checkedCapsules:segments.length,testedTriangles:0,sampleCount:1,minClearanceM:null,hit:null};
  yield;
  const baseCollision=this.lastCollision;let sweepBatch=null,sweepBatchInitialized=false;
  const sweepCandidate=function*(candidate){if(!sweepBatchInitialized){sweepBatchInitialized=true;if(baseCollision?.ok===false&&this.collisionWorld?.createSweepBatch){const repairBounds=new THREE.Box3().makeEmpty();let maximumRadius=0;for(const capsule of [...from,...segments]){repairBounds.expandByPoint(capsule.start);repairBounds.expandByPoint(capsule.end);maximumRadius=Math.max(maximumRadius,capsule.radius);}repairBounds.expandByScalar(maximumRadius+.75);sweepBatch=this.collisionWorld.createSweepBatch(sweepOptions,{useWitnesses:true,witnessSeed:baseCollision,bounds:repairBounds});}}return yield* this.sweepPoseSteps(from,candidate,sweepOptions,sweepBatch);}.bind(this),candidateHit=candidate=>candidate.hit?{limb:candidate.hit.limb,clearanceM:candidate.hit.clearanceM,mesh:candidate.hit.mesh,...(candidate.hit.method?{method:candidate.hit.method}:{})}:null;
  let kneePoleAdjustmentRad=0,kneePoleSearch=[],clearanceHipOffset=null,pairedHipOffsetM=null;
  if(!this.lastCollision.ok&&legPoseHintPhases.has(phase)&&/-(thigh|shin)$/.test(this.lastCollision.hit?.limb||'')&&this.legs.length===2&&this.legPoseHint){
   const hint=this.cloneLegPoseHint(),previous=this.legs.map(leg=>({position:leg.hip.position.clone(),quaternions:[leg.hip.quaternion.clone(),leg.knee.quaternion.clone(),leg.ankle.quaternion.clone()]}));let accepted=false;
   if(this.applyLegPoseHint(hint)){
    yield;const candidateSegments=collectSegments(),candidate=yield* sweepCandidate(candidateSegments);
    kneePoleSearch.push({parameterHint:true,hipOffsetsM:hint.offsets.map(offset=>offset.length()),poleElevations:[...hint.poleElevations],ok:candidate.ok,hit:candidateHit(candidate)});
    if(candidate.ok){segments.splice(0,segments.length,...candidateSegments);this.lastCollision=candidate;this.legPoseHint=this.cloneLegPoseHint(hint);pairedHipOffsetM=Math.max(...hint.offsets.map(offset=>offset.length()));accepted=true;}
   }
   if(!accepted){this.legPoseHint=null;this.legs.forEach((leg,index)=>{leg.hip.position.copy(previous[index].position);[leg.hip,leg.knee,leg.ankle].forEach((bone,boneIndex)=>bone.quaternion.copy(previous[index].quaternions[boneIndex]));});actor.updateMatrixWorld(true);}
  }
  if(this.seatedHipPose&&['standing','leaving'].includes(phase)){
   const neutral=this.legs.map(leg=>({position:leg.hip.position.clone(),quaternions:[leg.hip.quaternion.clone(),leg.knee.quaternion.clone(),leg.ankle.quaternion.clone()]}));
   const warmPose=this.cloneSeatedHipPose();let warmStarted=false;
   if(this.applySeatedHipPose()){
    yield;const candidateSegments=collectSegments(),candidate=yield* sweepCandidate(candidateSegments);
    kneePoleSearch.push({warmStartedHipOffsetM:warmPose.maxOffsetM,ok:candidate.ok,hit:candidateHit(candidate)});
    if(candidate.ok){segments.splice(0,segments.length,...candidateSegments);this.lastCollision=candidate;pairedHipOffsetM=warmPose.maxOffsetM;this.legPoseHint=this.cloneLegPoseHint(warmPose);warmStarted=true;}
   }
   if(!warmStarted){
    this.legs.forEach((leg,index)=>{leg.hip.position.copy(neutral[index].position);[leg.hip,leg.knee,leg.ankle].forEach((bone,j)=>bone.quaternion.copy(neutral[index].quaternions[j]));});actor.updateMatrixWorld(true);
   }
  }
  if(!this.lastCollision.ok&&['sit','working','standing','leaving'].includes(phase)&&/-(thigh|shin)$/.test(this.lastCollision.hit?.limb||'')&&this.legs.length===2){
   const failure=this.lastCollision,normal=failure.hit?.surfaceNormal?new THREE.Vector3(failure.hit.surfaceNormal[0],0,failure.hit.surfaceNormal[2]):new THREE.Vector3(),directions=[];
   if(normal.lengthSq()>1e-8){normal.normalize();const tangent=new THREE.Vector3(-normal.z,0,normal.x),vertical=new THREE.Vector3(0,1,0);directions.push(normal,tangent,normal.clone().add(tangent).normalize(),normal.clone().sub(tangent).normalize(),tangent.clone().negate(),normal.clone().negate(),normal.clone().add(vertical).normalize(),normal.clone().sub(vertical).normalize(),tangent.clone().add(vertical).normalize(),tangent.clone().sub(vertical).normalize(),vertical,vertical.clone().negate());}
   else{const forward=new THREE.Vector3(Math.sin(this.heading),0,Math.cos(this.heading)),side=new THREE.Vector3(Math.cos(this.heading),0,-Math.sin(this.heading)),vertical=new THREE.Vector3(0,1,0);directions.push(forward,side,forward.clone().add(side).normalize(),forward.clone().sub(side).normalize(),side.clone().negate(),forward.clone().negate(),forward.clone().add(vertical).normalize(),forward.clone().sub(vertical).normalize(),side.clone().add(vertical).normalize(),side.clone().sub(vertical).normalize(),vertical,vertical.clone().negate());}
   const original=this.legs.map(leg=>({position:leg.hip.position.clone(),quaternions:[leg.hip.quaternion.clone(),leg.knee.quaternion.clone(),leg.ankle.quaternion.clone()]}));let accepted=false;
   for(const distance of [.004,.005,.006,.007,.008,.012,.016,.02]){
    for(const direction of directions){
     const offsets=this.legs.map(leg=>direction.clone().multiplyScalar(distance).applyQuaternion(freshWorldQuaternion(leg.hip.parent).invert()));
     let reachable=true;
     for(let i=0;i<this.legs.length;i++){
      const leg=this.legs[i];leg.hip.position.copy(leg.hipRestPosition).add(offsets[i]);[leg.hip,leg.knee,leg.ankle].forEach((bone,index)=>bone.quaternion.copy(leg.rest[index]));this.updateLegWorld(leg,true);
      try{solve(leg,leg.point,this.heading);}catch{reachable=false;break;}this.updateLegWorld(leg,true);
     }
     if(!reachable||this.legs.some((leg,index)=>leg.hip.position.distanceTo(leg.hipRestPosition)>.020001))continue;
     yield;const candidateSegments=collectSegments(),candidate=yield* sweepCandidate(candidateSegments);
     kneePoleSearch.push({pairedHipOffsetM:distance,direction:direction.toArray(),ok:candidate.ok,hit:candidateHit(candidate)});
      if(candidate.ok){segments.splice(0,segments.length,...candidateSegments);this.lastCollision=candidate;this.seatedHipPose={offsets:offsets.map(offset=>offset.clone()),poleElevations:[0,0],maxOffsetM:distance};this.legPoseHint={offsets:offsets.map(offset=>offset.clone()),poleElevations:[0,0]};pairedHipOffsetM=distance;accepted=true;break;}
    }
    if(accepted)break;
   }
   if(!accepted){this.legs.forEach((leg,index)=>{leg.hip.position.copy(original[index].position);[leg.hip,leg.knee,leg.ankle].forEach((bone,j)=>bone.quaternion.copy(original[index].quaternions[j]));});actor.updateMatrixWorld(true);}
  }
  if(!this.lastCollision.ok&&['approaching-seat','entering','sit','working','standing','leaving'].includes(phase)&&/-(thigh|shin)$/.test(this.lastCollision.hit?.limb||'')){
   // Entry and seated targets can put a thigh across a real chair edge. Try measured joint poses with the foot anchor fixed; only a clear swept pose is accepted.
   const failure=this.lastCollision,leg=this.legs.find(candidate=>candidate.side===failure.hit.side),rest=leg&&[leg.hip.quaternion.clone(),leg.knee.quaternion.clone(),leg.ankle.quaternion.clone()];
   if(leg)for(const magnitude of [10,20,30,40,50,60].map(THREE.MathUtils.degToRad)){
    let accepted=false;
    for(const elevation of [magnitude,-magnitude]){
     [leg.hip,leg.knee,leg.ankle].forEach((bone,index)=>bone.quaternion.copy(leg.rest[index]));this.updateLegWorld(leg,true);
     try{solve(leg,leg.point,this.heading,elevation);}catch{continue;}this.updateLegWorld(leg,true);
     yield;const candidateSegments=collectSegments(),candidate=yield* sweepCandidate(candidateSegments);
     kneePoleSearch.push({elevationRad:elevation,ok:candidate.ok,hit:candidateHit(candidate)});
      if(candidate.ok){segments.splice(0,segments.length,...candidateSegments);this.lastCollision=candidate;kneePoleAdjustmentRad=elevation;const poleElevations=this.legs.map((_,index)=>this.seatedHipPose?.poleElevations[index]??0);poleElevations[this.legs.indexOf(leg)]=elevation;this.legPoseHint=this.captureLegPoseHint(poleElevations);accepted=true;break;}
    }
    if(accepted)break;
   }
   if(!this.lastCollision.ok&&leg&&rest){
    [leg.hip,leg.knee,leg.ankle].forEach((bone,index)=>bone.quaternion.copy(rest[index]));actor.updateMatrixWorld(true);
    const normal=failure.hit?.surfaceNormal?new THREE.Vector3(failure.hit.surfaceNormal[0],0,failure.hit.surfaceNormal[2]):new THREE.Vector3(),directions=[];
    if(normal.lengthSq()>1e-8){normal.normalize();const tangent=new THREE.Vector3(-normal.z,0,normal.x);directions.push(normal,tangent,normal.clone().add(tangent).normalize(),normal.clone().sub(tangent).normalize(),tangent.clone().negate(),normal.clone().negate());}
    else directions.push(new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1));
    const baseHip=leg.hip.position.clone(),inverseParent=freshWorldQuaternion(leg.hip.parent).invert();let accepted=false;
    for(const distance of [.004,.005,.006,.007,.008,.012,.016,.02]){
     for(const direction of directions){
      const localOffset=direction.clone().applyQuaternion(inverseParent).multiplyScalar(distance);
      for(const elevationRad of [0,...[10,20,30].flatMap(degrees=>[1,-1].map(sign=>THREE.MathUtils.degToRad(degrees*sign)))]){
       leg.hip.position.copy(baseHip).add(localOffset);if(leg.hip.position.distanceTo(leg.hipRestPosition)>.020001){leg.hip.position.copy(baseHip);continue;}[leg.hip,leg.knee,leg.ankle].forEach((bone,index)=>bone.quaternion.copy(leg.rest[index]));this.updateLegWorld(leg,true);
       try{solve(leg,leg.point,this.heading,elevationRad);}catch{leg.hip.position.copy(baseHip);continue;}this.updateLegWorld(leg,true);
       yield;const candidateSegments=collectSegments(),candidate=yield* sweepCandidate(candidateSegments);
       kneePoleSearch.push({hipOffsetM:distance,direction:direction.toArray(),elevationRad,ok:candidate.ok,hit:candidateHit(candidate)});
       if(candidate.ok){segments.splice(0,segments.length,...candidateSegments);this.lastCollision=candidate;kneePoleAdjustmentRad=elevationRad;clearanceHipOffset={distanceM:distance,direction:direction.toArray()};const poleElevations=this.legs.map((_,index)=>this.seatedHipPose?.poleElevations[index]??0);poleElevations[this.legs.indexOf(leg)]=elevationRad;this.legPoseHint=this.captureLegPoseHint(poleElevations);accepted=true;break;}
       leg.hip.position.copy(baseHip);
      }
      if(accepted)break;
     }
     if(accepted)break;
    }
    if(!accepted){leg.hip.position.copy(baseHip);[leg.hip,leg.knee,leg.ankle].forEach((bone,index)=>bone.quaternion.copy(rest[index]));actor.updateMatrixWorld(true);}
   }
   if(!this.lastCollision.ok&&leg&&rest)[leg.hip,leg.knee,leg.ankle].forEach((bone,index)=>bone.quaternion.copy(rest[index]));
   actor.updateMatrixWorld(true);
  }
  if(!this.lastCollision.ok){
   const failure=this.lastCollision,attemptArmContact=this.armContact.lastDiagnostic,safePosition=this.safePose?.position.clone()||null,attemptedPosition=actor.position.clone();this.restoreSafePose();this.legPoseHint=null;this.armContact.setCollision(failure);
   const stepBackoffM=safePosition?attemptedPosition.distanceTo(safePosition):null;this.lastCollision={...failure,stepBackoffM,safeRoot:safePosition?.toArray()||null,attemptedRoot:attemptedPosition.toArray(),swingClearancePlan:activeSwingPlan,kneePoleSearch,armContact:this.armContact.lastDiagnostic,armContactAttempt:attemptArmContact};
   return {ok:false,ready:false,collision:this.lastCollision};
  }
  if(this.seatedHipPose&&['sit','working'].includes(phase)&&this.lastCollision.ok)this.legPoseHint=this.cloneLegPoseHint(this.seatedHipPose);this.lastCollision.swingClearancePlan=activeSwingPlan;if(kneePoleAdjustmentRad)this.lastCollision.kneePoleAdjustmentRad=kneePoleAdjustmentRad;if(clearanceHipOffset)this.lastCollision.clearanceHipOffset=clearanceHipOffset;if(pairedHipOffsetM)this.lastCollision.pairedHipOffsetM=pairedHipOffsetM;else if(this.seatedHipPose&&['sit','working'].includes(phase))this.lastCollision.pairedHipOffsetM=this.seatedHipPose.maxOffsetM;this.armContact.setCollision(this.lastCollision);this.lastCollision.armContact=this.armContact.lastDiagnostic;this.transitReady=typeof this.collisionWorld?.sweepCapsules==='function'&&this.lastCollision.ok===true&&this.lastCollision.checkedCapsules>0&&this.armContact.transitTargetReached;this.rememberSafePose(segments);return {ok:true,ready:this.ready,feetReady,collision:this.lastCollision};
 }
}
