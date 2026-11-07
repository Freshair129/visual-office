import {writeFile,mkdir} from 'node:fs/promises';
import {OFFICE_FLOORS} from '../web/office-floor-registry.js';
import {TYCOON_ASSETS} from '../web/tycoon-models.js';
import {tycoonPlan,tycoonGround,tycoonWorld,createTycoonNavigation} from '../web/tycoon-blueprint.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import * as floorPlans from '../web/tycoon-floor-plans.js';
import {describeAreaDimensions,metricLength} from '../web/office-plan-dimensions.js';

const output=new URL('../docs/game-design/tycoon-floor-plans.svg',import.meta.url);
const escapeText=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const number=value=>Number(value.toFixed(2));
const px=(x,origin,scale)=>number(origin+x*scale);

const panelWidth=500,panelHeight=464,gap=14,columns=3,rows=Math.ceil(OFFICE_FLOORS.length/columns),marginX=20,marginTop=72,marginBottom=44;
const svgWidth=marginX*2+columns*panelWidth+(columns-1)*gap;
const svgHeight=marginTop+rows*panelHeight+(rows-1)*gap+marginBottom;
const scale=17,wallThicknessM=.2,wallStroke=wallThicknessM*scale;

const colors={
  background:'#f4f5f2',panel:'#ffffff',floor:'#fbfaf6',wall:'#415b5f',
  route:'#e4f2f7',meeting:'#fcf1df',work:'#f6e8d5',rest:'#e5f2f8',
  furniture:'#d5b486',chair:'#90aeb6',board:'#8aa99c',cabinet:'#c6bda9',
  plant:'#91aa88',lift:'#d2b46f',kiosk:'#70949b',coffee:'#e4ba76',
  reception:'#d9954c',sofa:'#8cacad',table:'#d5c5a7',window:'#7bb9c2',
  door:'#b27d28',ink:'#173d43',muted:'#66787a',line:'#d7dddc',
};

function text(x,y,value,{size=8,weight=500,anchor='middle',fill=colors.ink,className=''}={}){
  const halo=className==='door-dimension'?' paint-order="stroke" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"':'';
  return `<text class="${className}" x="${number(x)}" y="${number(y)}" text-anchor="${anchor}" font-family="IBM Plex Sans Thai, Manrope, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}"${halo}>${escapeText(value)}</text>`;
}

function dimensionLine(x1,y1,x2,y2,label,kind,metres){
  const vertical=Math.abs(x2-x1)<.001,cx=(x1+x2)/2,cy=(y1+y2)/2,tick=3;
  const ticks=vertical?[[x1-tick,y1,x1+tick,y1],[x2-tick,y2,x2+tick,y2]]:[[x1,y1-tick,x1,y1+tick],[x2,y2-tick,x2,y2+tick]];
  const words=!label?'':vertical?`<g transform="rotate(-90 ${number(cx+9)} ${number(cy)})">${text(cx+9,cy,label,{size:7.5})}</g>`:text(cx,cy-4,label,{size:7.5});
  return `<g class="dimension-line" data-dimension-kind="${escapeText(kind)}" data-metres="${number(metres)}" fill="none" stroke="#74827d" stroke-width=".7"><line x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}"/>${ticks.map(([a,b,c,d])=>`<line x1="${number(a)}" y1="${number(b)}" x2="${number(c)}" y2="${number(d)}"/>`).join('')}<g stroke="none" fill="${colors.ink}">${words}</g></g>`;
}

