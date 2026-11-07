import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ProbeContact} from '../web/tycoon-contact.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';

async function setup(){
  const parsed=await Promise.all(['web/assets/models/tycoon-factory/actor-rig-v3.glb','web/assets/models/tycoon/chair.glb','web/assets/models/tycoon-factory/desk-v3.glb'].map(async file=>{
    const bytes=await readFile(file);return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  }));
  parsed.forEach((model,index)=>{model.userData.instanceId=['demo-agent','chair-1','desk-1'][index];});
  parsed[1].position.z=.4;parsed[2].position.z=1.6;
  const world=new TycoonCollisionWorld(parsed),probe=new ProbeContact(parsed[0],world);return {probe,world,actor:parsed[0]};
}
const serialize=capsules=>capsules.map(c=>({...c,start:c.start.toArray(),end:c.end.toArray()}));
test('leg-only candidates reuse unchanged actual arm capsules with exact full-query parity',async()=>{
  const {probe,world,actor}=await setup(),arms=probe.armContact.capsules(),extract=probe.armContact.capsules.bind(probe.armContact);let extractions=0;
  probe.armContact.capsules=(...args)=>{extractions++;return extract(...args);};
  for(const angle of [0,.05,-.1,.2]){
    probe.legs[0].hip.quaternion.copy(probe.legs[0].rest[0]).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle));actor.updateMatrixWorld(true);
    const before=extractions,reused=probe.limbCapsules(arms);
    assert.equal(extractions,before,'a leg-only candidate must not re-extract unchanged skinned arms');
    const reference=probe.limbCapsules();
    assert.deepEqual(serialize(reused),serialize(reference),'ordered capsule geometry remains exact');
    assert.deepEqual(world.inspectCapsules(reused,{phase:'entering'}),world.inspectCapsules(reference,{phase:'entering'}),'full collision diagnostics remain exact');
  }
});
