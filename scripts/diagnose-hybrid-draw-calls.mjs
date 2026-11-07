// Headless source inventory for the same unsaved rooms used by perf:hybrid.
// Counts visible renderable scene-graph entries without a browser/GPU. It is a
// source-level proxy: it does not include camera culling or shadow-map passes.
import {JSDOM} from 'jsdom';
import * as THREE from 'three';
import {pathToFileURL} from 'node:url';
import {HybridOffice3D} from '../web/hybrid-office-3d.js';
import {departmentStarterRoom,parseRoomJSON} from '../web/hybrid-state.js';
import {domainFloors} from '../web/domain-office.js';
import {hybridPerformanceFixture} from './perf-hybrid-fixture.mjs';

class HeadlessRenderer {
  constructor({root}){this.domElement=root.ownerDocument.createElement('canvas');this.shadowMap={};}
  setClearColor(){}
  setPixelRatio(){}
  setSize(){}
  render(){}
  dispose(){}
}

const factoryFor = object => {
  if(object.userData.hybridBatch)return `HybridSceneBatching → ${object.userData.hybridBatch.type}`;
  if(object.userData.officeKind){
    const kind=object.userData.officeKind;
    if(kind.startsWith('avatar-'))return 'CharacterLibrary (excluded from room subtotal)';
    if(kind==='water-cooler')return 'makeOfficeProp → waterCooler';
    if(kind==='wayfinding-arrow')return 'makeOfficeProp → groundArrow';
    return `makeOfficeProp → ${({
      'work-desk':'makeStudioDesk','task-chair':'makeStudioChair','team-sofa':'makeStudioSofa',whiteboard:'makeStudioWhiteboard',plant:'makeStudioPlant',
    })[kind]||kind}`;
  }
  if(object.userData.fixtureRole)return `createOfficeArchitecture → ${object.userData.fixtureRole}`;
  if(object.userData.officeDoorId)return `createOfficeArchitecture → door ${object.userData.officeDoorId}`;
  if(object.userData.wallId)return `createOfficeArchitecture → wall ${object.userData.wallId}`;
  if(object.userData.zone)return `createOfficeArchitecture → floor ${object.userData.zone}`;
  if(object.userData.role)return `createOfficeArchitecture → ${object.userData.role}`;
  if(object.userData.officeWall)return 'createOfficeArchitecture → wall';
  return `createOfficeArchitecture → ${object.name||object.type}`;
};

const sourceFor = object => {
  if(object.userData.hybridBatch){
    const batch=object.userData.hybridBatch,kinds=[...new Set(batch.sources.map(source=>{
      const [kind,detail]=source.split(':');
      if(['work-desk','task-chair'].includes(kind))return kind;
      if(kind==='fixture')return `fixed decor: ${detail}`;
      if(kind==='architecture')return detail;
      if(kind==='floor')return `floor: ${detail}`;
      return detail?`${kind}: ${detail}`:kind;
    }))].sort();
    return {source:`batch inputs: ${kinds.join(', ')}`,factory:factoryFor(object)};
  }
  for(let node=object;node;node=node.parent){
    if(node.userData.officeKind)return {source:`object kind: ${node.userData.officeKind}`,factory:factoryFor(node)};
    if(node.userData.officeDoorId)return {source:`door: ${node.userData.officeDoorId}`,factory:factoryFor(node)};
    if(node.userData.fixtureRole)return {source:`fixed decor: ${node.userData.fixtureRole}`,factory:factoryFor(node)};
    if(node.userData.wallId)return {source:`wall: ${node.userData.wallId}`,factory:factoryFor(node)};
    if(node.userData.zone)return {source:`floor: ${node.userData.zone}`,factory:factoryFor(node)};
    if(node.userData.role)return {source:`architecture: ${node.userData.role}`,factory:factoryFor(node)};
  }
  return {source:`architecture: ${object.name||object.type}`,factory:factoryFor(object)};
};

export function materialLabel(material){
  const color=material.color?.getHexString?.()||'none';
  const map=material.map?.uuid||'none';
  return `${material.type} color=${color} roughness=${material.roughness??'-'} metalness=${material.metalness??'-'} opacity=${material.opacity??'-'} transparent=${!!material.transparent} side=${material.side??'-'} depthWrite=${material.depthWrite??'-'} map=${map}`;
}