function dimensionBadge(plan,left,top,x,y){
  const labels=plan.areas.map(area=>areaLabelLayout(plan,area,left,top));
  for(const partition of plan.partitions.filter(p=>p.door)){
    const horizontal=partition.axis==='x',middle=partition.start+partition.door.offset+partition.door.width/2;
    const cx=left+(horizontal?middle:partition.at)*scale,cy=top+(horizontal?partition.at:middle)*scale;
    const width=estimatedTextWidth(`${partition.door.width.toFixed(1)} m`,6)+3;
    labels.push({labelX:horizontal?cx-width/2:cx+2.5,labelY:cy+(horizontal?-11:-5),labelWidth:width,labelHeight:9});
  }
  for(let radius=8;radius<=120;radius+=8)for(let i=0;i<16;i++){
    const candidate={x:x+Math.cos(i*Math.PI/8)*radius,y:y+Math.sin(i*Math.PI/8)*radius};
    if(candidate.x<left-12||candidate.x>left+plan.width*scale+12||candidate.y<top+7||candidate.y>top+plan.depth*scale-7)continue;
    if(labels.every(box=>candidate.x+8<box.labelX||candidate.x-8>box.labelX+box.labelWidth||candidate.y+8<box.labelY||candidate.y-8>box.labelY+box.labelHeight))return candidate;
  }
  throw Error('No readable aisle dimension marker location');
}

function drawDimensions(floor,plan,left,top){
  const w=plan.width*scale,d=plan.depth*scale;
  const outer=dimensionLine(left,top+d+17,left+w,top+d+17,`${plan.width} m inside`,'overall-width',plan.width)+dimensionLine(left+w+18,top,left+w+18,top+d,`${plan.depth} m inside`,'overall-depth',plan.depth);
  const aisles=floorPlans.createTycoonFloorDimensions(floor).map((probe,index)=>{const [x1,z1]=probe.from,[x2,z2]=probe.to,len=metricLength(probe.from,probe.to),x=left+x1*scale,y=top+z1*scale,key=`A${index+1}`,badge=dimensionBadge(plan,left,top,x,y);return dimensionLine(x,y,left+x2*scale,top+z2*scale,'','aisle',len)+`<g class="aisle-key" data-dimension-id="${escapeText(probe.id)}"><line x1="${number(x)}" y1="${number(y)}" x2="${number(badge.x)}" y2="${number(badge.y)}" stroke="#74827d" stroke-width=".6"/><circle cx="${number(badge.x)}" cy="${number(badge.y)}" r="6" fill="#ffffff" stroke="#74827d" stroke-width=".6"/>${text(badge.x,badge.y+1.7,key,{size:4.8})}<title>${escapeText(key+' · aisle '+len.toFixed(1)+' m')}</title></g>`;}).join('');
  const y=top+d+35,x=left+3,bar=4*scale;
  const ruler=`<g class="scale-bar" data-metres="4"><path d="M${number(x)} ${number(y)}h${bar} M${number(x)} ${number(y-3)}v6 M${number(x+bar/2)} ${number(y-3)}v6 M${number(x+bar)} ${number(y-3)}v6" fill="none" stroke="#536966" stroke-width="1"/>${text(x,y-5,'0',{size:6})}${text(x+bar/2,y-5,'2',{size:6})}${text(x+bar,y-5,'4 m',{size:6})}</g>`;
  return outer+aisles+ruler;
}

function drawAreas(room,left,top){
  const plan=tycoonPlan(room);
  return (plan.areas||[]).map(area=>{
    const fill=area.type==='meeting'?colors.meeting:area.type==='rest'?colors.rest:colors.work;
    const x=left+area.x*scale,y=top+area.z*scale,w=area.width*scale,h=area.depth*scale;
    return `<g class="area area-${area.type}" data-area-id="${escapeText(area.id)}"><rect x="${number(x)}" y="${number(y)}" width="${number(w)}" height="${number(h)}" rx="2" fill="${fill}" stroke="#a6b2ad" stroke-width=".8"/><title>${escapeText(area.name)}</title></g>`;
  }).join('');
}

function estimatedTextWidth(value,fontSize){
  const units=[...value].reduce((sum,char)=>{
    let weight=.53;
    if(char===' '||/[ilI1.,:;!]/.test(char))weight=.28;
    else if(/[MWmw@]/.test(char))weight=.78;
    else if(/[A-Z]/.test(char))weight=.65;
    else if(/[ก-๙]/.test(char))weight=.9;
    return sum+weight;
  },0);
  return units*fontSize;
}

