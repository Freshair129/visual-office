// User props: content-addressed local binaries, never business or Agent records.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export const CUSTOM_CATEGORIES=['desk','chair','sofa','equipment','decoration'];
export const customHash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error('ข้อมูลโมเดลไม่ถูกต้อง');};
const finite=(v,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error('ขนาดหรือจุดใช้งานอยู่นอกช่วง');};
const vector=(v,n,min,max)=>{if(!Array.isArray(v)||v.length!==n)throw Error('พิกัดไม่ครบ');v.forEach(x=>finite(x,min,max));};
export function validateCustomAsset(a){
 exact(a,['id','name','category','size','sourceSize','origin','interaction']);
 if(!/^[a-f0-9]{64}$/.test(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>60||!CUSTOM_CATEGORIES.includes(a.category))throw Error('ชื่อ หมวดหมู่ หรือรหัสโมเดลไม่ถูกต้อง');
 vector(a.size,3,.01,12);vector(a.sourceSize,3,.000001,1000000);vector(a.origin,3,-1000000,1000000);
 const ratio=a.size[1]/a.sourceSize[1];if(a.size.some((v,i)=>Math.abs(v-a.sourceSize[i]*ratio)>1e-6))throw Error('โมเดลต้องคงสัดส่วนจริง');
 exact(a.interaction,['mode','approach','seat','height','heading']);const p=a.interaction;
 if(!['none','stand','seat'].includes(p.mode))throw Error('ชนิดจุดใช้งานไม่รองรับ');
 if(p.mode==='none'){if(Object.keys(p).length!==1)throw Error('โมเดลตกแต่งไม่มีจุดใช้งาน');}
 else{vector(p.approach,2,-12,12);if(p.mode==='seat'){vector(p.seat,2,-12,12);finite(p.height,.1,2);finite(p.heading,-Math.PI*2,Math.PI*2);if(Math.abs(p.seat[0])>a.size[0]/2||Math.abs(p.seat[1])>a.size[2]/2||p.height>a.size[1])throw Error('จุดนั่งต้องอยู่ภายในโมเดล');}else if(Object.keys(p).length!==2)throw Error('จุดยืนไม่ใช้พิกัดนั่ง');}
 return structuredClone(a);
}
function imageSize(bytes,mime){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(mime==='image/png'&&bytes.length>=24&&v.getUint32(0)===0x89504e47&&v.getUint32(4)===0x0d0a1a0a)return [v.getUint32(16),v.getUint32(20)];
 if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){let at=2;while(at+4<bytes.length){if(bytes[at++]!==255)break;while(bytes[at]===255)at++;const marker=bytes[at++];if(marker===217||marker===218)break;const len=v.getUint16(at);if(len<2||at+len>bytes.length)break;if([192,193,194].includes(marker)&&len>=7)return [v.getUint16(at+5),v.getUint16(at+3)];at+=len;}}
 throw Error('ภาพใน GLB ต้องเป็น PNG/JPEG ที่ถูกต้อง');
}
export function inspectGLBContainer(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length<20||bytes.length>16000000)throw Error('GLB ต้องมีขนาดไม่เกิน 16 MB');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length)throw Error('GLB 2 เสียหาย');
 let json,bin;for(let at=12;at<bytes.length;){if(at+8>bytes.length)throw Error('GLB chunk เสียหาย');const n=view.getUint32(at,true),type=view.getUint32(at+4,true);if(n%4||at+8+n>bytes.length)throw Error('GLB chunk เสียหาย');const chunk=bytes.subarray(at+8,at+8+n);if(type===0x4e4f534a&&!json&&at===12)json=JSON.parse(new TextDecoder().decode(chunk));else if(type===0x004e4942&&!bin)bin=chunk;else throw Error('GLB chunk ไม่รองรับ');at+=8+n;}

 const supported=['KHR_materials_unlit','KHR_texture_transform','KHR_materials_emissive_strength'];
 const walk=v=>{if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='uri')throw Error('GLB ต้อง embedded เท่านั้น ไม่โหลดไฟล์ภายนอก');if(k==='extensions'&&(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(name=>!supported.includes(name)||!json.extensionsUsed?.includes(name))))throw Error('GLB extension ไม่รองรับหรือไม่ได้ประกาศ');walk(x);}};walk(json);
 if(json?.asset?.version!=='2.0'||!bin)throw Error('GLB ต้องฝัง geometry');
 if(json.animations?.length||json.skins?.length||json.cameras?.length)throw Error('รองรับโมเดลพร็อพ static ก่อน · ไม่รองรับ rig/animation/camera');
 if((json.extensionsUsed||[]).some(x=>!supported.includes(x))||(json.extensionsRequired||[]).some(x=>!supported.includes(x)))throw Error('GLB extension/compression นี้ยังไม่รองรับ');
 if(json.buffers?.length!==1||!Number.isSafeInteger(json.buffers[0].byteLength)||json.buffers[0].byteLength>bin.length)throw Error('GLB buffer ไม่ถูกต้อง');
 if((json.nodes?.length||0)>2048||(json.meshes?.length||0)>512||(json.materials?.length||0)>256||(json.images?.length||0)>64)throw Error('GLB ซับซ้อนเกินงบ');
 if((json.accessors?.length||0)>4096|| (json.accessors||[]).reduce((n,a)=>n+(a.count||0),0)>2000000)throw Error('GLB accessor เกินงบ');
 for(const a of json.accessors||[])if(!Number.isSafeInteger(a.count)||a.count<0||a.count>600000)throw Error('GLB accessor เกินงบ');
 if((json.meshes||[]).reduce((n,m)=>n+(m.primitives?.length||0),0)>2048||(json.nodes||[]).reduce((n,o)=>n+(json.meshes?.[o.mesh]?.primitives?.length||0),0)>2048)throw Error('GLB primitive instances เกิน 2048');
 let triangles=0;for(const m of json.meshes||[])for(const p of m.primitives||[]){if((p.mode??4)!==4||p.targets?.length)throw Error('รองรับ static triangle meshes');const count=json.accessors?.[p.indices??p.attributes?.POSITION]?.count;if(!Number.isSafeInteger(count)||count<0)throw Error('GLB accessor ไม่ถูกต้อง');triangles+=count/3;}
 const instanceTriangles=(json.nodes||[]).reduce((n,node)=>n+(json.meshes?.[node.mesh]?.primitives||[]).reduce((sum,p)=>sum+(json.accessors[p.indices??p.attributes.POSITION].count/3),0),0);
 if(instanceTriangles>200000)throw Error('GLB instances เกิน 200,000 triangles');
 if(triangles<=0||triangles>200000)throw Error('GLB ต้องมีไม่เกิน 200,000 triangles');
 let pixels=0;for(const image of json.images||[]){const b=json.bufferViews?.[image.bufferView],start=b?.byteOffset||0;if(!b||b.buffer!==0||!Number.isSafeInteger(start)||!Number.isSafeInteger(b.byteLength)||start<0||b.byteLength<=0||start+b.byteLength>bin.length)throw Error('ภาพใน GLB ไม่ถูกต้อง');const size=imageSize(bin.subarray(start,start+b.byteLength),image.mimeType);pixels+=size[0]*size[1];if(pixels>16777216)throw Error('ภาพรวมใน GLB เกิน 16 ล้านพิกเซล');if(size.some(x=>x<1||x>4096))throw Error('ภาพใน GLB ต้องไม่เกิน 4096 px');}
 return bytes;
}
function geometryOnlyGLB(bytes){
 // Container validation runs against the original first; this disposable parse copy removes only render-material image links.
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),jsonLength=view.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonLength))),binStart=28+jsonLength,bin=bytes.subarray(binStart);
 for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[])delete primitive.material;
 delete json.materials;delete json.textures;delete json.samplers;delete json.images;
 const materialExtensions=new Set(['KHR_materials_unlit','KHR_texture_transform','KHR_materials_emissive_strength']);
 for(const field of ['extensionsUsed','extensionsRequired'])if(Array.isArray(json[field])){json[field]=json[field].filter(name=>!materialExtensions.has(name));if(!json[field].length)delete json[field];}
 let jsonBytes=new TextEncoder().encode(JSON.stringify(json)),jsonPadded=(jsonBytes.length+3)&~3;
 const output=new Uint8Array(12+8+jsonPadded+8+bin.length),result=new DataView(output.buffer);
 result.setUint32(0,0x46546c67,true);result.setUint32(4,2,true);result.setUint32(8,output.length,true);
 result.setUint32(12,jsonPadded,true);result.setUint32(16,0x4e4f534a,true);output.fill(0x20,20,20+jsonPadded);output.set(jsonBytes,20);
 const binHeader=20+jsonPadded;result.setUint32(binHeader,bin.length,true);result.setUint32(binHeader+4,0x004e4942,true);output.set(bin,binHeader+8);
 return output;
}
export function disposeCustomModel(model){const gs=new Set(),ms=new Set(),ts=new Set();model?.traverse(n=>{if(n.geometry)gs.add(n.geometry);for(const m of [].concat(n.material||[])){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>{t.source?.data?.close?.();t.dispose();});}
export async function inspectCustomGLB(input,{geometryOnly=false}={}){
 const bytes=inspectGLBContainer(input),parseBytes=geometryOnly?geometryOnlyGLB(bytes):bytes,manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(!url.startsWith('blob:'))throw Error('ไม่อนุญาตแหล่งโมเดลภายนอก');return url;});
 let imageError=false;manager.onError=()=>{imageError=true;};
 const gltf=await new GLTFLoader(manager).parseAsync(parseBytes.slice().buffer,'');
 try{if(imageError)throw Error('โหลดภาพที่ฝังใน GLB ไม่สำเร็จ');const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()).toArray(),center=box.getCenter(new THREE.Vector3());vector(size,3,.000001,1000000);const origin=[center.x,box.min.y,center.z];vector(origin,3,-1000000,1000000);return {id:await customHash(bytes),size,origin,model:gltf.scene,bytes};}catch(error){disposeCustomModel(gltf.scene);throw error;}
}
export function describeCustomAsset(info,{name,category,height,interaction={mode:'none'}}){const factor=height/info.size[1];return validateCustomAsset({id:info.id,name:name.trim(),category,size:info.size.map(x=>x*factor),sourceSize:info.size,origin:info.origin,interaction});}
export function verifyCustomMeasurement(info,asset){validateCustomAsset(asset);if(info.id!==asset.id||info.size.some((v,i)=>Math.abs(v-asset.sourceSize[i])>1e-6)||info.origin.some((v,i)=>Math.abs(v-asset.origin[i])>1e-6))throw Error('ขนาดหรือรหัส GLB ไม่ตรงกับ descriptor');}
export function normalizeCustomModel(source,asset){const root=new THREE.Group(),offset=new THREE.Group(),model=source.clone(true);offset.add(model);offset.position.set(...asset.origin.map(v=>-v));const scale=new THREE.Group();scale.scale.setScalar(asset.size[1]/asset.sourceSize[1]);scale.add(offset);root.add(scale);return root;}
export class CustomModelStore{
 constructor(indexedDB=globalThis.indexedDB){this.indexedDB=indexedDB;}
 async db(){if(!this.indexedDB)throw Error('IndexedDB ไม่พร้อม · ใช้เบราว์เซอร์ที่รองรับ');return new Promise((resolve,reject)=>{const r=this.indexedDB.open('zuri-office-custom-models',1);r.onupgradeneeded=()=>r.result.createObjectStore('models',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('เปิดคลังโมเดลไม่ได้'));});}
 async get(id){const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('models','readonly'),r=tx.objectStore('models').get(id);tx.oncomplete=()=>{db.close();r.result?resolve(new Uint8Array(r.result.bytes)):reject(Error('ไม่พบ GLB ในเครื่องนี้ · นำเข้าไฟล์ชุดของโมเดลก่อน'));};tx.onerror=()=>{db.close();reject(Error('อ่านโมเดลไม่ได้'));};});}
 async putMany(items){for(const {id,bytes} of items){inspectGLBContainer(bytes);if(await customHash(bytes)!==id)throw Error('GLB hash ไม่ตรง');}const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction('models','readwrite');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(Error('บันทึก GLB ไม่ได้ · พื้นที่ในเครื่องอาจเต็ม'));};for(const {id,bytes} of items)tx.objectStore('models').put({id,bytes:bytes.slice().buffer});});}
}
export const customModels=new CustomModelStore();
