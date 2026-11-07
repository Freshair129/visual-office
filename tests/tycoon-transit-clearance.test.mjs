import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
const load=async path=>{const b=await readFile(path);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};

for(const floor of ['projects','growth'])for(const hz of [30,60])test(`${floor} desk transit clears its real entrance plant at ${hz} Hz`,async()=>{
 const room=createTycoonRoom(floor),activity=new TycoonActivity(room),actorGltf=await load('web/assets/models/tycoon-factory/actor-rig-v3.glb'),actor=actorGltf.scene;
 actor.userData={instanceId:'demo-agent',clips:actorGltf.animations,mixer:new THREE.AnimationMixer(actor)};
 const obstacles=[];
 for(const [id,path]of [['desk-1','web/assets/models/tycoon-factory/desk-v3.glb'],['chair-1','web/assets/models/tycoon/chair.glb'],['plant-left','web/assets/models/tycoon/plant.glb']]){
  const object=room.objects.find(o=>o.id===id),model=(await load(path)).scene;assert.ok(object,id);model.userData.instanceId=id;model.position.set(object.x,object.y,object.z);model.rotation.y=object.rotation;model.scale.setScalar(object.scale);obstacles.push(model);
 }
 const scene={ready:true,assembly:{owned:[actor,...obstacles]},activity,collisionWorld:new TycoonCollisionWorld(obstacles),play:TycoonScene.prototype.play,onStatus(){}};
 const admission=TycoonScene.prototype.startStation.call(scene,'desk-1');assert.equal(admission.ok,true,JSON.stringify(admission));const start=actor.position.clone();
 for(let i=0;i<hz*2;i++){
  TycoonScene.prototype.updateProbe.call(scene,actor,1/hz);
  assert.notEqual(activity.phase,'blocked',`${floor}@${hz} frame ${i}: ${JSON.stringify(actor.userData.limbCollisionDiagnostics)}`);
 }
 assert.ok(actor.position.distanceTo(start)>.5,'transit must actually move past the entrance');
});