function wrapAreaName(value,maxWidth){
  const words=String(value).split(/\s+/).filter(Boolean);
  for(let fontSize=6.4;fontSize>=4.8;fontSize-=.2){
    const lines=[];let current='';
    for(const word of words){
      if(estimatedTextWidth(word,fontSize)>maxWidth)break;
      const candidate=current?`${current} ${word}`:word;
      if(current&&estimatedTextWidth(candidate,fontSize)>maxWidth){lines.push(current);current=word;}
      else current=candidate;
    }
    if(current)lines.push(current);
    if(lines.length<=3&&lines.length&&words.every(word=>lines.some(line=>line.split(' ').includes(word))))return {lines,fontSize};
  }
  return {lines:words,fontSize:4.8};
}

function areaLabelLayout(plan,area,left,top){
  const placed=[];
  for(const current of plan.areas){
    const cx=left+(current.x+current.width/2)*scale,cy=top+(current.z+current.depth/2)*scale;
    let chosen=null;
    for(let radius=0;radius<=120&&!chosen;radius+=8)for(let i=0;i<(radius?16:1);i++){
      const point={cx:cx+Math.cos(i*Math.PI/8)*radius,cy:cy+Math.sin(i*Math.PI/8)*radius};
      const minX=left+current.x*scale+8,maxX=left+(current.x+current.width)*scale-8,minY=top+current.z*scale+8,maxY=top+(current.z+current.depth)*scale-8;
      if(point.cx<minX||point.cx>maxX||point.cy<minY||point.cy>maxY)continue;
      if(placed.every(other=>Math.abs(point.cx-other.cx)>18||Math.abs(point.cy-other.cy)>18)){chosen=point;break;}
    }
    if(!chosen)throw Error('No readable room marker location: '+current.id);
    placed.push({...chosen,id:current.id,labelX:chosen.cx-8,labelY:chosen.cy-8,labelWidth:16,labelHeight:16});
  }
  return placed.find(label=>label.id===area.id);
}

function drawAreaLabels(room,left,top){
  const plan=tycoonPlan(room);
  return `<g class="area-labels">${plan.areas.map((area,index)=>{
    const {cx,cy,labelX,labelY,labelWidth,labelHeight}=areaLabelLayout(plan,area,left,top),dimensions=describeAreaDimensions(plan,area),key=`R${index+1}`,metric=`${dimensions.widthM.toFixed(1)} × ${dimensions.depthM.toFixed(1)} m`,areaMetric=`${dimensions.areaM2.toFixed(1)} m² · ${dimensions.basis==='clear-room'?'clear':'zone'}`;
    return `<g class="area-label" data-area-id="${escapeText(area.id)}" data-room-key="${key}" data-dimension-basis="${dimensions.basis}" data-width-m="${number(dimensions.widthM)}" data-depth-m="${number(dimensions.depthM)}" data-area-m2="${number(dimensions.areaM2)}"><title>${escapeText(key+' · '+area.name+' · '+metric+' · '+areaMetric)}</title><rect x="${number(labelX)}" y="${number(labelY)}" width="${labelWidth}" height="${labelHeight}" rx="8" fill="#ffffff" stroke="#526e6b" stroke-width=".7"/>${text(cx,cy+2.5,key,{size:7,weight:700})}</g>`;
  }).join('')}</g>`;
}

function drawAreaSchedule(plan,left,top){
  return `<g class="area-schedule">${plan.areas.map((area,index)=>{
    const d=describeAreaDimensions(plan,area),line=`R${index+1} · ${area.name} · ${d.widthM.toFixed(1)} × ${d.depthM.toFixed(1)} m · ${d.areaM2.toFixed(1)} m² · ${d.basis==='clear-room'?'clear':'zone'}`;
    return `<g class="area-schedule-row" data-area-id="${escapeText(area.id)}">${text(left-32,top+325+index*12,line,{size:Math.min(7,472/estimatedTextWidth(line,1)),anchor:'start'})}</g>`;
  }).join('')}</g>`;
}

