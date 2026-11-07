import {groundToWorld} from './office-projection.js';
import {validateSkeletonAlignment,defaultSkeletonAlignment} from './office-skeleton-alignment.js';
export const SKELETON_WALLS=[
 {id:'front-1',label:'ผนังซ้ายหน้าช่องประตู',start:[23.7,37.5],end:[31.2,44.8]},
 {id:'front-2',label:'ผนังขวาข้างช่องประตู',start:[39.5,55],end:[44.8,60.5]},
 {id:'front-3',label:'ผนังกั้นด้านหน้า',start:[44.8,60.5],end:[66.4,81]},
 {id:'front-4',label:'ผนังขวาด้านหน้า',start:[66.4,81],end:[98,52]},
 {id:'work-rear',label:'ผนังหลังห้องทำงาน',start:[58,24],end:[90,42]},
 {id:'work-left',label:'ผนังซ้ายห้องทำงาน',start:[58,24],end:[41,43]},
 {id:'lounge-rear',label:'ผนังหลังพื้นที่พัก',start:[31,49],end:[10,62]},
];
const names={'work-desk':'โต๊ะทำงาน','task-chair':'เก้าอี้','team-sofa':'โซฟา',whiteboard:'บอร์ด','water-cooler':'ตู้กดน้ำ',plant:'ต้นไม้','wayfinding-arrow':'ลูกศรทางเดิน'};
const kinds=new Set(['work-desk','task-chair','team-sofa','whiteboard','water-cooler','plant','wayfinding-arrow']);
export function skeletonTargets(room){return [...SKELETON_WALLS.map(w=>({id:`wall:${w.id}`,label:w.label})),...(room.objects||[]).filter(o=>kinds.has(o.kind)).map(o=>({id:`object:${o.id}`,label:`${names[o.kind]||o.kind} · ${o.id}`}))];}
export function validateSkeletonParts(parts,objects){
 if(!Array.isArray(parts)||parts.length>47)throw Error('Skeleton parts must contain at most 47 records');const targets=new Set(skeletonTargets({objects}).map(t=>t.id)),seen=new Set();
 return parts.map(p=>{if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['id','x','y','scale'].includes(k))||!targets.has(p.id)||seen.has(p.id))throw Error('Invalid, duplicate or non-visual skeleton target');seen.add(p.id);const {id,...a}=p;return {id,...validateSkeletonAlignment(a)};});
}
export function normalizedSkeletonParts(parts,objects){if(!Array.isArray(parts))return;const allowed=new Set(skeletonTargets({objects}).map(t=>t.id));try{return validateSkeletonParts(parts.filter(p=>allowed.has(p?.id)),objects);}catch{return;}}
export function pieceAlignment(room,id){return room?.skeletonParts?.find(p=>p.id===id)||defaultSkeletonAlignment();}
export function piecePoint(p,anchor,a){return {x:anchor.x+(p.x-anchor.x)*a.scale+a.x/15.36,y:anchor.y+(p.y-anchor.y)*a.scale+a.y/10.24};}
export function wallAnchor(w){return {x:(w.start[0]+w.end[0])/2,y:(w.start[1]+w.end[1])/2};}
export function applyWallPieces(architecture,parts){
 const room={skeletonParts:parts};for(const w of architecture.userData.officeArchitecture.walls){const a=pieceAlignment(room,`wall:${w.id}`),p=piecePoint(wallAnchor(w),wallAnchor(w),a),world=groundToWorld(p);w.group.position.x=world.x;w.group.position.z=world.z;w.group.scale.setScalar(a.scale);}
 architecture.updateMatrixWorld(true);
}
export function skeletonSeatOwners(room){const result=new Map(),used=new Set();for(const desk of room.objects.filter(o=>['work-desk','desk'].includes(o.kind))){const chair=room.objects.filter(c=>['task-chair','chair'].includes(c.kind)&&!used.has(c.id)).sort((a,b)=>Math.hypot(a.x-desk.x,a.y-desk.y)-Math.hypot(b.x-desk.x,b.y-desk.y))[0];if(chair&&Math.hypot(chair.x-desk.x,chair.y-desk.y)<8){result.set(desk.id,chair.id);used.add(chair.id);}}return result;}
export function stationPiece(room,objectId,index=0,seatOwnerId){const object=room.objects.find(o=>o.id===objectId);if(!object)return null;const chair=index===1&&['work-desk','desk'].includes(object.kind)?room.objects.find(c=>c.id===(seatOwnerId||skeletonSeatOwners(room).get(objectId))):null;const anchor=chair||object;return {anchor,alignment:pieceAlignment(room,`object:${anchor.id}`)};}
export function stationPiecePoint(room,objectId,p,index=0,inverse=false,seatOwnerId){const owner=stationPiece(room,objectId,index,seatOwnerId);if(!owner)return p;const {anchor,alignment:a}=owner;return inverse?{x:anchor.x+(p.x-anchor.x-a.x/15.36)/a.scale,y:anchor.y+(p.y-anchor.y-a.y/10.24)/a.scale}:piecePoint(p,anchor,a);}
export function physicalSkeletonRoom(room,{seatOwners}={}){
 if(!room.skeletonParts?.length||room.blueprint||room.blueprintPlan)return room;
 const objects=room.objects.map(o=>{if(!kinds.has(o.kind))return o;const a=pieceAlignment(room,`object:${o.id}`),p=piecePoint(o,o,a);return {...o,...p,scale:o.scale*a.scale};});
 const navigation=room.navigation?{...room.navigation,stations:room.navigation.stations.map(s=>({...s,approach:stationPiecePoint(room,s.objectId,s.approach),...(s.seat?{seat:stationPiecePoint(room,s.objectId,s.seat,1,false,seatOwners?.get(s.objectId))}:{})}))}:undefined;
 return {...room,objects,...navigation?{navigation}:{}};
}
export function adjustedWallSpan(w,parts){const a=pieceAlignment({skeletonParts:parts},`wall:${w.id}`),anchor=wallAnchor(w);return {from:piecePoint({x:w.start[0],y:w.start[1]},anchor,a),to:piecePoint({x:w.end[0],y:w.end[1]},anchor,a)};}
