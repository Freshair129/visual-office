import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TycoonScene} from '../web/tycoon-scene.js';

test('partially loaded scene cannot construct contact or advance the activity',()=>{
  const actor=new THREE.Object3D();actor.visible=true;
  let ticks=0;
  TycoonScene.prototype.updateProbe.call({ready:false,activity:{tick(){ticks++;}}},actor,.02);
  assert.equal(ticks,0);
  assert.equal(actor.userData.contact,undefined);
  assert.equal(actor.visible,false);
});

// Control-flow regression only; actual rig, contact and GPU lifecycle are tested separately.
function updateWaitingContact({elapsed,status='approaching'}){
  const state={position:{x:0,y:0},heading:0,clip:'sitting'};
  let restored=false,blocked=null;
  const contact={
    safePose:{position:new THREE.Vector3()},heading:0,
    restore(){},reset(){},restoreSafePose(){restored=true;},
    update(){return {ok:true,ready:true,collision:{ok:true,armContact:{ok:true,status}}};},
    armContact:{lastDiagnostic:{ok:true,status}},
  };
  const actor=new THREE.Object3D();actor.userData.contact=contact;actor.userData.probeSnapshot=state;
  const activity={phase:'sit',elapsed,snapshot:state,station:{type:'desk',objectId:'desk-1'},tick(){},
    blockMotion(message,position,heading){blocked={message,position,heading};this.phase='blocked';}};
  TycoonScene.prototype.updateProbe.call({activity,play(){}},actor,.1);
  return {actor,activity,restored,blocked};
}

test('seated probe refuses contact acquisition that remains incomplete beyond the bound',()=>{
  const result=updateWaitingContact({elapsed:8.1});
  assert.equal(result.activity.phase,'blocked');
  assert.equal(result.restored,true);
  assert.equal(result.actor.userData.limbCollisionDiagnostics.reason,'desktop-contact-timeout');
  assert.equal(result.activity.workContactReady,false);
  assert.match(result.blocked.message,/สัมผัสโต๊ะ/);
});

test('seated probe can approach contact within the acquisition bound',()=>{
  const result=updateWaitingContact({elapsed:3});
  assert.equal(result.activity.phase,'sit');
  assert.equal(result.blocked,null);
  assert.equal(result.activity.workContactReady,false);
});

test('measured contact is not rejected merely because the sit timer exceeds the bound',()=>{
  const result=updateWaitingContact({elapsed:9,status:'contact'});
  assert.equal(result.activity.phase,'sit');
  assert.equal(result.blocked,null);
  assert.equal(result.activity.workContactReady,true);
});
