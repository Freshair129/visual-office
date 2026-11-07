import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {collectHandoffAssets} from '../web/office-handoff-assets.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {inspectCustomGLB,describeCustomAsset,disposeCustomModel} from '../web/custom-assets.js';

const sourceBytes=new Uint8Array(await fs.readFile('web/assets/models/tycoon/chair.glb'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=','base64');

function makeTexturedGLB(source){
 const original=Buffer.from(source),jsonLength=original.readUInt32LE(12),json=JSON.parse(original.subarray(20,20+jsonLength)),bin=original.subarray(28+jsonLength),offset=(bin.length+3)&~3;
 const joined=Buffer.alloc(offset+png.length);bin.copy(joined);png.copy(joined,offset);
 const viewIndex=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:png.length});
 json.buffers[0].byteLength=joined.length;
 json.images=[{bufferView:viewIndex,mimeType:'image/png'}];json.textures=[{source:0}];json.materials=[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}];json.meshes[0].primitives[0].material=0;
 let jsonBytes=Buffer.from(JSON.stringify(json));while(jsonBytes.length%4)jsonBytes=Buffer.concat([jsonBytes,Buffer.from(' ')]);
 const header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonBytes.length+8+joined.length,8);
 jsonHeader.writeUInt32LE(jsonBytes.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);binHeader.writeUInt32LE(joined.length,0);binHeader.writeUInt32LE(0x004e4942,4);
 return new Uint8Array(Buffer.concat([header,jsonHeader,jsonBytes,binHeader,joined]));
}

const texturedBytes=makeTexturedGLB(sourceBytes);
const addCustom=(room,id,asset)=>room.objects.push({id,kind:'custom',asset,x:0,y:0,z:0,rotation:0,scale:1,intent:'decor'});
const readBundled=async file=>new Uint8Array(await fs.readFile(`web/${file}`));

test('geometry-only GLB inspection measures embedded-texture geometry without decoding images',async()=>{
 const info=await inspectCustomGLB(texturedBytes,{geometryOnly:true});
 try{
  assert.equal(info.id,await (await import('../web/custom-assets.js')).customHash(texturedBytes));
  assert.deepEqual(info.bytes,texturedBytes);
  const box=new THREE.Box3().setFromObject(info.model),size=box.getSize(new THREE.Vector3()).toArray(),center=box.getCenter(new THREE.Vector3());
  assert.ok(size.every((n,i)=>Math.abs(n-info.size[i])<1e-6));assert.ok(Math.abs(center.x-info.origin[0])<1e-6);assert.ok(Math.abs(box.min.y-info.origin[1])<1e-6);
  let textureCount=0;info.model.traverse(node=>{for(const material of [].concat(node.material||[]))for(const value of Object.values(material))if(value?.isTexture)textureCount++;});assert.equal(textureCount,0);
 }finally{disposeCustomModel(info.model);}
});

test('asset collection preserves the original textured GLB bytes and content hash',async()=>{
 const measured=await inspectCustomGLB(texturedBytes,{geometryOnly:true});let asset;
 try{asset=describeCustomAsset(measured,{name:'Textured prop',category:'chair',height:1.1});}finally{disposeCustomModel(measured.model);}
 const room=createTycoonRoom('lobby');addCustom(room,'custom-textured',asset);
 const collected=await collectHandoffAssets({lobby:room},{readFile:readBundled,readCustom:async()=>texturedBytes}),descriptor=collected.descriptors[`custom/${asset.id}`];
 assert.equal(descriptor.sha256,asset.id);assert.deepEqual(collected.blobs.get(descriptor.uri),texturedBytes);
});

for(const forgedField of ['origin','sourceSize'])test(`asset collection rejects a forged earlier ${forgedField} descriptor for a shared GLB hash`,async()=>{
 const measured=await inspectCustomGLB(texturedBytes,{geometryOnly:true});let asset;
 try{asset=describeCustomAsset(measured,{name:'Local prop',category:'chair',height:1.15});}finally{disposeCustomModel(measured.model);}
 const forged=structuredClone(asset);
 if(forgedField==='origin')forged.origin[0]+=.25;
 else{forged.sourceSize=forged.sourceSize.map(n=>n*1.1);forged.size=forged.size.map(n=>n*1.1);}
 const room=createTycoonRoom('lobby');addCustom(room,'custom-forged',forged);addCustom(room,'custom-valid',asset);
 let customReads=0;
 await assert.rejects(collectHandoffAssets({lobby:room},{readFile:readBundled,readCustom:async id=>{customReads++;assert.equal(id,asset.id);return texturedBytes;}}),/GLB|descriptor|ขนาด/);
 assert.equal(customReads,1,'one content hash is read once while every descriptor is checked');
});

test('packaged custom verification independently checks every placement descriptor against the archived GLB',async()=>{
 const {verifyCustomAssetMeasurements}=await import('../web/office-handoff-assets.js');
 assert.equal(typeof verifyCustomAssetMeasurements,'function');
 const measured=await inspectCustomGLB(texturedBytes,{geometryOnly:true});let good;
 try{good=describeCustomAsset(measured,{name:'Local prop',category:'chair',height:1.15});}finally{disposeCustomModel(measured.model);}
 const forged=structuredClone(good);forged.origin[2]-=.4;
 const revision={id:'revision',type:'assetRevision',data:{sha256:good.id,uri:`assets/${good.id}.glb`}};
 const placement=(key,asset)=>({id:key,type:'placement',data:{object:{kind:'custom',asset}},refs:[{relation:'revision',targetId:revision.id}]});
 const entities=[revision,placement('forged-first',forged),placement('valid-last',good)];
 let reads=0;await assert.rejects(verifyCustomAssetMeasurements(entities,async uri=>{reads++;assert.equal(uri,revision.data.uri);return texturedBytes;}),/GLB|descriptor|ขนาด/);assert.equal(reads,1);
});
