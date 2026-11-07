import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {PoseTransaction} from '../web/tycoon-pose-transaction.js';
import {createTycoonRoom} from '../web/tycoon-state.js';

async function fixture(external=false){
 const room=createTycoonRoom('projects'),chair=room.objects.find(o=>o.id==='chair-1');chair.scale=external?1.1:1.25;
 const custom=external?JSON.parse(await readFile('tests/fixtures/external-chairs/fixtures.json','utf8')).fixtures.find(f=>f.id==='kenney-chair-rounded-back'):null;
 if(custom){chair.kind='custom';chair.asset={id:custom.provenance.glb.sha256,name:custom.name,category:'chair',size:custom.measured.gltfSize,sourceSize:custom.measured.gltfSize,origin:[0,0,0],interaction:structuredClone(custom.interaction)};chair.rotation+=Math.PI-custom.interaction.heading;}
 const parse=async file=>{const bytes=await readFile(file);return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
 const [a,c,d]=await Promise.all([parse('web/assets/models/tycoon-factory/actor-rig-v3.glb'),parse(custom?`tests/fixtures/external-chairs/${custom.file}`:'web/assets/models/tycoon/chair.glb'),parse('web/assets/models/tycoon-factory/desk-v3.glb')]);
 const actor=a.scene;actor.userData={instanceId:'demo-agent',clips:a.animations,mixer:new THREE.AnimationMixer(actor)};
 for(const [model,id] of [[c.scene,'chair-1'],[d.scene,'desk-1']]){const o=room.objects.find(o=>o.id===id);model.userData.instanceId=id;model.position.set(o.x,o.y,o.z);model.rotation.y=o.rotation;model.scale.setScalar(o.scale);}
 const activity=new TycoonActivity(room),scene={ready:true,room,activity,assembly:{owned:[actor,c.scene,d.scene]},collisionWorld:new TycoonCollisionWorld([c.scene,d.scene]),play:TycoonScene.prototype.play};
 actor.userData.contact=new ProbeContact(actor,scene.collisionWorld);assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);return {actor,scene,activity};
}
function observation(f){const c=f.actor.userData.contact;return JSON.parse(JSON.stringify({phase:f.activity.phase,elapsed:f.activity.elapsed,snapshot:f.activity.snapshot,root:f.actor.position.toArray(),feet:c.legs.map(l=>l.point?.toArray()),contact:c.captureInternal(),contactLastCollision:c.lastCollision,supportSearchDiagnostics:c.armContact.supportSearchDiagnostics,publicDiagnostics:Object.getOwnPropertyDescriptor(TycoonScene.prototype,'collisionDiagnostics').get.call(f.scene),collision:f.actor.userData.limbCollisionDiagnostics,bones:c.legs.map(l=>[l.hip.position.toArray(),l.hip.quaternion.toArray(),l.knee.quaternion.toArray(),l.ankle.quaternion.toArray()])}));}
for(const external of [false,true])test(`resuming ${external?'external rounded-back':'scaled-chair'} solves across checkpoints preserves each committed fixed step and full lifecycle`,async()=>{
 const reference=await fixture(external),resumed=await fixture(external);let checkpoints=0,steps=0,phases=new Set();
 for(;steps<4000;steps++){
  TycoonScene.prototype.updateProbeStep.call(reference.scene,reference.actor,1/60);
  const published=observation(resumed),job=new PoseTransaction(resumed.actor,resumed.activity,TycoonScene.prototype.updateProbeStepSteps.call(resumed.scene,resumed.actor,1/60,{cooperative:true}));
  let item,check=0;do{item=job.advance(()=>++check%7===0);if(!item.done){checkpoints++;assert.deepEqual(observation(resumed),published,'suspension keeps prior contact, pose and activity visible');}}while(!item.done);
  assert.deepEqual(observation(resumed),observation(reference),`fixed step ${steps} ${reference.activity.phase}`);phases.add(resumed.activity.phase);
  assert.notEqual(resumed.activity.phase,'blocked');if(resumed.activity.phase==='done')break;
 }
 assert.ok(steps<4000);assert.ok(checkpoints>100);for(const phase of ['walking','turning','approaching-seat','entering','sit','working','standing','leaving','settling','done'])assert.ok(phases.has(phase),phase);
});
