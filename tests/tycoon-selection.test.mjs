import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {projectedBounds,marqueeSelection} from '../web/tycoon-selection.js';
test('marquee uses projected model bounds, excludes actors and normalizes reverse drags',()=>{
 const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);camera.position.set(0,10,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const objects=[['desk',-2],['chair',2],['demo-agent',0]].map(([id,x])=>{const o=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());o.position.x=x;o.userData.instanceId=id;o.updateMatrixWorld();return o;});
 const bounds=projectedBounds(objects[0],camera,{width:100,height:100});assert.ok(bounds.left<30&&bounds.right>30);
 assert.deepEqual(marqueeSelection(objects,camera,{width:100,height:100},{x:45,y:90},{x:10,y:10},['desk','chair']),['desk']);
});
