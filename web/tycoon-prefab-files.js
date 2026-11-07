import {customModels,inspectCustomGLB,verifyCustomMeasurement,disposeCustomModel} from './custom-assets.js';
import {validateFurnitureSet} from './tycoon-prefabs.js';
import {TYCOON_ASSETS} from './tycoon-models.js';
const MAX=8000000,prefix='data:model/gltf-binary;base64,';
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error('รูปแบบแพ็กเกจชุดไม่ถูกต้อง');};
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
// Bump this contract whenever coordinate/anchor interpretation changes, even with unchanged GLBs.
const geometryContract='office-tycoon-metric/v1';
async function kitIdentity(catalog){return {revision:catalog.revision,sha256:await hash(new TextEncoder().encode(JSON.stringify(canonical({catalog,geometry:TYCOON_ASSETS,geometryContract}))))};}
const encode=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};
function header(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length<12||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.length)throw Error('ไฟล์โมเดล GLB เสียหาย');}
async function getCatalog(){const response=await fetch('./assets/models/tycoon/manifest.json');if(!response.ok)throw Error('อ่านรายการโมเดลของแอปไม่ได้');return response.json();}
function metaFor(catalog,kind){const meta=catalog.assets?.find(a=>a.kind===kind);if(!meta||!/^[a-z-]+\.glb$/.test(meta.file)||!/^[a-f0-9]{64}$/.test(meta.sha256))throw Error('เวอร์ชันโมเดลไม่รองรับใน Visual Office เครื่องนี้');return meta;}
async function verify(bytes,expected){header(bytes);if(await hash(bytes)!==expected)throw Error('GLB เสียหายหรือเวอร์ชันโมเดลไม่ตรงกับแอป');}
async function exportV1(value,{catalog,load}={}){
 const set=validateFurnitureSet(value);catalog||=await getCatalog();const models=[];
 for(const kind of [...new Set(set.room.objects.map(o=>o.kind))].sort()){
  const meta=metaFor(catalog,kind);let bytes;
  if(load)bytes=await load(kind);else{const response=await fetch('./assets/models/tycoon/'+meta.file);if(!response.ok)throw Error('โหลด GLB เพื่อส่งออกไม่ได้');bytes=new Uint8Array(await response.arrayBuffer());}
  await verify(bytes,meta.sha256);models.push({kind,sha256:meta.sha256,data:prefix+encode(bytes)});
 }
 const text=JSON.stringify({schemaVersion:'office-furniture-bundle/v1',kit:await kitIdentity(catalog),set,models});if(new TextEncoder().encode(text).length>MAX)throw Error('แพ็กเกจใหญ่เกิน 8 MB');return text;
}
async function importV1(text,{catalog}={}){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX)throw Error('ไฟล์ต้องไม่เกิน 8 MB');
 const bundle=JSON.parse(text);exact(bundle,['schemaVersion','kit','set','models']);if(bundle.schemaVersion!=='office-furniture-bundle/v1')throw Error('เวอร์ชันไฟล์ชุดไม่รองรับ');
 const set=validateFurnitureSet(bundle.set),required=new Set(set.room.objects.map(o=>o.kind));
 if(!Array.isArray(bundle.models)||bundle.models.length!==required.size)throw Error('โมเดลในแพ็กเกจไม่ครบหรือซ้ำ');
 catalog||=await getCatalog();exact(bundle.kit,['revision','sha256']);const kit=await kitIdentity(catalog);if(bundle.kit.revision!==kit.revision||bundle.kit.sha256!==kit.sha256)throw Error('เวอร์ชัน model kit หรือมาตรฐานพิกัดไม่ตรงกับ Visual Office เครื่องนี้');const seen=new Set();
 for(const model of bundle.models){
  exact(model,['kind','sha256','data']);if(!required.has(model.kind)||seen.has(model.kind))throw Error('โมเดลในแพ็กเกจไม่ครบหรือซ้ำ');seen.add(model.kind);
  const meta=metaFor(catalog,model.kind);if(model.sha256!==meta.sha256)throw Error('เวอร์ชันโมเดลไม่ตรงกับ Visual Office เครื่องนี้');
  if(typeof model.data!=='string'||!model.data.startsWith(prefix)||! /^[A-Za-z0-9+/]+={0,2}$/.test(model.data.slice(prefix.length)))throw Error('ต้องฝังโมเดล GLB ในไฟล์');
  const bytes=Uint8Array.from(atob(model.data.slice(prefix.length)),c=>c.charCodeAt(0));await verify(bytes,meta.sha256);
 }
 return set;
}