export function listHybridDrawCalls(root){
  const entries=[];
  const visit=(object,hidden=false)=>{
    hidden ||= !object.visible;
    if(hidden)return;
    if(object.isMesh||object.isLine||object.isPoints){
      const materials=Array.isArray(object.material)?object.material:[object.material];
      const groups=object.geometry?.groups||[];
      const drawMaterials=Array.isArray(object.material)
        ? groups.map(group=>object.material[group.materialIndex]).filter(Boolean)
        : [object.material];
      const calls=drawMaterials.filter(material=>material?.visible!==false).length;
      if(calls){
        const {source,factory}=sourceFor(object);
        const label=materials.filter(Boolean).map(materialLabel).join(' + ');
        const triangles=(object.isMesh
          ? groups.length
            ? groups.reduce((sum,group)=>sum+group.count/3,0)
            : (object.geometry.index?.count??object.geometry.getAttribute('position')?.count??0)/3
          : 0)*(object.isInstancedMesh?object.count:1);
        entries.push({object,source,factory,material:label,calls,triangles});
      }
    }
    for(const child of object.children)visit(child,hidden);
  };
  visit(root);
  return entries;
}

function summarize(entries,count,roomObjects){
  const totals=new Map(),sources=new Map();
  for(const item of entries){
    const key=`${item.source} | ${item.factory} | ${item.material}`;
    const value=totals.get(key)||{calls:0,triangles:0,objects:0};
    value.calls+=item.calls;value.triangles+=item.triangles;value.objects++;totals.set(key,value);
    if(!item.source.startsWith('object kind: avatar-')){
      const sourceKey=`${item.source} | ${item.factory}`;
      const source=sources.get(sourceKey)||{calls:0,triangles:0,objects:0,materials:new Set()};
      source.calls+=item.calls;source.triangles+=item.triangles;source.objects++;source.materials.add(item.material);sources.set(sourceKey,source);
    }
  }
  const rows=[...totals].map(([key,value])=>({key,...value})).sort((a,b)=>b.calls-a.calls||a.key.localeCompare(b.key));
  const sourceRows=[...sources].map(([key,value])=>({key,...value,materials:value.materials.size})).sort((a,b)=>b.calls-a.calls||a.key.localeCompare(b.key));
  const roomEntries=entries.filter(item=>!item.source.startsWith('object kind: avatar-'));
  return {count,roomObjects,roomDrawCalls:roomEntries.reduce((n,item)=>n+item.calls,0),roomTriangles:roomEntries.reduce((n,item)=>n+item.triangles,0),
    rows:rows.filter(row=>!row.key.includes('object kind: avatar-')),sourceRows};
}

async function profile(count){
  const room=hybridPerformanceFixture(count,{domainFloors,departmentStarterRoom,parseRoomJSON});
  const dom=new JSDOM('<div id="scene"><div class="hy-objects"></div></div>');
  const root=dom.window.document.querySelector('#scene');
  let layer;
  try{
    layer=new HybridOffice3D(root,{Renderer:class extends HeadlessRenderer{constructor(options){super({...options,root});}}});
    // Character assets are separately measured by perf:hybrid; the room
    // inventory counts their source objects but intentionally omits their GLB
    // geometry, so the report is independent of local external asset bytes.
    layer.characters={create:id=>{const group=new THREE.Group();group.name=`headless-${id}`;return group;},dispose(){}};
    layer.sync(room,true);
    const after=summarize(listHybridDrawCalls(layer.scene),count,room.objects.length);
    layer.sceneBatches.clear();
    const before=summarize(listHybridDrawCalls(layer.scene),count,room.objects.length);
    return {count,roomObjects:room.objects.length,before,after};
  }finally{
    layer?.dispose();dom.window.close();
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  for(const count of [4,12]){
    const result=await profile(count);
    console.log(`\n${count} avatars · ${result.roomObjects} room objects · room calls ${result.before.roomDrawCalls} → ${result.after.roomDrawCalls} · triangles ${result.before.roomTriangles} → ${result.after.roomTriangles}`);
    for(const [label,summary]of [['before',result.before],['after',result.after]]){
      console.log(`${label}: calls | meshes | materials | source / factory`);
      for(const row of summary.sourceRows)console.log(`${row.calls} | ${row.objects} | ${row.materials} | ${row.key}`);
      console.log(`${label}: top source/material contributors: calls | source meshes | source / factory / material`);
      for(const row of summary.rows.slice(0,18))console.log(`${row.calls} | ${row.objects} | ${row.key}`);
    }
  }
}
