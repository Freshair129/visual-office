import {QUARTER_ANGLES,ROTATABLE_KINDS} from './office-rotation.js';
import {validatePlacementGrid} from './office-placement-grid.js';
import {SHEET_EDITION,rebuildOfficeFromSheet} from './office-scene-sheet.js';
import {validateSkeletonParts,normalizedSkeletonParts} from './office-skeleton-parts.js';
import {characterAppearance} from './characters/runtime-catalog.js';
import {validateSkeletonAlignment} from './office-skeleton-alignment.js';
import {domainFloors} from './domain-office.js';
import {validateNativeRoom,nativeFloors} from './native-state.js';
import {normalizeOfficeNavigation,validateOfficeNavigation} from './office-nav-state.js';
import {isOfficeBlueprint} from './office-blueprints.js';
import {validateBlueprintPlan} from './office-blueprint-state.js';
import {rawObjectEntries,rawArrayItems,mergeRawJsonObject,mergeRawJsonArray} from './raw-json-merge.js';
// Local decor only. Floor keys identify preview rooms, never tenant/business authority.
export const floorKeys=['lobby',...domainFloors.map(f=>f.key)];
export const defaultEffects={opacity:1,shadow:0,glow:false,hover:'none'};
export function interactionFor(o){return o.interaction||{type:['lift','elevator-door','wayfinding-arrow'].includes(o.kind)?'elevator':'none'};}
function validInteraction(a){
  if(!a||typeof a!=='object'||Array.isArray(a))return false;
  if(a.type==='none'||a.type==='elevator'||a.type==='tasks')return Object.keys(a).every(k=>k==='type');
  if(a.type==='floor')return Object.keys(a).every(k=>['type','floor'].includes(k))&&floorKeys.includes(a.floor);
  return a.type==='popup'&&Object.keys(a).every(k=>['type','title','body'].includes(k))&&typeof a.title==='string'&&a.title.length<=80&&typeof a.body==='string'&&a.body.length<=1000;
}
function validEffects(e){return e&&typeof e==='object'&&!Array.isArray(e)&&Object.keys(e).every(k=>['opacity','shadow','glow','hover'].includes(k))&&Number.isFinite(e.opacity)&&e.opacity>=.25&&e.opacity<=1&&Number.isFinite(e.shadow)&&e.shadow>=0&&e.shadow<=24&&typeof e.glow==='boolean'&&['none','lift','highlight'].includes(e.hover);}
export const HYBRID_KEY='zuri-office:hybrid-studio:v1';
export const backgrounds={
  office:{name:'Office Idle · 3D',camera:'calibrated-isometric',src:'./assets/office-world/hybrid/backgrounds/office-isometric-v4.png'},
  garden:{name:'สวนยามเช้า',src:'./assets/office-world/hybrid/backgrounds/garden.png'},
  city:{name:'สตูดิโอในเมือง',src:'./assets/office-world/hybrid/backgrounds/city.png'},
};
export const genericAvatarKinds=Array.from({length:12},(_,i)=>`avatar-${String(i+1).padStart(2,'0')}`);
export const catalogGroups={furniture:'เฟอร์นิเจอร์',decor:'ของตกแต่ง',characters:'ตัวละคร'};
export const catalog={
  'work-desk':{name:'โต๊ะทำงาน · Isometric',group:'furniture',width:28,src:'./assets/office-world/hybrid/props/work-desk-isometric-v1.png'},
  'task-chair':{name:'เก้าอี้ทำงาน Ergonomic',group:'furniture',width:12,src:'./assets/office-world/hybrid/props/task-chair-isometric-v1.png'},
  'team-sofa':{name:'โซฟาพักทีม · Isometric',group:'furniture',width:23,src:'./assets/office-world/hybrid/props/sofa-isometric-v1.png'},
  'water-cooler':{name:'ตู้กดน้ำ · จุดพักทีม',group:'furniture',width:10,src:'./assets/office-world/hybrid/props/water-cooler.svg'},
  'wayfinding-arrow':{name:'ทางไปลิฟต์ · เลือกชั้น',group:'decor',width:17,src:'./assets/office-world/hybrid/props/wayfinding-arrow.svg'},
  'elevator-door':{name:'ลิฟต์ประจำชั้น',group:'decor',width:7,renderType:'hotspot',src:'./assets/office-world/hybrid/props/elevator-door.svg'},
  whiteboard:{name:'ไวต์บอร์ดทีม',group:'decor',width:16,src:'./assets/office-world/hybrid/props/whiteboard-v1.png'},
  printer:{name:'เครื่องพิมพ์และตู้เอกสาร',group:'decor',width:16,src:'./assets/office-world/hybrid/props/printer-v1.png'},
  desk:{name:'โต๊ะไม้โค้ง',group:'furniture',width:28,src:'./assets/office-world/hybrid/props/desk.png'},
  chair:{name:'เก้าอี้ Sage',group:'furniture',width:12,src:'./assets/office-world/hybrid/props/chair.png'},
  plant:{name:'ต้นไม้กระถาง',group:'decor',width:13,src:'./assets/studio-styles/soft3d/plant.png'},
  lift:{name:'ลิฟต์',group:'decor',width:25,src:'./assets/studio-styles/soft3d/lift.png'},
  duo:{name:'Zuri และวางใจ',group:'characters',width:20,src:'./assets/studio-styles/shared/duo.png'},
  ...Object.fromEntries(genericAvatarKinds.map((kind,i)=>[kind,{name:`Avatar กลาง ${String(i+1).padStart(2,'0')}`,group:'characters',width:14,renderType:'sprite',spriteAtlas:'./assets/office-world/hybrid/characters/avatar-atlas-12.png',spriteIndex:i,roleBound:false,src:`./assets/office-world/hybrid/characters/${kind}.svg`}])),
};
export const OFFICE_ARTS={'legacy-v4':{label:'ภาพเดิม v4',background:'./assets/office-world/hybrid/backgrounds/office-isometric-v4.png'},'perspective-v5':{label:'ภาพมุมกล้องใหม่ v5',background:'./assets/office-world/hybrid/backgrounds/office-isometric-v5.png','work-desk':'./assets/office-world/hybrid/props/work-desk-isometric-v2.png','task-chair':'./assets/office-world/hybrid/props/task-chair-isometric-v2.png'}};
export function officeArtSource(room,kind){const pack=OFFICE_ARTS[room?.officeArt]||OFFICE_ARTS['legacy-v4'];return kind?(room?.background==='office'&&pack[kind]||catalog[kind]?.src):room?.background==='office'?pack.background:backgrounds[room?.background]?.src;}
const has=(obj,key)=>Object.hasOwn(obj,key);
const finite=(n,a,b,f)=>Number.isFinite(n)?Math.max(a,Math.min(b,n)):f;
const text=(s,n,f='')=>typeof s==='string'?s.slice(0,n):f;
export const clone=value=>JSON.parse(JSON.stringify(value));
export function starterRoom(){
  return {schemaVersion:'office-room/v1',name:'มุมทำงานริมสวน',background:'garden',brief:'',
    objects:[
      {id:'lift-1',kind:'lift',x:78,y:44,scale:1,flip:false,locked:true},
      {id:'plant-1',kind:'plant',x:18,y:57,scale:1,flip:false,locked:false},
      {id:'chair-1',kind:'chair',x:53,y:65,scale:1,flip:false,locked:false},
      {id:'duo-1',kind:'duo',x:32,y:79,scale:1,flip:false,locked:false},
      {id:'desk-1',kind:'desk',x:56,y:83,scale:1,flip:false,locked:false},
      {id:'plant-2',kind:'plant',x:84,y:88,scale:.85,flip:false,locked:false},
    ]};
}
export function departmentStarterRoom(domain){
  const roles=Array.isArray(domain?.roles)?domain.roles:[],count=Math.min(12,roles.length);
  const number=Number.isInteger(domain?.number)?domain.number:1;
  const avatars=genericAvatarKinds;
  const columns=Math.min(4,Math.max(1,Math.ceil(Math.sqrt(count)))),rows=Math.max(1,Math.ceil(count/columns));
  const objects=[
    {id:'floor-lift',kind:'wayfinding-arrow',x:30,y:82,scale:1,flip:false,locked:false,interaction:{type:'elevator'}},
    {id:'floor-board',kind:'whiteboard',x:37,y:76,scale:.8,flip:false,locked:false,interaction:{type:'tasks'}},
    {id:'floor-sofa',kind:'team-sofa',x:20,y:59,scale:1,flip:false,locked:false},
    {id:'floor-water',kind:'water-cooler',x:28,y:61,scale:1,flip:false,locked:false},
  ];
  for(let i=0;i<count;i++){
    const row=Math.floor(i/columns),column=i%columns;
    const x=61+column*15/Math.max(1,columns-1)-row*12/Math.max(1,rows-1);
    const deskY=43+column*8/Math.max(1,columns-1)+row*8/Math.max(1,rows-1);
    const avatar=avatars[(number*3+i)%avatars.length];
    const avatarScale=rows>2?.7:.82,chairScale=rows>2?.6:.72,deskScale=rows>2?.6:.62;
    objects.push(
      {id:`role-${i+1}-avatar`,kind:avatar,x:x+3.2,y:deskY-2.5,scale:avatarScale,flip:false,locked:false},
      {id:`role-${i+1}-chair`,kind:'task-chair',x:x+3.2,y:deskY-2.5,scale:chairScale,flip:false,locked:false},
      {id:`role-${i+1}-desk`,kind:'work-desk',x,y:deskY,scale:deskScale,flip:false,locked:false},
    );
  }
  const label=typeof domain?.label==='string'&&domain.label.trim()?domain.label.trim():'ทีมสำนักงาน';
  return normalizeRoom({schemaVersion:'office-room/v1',name:`สำนักงานทีม ${label}`,
    background:'office',brief:'',objects});
}
export const defaultOfficeRoom=domain=>domain?.key==='projects'?rebuildOfficeFromSheet(departmentStarterRoom(domain)):departmentStarterRoom(domain);
export function normalizeRoom(value){
  const base=starterRoom();
  if(value?.schemaVersion!=='office-room/v1')return base;
  let blueprintPlan;
  if(value.background==='office'&&isOfficeBlueprint(value.blueprint)&&value.blueprintPlan?.base===value.blueprint){try{blueprintPlan=validateBlueprintPlan(value.blueprintPlan);}catch{/* Invalid local structural data does not make legacy room drafts unusable. */}}
  const sceneSheet=value.sceneSheet===SHEET_EDITION&&!!blueprintPlan&&value.background==='office';
  let skeletonAlignment;try{if(value.skeletonAlignment)skeletonAlignment=validateSkeletonAlignment(value.skeletonAlignment);}catch{/* Bad local calibration falls back to identity. */}
  const ids=new Set();
  const objects=(Array.isArray(value.objects)?value.objects:base.objects).slice(0,40).flatMap((o,i)=>{
    if(!o||!has(catalog,o.kind))return [];
    // Historical scene migration must not rewrite inventory during explicit geometry-only editing.
    if(value.background==='office'&&!blueprintPlan&&o.kind==='printer')return [];
    if(value.background==='office'&&!blueprintPlan&&['lift','elevator-door'].includes(o.kind))o={...o,kind:'wayfinding-arrow',x:30,y:82,scale:1,flip:false};
    let id=typeof o.id==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(o.id)?o.id:`object-${i}`;
    if(ids.has(id))id=`object-${i}-${ids.size}`;
    ids.add(id);
    return [{id,kind:o.kind,x:finite(o.x,8,92,50),y:finite(o.y,18,94,70),
      scale:finite(o.scale,.6,1.5,1),flip:o.flip===true,locked:o.locked===true,...(sceneSheet&&QUARTER_ANGLES.includes(o.rotation)&&ROTATABLE_KINDS.includes(o.kind)?{rotation:o.rotation}:{}),
      ...(validInteraction(o.interaction)?{interaction:clone(o.interaction)}:{}),
      ...(/^avatar-\d\d$/.test(o.kind)&&characterAppearance(o.appearance)?{appearance:o.appearance}:{}),
      ...(validEffects(o.effects)?{effects:clone(o.effects)}:{})}];
  });
  const skeletonParts=normalizedSkeletonParts(value.skeletonParts,objects);
  const navigation=normalizeOfficeNavigation(value.navigation,objects);
  return {schemaVersion:'office-room/v1',name:text(value.name,80,base.name),
    background:has(backgrounds,value.background)?value.background:'garden',brief:text(value.brief,4000),objects,
    ...(isOfficeBlueprint(value.blueprint)&&value.background==='office'?{blueprint:value.blueprint}:{}),...(blueprintPlan?{blueprintPlan}:{}),...(navigation?{navigation}:{}),...(skeletonAlignment?{skeletonAlignment}:{}),...(skeletonParts?{skeletonParts}:{}),...(has(OFFICE_ARTS,value.officeArt)?{officeArt:value.officeArt}:{}),...(sceneSheet?{sceneSheet:SHEET_EDITION}:{}),...(sceneSheet&&value.placementGrid?.cellSize===.5?{placementGrid:{cellSize:value.placementGrid.cellSize}}:{})};
}
export function parseRoomJSON(input){
  if(typeof input!=='string'||input.length>80000)throw Error('ไฟล์แบบใหญ่เกินไป (สูงสุด 80 KB)');
  let v;try{v=JSON.parse(input);}catch{throw Error('JSON ไม่ถูกต้อง กรุณาวางเฉพาะแบบห้อง');}
  if(v?.schemaVersion!=='office-room/v1'||!has(backgrounds,v.background)||!Array.isArray(v.objects)||v.objects.length>40)throw Error('ต้องเป็น office-room/v1 และมีของไม่เกิน 40 ชิ้น');
  if(typeof v.name!=='string'||v.name.length>80||typeof v.brief!=='string'||v.brief.length>4000)throw Error('ชื่อหรือคำอธิบายไม่ตรงรูปแบบ');
  const keys=['id','kind','x','y','scale','flip','locked','interaction','effects','rotation','appearance'],ids=new Set();
  if(Object.keys(v).some(k=>!['schemaVersion','name','background','brief','objects','navigation','blueprint','blueprintPlan','skeletonAlignment','skeletonParts','officeArt','sceneSheet','placementGrid'].includes(k)))throw Error('แบบห้องมีข้อมูลนอกขอบเขต ไม่รับ business, agent หรือ URL ภายนอก');
  if(has(v,'blueprint')&&(!isOfficeBlueprint(v.blueprint)||v.background!=='office'))throw Error('Blueprint ต้องเป็น small, medium หรือ large ในฉาก Office');
  if(has(v,'blueprintPlan')){validateBlueprintPlan(v.blueprintPlan);if(v.blueprintPlan.base!==v.blueprint||v.background!=='office')throw Error('แปลนที่แก้ไขต้องมีแม่แบบ Office ตรงกัน');}
  for(const o of v.objects){
    if(!o||Object.keys(o).some(k=>!keys.includes(k))||!has(catalog,o.kind)||
      typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,60}$/.test(o.id)||ids.has(o.id)||
      !Number.isFinite(o.x)||o.x<8||o.x>92||!Number.isFinite(o.y)||o.y<18||o.y>94||
      !Number.isFinite(o.scale)||o.scale<.6||o.scale>1.5||typeof o.flip!=='boolean'||typeof o.locked!=='boolean')
      throw Error('ชิ้นงานไม่ถูกต้อง: ตรวจ id, ชนิด, ตำแหน่ง, ขนาด และสถานะล็อก');
    if(has(o,'rotation')&&(v.sceneSheet!==SHEET_EDITION||!QUARTER_ANGLES.includes(o.rotation)||!ROTATABLE_KINDS.includes(o.kind)))throw Error('มุมหมุนใช้ได้เฉพาะเฟอร์นิเจอร์ Scene Sheet: 0/90/180/270');
    ids.add(o.id);
    if(has(o,'appearance')&&(!/^avatar-\d\d$/.test(o.kind)||!characterAppearance(o.appearance)))throw Error('เลือกตัวละครชั่วคราวจากคลังเท่านั้น · ใช้กับช่องตัวละครเดิม');
    if(has(o,'interaction')&&!validInteraction(o.interaction))throw Error('Interaction ไม่ถูกต้อง ใช้ popup, elevator หรือชั้นที่มีในสำนักงานจำลอง');
    if(has(o,'effects')&&!validEffects(o.effects))throw Error('Effect ไม่ถูกต้อง ตรวจ opacity, shadow, glow และ hover');
  }
  if(has(v,'placementGrid')){validatePlacementGrid(v.placementGrid);if(v.sceneSheet!==SHEET_EDITION)throw Error('Placement grid requires Scene Sheet');}
  if(has(v,'sceneSheet')&&(v.sceneSheet!==SHEET_EDITION||!v.blueprintPlan||v.background!=='office'))throw Error('Scene Sheet requires the measured Office plan');
  if(has(v,'sceneSheet')&&(v.officeArt||v.skeletonParts?.length||v.skeletonAlignment))throw Error('Unified sheets cannot carry independent image-matching offsets');
  if(has(v,'officeArt')&&!has(OFFICE_ARTS,v.officeArt))throw Error('Unknown Office art edition');
  if(has(v,'skeletonParts'))validateSkeletonParts(v.skeletonParts,v.objects);
  if(has(v,'skeletonAlignment'))validateSkeletonAlignment(v.skeletonAlignment);
  if(has(v,'navigation'))validateOfficeNavigation(v.navigation,v.objects);
  return normalizeRoom(v);
}
export function floorFile(floor,room){
  if(!floorKeys.includes(floor))throw Error('ไม่พบชั้นนี้');
  if(floor==='lobby'&&room?.blueprint)throw Error('Lobby ใช้ฉากเดิม · แม่แบบ Office ใช้กับชั้นแผนก');
  if(room?.schemaVersion==='office-3d/v1'){
    if(!nativeFloors.includes(floor))throw Error('ชั้นนี้ไม่มีฉาก 3D เดิม');
    return {schemaVersion:'office-floor/v1',scope:'local-preview',floor,edition:'native3d',room:validateNativeRoom(room)};
  }
  return {schemaVersion:'office-floor/v1',scope:'local-preview',floor,edition:room?'hybrid':'original',room:room?parseRoomJSON(JSON.stringify(room)):null};
}
export function parseFloorJSON(input){
  if(typeof input!=='string'||input.length>2500000)throw Error('ไฟล์ชั้นใหญ่เกินไป (สูงสุด 2.5 MB)');
  let v;try{v=JSON.parse(input);}catch{throw Error('ไฟล์ JSON ไม่ถูกต้อง');}
  if(!v||Object.keys(v).some(k=>!['schemaVersion','scope','floor','edition','room'].includes(k))||v.schemaVersion!=='office-floor/v1'||v.scope!=='local-preview'||!floorKeys.includes(v.floor)||!['hybrid','original','native3d'].includes(v.edition)||(v.edition==='original'&&v.room!==null)||(v.edition==='hybrid'&&!v.room))throw Error('ต้องเป็นไฟล์ office-floor/v1 ของชั้นจำลอง');
  if(v.edition==='native3d')return floorFile(v.floor,validateNativeRoom(v.room));
  return floorFile(v.floor,v.edition==='hybrid'?parseRoomJSON(JSON.stringify(v.room)):null);
}
export function roomDiff(before,after){
  const a=new Map(before.objects.map(o=>[o.id,o])),b=new Map(after.objects.map(o=>[o.id,o]));
  return {added:[...b.keys()].filter(k=>!a.has(k)).length,removed:[...a.keys()].filter(k=>!b.has(k)).length,
    changed:[...b.keys()].filter(k=>a.has(k)&&JSON.stringify(a.get(k))!==JSON.stringify(b.get(k))).length,
    background:before.background!==after.background,name:before.name!==after.name,brief:before.brief!==after.brief,
    skeletonParts:JSON.stringify(before.skeletonParts??null)!==JSON.stringify(after.skeletonParts??null),officeArt:before.officeArt!==after.officeArt,skeletonAlignment:JSON.stringify(before.skeletonAlignment??null)!==JSON.stringify(after.skeletonAlignment??null),blueprint:before.blueprint!==after.blueprint||JSON.stringify(before.blueprintPlan)!==JSON.stringify(after.blueprintPlan),navigation:JSON.stringify(before.navigation??null)!==JSON.stringify(after.navigation??null)};
}
const validationCache=new Map();
let validationCacheChars=0;
function cacheValidation(key,value){
  if(key.length>1_000_000)return;
  while(validationCache.size>=32||validationCacheChars+key.length>2_000_000){const oldest=validationCache.keys().next().value;if(oldest===undefined)break;validationCacheChars-=oldest.length;validationCache.delete(oldest);}
  validationCache.set(key,value);validationCacheChars+=key.length;
}
function cachedValidation(kind,value,validate){
  const key=`${kind}:${JSON.stringify(value)}`;
  if(validationCache.has(key)){const cached=validationCache.get(key);validationCache.delete(key);validationCache.set(key,cached);if(cached.error)throw Error(cached.error);return clone(cached.value);}
  try{const result=validate(key.slice(kind.length+1));cacheValidation(key,{value:result});return clone(result);}
  catch(error){cacheValidation(key,{error:error.message});throw error;}
}
const strictRoom=value=>cachedValidation('room',value,parseRoomJSON);
const strictNative=value=>cachedValidation('native',value,source=>validateNativeRoom(JSON.parse(source)));
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const sameValue=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const emptyRoomStore=()=>({version:1,designs:[],floors:{},nativeFloors:{},editions:{}});
function renderableRoom(value){return record(value)&&value.schemaVersion==='office-room/v1'&&Array.isArray(value.objects);}
function renderableDesign(value){return record(value)&&typeof value.id==='string'&&/^[a-zA-Z0-9_-]+$/.test(value.id)&&renderableRoom(value.room);}
function validRoomDesign(value){try{return record(value)&&typeof value.id==='string'&&/^[a-zA-Z0-9_-]+$/.test(value.id)&&!!strictRoom(value.room);}catch{return false;}}
function validHybridEnvelope(raw){return record(raw)&&raw.version===1&&Object.keys(raw).every(k=>['version','designs','floors','nativeFloors','editions'].includes(k))&&
  (raw.designs===undefined||Array.isArray(raw.designs))&&
  ['floors','nativeFloors','editions'].every(k=>raw[k]===undefined||record(raw[k]));}
