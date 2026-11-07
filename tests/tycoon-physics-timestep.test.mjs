import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TycoonScene} from '../web/tycoon-scene.js';

// Integration scheduling only; actual skinned GLB/contact checks live in the lifecycle tests.
function setup(){
  const samples=[],actor=new THREE.Object3D(),snapshot={position:{x:0,y:0},heading:0,clip:'idle'};
  const activity={snapshot,phase:'walking',elapsed:0,tick(dt){this.elapsed+=dt;}};
  actor.userData.probeSnapshot=snapshot;
  actor.userData.contact={restore(){},reset(){},update(state,phase,dt){samples.push(dt);return {ok:true,ready:true,feetReady:true,collision:{ok:true}};}};
  return {scene:{ready:true,activity,play(){}},actor,samples};
}
test('one 30 FPS render interval advances two full 60 Hz pose checks',()=>{
  const {scene,actor,samples}=setup();TycoonScene.prototype.updateProbe.call(scene,actor,1/30);
  assert.deepEqual(samples,[1/60,1/60]);assert.ok(Math.abs(scene.activity.elapsed-1/30)<1e-12);
});
test('quantized render intervals preserve elapsed simulation without varying physical step size',()=>{
  const {scene,actor,samples}=setup();let elapsed=0;
  for(let frame=0;frame<120;frame++){const dt=frame%3===0?.0334:.0333;elapsed+=dt;TycoonScene.prototype.updateProbe.call(scene,actor,dt);}
  assert.ok(samples.every(dt=>Math.abs(dt-1/60)<1e-12));
  assert.ok(elapsed-scene.activity.elapsed>=-1e-10&&elapsed-scene.activity.elapsed<1/60+1e-10);
});
test('a restarted snapshot discards fractional time and long pauses stay bounded',()=>{
  const {scene,actor,samples}=setup();TycoonScene.prototype.updateProbe.call(scene,actor,.01);
  assert.equal(samples.length,0);
  scene.activity.snapshot={...scene.activity.snapshot};TycoonScene.prototype.updateProbe.call(scene,actor,.01);
  assert.equal(samples.length,0,'previous activity must not contribute fractional time');
  TycoonScene.prototype.updateProbe.call(scene,actor,10);
  assert.equal(samples.length,6);assert.ok(scene.activity.elapsed<=.1+1e-12);
});

test('a new collision world clears departure proof before the next route tick',()=>{
  const {scene,actor}=setup(),world={revision:'new'},contact=actor.userData.contact;let beforeTick;
  scene.collisionWorld=world;scene.activity.phase='leaving';scene.activity.departureFeetReady=true;
  contact.bindCollisionWorld=next=>{contact.collisionWorld=next;return true;};
  const tick=scene.activity.tick.bind(scene.activity);scene.activity.tick=dt=>{beforeTick=scene.activity.departureFeetReady;tick(dt);};
  TycoonScene.prototype.updateProbe.call(scene,actor,1/60);
  assert.equal(contact.collisionWorld,world);
  assert.equal(beforeTick,false,'the replacement world must establish foot transfer before root motion');
});
