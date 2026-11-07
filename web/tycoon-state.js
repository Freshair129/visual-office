import {validateCustomAsset} from './custom-assets.js';
// @spec Office Tycoon design v0.2 §9.1 — local presentation, never business authority.
import {validateBlueprintPlan} from './office-blueprint-state.js';
import {validateOfficeNavigation} from './office-nav-state.js';
import {validateFinish} from './room-surfaces.js';
import {createTycoonFloorPlan} from './tycoon-floor-plans.js';
import {OFFICE_FLOOR_KEYS} from './office-floor-registry.js';
import {TYCOON_BLUEPRINT_OPTIONS,TYCOON_COORDINATE_BOUNDS} from './office-design-limits.js';
import {rawObjectEntries,mergeRawJsonObject} from './raw-json-merge.js';
export const TYCOON_KEY='zuri-office:tycoon-studio:v1';
export const TYCOON_KINDS=Object.freeze(['plaza','facade','roof','floor','wall','window','door-frame','door','glass','column','skirting','reception','lift','kiosk','board','desk','chair','meeting','sofa','coffee-table','coffee','cabinet','plant','actor','custom']);
const floors=OFFICE_FLOOR_KEYS,intents=['none','enter','projects','floors','connect','work','agent','marketing-ask','meeting','artifacts','decor'];
const clone=v=>JSON.parse(JSON.stringify(v));
const validFloor=f=>{if(!floors.includes(f))throw Error('ชั้นนี้ยังไม่มีฉาก Tycoon');return f;};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error('ข้อมูลฉากไม่ถูกต้อง');};
const number=(v,min,max)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error('ขนาดหรือตำแหน่งไม่ถูกต้อง');return v;};
export function createTycoonRoom(floor){
  validFloor(floor);
  const plan=createTycoonFloorPlan(floor);
  return {schemaVersion:'office-tycoon/v1',width:plan.width,depth:plan.depth,objects:plan.objects,blueprintPlan:plan.blueprintPlan};
}
export function validateTycoonRoom(value){
  exact(value,['schemaVersion','width','depth','objects','blueprintPlan','navigation','layers','finishes']);
  if(new TextEncoder().encode(JSON.stringify(value)).byteLength>2000000)throw Error('แบบชั้นรวม texture ต้องไม่เกิน 2 MB');
  if(value.schemaVersion!=='office-tycoon/v1'||!Array.isArray(value.objects)||value.objects.length>80)throw Error('รูปแบบห้องไม่รองรับ');
  number(value.width,6,24);number(value.depth,6,20);const ids=new Set();
  for(const o of value.objects){
    exact(o,['id','kind','x','y','z','rotation','scale','intent','color','groupId','finish','asset']);
    if(o.kind==='custom'){validateCustomAsset(o.asset);if(o.intent!=='decor')throw Error('Custom props cannot bind business actions');}else if(o.asset!==undefined)throw Error('Only custom props carry assets');
    if(o.groupId!==undefined&&(typeof o.groupId!=='string'||!/^group-[a-z0-9-]{1,48}$/.test(o.groupId)))throw Error('กลุ่มไม่ถูกต้อง');
    if(o.finish!==undefined)validateFinish(o.finish);
    if(typeof o.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(o.id)||ids.has(o.id)||!TYCOON_KINDS.includes(o.kind)||o.kind==='actor'||o.intent==='agent'||!intents.includes(o.intent))throw Error('วัตถุในฉากไม่ถูกต้อง');
    // Structure edits preserve furniture positions; an out-of-room prop remains editable,
    // while navigation rejects its location. Never silently delete or clamp that inventory.
    ids.add(o.id);number(o.x,-24,24);number(o.z,-24,24);
    number(o.y,0,4);number(o.rotation,-Math.PI*2,Math.PI*2);number(o.scale,.25,3);
    if(o.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(o.color))throw Error('สีไม่ถูกต้อง');
  }
  const groups=new Map();for(const o of value.objects)if(o.groupId)groups.set(o.groupId,(groups.get(o.groupId)||0)+1);
  if([...groups.values()].some(n=>n<2))throw Error('กลุ่มต้องมีอย่างน้อย 2 ชิ้น');
  if(value.layers!==undefined&&(!Array.isArray(value.layers)||value.layers.length!==ids.size||new Set(value.layers).size!==ids.size||value.layers.some(id=>!ids.has(id))))throw Error('Layer ต้องอ้างถึงแต่ละวัตถุครบและไม่ซ้ำ');
  if(value.finishes!==undefined){exact(value.finishes,['floor','walls']);for(const finish of Object.values(value.finishes))validateFinish(finish);}
  if(value.blueprintPlan!==undefined){const p=validateBlueprintPlan(value.blueprintPlan,TYCOON_BLUEPRINT_OPTIONS);if(p.width!==value.width||p.depth!==value.depth)throw Error('ขนาดห้องกับแปลนต้องตรงกัน');}
  if(value.navigation!==undefined)validateOfficeNavigation(value.navigation,value.objects.map(o=>({...o,kind:o.kind==='custom'?(o.asset.interaction.mode==='seat'?'team-sofa':o.asset.interaction.mode==='stand'?'water-cooler':'custom'):({sofa:'team-sofa',coffee:'water-cooler'})[o.kind]||o.kind})),{coordinateBounds:TYCOON_COORDINATE_BOUNDS});
  return clone(value);
}
export function tycoonFloorFile(floor,room){return {schemaVersion:'office-floor/v2',scope:'local-preview',floor:validFloor(floor),edition:'tycoon3d',room:validateTycoonRoom(room)};}
export function parseTycoonFloorJSON(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>2500000)throw Error('ไฟล์ใหญ่เกิน 2.5 MB');
  const v=JSON.parse(text);exact(v,['schemaVersion','scope','floor','edition','room']);
  if(v.schemaVersion!=='office-floor/v2'||v.scope!=='local-preview'||v.edition!=='tycoon3d')throw Error('ต้องเป็นไฟล์ Tycoon v2');
  return tycoonFloorFile(v.floor,v.room);
}
export class TycoonStore{
  constructor(storage,{locks=globalThis.navigator?.locks}={}){this.storage=storage;this.locks=locks;this.lastWriteError=null;}
  async mutate(write){
    // One blob contains every floor. All writers, including edition selection,
    // share an origin-scoped lock so read/check/write is atomic across tabs.
    if(!this.locks?.request)return {ok:false,reason:'locking-unavailable'};
    try{return await this.locks.request(TYCOON_KEY,{mode:'exclusive',signal:AbortSignal.timeout(5000)},write);}
    catch{return {ok:false,reason:'busy'};}
  }
  envelope(){
    let rawText;
    try{if(!this.storage)throw Error('storage unavailable');rawText=this.storage.getItem(TYCOON_KEY);}
    catch(error){this.lastWriteError={kind:'envelope',reason:error.message,recoverable:false,storageKey:TYCOON_KEY,label:'คลังฉาก Tycoon'};throw error;}
    if(rawText==null)return {rawText:null,value:{version:1,floors:{}}};
    let parsed=false;
    try{
      const value=JSON.parse(rawText);parsed=true;
      const entries=rawObjectEntries(rawText),keys=entries.map(item=>item.key);
      exact(value,['version','floors']);
      const floorKeys=rawObjectEntries(entries.find(item=>item.key==='floors')?.raw||'{}').map(item=>item.key);
      if(value.version!==1||!value.floors||typeof value.floors!=='object'||Array.isArray(value.floors)||new Set(keys).size!==keys.length||
        new Set(floorKeys).size!==floorKeys.length||floorKeys.length!==Object.keys(value.floors).length)throw Error('invalid storage envelope');
      return {rawText,value};
    }catch(error){
      this.lastWriteError={kind:'envelope',reason:error.message,recoverable:!parsed&&typeof rawText==='string',backupOnly:parsed&&typeof rawText==='string',storageKey:TYCOON_KEY,rawText,label:'คลังฉาก Tycoon'};throw error;
    }
  }
  read(){try{return this.envelope().value;}catch{return {version:1,floors:{}};}}
  validSavedFloor(floor,saved){
    validFloor(floor);exact(saved,['revision','edition','room']);
    if(!Number.isSafeInteger(saved.revision)||saved.revision<1||saved.edition!==undefined&&!['legacy','tycoon3d'].includes(saved.edition))throw Error('invalid saved floor');
    return {revision:saved.revision,edition:saved.edition==='legacy'?'legacy':'tycoon3d',room:validateTycoonRoom(saved.room)};
  }
  readForWrite(floor){
    this.lastWriteError=null;
    const envelope=this.envelope(),saved=floor&&envelope.value.floors[floor];
    if(floor&&Object.hasOwn(envelope.value.floors,floor))try{this.validSavedFloor(floor,saved);}
      catch(error){this.lastWriteError={kind:'record',reason:error.message,recoverable:true,storageKey:TYCOON_KEY,rawText:envelope.rawText,section:'floors',key:floor,label:`ชั้น ${floor}`};throw error;}
    return envelope;
  }
  get(floor){
    validFloor(floor);
    try{const {value,rawText}=this.envelope(),saved=value.floors[floor];this.lastWriteError=null;
      if(!Object.hasOwn(value.floors,floor))return null;
      try{return this.validSavedFloor(floor,saved);}
      catch(error){this.lastWriteError={kind:'record',reason:error.message,recoverable:true,storageKey:TYCOON_KEY,rawText,section:'floors',key:floor,label:`ชั้น ${floor}`};return null;}
    }catch{return null;}
  }
  async snapshotForExport(){
    const read=()=>{
      if(!this.storage)throw Error('อ่านพื้นที่จัดเก็บฉากไม่ได้');
      const stored=this.storage.getItem(TYCOON_KEY),raw=stored==null?null:stored;
      if(raw!==null&&(typeof raw!=='string'||raw.length>30_000_000))throw Error('ข้อมูลฉากที่บันทึกไว้ใหญ่เกินขอบเขต');
      let snapshot;try{snapshot=raw===null?{version:1,floors:{}}:JSON.parse(raw);}catch{throw Error('ข้อมูลฉากที่บันทึกไว้เสียหาย · หยุดส่งออกเพื่อรักษาข้อมูลเดิม');}
      exact(snapshot,['version','floors']);
      if(snapshot.version!==1||!snapshot.floors||typeof snapshot.floors!=='object'||Array.isArray(snapshot.floors)||Object.keys(snapshot.floors).some(key=>!floors.includes(key)))throw Error('รูปแบบฉากที่บันทึกไว้ไม่รองรับ · ไม่แทนด้วยฉากตั้งต้น');
      const rooms={},revisions={};
      for(const floor of floors){
        if(!Object.hasOwn(snapshot.floors,floor)){rooms[floor]=createTycoonRoom(floor);revisions[floor]=0;continue;}
        const saved=snapshot.floors[floor];exact(saved,['revision','edition','room']);
        if(!Number.isSafeInteger(saved.revision)||saved.revision<1||saved.edition!==undefined&&!['legacy','tycoon3d'].includes(saved.edition))throw Error('ฉากที่บันทึกไว้ไม่ถูกต้อง: '+floor);
        try{rooms[floor]=validateTycoonRoom(saved.room);}catch{throw Error('ฉากที่บันทึกไว้ไม่ถูกต้อง: '+floor+' · ไม่แทนด้วยฉากตั้งต้น');}
        revisions[floor]=saved.revision;
      }
      return {rooms,revisions};
    };
    // A single storage value is an atomic multi-floor snapshot. Cooperate with
    // writers' lock where available; never re-read individual floors afterward.
    return this.locks?.request?this.locks.request(TYCOON_KEY,{mode:'shared',signal:AbortSignal.timeout(5000)},read):read();
  }
  async save(floor,room,expectedRevision=0){
    validFloor(floor);const clean=validateTycoonRoom(room);
    this.lastWriteError=null;
    return this.mutate(()=>{try{const current=this.readForWrite(floor),next=current.value,before=next.floors[floor];
    if((before?.revision||0)!==expectedRevision)return {ok:false,reason:'conflict'};
    next.floors[floor]={revision:expectedRevision+1,edition:'tycoon3d',room:clean};
    const floorsSource=current.rawText===null?'{}':rawObjectEntries(current.rawText).find(item=>item.key==='floors')?.raw||'{}';
    const floorsRaw=mergeRawJsonObject(floorsSource,new Map([[floor,JSON.stringify(next.floors[floor])]]));
    const rootSource=current.rawText===null?JSON.stringify({version:1,floors:{}}):current.rawText;
    const serialized=mergeRawJsonObject(rootSource,new Map([['floors',floorsRaw]]));
    this.storage.setItem(TYCOON_KEY,serialized);this.lastWriteError=null;return {ok:true,revision:expectedRevision+1};}catch(error){
      if(!this.lastWriteError)this.lastWriteError={kind:'storage',reason:error.message,recoverable:false};return {ok:false,reason:'storage'};}
    });
  }
  async select(floor,edition){
    validFloor(floor);if(!['legacy','tycoon3d'].includes(edition))throw Error('Edition ไม่ถูกต้อง');
    this.lastWriteError=null;
    const result=await this.mutate(()=>{try{const current=this.readForWrite(floor),next=current.value,old=next.floors[floor];next.floors[floor]={room:old?.room||createTycoonRoom(floor),revision:(old?.revision||0)+1,edition};
    const floorsSource=current.rawText===null?'{}':rawObjectEntries(current.rawText).find(item=>item.key==='floors')?.raw||'{}';
    const floorsRaw=mergeRawJsonObject(floorsSource,new Map([[floor,JSON.stringify(next.floors[floor])]]));
    const rootSource=current.rawText===null?JSON.stringify({version:1,floors:{}}):current.rawText;
    this.storage.setItem(TYCOON_KEY,mergeRawJsonObject(rootSource,new Map([['floors',floorsRaw]])));this.lastWriteError=null;return {ok:true};}catch(error){
      if(!this.lastWriteError)this.lastWriteError={kind:'storage',reason:error.message,recoverable:false};return {ok:false,reason:'storage'};}});return result.ok;
  }
  async discardUnreadable(issue=this.lastWriteError){
    const result=await this.mutate(()=>{
      if(!issue?.recoverable||issue.backupOnly||issue.storageKey!==TYCOON_KEY||typeof issue.rawText!=='string'||this.storage.getItem(TYCOON_KEY)!==issue.rawText)return false;
      if(issue.kind==='envelope'){
        try{JSON.parse(issue.rawText);return false;}catch{/* Whole-key removal is reserved for invalid JSON. */}
        if(this.storage.removeItem)this.storage.removeItem(TYCOON_KEY);else this.storage.setItem(TYCOON_KEY,JSON.stringify({version:1,floors:{}}));
        return true;
      }
      const current=this.envelope(),saved=current.value.floors[issue.key];
      if(!Object.hasOwn(current.value.floors,issue.key))return false;
      try{this.validSavedFloor(issue.key,saved);return false;}catch{/* Only the targeted invalid record may be removed. */}
      const floorsSource=rawObjectEntries(issue.rawText).find(item=>item.key==='floors')?.raw||'{}';
      const floorsRaw=mergeRawJsonObject(floorsSource,new Map(),new Set([issue.key]));
      this.storage.setItem(TYCOON_KEY,mergeRawJsonObject(issue.rawText,new Map([['floors',floorsRaw]])));
      return true;
    });
    return result===true;
  }
}
