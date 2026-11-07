import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const geometryKeys=new WeakMap();

function materialKey(material){
  const value=material.toJSON();delete value.uuid;delete value.id;
  return JSON.stringify(value);
}

function geometryLayout(geometry){
  const attributes=Object.keys(geometry.attributes).sort().map(name=>{
    const attribute=geometry.attributes[name];
    return `${name}:${attribute.array.constructor.name}:${attribute.itemSize}:${attribute.normalized}`;
  });
  const index=geometry.index?`${geometry.index.array.constructor.name}:${geometry.index.itemSize}`:'none';
  return `${index}|${attributes.join('|')}`;
}

function hashArray(array){
  const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let hash=2166136261;
  for(const byte of bytes)hash=Math.imul(hash^byte,16777619)>>>0;
  return hash.toString(16);
}

function geometryKey(geometry){
  if(geometryKeys.has(geometry))return geometryKeys.get(geometry);
  const attributes=Object.keys(geometry.attributes).sort().map(name=>`${name}:${hashArray(geometry.attributes[name].array)}`);
  const index=geometry.index?hashArray(geometry.index.array):'none';
  const key=`${geometryLayout(geometry)}#${index}#${attributes.join('|')}`;geometryKeys.set(geometry,key);return key;
}

function geometryEquals(left,right){
  if(geometryLayout(left)!==geometryLayout(right))return false;
  if((left.index?.count??-1)!==(right.index?.count??-1))return false;
  if(left.index)for(let i=0;i<left.index.count;i++)if(left.index.array[i]!==right.index.array[i])return false;
  for(const name of Object.keys(left.attributes)){
    const a=left.attributes[name].array,b=right.attributes[name].array;
    if(a.length!==b.length)return false;
    for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
  }
  return true;
}

function fullGeometry(mesh){
  const geometry=mesh.geometry;
  return !Object.keys(geometry.morphAttributes||{}).length&&
    geometry.drawRange.start===0&&(geometry.drawRange.count===Infinity||geometry.drawRange.count===(geometry.index?.count??geometry.attributes.position?.count));
}

function materialList(mesh){return Array.isArray(mesh.material)?mesh.material:[mesh.material];}

function visibleThrough(node,stop){
  for(let current=node;current&&current!==stop;current=current.parent)if(!current.visible)return false;
  return true;
}

function sourceLabel(mesh){
  const parts=[];
  for(let node=mesh;node;node=node.parent){
    if(node.userData.officeKind)parts.push(`${node.userData.officeKind}:${node.userData.officeId}`);
    else if(node.userData.officeDoorId)parts.push(`door:${node.userData.officeDoorId}`);
    else if(node.userData.fixtureRole)parts.push(`fixture:${node.userData.fixtureRole}`);
    else if(node.userData.wallId)parts.push(`wall:${node.userData.wallId}`);
    else if(node.userData.zone)parts.push(`floor:${node.userData.zone}`);
    else if(node.userData.role)parts.push(`architecture:${node.userData.role}`);
  }
  return parts[0]||mesh.name||mesh.type;
}

function hasDoorAncestor(node,stop){
  for(let current=node;current&&current!==stop;current=current.parent)if(current.userData.officeDoorId)return true;
  return false;
}

function collectMeshes(root,stop,{allowTransparent=false}={}){
  const result=[];
  root.traverse(node=>{
    if(!node.isMesh||node.isSkinnedMesh||node.isInstancedMesh||!visibleThrough(node,stop)||hasDoorAncestor(node,stop)||!fullGeometry(node))return;
    if(!node.material||Array.isArray(node.material)||!allowTransparent&&node.material.transparent)return;
    if(node.material.visible===false)return;
    result.push(node);
  });
  return result;
}

function layerVisible(node,camera){
  return visibleThrough(node,null)&&(!camera||node.layers.test(camera.layers));
}

export class HybridSceneBatching{
  constructor(parent){this.parent=parent;this.group=null;this.originals=[];this.proxyMaterials=new Map();this.objectInstances=new Map();this.batchMaterials=new Map();this.disposed=false;}

