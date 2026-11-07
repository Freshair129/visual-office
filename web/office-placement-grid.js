import {validateOfficeNavigation} from './office-nav-state.js';
import {rotateGroundPoint,quarterAngle,ROTATABLE_KINDS} from './office-rotation.js';
import {deriveSheetBlockers} from './office-sheet-bounds.js';
import {blueprintLocalPoint,blueprintPoint,blueprintLayout} from './office-blueprints.js';
import {isOfficeSheet} from './office-scene-sheet.js';
export const isGridMovable=o=>!!o&&!o.locked&&ROTATABLE_KINDS.includes(o.kind);
export function validatePlacementGrid(v){if(!v||Array.isArray(v)||Object.keys(v).some(k=>k!=='cellSize')||v.cellSize!==.5)throw Error('กริดรุ่นนี้ใช้ช่องขนาด 0.5 เมตร');return {cellSize:v.cellSize};}
const overlap=(a,b)=>a.x<b.x+b.w-1e-7&&a.x+a.w>b.x+1e-7&&a.z<b.z+b.d-1e-7&&a.z+a.d>b.z+1e-7;
const bounds=points=>{const xs=points.map(p=>p.x),zs=points.map(p=>p.z);return{x:Math.min(...xs),z:Math.min(...zs),w:Math.max(...xs)-Math.min(...xs),d:Math.max(...zs)-Math.min(...zs)};};
export function createPlacementGrid(room){
 if(!isOfficeSheet(room))throw Error('กริดจัดห้องใช้กับ Scene Sheet ที่วัดขนาดแล้ว');
 const plan=room.blueprintPlan,size=validatePlacementGrid(room.placementGrid||{cellSize:.5}).cellSize;
 const props=deriveSheetBlockers(room,0).map(b=>({id:b.id,...bounds(b.polygon.map(([x,y])=>blueprintLocalPoint(plan,{x,y})))}));
 const spans=blueprintLayout(plan),wallRects=[...spans.walls,...spans.closedDoors].map(w=>{const a=blueprintLocalPoint(plan,{x:w.start[0],y:w.start[1]}),b=blueprintLocalPoint(plan,{x:w.end[0],y:w.end[1]}),r=bounds([a,b]),t=plan.wallThickness||.18;return{id:`wall:${w.id}`,x:r.x-t/2,z:r.z-t/2,w:r.w+t,d:r.d+t};});
 const forbidden=(room.navigation?.forbidden||[]).map(f=>({id:`forbidden:${f.id}`,...bounds(f.points.map(p=>blueprintLocalPoint(plan,p)))}));
 const fixed=[...wallRects,...forbidden],all=[...props,...fixed],cells=[],map=new Map(),cols=Math.ceil(plan.width/size),rows=Math.ceil(plan.depth/size),propsIds=new Set(props.map(p=>p.id));
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const rect={x:col*size,z:row*size,w:Math.min(size,plan.width-col*size),d:Math.min(size,plan.depth-row*size)},ids=all.filter(r=>overlap(rect,r)).map(r=>r.id),cell={...rect,col,row,ids,center:blueprintPoint(plan,rect.x+rect.w/2,rect.z+rect.d/2)};cells.push(cell);map.set(`${col}:${row}`,cell);}
 const cellAt=p=>{const local=blueprintLocalPoint(plan,p);if(local.x<0||local.z<0||local.x>=plan.width||local.z>=plan.depth)return null;return map.get(`${Math.floor(local.x/size)}:${Math.floor(local.z/size)}`);};
 const blocked=(cell,ignoreIds)=>!cell||cell.ids.some(id=>!propsIds.has(id)||!ignoreIds.includes(id));
 const segmentOccupied=(a,b,{ignoreIds=[]}={})=>{const from=blueprintLocalPoint(plan,a),to=blueprintLocalPoint(plan,b),dx=to.x-from.x,dz=to.z-from.z;for(let row=Math.max(0,Math.floor(Math.min(from.z,to.z)/size));row<=Math.min(rows-1,Math.floor(Math.max(from.z,to.z)/size));row++)for(let col=Math.max(0,Math.floor(Math.min(from.x,to.x)/size));col<=Math.min(cols-1,Math.floor(Math.max(from.x,to.x)/size));col++){const cell=map.get(`${col}:${row}`);if(!blocked(cell,ignoreIds))continue;let lo=0,hi=1;for(const [p,d,min,max]of [[from.x,dx,cell.x,cell.x+cell.w],[from.z,dz,cell.z,cell.z+cell.d]]){if(Math.abs(d)<1e-10){if(p<min||p>max){lo=2;break;}}else{const t1=(min-p)/d,t2=(max-p)/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}}if(lo<=hi&&lo<=1&&hi>=0)return true;}return false;};
 return {size,plan,props,fixed,cells,cellAt,isOccupied(p,{ignoreIds=[]}={}){return blocked(cellAt(p),ignoreIds);},segmentOccupied,overlap};
}
export function placementCandidate(room,id,point,grid=createPlacementGrid(room),options={}){
 const source=room.objects.find(o=>o.id===id);if(options.rotation!==undefined&&![0,90,180,270].includes(options.rotation))return{ok:false,message:'มุมหมุนไม่ถูกต้อง'};if(!isGridMovable(source))return{ok:false,message:'ย้ายได้เฉพาะเฟอร์นิเจอร์ที่ไม่ล็อก · ไม่ย้าย Agent'};
 const p=blueprintLocalPoint(grid.plan,point),local=options.snap===false?{x:p.x,z:p.z}:{x:Math.round(p.x/grid.size)*grid.size,z:Math.round(p.z/grid.size)*grid.size},object={...source,...Object.fromEntries(['scale','flip','effects'].filter(k=>Object.hasOwn(options.patch||{},k)).map(k=>[k,options.patch[k]])),...blueprintPoint(grid.plan,local.x,local.z),...(options.rotation!==undefined?{rotation:options.rotation}:{})},old=blueprintLocalPoint(grid.plan,source),r=grid.props.find(r=>r.id===id);
 const rotated=(object.rotation||0)!==(source.rotation||0)||object.flip!==source.flip||object.scale!==source.scale,measured=rotated?deriveSheetBlockers({...room,objects:[object]},0)[0]:null,rect=measured?{id,...bounds(measured.polygon.map(([x,y])=>blueprintLocalPoint(grid.plan,{x,y})))}:r?{...r,x:r.x+local.x-old.x,z:r.z+local.z-old.z}:{x:local.x-.3,z:local.z-.3,w:.6,d:.6};
 let message='วางได้ · คลิกเพื่อวาง';if(rect.x<0||rect.z<0||rect.x+rect.w>grid.plan.width||rect.z+rect.d>grid.plan.depth)message='วางไม่ได้ · ชิ้นงานออกนอกห้อง';
 else if([...grid.props.filter(r=>r.id!==id),...grid.fixed].some(r=>overlap(rect,r)))message='วางไม่ได้ · ทับของ กำแพง หรือพื้นที่ห้ามเดิน';
 else if([...blueprintLayout(grid.plan).doors].some(d=>{const a=blueprintLocalPoint(grid.plan,{x:d.start[0],y:d.start[1]}),b=blueprintLocalPoint(grid.plan,{x:d.end[0],y:d.end[1]}),r=bounds([a,b]);return overlap(rect,{x:r.x-.35,z:r.z-.35,w:r.w+.7,d:r.d+.7});}))message='วางไม่ได้ · เว้นทางเข้าประตู';
 else if(room.objects.filter(o=>o.kind.startsWith('avatar-')).some(o=>{const p=blueprintLocalPoint(grid.plan,o);const occupied=overlap(rect,{x:p.x-.16,z:p.z-.16,w:.32,d:.32}),ownSeat=['task-chair','team-sofa'].includes(source.kind)&&r&&p.x>=r.x&&p.x<=r.x+r.w&&p.z>=r.z&&p.z<=r.z+r.d;return occupied&&!ownSeat;}))message='วางไม่ได้ · มีตัวละครอยู่';
 const result={ok:message.startsWith('วางได้'),message,id,object,local,rect,delta:{x:object.x-source.x,y:object.y-source.y}};if(result.ok&&room.navigation){try{const moved=applyGridPlacement(room,result);validateOfficeNavigation(moved.navigation,moved.objects);}catch{result.ok=false;result.message='วางไม่ได้ · จุดนั่งหรือจุดใช้งานจะออกนอกขอบเขต';}}return result;
}
export function applyGridPlacement(room,candidate){
 if(!candidate?.ok)return room;const source=room.objects.find(o=>o.id===candidate.id),objects=room.objects.map(o=>o.id===candidate.id?candidate.object:o),shift=p=>rotateGroundPoint(p,source,(candidate.object.rotation||0)-(source.rotation||0)+((candidate.object.flip?1:0)-(source.flip?1:0))*180,candidate.object,candidate.object.scale/source.scale);
 let chair;const mayMoveSeat=source?.kind==='task-chair'&&room.navigation?.stations.some(s=>s.seat&&s.objectId!==source.id);if(mayMoveSeat)chair=createPlacementGrid(room).props.find(p=>p.id===source.id);
 const stations=room.navigation?.stations.map(s=>{if(s.objectId===candidate.id)return{...s,approach:shift(s.approach),...(s.seat?{seat:shift(s.seat)}:{})};if(chair&&s.seat){const p=blueprintLocalPoint(room.blueprintPlan,s.seat);if(p.x>=chair.x-.3&&p.x<=chair.x+chair.w+.3&&p.z>=chair.z-.3&&p.z<=chair.z+chair.d+.3)return{...s,seat:shift(s.seat)};}return s;});
 return{...room,placementGrid:room.placementGrid||{cellSize:.5},objects,...(room.navigation?{navigation:{...room.navigation,stations}}:{})};
}
export function rotationCandidate(room,id,steps=1,grid=createPlacementGrid(room),pending){const source=room.objects.find(o=>o.id===id);return placementCandidate(room,id,pending?.object||source,grid,{rotation:quarterAngle((pending?.object?.rotation??source?.rotation??0)+steps*90),snap:false});}
