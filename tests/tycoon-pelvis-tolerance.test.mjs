import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {measureSeatContact,measurePelvisSeatSupport} from '../web/tycoon-seat-contact.js';

async function measuredGap(gap){
  const [actor,chair]=await Promise.all(['web/assets/models/tycoon-factory/actor-rig-v3.glb','web/assets/models/tycoon/chair.glb'].map(async file=>{
    const bytes=await readFile(file);return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  }));
  const height=measureSeatContact(chair,{x:0,z:0},.4792452947742871).height,pelvis=actor.getObjectByName('office-pelvis');
  actor.updateMatrixWorld(true);pelvis.skeleton.update();let lowest=Infinity;
  for(let i=0;i<pelvis.geometry.attributes.position.count;i++)lowest=Math.min(lowest,pelvis.localToWorld(pelvis.getVertexPosition(i,new THREE.Vector3())).y);
  actor.position.y+=height+gap-lowest;actor.updateMatrixWorld(true);
  return measurePelvisSeatSupport(actor,chair,height);
}
test('runtime seat support accepts an actual 2 mm pelvis gap',async()=>assert.equal((await measuredGap(.002)).ok,true));
for(const gap of [.004,-.004])test(`runtime seat support refuses an actual ${gap*1000} mm pelvis gap`,async()=>{
  const result=await measuredGap(gap);assert.ok(Math.abs(result.verticalGapM-gap)<1e-5);
  assert.equal(result.ok,false);assert.equal(result.reason,'pelvis-seat-height-gap');
});
