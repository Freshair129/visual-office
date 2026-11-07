import {officeBlueprints,blueprintSVG,applyOfficeBlueprint} from './office-blueprints.js';
import {OfficeBlueprintEditor} from './office-blueprint-editor.js';
import {resolveOfficeBlueprint,BlueprintTemplateStore} from './office-blueprint-state.js';

// RoomHistory and RoomStore remain the owners of draft/save.
export class OfficeBlueprintPanel{
  constructor(root,{onApply,onPlan,onPreview,onTest,onStop,onToggleDoor,onEditStart,storage,canApply=()=>true}={}){
    this.root=root;this.onApply=onApply;this.canApply=canApply;this.selected='medium';
    this.storage=storage;
    root.innerHTML=`<details class="hy-blueprints" open><summary>BLUEPRINTS · แม่แบบแปลนสำนักงาน</summary>
      <p>แปลนมุมบนและโครง Three.js ใช้ขนาดเดียวกัน · กริด 1 เมตร · 100 design px / เมตร</p>
      <div class="hy-blueprint-cards">${Object.values(officeBlueprints).map(b=>`<button type="button" data-blueprint="${b.id}" aria-pressed="false">${blueprintSVG(b.id)}<strong>${b.label}</strong><span>${b.width} × ${b.depth} ม. · ${b.width*b.depth} ตร.ม.</span><small>${b.columns*b.rows} ชุดโต๊ะตัวอย่าง · ไม่ใช่จำนวน agent</small></button>`).join('')}</div>
      <div class="hy-blueprint-heading"><strong class="hy-blueprint-title"></strong><span class="hy-blueprint-source" role="status"></span></div>
      <div class="hy-blueprint-template-library"><label>นำแปลนที่บันทึกมาใช้<select class="hy-blueprint-saved-select"></select></label><button type="button" class="hy-blueprint-load-saved">ใช้แปลนที่บันทึกกับชั้นนี้</button><small>เปลี่ยนเฉพาะโครงห้อง · เก็บเฟอร์นิเจอร์และตัวละครเดิม · ยังไม่บันทึกชั้น</small></div>
      <button type="button" class="hy-blueprint-edit" aria-pressed="false">แก้ผนัง / ประตูหน้าต่าง</button>
      <section class="hy-blueprint-editor-controls" aria-label="แก้ไขโครงบลูพริ้นต์" hidden></section><div class="hy-blueprint-plan"></div>
      <div class="hy-blueprint-actions"><button type="button" class="hy-blueprint-apply">ใช้แม่แบบกับแบบร่างชั้นนี้</button><button type="button" class="hy-blueprint-svg">ดาวน์โหลดแปลน SVG</button><button type="button" class="hy-blueprint-json">ดาวน์โหลดห้อง JSON</button></div>
      <small>ใช้แม่แบบจะแทนผัง เฟอร์นิเจอร์และทางเดินในแบบร่าง · เก็บตัวละครเดิม · Undo ได้ · กดบันทึกชั้นนี้เพื่อใช้จริง</small>
      <p class="hy-blueprint-feedback" role="status"></p></details>`;
    this.editor=new OfficeBlueprintEditor(root.querySelector('.hy-blueprint-editor-controls'),{surface:root.querySelector('.hy-blueprint-plan'),onCommit:onPlan,onPreview,onTest,onStop,onToggleDoor,storage});
    root.querySelector('.hy-blueprint-load-saved').onclick=()=>{
      if(!this.canApply())return;const item=new BlueprintTemplateStore(storage).items.find(i=>i.id===root.querySelector('.hy-blueprint-saved-select').value);
      if(item){this.editing=true;onEditStart?.();onPlan?.(item.plan);}
    };
    root.querySelector('.hy-blueprint-edit').onclick=()=>{this.editing=!this.editing;if(this.editing)onEditStart?.();this.draw();};
    root.querySelectorAll('[data-blueprint]').forEach(button=>button.onclick=()=>{this.selected=button.dataset.blueprint;this.draw();});
    root.querySelector('.hy-blueprint-apply').onclick=()=>{try{this.onApply?.(applyOfficeBlueprint(this.room,this.selected));}catch(error){root.querySelector('.hy-blueprint-feedback').textContent=error.message;}};
    root.querySelector('.hy-blueprint-svg').onclick=()=>this.download(blueprintSVG(this.selected,this.planRoom()),'image/svg+xml','svg');
    root.querySelector('.hy-blueprint-json').onclick=()=>this.download(JSON.stringify(this.planRoom(),null,2),'application/json','json');
  }
  planRoom(){return this.room.blueprint===this.selected?this.room:applyOfficeBlueprint({...this.room,objects:[]},this.selected);}
  render(room){if(room.blueprint!==this.room?.blueprint&&officeBlueprints[room.blueprint])this.selected=room.blueprint;this.room=room;this.draw();}
  draw(){
    if(!this.room)return;
    const apply=this.root.querySelector('.hy-blueprint-apply');apply.disabled=!this.canApply();apply.textContent=this.canApply()?'ใช้แม่แบบกับแบบร่างชั้นนี้':'เลือกชั้นแผนกก่อน · ล็อบบี้ใช้ฉากเดิม';
    const current=this.room.background==='office'&&this.room.blueprint===this.selected;
    const b=resolveOfficeBlueprint(current?(this.room.blueprintPlan||this.selected):this.selected);
    const library=this.root.querySelector('.hy-blueprint-template-library'),saved=this.root.querySelector('.hy-blueprint-saved-select'),old=saved.value,items=new BlueprintTemplateStore(this.storage).items;
    library.hidden=current;saved.replaceChildren();
    for(const item of items){const option=saved.ownerDocument.createElement('option');option.value=item.id;option.textContent=item.name;saved.append(option);}
    if(items.some(i=>i.id===old))saved.value=old;
    this.root.querySelector('.hy-blueprint-load-saved').disabled=!this.canApply()||!items.length;
    this.root.querySelectorAll('[data-blueprint]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.blueprint===b.id)));
    this.root.querySelector('.hy-blueprint-title').textContent=`${b.label} · ${b.width} × ${b.depth} ม. · ${b.width*b.depth} ตร.ม.`;
    this.root.querySelector('.hy-blueprint-source').textContent=current?'ตำแหน่งจริงจากแบบร่างชั้นนี้':'พรีวิวแม่แบบ · ยังไม่เปลี่ยนชั้นนี้';
    this.root.querySelector('.hy-blueprint-plan').innerHTML=blueprintSVG(b.id,this.planRoom());
    const edit=this.root.querySelector('.hy-blueprint-edit');edit.disabled=!current||!this.canApply();edit.setAttribute('aria-pressed',String(!!this.editing&&current));edit.textContent=this.editing&&current?'ปิดเครื่องมือแปลน':'แก้ผนัง / ประตูหน้าต่าง';
    this.editor.render(this.room,!!this.editing&&current&&this.canApply());
  }
  download(content,type,extension){
    const win=this.root.ownerDocument.defaultView;
    if(!win.URL.createObjectURL){this.root.querySelector('.hy-blueprint-feedback').textContent='เบราว์เซอร์นี้ไม่รองรับการดาวน์โหลดไฟล์';return;}
    const url=win.URL.createObjectURL(new win.Blob([content],{type})),a=this.root.ownerDocument.createElement('a');
    a.href=url;a.download=`office-${this.selected}-${this.room.blueprint===this.selected?'draft':'template'}.${extension}`;a.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
    this.root.querySelector('.hy-blueprint-feedback').textContent='ส่งออกไฟล์แล้ว · การดาวน์โหลดไม่บันทึกทับชั้น';
  }
  dispose(){this.editor.dispose();}
}
