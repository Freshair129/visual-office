import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {registerNativeInlineBuffers} from '../web/native-gltf.js';
globalThis.ProgressEvent=class {constructor(type,options){this.type=type;Object.assign(this,options)}};

function denyFetch(t){
 const calls=[];t.mock.method(globalThis,'fetch',async input=>{calls.push(String(input instanceof Request?input.url:input));throw new Error('synthetic network denied');});return calls;
}
const uri=bytes=>'data:application/octet-stream;base64,'+Buffer.from(bytes).toString('base64');
function triangle(){
 const bytes=new Uint8Array(48);new Float32Array(bytes.buffer,12).set([0,0,0,1,0,0,0,1,0]);
 const indices=new Uint8Array(8);new Uint16Array(indices.buffer,2).set([0,1,2]);
 return {asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],buffers:[{uri:uri(bytes),byteLength:48},{uri:uri(indices),byteLength:8}],bufferViews:[{buffer:0,byteOffset:12,byteLength:36},{buffer:1,byteOffset:2,byteLength:6}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]},{bufferView:1,componentType:5123,count:3,type:'SCALAR'}]};
}
const parse=json=>registerNativeInlineBuffers(new GLTFLoader()).parseAsync(JSON.stringify(json),'');

test('Native glTF meshes load from embedded buffers without fetch and preserve offsets across buffers',async t=>{
 const calls=denyFetch(t),result=await parse(triangle()),mesh=result.scene.children[0];
 assert.deepEqual([...mesh.geometry.attributes.position.array],[0,0,0,1,0,0,0,1,0]);
 assert.deepEqual([...mesh.geometry.index.array],[0,1,2]);assert.deepEqual(calls,[]);
});

test('all existing Native models parse with data-URI network access denied',async t=>{
 const calls=denyFetch(t);
 for(const name of ['room','desk','floor-tile']){
  const result=await registerNativeInlineBuffers(new GLTFLoader()).parseAsync(await readFile(`web/assets/models/${name}.gltf`,'utf8'),'');
  let meshes=0;result.scene.traverse(node=>{if(node.isMesh){meshes++;assert.ok(node.geometry.attributes.position.count>0);}});assert.ok(meshes>0,name);
 }
 assert.deepEqual(calls,[]);
});

test('malformed embedded buffers fail locally with a bounded error and never retry through fetch',async t=>{
 const calls=denyFetch(t);
 for(const mutate of [json=>json.buffers[0].byteLength=49,json=>json.bufferViews[0].byteOffset=20,json=>json.buffers[0].uri='data:application/octet-stream;base64,%%%']){
  const json=triangle();mutate(json);await assert.rejects(parse(json),error=>/Native glTF/.test(error.message)&&error.message.length<160&&!error.message.includes('base64,'));
 }
 assert.deepEqual(calls,[]);
});

test('Native loader retains external-buffer loading through the original loader',async t=>{
 const json=triangle(),binary=Buffer.from(json.buffers[0].uri.split(',')[1],'base64');json.buffers[0].uri='positions.bin';
 const calls=[];t.mock.method(globalThis,'fetch',async input=>{calls.push(input.url);return new Response(binary);});
 const result=await registerNativeInlineBuffers(new GLTFLoader()).parseAsync(JSON.stringify(json),'https://native.test/');
 assert.deepEqual([...result.scene.children[0].geometry.attributes.position.array],[0,0,0,1,0,0,0,1,0]);assert.deepEqual(calls,['https://native.test/positions.bin']);
});

test('Native loader retains the GLB binary chunk path without fetching a buffer',async t=>{
 const calls=denyFetch(t),json=triangle(),binary=Buffer.concat(json.buffers.map(buffer=>Buffer.from(buffer.uri.split(',')[1],'base64')));
 json.buffers=[{byteLength:56}];json.bufferViews[1]={buffer:0,byteOffset:50,byteLength:6};
 const raw=Buffer.from(JSON.stringify(json)),text=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,0x20)]),glb=Buffer.alloc(28+text.length+binary.length);
 glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(text.length,12);glb.writeUInt32LE(0x4e4f534a,16);text.copy(glb,20);
 const chunk=20+text.length;glb.writeUInt32LE(binary.length,chunk);glb.writeUInt32LE(0x004e4942,chunk+4);binary.copy(glb,chunk+8);
 const result=await registerNativeInlineBuffers(new GLTFLoader()).parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
 assert.deepEqual([...result.scene.children[0].geometry.index.array],[0,1,2]);assert.deepEqual(calls,[]);
});
