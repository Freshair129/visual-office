// Compare approved LOD1 and batched LOD1 in the actual Three animation loader.
// No browser/image decoder; this checks geometry and normals, not rendered art.
// node scripts/asset-factory/verify_character_batches.mjs BEFORE_DIR AFTER_DIR
import assert from 'node:assert/strict';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AnimationMixer,Matrix4,Matrix3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
async function directory(value){
 const path=await realpath(resolve(value)),rel=relative(root,path);
 assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'inputs must stay within this worktree');return path;
}
async function load(path){
 const bytes=await readFile(path),size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size));
 const geometry=structuredClone(doc);delete geometry.materials;delete geometry.images;delete geometry.textures;
 for(const m of geometry.meshes)for(const p of m.primitives)delete p.material;
 let json=Buffer.from(JSON.stringify(geometry));json=Buffer.concat([json,Buffer.alloc(-json.length&3,32)]);
 const tail=bytes.subarray(20+size),header=Buffer.alloc(20);
 [0x46546c67,2,20+json.length+tail.length,json.length,0x4e4f534a].forEach((n,i)=>header.writeUInt32LE(n,i*4));
 const glb=Buffer.concat([header,json,tail]),loaded=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
 const nodes=await Promise.all(doc.nodes.map((_,i)=>loaded.parser.getDependency('node',i)));
 const cache=new Map();
 function accessor(index){
  if(cache.has(index))return cache.get(index);
  const a=doc.accessors[index],v=doc.bufferViews[a.bufferView];assert.equal(a.sparse,undefined);
  const [read,width]=({5121:['readUInt8',1],5123:['readUInt16LE',2],5125:['readUInt32LE',4],5126:['readFloatLE',4]})[a.componentType];
  const count=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16})[a.type],stride=v.byteStride||count*width;
  const rows=Array.from({length:a.count},(_,r)=>Array.from({length:count},(_,c)=>bytes[read](28+size+(v.byteOffset||0)+(a.byteOffset||0)+r*stride+c*width)/(a.normalized?({5121:255,5123:65535})[a.componentType]:1)));
  cache.set(index,rows);return rows;
 }
 function evaluator(nodeIndex,primitive){
  const node=doc.nodes[nodeIndex],p=primitive.attributes,positions=accessor(p.POSITION),normals=accessor(p.NORMAL);
  const matrices=node.skin===undefined?null:doc.skins[node.skin].joints.map((j,i)=>new Matrix4().multiplyMatrices(nodes[j].matrixWorld,new Matrix4().fromArray(accessor(doc.skins[node.skin].inverseBindMatrices)[i])));
  const weights=matrices&&accessor(p.WEIGHTS_0),joints=matrices&&accessor(p.JOINTS_0);
  const normalMatrix=new Matrix3().getNormalMatrix(nodes[nodeIndex].matrixWorld);
  return index=>{
   const position=new Vector3(),normal=new Vector3();
   if(matrices){
    const skin=new Matrix4();skin.elements.fill(0);
    for(let k=0;k<4;k++)for(let e=0;e<16;e++)skin.elements[e]+=matrices[joints[index][k]].elements[e]*weights[index][k];
    position.fromArray(positions[index]).applyMatrix4(skin);
    normal.fromArray(normals[index]).applyMatrix3(new Matrix3().setFromMatrix4(skin)).normalize();
   }else{
    position.fromArray(positions[index]).applyMatrix4(nodes[nodeIndex].matrixWorld);
    normal.fromArray(normals[index]).applyNormalMatrix(normalMatrix);
   }
   return {position,normal};
  };
 }
 return {doc,loaded,evaluator,accessor};
}
const [beforeDir,afterDir]=await Promise.all(process.argv.slice(2).map(directory));
assert.ok(beforeDir&&afterDir,'provide approved and generated LOD1 directories');
const manifest=JSON.parse(await readFile(resolve(afterDir,'manifest.json'),'utf8'));
for(const asset of manifest.assets){
 const [old,next]=await Promise.all([load(resolve(beforeDir,asset.file)),load(resolve(afterDir,asset.file))]);
 assert.equal(old.doc.nodes.length,asset.batching.originalNodeCount);
 const mixers=[old,next].map(f=>new AnimationMixer(f.loaded.scene));
 const frames=[{clip:null,time:0},...old.loaded.animations.flatMap(c=>[0,.25,.5,.75,.99].map(t=>({clip:c.name,time:t*c.duration})))];
 let maxPositionError=0,maxNormalError=0,maxColorError=0,verticesCompared=0;
 for(const part of asset.batching.parts){
  const a=old.doc.meshes[old.doc.nodes[part.node].mesh].primitives[part.primitive],b=next.doc.meshes[part.mesh].primitives[0];
  const indices=(file,p)=>p.indices===undefined?Array.from({length:file.doc.accessors[p.attributes.POSITION].count},(_,i)=>i):file.accessor(p.indices).flat();
  assert.deepEqual(indices(next,b).slice(part.indexOffset,part.indexOffset+part.indexCount).map(i=>i-part.vertexOffset),indices(old,a),'triangle order and winding');
  if(a.attributes.TEXCOORD_0!==undefined)assert.deepEqual(next.accessor(b.attributes.TEXCOORD_0).slice(part.vertexOffset,part.vertexOffset+part.vertexCount),old.accessor(a.attributes.TEXCOORD_0),'unchanged UVs');
  const colors=(file,p)=>{
   const factor=file.doc.materials[p.material].pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];
   const values=p.attributes.COLOR_0===undefined?Array.from({length:file.doc.accessors[p.attributes.POSITION].count},()=>[1,1,1,1]):file.accessor(p.attributes.COLOR_0);
   return values.map(row=>factor.map((f,i)=>f*(row[i]??1)));
  };
  const oldColors=colors(old,a),newColors=colors(next,b);
  oldColors.forEach((row,i)=>row.forEach((v,c)=>{maxColorError=Math.max(maxColorError,Math.abs(v-newColors[part.vertexOffset+i][c]));}));
 }
 for(const {clip,time}of frames){
  [old,next].forEach((f,i)=>{
   mixers[i].stopAllAction();if(clip){mixers[i].clipAction(f.loaded.animations.find(c=>c.name===clip)).play();mixers[i].setTime(time);}
   f.loaded.scene.updateMatrixWorld(true);
  });
  for(const part of asset.batching.parts){
   const originalNode=old.doc.nodes[part.node];
   const original=old.evaluator(part.node,old.doc.meshes[originalNode.mesh].primitives[part.primitive]);
   const batchNode=next.doc.nodes.findIndex(n=>n.mesh===part.mesh);
   const batched=next.evaluator(batchNode,next.doc.meshes[part.mesh].primitives[0]);
   for(let i=0;i<part.vertexCount;i++){
    const a=original(i),b=batched(i+part.vertexOffset);
    maxPositionError=Math.max(maxPositionError,a.position.distanceTo(b.position));
    maxNormalError=Math.max(maxNormalError,a.normal.distanceTo(b.normal));verticesCompared++;
   }
  }
 }
 assert.ok(maxPositionError<2e-6,`${asset.id}: positions differ by ${maxPositionError} m`);
 assert.ok(maxNormalError<2e-5,`${asset.id}: normals differ by ${maxNormalError}`);
 assert.ok(maxColorError<1e-7,`${asset.id}: colors differ by ${maxColorError}`);
 console.log(JSON.stringify({id:asset.id,frames:frames.length,verticesCompared,maxPositionError,maxNormalError,maxColorError,uvAndTriangleOrderExact:true}));
}
