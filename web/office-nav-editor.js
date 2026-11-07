import {stationPiece,stationPiecePoint} from './office-skeleton-parts.js';
import {skeletonAlignment,alignmentSvgTransform,inverseAlignmentPoint} from './office-skeleton-alignment.js';
import {createOfficeNavigation} from './office-navigation.js';
import {blueprintLayout,blueprintPoint} from './office-blueprints.js';
import {createLocalDesignId} from './local-design-id.js';
import {LEGACY_COORDINATE_BOUNDS} from './office-design-limits.js';
import {resolveNavigationCoordinateBounds} from './office-nav-state.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const empty=()=>({version:1,routes:[],forbidden:[],stations:[]});
const point=p=>({x:p.x,y:p.y});
const bounded=(n,min,max)=>Math.round(Math.max(min,Math.min(max,n))*100)/100;
const physical=new Set(['work-desk','desk','team-sofa','water-cooler']);
const names={'work-desk':'โต๊ะทำงาน',desk:'โต๊ะ', 'team-sofa':'โซฟา','water-cooler':'ตู้กดน้ำ'};

// Authoring only: all commits go through the room's validated history/storage path.
export class OfficeNavigationEditor{
  constructor(root,{stage,onChange,onTest,onStop,navigationFactory=createOfficeNavigation,stationTests=false,coordinateBounds,blueprintOptions}={}){
    this.stationTests=stationTests;
    this.navigationFactory=navigationFactory;
    this.coordinateBounds=resolveNavigationCoordinateBounds(coordinateBounds);this.blueprintOptions=blueprintOptions;
    this.root=root;this.stage=stage;this.onChange=onChange;this.onTest=onTest;this.onStop=onStop;this.selectedPoint=0;
    const bounds=this.coordinateBounds,isLegacy=bounds===LEGACY_COORDINATE_BOUNDS;
    root.classList.add('hy-nav-panel');
    root.innerHTML=`<div class="hy-nav-heading"><strong>ทางเดินและจุดใช้งาน</strong><span>ลากจุดบนพื้น · ปุ่มลูกศรขยับ 1 ${isLegacy?'%':'หน่วย'} · Shift ขยับ 5 ${isLegacy?'%':'หน่วย'}</span></div>
      <div class="hy-nav-tools"><button type="button" data-nav-new-route>＋ เส้นทางเดิน</button><button type="button" data-nav-new-area>＋ พื้นที่ห้ามเดิน</button>
      <label>กำลังแก้<select data-nav-target aria-label="เส้นทางหรือจุดใช้งาน"></select></label></div>
      <div class="hy-nav-point-tools"><button type="button" data-nav-add-point>เพิ่มจุดบนพื้น</button><button type="button" data-nav-remove-point>ลบจุดนี้</button><button type="button" data-nav-delete>ลบรายการ / คืนจุดเดิม</button>
      <label>X ${isLegacy?'%':'พิกัดพื้น'}<input data-nav-x type="number" min="${bounds.minX}" max="${bounds.maxX}" step="0.25" aria-label="จุดทางเดิน X"></label><label>Y ${isLegacy?'%':'พิกัดพื้น'}<input data-nav-y type="number" min="${bounds.minY}" max="${bounds.maxY}" step="0.25" aria-label="จุดทางเดิน Y"></label></div>
      <div class="hy-nav-point-list" aria-label="เลือกจุด"></div><div class="hy-nav-test-tools"><button type="button" data-nav-test>▶ ลองเดินเส้นทางนี้</button><button type="button" data-nav-stop>หยุดทดสอบ</button><span class="hy-nav-legend">ฟ้า: ทางเดิน · แดง: ห้ามเดิน · ทอง: จุดเข้าถึง · ม่วง: จุดนั่ง</span></div>
      <p data-nav-status role="status">เพิ่มเส้นทางหรือเลือกโต๊ะ/โซฟา แล้วลากจุดได้เลย · ใช้ปุ่มบันทึกชั้นนี้เพื่อเก็บแบบ</p>`;
    this.svg=stage.ownerDocument.createElementNS('http://www.w3.org/2000/svg','svg');
    this.svg.classList.add('hy-nav-editor-map');this.svg.setAttribute('viewBox',`${bounds.minX} ${bounds.minY} ${bounds.maxX-bounds.minX} ${bounds.maxY-bounds.minY}`);this.svg.setAttribute('preserveAspectRatio','none');this.svg.setAttribute('aria-label','แก้ทางเดินบนพื้นสำนักงาน');stage.append(this.svg);
    const q=s=>root.querySelector(s);
    q('[data-nav-new-route]').onclick=()=>this.addRoute();q('[data-nav-new-area]').onclick=()=>this.addArea();
    q('[data-nav-target]').onchange=e=>{this.invalidateTest();this.onStop?.();this.target=e.target.value;this.selectedPoint=0;this.adding=false;this.draw();};
    q('[data-nav-add-point]').onclick=()=>{this.adding=!this.adding;this.status(this.adding?'คลิกบนพื้นเพื่อเพิ่มจุดถัดจากจุดที่เลือก':'ยกเลิกเพิ่มจุด');this.draw();};
    q('[data-nav-remove-point]').onclick=()=>this.removePoint();q('[data-nav-delete]').onclick=()=>this.removeTarget();
    for(const [selector,key,min,max]of [['[data-nav-x]','x',bounds.minX,bounds.maxX],['[data-nav-y]','y',bounds.minY,bounds.maxY]])q(selector).onchange=e=>{const value=Number(e.target.value);if(e.target.value===''||!Number.isFinite(value)||value<min||value>max){this.status(isLegacy?'พิกัดต้องเป็นตัวเลข 0–100%':'พิกัดอยู่นอกขอบเขตที่กำหนด');this.draw();return;}this.editPoint({...this.currentPoint(),[key]:value});};
    q('[data-nav-test]').onclick=async()=>{this.invalidateTest();this.onStop?.();const generation=this.testGeneration,target=this.target;this.status('กำลังทดสอบเส้นทางหรือจุดใช้งาน…');try{const result=await this.onTest?.(clone(this.points()),target);if(!this.testCurrent(generation,target))return;this.status(result?.message||'การลองเดินยังไม่พร้อม');}catch(error){if(this.testCurrent(generation,target))this.status(error?.message||'การลองเดินยังไม่พร้อม');}};
    q('[data-nav-stop]').onclick=()=>{this.invalidateTest();this.onStop?.();this.status('หยุดทดสอบแล้ว · แบบทางเดินคงเดิม');};
    this.svg.onpointermove=e=>this.dragMove(e);this.svg.onpointerup=e=>this.endDrag(e);this.svg.onpointercancel=()=>this.cancelDrag();this.svg.onlostpointercapture=()=>this.cancelDrag();
    this.svg.onclick=e=>{if(!this.adding||e.target!==this.surface)return;const p=this.screenPoint(e);if(!p)return;const next=clone(this.config),item=this.item(next);if(!item?.points)return;const limit=this.target.startsWith('route:')?32:24;if(item.points.length>=limit)return this.status(`สูงสุด ${limit} จุดต่อรายการ`);item.points.splice(this.selectedPoint+1,0,p);this.selectedPoint++;this.adding=false;this.commit(next);};
  }
  render(room,active){
    this.invalidateTest();this.cancelDrag();this.room=room;this.active=active&&room.background==='office';this.config=clone(room.navigation||empty());this.navigation=this.navigationFactory(room);
    this.root.hidden=!this.active;this.svg.hidden=!this.active;this.svg.toggleAttribute('hidden',!this.active);this.stage.classList.toggle('hy-nav-authoring',this.active);
    const options=[...this.config.routes.map((r,i)=>[`route:${r.id}`,`ทางเดิน ${i+1}`]),...this.config.forbidden.map((r,i)=>[`area:${r.id}`,`ห้ามเดิน ${i+1}`]),...room.objects.filter(o=>physical.has(o.kind)).map(o=>[`station:${o.id}`,`${o.asset?.name||names[o.kind]} · ${o.id}`])];
    const select=this.root.querySelector('[data-nav-target]');select.replaceChildren();
    if(!options.length){const o=this.root.ownerDocument.createElement('option');o.textContent='ยังไม่มีเส้นทาง';o.value='';select.append(o);}
    for(const [value,label]of options){const option=this.root.ownerDocument.createElement('option');option.value=value;option.textContent=label;select.append(option);}
    if(!options.some(([v])=>v===this.target))this.target=options[0]?.[0]||'';select.value=this.target;this.draw();
  }
  station(objectId){
    const authored=this.config.stations.find(s=>s.objectId===objectId);if(authored)return authored;
    const s=this.navigation.stations.find(s=>s.objectId===objectId);
    const object=this.room.objects.find(o=>o.id===objectId);if(!object)return null;
    if(!s)return {objectId,approach:{x:bounded(object.x-4,this.coordinateBounds.minX,this.coordinateBounds.maxX),y:bounded(object.y+4,this.coordinateBounds.minY,this.coordinateBounds.maxY)},...(object.kind==='team-sofa'?{seat:point(object)}:{})};
    return {objectId,approach:stationPiecePoint(this.room,objectId,s.position,0,true),...(s.seat?{seat:stationPiecePoint(this.room,objectId,s.seat,1,true,s.seatObjectId)}:s.type==='sofa'?{seat:point(object)}:{})};
  }
  item(config=this.config){const [type,...ids]=(this.target||'').split(':'),id=ids.join(':');return type==='route'?config.routes.find(r=>r.id===id):type==='area'?config.forbidden.find(r=>r.id===id):config.stations.find(s=>s.objectId===id);}
  points(){if(this.target?.startsWith('station:')){const s=this.station(this.target.slice(8));return s?[s.approach,...s.seat?[s.seat]:[]]:[];}return this.item()?.points||[];}
  currentPoint(){const points=this.points();return points[Math.min(this.selectedPoint,points.length-1)];}
  status(message){this.root.querySelector('[data-nav-status]').textContent=message;}
  invalidateTest(){this.testGeneration=(this.testGeneration||0)+1;return this.testGeneration;}
  testCurrent(generation,target){return generation===this.testGeneration&&target===this.target&&!!this.active;}
  commit(config){
    this.invalidateTest();this.onStop?.();try{const result=this.onChange?.(config);if(result===false)return false;this.status('แก้แบบทางเดินแล้ว · กดบันทึกชั้นนี้เพื่อใช้ใน Visual Office');return true;}
    catch(error){this.status(error.message||'ข้อมูลทางเดินไม่ถูกต้อง');this.draw();return false;}
  }
  addRoute(){
    if(this.config.routes.length>=16)return this.status('สูงสุด 16 เส้นทาง');
    const next=clone(this.config),id=this.uid('route');
    // Small doorway route is intentionally easy to extend by clicking the floor.
    const ends=this.room.blueprint?blueprintLayout(this.room.blueprintPlan||this.room.blueprint,this.blueprintOptions).testRoute:[{x:43,y:48},{x:32,y:56}];
    const points=this.navigation.suggestRoute?this.navigation.suggestRoute():this.navigation.findLocalPath(...ends);
    if(points.length<2)return this.status('ยังไม่มีทางเริ่มต้นที่ปลอดภัย · ย้ายเฟอร์นิเจอร์ให้เปิดทางก่อน');
    next.routes.push({id,points});this.target=`route:${id}`;this.selectedPoint=0;this.commit(next);
  }
  addArea(){
    if(this.config.forbidden.length>=16)return this.status('สูงสุด 16 พื้นที่ห้ามเดิน');const next=clone(this.config),id=this.uid('area');
    const plan=this.room.blueprintPlan||this.room.blueprint;
    next.forbidden.push({id,points:plan?[[.6,.6],[1.6,.6],[1.6,1.6],[.6,1.6]].map(([x,z])=>blueprintPoint(plan,x,z,this.blueprintOptions)):[{x:18,y:72},{x:25,y:72},{x:25,y:78},{x:18,y:78}]});this.target=`area:${id}`;this.selectedPoint=0;this.commit(next);
  }
  uid(prefix){return createLocalDesignId(prefix,new Set([...this.config.routes,...this.config.forbidden].map(item=>item.id)),60);}
  edited(config,index,p){
    if(this.target.startsWith('station:')){const id=this.target.slice(8);let s=config.stations.find(s=>s.objectId===id);if(!s){const base=this.station(id);if(!base)return false;s=clone(base);config.stations.push(s);}s[index===0?'approach':'seat']=point(p);}
    else{const item=this.item(config);if(!item?.points[index])return false;item.points[index]=point(p);}return true;
  }
  editPoint(p){if(!p)return;const next=clone(this.config);if(this.edited(next,this.selectedPoint,p))this.commit(next);}
  removePoint(){const next=clone(this.config),item=this.item(next);if(!item?.points)return;const min=this.target.startsWith('route:')?2:3;if(item.points.length<=min)return this.status(`ต้องเหลืออย่างน้อย ${min} จุด`);item.points.splice(this.selectedPoint,1);this.selectedPoint=Math.max(0,this.selectedPoint-1);this.commit(next);}
  removeTarget(){const next=clone(this.config),[type,id]=this.target.split(':');if(type==='route')next.routes=next.routes.filter(r=>r.id!==id);else if(type==='area')next.forbidden=next.forbidden.filter(r=>r.id!==id);else next.stations=next.stations.filter(s=>s.objectId!==id);this.target='';this.selectedPoint=0;this.commit(next);}
  screenPoint(e){const r=this.stage.getBoundingClientRect(),b=this.coordinateBounds;if(!r.width||!r.height)return null;const p=inverseAlignmentPoint({x:b.minX+(e.clientX-r.left)/r.width*(b.maxX-b.minX),y:b.minY+(e.clientY-r.top)/r.height*(b.maxY-b.minY)},skeletonAlignment(this.room));return {x:bounded(p.x,b.minX,b.maxX),y:bounded(p.y,b.minY,b.maxY)};}
  dragMove(e){if(!this.drag||e.pointerId!==this.drag.id)return;const r=this.stage.getBoundingClientRect(),b=this.coordinateBounds;if(!r.width||!r.height)return;const pieceScale=this.target?.startsWith('station:')?(stationPiece(this.room,this.target.slice(8),this.selectedPoint,this.navigation.stations.find(s=>s.objectId===this.target.slice(8))?.seatObjectId)?.alignment.scale||1):1;this.drag.next={x:bounded(this.drag.point.x+(e.clientX-this.drag.x)/r.width*(b.maxX-b.minX)/skeletonAlignment(this.room).scale/pieceScale,b.minX,b.maxX),y:bounded(this.drag.point.y+(e.clientY-this.drag.y)/r.height*(b.maxY-b.minY)/skeletonAlignment(this.room).scale/pieceScale,b.minY,b.maxY)};this.draw(this.drag.next);}
  endDrag(e){if(!this.drag||e.pointerId!==this.drag.id)return;const d=this.drag;this.drag=null;this.svg.releasePointerCapture?.(d.id);if(d.next)this.editPoint(d.next);}
  cancelDrag(){if(!this.drag)return;const d=this.drag;this.drag=null;if(this.svg.hasPointerCapture?.(d.id))this.svg.releasePointerCapture(d.id);if(this.room)this.draw();}
  draw(preview){
    if(!this.room)return;this.svg.replaceChildren();
    let drawingHost=this.svg;const add=(tag,attrs,host=drawingHost)=>{const el=this.svg.ownerDocument.createElementNS(this.svg.namespaceURI,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));host.append(el);return el;};
    const bounds=this.coordinateBounds;this.surface=add('rect',{x:bounds.minX,y:bounds.minY,width:bounds.maxX-bounds.minX,height:bounds.maxY-bounds.minY,fill:'transparent','pointer-events':'all'});drawingHost=add('g',{transform:alignmentSvgTransform(skeletonAlignment(this.room))});
    for(const zone of this.navigation.zones)add('polygon',{points:zone.polygon.map(p=>p.join(',')).join(' '),fill:'#83c2a018',stroke:'#4c9776','stroke-width':.16,'pointer-events':'none'});
    for(const blocker of this.navigation.blockers){if(!blocker.polygon)continue;add('polygon',{points:blocker.polygon.map(p=>p.join(',')).join(' '),fill:'#af7c6724',stroke:'#9f726155','stroke-width':.15,'pointer-events':'none'});}
    for(const [type,items]of [['route',this.config.routes],['area',this.config.forbidden]])for(const item of items){const selected=this.target===`${type}:${item.id}`,points=clone(item.points);if(selected&&preview)points[this.selectedPoint]=preview;add(type==='route'?'polyline':'polygon',{points:points.map(p=>`${p.x},${p.y}`).join(' '),fill:type==='area'?'#e2574a40':'none',stroke:type==='area'?'#bd493d':'#2589aa','stroke-width':selected?.55:.3,'pointer-events':'none'});}
    const points=clone(this.points());this.selectedPoint=Math.min(this.selectedPoint,Math.max(0,points.length-1));if(preview&&points.length)points[this.selectedPoint]=preview;
    const station=this.target?.startsWith('station:');const display=(p,i)=>station?stationPiecePoint(this.room,this.target.slice(8),p,i,false,this.navigation.stations.find(s=>s.objectId===this.target.slice(8))?.seatObjectId):p;
    if(station&&points.length>1)add('line',{x1:display(points[0],0).x,y1:display(points[0],0).y,x2:display(points[1],1).x,y2:display(points[1],1).y,stroke:'#a18dc3','stroke-width':.35,'stroke-dasharray':'1 .6','pointer-events':'none'});
    points.forEach((p,i)=>{
      const visible=display(p,i);const circle=add('circle',{cx:visible.x,cy:visible.y,r:i===this.selectedPoint?1.05:.85,fill:station?(i?'#9368bb':'#d99b35'):'#2589aa',stroke:'#fff','stroke-width':.3,tabindex:0,role:'button','aria-label':station?(i?'จุดนั่ง':'จุดเข้าถึง'):`จุดทางเดิน ${i+1}`,'data-nav-handle':i});
      circle.onpointerdown=e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();this.invalidateTest();this.onStop?.();this.selectedPoint=i;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,point:p};this.svg.setPointerCapture?.(e.pointerId);this.draw();};
      circle.onclick=e=>{e.stopPropagation();this.selectedPoint=i;this.draw();};
      circle.onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();this.selectedPoint=i;this.editPoint({x:bounded(p.x+delta[0]*(e.shiftKey?5:1),bounds.minX,bounds.maxX),y:bounded(p.y+delta[1]*(e.shiftKey?5:1),bounds.minY,bounds.maxY)});this.svg.querySelector(`[data-nav-handle="${i}"]`)?.focus();};
      const label=add('text',{x:visible.x+1.4,y:visible.y-.9,'font-size':1.3,fill:'#253f43','pointer-events':'none'});label.textContent=station?(i?'นั่ง':'เข้าถึง'):String(i+1);
    });
    const selected=points[this.selectedPoint];for(const [attr,key]of [['data-nav-x','x'],['data-nav-y','y']]){const input=this.root.querySelector(`[${attr}]`);input.value=selected?String(selected[key]):'';input.disabled=!selected;}
    const list=this.root.querySelector('.hy-nav-point-list');list.replaceChildren();points.forEach((p,i)=>{const b=this.root.ownerDocument.createElement('button');b.type='button';b.textContent=station?(i?'จุดนั่ง':'จุดเข้าถึง'):`จุด ${i+1}`;b.setAttribute('aria-pressed',String(i===this.selectedPoint));b.onclick=()=>{this.selectedPoint=i;this.draw();this.svg.querySelector(`[data-nav-handle="${i}"]`)?.focus();};list.append(b);});
    this.root.querySelector('[data-nav-add-point]').disabled=station||!this.target;this.root.querySelector('[data-nav-add-point]').setAttribute('aria-pressed',String(!!this.adding));this.root.querySelector('[data-nav-remove-point]').disabled=station||!points.length;
    this.root.querySelector('[data-nav-test]').disabled=!(this.target?.startsWith('route:')||(station&&this.stationTests));
    this.root.querySelector('[data-nav-test]').textContent=station&&this.stationTests?'▶ ลองใช้จุดนี้ใน 3D':'▶ ลองเดินเส้นทางนี้';
    if(station&&!this.config.stations.some(s=>s.objectId===this.target.slice(8))&&!this.navigation.stations.some(s=>s.objectId===this.target.slice(8)))this.status('ยังไม่มีจุดเข้าถึงที่ปลอดภัย · ลากจุดตั้งต้นไปยังพื้นที่เปิดเพื่อกำหนดจุดใหม่');
    if(this.navigation.issues?.length)this.status(this.navigation.issues.map(i=>`${i.objectId}: ${i.message}`).join(' · '));
  }
  dispose(){this.invalidateTest();this.cancelDrag();this.onStop?.();this.svg.remove();this.stage.classList.remove('hy-nav-authoring');this.root.replaceChildren();}
}
