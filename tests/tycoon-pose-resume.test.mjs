import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {PoseTransaction} from '../web/tycoon-pose-transaction.js';
import {TycoonScene} from '../web/tycoon-scene.js';
import * as sceneModule from '../web/tycoon-scene.js';
import {FramePacer} from '../web/tycoon-frame-pacer.js';

const drain=steps=>{let item;do{item=steps.next();}while(!item.done);return item.value;};
test('resumed sweeps retain every ordered sample and identical diagnostics',()=>{
 const world=new TycoonCollisionWorld([]),cap=x=>({name:'left-shoe',side:'left',start:new THREE.Vector3(x,1,0),end:new THREE.Vector3(x,1,.1),radius:.03}),from=[cap(0)],to=[cap(.2)];
 const expected=world.sweepCapsules(from,to,{phase:'leaving'}),steps=world.sweepCapsulesSteps(from,to,{phase:'leaving'});
 let yields=0,item;do{item=steps.next();if(!item.done)yields++;}while(!item.done);
 assert.ok(yields>=10,'sweep must yield inside its ordered sample loop');assert.deepEqual(item.value,expected);
});
test('shoe clearance resumes within a lift search without repeating samples',()=>{
 const f={collisionWorld:{inspectCapsules(){calls++;return {ok:true,minClearanceM:.02};}},shoeCapsuleAt:()=>({})};let calls=0;
 const args=[{},new THREE.Vector3(),new THREE.Vector3(.3,0,0),0,0,'leaving'];
 const steps=ProbeContact.prototype.swingClearanceLiftSteps.call(f,...args);steps.next();steps.next();const first=calls;assert.ok(first>0&&first<40);
 const actual=drain(steps),resumedCalls=calls;calls=0;
 const expected=ProbeContact.prototype.swingClearanceLift.call(f,...args);assert.deepEqual(actual,expected);assert.equal(resumedCalls,calls);
});
test('suspended pose hides transforms, activity and status until a complete commit',()=>{
 const actor=new THREE.Object3D(),child=new THREE.Object3D();actor.add(child);const events=[],snapshot={position:{x:1,y:2},clip:'walk'},activity={snapshot,phase:'walking',elapsed:0,path:[],reservations:new Set(['seat']),onStatus(m){assert.equal(this,activity,'preserve the activity callback receiver');events.push(m);}};
 function* solve(){activity.elapsed+=1/60;activity.snapshot.position={x:3,y:4};activity.phase='working';actor.position.x=2;child.position.y=7;activity.onStatus('ready');yield;actor.position.x=3;return 42;}
 const job=new PoseTransaction(actor,activity,solve());assert.equal(job.advance().done,false);
 assert.equal(actor.position.x,0);assert.equal(child.position.y,0);assert.equal(activity.phase,'walking');assert.equal(activity.elapsed,0);assert.equal(activity.snapshot,snapshot);assert.deepEqual(snapshot.position,{x:1,y:2});assert.deepEqual(events,[]);
 const result=job.advance();assert.deepEqual(result,{done:true,value:42});assert.equal(actor.position.x,3);assert.equal(child.position.y,7);assert.equal(activity.snapshot,snapshot);assert.equal(activity.phase,'working');assert.equal(activity.elapsed,1/60);assert.deepEqual(events,['ready']);
});
test('abandoning a suspended pose never publishes its pending status or geometry',()=>{
 const actor=new THREE.Object3D(),events=[],activity={snapshot:{position:{x:0,y:0}},phase:'walking',onStatus:m=>events.push(m)};
 function* solve(){actor.position.x=99;activity.phase='working';activity.onStatus('stale');yield;actor.position.x=100;}
 const job=new PoseTransaction(actor,activity,solve());job.advance();job.cancel();assert.equal(actor.position.x,0);assert.equal(activity.phase,'walking');assert.deepEqual(events,[]);assert.equal(job.advance().done,true);assert.equal(actor.position.x,0);
});