function hasDuplicateSectionKeys(rootText,raw){
  const rootEntries=rawObjectEntries(rootText);
  for(const section of ['floors','nativeFloors','editions']){
    if(!Object.hasOwn(raw,section))continue;
    const source=rootEntries.find(item=>item.key===section)?.raw;
    if(!source)continue;
    const keys=rawObjectEntries(source).map(item=>item.key);
    if(new Set(keys).size!==keys.length)return true;
  }
  return false;
}
function strictRoomForWrite(value){
  const serialized=JSON.stringify(value);
  if(typeof serialized==='string'&&serialized.length>80000)throw Error('ไฟล์แบบใหญ่เกินไป (สูงสุด 80 KB)');
  try{strictRoom(value);}catch(error){
    // A stale Scene Sheet marker can leave rotation/grid fields in a history room
    // after its invalid plan was normalized away. Other strict failures stay errors.
    if(error.message!=='Scene Sheet requires the measured Office plan')throw error;
  }
  return strictRoom(normalizeRoom(value));
}
function validHybridRecord(section,key,value,all){
  if(section==='designs'){
    const matches=(all.designs||[]).map((item,index)=>({item,index})).filter(({item})=>item?.id===key);
    return matches.length===1&&(validRoomDesign(matches[0].item)||renderableDesign(matches[0].item));
  }
  if(section==='floors'){try{return /^preview:[a-z0-9-]+$/.test(key)&&(renderableRoom(value)||!!strictRoom(value));}catch{return false;}}
  if(section==='nativeFloors'){try{return nativeFloors.some(f=>key===`preview:${f}`)&&!!strictNative(value);}catch{return false;}}
  if(section==='editions')return floorKeys.some(f=>key===`preview:${f}`)&&['native3d','original','hybrid'].includes(value);
  return false;
}
function rawSection(rootText,name){return rawObjectEntries(rootText).find(item=>item.key===name)?.raw||({designs:'[]',floors:'{}',nativeFloors:'{}',editions:'{}'}[name]);}
function labelForRecord(section,key){return section==='designs'?`แบบในคลัง ${key}`:`ชั้น ${String(key).replace(/^preview:/,'')}`;}