  clear(){
    for(const {mesh,material,castShadow} of this.originals){mesh.material=material;mesh.castShadow=castShadow;}
    const geometries=new Set(),materials=new Set();
    this.group?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of materialList(node))if(material)materials.add(material);});
    this.group?.removeFromParent();this.group?.clear();
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
    for(const material of this.proxyMaterials.values())material.dispose();
    this.group=null;this.originals=[];this.proxyMaterials.clear();this.objectInstances.clear();this.batchMaterials.clear();
  }

  rebuild(architecture,models){
    if(this.disposed)return;
    this.clear();this.parent.updateWorldMatrix(true,true);
    const group=new THREE.Group();group.name='hybrid-scene-batches';group.userData.hybridSceneBatchRoot=true;this.group=group;this.parent.add(group);
    this.mergeArchitecture(architecture);
    this.instanceRepeatedProps(models);
    group.traverse(node=>{node.updateMatrix();node.matrixAutoUpdate=false;});
  }

  batchMaterial(source,variant='mesh'){
    const key=`${materialKey(source)}|${variant}`;if(!this.batchMaterials.has(key))this.batchMaterials.set(key,source.clone());
    return this.batchMaterials.get(key);
  }

  proxyMaterial(source){
    if(!this.proxyMaterials.has(source)){const proxy=source.clone();proxy.visible=false;this.proxyMaterials.set(source,proxy);}
    return this.proxyMaterials.get(source);
  }

  hideSource(mesh){
    this.originals.push({mesh,material:mesh.material,castShadow:mesh.castShadow});
    mesh.material=this.proxyMaterial(mesh.material);
    // The combined/instanced replacement owns this shadow draw. Keep original
    // geometry available to raycasts without submitting duplicate shadow work.
    mesh.castShadow=false;
  }

  mergeArchitecture(architecture){
    if(!architecture)return;
    const candidates=collectMeshes(architecture,architecture),groups=new Map();
    for(const mesh of candidates){
      const state=`${materialKey(mesh.material)}|${geometryLayout(mesh.geometry)}|shadow:${mesh.castShadow}:${mesh.receiveShadow}|order:${mesh.renderOrder}|layer:${mesh.layers.mask}`;
      const bucket=groups.get(state)||[];bucket.push(mesh);groups.set(state,bucket);
    }
    const inverse=this.parent.matrixWorld.clone().invert();
    for(const meshes of groups.values()){
      if(meshes.length<2)continue;
      const geometries=meshes.map(mesh=>{
        const geometry=mesh.geometry.clone();geometry.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));return geometry;
      });
      let geometry;
      try{geometry=mergeGeometries(geometries,false);}catch{geometry=null;}
      for(const source of geometries)source.dispose();
      if(!geometry)continue;
      const first=meshes[0],combined=new THREE.Mesh(geometry,this.batchMaterial(first.material,'mesh'));
      combined.name='hybrid-static-material-batch';combined.castShadow=first.castShadow;combined.receiveShadow=first.receiveShadow;combined.renderOrder=first.renderOrder;combined.layers.mask=first.layers.mask;
      combined.userData.hybridBatch={type:'merged-static',sources:meshes.map(sourceLabel),sourceCount:meshes.length,materialParameters:hybridMaterialParameters(first.material)};
      this.group.add(combined);for(const mesh of meshes)this.hideSource(mesh);
    }
  }

  instanceRepeatedProps(models){
    const groups=new Map();
    for(const [objectId,model]of models){
      const kind=model.userData.officeKind;if(!['work-desk','task-chair'].includes(kind)||!model.visible)continue;
      model.updateWorldMatrix(true,true);
      model.traverse(mesh=>{
        if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||!mesh.visible||!fullGeometry(mesh)||!mesh.material||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.visible===false)return;
        const state=`${kind}|${geometryKey(mesh.geometry)}|${materialKey(mesh.material)}|shadow:${mesh.castShadow}:${mesh.receiveShadow}|order:${mesh.renderOrder}|layer:${mesh.layers.mask}`;
        const bucket=groups.get(state)||[];bucket.push({objectId,model,mesh});groups.set(state,bucket);
      });
    }
    const inverse=this.parent.matrixWorld.clone().invert();
    for(const entries of groups.values()){
      if(new Set(entries.map(entry=>entry.objectId)).size<2)continue;
      const first=entries[0];if(entries.some(entry=>!geometryEquals(first.mesh.geometry,entry.mesh.geometry)))continue;
      const instanced=new THREE.InstancedMesh(first.mesh.geometry.clone(),this.batchMaterial(first.mesh.material,'instanced'),entries.length);
      instanced.name=`hybrid-${first.model.userData.officeKind}-instances`;instanced.castShadow=first.mesh.castShadow;instanced.receiveShadow=first.mesh.receiveShadow;instanced.renderOrder=first.mesh.renderOrder;instanced.layers.mask=first.mesh.layers.mask;instanced.frustumCulled=false;
      const sources=[];
      entries.forEach((entry,index)=>{
        const matrix=inverse.clone().multiply(entry.mesh.matrixWorld);instanced.setMatrixAt(index,matrix);
        const record={instanced,index,source:entry.mesh,model:entry.model,originalMaterial:entry.mesh.material,visible:null,layers:entry.mesh.layers.mask};
        const list=this.objectInstances.get(entry.objectId)||[];list.push(record);this.objectInstances.set(entry.objectId,list);
        sources.push(`${entry.model.userData.officeKind}:${entry.objectId}`);this.hideSource(entry.mesh);
      });
      instanced.instanceMatrix.needsUpdate=true;instanced.computeBoundingSphere();instanced.userData.hybridBatch={type:'instanced-editable',sources,sourceCount:entries.length,materialParameters:hybridMaterialParameters(instanced.material)};this.group.add(instanced);
    }
  }

  updateObject(objectId,camera){
    const records=this.objectInstances.get(objectId);if(!records?.length)return false;
    const changedBatches=new Set();
    for(const record of records){
      record.model.updateMatrix();this.parent.updateWorldMatrix(true,false);record.source.updateWorldMatrix(true,false);
      const matrix=this.parent.matrixWorld.clone().invert().multiply(record.source.matrixWorld);
      const visible=layerVisible(record.source,camera)&&record.originalMaterial.visible!==false;
      if(!visible){const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(position,rotation,scale);matrix.compose(position,rotation,new THREE.Vector3());}
      record.instanced.setMatrixAt(record.index,matrix);record.instanced.instanceMatrix.needsUpdate=true;record.visible=visible;record.layers=record.source.layers.mask;changedBatches.add(record.instanced);
    }
    for(const batch of changedBatches)batch.computeBoundingSphere();return true;
  }

  syncVisibility(camera){
    let anyChanged=false;
    for(const [objectId,records]of this.objectInstances){
      const needsUpdate=records.some(record=>record.visible!==layerVisible(record.source,camera)||record.layers!==record.source.layers.mask||record.originalMaterial.visible===false&&record.visible);
      if(needsUpdate){this.updateObject(objectId,camera);anyChanged=true;}
    }
    return anyChanged;
  }

  dispose(){if(this.disposed)return;this.clear();this.disposed=true;this.parent=null;}
}

export function hybridMaterialParameters(material){
  const value=material.toJSON();delete value.uuid;delete value.id;return value;
}
