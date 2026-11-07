import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';

test('bundled chair pads clear the measured thigh pose during descent onto its seat',async()=>{
  const bytes=await readFile(new URL('../web/assets/models/tycoon/chair.glb',import.meta.url));
  const {scene:chair}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  chair.rotation.y=Math.PI;chair.userData.instanceId='chair-1';chair.updateMatrixWorld(true);
  // Actual rig-v3 descent pose that intersected the old left arm pad by3.94mm.
  // This geometric regression does not replace complete animated lifecycle checks.
  const thighs=[-1,1].map(sign=>({name:sign<0?'left-thigh':'right-thigh',side:sign<0?'left':'right',
    start:new THREE.Vector3(sign*.119871795,.80034218,.18239289),
    end:new THREE.Vector3(sign*.126792336,.586581067,.553977941),radius:.092}));
  const result=new TycoonCollisionWorld([chair]).inspectCapsules(thighs,{phase:'sit'});
  assert.equal(result.ok,true,JSON.stringify(result.hit));
  assert.equal(result.checkedCapsules,2);
  const size=new THREE.Box3().setFromObject(chair).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-.9)<.001&&Math.abs(size.y-1.0)<.001&&Math.abs(size.z-.95)<.001);
});