export async function exportFurnitureBundle(value,options={}){
 const set=validateFurnitureSet(value);if(set.schemaVersion==='office-furniture-set/v1')return exportV1(value,options);
 const models=options.models||customModels,prepared=[],customIds=[...new Set(set.room.objects.filter(o=>o.asset).map(o=>o.asset.id))];
 const base={schemaVersion:'office-furniture-bundle/v2',geometryContract,set};
 const append=(meta,bytes)=>{prepared.push({meta,bytes});const overhead=new TextEncoder().encode(JSON.stringify({...base,models:prepared.map(p=>({...p.meta,data:prefix}))})).length;const encoded=prepared.reduce((n,p)=>n+4*Math.ceil(p.bytes.length/3),0);if(overhead+encoded>64000000)throw Error('แพ็กเกจใหญ่เกิน 64 MB');};
 // Collect and budget binary dependencies before parsing or allocating any base64 strings.
 for(const id of customIds)append({id},await models.get(id));
 const kinds=[...new Set(set.room.objects.filter(o=>!o.asset).map(o=>o.kind))].sort(),catalog=kinds.length?(options.catalog||await getCatalog()):null;
 for(const kind of kinds){const meta=metaFor(catalog,kind);let bytes;if(options.load)bytes=await options.load(kind);else{const r=await fetch('./assets/models/tycoon/'+meta.file);if(!r.ok)throw Error('โหลด GLB ไม่ได้');bytes=new Uint8Array(await r.arrayBuffer());}append({kind,sha256:meta.sha256,geometry:TYCOON_ASSETS[kind]},bytes);}
 const entries=[];for(const {meta,bytes} of prepared){if(meta.id){const info=await inspectCustomGLB(bytes);try{for(const o of set.room.objects.filter(o=>o.asset?.id===meta.id))verifyCustomMeasurement(info,o.asset);}finally{disposeCustomModel(info.model);}}else await verify(bytes,meta.sha256);entries.push({...meta,data:prefix+encode(bytes)});}
 return JSON.stringify({...base,models:entries});
}
export async function importFurnitureBundle(text,options={}){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>64000000)throw Error('ไฟล์ต้องไม่เกิน 64 MB');
 const value=JSON.parse(text);if(value.schemaVersion!=='office-furniture-bundle/v2')return importV1(text,options);
 exact(value,['schemaVersion','geometryContract','set','models']);if(value.geometryContract!==geometryContract)throw Error('มาตรฐานพิกัดไม่ตรงกับแอป');
 const set=validateFurnitureSet(value.set);if(set.schemaVersion!=='office-furniture-set/v2')throw Error('ไฟล์ชุดต้องเป็น v2');
 const customs=new Set(set.room.objects.filter(o=>o.asset).map(o=>o.asset.id)),kinds=new Set(set.room.objects.filter(o=>!o.asset).map(o=>o.kind));
 if(!Array.isArray(value.models)||value.models.length!==customs.size+kinds.size)throw Error('โมเดลไม่ครบหรือซ้ำ');
 const seen=new Set(),pending=[],catalog=kinds.size?(options.catalog||await getCatalog()):null;
 for(const item of value.models){
  const custom=Object.hasOwn(item,'id');exact(item,custom?['id','data']:['kind','sha256','geometry','data']);const key=custom?item.id:item.kind;
  if(!(custom?customs:kinds).has(key)||seen.has(key))throw Error('โมเดลไม่ครบหรือซ้ำ');seen.add(key);
  if(typeof item.data!=='string'||!item.data.startsWith(prefix)||! /^[A-Za-z0-9+/]+={0,2}$/.test(item.data.slice(prefix.length)))throw Error('ต้องฝังโมเดล GLB');
  const bytes=Uint8Array.from(atob(item.data.slice(prefix.length)),c=>c.charCodeAt(0));
  if(custom){const info=await inspectCustomGLB(bytes);try{for(const o of set.room.objects.filter(o=>o.asset?.id===key))verifyCustomMeasurement(info,o.asset);}finally{disposeCustomModel(info.model);}pending.push({id:key,bytes});}
  else{const meta=metaFor(catalog,key);if(item.sha256!==meta.sha256||JSON.stringify(canonical(item.geometry))!==JSON.stringify(canonical(TYCOON_ASSETS[key])))throw Error('โมเดล bundled ไม่ตรงกับแอป');await verify(bytes,meta.sha256);}
 }
 if(pending.length)await (options.models||customModels).putMany(pending);return set;
}
