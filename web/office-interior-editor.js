import {roomAreaTypes,validateBlueprintPlan} from './office-blueprint-state.js';
import {blueprintPoint} from './office-blueprints.js';
import {createOfficeNavigation} from './office-navigation.js';
import {createLocalDesignId} from './local-design-id.js';
// @req VO-FR-022 — interior partitions, connecting doors and room-area authoring.
// @tested tests/office-blueprint-editor.test.mjs, tests/office-partitions.test.mjs
const clone=v=>JSON.parse(JSON.stringify(v));
const snap=v=>Math.round(v*10)/10;
export class OfficeInteriorEditor{
  constructor(editor,root,onTest,onStop){
    this.editor=editor;this.root=root;this.onTest=onTest;this.onStop=onStop;
    root.innerHTML=`<fieldset><legend>แบ่งห้องภายใน</legend>
      <div class="hy-bp-buttons"><button type="button" class="hy-bp-select-interior">เลือก / ย้าย</button><button type="button" class="hy-bp-draw-wall">วาดผนังกั้น</button><button type="button" class="hy-bp-draw-area">วาดพื้นที่ห้อง</button><button type="button" class="hy-bp-delete-interior">ลบผนัง / พื้นที่ที่เลือก</button></div>
      <div class="hy-bp-fields"><label>ประเภทพื้นที่<select class="hy-bp-area-type">${Object.entries(roomAreaTypes).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label>ชื่อห้อง<input class="hy-bp-area-name" maxlength="60" placeholder="ชื่อพื้นที่"></label><button type="button" class="hy-bp-area-rename">ใช้ชื่อ / ประเภทกับห้องที่เลือก</button>
      <label>ประตู: ระยะจากต้นผนัง (ม.)<input class="hy-bp-inner-offset" type="number" min="0.2" step="0.1"></label><label>ประตู: ความกว้าง (ม.)<input class="hy-bp-inner-width" type="number" min="1.2" max="3" step="0.1"></label></div>
      <div class="hy-bp-buttons"><button type="button" class="hy-bp-add-inner-door">เพิ่มประตูเชื่อมห้อง</button><button type="button" class="hy-bp-remove-inner-door">ลบช่องประตู</button><button type="button" class="hy-bp-test-rooms">ลองเดินเชื่อมห้อง</button><button type="button" class="hy-bp-stop-rooms">หยุดลองเดิน</button></div>
      <p class="hy-bp-interior-help" role="status">ลากบนแปลนเพื่อวาด · ผนังตรงตามแกน · 0.1 ม. · จุดเขียวลากทั้งแนว จุดปลายปรับความยาว · จุดฟ้าลากประตู · Escape ยกเลิก</p>
      <small>พื้นที่สีเป็นป้ายแบ่งการใช้งาน ต้องวาดผนังและประตูเพื่อกั้นห้องจริง · ผนังภายในแสดงสูง 1.2 ม. แบบ cutaway เพื่อเห็นตัวละคร</small></fieldset>`;
    const q=s=>root.querySelector(s);
    for(const [selector,mode]of [['.hy-bp-select-interior','select'],['.hy-bp-draw-wall','wall'],['.hy-bp-draw-area','area']])q(selector).onclick=()=>{editor.cancelDrag();this.mode=mode;this.controls();editor.status(mode==='select'?'เลือกจุดบนแปลนเพื่อย้าย':`ลากบนพื้นที่ว่างในแปลนเพื่อวาด${mode==='wall'?'ผนังกั้น':'พื้นที่ห้อง'}`);};
    q('.hy-bp-delete-interior').onclick=()=>editor.attempt(()=>{const p=clone(editor.plan),selected=this.selected(p);if(selected)p[selected.kind]=p[selected.kind].filter(item=>item.id!==selected.item.id);editor.target='wall:right';return p;});
    q('.hy-bp-add-inner-door').onclick=()=>editor.attempt(()=>{const p=clone(editor.plan),w=this.selected(p)?.item;if(!w||!('axis'in w))throw Error('เลือกผนังกั้นก่อน');const width=Math.min(1.4,snap(w.end-w.start-.4));w.door={offset:snap((w.end-w.start-width)/2),width};return p;});
    q('.hy-bp-remove-inner-door').onclick=()=>editor.attempt(()=>{const p=clone(editor.plan),w=this.selected(p)?.item;if(w)delete w.door;return p;});
    for(const [selector,key]of [['.hy-bp-inner-offset','offset'],['.hy-bp-inner-width','width']])q(selector).onchange=e=>editor.attempt(()=>{const p=clone(editor.plan);this.selected(p).item.door[key]=Number(e.target.value);return p;});
    q('.hy-bp-area-rename').onclick=()=>editor.attempt(()=>{const p=clone(editor.plan),area=this.selected(p);if(area?.kind!=='areas')throw Error('เลือกพื้นที่ห้องก่อน');area.item.type=q('.hy-bp-area-type').value;area.item.name=q('.hy-bp-area-name').value.trim()||roomAreaTypes[area.item.type];return p;});
    q('.hy-bp-test-rooms').onclick=()=>this.testConnections();
    q('.hy-bp-stop-rooms').onclick=()=>{this.onStop?.();editor.status('หยุดลองเดินแล้ว · คืนตัวละครไปตำแหน่งเดิม');};
  }
  selected(plan=this.editor.plan){const [kind,id]=this.editor.target.split(':');const key=kind==='partition'?'partitions':kind==='area'?'areas':null;const item=key&&plan[key]?.find(item=>item.id===id);return item?{kind:key,item}:null;}
  controls(){
    const q=s=>this.root.querySelector(s),s=this.selected(),wall=s?.kind==='partitions'?s.item:null,area=s?.kind==='areas'?s.item:null;
    q('.hy-bp-delete-interior').disabled=!s;q('.hy-bp-add-inner-door').disabled=!wall||!!wall.door||wall.end-wall.start<1.6-1e-8;q('.hy-bp-add-inner-door').title='ผนังต้องยาวอย่างน้อย 1.6 ม. สำหรับช่องประตู';q('.hy-bp-remove-inner-door').disabled=!wall?.door;
    for(const [selector,key]of [['.hy-bp-inner-offset','offset'],['.hy-bp-inner-width','width']]){q(selector).disabled=!wall?.door;q(selector).value=wall?.door?.[key]??'';}
    q('.hy-bp-area-rename').disabled=!area;
    if(area&&(!this.mode||this.mode==='select')){q('.hy-bp-area-type').value=area.type;q('.hy-bp-area-name').value=area.name;}
    for(const [selector,mode]of [['.hy-bp-select-interior','select'],['.hy-bp-draw-wall','wall'],['.hy-bp-draw-area','area']])q(selector).setAttribute('aria-pressed',String((this.mode||'select')===mode));
  }
  options(){return [...(this.editor.plan.partitions||[]).map((w,i)=>[`partition:${w.id}:move`,`ผนังกั้น ${i+1} · ${(w.end-w.start).toFixed(1)} ม.`]),...(this.editor.plan.areas||[]).map(a=>[`area:${a.id}:move`,`${a.name} · ${roomAreaTypes[a.type]}`])];}
  draw(plan,add){
    for(const w of plan.partitions||[]){
      const point=u=>w.axis==='x'?[u,w.at]:[w.at,u];
      add(`partition:${w.id}:move`,...point((w.start+w.end)/2),'ย้ายผนังกั้น','#90c693');
      add(`partition:${w.id}:start`,...point(w.start),'ปรับต้นผนังกั้น','#a9d7ab');add(`partition:${w.id}:end`,...point(w.end),'ปรับปลายผนังกั้น','#a9d7ab');
      if(w.door)add(`partition:${w.id}:door`,...point(w.start+w.door.offset+w.door.width/2),'ย้ายประตูเชื่อมห้อง','#55dcff');
    }
    for(const a of plan.areas||[])add(`area:${a.id}:move`,a.x+a.width/2,a.z+a.depth/2,`ย้ายพื้นที่ ${a.name}`,'#edc77a');
  }
  isTarget(){return /^(partition|area):/.test(this.editor.target);}
  begin(e,metrics,point){
    if(!['wall','area'].includes(this.mode))return null;
    const p=this.editor.plan;if(point.x<-.25||point.z<-.25||point.x>p.width+.25||point.z>p.depth+.25)return null;
    point={x:Math.max(0,Math.min(p.width,point.x)),z:Math.max(0,Math.min(p.depth,point.z))};
    const identityKind=this.mode==='wall'?'partition':'area',existing=this.mode==='wall'?p.partitions||[]:p.areas||[];
    return {kind:this.mode,itemId:createLocalDesignId(identityKind,new Set(existing.map(item=>item.id)),40),pointerId:e.pointerId,initial:clone(p),start:{x:snap(point.x),z:snap(point.z)},metrics,last:null,
      areaType:this.root.querySelector('.hy-bp-area-type').value,areaName:this.root.querySelector('.hy-bp-area-name').value.trim()};
  }
  transform(d,p){
    if(d.kind)p={x:Math.max(0,Math.min(d.initial.width,p.x)),z:Math.max(0,Math.min(d.initial.depth,p.z))};
    const plan=clone(d.initial),dx=snap(p.x-d.start.x),dz=snap(p.z-d.start.z);
    if(d.kind==='wall'){
      const axis=Math.abs(dx)>=Math.abs(dz)?'x':'z',s=axis==='x'?d.start.x:d.start.z,e=s+(axis==='x'?dx:dz);
      const items=plan.partitions||=[];const id=d.itemId;items.push({id,axis,at:axis==='x'?d.start.z:d.start.x,start:Math.min(s,e),end:Math.max(s,e)});d.target=`partition:${id}:move`;
    }else if(d.kind==='area'){
      const items=plan.areas||=[],id=d.itemId;items.push({id,type:d.areaType,name:d.areaName||roomAreaTypes[d.areaType],x:Math.min(d.start.x,snap(p.x)),z:Math.min(d.start.z,snap(p.z)),width:Math.abs(dx),depth:Math.abs(dz)});d.target=`area:${id}:move`;
    }else{
      const selected=this.selected(plan),item=selected.item,part=this.editor.target.split(':')[2];
      if(selected.kind==='areas'){item.x=snap(item.x+dx);item.z=snap(item.z+dz);}
      else{
        const along=item.axis==='x'?dx:dz,across=item.axis==='x'?dz:dx;
        if(part==='move'){item.at=snap(item.at+across);item.start=snap(item.start+along);item.end=snap(item.end+along);}
        else if(part==='door')item.door.offset=snap(item.door.offset+along);
        else item[part]=snap(item[part]+along);
      }
    }
    return validateBlueprintPlan(plan,this.editor.blueprintOptions);
  }
  key(e){
    const d={initial:clone(this.editor.plan),start:{x:0,z:0}},delta=e.shiftKey?1:.1;
    return this.transform(d,{x:e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0,z:e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0});
  }
  testConnections(){
    this.onStop?.();
    const {plan,room}=this.editor,nav=(this.editor.navigationFactory||createOfficeNavigation)({...room,blueprintPlan:plan}),areas=plan.areas||[];
    if(areas.length<2)return this.editor.status('วาดพื้นที่อย่างน้อย 2 ห้องเพื่อลองเดินเชื่อมกัน');
    const anchor=area=>{
      const cx=area.x+area.width/2,cz=area.z+area.depth/2,candidates=[{x:cx,z:cz}];
      for(let x=area.x+.25;x<area.x+area.width-.1;x+=.4)for(let z=area.z+.25;z<area.z+area.depth-.1;z+=.4)candidates.push({x,z});
      candidates.sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz));
      return candidates.map(p=>blueprintPoint(plan,p.x,p.z,this.editor.blueprintOptions)).find(p=>nav.isWalkable(p));
    };
    const anchors=areas.map(anchor);if(anchors.some(p=>!p))return this.editor.status('บางห้องไม่มีพื้นที่ยืนว่าง · ย้ายเฟอร์นิเจอร์หรือปรับพื้นที่ห้อง');
    let points=[];
    for(let i=1;i<areas.length;i++){
      const path=nav.findLocalPath(anchors[i-1],anchors[i]);
      if(!path.length)return this.editor.status(`ไป ${areas[i].name} ไม่ได้ · ตรวจประตู ผนัง เฟอร์นิเจอร์ และพื้นที่ห้ามเดิน`);
      points.push(...(i===1?path:path.slice(1)));
    }
    if(points.length<2)return this.editor.status('พื้นที่ห้องทับกัน · ย้ายพื้นที่ให้มีจุดหมายต่างกันก่อนลองเดิน');
    const result=this.onTest?.(points,message=>this.editor.status(message));this.editor.status(result?.message||'เส้นทางเชื่อมห้องพร้อม · เปิดฉาก 3D เพื่อลองเดิน');
  }
}
