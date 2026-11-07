// Render-owned suspension: only a completed, checked pose becomes visible.
// @tested tests/tycoon-pose-resume.test.mjs
function captureActivity(activity){
 return {fields:{...activity},snapshot:activity.snapshot?{...activity.snapshot,position:{...activity.snapshot.position}}:null,reservations:activity.reservations?[...activity.reservations]:null};
}
function restoreActivity(activity,state){
 for(const key of Object.keys(activity))if(!(key in state.fields))delete activity[key];
 Object.assign(activity,state.fields);
 if(state.snapshot){for(const key of Object.keys(activity.snapshot))if(!(key in state.snapshot))delete activity.snapshot[key];Object.assign(activity.snapshot,state.snapshot);}
 if(state.reservations){activity.reservations.clear();for(const id of state.reservations)activity.reservations.add(id);}
}
function capturePose(actor){
 const nodes=[];actor.traverse(node=>nodes.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone(),visible:node.visible}));
 return {nodes,clip:actor.userData.clip,probeSnapshot:actor.userData.probeSnapshot,diagnostics:actor.userData.limbCollisionDiagnostics};
}
function captureContact(actor){
 const contact=actor.userData.contact;
 return contact?.valid&&contact.captureInternal?{contact,internal:contact.captureInternal(),safePose:contact.safePose,lastCollision:contact.lastCollision,supportSearchDiagnostics:structuredClone(contact.armContact.supportSearchDiagnostics)}:null;
}
function restoreContact(state){
 if(!state)return;state.contact.restoreInternal(state.internal);state.contact.safePose=state.safePose;state.contact.lastCollision=state.lastCollision;state.contact.armContact.supportSearchDiagnostics=state.supportSearchDiagnostics;
}
function restorePose(actor,pose){
 for(const item of pose.nodes){item.node.position.copy(item.position);item.node.quaternion.copy(item.quaternion);item.node.scale.copy(item.scale);item.node.visible=item.visible;}
 Object.assign(actor.userData,{clip:pose.clip,probeSnapshot:pose.probeSnapshot,limbCollisionDiagnostics:pose.diagnostics});actor.updateMatrixWorld(true);
}
export class PoseTransaction{
 constructor(actor,activity,steps){
  this.actor=actor;this.activity=activity;this.steps=steps;this.publishedPose=capturePose(actor);this.publishedActivity=captureActivity(activity);this.publishedContact=captureContact(actor);this.events=[];this.done=false;this.checkpoints=0;
 }
 advance(shouldYield=()=>true){
  if(this.done)return {done:true,value:undefined};
  if(this.pendingPose){restorePose(this.actor,this.pendingPose);restoreActivity(this.activity,this.pendingActivity);restoreContact(this.pendingContact);}
  const callback=this.publishedActivity.fields.onStatus;
  this.activity.onStatus=message=>this.events.push(message);
  let result;
  try{do{result=this.steps.next();if(!result.done){this.checkpoints++;this.lastCheckpoint=result.value;}}while(!result.done&&!shouldYield());}catch(error){restorePose(this.actor,this.publishedPose);restoreActivity(this.activity,this.publishedActivity);restoreContact(this.publishedContact);this.done=true;this.failed=true;this.events=[];throw error;}
  this.activity.onStatus=callback;
  if(result.done){this.done=true;for(const message of this.events){if(this.cancelled)break;callback?.call(this.activity,message);}this.events=[];return result;}
  this.pendingPose=capturePose(this.actor);this.pendingActivity=captureActivity(this.activity);this.pendingContact=captureContact(this.actor);
  restorePose(this.actor,this.publishedPose);restoreActivity(this.activity,this.publishedActivity);restoreContact(this.publishedContact);
  return result;
 }
 cancel(){this.done=true;this.cancelled=true;this.events=[];this.pendingPose=null;this.pendingActivity=null;this.steps=null;}
}

export function drainPoseSteps(steps){let result;do{result=steps.next();}while(!result.done);return result.value;}
