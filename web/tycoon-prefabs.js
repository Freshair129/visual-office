// Local furniture sets contain no Agent, business binding, room shell or route.
import {validateTycoonRoom} from './tycoon-state.js';
import {expandSelection,orderedObjects,transformSelection} from './tycoon-transform.js';
import {createTycoonNavigation,tycoonWorld} from './tycoon-blueprint.js';
import {validateTexture} from './room-surfaces.js';
import {TYCOON_ASSETS} from './tycoon-models.js';
import {createLocalDesignId} from './local-design-id.js';
const PREFIX='zuri-office:furniture-set:v1:',copy=v=>JSON.parse(JSON.stringify(v));
const kinds=new Set(['desk','chair','sofa','coffee-table','coffee','cabinet','plant','meeting','custom']);
const inside=(o,p,padding=0)=>{const dx=p.x-o.x,dz=p.z-o.z,c=Math.cos(o.rotation),s=Math.sin(o.rotation),size=o.asset?[o.asset.size[0],o.asset.size[2]]:TYCOON_ASSETS[o.kind].footprint;return Math.abs(c*dx-s*dz)<=size[0]*o.scale/2+padding+1e-8&&Math.abs(s*dx+c*dz)<=size[1]*o.scale/2+padding+1e-8;};
function segmentBlocked(o,a,b){
 const c=Math.cos(o.rotation),s=Math.sin(o.rotation),local=p=>[c*(p.x-o.x)-s*(p.z-o.z),s*(p.x-o.x)+c*(p.z-o.z)],start=local(a),end=local(b),size=o.asset?[o.asset.size[0],o.asset.size[2]]:TYCOON_ASSETS[o.kind].footprint;let low=0,high=1;
 for(let i=0;i<2;i++){const half=size[i]*o.scale/2+.3,d=end[i]-start[i];if(Math.abs(d)<1e-10){if(Math.abs(start[i])>half)return false;}else{const x=(-half-start[i])/d,y=(half-start[i])/d;low=Math.max(low,Math.min(x,y));high=Math.min(high,Math.max(x,y));if(low>high)return false;}}
 return true;
}
const keys=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error('รูปแบบชุดเฟอร์นิเจอร์ไม่ถูกต้อง');};
export function validateFurnitureSet(value){
 keys(value,['schemaVersion','name','preview','room']);
 if(!['office-furniture-set/v1','office-furniture-set/v2'].includes(value.schemaVersion)||typeof value.name!=='string'||!value.name.trim()||value.name.length>60)throw Error('ตั้งชื่อชุด 1–60 ตัวอักษร');
 validateTexture({data:value.preview,repeatX:1,repeatY:1,offsetX:0,offsetY:0,rotation:0,opacity:1});
 const room=validateTycoonRoom(value.room);keys(room,['schemaVersion','width','depth','objects','layers','navigation']);
 if(!room.layers||!room.navigation)throw Error('ชุดต้องมีลำดับชิ้นและจุดใช้งาน');
 if(room.objects.length<(value.schemaVersion==='office-furniture-set/v2'?1:2)||room.objects.length>40||room.objects.some(o=>!kinds.has(o.kind)))throw Error('เลือกเฟอร์นิเจอร์ 2–40 ชิ้น ไม่รวมอาคารหรือตัวละคร');
 if(value.schemaVersion==='office-furniture-set/v1'&&room.objects.some(o=>o.asset))throw Error('Custom sets require v2');
 if(room.navigation?.routes.length||room.navigation?.forbidden.length)throw Error('ชุดเฟอร์นิเจอร์ไม่เก็บทางเดินของห้อง');
 for(const o of room.objects){
  if(o.intent!==(o.kind==='desk'?'work':o.kind==='meeting'?'meeting':'decor'))throw Error('ชุดต้องไม่มีการผูกงานหรือชั้นต้นทาง');
  if(['desk','sofa','coffee'].includes(o.kind)||(o.asset&&o.asset.interaction.mode!=='none')){
   const station=room.navigation.stations.find(s=>s.objectId===o.id);if(!station||((['desk','sofa'].includes(o.kind)||o.asset?.interaction.mode==='seat')&&!station.seat))throw Error('ชุดต้องเก็บจุดนั่งและจุดเข้าถึงครบ');
   if(room.objects.some(item=>inside(item,tycoonWorld(station.approach),.3)))throw Error('จุดเข้าถึงถูกเฟอร์นิเจอร์ในชุดกีดขวาง');
   let seatObject=o;
   if(o.kind==='desk'){const seat=tycoonWorld(station.seat);seatObject=room.objects.find(c=>(c.kind==='chair'||(c.asset?.category==='chair'&&c.asset.interaction.mode==='seat'))&&c.y<=.05&&inside(c,seat));if(!seatObject)throw Error('จุดนั่งต้องอยู่บนเก้าอี้ในชุดที่ตั้งบนพื้น');}
   if((o.kind==='sofa'||o.asset?.interaction.mode==='seat')&&(o.y>.05||!inside(o,tycoonWorld(station.seat))))throw Error('จุดนั่งต้องอยู่บนโซฟาที่ตั้งบนพื้น');
   if(station.seat&&room.objects.some(item=>item.id!==seatObject.id&&segmentBlocked(item,tycoonWorld(station.approach),tycoonWorld(station.seat))))throw Error('ทางจากจุดเข้าถึงไปจุดนั่งถูกของในชุดกีดขวาง');
  }
 }
 return copy(value);
}
export function captureFurnitureSet(room,ids,name,preview){
 validateTycoonRoom(room);const selected=new Set(expandSelection(room,ids)),objects=orderedObjects(room).filter(o=>selected.has(o.id)).map(copy);
 if(objects.length<(objects.some(o=>o.asset)?1:2)||objects.some(o=>!kinds.has(o.kind)))throw Error('เลือกโต๊ะ เก้าอี้ หรือของตกแต่งอย่างน้อย 2 ชิ้น');
 const cx=(Math.min(...objects.map(o=>o.x))+Math.max(...objects.map(o=>o.x)))/2,cz=(Math.min(...objects.map(o=>o.z))+Math.max(...objects.map(o=>o.z)))/2;
 const nav=createTycoonNavigation(room),stations=[];
 for(const o of objects){if(objects.length>1)o.groupId='group-set';else delete o.groupId;o.intent=o.kind==='desk'?'work':o.kind==='meeting'?'meeting':'decor';
  if(!['desk','sofa','coffee'].includes(o.kind)&&!(o.asset&&o.asset.interaction.mode!=='none'))continue;
  const authored=room.navigation?.stations.find(s=>s.objectId===o.id),resolved=nav.stations.find(s=>s.objectId===o.id);
  if(!authored&&!resolved)throw Error(`ตรวจจุดนั่ง/เข้าถึงของ ${o.id} ก่อนบันทึกชุด`);
  if(o.kind==='desk'&&resolved?.seatObjectId&&!selected.has(resolved.seatObjectId))throw Error('เลือกเก้าอี้ที่ใช้กับโต๊ะนี้ด้วย');
  stations.push(authored?copy(authored):{objectId:o.id,approach:copy(resolved.position),...(resolved.seat?{seat:copy(resolved.seat)}:{})});
 }
 const subset={schemaVersion:'office-tycoon/v1',width:24,depth:20,objects,layers:objects.map(o=>o.id),navigation:{version:1,routes:[],forbidden:[],stations}};
 return validateFurnitureSet({schemaVersion:objects.some(o=>o.asset)?'office-furniture-set/v2':'office-furniture-set/v1',name:name.trim(),preview,room:transformSelection(subset,objects.map(o=>o.id),{dx:-cx,dz:-cz})});
}
export function placeFurnitureSet(room,value,{x=0,z=0}={}){
 validateTycoonRoom(room);const set=validateFurnitureSet(value),next=copy(room),used=new Set(next.objects.map(o=>o.id)),groups=new Set(next.objects.map(o=>o.groupId));
 const unique=(prefix,ids)=>{let i=1;while(ids.has(`${prefix}-${i}`))i++;const id=`${prefix}-${i}`;ids.add(id);return id;};
 const group=unique('group',groups),map=new Map(),objects=set.room.objects.map(o=>{const n=copy(o);n.id=createLocalDesignId(`${o.kind}-set`,used);if(set.room.objects.length>1)n.groupId=group;else delete n.groupId;map.set(o.id,n.id);return n;});
 next.objects.push(...objects);next.layers=[...set.room.layers.map(id=>map.get(id)),...orderedObjects(room).map(o=>o.id)];
 next.navigation||={version:1,routes:[],forbidden:[],stations:[]};
 next.navigation.stations.push(...(set.room.navigation?.stations||[]).map(s=>({...copy(s),objectId:map.get(s.objectId)})));
 const ids=objects.map(o=>o.id);return {room:transformSelection(next,ids,{dx:x,dz:z}),ids};
}
export class FurnitureLibrary{
 constructor(storage){this.storage=storage;}
 list(){const result=[];this.invalidEntries=0;if(!this.storage)return result;for(let i=0;i<this.storage.length;i++){const id=this.storage.key(i);if(!id?.startsWith(PREFIX))continue;try{result.push({id,...validateFurnitureSet(JSON.parse(this.storage.getItem(id)))});}catch{this.invalidEntries++;}}return result;}
 save(value){const clean=validateFurnitureSet(value);if(this.list().length>=24)throw Error('คลังชุดเต็มแล้ว (24 ชุด)');if(!this.storage)throw Error('พื้นที่บันทึกไม่พร้อม');const id=PREFIX+crypto.randomUUID();try{this.storage.setItem(id,JSON.stringify(clean));}catch{throw Error('บันทึกชุดไม่ได้ พื้นที่ในเครื่องอาจเต็ม');}return id;}
}
