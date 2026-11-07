import {domainFloors} from './domain-office.js';
import {validateSurfaces,validateFinish,builtInDecor,roomSurfaces} from './room-surfaces.js';
import {OFFICE_ASSETS,OFFICE_ASSET_BY_ID} from './office-assets.js';

// Canonical positions of the existing Office geometry, in world metres.
export const DESKS=[[-3.25,-2.5],[.1,-2.5],[3.45,-2.5],[-2.7,1.35],[.65,1.35],[4,1.35]];
export const nativeFloors=domainFloors.map(d=>d.key);
export const copy=v=>JSON.parse(JSON.stringify(v));
export const NATIVE_LIMIT=48;
export const nativeCatalog=OFFICE_ASSETS.filter(asset=>asset.kind).map(asset=>({kind:asset.kind,label:asset.name,assetId:asset.assetId}));
export const nativeName=o=>{
  if(!o)return 'ยังไม่ได้เลือกชิ้นงาน';
  if(o.kind==='room-decor')return `${roomSurfaces.find(s=>s.id===o.source)?.label}${o.id.startsWith('builtin-')?' · เดิม':` · ${o.id.slice(-6)}`}`;
  const asset=OFFICE_ASSET_BY_ID.get(o.assetId);
  const label=asset?.name||nativeCatalog.find(p=>p.kind===o.kind)?.label||o.kind;
  return `${label} ${o.slot===undefined?o.id.slice(-6):o.slot+1}`;
};
export const nativeBounds=o=>o?.kind==='room-decor'?{x:6.95,z:4.75}:{x:5.5,z:3.8};
export function nativeDecor(room){
  const list=room.decor??builtInDecor.map(({source,x,z})=>({id:`builtin-${source}`,kind:'room-decor',source,x,z,rotation:0,locked:false,interaction:{type:'none'}}));
  return list.map(o=>({...o,finish:o.finish??room.surfaces?.[o.source]??{}}));
}
export const nativeObjects=room=>{
  const all=[...room.objects,...nativeDecor(room)];
  if(!room.layers)return all;
  const byId=new Map(all.map(o=>[o.id,o]));
  return room.layers.map(id=>byId.get(id)).filter(Boolean);
};
export function createNativeObject(kind,id,assetId=nativeCatalog.find(asset=>asset.kind===kind)?.assetId){
  return {id,kind,...(assetId?{assetId}:{}),x:0,z:0,rotation:0,locked:false,interaction:{type:'none'}};
}
export function defaultNativeRoom(){
  return {schemaVersion:'office-3d/v1',objects:DESKS.flatMap(([x,z],slot)=>[
    {id:`desk-${slot}`,kind:'desk',slot,x,z,rotation:0,locked:false,interaction:{type:'none'}},
    {id:`chair-${slot}`,kind:'chair',slot,x,z:z+.95,rotation:0,locked:false,interaction:{type:'none'}},
  ])};
}
export function validateNativeRoom(v){
  if(!v||v.schemaVersion!=='office-3d/v1'||Object.keys(v).some(k=>!['schemaVersion','objects','surfaces','decor','projection','layers'].includes(k))||!Array.isArray(v.objects)||v.objects.length>NATIVE_LIMIT)throw Error(`ต้องเป็น office-3d/v1 และมีชิ้นงานไม่เกิน ${NATIVE_LIMIT} ชิ้น`);
  if(v.projection!==undefined&&!['orthographic','perspective'].includes(v.projection))throw Error('มุมกล้องไม่ถูกต้อง');
  if(JSON.stringify(v).length>2000000)throw Error('แบบชั้นรวม texture ต้องไม่เกิน 2 MB');
  if(v.surfaces!==undefined)validateSurfaces(v.surfaces);
  if(v.decor!==undefined&&(!Array.isArray(v.decor)||v.decor.length>builtInDecor.length))throw Error('รายการของตกแต่งเดิมไม่ถูกต้อง');
  const ids=new Set(),groups=new Map();
  for(const o of [...v.objects,...(v.decor||[])]){
    const asset=typeof o?.assetId==='string'?OFFICE_ASSET_BY_ID.get(o.assetId):null;
    const assetMatches=!!asset&&asset.placeable!==false&&(o.kind==='asset'?asset.sceneKind==='asset':asset.kind===o.kind);
    const assetKind=o?.kind==='asset'&&assetMatches;
    const original=o&&['desk','chair'].includes(o.kind)&&Number.isInteger(o.slot)&&o.slot>=0&&o.slot<6&&o.id===`${o.kind}-${o.slot}`;
    const added=o&& !Object.hasOwn(o,'slot')&&typeof o.id==='string'&&/^prop-[a-z0-9-]{8,64}$/.test(o.id);
    const decor=o?.kind==='room-decor'&&builtInDecor.some(p=>p.source===o.source)&&!Object.hasOwn(o,'slot');
    const builtin=decor&&o.id===`builtin-${o.source}`&&(v.decor||[]).includes(o);
    const inDecor=(v.decor||[]).includes(o),bounds=nativeBounds(o);
    if(!o||Object.keys(o).some(k=>!['id','kind','assetId','slot','source','x','z','rotation','locked','interaction','finish','scale','tilt','groupId'].includes(k))||(!nativeCatalog.some(p=>p.kind===o.kind)&&!assetKind&&!decor)||(o.kind==='asset'&&!assetKind)||(o.assetId!==undefined&&!assetMatches)||(!decor&&Object.hasOwn(o,'source'))||!(original||added||builtin)||(inDecor&&!builtin)||(!inDecor&&builtin)||ids.has(o.id)||!Number.isFinite(o.x)||Math.abs(o.x)>bounds.x||!Number.isFinite(o.z)||Math.abs(o.z)>bounds.z||!Number.isFinite(o.rotation)||o.rotation< -180||o.rotation>180||typeof o.locked!=='boolean'||(o.groupId!==undefined&&(typeof o.groupId!=='string'||!/^group-[a-z0-9-]{8,64}$/.test(o.groupId))))throw Error('ชิ้นงาน 3D ไม่ถูกต้อง: ตรวจ Asset ID, ชนิด, ตำแหน่ง และมุมหมุน');
    for(const [field,keys,min,max] of [['scale',['x','y','z'],.1,4],['tilt',['x','z'],-60,60]]){
      const a=o[field];if(a!==undefined&&(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length!==keys.length||keys.some(k=>!Number.isFinite(a[k])||a[k]<min||a[k]>max)))throw Error('ขนาดหรือมุมเอียงอยู่นอกช่วงที่รองรับ');
    }
    if(o.finish!==undefined)validateFinish(o.finish);
    ids.add(o.id);if(o.groupId)groups.set(o.groupId,[...(groups.get(o.groupId)||[]),o.id]);const a=o.interaction;
    if(!a||typeof a!=='object'||Array.isArray(a))throw Error('Interaction ไม่ถูกต้อง');
    const valid=a.type==='none'||a.type==='elevator'?Object.keys(a).every(k=>k==='type'):
      a.type==='floor'?Object.keys(a).every(k=>['type','floor'].includes(k))&&['lobby',...nativeFloors].includes(a.floor):
      a.type==='popup'&&Object.keys(a).every(k=>['type','title','body'].includes(k))&&typeof a.title==='string'&&a.title.length<=80&&typeof a.body==='string'&&a.body.length<=1000;
    if(!valid)throw Error('Interaction รองรับข้อความ ลิฟต์ และชั้นในสำนักงานเท่านั้น');
  }
  const allIds=[...v.objects,...nativeDecor(v)].map(o=>o.id);
  if(v.layers!==undefined&&(!Array.isArray(v.layers)||v.layers.length!==allIds.length||new Set(v.layers).size!==allIds.length||v.layers.some(id=>!allIds.includes(id))))throw Error('ลำดับเลเยอร์ต้องระบุชิ้นงานในชั้นนี้ครบและไม่ซ้ำ');
  const order=v.layers??allIds;
  for(const [groupId,members]of groups){
    if(members.length<2)throw Error('กลุ่มต้องมีชิ้นงานอย่างน้อย 2 ชิ้น');
    const positions=members.map(id=>order.indexOf(id)).sort((a,b)=>a-b);
    if(positions.some((position,index)=>position<0||index>0&&position!==positions[index-1]+1))throw Error('ชิ้นงานในกลุ่มต้องอยู่ติดกันในลำดับเลเยอร์');
  }
  return copy(v);
}
export class NativeHistory{
  constructor(room){this.current=validateNativeRoom(room||defaultNativeRoom());this.saved=copy(this.current);this.past=[];this.future=[];}
  get dirty(){return JSON.stringify(this.current)!==JSON.stringify(this.saved);}
  change(v){v=validateNativeRoom(v);if(JSON.stringify(v)===JSON.stringify(this.current))return;this.past.push(copy(this.current));this.past=this.past.slice(-60);let bytes=this.past.reduce((n,r)=>n+JSON.stringify(r).length,0);while(this.past.length>1&&bytes>12000000)bytes-=JSON.stringify(this.past.shift()).length;this.future=[];this.current=v;}
  undo(){if(this.past.length){this.future.push(this.current);this.current=this.past.pop();}}
  redo(){if(this.future.length){this.past.push(this.current);this.current=this.future.pop();}}
  commit(){this.saved=copy(this.current);}
}
