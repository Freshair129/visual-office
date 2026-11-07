import {groundToWorld,worldToGround} from './office-projection.js';
import {officeBlueprints,isOfficeBlueprint,resolveOfficeBlueprint,roomAreaTypes} from './office-blueprint-state.js';
export {officeBlueprints,isOfficeBlueprint} from './office-blueprint-state.js';

// One metric source for top-view dimensions, Three.js structure and navigation.
// Interior clear dimensions; immutable template revisions, never Agent capacity.
const get=resolveOfficeBlueprint;
export function blueprintPoint(id,x,z,options={}){const b=get(id,options);return worldToGround({x:x+b.originX,z:z+b.originZ});}
export function blueprintLocalPoint(id,point,options={}){const b=get(id,options),p=groundToWorld(point);return {x:p.x-b.originX,z:p.z-b.originZ};}
const polygon=(id,x,z,w,d,options)=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]].map(([a,c])=>{const p=blueprintPoint(id,a,c,options);return [p.x,p.y];});
export function blueprintDoorOccupied(input,id,positions,options={}){
  const door=blueprintLayout(input,options).doors.find(d=>d.id===id);if(!door)return false;
  const a=groundToWorld({x:door.start[0],y:door.start[1]}),b=groundToWorld({x:door.end[0],y:door.end[1]}),ab=b.clone().sub(a),length=ab.lengthSq();
  return positions.some(position=>{const p=groundToWorld(position),u=Math.max(0,Math.min(1,p.clone().sub(a).dot(ab)/length));return p.distanceTo(a.clone().addScaledVector(ab,u))<.4;});
}
export function blueprintLayout(id,options={}){
  const b=get(id,options),{width:w,depth:d,loungeWidth:l,aisleWidth:a}=b,t=b.wallThickness/2,point=(x,z)=>blueprintPoint(id,x,z,options);
  const span=(name,start,end,height)=>({id:name,start:Object.values(point(...start)),end:Object.values(point(...end)),height});
  const walls=[];
  for(const wall of ['rear','left','right','front']){
    const horizontal=['rear','front'].includes(wall),length=horizontal?w:d;
    const local=u=>horizontal?[u,wall==='rear'?-t:d+t]:[wall==='left'?-t:w+t,u];
    const intervals=b.door.wall===wall?[[-t,b.door.offset],[b.door.offset+b.door.width,length+t]]:[[-t,length+t]];
    intervals.forEach(([u0,u1],i)=>{
      const openings=b.windows.filter(o=>o.wall===wall&&o.offset>=u0&&o.offset+o.width<=u1);
      const height=Math.max(['rear','left'].includes(wall)?b.wallHeight:b.cutawayHeight,...openings.map(o=>o.top+.3));
      walls.push({...span(intervals.length===1?wall:`${wall}-${i+1}`,local(u0),local(u1),height),wall,u0,u1,
        windows:openings.map(o=>({...o,fraction:(o.offset+o.width/2-u0)/(u1-u0)}))});
    });
  }
  for(const wall of b.partitions||[]){
    const local=u=>wall.axis==='x'?[u,wall.at]:[wall.at,u];
    const intervals=wall.door?[[wall.start,wall.start+wall.door.offset],[wall.start+wall.door.offset+wall.door.width,wall.end]]:[[wall.start,wall.end]];
    intervals.forEach(([u0,u1],i)=>walls.push({...span(`partition-${wall.id}-${i}`,local(u0),local(u1),1.2),partitionId:wall.id,wall:'interior',u0,u1,windows:[]}));
  }
  const doorPoint=u=>['rear','front'].includes(b.door.wall)?[u,b.door.wall==='rear'?0:d]:[b.door.wall==='left'?0:w,u];
  const doors=[{id:'entry',label:'ประตูทางเข้า',open:b.door.open!==false,...span('entry',doorPoint(b.door.offset),doorPoint(b.door.offset+b.door.width),2.25),widthMeters:b.door.width}];
  for(const [i,wall]of (b.partitions||[]).entries())if(wall.door){
    const point=u=>wall.axis==='x'?[u,wall.at]:[wall.at,u];
    doors.push({id:`partition:${wall.id}`,label:`ประตูห้อง ${i+1}`,open:wall.door.open!==false,...span(`partition:${wall.id}`,point(wall.start+wall.door.offset),point(wall.start+wall.door.offset+wall.door.width),2.25),widthMeters:wall.door.width});
  }
  return {blueprint:b,boundary:polygon(id,0,0,w,d,options),zones:[
    {id:'work',type:'work',polygon:polygon(id,l,0,w-l,d-a,options)},
    {id:'lounge',type:'lounge',polygon:polygon(id,0,0,l,d-a,options)},
    {id:'corridor',type:'corridor',polygon:polygon(id,0,d-a,w,a,options)},
  ],areas:(b.areas||[]).map(area=>({...area,polygon:polygon(id,area.x,area.z,area.width,area.depth,options)})),walls,doors,closedDoors:doors.filter(door=>!door.open),door:{wall:b.door.wall,start:Object.values(point(...doorPoint(b.door.offset))),end:Object.values(point(...doorPoint(b.door.offset+b.door.width))),widthMeters:b.door.width},
    testRoute:[point(1.5,d-1),point(w-1,d-1)]};
}
export function applyOfficeBlueprint(room,id){
  const avatars=(room.objects||[]).filter(o=>/^avatar-\d\d$/.test(o.kind));
  const b=get(id),objects=[],used=new Set(avatars.map(o=>o.id)),put=(object,x,z)=>{
    let key=object.id;
    if(!/^avatar-\d\d$/.test(object.kind)){let suffix=1;while(used.has(key))key=`${object.id}-template-${suffix++}`;used.add(key);}
    objects.push({...object,id:key,...blueprintPoint(id,x,z)});
  };
  const object=(id,kind,scale=1,interaction)=>({id,kind,scale,flip:false,locked:false,...(interaction?{interaction}:{})});
  for(let row=0;row<b.rows;row++)for(let column=0;column<b.columns;column++){
    const i=row*b.columns+column+1,x=b.loungeWidth+1.3+column*(b.width-b.loungeWidth-2.6)/Math.max(1,b.columns-1);
    const z=1.1+row*(b.depth-5.1);
    put(object(`plan-desk-${i}`,'work-desk',.62),x,z);
    // Desk faces +z (renderer yaw PI); chair sits toward the front of the plan.
    put(object(`plan-chair-${i}`,'task-chair',.72),x,z+1.15);
  }
  put(object('floor-sofa','team-sofa'),1.1,1.7);
  put(object('floor-water','water-cooler'),2.4,.65);
  put(object('floor-board','whiteboard',.8,{type:'tasks'}),2.2,b.depth-2.65);
  put(object('floor-lift','wayfinding-arrow',1,{type:'elevator'}),2.1,b.depth-.8);
  if(objects.length+avatars.length>40)throw Error('แม่แบบนี้รวมตัวละครเดิมแล้วเกิน 40 ชิ้น · เลือกห้องเล็กลง หรือใช้แบบเดิมต่อ');
  // Reserve a conservative walking-pose envelope, not just a point at each foot.
  // A crowded/oversized inventory must stay intact in the original draft.
  const radius=Math.max(.65,...avatars.map(o=>.8*o.scale/.82));
  const capacity=Math.floor((b.width-2*radius)/(2*radius))+1;
  if(avatars.length&&(radius>1||avatars.length>capacity))throw Error('จำนวนหรือขนาดตัวละครเกินพื้นที่ปลอดภัยของแม่แบบ · ใช้ห้องใหญ่ขึ้นหรือปรับแบบเดิมต่อ · ยังไม่เปลี่ยนตัวละคร');
  avatars.forEach((o,i)=>put({...o},radius+i*(b.width-2*radius)/Math.max(1,avatars.length-1),b.depth-1));
  // Applying is explicit and undoable. No identity, role or other business state is generated.
  const {navigation,blueprint,blueprintPlan,...base}=room;
  return {...base,background:'office',blueprint:id,objects};
}
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const shapes={
  'work-desk':[1.8,.85,'#e7bf88'],'task-chair':[1.04,.95,'#8faa99'],
  'wayfinding-arrow':[1.2,.7,'#e9b862'],
  'team-sofa':[1.05,2.05,'#4a7e78'],'water-cooler':[.56,.5,'#acd8e7'],whiteboard:[1.95,.65,'#fff8eb'],plant:[.7,.7,'#7f9d68'],
};
export function blueprintSVG(id,room,options={}){
  const shape=room?.blueprint===id&&room.blueprintPlan?room.blueprintPlan:id;
  const b=get(shape,options),s=48,pad=52,w=b.width*s,h=b.depth*s,viewW=w+pad*2,viewH=h+pad*2+65;
  const line=(x1,y1,x2,y2,extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`;
  const label=(x,y,text,extra='')=>`<text x="${x}" y="${y}" ${extra}>${esc(text)}</text>`;
  let content=`<rect width="100%" height="100%" fill="#102f43"/><g transform="translate(${pad} ${pad})" font-family="sans-serif" fill="#d2effa" font-size="11">`;
  content+=`<rect width="${w}" height="${h}" fill="#173d50" stroke="#b5e2ef" stroke-width="2"/>`;
  if(!b.areas?.length){content+=`<rect y="${h-2*s}" width="${w}" height="${2*s}" fill="#1f5364"/>`;
  content+=`<rect width="${b.loungeWidth*s}" height="${h-2*s}" fill="#254956"/>`;}
  for(const area of b.areas||[])content+=`<rect x="${area.x*s}" y="${area.z*s}" width="${area.width*s}" height="${area.depth*s}" fill="${{meeting:'#42617b',work:'#6e6243',rest:'#3e6c59'}[area.type]}" opacity=".8"/>`;
  for(let x=1;x<b.width;x++)content+=line(x*s,0,x*s,h,'stroke="#c5effa" opacity=".12"');
  for(let z=1;z<b.depth;z++)content+=line(0,z*s,w,z*s,'stroke="#c5effa" opacity=".12"');
  // Wall centreline on room boundary, thickness extends outward, clear inside dimensions stay exact.
  const t=b.wallThickness*s,q=t/2;
  for(const wall of blueprintLayout(shape,options).walls){const a=blueprintLocalPoint(shape,{x:wall.start[0],y:wall.start[1]},options),c=blueprintLocalPoint(shape,{x:wall.end[0],y:wall.end[1]},options);content+=line(a.x*s,a.z*s,c.x*s,c.z*s,`stroke="#d2effa" stroke-width="${t}"`);}
  for(const door of blueprintLayout(shape,options).doors){const a=blueprintLocalPoint(shape,{x:door.start[0],y:door.start[1]},options),c=blueprintLocalPoint(shape,{x:door.end[0],y:door.end[1]},options);content+=line(a.x*s,a.z*s,c.x*s,c.z*s,`stroke="${door.open?'#55dcff':'#e9a553'}" stroke-width="${door.open?3:t}" ${door.open?'stroke-dasharray="4 4"':''}`);}
  for(const window of b.windows){const horizontal=['rear','front'].includes(window.wall);const x=horizontal?window.offset*s:(window.wall==='left'?-q:w+q),z=horizontal?(window.wall==='rear'?-q:h+q):window.offset*s;content+=line(x,z,x+(horizontal?window.width*s:0),z+(horizontal?0:window.width*s),'stroke="#55dcff" stroke-width="5"');}
  if(!b.areas?.length)content+=label(10,19,'LOUNGE')+label(b.loungeWidth*s+12,19,'WORK AREA')+label(w/2,h-34,'CIRCULATION · 2 m','text-anchor="middle"');
  for(const area of b.areas||[])content+=label((area.x+area.width/2)*s,(area.z+.35)*s,`${area.name} · ${roomAreaTypes[area.type]}`,'text-anchor="middle"');
  const current=room||applyOfficeBlueprint({objects:[]},id);
  for(const o of current.objects||[]){
    const p=blueprintLocalPoint(shape,o,options);if(/^avatar-\d\d$/.test(o.kind)){content+=`<circle cx="${p.x*s}" cy="${p.z*s}" r="5" fill="#ffd17b"><title>${esc(o.id)}</title></circle>`;continue;}
    const def=shapes[o.kind];if(!def)continue;
    const scale=o.scale/(o.kind==='work-desk'?.62:o.kind==='task-chair'?.72:1);
    const width=(o.flip&&['work-desk','task-chair'].includes(o.kind)?def[1]:def[0])*scale*s;
    const depth=(o.flip&&['work-desk','task-chair'].includes(o.kind)?def[0]:def[1])*scale*s;
    content+=`<rect x="${p.x*s-width/2}" y="${p.z*s-depth/2}" width="${width}" height="${depth}" rx="3" fill="${def[2]}" stroke="#e8f8ff" stroke-width=".6"><title>${esc(o.id)}</title></rect>`;
  }
  for(const route of current.navigation?.routes||[])content+=`<polyline points="${route.points.map(p=>{const v=blueprintLocalPoint(shape,p,options);return `${v.x*s},${v.z*s}`;}).join(' ')}" fill="none" stroke="#55dcff" stroke-width="2"/>`;
  for(const area of current.navigation?.forbidden||[])content+=`<polygon points="${area.points.map(p=>{const v=blueprintLocalPoint(shape,p,options);return `${v.x*s},${v.z*s}`;}).join(' ')}" fill="#ee715960" stroke="#ffb6a1"/>`;
  content+=`<g stroke="#b5e2ef">${line(0,-25,w,-25)}${line(0,-32,0,-18)}${line(w,-32,w,-18)}${line(w+25,0,w+25,h)}${line(w+18,0,w+32,0)}${line(w+18,h,w+32,h)}</g>`;
  content+=label(w/2,-31,`${b.width} m · ${b.width*100} px`,'text-anchor="middle"');
  content+=label(w+31,h/2,`${b.depth} m · ${b.depth*100} px`,`text-anchor="middle" transform="rotate(90 ${w+31} ${h/2})"`);
  content+=label(0,h+20,`ENTRY ${b.door.width} m · ${b.door.wall}`);
  content+=label(0,h+44,`${b.label} · ${b.width*b.depth} m² · clear interior`);
  content+=label(0,h+61,`Wall 0.2 m · H 2.8 m · grid 1 m · 100 design px / m`);
  content+=label(0,h+78,`Outer ${Number((b.width+.4).toFixed(1))} × ${Number((b.depth+.4).toFixed(1))} m · simulation template r${b.revision}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" role="img" aria-label="${esc(b.label)} measured office blueprint">${content}</g></svg>`;
}
