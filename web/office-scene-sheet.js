import {defaultBlueprintPlan,validateBlueprintPlan} from './office-blueprint-state.js';
import {blueprintLayout,blueprintPoint} from './office-blueprints.js';
import {groundToWorld} from './office-projection.js';
export const SHEET_EDITION='office-sheet/v1';
// Template metadata only. Persisted rooms keep their own transforms until applied.
export const OFFICE_SHEET_TEMPLATE={id:'paired-work-and-lounge-2026-10-25',label:'โต๊ะทำงานคู่ · มุมพัก · พื้นที่คุยหน้าบอร์ด',width:12,depth:8};
export const isOfficeSheet=room=>room?.sceneSheet===SHEET_EDITION&&room.background==='office'&&!!room.blueprintPlan;
export function sheetYaw(o){return (o.kind==='team-sofa'?-Math.PI/2:0)+(o.flip?Math.PI:0)+(o.rotation||0)*Math.PI/180;}
export function rebuildOfficeFromSheet(source){
 const next=JSON.parse(JSON.stringify(source)),desks=next.objects.filter(o=>o.kind==='work-desk'),chairs=next.objects.filter(o=>o.kind==='task-chair'),avatars=next.objects.filter(o=>/^avatar-\d\d$/.test(o.kind));
 const supported=new Set(['work-desk','task-chair','team-sofa','water-cooler','whiteboard','wayfinding-arrow','plant']);
 if(!desks.length||desks.length>4||chairs.length!==desks.length||avatars.length>desks.length||next.objects.some(o=>!supported.has(o.kind)&&!/^avatar-\d\d$/.test(o.kind))||['team-sofa','water-cooler','whiteboard','wayfinding-arrow'].some(kind=>next.objects.filter(o=>o.kind===kind).length>1)||next.objects.filter(o=>o.kind==='plant').length>2)throw Error('Scene Sheet รุ่นนี้รองรับ 1–4 ชุดโต๊ะ/เก้าอี้ · ของตกแต่งหลักอย่างละหนึ่ง · ยังไม่เปลี่ยนแบบเดิม');
 const base='medium',width=12,depth=8;
 const plan={...defaultBlueprintPlan(base),originX:-width/2,originZ:-depth/2,door:{wall:'front',offset:1.2,width:1.4,open:true},partitions:[{id:'lounge-partition',axis:'z',at:3.5,start:.1,end:depth-2.1,door:{offset:2.7,width:1.4,open:true}}]};
 plan.windows=[{id:'work-window-a',wall:'rear',offset:4.4,width:2.1,sill:1,top:2.3},{id:'work-window-b',wall:'rear',offset:width-3,width:2.1,sill:1,top:2.3},{id:'lounge-window',wall:'left',offset:1,width:2.2,sill:1,top:2.3}];
 validateBlueprintPlan(plan);const columns=2,slots=new Map(),usedChairs=new Set(),usedAvatars=new Set();
 desks.forEach((desk,i)=>{const x=5.3+(i%columns)*2.75,z=1.1+Math.floor(i/columns)*3.4;slots.set(desk.id,{x,z});const preferred=chairs.find(o=>o.id===desk.id.replace(/-desk$/,'-chair')&&!usedChairs.has(o.id));const chair=preferred||next.objects.filter(o=>['task-chair','chair'].includes(o.kind)&&!usedChairs.has(o.id)).sort((a,b)=>Math.hypot(a.x-desk.x,a.y-desk.y)-Math.hypot(b.x-desk.x,b.y-desk.y))[0];if(chair){slots.set(chair.id,{x,z:z+.9});usedChairs.add(chair.id);}const avatar=avatars.find(o=>o.id===desk.id.replace(/-desk$/,'-avatar')&&!usedAvatars.has(o.id))||avatars.find(o=>!usedAvatars.has(o.id));if(avatar){usedAvatars.add(avatar.id);slots.set(avatar.id,{x,z:z+.9});}});
 const fixed={'team-sofa':{x:1.05,z:3.45},'water-cooler':{x:1.2,z:5.1},whiteboard:{x:10.75,z:.9},'wayfinding-arrow':{x:1.9,z:depth-.7}};
 const scales={'task-chair':.6,'team-sofa':.75,'work-desk':.62,whiteboard:.8};
 let plantIndex=0;next.objects=next.objects.map(o=>{const p=slots.get(o.id)||fixed[o.kind]||(o.kind==='plant'?[{x:.9,z:depth-1.1},{x:width-.9,z:depth-1.1}][plantIndex++]:null);if(!p)return o;const {rotation,...original}=o;return {...original,...blueprintPoint(plan,p.x,p.z),scale:scales[o.kind]??o.scale,flip:false};});
 for(const key of ['officeArt','skeletonAlignment','skeletonParts','navigation'])delete next[key];
 return {...next,sceneSheet:SHEET_EDITION,background:'office',blueprint:base,blueprintPlan:plan};
}
export function compileOfficeSheet(room){
 if(!isOfficeSheet(room))throw Error('A measured office-sheet/v1 room is required');const plan=validateBlueprintPlan(room.blueprintPlan),layout=blueprintLayout(plan);
 return {schemaVersion:SHEET_EDITION,units:'metres',fixtures:[{id:'floor-sign',kind:'sign',position:[plan.originX+1.65,1.6,plan.originZ+.12],dimensions:[2.5,.8,.035],text:room.name}],camera:{projection:'orthographic',azimuth:45,elevation:Math.asin(.52)*180/Math.PI},plan,walls:layout.walls,doors:layout.doors,objects:room.objects.map(o=>{const p=groundToWorld(o);return {id:o.id,kind:o.kind,position:[p.x,0,p.z],scale:o.scale,yaw:sheetYaw(o)};})};
}