export class RoomStore{
  constructor(storage){
    this.storage=storage;this.data=emptyRoomStore();this.writeBlocked=false;this.envelopeUnreadable=false;this.rawText=null;this.raw=null;this.lastWriteError=null;
    let parsed=false;
    try{
      if(!storage)throw Error('storage unavailable');
      this.rawText=storage.getItem(HYBRID_KEY)??null;
      if(this.rawText!==null){
        this.raw=JSON.parse(this.rawText);
        parsed=true;
        const top=rawObjectEntries(this.rawText),keys=top.map(item=>item.key);
        if(new Set(keys).size!==keys.length||!validHybridEnvelope(this.raw)||hasDuplicateSectionKeys(this.rawText,this.raw))throw Error('invalid storage envelope');
      }
    }catch(error){
      this.writeBlocked=this.envelopeUnreadable=true;
      this.lastWriteError={kind:'envelope',reason:error.message,recoverable:!parsed&&typeof this.rawText==='string',backupOnly:parsed&&typeof this.rawText==='string',storageKey:HYBRID_KEY,rawText:this.rawText,label:'คลังแบบ'};
    }
    if(!this.writeBlocked&&this.raw){
      const designs=Array.isArray(this.raw.designs)?this.raw.designs:[],counts=new Map();
      for(const item of designs)if(typeof item?.id==='string')counts.set(item.id,(counts.get(item.id)||0)+1);
      for(const item of designs){try{if(counts.get(item?.id)===1&&renderableDesign(item))this.data.designs.push({id:item.id,room:normalizeRoom(item.room)});}catch{/* Keep an unreadable library entry out of the executable view. */}}
      for(const [key,room] of Object.entries(this.raw.floors||{}))try{if(/^preview:[a-z0-9-]+$/.test(key)&&renderableRoom(room))this.data.floors[key]=normalizeRoom(room);}catch{/* Keep an unreadable floor out of the executable view. */}
      for(const [key,room] of Object.entries(this.raw.nativeFloors||{}))try{if(nativeFloors.some(f=>key===`preview:${f}`))this.data.nativeFloors[key]=strictNative(room);}catch{/* Keep an unreadable Native floor out of the executable view. */}
      for(const [key,edition] of Object.entries(this.raw.editions||{}))if(floorKeys.some(f=>key===`preview:${f}`)&&['native3d','original','hybrid'].includes(edition))this.data.editions[key]=edition;
    }
  }
  issueFor(section,key){
    if(this.writeBlocked)return this.lastWriteError;
    const values=this.raw?.[section];
    if(section==='designs'){
      const matches=(Array.isArray(values)?values:[]).map((item,index)=>({item,index})).filter(({item})=>item?.id===key);
      if(!matches.length||matches.length===1&&(validRoomDesign(matches[0].item)||renderableDesign(matches[0].item)))return null;
      const unreadable=matches.find(({item})=>!renderableDesign(item));
      if(!unreadable)return {kind:'record',recoverable:false,backupOnly:true,storageKey:HYBRID_KEY,rawText:this.rawText,section,key,label:labelForRecord(section,key)};
      return {kind:'record',recoverable:true,storageKey:HYBRID_KEY,rawText:this.rawText,section,key,index:unreadable.index,label:labelForRecord(section,key)};
    }
    if(!Object.hasOwn(values||{},key)||validHybridRecord(section,key,values[key],this.raw))return null;
    return {kind:'record',recoverable:true,storageKey:HYBRID_KEY,rawText:this.rawText,section,key,label:labelForRecord(section,key)};
  }
  refuse(issue){this.lastWriteError=issue;return false;}
  write(next,targets=[]){
    if(this.writeBlocked)return this.refuse(this.lastWriteError||{kind:'envelope',recoverable:false});
    for(const [section,key] of targets){const issue=this.issueFor(section,key);if(issue)return this.refuse(issue);}
    try{
      const same=sameValue,rootText=this.rawText===null?JSON.stringify(emptyRoomStore()):this.rawText;
      const rootChanges=new Map(),previous=new Map(this.data.designs.map(d=>[d.id,d])),after=new Map(next.designs.map(d=>[d.id,d]));
      if(!sameValue(this.data.designs,next.designs)){
        const source=rawSection(rootText,'designs'),items=rawArrayItems(source),replacements=new Map(),deletions=new Set(),matched=new Set();
        for(let index=0;index<items.length;index++){
          const id=items[index].value?.id;
          if(!previous.has(id))continue;
          matched.add(id);
          if(!after.has(id))deletions.add(index);
          else if(!same(previous.get(id),after.get(id)))replacements.set(index,JSON.stringify(after.get(id)));
        }
        const appended=next.designs.filter(d=>!matched.has(d.id)).map(d=>JSON.stringify(d));
        rootChanges.set('designs',mergeRawJsonArray(source,replacements,deletions,appended));
      }
      for(const name of ['floors','nativeFloors','editions']){
        const before=this.data[name],updated=next[name],replacements=new Map(),deletions=new Set();
        for(const key of new Set([...Object.keys(before),...Object.keys(updated)]))if(!same(before[key],updated[key])){
          if(Object.hasOwn(updated,key))replacements.set(key,JSON.stringify(updated[key]));else deletions.add(key);
        }
        if(replacements.size||deletions.size)rootChanges.set(name,mergeRawJsonObject(rawSection(rootText,name),replacements,deletions));
      }
      const serialized=rootChanges.size?mergeRawJsonObject(rootText,rootChanges):rootText;
      this.storage.setItem(HYBRID_KEY,serialized);this.rawText=serialized;this.raw=JSON.parse(serialized);this.data=next;this.lastWriteError=null;return true;
    }catch(error){return this.refuse({kind:'storage',reason:error.message,recoverable:false});}
  }
  save(id,room){
    let clean;try{if(typeof id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('รหัสแบบไม่ถูกต้อง');clean=strictRoomForWrite(room);}catch(error){return this.refuse({kind:'invalid',reason:error.message,recoverable:false});}
    const issue=this.issueFor('designs',id);if(issue)return this.refuse(issue);
    const next=clone(this.data),found=next.designs.find(d=>d.id===id);
    if(found)found.room=clean;
    else {if((this.raw?.designs?.length||0)>=20)return this.refuse({kind:'limit',recoverable:false});next.designs.push({id,room:clean});}
    return this.write(next,[['designs',id]]);
  }
  apply(key,room){
    let clean;try{if(!/^preview:[a-z0-9-]+$/.test(key)||key==='preview:lobby'&&room?.blueprint)throw Error('ชั้นหรือแปลนไม่ถูกต้อง');clean=strictRoomForWrite(room);}catch(error){return this.refuse({kind:'invalid',reason:error.message,recoverable:false});}
    const next=clone(this.data);next.floors[key]=clean;next.editions[key]='hybrid';return this.write(next,[['floors',key],['editions',key]]);
  }
  unapply(key){
    if(!/^preview:[a-z0-9-]+$/.test(key))return this.refuse({kind:'invalid',recoverable:false});
    const next=clone(this.data);delete next.floors[key];next.editions[key]='original';return this.write(next,[['floors',key],['editions',key]]);
  }
  floor(key){const k=`preview:${key}`;return ['native3d','original'].includes(this.data.editions[k])?null:this.data.floors[k]||null;}
  nativeFloor(key){return this.data.editions[`preview:${key}`]==='native3d'?this.data.nativeFloors[`preview:${key}`]||null:null;}
  nativeSaved(key){return this.data.nativeFloors[`preview:${key}`]||null;}
  edition(key){return this.nativeFloor(key)?'native3d':this.floor(key)?'hybrid':'original';}
  applyNative(key,room){
    if(!nativeFloors.includes(key))return this.refuse({kind:'invalid',recoverable:false});
    let clean;try{clean=strictNative(room);}catch(error){return this.refuse({kind:'invalid',reason:error.message,recoverable:false});}
    const id=`preview:${key}`,next=clone(this.data);next.nativeFloors[id]=clean;next.editions[id]='native3d';return this.write(next,[['nativeFloors',id],['editions',id]]);
  }
  floorRevision(key){return JSON.stringify({edition:this.edition(key),room:this.nativeFloor(key)||this.floor(key)});}
  discardUnreadable(issue=this.lastWriteError){
    if(!issue?.recoverable||issue.storageKey!==HYBRID_KEY||typeof issue.rawText!=='string'||this.storage.getItem(HYBRID_KEY)!==issue.rawText)return false;
    if(issue.kind==='envelope'){
      try{JSON.parse(issue.rawText);return false;}catch{/* Whole-key removal is reserved for invalid JSON. */}
      if(this.storage.removeItem)this.storage.removeItem(HYBRID_KEY);else this.storage.setItem(HYBRID_KEY,JSON.stringify(emptyRoomStore()));
      return true;
    }
    const raw=JSON.parse(issue.rawText);if(!validHybridEnvelope(raw))return false;
    if(issue.section==='designs'){
      const items=rawArrayItems(rawSection(issue.rawText,'designs'));
      const candidate=items[issue.index]?.value;
      if(issue.index<0||issue.index>=items.length||candidate?.id!==issue.key||renderableDesign(candidate))return false;
      const text=mergeRawJsonArray(rawSection(issue.rawText,'designs'),new Map(),new Set([issue.index]));
      this.storage.setItem(HYBRID_KEY,mergeRawJsonObject(issue.rawText,new Map([['designs',text]])));
      return true;
    }
    if(!Object.hasOwn(raw[issue.section]||{},issue.key)||validHybridRecord(issue.section,issue.key,raw[issue.section][issue.key],raw))return false;
    const sectionText=mergeRawJsonObject(rawSection(issue.rawText,issue.section),new Map(),new Set([issue.key]));
    this.storage.setItem(HYBRID_KEY,mergeRawJsonObject(issue.rawText,new Map([[issue.section,sectionText]])));
    return true;
  }
}
export class RoomHistory{
  constructor(room=starterRoom()){this.saved=normalizeRoom(room);this.current=clone(this.saved);this.past=[];this.future=[];}
  get dirty(){return JSON.stringify(this.saved)!==JSON.stringify(this.current);}
  change(room){const next=normalizeRoom(room);if(JSON.stringify(next)===JSON.stringify(this.current))return;this.past.push(clone(this.current));this.past=this.past.slice(-60);this.future=[];this.current=next;}
  undo(){if(this.past.length){this.future.push(this.current);this.current=this.past.pop();}}
  redo(){if(this.future.length){this.past.push(this.current);this.current=this.future.pop();}}
  savedNow(){this.saved=clone(this.current);}
}