function drawCirculation(room,left,top,floor){
  const plan=tycoonPlan(room),nav=createTycoonNavigation(room),door=plan.door,lift=room.objects.find(object=>object.kind==='lift');
  const u=door.offset+door.width/2,local=door.wall==='front'?{x:u,z:plan.depth-.65}:door.wall==='rear'?{x:u,z:.65}:door.wall==='left'?{x:.65,z:u}:{x:plan.width-.65,z:u};
  const start=tycoonGround({x:plan.originX+local.x+2,z:plan.originZ+local.z+2}),end=tycoonGround({x:lift.x+Math.sin(lift.rotation)*1.1,z:lift.z+Math.cos(lift.rotation)*1.1}),route=nav.findLocalPath(start,end);
  if(!route.length)throw Error(`${floor}: floor entry cannot reach its lift lobby (${JSON.stringify({start,end,startWalkable:nav.isWalkable(start),endWalkable:nav.isWalkable(end)})})`);
  return `<polyline class="entry-lift-route" points="${route.map(point=>{const world=tycoonWorld(point);return `${number(left+(world.x-plan.originX-2)*scale)},${number(top+(world.z-plan.originZ-2)*scale)}`;}).join(' ')}" fill="none" stroke="#6aabb7" stroke-width="1.5" stroke-dasharray="4 3"/>`;
}

function drawPartition(partition,left,top){
  const planPoint=(x,z)=>({x:left+x*scale,y:top+z*scale});
  const isHorizontal=partition.axis==='x';
  const a=isHorizontal?planPoint(partition.start,partition.at):planPoint(partition.at,partition.start);
  const b=isHorizontal?planPoint(partition.end,partition.at):planPoint(partition.at,partition.end);
  const length=partition.end-partition.start;
  const door=partition.door;
  if(!door)return `<line class="partition-wall" x1="${number(a.x)}" y1="${number(a.y)}" x2="${number(b.x)}" y2="${number(b.y)}" stroke="${colors.wall}" stroke-width="${wallStroke}"/>`;
  const start=partition.start+door.offset,end=start+door.width;
  const d1=isHorizontal?planPoint(start,partition.at):planPoint(partition.at,start);
  const d2=isHorizontal?planPoint(end,partition.at):planPoint(partition.at,end);
  const segment=(from,to)=>`<line class="partition-wall" x1="${number(from.x)}" y1="${number(from.y)}" x2="${number(to.x)}" y2="${number(to.y)}" stroke="${colors.wall}" stroke-width="${wallStroke}"/>`;
  const marker=isHorizontal
    ? `<line x1="${number(d1.x)}" y1="${number(d1.y)}" x2="${number(d2.x)}" y2="${number(d2.y)}" stroke="${colors.door}" stroke-width="1.3" stroke-dasharray="3 2"/>`
    : `<line x1="${number(d1.x)}" y1="${number(d1.y)}" x2="${number(d2.x)}" y2="${number(d2.y)}" stroke="${colors.door}" stroke-width="1.3" stroke-dasharray="3 2"/>`;
  const before=partition.start<start
    ? segment(a,d1)
    : '';
  const after=end<partition.end
    ? segment(d2,b)
    : '';
  const widthLabel=`<g data-door-id="${escapeText(partition.id)}" data-width-m="${door.width}">${text((d1.x+d2.x)/2+(isHorizontal?0:4),(d1.y+d2.y)/2+(isHorizontal?-4:2),`${door.width.toFixed(1)} m`,{size:6,anchor:isHorizontal?'middle':'start',className:'door-dimension'})}</g>`;
  return `${before}${after}${marker}${widthLabel}`;
}

