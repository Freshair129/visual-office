import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {inspectGLBContainer} from '../web/custom-assets.js';
import {measureSeatContact} from '../web/tycoon-seat-contact.js';
const root='tests/fixtures/external-chairs/',catalog=JSON.parse(await readFile(root+'fixtures.json','utf8'));
for(const f of catalog.fixtures)test(`external ${f.id} passes production import and measured seat at both scales`,async()=>{
 const bytes=await readFile(root+f.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.provenance.glb.sha256);
 inspectGLBContainer(bytes);const model=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
 const box=new THREE.Box3().setFromObject(model);assert.ok(Math.abs(box.min.y)<.001);assert.ok(Math.abs(box.getSize(new THREE.Vector3()).y-f.height)<.001);
 for(const scale of [.9,1.1]){model.scale.setScalar(scale);const contact=measureSeatContact(model,{x:f.interaction.seat[0]*scale,z:f.interaction.seat[1]*scale},f.interaction.height*scale);assert.ok(contact.ok,contact.message);assert.ok(Math.abs(contact.height-f.interaction.height*scale)<.003);}
 const license=await readFile(root+f.provenance.licenseFile);assert.equal(createHash('sha256').update(license).digest('hex'),f.provenance.licenseSha256);
});
