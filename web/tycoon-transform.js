// Local scene operations only: no roster, Agent slots or business bindings.
import {validateTycoonRoom} from './tycoon-state.js';
import {tycoonGround,tycoonWorld} from './tycoon-blueprint.js';
import {createLocalDesignId} from './local-design-id.js';
const copy=v=>JSON.parse(JSON.stringify(v));
export const orderedObjects=room=>room.layers?room.layers.map(id=>room.objects.find(o=>o.id===id)):room.objects;
export function expandSelection(room,ids){const selected=new Set(ids),groups=new Set(room.objects.filter(o=>selected.has(o.id)&&o.groupId).map(o=>o.groupId));return room.objects.filter(o=>selected.has(o.id)||groups.has(o.groupId)).map(o=>o.id);}
function unique(prefix,used){let i=1;while(used.has(`${prefix}-${i}`))i++;const id=`${prefix}-${i}`;used.add(id);return id;}
export function groupSelection(room,ids){
 const selected=new Set(expandSelection(room,ids));if(selected.size<2)throw Error('เลือกอย่างน้อย 2 ชิ้นเพื่อ Group');
 const next=copy(room),id=unique('group',new Set(room.objects.map(o=>o.groupId)));for(const o of next.objects)if(selected.has(o.id))o.groupId=id;
 const all=orderedObjects(room).map(o=>o.id),at=all.findIndex(id=>selected.has(id));next.layers=[...all.slice(0,at),...all.filter(id=>selected.has(id)),...all.slice(at).filter(id=>!selected.has(id))];return validateTycoonRoom(next);
}
export function ungroupSelection(room,ids){const selected=new Set(expandSelection(room,ids)),next=copy(room);for(const o of next.objects)if(selected.has(o.id))delete o.groupId;return validateTycoonRoom(next);}
export function transformSelection(room,ids,{dx=0,dy=0,dz=0,factor=1,angle=0,snap=0}={}){
 if(![dx,dy,dz,factor,angle,snap].every(Number.isFinite)||factor<=0||snap<0)throw Error('ค่าปรับชุดไม่ถูกต้อง');
 const selected=new Set(expandSelection(room,ids)),items=room.objects.filter(o=>selected.has(o.id));if(!items.length)return room;
 const center={x:(Math.min(...items.map(o=>o.x))+Math.max(...items.map(o=>o.x)))/2,z:(Math.min(...items.map(o=>o.z))+Math.max(...items.map(o=>o.z)))/2};
 if(snap>0){dx=Math.round((items[0].x+dx)/snap)*snap-items[0].x;dz=Math.round((items[0].z+dz)/snap)*snap-items[0].z;}
 const point=p=>({x:center.x+((p.x-center.x)*Math.cos(angle)+(p.z-center.z)*Math.sin(angle))*factor+dx,z:center.z+(-(p.x-center.x)*Math.sin(angle)+(p.z-center.z)*Math.cos(angle))*factor+dz});
 const next=copy(room);for(const o of next.objects)if(selected.has(o.id)){Object.assign(o,point(o));o.y=o.y*factor+dy;o.scale*=factor;o.rotation=Math.atan2(Math.sin(o.rotation+angle),Math.cos(o.rotation+angle));}
 for(const station of next.navigation?.stations||[])if(selected.has(station.objectId))for(const key of ['approach','seat'])if(station[key])station[key]=tycoonGround(point(tycoonWorld(station[key])));
 return validateTycoonRoom(next);
}
export function duplicateSelection(room,ids){
 const selected=new Set(expandSelection(room,ids));if(!selected.size)throw Error('เลือกวัตถุก่อนทำสำเนา');
 const next=copy(room),used=new Set(room.objects.map(o=>o.id)),groups=new Set(room.objects.map(o=>o.groupId)),map=new Map(),groupMap=new Map(),additions=[];
 for(const o of room.objects.filter(o=>selected.has(o.id))){const n=copy(o);n.id=createLocalDesignId(`${o.kind}-copy`,used);map.set(o.id,n.id);if(o.groupId){if(!groupMap.has(o.groupId))groupMap.set(o.groupId,unique('group',groups));n.groupId=groupMap.get(o.groupId);}additions.push(n);}
 next.objects.push(...additions);next.layers=[...additions.map(o=>o.id),...orderedObjects(room).map(o=>o.id)];
 if(next.navigation)for(const s of room.navigation.stations)if(map.has(s.objectId))next.navigation.stations.push({...copy(s),objectId:map.get(s.objectId)});
 const newIds=additions.map(o=>o.id);return {room:transformSelection(next,newIds,{dx:.4,dz:.4}),ids:newIds};
}
export function deleteSelection(room,ids){const selected=new Set(expandSelection(room,ids)),next=copy(room);next.objects=next.objects.filter(o=>!selected.has(o.id));if(next.layers)next.layers=next.layers.filter(id=>!selected.has(id));if(next.navigation)next.navigation.stations=next.navigation.stations.filter(s=>!selected.has(s.objectId));return validateTycoonRoom(next);}
export function reorderSelection(room,ids,direction){
 const selected=new Set(expandSelection(room,ids)),blocks=[],byGroup=new Map();
 for(const o of orderedObjects(room)){let block=o.groupId&&byGroup.get(o.groupId);if(!block){block={ids:[],selected:selected.has(o.id)};blocks.push(block);if(o.groupId)byGroup.set(o.groupId,block);}block.ids.push(o.id);}
 let ordered=blocks;if(direction==='front'||direction==='back'){const yes=blocks.filter(b=>b.selected),no=blocks.filter(b=>!b.selected);ordered=direction==='front'?[...yes,...no]:[...no,...yes];}
 else if(direction==='up'){for(let i=1;i<blocks.length;i++)if(blocks[i].selected&&!blocks[i-1].selected)[blocks[i-1],blocks[i]]=[blocks[i],blocks[i-1]];}
 else if(direction==='down'){for(let i=blocks.length-2;i>=0;i--)if(blocks[i].selected&&!blocks[i+1].selected)[blocks[i+1],blocks[i]]=[blocks[i],blocks[i+1]];}
 else throw Error('ลำดับ layer ไม่ถูกต้อง');return validateTycoonRoom({...copy(room),layers:ordered.flatMap(b=>b.ids)});
}