function drawOuterShell(plan,left,top){
  const roomWidth=plan.width*scale,roomDepth=plan.depth*scale;
  const q=wallStroke/2,x1=left-q,x2=left+roomWidth+q,y1=top-q,y2=top+roomDepth+q;
  const doorStart=plan.door.offset,doorEnd=doorStart+plan.door.width;
  const line=(xA,yA,xB,yB)=>`<line class="outer-wall" x1="${number(xA)}" y1="${number(yA)}" x2="${number(xB)}" y2="${number(yB)}" stroke="${colors.wall}" stroke-width="${wallStroke}"/>`;
  const windows=(plan.windows||[]).map(window=>{
    const x=left+window.offset*scale,w=window.width*scale;
    return `<line x1="${number(x)}" y1="${number(y1)}" x2="${number(x+w)}" y2="${number(y1)}" stroke="${colors.window}" stroke-width="3"/>`;
  }).join('');
  return `<rect class="floor-surface" x="${number(left)}" y="${number(top)}" width="${number(roomWidth)}" height="${number(roomDepth)}" fill="${colors.floor}" stroke="none"/>${line(x1,y1,x2,y1)}${line(x1,y1,x1,y2)}${line(x2,y1,x2,y2)}${line(x1,y2,left+doorStart*scale,y2)}${line(left+doorEnd*scale,y2,x2,y2)}<line x1="${number(left+doorStart*scale)}" y1="${number(y2)}" x2="${number(left+doorEnd*scale)}" y2="${number(y2)}" stroke="${colors.door}" stroke-width="1.4" stroke-dasharray="3 2"/>${windows}<g data-door-id="entry" data-width-m="${plan.door.width}">${text(left+(doorStart+doorEnd)/2*scale,y2-5,`${plan.door.width.toFixed(1)} m`,{size:6,className:"door-dimension"})}</g>`;
}

function drawFurniture(room,left,top){
  const plan=tycoonPlan(room);
  return room.objects.map(object=>{
    const asset=TYCOON_ASSETS[object.kind];
    if(!asset)return '';
    const [width,depth]=asset.footprint.map(size=>size*object.scale);
    const x=left+(object.x-plan.originX-2)*scale,y=top+(object.z-plan.originZ-2)*scale;
    const color=colors[object.kind]||colors.furniture;
    const rotation=-object.rotation*180/Math.PI;
    const label=object.kind==='lift'?'LIFT':object.kind==='kiosk'&&object.id==='directory'?'DIRECTORY':'';
    return `<g class="furniture furniture-${object.kind}" transform="translate(${number(x)} ${number(y)}) rotate(${number(rotation)})"><title>${escapeText(object.id)} · ${escapeText(object.kind)}</title><rect x="${number(-width*scale/2)}" y="${number(-depth*scale/2)}" width="${number(width*scale)}" height="${number(depth*scale)}" rx="1.5" fill="${color}" stroke="#6a7772" stroke-width=".55"/>${label?text(0,2,label,{size:5.4,weight:700,fill:'#3f392d'}):''}</g>`;
  }).join('');
}

