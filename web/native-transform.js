import {nativeObjects,nativeDecor,nativeBounds,copy} from './native-state.js';

// Design pixels are stable across zoom/device changes. Projected CSS pixels are separate.
export const DESIGN_PX=100;
export const objectScale=o=>o.scale||{x:1,y:1,z:1};
export function patchObjects(room,patches){
  const byId=new Map(patches.map(p=>[p.id,p]));
  return {...room,objects:room.objects.map(o=>byId.get(o.id)||o),
    ...(patches.some(p=>p.id.startsWith('builtin-'))?{decor:nativeDecor(room).map(o=>byId.get(o.id)||o)}:{})};
}
export function expandGroupSelection(room,ids){
  const selected=new Set(ids),all=nativeObjects(room),groups=new Set(all.filter(o=>selected.has(o.id)&&o.groupId).map(o=>o.groupId));
  return all.filter(o=>selected.has(o.id)||groups.has(o.groupId)).map(o=>o.id);
}
function saveLayerOrder(room,ordered){
  return {...room,decor:nativeDecor(room),layers:ordered.map(o=>o.id)};
}
export function groupObjects(room,ids,groupId){
  const selected=new Set(expandGroupSelection(room,ids)),all=nativeObjects(room).map(o=>selected.has(o.id)?{...copy(o),groupId}:o);
  if(selected.size<2)return room;
  const first=all.findIndex(o=>selected.has(o.id)),picked=all.filter(o=>selected.has(o.id)),rest=all.filter(o=>!selected.has(o.id));
  const insert=all.slice(0,first).filter(o=>!selected.has(o.id)).length;rest.splice(insert,0,...picked);
  return saveLayerOrder(patchObjects(room,picked),rest);
}
export function ungroupObjects(room,ids){
  const selected=new Set(expandGroupSelection(room,ids)),all=nativeObjects(room),patches=all.filter(o=>selected.has(o.id)&&o.groupId).map(o=>{const next={...copy(o)};delete next.groupId;return next;});
  return patches.length?patchObjects(room,patches):room;
}
export function reorderLayers(room,ids,direction){
  const selected=new Set(expandGroupSelection(room,ids)),all=nativeObjects(room),blocks=[];
  for(const o of all){const key=o.groupId?`group:${o.groupId}`:`item:${o.id}`,last=blocks.at(-1);if(last?.key===key)last.items.push(o);else blocks.push({key,items:[o],selected:selected.has(o.id)});}
  for(const block of blocks)block.selected=block.items.some(o=>selected.has(o.id));
  if(direction==='front'||direction==='back'){
    const picked=blocks.filter(b=>b.selected),rest=blocks.filter(b=>!b.selected);
    return saveLayerOrder(room,[...(direction==='front'?picked:rest).flatMap(b=>b.items),...(direction==='front'?rest:picked).flatMap(b=>b.items)]);
  }
  const step=direction==='up'?1:direction==='down'?-1:0;if(!step)return room;
  if(step>0){for(let i=1;i<blocks.length;i++)if(blocks[i].selected&&!blocks[i-1].selected)[blocks[i-1],blocks[i]]=[blocks[i],blocks[i-1]];}
  else{for(let i=blocks.length-2;i>=0;i--)if(blocks[i].selected&&!blocks[i+1].selected)[blocks[i],blocks[i+1]]=[blocks[i+1],blocks[i]];}
  return saveLayerOrder(room,blocks.flatMap(b=>b.items));
}
export function moveNewObjectsToFront(room,objects){
  const additions=Array.isArray(objects)?objects:[objects],ids=new Set(additions.map(o=>o.id));
  return saveLayerOrder({...room,objects:[...room.objects,...additions]},[...additions,...nativeObjects(room)]);
}
export function removeObjects(room,ids){
  const removed=new Set(ids),next={...room,objects:room.objects.filter(o=>!removed.has(o.id)),decor:nativeDecor(room).filter(o=>!removed.has(o.id))};
  if(room.layers)next.layers=room.layers.filter(id=>!removed.has(id));
  const remaining=nativeObjects({...next,layers:undefined}),counts=new Map();for(const o of remaining)if(o.groupId)counts.set(o.groupId,(counts.get(o.groupId)||0)+1);
  const patches=remaining.filter(o=>o.groupId&&counts.get(o.groupId)<2).map(o=>{const p={...copy(o)};delete p.groupId;return p;});
  return patches.length?patchObjects(next,patches):next;
}
export function translateObjects(room,ids,anchorId,point,{grid=0,align=false}={}){
  const all=nativeObjects(room),items=all.filter(o=>ids.includes(o.id)&&!o.locked),anchor=items.find(o=>o.id===anchorId);
  if(!anchor)return [];
  const delta={x:0,z:0};
  for(const k of ['x','z']){
    if(!Number.isFinite(point[k]))continue;
    let target=point[k];
    if(grid>0)target=Math.round(target/grid)*grid;
    if(align){
      const candidates=all.filter(o=>!ids.includes(o.id)).map(o=>o[k]).filter(v=>Math.abs(v-point[k])<=.12).sort((a,b)=>Math.abs(a-point[k])-Math.abs(b-point[k]));
      if(candidates.length)target=candidates[0];
    }
    const min=Math.max(...items.map(o=>-nativeBounds(o)[k]-o[k])),max=Math.min(...items.map(o=>nativeBounds(o)[k]-o[k]));
    delta[k]=Math.max(min,Math.min(max,target-anchor[k]));
  }
  return items.map(o=>({...copy(o),x:Math.round((o.x+delta.x)*10000)/10000,z:Math.round((o.z+delta.z)*10000)/10000}));
}
export function scaleObjects(items,factor,axis=null){
  if(!Number.isFinite(factor)||factor<=0)throw Error('ขนาดต้องมากกว่า 0');
  const movable=items.filter(o=>!o.locked);if(!movable.length)return [];
  const requested=movable.map(o=>{
    const s={...objectScale(o)};
    for(const k of ['x','y','z'])if(!axis||axis===k)s[k]*=factor;
    if(Object.values(s).some(v=>v<.1||v>4))throw Error('ขนาดรองรับ 10–400% ของชิ้นงานเดิม');
    return s;
  });
  let positionFactor=factor;const centers={};
  const positionAxes=movable.length>1?(axis==='x'?['x']:axis==='z'?['z']:axis==='y'?[]:['x','z']):[];
  for(const k of positionAxes){
    const bounds=movable.map(o=>nativeBounds(o)[k]),low=Math.max(...bounds.map(v=>-v)),high=Math.min(...bounds),values=movable.map(o=>o[k]),center=Math.max(low,Math.min(high,(Math.min(...values)+Math.max(...values))/2));centers[k]=center;
    for(const o of movable){const delta=o[k]-center;if(Math.abs(delta)<1e-8)continue;const limit=delta>0?(nativeBounds(o)[k]-center)/delta:(-nativeBounds(o)[k]-center)/delta;positionFactor=Math.min(positionFactor,limit);}
  }
  positionFactor=Math.max(0,positionFactor);
  return movable.map(o=>{
    const s={...objectScale(o)};for(const k of ['x','y','z'])if(!axis||axis===k)s[k]*=positionFactor;
    const result={...o,scale:s};for(const k of positionAxes){const bounds=nativeBounds(o)[k],center=centers[k];result[k]=Math.round(Math.max(-bounds,Math.min(bounds,center+(o[k]-center)*positionFactor))*10000)/10000;}
    return result;
  });
}