function scheduled(){
 let time=0,ticks=0,checks=0;const actor=new THREE.Object3D(),snapshot={position:{x:1000,y:1000},heading:0,clip:'idle'},activity={snapshot,phase:'walking',elapsed:0,tick(dt){ticks++;this.elapsed+=dt;}};
 actor.userData.probeSnapshot=snapshot;
 actor.userData.contact={restore(){},reset(){},update(){throw Error('resumable path required');},*updateSteps(){for(let i=0;i<5;i++){checks++;time+=3;actor.position.x=i+1;yield;}return {ok:true,ready:true,feetReady:true,collision:{ok:true}};}};
 const scene={ready:true,activity,play(){},probeNow:()=>time,probeStepBudgetMs:4};return {scene,actor,activity,snapshot,ticks:()=>ticks,checks:()=>checks,step:dt=>TycoonScene.prototype.updateProbe.call(scene,actor,dt)};
}
test('scene resumes a costly fixed step over frames, retains its debt and publishes exactly one tick',()=>{
 const f=scheduled();f.step(1/60);assert.equal(f.ticks(),1);assert.equal(f.checks(),2);assert.equal(f.actor.position.x,0);assert.equal(f.activity.elapsed,0);assert.equal(f.scene.lastProbeStepMetrics.steps,0);assert.equal(f.scene.probeClock.remainder,1/60);
 f.step(0);assert.equal(f.ticks(),1);assert.equal(f.actor.position.x,0);f.step(0);
 assert.equal(f.ticks(),1);assert.equal(f.activity.elapsed,1/60);assert.equal(f.actor.position.x,5);assert.equal(f.scene.lastProbeStepMetrics.steps,1);assert.equal(f.scene.probeClock.remainder,0);
});
test('Stop and replacement snapshot cancel the old solve before any further checkpoint',()=>{
 for(const replacement of [null,{position:{x:2000,y:1000},heading:0,clip:'idle'}]){
  const f=scheduled();f.step(1/60);const old=f.scene.poseSolve;f.activity.snapshot=replacement;
  if(!replacement)f.activity.phase='idle';
  f.actor.userData.contact.update=()=>({ok:true,ready:true,feetReady:true,collision:{ok:true}});
  f.step(0);assert.equal(old.done,true);assert.equal(f.checks(),2);assert.equal(f.scene.poseSolve,null);assert.equal(f.activity.snapshot,replacement);assert.equal(f.activity.elapsed,0);
 }
});
test('world replacement, unavailable scene and disposal discard a suspended solve',()=>{
 for(const change of [f=>{f.scene.collisionWorld={};},f=>{f.scene.ready=false;},f=>{f.scene.disposed=true;},f=>{f.scene.activity=null;}]){
  const f=scheduled();f.step(1/60);const old=f.scene.poseSolve;change(f);f.step(0);
  assert.equal(old.done,true);assert.equal(f.checks(),2);assert.equal(f.scene.poseSolve,null);assert.equal(f.actor.position.x,0);
 }
});
test('unlimited-budget continuation drains an existing job without starting another tick',()=>{
 const f=scheduled();f.step(1/60);f.scene.probeStepBudgetMs=Infinity;f.step(0);
 assert.equal(f.ticks(),1);assert.equal(f.checks(),5);assert.equal(f.activity.elapsed,1/60);assert.equal(f.scene.poseSolve,null);assert.equal(f.scene.probeClock.remainder,0);
});
test('a throwing solve restores its published state and suppresses buffered events',()=>{
 const actor=new THREE.Object3D(),events=[],activity={phase:'walking',snapshot:{position:{x:0,y:0}},onStatus:m=>events.push(m)};
 function* solve(){actor.position.x=12;activity.phase='working';activity.onStatus('pending');yield;throw Error('invalid geometry');}
 const job=new PoseTransaction(actor,activity,solve());job.advance();assert.throws(()=>job.advance(),/invalid geometry/);assert.equal(actor.position.x,0);assert.equal(activity.phase,'walking');assert.deepEqual(events,[]);
});
test('a status callback can synchronously Stop on commit without resuming or dereferencing the discarded job',()=>{
 const f=scheduled(),messages=[];f.activity.stop=function(){this.snapshot=null;this.phase='idle';};f.activity.onStatus=message=>{messages.push(message);TycoonScene.prototype.stopTest.call(f.scene);};
 f.actor.userData.contact.updateSteps=function*(){f.activity.onStatus('completed');f.activity.onStatus('later');yield;return {ok:true,ready:true,feetReady:true,collision:{ok:true}};};
 assert.doesNotThrow(()=>f.step(1/60));assert.equal(f.activity.snapshot,null);assert.equal(f.scene.poseSolve,null);assert.equal(f.scene.probeClock.remainder,0);assert.deepEqual(messages,['completed'],'Stop suppresses the remaining buffered statuses');
});
test('an unexpected tick exception clears the scene job and leaves the published pose',()=>{
 const f=scheduled();f.activity.tick=()=>{throw Error('tick failed');};assert.throws(()=>f.step(1/60),/tick failed/);assert.equal(f.scene.poseSolve,null);assert.equal(f.actor.position.x,0);assert.equal(f.activity.elapsed,0);
});
test('default work allowance gives 30 Hz room for two fixed steps and retains the native-rate allowance',()=>{
 assert.equal(sceneModule.defaultProbeStepBudgetMs(30),12);assert.equal(sceneModule.defaultProbeStepBudgetMs(0),8);
});
test('rate changes adapt only the automatic work budget and preserve explicit overrides and pending work',()=>{
 const pending={},automatic={framePacer:new FramePacer(0),autoProbeStepBudget:true,probeStepBudgetMs:8,poseSolve:pending};
 TycoonScene.prototype.setFrameRate.call(automatic,30);assert.equal(automatic.probeStepBudgetMs,12);assert.equal(automatic.poseSolve,pending);
 TycoonScene.prototype.setFrameRate.call(automatic,0);assert.equal(automatic.probeStepBudgetMs,8);assert.equal(automatic.poseSolve,pending);
 for(const budget of [0,8,Infinity,null]){const explicit={framePacer:new FramePacer(0),autoProbeStepBudget:false,probeStepBudgetMs:budget};TycoonScene.prototype.setFrameRate.call(explicit,30);assert.equal(explicit.probeStepBudgetMs,budget);}
 assert.throws(()=>TycoonScene.prototype.setFrameRate.call(automatic,15),/Unsupported frame rate/);assert.equal(automatic.probeStepBudgetMs,8);
});
