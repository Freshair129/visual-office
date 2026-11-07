import {worldToGround} from './office-projection.js';
import {blueprintLimits} from './office-design-limits.js';
// @req VO-FR-022 — validated metric structural plans and an independent local template library.
// @tested tests/office-blueprint-authoring.test.mjs

// Structural presentation data only. No Business, Agent, external URLs or executable fields.
export const officeBlueprints=Object.freeze(Object.fromEntries([
  ['small','S · Compact',8,6,2,1,3],['medium','M · Team',12,8,3,2,3],['large','L · Open office',16,10,4,2,3.6],
].map(([id,label,width,depth,columns,rows,loungeWidth])=>[id,Object.freeze({id,label,width,depth,columns,rows,loungeWidth,revision:1,wallThickness:.2,wallHeight:2.8,cutawayHeight:.65,doorWidth:1.2,aisleWidth:2,designPxPerMetre:100})])));
export const isOfficeBlueprint=id=>typeof id==='string'&&Object.hasOwn(officeBlueprints,id);
export const wallNames={rear:'ผนังหลัง',front:'ผนังหน้า',left:'ผนังซ้าย',right:'ผนังขวา'};
const clone=v=>JSON.parse(JSON.stringify(v));
const keys=(v,allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));
const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
export const wallLength=(plan,wall)=>['rear','front'].includes(wall)?plan.width:plan.depth;
export function defaultBlueprintPlan(id){
  if(!isOfficeBlueprint(id))throw Error('ไม่พบแม่แบบ');const b=officeBlueprints[id];
  return {version:1,base:id,width:b.width,depth:b.depth,originX:-b.width/2-2,originZ:-b.depth/2-2,
    door:{wall:'front',offset:1.5,width:1.2},windows:[.26,.7].map((fraction,i)=>({id:`window-${i+1}`,wall:'rear',offset:-.1+fraction*(b.width+.2)-.9,width:1.8,sill:1,top:2.2}))};
}
export function validateBlueprintPlan(value,options={}){
  const limits=blueprintLimits(options),bounds=limits.cornerBounds;
  if(!keys(value,['version','base','width','depth','originX','originZ','door','windows','partitions','areas'])||value.version!==1||!isOfficeBlueprint(value.base)||
    !finite(value.width,8,limits.maxWidth)||!finite(value.depth,6,limits.maxDepth)||!finite(value.originX,-20,10)||!finite(value.originZ,-20,10))throw Error(`แปลนไม่ถูกต้อง · กว้าง 8–${limits.maxWidth} ม. ลึก 6–${limits.maxDepth} ม.`);
  const check=(o,isWindow)=>{
    if(!keys(o,isWindow?['id','wall','offset','width','sill','top']:['wall','offset','width','open'])||!Object.hasOwn(wallNames,o.wall)||!finite(o.offset,.2,limits.maxOffset)||
      !finite(o.width,isWindow?.6:1.2,3)||o.offset+o.width>wallLength(value,o.wall)-.2+1e-8)throw Error('ประตู/หน้าต่างต้องอยู่บนผนังและห่างมุมอย่างน้อย 0.2 ม.');
    if(!isWindow&&Object.hasOwn(o,'open')&&typeof o.open!=='boolean')throw Error('สถานะประตูต้องเป็น true หรือ false');
    if(isWindow&&(typeof o.id!=='string'||o.id==='door'||!/^[a-zA-Z0-9_-]{1,40}$/.test(o.id)||!finite(o.sill,.3,1.8)||!finite(o.top,o.sill+.4,2.5)))throw Error('ขนาดหรือรหัสหน้าต่างไม่ถูกต้อง');
  };
  check(value.door,false);
  if(!Array.isArray(value.windows)||value.windows.length>8)throw Error('หน้าต่างสูงสุด 8 บาน');
  const ids=new Set();for(const window of value.windows){check(window,true);if(ids.has(window.id))throw Error('รหัสหน้าต่างซ้ำ');ids.add(window.id);}
  const openings=[value.door,...value.windows];
  for(let i=0;i<openings.length;i++)for(let j=i+1;j<openings.length;j++){
    const a=openings[i],b=openings[j];if(a.wall===b.wall&&a.offset<b.offset+b.width+.15&&b.offset<a.offset+a.width+.15)throw Error('ช่องประตู/หน้าต่างทับกัน · เว้นระยะอย่างน้อย 0.15 ม.');
  }
  for(const x of [value.originX,value.originX+value.width])for(const z of [value.originZ,value.originZ+value.depth]){
    const p=worldToGround({x,z});if(!finite(p.x,bounds.minX,bounds.maxX)||!finite(p.y,bounds.minY,bounds.maxY))throw Error('ผนังอยู่นอกพื้นที่กล้อง · ลดขนาดหรือย้ายผนังกลับ');
  }
  validateInterior(value,limits);
  return clone(value);
}
export const roomAreaTypes={meeting:'ห้องประชุม',work:'ห้องทำงาน',rest:'พื้นที่พัก'};
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(id);
function validateInterior(p,limits){
  const walls=Object.hasOwn(p,'partitions')?p.partitions:[],areas=Object.hasOwn(p,'areas')?p.areas:[];
  if(!Array.isArray(walls)||walls.length>limits.maxPartitions||!Array.isArray(areas)||areas.length>limits.maxAreas)throw Error(`ผนังกั้นสูงสุด ${limits.maxPartitions} แนว · พื้นที่สูงสุด ${limits.maxAreas} ห้อง`);
  const ids=new Set();
  for(const w of walls){
    if(!keys(w,['id','axis','at','start','end','door'])||!validId(w.id)||ids.has(w.id)||!['x','z'].includes(w.axis)||
      !finite(w.at,.3,(w.axis==='x'?p.depth:p.width)-.3)||!finite(w.start,0,(w.axis==='x'?p.width:p.depth))||!finite(w.end,w.start+1,(w.axis==='x'?p.width:p.depth)))throw Error('ผนังกั้นต้องตรง อยู่ในห้อง และยาวอย่างน้อย 1 ม. · รหัสไม่ซ้ำ');
    ids.add(w.id);
    if(Object.hasOwn(w,'door')&&(!keys(w.door,['offset','width','open'])||!finite(w.door.offset,.2,w.end-w.start)||!finite(w.door.width,1.2,3)||w.door.offset+w.door.width>w.end-w.start-.2+1e-8||Object.hasOwn(w.door,'open')&&typeof w.door.open!=='boolean'))throw Error('ประตูผนังกั้นกว้าง 1.2–3 ม. ห่างปลาย 0.2 ม. และสถานะ open ต้องเป็น boolean');
  }
  for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
    const a=walls[i],b=walls[j];
    if(a.axis===b.axis){if(Math.abs(a.at-b.at)<.2&&a.start<b.end&&b.start<a.end)throw Error('แนวผนังกั้นทับกัน');continue;}
    const x=a.axis==='x'?a:b,z=a.axis==='z'?a:b;
    if(z.at>=x.start-.1&&z.at<=x.end+.1&&x.at>=z.start-.1&&x.at<=z.end+.1){
      for(const [wall,u]of [[x,z.at],[z,x.at]])if(wall.door&&u>=wall.start+wall.door.offset-.3&&u<=wall.start+wall.door.offset+wall.door.width+.3)throw Error('ประตูทับจุดเชื่อมผนัง · ย้ายประตูห่างจุดเชื่อม 0.3 ม.');
    }
  }
  for(const a of areas){
    if(!keys(a,['id','type','name','x','z','width','depth'])||!validId(a.id)||ids.has(a.id)||!Object.hasOwn(roomAreaTypes,a.type)||typeof a.name!=='string'||!a.name.trim()||a.name.length>60||
      !finite(a.x,0,p.width)||!finite(a.z,0,p.depth)||!finite(a.width,.5,p.width-a.x+1e-8)||!finite(a.depth,.5,p.depth-a.z+1e-8))throw Error('พื้นที่ต้องอยู่ในห้อง ขนาดอย่างน้อย 0.5 ม. และมีชื่อไม่เกิน 60 ตัวอักษร');
    ids.add(a.id);
  }
}
export function resolveOfficeBlueprint(input,options={}){
  const plan=typeof input==='string'?defaultBlueprintPlan(input):validateBlueprintPlan(input,options),base=officeBlueprints[plan.base];
  return {...base,...plan,id:plan.base,label:base.label,loungeWidth:Math.min(base.loungeWidth,plan.width-4)};
}
export const isBlueprintInput=input=>isOfficeBlueprint(input)||!!input&&typeof input==='object'&&input.version===1&&isOfficeBlueprint(input.base);
export function moveBlueprintWall(value,wall,delta,options={}){
  if(!Object.hasOwn(wallNames,wall)||!Number.isFinite(delta))throw Error('ระยะผนังไม่ถูกต้อง');
  const p=clone(value);if(wall==='right')p.width+=delta;if(wall==='front')p.depth+=delta;
  if(wall==='left'){p.originX+=delta;p.width-=delta;}if(wall==='rear'){p.originZ+=delta;p.depth-=delta;}
  if(wall==='left'||wall==='rear')for(const o of [p.door,...p.windows])if(wall==='left'?['rear','front'].includes(o.wall):['left','right'].includes(o.wall))o.offset-=delta;
  if(wall==='left'||wall==='rear'){
    for(const w of p.partitions||[]){if(w.axis===(wall==='left'?'z':'x'))w.at-=delta;else{w.start-=delta;w.end-=delta;}}
    for(const a of p.areas||[])a[wall==='left'?'x':'z']-=delta;
  }
  return validateBlueprintPlan(p,options);
}
export function moveBlueprintOpening(value,id,wall,offset,options={}){
  const p=clone(value),o=id==='door'?p.door:p.windows.find(w=>w.id===id);if(!o)throw Error('ไม่พบช่องเปิด');
  o.wall=wall;o.offset=offset;return validateBlueprintPlan(p,options);
}
export function toggleBlueprintDoor(value,id,options={}){
  const p=validateBlueprintPlan(value,options),door=id==='entry'?p.door:id.startsWith('partition:')?p.partitions?.find(w=>w.id===id.slice(10))?.door:null;
  if(!door)throw Error('ไม่พบประตู');door.open=door.open===false;return validateBlueprintPlan(p,options);
}
export const BLUEPRINT_TEMPLATES_KEY='zuri-office:blueprint-templates:v1';
export const TYCOON_BLUEPRINT_TEMPLATES_KEY='zuri-office:tycoon-blueprint-templates:v1';
export class BlueprintTemplateStore{
  constructor(storage,options={}){
    blueprintLimits(options);this.storage=storage;this.options=options;this.items=[];this.key=options.profile==='tycoon'?TYCOON_BLUEPRINT_TEMPLATES_KEY:BLUEPRINT_TEMPLATES_KEY;
    // Legacy templates remain available until the first explicit Tycoon save;
    // larger templates never enter the older editor's collection.
    try{const saved=storage?.getItem(this.key)??(options.profile==='tycoon'?storage?.getItem(BLUEPRINT_TEMPLATES_KEY):null),raw=JSON.parse(saved||'null');if(raw?.version!==1||!Array.isArray(raw.items))return;
      const seen=new Set();for(const item of raw.items.slice(0,20)){try{
        if(!keys(item,['id','name','plan'])||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,60}$/.test(item.id)||seen.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80)continue;
        const plan=validateBlueprintPlan(item.plan,options);seen.add(item.id);this.items.push({id:item.id,name:item.name,plan});
      }catch{/* Invalid entries are isolated; never execute imported fields. */}}
    }catch{/* Denied/corrupt storage leaves a usable empty library. */}
  }
  save(name,plan){
    try{
      if(typeof name!=='string'||!name.trim()||name.length>80)throw Error('ตั้งชื่อเทมเพลต 1–80 ตัวอักษร');
      const fresh=new BlueprintTemplateStore(this.storage,this.options);if(fresh.items.length>=20)throw Error('คลังเทมเพลตเต็มแล้ว (สูงสุด 20 แบบ)');
      const item={id:`bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,name:name.trim(),plan:validateBlueprintPlan(plan,this.options)};
      this.storage.setItem(this.key,JSON.stringify({version:1,items:[...fresh.items,item]}));this.items=[...fresh.items,item];return {ok:true,id:item.id};
    }catch(e){return {ok:false,message:e.message||'บันทึกเทมเพลตไม่ได้'};}
  }
}