function renderFloor(floor,index){
  const room=createTycoonRoom(floor.key),plan=tycoonPlan(room),roomWidth=plan.width*scale,roomDepth=plan.depth*scale;
  const col=index%columns,row=Math.floor(index/columns);
  const x=marginX+col*(panelWidth+gap),y=marginTop+row*(panelHeight+gap);
  const left=x+(panelWidth-roomWidth)/2,top=y+40;
  const header=OFFICE_FLOORS.find(item=>item.key===floor.key);
  const circulation=drawCirculation(room,left,top,floor.key);
  const partitions=plan.partitions.map(partition=>drawPartition(partition,left,top)).join(''),dimensions=drawDimensions(floor.key,plan,left,top);
  const aisleLegend=floorPlans.createTycoonFloorDimensions(floor.key).map((probe,index)=>`A${index+1}: aisle ${metricLength(probe.from,probe.to).toFixed(1)} m`).join(' · ');
  const badge=floor.key==='warehouse'?text(x+panelWidth-14,y+20,'CONCEPT ONLY',{size:7.2,weight:700,anchor:'end',fill:'#876b36'}):'';
  return `<g class="floor-plan" data-floor="${escapeText(floor.key)}"><rect x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}" rx="8" fill="${colors.panel}" stroke="${colors.line}"/><title>${escapeText(header.label)} · local simulation floor plan</title>${text(x+12,y+22,header.label,{size:13,weight:700,anchor:'start'})}${badge}${text(x+12,y+35,aisleLegend,{size:6.2,anchor:'start',fill:colors.muted})}${text(x+panelWidth-12,y+35,'REAR ↑  ·  ENTRY ↓',{size:7.2,weight:600,anchor:'end',fill:colors.muted})}<g class="room-plan">${drawOuterShell(plan,left,top)}${drawAreas(room,left,top)}${circulation}${drawFurniture(room,left,top)}${partitions}${dimensions}${drawAreaLabels(room,left,top)}</g>${text(left+roomWidth/2+32,top+roomDepth+35,`${plan.width*plan.depth} m² · dashed: entry–lift route`,{size:7.2,fill:colors.muted})}${drawAreaSchedule(plan,left,top)}${text(x+12,y+447,'Metres · clear: wall-face dimensions · zone: area bounds · 0.2 m walls',{size:6.2,anchor:'start',fill:colors.muted})}</g>`;
}

const rendered=OFFICE_FLOORS.map(renderFloor);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-labelledby="title description">
<title id="title">Office Tycoon · all fifteen local floor plans</title>
<desc id="description">Lobby and fourteen department floor defaults at one scale, with shared lift core, circulation aisles, doors, named programme areas, and furniture placements. Simulation diagram only.</desc>
<rect width="100%" height="100%" fill="${colors.background}"/>
${text(svgWidth/2,32,'OFFICE TYCOON · ALL-FLOOR LOCAL PLANS',{size:19,weight:700})}
${text(svgWidth/2,53,'Distinct department layouts · 24 × 16 m plate · dashed lines use actual navigation',{size:10.5,fill:colors.muted})}
${rendered.join('')}
${text(marginX,svgHeight-28,'Metres · 0.2 m walls · clear = enclosed wall-face dimensions; zone = authored area bounds · scale bar 0–4 m',{size:9,anchor:'start',fill:colors.muted})}
${text(marginX,svgHeight-13,'R1–R6 reference the dimension schedule on each sheet · simulation plans. Warehouse is an office planning mockup.',{size:9,anchor:'start',fill:colors.muted})}
</svg>`;

await writeFile(output,`${svg.trim()}\n`,'utf8');
const individualDirectory=new URL('../docs/game-design/floor-plans/',import.meta.url);await mkdir(individualDirectory,{recursive:true});
for(const [index,floor]of OFFICE_FLOORS.entries()){
  const x=marginX+(index%columns)*(panelWidth+gap),y=marginTop+Math.floor(index/columns)*(panelHeight+gap);
  // At 1:100, one real metre is ten printed millimetres. The sheet retains
  // physical mm dimensions; printing with Fit-to-page changes that scale.
  const widthMm=panelWidth/scale*10,heightMm=panelHeight/scale*10;
  const single=`<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm.toFixed(8)}mm" height="${heightMm.toFixed(8)}mm" viewBox="0 0 ${panelWidth} ${panelHeight}" role="img" aria-labelledby="title"><title id="title">${escapeText(floor.label)} · dimensions in metres · 1:100 when printed at 100 percent</title><g transform="translate(${-x} ${-y})">${rendered[index]}</g>${text(136,347,'1:100 at 100%',{size:6,anchor:'start'})}</svg>`;
  await writeFile(new URL(floor.key+'.svg',individualDirectory),single+'\n','utf8');
}
console.log(`Built ${OFFICE_FLOORS.length} local floor plans: ${output.pathname}`);
