import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeStudioDesk,disposeStudioObject} from '../web/studio-models.js';
import {officeCamera} from '../web/office-projection.js';
test('office prop camera projects perpendicular ground axes with symmetric slopes matching the room',()=>{
  const camera=officeCamera(),p=new THREE.Vector3(0,0,0).project(camera),x=new THREE.Vector3(1,0,0).project(camera),z=new THREE.Vector3(0,0,1).project(camera);
  const sx=Math.abs((x.y-p.y)/(x.x-p.x)),sz=Math.abs((z.y-p.y)/(z.x-p.x));
  assert.ok(Math.abs(sx-sz)<1e-10);assert.ok(Math.abs(sx-.52)<.01);
});
test('hybrid desks can be rendered without a baked chair while native desks retain theirs',()=>{
  const native=makeStudioDesk('studio'),separate=makeStudioDesk('studio',{chair:false});
  const a=new THREE.Box3().setFromObject(native),b=new THREE.Box3().setFromObject(separate);
  assert.ok(a.max.z>b.max.z+.5);assert.equal(a.min.y,b.min.y);
  disposeStudioObject(native);disposeStudioObject(separate);
});
