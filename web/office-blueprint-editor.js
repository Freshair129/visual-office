import {defaultBlueprintPlan,validateBlueprintPlan,moveBlueprintWall,moveBlueprintOpening,wallNames,wallLength,BlueprintTemplateStore,toggleBlueprintDoor} from './office-blueprint-state.js';
import {blueprintSVG,blueprintLocalPoint} from './office-blueprints.js';
import {officeObjectFootprint} from './office-navigation.js';
import {OfficeInteriorEditor} from './office-interior-editor.js';
import {createLocalDesignId} from './local-design-id.js';
import {blueprintLimits} from './office-design-limits.js';
// @req VO-FR-022 — wall/opening authoring, transient previews and explicit template saves.
// @tested tests/office-blueprint-editor.test.mjs

const clone=v=>JSON.parse(JSON.stringify(v));
const snap=n=>Math.round(n*10)/10;
const labels={door:'ประตู',...wallNames};
export class OfficeBlueprintEditor{
  constructor(root,{surface,onCommit,onPreview,onTest,onStop,onToggleDoor,storage,navigationFactory,footprint=officeObjectFootprint,blueprintOptions={}}={}){
    this.blueprintOptions=Object.freeze({...blueprintOptions});this.validate=plan=>validateBlueprintPlan(plan,this.blueprintOptions);const limits=blueprintLimits(this.blueprintOptions);
    this.navigationFactory=navigationFactory;this.footprint=footprint;this.customFootprint=footprint!==officeObjectFootprint;
    this.root=root;this.surface=surface;this.onCommit=onCommit;this.onPreview=onPreview;this.storage=storage;this.target='wall:right';
    root.innerHTML=`<div class="hy-bp-fields"><label>กว้าง (ม.)<input class="hy-bp-width" type="number" min="8" max="16" step="0.1"></label><label>ลึก (ม.)<input class="hy-bp-depth" type="number" min="6" max="10" step="0.1"></label>
      <label>กำลังแก้<select class="hy-bp-target"></select></label><label>ผนังที่ติดตั้ง<select class="hy-bp-wall">${Object.entries(wallNames).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label>
      <label>ระยะจากมุม (ม.)<input class="hy-bp-offset" type="number" min="0.2" max="16" step="0.1"></label><label>กว้างช่องเปิด (ม.)<input class="hy-bp-opening-width" type="number" min="0.6" max="3" step="0.1"></label></div>
      <div class="hy-bp-buttons"><button type="button" class="hy-bp-add-window">เพิ่มหน้าต่าง</button><button type="button" class="hy-bp-remove-window">ลบหน้าต่างที่เลือก</button><button type="button" class="hy-bp-toggle-door">เปิด / ปิดประตูที่เลือก</button></div>
      <p>ลากจุดสีส้มเพื่อย้ายผนัง · จุดฟ้า/ม่วงสำหรับประตูและหน้าต่าง · Snap 0.1 ม. · ลูกศรขยับได้ (Shift = 1 ม.) · ปล่อยเมาส์เพื่อบันทึกหนึ่ง Undo</p>
      <div class="hy-bp-interior"></div><p class="hy-bp-edit-status" role="status"></p><p class="hy-bp-warning" role="status"></p>
      <div class="hy-bp-template-fields"><label>ชื่อเทมเพลต<input class="hy-bp-template-name" maxlength="80" placeholder="เช่น ทีมโปรเจกต์ 13 × 8 ม."></label><button type="button" class="hy-bp-template-save">บันทึกเป็นเทมเพลต</button><label>เทมเพลตของฉัน<select class="hy-bp-template-list"></select></label><button type="button" class="hy-bp-template-load">ใช้เทมเพลตกับแบบร่าง</button></div>`;
    const q=s=>root.querySelector(s);
    q('.hy-bp-width').max=String(limits.maxWidth);q('.hy-bp-depth').max=String(limits.maxDepth);q('.hy-bp-offset').max=String(limits.maxOffset);
    this.interior=new OfficeInteriorEditor(this,q('.hy-bp-interior'),onTest,onStop);
    q('.hy-bp-toggle-door').onclick=()=>{const id=this.target==='door'?'entry':this.interior.selected()?.item.door?`partition:${this.interior.selected().item.id}`:null;if(!id)return;if(onToggleDoor){const result=onToggleDoor(id);this.status(result?.message||'เปลี่ยนสถานะประตูแล้ว');}else this.attempt(()=>toggleBlueprintDoor(this.plan,id,this.blueprintOptions));};
    q('.hy-bp-width').onchange=e=>this.attempt(()=>moveBlueprintWall(this.plan,'right',Number(e.target.value)-this.plan.width,this.blueprintOptions));
    q('.hy-bp-depth').onchange=e=>this.attempt(()=>moveBlueprintWall(this.plan,'front',Number(e.target.value)-this.plan.depth,this.blueprintOptions));
    q('.hy-bp-target').onchange=e=>{this.target=e.target.value;this.drawControls();this.draw();};
    q('.hy-bp-wall').onchange=e=>this.attempt(()=>{const o=this.opening();return moveBlueprintOpening(this.plan,this.openingId(),e.target.value,Math.min(o.offset,wallLength(this.plan,e.target.value)-o.width-.2),this.blueprintOptions);});
    q('.hy-bp-offset').onchange=e=>this.attempt(()=>moveBlueprintOpening(this.plan,this.openingId(),this.opening().wall,Number(e.target.value),this.blueprintOptions));
    q('.hy-bp-opening-width').onchange=e=>this.attempt(()=>{const p=clone(this.plan);this.opening(p).width=Number(e.target.value);return this.validate(p);});
    q('.hy-bp-add-window').onclick=()=>this.addWindow();
    q('.hy-bp-remove-window').onclick=()=>this.attempt(()=>{const p=clone(this.plan);p.windows=p.windows.filter(w=>`window:${w.id}`!==this.target);this.target='door';return p;});
    q('.hy-bp-template-save').onclick=()=>{
      const store=new BlueprintTemplateStore(this.storage,this.blueprintOptions),result=store.save(q('.hy-bp-template-name').value,this.plan);
      if(!result.ok)return this.status(result.message);this.templates();q('.hy-bp-template-list').value=result.id;this.status('บันทึกเทมเพลตแล้ว · ยังไม่บันทึกทับชั้น');
    };
    q('.hy-bp-template-load').onclick=()=>{const item=new BlueprintTemplateStore(this.storage,this.blueprintOptions).items.find(i=>i.id===q('.hy-bp-template-list').value);if(item)this.attempt(()=>item.plan);};
    surface.onpointerdown=e=>this.startDrag(e);surface.onpointermove=e=>this.dragMove(e);surface.onpointerup=e=>this.endDrag(e);
    surface.onpointercancel=()=>this.cancelDrag();surface.onlostpointercapture=()=>this.cancelDrag();surface.onkeydown=e=>this.key(e);
    this.escape=e=>{if(e.key==='Escape'&&this.drag){e.preventDefault();this.cancelDrag();this.status('ยกเลิกการลากแล้ว · แบบร่างยังไม่เปลี่ยน');}};surface.ownerDocument.addEventListener('keydown',this.escape);
  }
  status(message){this.root.querySelector('.hy-bp-edit-status').textContent=message;}
  openingId(){return this.target==='door'?'door':this.target.slice(7);}
  opening(plan=this.plan){return this.target==='door'?plan.door:this.target.startsWith('window:')?plan.windows.find(w=>w.id===this.openingId()):null;}
  render(room,active){
    this.cancelDrag();this.room=room;this.active=active&&!!room.blueprint;this.root.hidden=!this.active;this.surface.classList.toggle('hy-bp-authoring',this.active);
    if(!this.active)return;this.plan=room.blueprintPlan?this.validate(room.blueprintPlan):defaultBlueprintPlan(room.blueprint);
    if(this.target.startsWith('window:')&&!this.opening()||this.interior.isTarget()&&!this.interior.selected())this.target='door';this.drawControls();this.draw();this.templates();
  }
  templates(){
    const select=this.root.querySelector('.hy-bp-template-list'),selected=select.value;select.replaceChildren();
    const items=new BlueprintTemplateStore(this.storage,this.blueprintOptions).items;
    if(!items.length){const option=select.ownerDocument.createElement('option');option.textContent='ยังไม่มีเทมเพลตที่บันทึก';option.value='';select.append(option);}
    for(const item of items){const option=select.ownerDocument.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}
    if(items.some(i=>i.id===selected))select.value=selected;this.root.querySelector('.hy-bp-template-load').disabled=!items.length;
  }
  drawControls(){
    const q=s=>this.root.querySelector(s),select=q('.hy-bp-target');select.replaceChildren();
    for(const [id,name]of [...Object.entries(wallNames).map(([id,name])=>[`wall:${id}`,name]),['door','ประตู'],...this.plan.windows.map((w,i)=>[`window:${w.id}`,`หน้าต่าง ${i+1}`]),...this.interior.options()]){
      const option=select.ownerDocument.createElement('option');option.value=id;option.textContent=name;select.append(option);
    }
    select.value=this.target;q('.hy-bp-width').value=this.plan.width;q('.hy-bp-depth').value=this.plan.depth;
    const opening=this.opening();for(const s of ['.hy-bp-wall','.hy-bp-offset','.hy-bp-opening-width'])q(s).disabled=!opening;
    q('.hy-bp-remove-window').disabled=!this.target.startsWith('window:');
    if(opening){q('.hy-bp-wall').value=opening.wall;q('.hy-bp-offset').value=opening.offset;q('.hy-bp-opening-width').value=opening.width;q('.hy-bp-opening-width').min=this.target==='door'?'1.2':'.6';}
    const outside=this.room.objects.filter(o=>this.footprint(o).some(point=>{const p=blueprintLocalPoint(this.plan,point,this.blueprintOptions);return p.x<-.00001||p.z<-.00001||p.x>this.plan.width+.00001||p.z>this.plan.depth+.00001;})).length;
    q('.hy-bp-warning').textContent=outside?`มี ${outside} ชิ้นอยู่นอกขอบห้อง · ตำแหน่งเดิมยังอยู่ ให้จัดวางก่อนใช้งาน`:'';
    this.interior.controls();
    const door=this.target==='door'?this.plan.door:this.interior.selected()?.kind==='partitions'?this.interior.selected().item.door:null;
    q('.hy-bp-toggle-door').disabled=!door;q('.hy-bp-toggle-door').textContent=door?`${door.open===false?'เปิด':'ปิด'}ประตูที่เลือก · ตอนนี้${door.open===false?'ปิด':'เปิด'}`:'เปิด / ปิดประตูที่เลือก';
  }
  draw(plan=this.plan){
    if(!this.active)return;
    this.surface.innerHTML=blueprintSVG(plan.base,{...this.room,objects:this.customFootprint?[]:this.room.objects,blueprint:plan.base,blueprintPlan:plan},this.blueprintOptions);
    const svg=this.surface.querySelector('svg'),host=svg.querySelector('g'),doc=svg.ownerDocument;
    if(this.customFootprint)for(const object of this.room.objects){const shape=doc.createElementNS(svg.namespaceURI,'polygon');shape.setAttribute('points',this.footprint(object).map(p=>{const q=blueprintLocalPoint(plan,p,this.blueprintOptions);return `${q.x*48},${q.z*48}`;}).join(' '));shape.setAttribute('fill','#b88b5644');shape.setAttribute('stroke','#a88352');const title=doc.createElementNS(svg.namespaceURI,'title');title.textContent=object.id;shape.append(title);host.append(shape);}
    const add=(target,x,z,label,color)=>{
      const c=doc.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',x*48);c.setAttribute('cy',z*48);c.setAttribute('r','8');c.setAttribute('fill',color);c.setAttribute('stroke','#fff');c.setAttribute('stroke-width',target===this.target?'3':'1.5');c.setAttribute('tabindex','0');c.setAttribute('role','button');c.setAttribute('aria-label',label);c.dataset.bpHandle=target;host.append(c);
    };
    add('wall:rear',plan.width/2,0,'ลากผนังหลัง','#f5ad4e');add('wall:front',plan.width/2,plan.depth,'ลากผนังหน้า','#f5ad4e');add('wall:left',0,plan.depth/2,'ลากผนังซ้าย','#f5ad4e');add('wall:right',plan.width,plan.depth/2,'ลากผนังขวา','#f5ad4e');
    const openingHandle=(target,o,label,color)=>{const horizontal=['rear','front'].includes(o.wall),u=o.offset+o.width/2;add(target,horizontal?u:o.wall==='left'?0:plan.width,horizontal?o.wall==='rear'?0:plan.depth:u,label,color);};
    openingHandle('door',plan.door,'ลากประตู','#55dcff');for(let i=0;i<plan.windows.length;i++)openingHandle(`window:${plan.windows[i].id}`,plan.windows[i],`ลากหน้าต่าง ${i+1}`,'#ce9bff');
    this.interior.draw(plan,add);
  }
  attempt(make){
    if(!this.active)return false;
    try{const p=this.validate(make());this.onCommit?.(p);this.status('แก้แปลนในแบบร่างแล้ว · กดบันทึกชั้นนี้เพื่อใช้จริง');return true;}
    catch(e){this.status(e.message);this.drawControls();return false;}
  }
  addWindow(){
    if(this.plan.windows.length>=8)return this.status('หน้าต่างสูงสุด 8 บาน');
    const id=createLocalDesignId('window',new Set(this.plan.windows.map(window=>window.id)),40);
    for(const wall of ['rear','left','right','front'])for(let offset=.5;offset<wallLength(this.plan,wall)-1.7;offset+=.5){
      const p=clone(this.plan);p.windows.push({id,wall,offset,width:1.2,sill:1,top:2.2});
      try{this.validate(p);this.target=`window:${id}`;this.attempt(()=>p);return;}catch{/* Try another free span. */}
    }
    this.status('ไม่มีช่วงผนังว่างสำหรับหน้าต่างเพิ่ม');
  }
  screenPoint(e,metrics){
    const svg=this.surface.querySelector('svg'),r=metrics||svg.getBoundingClientRect();
    const view=metrics?.view||[this.plan.width*48+104,this.plan.depth*48+169],scale=Math.min(r.width/view[0],r.height/view[1]);
    return {x:((e.clientX-r.left-(r.width-view[0]*scale)/2)/scale-52)/48,z:((e.clientY-r.top-(r.height-view[1]*scale)/2)/scale-52)/48};
  }
  startDrag(e){
    const handle=e.target.closest?.('[data-bp-handle]');if(!this.active||e.button!==0)return;
    const r=this.surface.querySelector('svg').getBoundingClientRect();
    const metrics={left:r.left,top:r.top,width:r.width,height:r.height,view:[this.plan.width*48+104,this.plan.depth*48+169]};
    const drawing=this.interior.begin(e,metrics,this.screenPoint(e,metrics));
    if(drawing){e.preventDefault();this.drag=drawing;this.surface.setPointerCapture?.(e.pointerId);return;}
    if(['wall','area'].includes(this.interior.mode))return;
    if(!handle)return;e.preventDefault();this.target=handle.dataset.bpHandle;this.drawControls();
    this.drag={pointerId:e.pointerId,initial:clone(this.plan),start:this.screenPoint(e,metrics),metrics,last:null};this.surface.setPointerCapture?.(e.pointerId);
  }
  dragMove(e){
    if(!this.drag||this.drag.pointerId!==e.pointerId)return;e.preventDefault();
    const d=this.drag,p=this.screenPoint(e,d.metrics);
    try{
      let next;if(d.kind||this.interior.isTarget())next=this.interior.transform(d,p);
      else if(this.target.startsWith('wall:')){const wall=this.target.slice(5),delta=['left','right'].includes(wall)?p.x-d.start.x:p.z-d.start.z;next=moveBlueprintWall(d.initial,wall,snap(delta),this.blueprintOptions);}
      else{const o=this.opening(d.initial),wall=Object.entries({rear:Math.abs(p.z),front:Math.abs(p.z-d.initial.depth),left:Math.abs(p.x),right:Math.abs(p.x-d.initial.width)}).sort((a,b)=>a[1]-b[1])[0][0];
        const u=['rear','front'].includes(wall)?p.x:p.z,offset=Math.max(.2,Math.min(wallLength(d.initial,wall)-o.width-.2,snap(u-o.width/2)));next=moveBlueprintOpening(d.initial,this.openingId(),wall,offset,this.blueprintOptions);}
      d.last=next;this.onPreview?.(next);this.draw(next);this.status(`พรีวิว ${next.width.toFixed(1)} × ${next.depth.toFixed(1)} ม. · ปล่อยเพื่อยืนยัน`);
    }catch(error){this.status(error.message);}
  }
  endDrag(e){
    const d=this.drag;if(!d||e.pointerId!==d.pointerId)return;this.drag=null;if(this.surface.hasPointerCapture?.(d.pointerId))this.surface.releasePointerCapture(d.pointerId);
    if(d.last&&JSON.stringify(d.last)!==JSON.stringify(d.initial)){if(d.target)this.target=d.target;this.interior.mode='select';if(!this.attempt(()=>d.last))this.onPreview?.(null);}else{this.onPreview?.(null);this.draw();}
  }
  cancelDrag(){if(!this.drag)return;const d=this.drag;this.drag=null;if(this.surface.hasPointerCapture?.(d.pointerId))this.surface.releasePointerCapture(d.pointerId);this.onPreview?.(null);if(this.plan)this.draw();}
  key(e){
    const handle=e.target.closest?.('[data-bp-handle]');if(!this.active||!handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();this.target=handle.dataset.bpHandle;const delta=(e.shiftKey?1:.1)*(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1);
    if(this.interior.isTarget())this.attempt(()=>this.interior.key(e));
    else if(this.target.startsWith('wall:'))this.attempt(()=>moveBlueprintWall(this.plan,this.target.slice(5),delta,this.blueprintOptions));
    else this.attempt(()=>moveBlueprintOpening(this.plan,this.openingId(),this.opening().wall,snap(this.opening().offset+delta),this.blueprintOptions));
    this.surface.querySelector(`[data-bp-handle="${this.target}"]`)?.focus();
  }
  dispose(){this.cancelDrag();this.surface.ownerDocument.removeEventListener('keydown',this.escape);for(const name of ['onpointerdown','onpointermove','onpointerup','onpointercancel','onlostpointercapture','onkeydown'])this.surface[name]=null;}
}
