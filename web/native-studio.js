import {DESIGN_PX,objectScale,patchObjects,translateObjects,scaleObjects,expandGroupSelection,groupObjects,ungroupObjects,reorderLayers,moveNewObjectsToFront,removeObjects} from './native-transform.js';
import {readTexture} from './native-texture.js';
import {roomSurfaces,surfaceMaterials,surfaceColors,builtInDecor} from './room-surfaces.js';
import {NativeHistory,defaultNativeRoom,copy,nativeName,NATIVE_LIMIT,createNativeObject,nativeObjects,nativeDecor,nativeBounds} from './native-state.js';
import {RoomStore,floorFile,parseFloorJSON} from './hybrid-state.js';
import {domainFloors,floorByKey,floorAgents} from './domain-office.js';
import {useOfficeInteraction} from './office-interaction.js';
import {OFFICE_ASSETS,OFFICE_ASSET_BY_ID,ASSET_CATEGORIES} from './office-assets.js';
import {StorageRecoveryUI} from './storage-recovery-ui.js';

const name=nativeName;
export class NativeStudio{
  constructor(root,{storage,initialFloor='projects',onVisitFloor,loadOffice=()=>import('./office.js')}={}){
    this.root=root;this.storage=storage;this.onVisitFloor=onVisitFloor;this.loadOffice=loadOffice;
    this.floor=floorByKey(initialFloor)?.key||'projects';this.selected='desk-0';this.selection=new Set(['desk-0']);this.multi=false;this.inspectorMode='shape';this.grid=0;this.snapAlign=false;this.playing=false;this.disposed=false;this.visible=true;this.assetCategory='all';this.assetQuery='';
    root.innerHTML=`<div class="hy-top"><div><span class="studio-eyebrow">ORIGINAL OFFICE · EDITABLE 3D</span><h2>แต่งฉาก 3D ของแต่ละชั้น</h2><p>โมเดลเดียวกับ Visual Office · โต๊ะและเก้าอี้แยกชิ้น · บันทึกเฉพาะชั้นที่เลือก</p></div></div>
    <div class="hy-floor-workspace"><label>ชั้นที่แก้ไข<select class="ns-floor">${domainFloors.map(d=>`<option value="${d.key}">${d.number} · ${d.label}</option>`).join('')}</select></label><button class="ns-save primary" type="button">บันทึก 3D และใช้กับชั้นนี้</button><button class="ns-visit" type="button">เข้าดูชั้นนี้</button><button class="ns-export" type="button">ส่งออกไฟล์ชั้น</button><button class="ns-import" type="button">เปิดไฟล์ 3D</button><input class="ns-file" type="file" accept=".json,application/json" hidden><p class="ns-status" role="status"></p></div>
    <div class="hy-layout"><section class="hy-workbench"><div class="hy-scene-bar"><span class="ns-mode">EDIT · เลือกและลากของ</span><div><button class="ns-undo" type="button">ย้อนกลับ</button><button class="ns-redo" type="button">ทำซ้ำ</button><button class="ns-play" type="button">ลองเล่น</button></div></div>
    <div class="ns-tools"><button class="ns-multi" type="button" aria-pressed="false">เลือกหลายชิ้น</button><span class="ns-selection-count"></span><span class="ns-marquee-hint">ลากครอบบนพื้นที่ว่างเพื่อเลือกหลายชิ้น</span><label>Snap<select class="ns-grid"><option value="0">ปิด</option><option value=".1">10 px</option><option value=".25">25 px</option><option value=".5">50 px</option></select></label><button class="ns-snap-align" type="button" aria-pressed="false">ดูดแนวชิ้นอื่น</button><label>มุมกล้อง<select class="ns-projection"><option value="orthographic">Isometric</option><option value="perspective">Perspective 3D</option></select></label></div>
    <div class="ns-canvas" tabindex="0" aria-label="ฉาก 3D แก้ไขได้"><div class="ns-labels"></div><p class="ns-loading">กำลังโหลดโมเดลเดิม…</p></div>
    <div class="hy-bottom-bar"><span>ลากชิ้นงานบนพื้น · หรือใช้ปุ่มลูกศร / ช่องตำแหน่ง</span><div><button class="ns-orbit" type="button" aria-pressed="false">หมุนมุมกล้อง</button><button data-camera="out" type="button">−</button><button data-camera="in" type="button">+</button><button data-camera="reset" type="button">คืนมุม</button></div></div>
    <section class="ns-asset-library" aria-label="คลัง Asset 3D"><div class="ns-asset-heading"><div><span class="studio-eyebrow">OFFICE ASSET LIBRARY</span><h3>คลังโมเดลและของตกแต่ง</h3><p>เลือกหมวด ดูภาพตัวอย่าง แล้วกดการ์ดเพื่อเพิ่มโมเดลลงในฉาก</p></div><span class="ns-count"></span></div><div class="ns-asset-toolbar"><div class="ns-asset-categories" role="group" aria-label="หมวดหมู่ Asset">${ASSET_CATEGORIES.map((category,index)=>`<button type="button" data-asset-category="${category.id}" aria-pressed="${index===0}">${category.label}</button>`).join('')}</div><label class="ns-asset-search">ค้นหา<input type="search" placeholder="ชื่อหรือ Asset ID" aria-label="ค้นหาโมเดลและ Asset ID"></label></div><div class="ns-asset-grid" aria-live="polite"></div><p class="ns-asset-note">Asset ID และเวอร์ชันจะบันทึกไปกับสเตตของชั้น · ชิ้นงานที่เพิ่มเป็นของตกแต่ง ไม่เพิ่มหรือเปลี่ยน Agent และ role</p></section><section class="ns-catalog ns-surfaces" aria-label="พื้นผิวห้องเดิม"><h3>ผนัง พื้น และของเดิมในห้อง</h3><p>เลือกโครงห้องเพื่อแต่งผิว · เลือกของเดิมเพื่อย้าย ลบ หรือทำสำเนา · ของที่ลบกดนำกลับได้</p><div class="ns-catalog-items">${roomSurfaces.map(s=>`<button type="button" data-room-surface="${s.id}" aria-pressed="false">${s.label}</button>`).join('')}</div></section><p class="ns-context"></p><p class="hy-footnote">Lobby เป็นฉาก 2D ใช้แท็บ Hybrid · ที่นี่แก้ 14 ชั้นแผนก · ลบเก้าอี้เดิมได้ · agent ยังอยู่ที่จุดประจำบทบาท ไม่ถูกลบตามของ</p></section>
    <aside class="hy-inspector"><div class="ns-inspector-tabs"><button type="button" data-inspector="shape" aria-pressed="true">ขนาด / ตำแหน่ง</button><button type="button" data-inspector="finish" aria-pressed="false">สี / พื้นผิว</button></div><section class="ns-surface-editor" hidden><span class="studio-eyebrow">ROOM FINISH</span><h3 class="ns-surface-name"></h3><label>วัสดุ<select class="ns-material">${surfaceMaterials.map(m=>`<option value="${m.id}">${m.label}</option>`).join('')}</select></label><label>สีพื้นผิว<input class="ns-color" type="color" value="#fff8f0"></label><div class="ns-swatches">${surfaceColors.map(c=>`<button type="button" data-surface-color="${c}" aria-label="สี ${c}" style="--swatch:${c}"></button>`).join('')}</div><label>รหัสสี HEX<input class="ns-color-hex" maxlength="7" placeholder="#a6b9b3"></label><button class="ns-surface-reset" type="button">คืนสีและวัสดุเดิม</button><details class="ns-texture-panel"><summary>Texture · รูปพื้นผิว</summary><button class="ns-texture-upload" type="button">อัปโหลดรูป Texture</button><input class="ns-texture-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><img class="ns-texture-preview" alt="Texture ที่ใช้" hidden><div class="ns-transform"><label>ซ้ำแนวนอน<input data-texture="repeatX" type="number" min="0.1" max="20" step="0.1"></label><label>ซ้ำแนวตั้ง<input data-texture="repeatY" type="number" min="0.1" max="20" step="0.1"></label><label>เลื่อน U<input data-texture="offsetX" type="number" min="-1" max="1" step="0.05"></label><label>เลื่อน V<input data-texture="offsetY" type="number" min="-1" max="1" step="0.05"></label><label>หมุนลาย °<input data-texture="rotation" type="number" min="-180" max="180" step="5"></label><label>ความทึบ 0–1<input data-texture="opacity" type="number" min="0" max="1" step="0.05"></label></div><button class="ns-texture-remove" type="button">เอา Texture ออก</button><p>ภาพอยู่ในไฟล์ชั้น · ย่อสูงสุด 512 px · สีพื้นผิวใช้ย้อมภาพ</p></details><p>ปรับเฉพาะส่วนที่เลือก · บันทึกพร้อมแบบของชั้นนี้ · ย้อนกลับได้</p></section><section class="ns-object-editor"><span class="studio-eyebrow">SCENE OBJECT</span><h3 class="ns-selected"></h3><div class="ns-object-actions"><button class="ns-duplicate" type="button">ทำสำเนา</button><button class="ns-delete" type="button">ลบชิ้นงาน</button><button class="ns-group" type="button">จัดกลุ่ม</button><button class="ns-ungroup" type="button">แยกกลุ่ม</button></div><p class="ns-seat-note"></p><div class="ns-transform">
    <label>X · เมตร<input class="ns-x" type="number" min="-5.5" max="5.5" step=".01"></label><label>Z · เมตร<input class="ns-z" type="number" min="-3.8" max="3.8" step=".01"></label><label>หมุน · องศา<input class="ns-rotation" type="number" min="-180" max="180" step="15"></label></div>
    <section class="ns-size-panel"><h4>ขนาด · px</h4><p>100 design px = 1 เมตร · คงขนาดเมื่อซูม</p><div class="ns-transform"><label>กว้าง W · px<input data-dimension="x" type="number" min="1" max="10000" step="1"></label><label>สูง H · px<input data-dimension="y" type="number" min="1" max="10000" step="1"></label><label>ลึก D · px<input data-dimension="z" type="number" min="1" max="10000" step="1"></label></div><button class="ns-proportions" type="button" aria-pressed="true">คงสัดส่วน</button><label>ขนาดเทียบต้นฉบับ %<input class="ns-scale" type="number" min="10" max="400" step="5"></label><div class="ns-transform"><label>เอียงหน้า–หลัง °<input data-tilt="x" type="number" min="-60" max="60" step="5"></label><label>เอียงซ้าย–ขวา °<input data-tilt="z" type="number" min="-60" max="60" step="5"></label></div><button class="ns-size-reset" type="button">คืนขนาดและมุมเอียง</button><p>ลากมุม ↘ ในฉากเพื่อย่อ–ขยายตามภาพ perspective · Shift+คลิก หรือเปิดเลือกหลายชิ้น</p></section><div class="ns-align-tools"><button data-align="x" type="button">จัด X ตรงกัน</button><button data-align="z" type="button">จัด Z ตรงกัน</button></div><div class="hy-nudge"><button data-ns-nudge="left" type="button">←</button><button data-ns-nudge="up" type="button">↑</button><button data-ns-nudge="down" type="button">↓</button><button data-ns-nudge="right" type="button">→</button></div><button class="ns-lock" type="button">ล็อก</button>
    <div class="hy-properties"><label>Interaction<select class="ns-action"><option value="none">ค่าเริ่มต้นของชิ้นงาน</option><option value="popup">แสดงป๊อปอัป</option><option value="elevator">เปิดบอร์ดลิฟต์</option><option value="floor">ไปชั้นที่กำหนด</option></select></label>
    <div class="ns-popup-fields"><label>หัวข้อ<input class="ns-title" maxlength="80"></label><label>ข้อความ<textarea class="ns-body" rows="3" maxlength="1000"></textarea></label></div>
    <label class="ns-link-fields">ชั้นปลายทาง<select class="ns-destination"><option value="lobby">G · Lobby</option>${domainFloors.map(d=>`<option value="${d.key}">${d.number} · ${d.label}</option>`).join('')}</select></label>
    <button class="ns-test" type="button">ทดสอบ Interaction</button></div></section><div class="hy-layer-heading ns-layer-heading"></div><p class="ns-layer-hint">รายการบนอยู่หน้า · ใช้ปุ่มลูกศรเลื่อนลำดับ</p><div class="hy-layer-list ns-list"></div><div class="ns-layer-actions"><button type="button" data-layer-action="front">นำมาไว้หน้า</button><button type="button" data-layer-action="up">เลื่อนขึ้น</button><button type="button" data-layer-action="down">เลื่อนลง</button><button type="button" data-layer-action="back">ส่งไปหลัง</button></div></aside></div>
    <dialog class="ns-discard"><h2>มีแบบ 3D ที่ยังไม่บันทึก</h2><p>กลับไปบันทึกก่อน หรือทิ้งแบบร่างเพื่อไปต่อ</p><button class="ns-keep" type="button">แก้ต่อ</button><button class="ns-leave" type="button">ทิ้งแบบร่างแล้วไปต่อ</button></dialog>
    <dialog class="ns-elevator"><h2>เลือกชั้น</h2><div class="hy-play-floor-list"><button data-native-floor="lobby" type="button">G · Lobby</button>${domainFloors.map(d=>`<button data-native-floor="${d.key}" type="button">${d.number} · ${d.label}</button>`).join('')}</div><button data-ns-close type="button">ปิด</button></dialog>
    <dialog class="ns-file-review"><h2>เปิดไฟล์ 3D เข้าแบบร่าง</h2><p class="ns-file-summary"></p><p>ยังไม่เปลี่ยนฉากที่ชั้นใช้อยู่จนกว่าจะบันทึก</p><button class="ns-file-accept primary" type="button">เปิดเข้าแบบร่าง</button><button data-ns-close type="button">ยกเลิก</button></dialog>`;
    this.storageRecovery=new StorageRecoveryUI(root,{fileName:'visual-office-native-backup.json',onRecovered:()=>{
      this.store=new RoomStore(this.storage);this.readIssue=null;this.base=this.store.floorRevision(this.floor);this.update();this.status('นำข้อมูลที่อ่านไม่ได้ออกแล้ว · แบบร่าง 3D ยังอยู่ กรุณาบันทึกอีกครั้ง');
    }});
    const q=s=>root.querySelector(s);
    this.renderAssetLibrary();
    root.querySelectorAll('[data-asset-category]').forEach(b=>b.onclick=()=>{this.assetCategory=b.dataset.assetCategory;root.querySelectorAll('[data-asset-category]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));this.renderAssetLibrary();});
    q('.ns-asset-search').querySelector('input').oninput=e=>{this.assetQuery=e.target.value;this.renderAssetLibrary();};
    root.addEventListener('click',e=>{const card=e.target.closest?.('[data-asset-add]');if(card&&root.contains(card))this.addAsset(card.dataset.assetAdd);});
    root.querySelectorAll('[data-room-surface]').forEach(b=>b.onclick=()=>this.selectSurface(b.dataset.roomSurface));
    root.querySelectorAll('[data-surface-color]').forEach(b=>b.onclick=()=>this.finish({color:b.dataset.surfaceColor}));
    root.querySelectorAll('[data-inspector]').forEach(b=>b.onclick=()=>{this.inspectorMode=b.dataset.inspector;this.update(false);});
    this.keepProportions=true;
    q('.ns-multi').onclick=()=>{this.multi=!this.multi;q('.ns-multi').setAttribute('aria-pressed',String(this.multi));};
    q('.ns-group').onclick=()=>this.groupSelection();q('.ns-ungroup').onclick=()=>this.ungroupSelection();
    root.querySelectorAll('[data-layer-action]').forEach(b=>b.onclick=()=>this.moveLayer(b.dataset.layerAction));
    q('.ns-grid').onchange=e=>{this.grid=Number(e.target.value);this.update();};
    q('.ns-snap-align').onclick=()=>{this.snapAlign=!this.snapAlign;this.update();};
    q('.ns-projection').onchange=e=>{if(this.playing)return;this.history.change({...this.history.current,projection:e.target.value});this.update();};
    q('.ns-proportions').onclick=()=>{this.keepProportions=!this.keepProportions;q('.ns-proportions').setAttribute('aria-pressed',String(this.keepProportions));};
    for(const event of ['input','change'])q('.ns-scale')['on'+event]=e=>{const o=this.object(),v=Number(e.target.value);if(o&&v>=10&&v<=400)this.resizeSelection(v/100/objectScale(o).x,null,event==='change');};
    root.querySelectorAll('[data-dimension]').forEach(el=>{for(const event of ['input','change'])el['on'+event]=()=>{const o=this.object(),axis=el.dataset.dimension,size=this.office?.objectDimensions?.(o?.id)?.size[axis];if(size&&Number(el.value)>0)this.resizeSelection(Number(el.value)/(size*DESIGN_PX),this.keepProportions?null:axis,event==='change');};});
    root.querySelectorAll('[data-tilt]').forEach(el=>{for(const event of ['input','change'])el['on'+event]=()=>{const o=this.object(),value=Number(el.value);if(o&&!o.locked&&el.value!==''&&Math.abs(value)<=60)this.changeObject({...o,tilt:{x:0,z:0,...o.tilt,[el.dataset.tilt]:value}},event==='change');};});
    q('.ns-size-reset').onclick=()=>this.changeMany(this.selectedObjects().filter(o=>!o.locked).map(o=>({...o,scale:{x:1,y:1,z:1},tilt:{x:0,z:0}})));
    root.querySelectorAll('[data-align]').forEach(el=>el.onclick=()=>{const o=this.object(),axis=el.dataset.align;if(o)this.changeMany(this.selectedObjects().filter(p=>!p.locked).map(p=>({...p,[axis]:Math.max(-nativeBounds(p)[axis],Math.min(nativeBounds(p)[axis],o[axis]))})));});
    q('.ns-texture-upload').onclick=()=>q('.ns-texture-file').click();
    q('.ns-texture-file').onchange=async e=>{
      const file=e.target.files?.[0],floor=this.floor,id=this.selected,surface=this.surface;
      try{if(file){const texture=await readTexture(file,root.ownerDocument.defaultView);if(this.disposed||floor!==this.floor||id!==this.selected||surface!==this.surface)return;this.finish({texture});}}
      catch(err){this.status(err.message);}e.target.value='';
    };
    root.querySelectorAll('[data-texture]').forEach(el=>{for(const event of ['input','change'])el['on'+event]=()=>{const texture=this.currentFinish().texture,value=Number(el.value);if(texture&&el.value!==''&&value>=Number(el.min)&&value<=Number(el.max))this.finish({texture:{...texture,[el.dataset.texture]:value}},event==='change');};});
    q('.ns-texture-remove').onclick=()=>this.finish({texture:null});
    q('.ns-material').onchange=e=>this.finish({material:e.target.value});
    q('.ns-color').onchange=e=>this.finish({color:e.target.value});
    q('.ns-color-hex').onchange=e=>this.finish({color:e.target.value});
    q('.ns-surface-reset').onclick=()=>this.finish(null);
    q('.ns-floor').onchange=e=>{const f=e.target.value;e.target.value=this.floor;this.requestLeave(()=>this.loadFloor(f));};
    q('.ns-save').onclick=()=>this.save();q('.ns-visit').onclick=()=>this.requestLeave(()=>onVisitFloor?.(this.floor));
    q('.ns-undo').onclick=()=>{this.office?.cancelObjectDrag();this.history.undo();this.update();};
    q('.ns-redo').onclick=()=>{this.office?.cancelObjectDrag();this.history.redo();this.update();};
    for(const key of ['x','z','rotation']){
      q(`.ns-${key}`).oninput=e=>{
        const value=e.target.value,o=this.object();if(!o||o.locked||this.playing)return;
        if(value===''){this.status('กรอกตำแหน่งให้ครบก่อนบันทึก');return;}
        this.move(o.id,{[key]:Number(value)},false);
      };
      q(`.ns-${key}`).onchange=e=>{if(e.target.value!=='')this.move(this.selected,{[key]:Number(e.target.value)});};
    }
    root.querySelectorAll('[data-ns-nudge]').forEach(b=>b.onclick=()=>this.nudge(b.dataset.nsNudge));
    q('.ns-canvas').onkeydown=e=>{const d={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.key];if(d){e.preventDefault();this.nudge(d);}if(e.key==='Escape')this.office?.cancelObjectDrag();};
    root.querySelectorAll('[data-native-add]').forEach(b=>b.onclick=()=>this.add(b.dataset.nativeAdd));
    q('.ns-duplicate').onclick=()=>this.duplicate();q('.ns-delete').onclick=()=>this.remove();
    q('.ns-lock').onclick=()=>{const items=this.selectedObjects();if(!items.length)return;const locked=items.some(o=>o.locked);this.changeMany(items.map(o=>({...o,locked:!locked})));};
    q('.ns-play').onclick=()=>{this.office?.cancelObjectDrag();this.playing=!this.playing;this.update();};
    q('.ns-orbit').onclick=()=>{if(this.office){this.office.cancelObjectDrag();this.office.orbitMode=!this.office.orbitMode;q('.ns-orbit').setAttribute('aria-pressed',String(this.office.orbitMode));}};
    root.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>this.office?.control(b.dataset.camera));
    q('.ns-action').onchange=e=>{const type=e.target.value;this.action(type==='popup'?{type,title:name(this.object()),body:''}:type==='floor'?{type,floor:'lobby'}:{type});};
    q('.ns-title').oninput=e=>this.action({...this.object().interaction,title:e.target.value},false);
    q('.ns-body').oninput=e=>this.action({...this.object().interaction,body:e.target.value},false);
    q('.ns-destination').onchange=e=>this.action({type:'floor',floor:e.target.value});
    q('.ns-test').onclick=()=>this.use(this.object());
    q('.ns-keep').onclick=()=>q('.ns-discard').close();
    q('.ns-leave').onclick=()=>{q('.ns-discard').close();this.history=new NativeHistory(this.history.saved);this.update();this.pendingLeave?.();this.pendingLeave=null;};
    root.querySelectorAll('[data-ns-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
    root.querySelectorAll('[data-native-floor]').forEach(b=>b.onclick=()=>{q('.ns-elevator').close();this.requestLeave(()=>onVisitFloor?.(b.dataset.nativeFloor));});
    q('.ns-export').onclick=()=>this.export();
    q('.ns-import').onclick=()=>q('.ns-file').click();
    q('.ns-file').onchange=async e=>{const f=e.target.files?.[0];try{if(f){if(f.size>2500000)throw Error('ไฟล์ใหญ่เกินไป');this.reviewFile(await f.text());}}catch(err){this.status(err.message);}e.target.value='';};
    q('.ns-file-accept').onclick=()=>{const file=this.fileProposal;if(!file)return;q('.ns-file-review').close();this.requestLeave(()=>{this.loadFloor(file.floor);this.history.change(file.room);this.update();this.status('เปิดไฟล์เป็นแบบร่างแล้ว · ตรวจฉากก่อนบันทึก');});};
    this.beforeUnload=e=>{if(this.history.dirty){e.preventDefault();e.returnValue='';}};root.ownerDocument.defaultView.addEventListener('beforeunload',this.beforeUnload);
    this.loadFloor(this.floor);this.ready=this.start();
  }
  selectSurface(id){
    if(!roomSurfaces.some(s=>s.id===id))return;
    this.office?.cancelObjectDrag();
    if(builtInDecor.some(d=>d.source===id)){
      const key=`builtin-${id}`;
      if(!nativeDecor(this.history.current).some(o=>o.id===key)){
        if(this.playing)return;
        const restored=nativeDecor({...this.history.current,decor:undefined}).find(o=>o.id===key);
        const room={...this.history.current,decor:[...nativeDecor(this.history.current),restored]};
        if(room.layers)room.layers=[restored.id,...room.layers];
        this.history.change(room);
      }
      this.surface=null;this.selected=key;this.selection=new Set([key]);this.inspectorMode='shape';
    }else{this.surface=id;this.selected=null;this.selection.clear();this.inspectorMode='finish';}
    this.update();
  }
  finish(patch,render=true){
    if(this.playing)return;
    const object=this.object();
    if(object){if(object.locked)return;this.changeObject({...object,finish:patch?{...object.finish,...patch}:{}},render);return;}
    if(!this.surface)return;
    const surfaces=copy(this.history.current.surfaces||{});
    if(patch)surfaces[this.surface]={...surfaces[this.surface],...patch};else delete surfaces[this.surface];
    const room={...this.history.current};if(Object.keys(surfaces).length)room.surfaces=surfaces;else delete room.surfaces;
    try{this.history.change(room);if(render)this.update();else this.office?.setNativeRoom(this.history.current);}catch(err){this.status(err.message);}
  }
  currentFinish(){return this.object()?.finish||this.history.current.surfaces?.[this.surface]||{};}
  selectedObjects(){const ids=expandGroupSelection(this.history.current,this.selection.has(this.selected)?[...this.selection]:this.selected?[this.selected]:[]);return nativeObjects(this.history.current).filter(o=>ids.includes(o.id));}
  selectObject(id,{additive=false,preserve=false}={}){
    this.surface=null;const object=nativeObjects(this.history.current).find(o=>o.id===id);if(!object)return;
    const members=object.groupId?nativeObjects(this.history.current).filter(o=>o.groupId===object.groupId).map(o=>o.id):[id];
    if(preserve&&members.some(member=>this.selection.has(member))&&!additive){this.selected=id;}
    else if(additive||this.multi){const remove=members.every(member=>this.selection.has(member));for(const member of members)remove?this.selection.delete(member):this.selection.add(member);this.selected=this.selection.has(id)?id:[...this.selection].at(-1)||null;}
    else{this.selection=new Set(members);this.selected=id;}
    this.update();
  }
  selectObjects(ids){
    const expanded=expandGroupSelection(this.history.current,ids);this.surface=null;this.selection=new Set(expanded);this.selected=expanded.at(-1)||null;this.update();
  }
  groupSelection(){
    const items=this.selectedObjects();if(items.length<2){this.status('เลือกอย่างน้อย 2 ชิ้นก่อนจัดกลุ่ม');return;}
    const id=`group-${this.root.ownerDocument.defaultView.crypto.randomUUID()}`;
    try{this.history.change(groupObjects(this.history.current,items.map(o=>o.id),id));this.selection=new Set(items.map(o=>o.id));this.selected=items.at(-1).id;this.update();}
    catch(err){this.status(err.message);}
  }
  ungroupSelection(){
    const items=this.selectedObjects();if(!items.some(o=>o.groupId))return;
    try{this.history.change(ungroupObjects(this.history.current,items.map(o=>o.id)));this.selection=new Set(items.map(o=>o.id));this.update();}
    catch(err){this.status(err.message);}
  }
  moveLayer(direction){
    const items=this.selectedObjects();if(!items.length||this.playing)return;
    try{this.history.change(reorderLayers(this.history.current,items.map(o=>o.id),direction));this.update();}
    catch(err){this.status(err.message);}
  }
  changeMany(items,render=true){
    if(this.playing||!items.length)return;
    try{this.history.change(patchObjects(this.history.current,items));if(render)this.update();else{this.office?.setNativeRoom(this.history.current);this.status('มีการแก้ไขที่ยังไม่บันทึก');}}
    catch(err){this.update(false);this.status(err.message);}
  }
  resizeSelection(factor,axis=null,render=true){if(this.playing)return;const items=this.selectedObjects();if(items.some(o=>o.groupId)&&items.some(o=>o.locked)){this.status('ปลดล็อกทุกชิ้นในกลุ่มก่อนปรับขนาด');this.update(false);return;}try{this.changeMany(scaleObjects(items,factor,axis),render);}catch(err){this.update(false);this.status(err.message);}}
  object(){return nativeObjects(this.history.current).find(o=>o.id===this.selected);}
  status(s){this.root.querySelector('.ns-status').textContent=s;}
  async start(){
    try{
      const {Office}=await this.loadOffice();if(this.disposed)return;
      const q=s=>this.root.querySelector(s);
      this.office=new Office(q('.ns-canvas'),{labelsRoot:q('.ns-labels'),loadingNode:q('.ns-loading'),editable:true,loadStudioAssets:true,
        onSurfaceSelect:id=>this.selectSurface(id),onObjectSelect:(id,options)=>this.selectObject(id,options),onObjectSelectMany:ids=>this.selectObjects(ids),onObjectMove:(id,p)=>this.move(id,p),onObjectResize:(ids,factor)=>{this.selection=new Set(ids);this.resizeSelection(factor);},onObjectUse:o=>this.use(o),onSelect:slot=>{if(!this.playing){this.selectObject(`desk-${slot}`);}}});
      if(!await this.office.load()||this.disposed)return;
      this.office.suspended=!this.visible;this.renderFloor();this.update();
    }catch(err){if(!this.disposed){this.office?.dispose();this.office=null;this.root.querySelector('.ns-loading').hidden=false;this.root.querySelector('.ns-loading').textContent='เปิด 3D ไม่ได้ · ลองรีโหลดด้วยเบราว์เซอร์ที่รองรับ WebGL';this.status(`โหลดโมเดลไม่สำเร็จ: ${err.message}`);}}
  }
  renderFloor(){if(this.office?.loaded)this.office.showDomain(floorByKey(this.floor),floorAgents(floorByKey(this.floor)));}
  loadFloor(f){
    if(!floorByKey(f))return;this.office?.cancelObjectDrag();this.floor=f;this.playing=false;this.surface=null;this.selected='desk-0';this.selection=new Set(['desk-0']);this.inspectorMode='shape';
    this.store=new RoomStore(this.storage);this.base=this.store.floorRevision(f);this.sourceEdition=this.store.edition(f);
    const key=`preview:${f}`;this.readIssue=this.store.writeBlocked?this.store.lastWriteError:this.store.issueFor('nativeFloors',key)||this.store.issueFor('editions',key);
    if(this.readIssue){this.store.lastWriteError=this.readIssue;this.storageRecovery.show(this.readIssue,value=>this.store.discardUnreadable(value));}else this.storageRecovery.hide();
    this.history=new NativeHistory((this.sourceEdition!=='original'&&this.store.nativeSaved(f))||defaultNativeRoom());this.renderFloor();this.update();
  }
  addAsset(assetId){
    const asset=OFFICE_ASSET_BY_ID.get(assetId);if(!asset)return;
    if(asset.format==='GLB'&&!this.office?.assetModels?.has(assetId)){this.status('โหลดโมเดลนี้ไม่สำเร็จ · ลองรีเฟรชแล้วเลือกใหม่');return;}
    this.add(asset.kind||'asset',null,asset.assetId);
  }
  renderAssetLibrary(){
    const grid=this.root.querySelector('.ns-asset-grid');if(!grid)return;
    const query=this.assetQuery.trim().toLocaleLowerCase();
    const assets=OFFICE_ASSETS.filter(asset=>(this.assetCategory==='all'||asset.category===this.assetCategory)&&(!query||`${asset.name} ${asset.assetId} ${asset.file} ${asset.format}`.toLocaleLowerCase().includes(query)));
    grid.replaceChildren();
    for(const asset of assets){
      const card=this.root.ownerDocument.createElement('button');card.type='button';card.className='ns-asset-card';card.dataset.assetAdd=asset.assetId;card.setAttribute('aria-label',`เพิ่ม ${asset.name} · Asset ID ${asset.assetId} ลงในฉาก`);card.disabled=this.playing||(this.history?.current.objects.length||0)>=NATIVE_LIMIT||(asset.format==='GLB'&&!this.office?.assetModels?.has(asset.assetId));
      const image=this.root.ownerDocument.createElement('img');image.className='ns-asset-preview';image.src=asset.preview;image.alt='';image.loading='lazy';image.onerror=()=>{image.classList.add('missing');image.removeAttribute('src');};
      const body=this.root.ownerDocument.createElement('span');body.className='ns-asset-body';
      const title=this.root.ownerDocument.createElement('strong');title.textContent=asset.name;
      const category=this.root.ownerDocument.createElement('span');category.className='ns-asset-category-label';category.textContent=asset.category==='furniture'?'เฟอร์นิเจอร์':'ของตกแต่ง';
      const identifier=this.root.ownerDocument.createElement('code');identifier.textContent=asset.assetId;
      const footer=this.root.ownerDocument.createElement('span');footer.className='ns-asset-footer';
      const format=this.root.ownerDocument.createElement('span');format.className='ns-asset-format';format.textContent=asset.format;
      const add=this.root.ownerDocument.createElement('span');add.className='ns-asset-add-label';add.textContent='＋ เพิ่มในฉาก';
      body.append(title,category,identifier,footer);footer.append(format,add);card.append(image,body);grid.append(card);
    }
    if(!assets.length){const empty=this.root.ownerDocument.createElement('p');empty.className='ns-asset-empty';empty.textContent='ไม่พบ Asset ในหมวดนี้';grid.append(empty);}
  }
  add(kind,source,assetId){
    if(this.playing)return;
    if(this.history.current.objects.length>=NATIVE_LIMIT){this.status(`ห้องรองรับสูงสุด ${NATIVE_LIMIT} ชิ้น เพื่อให้ฉาก 3D ทำงานได้ลื่น`);return;}
    this.office?.cancelObjectDrag();
    const id=`prop-${this.root.ownerDocument.defaultView.crypto.randomUUID()}`;
    const bounds=nativeBounds(source);
    const object=source?{...copy(source),id,x:Math.min(bounds.x,source.x+.4),z:Math.min(bounds.z,source.z+.4),locked:false}:createNativeObject(kind,id,assetId);
    delete object.slot; // Copies are props, never a new agent seat binding.
    try{this.history.change(moveNewObjectsToFront(this.history.current,object));this.surface=null;this.selected=id;this.selection=new Set([id]);this.update();}
    catch(err){this.status(err.message);}
  }
  duplicate(){
    if(this.playing)return;const selected=this.selectedObjects(),lockedGroup=selected.some(o=>o.groupId&&selected.some(p=>p.groupId===o.groupId&&p.locked));if(lockedGroup){this.status('ปลดล็อกทุกชิ้นในกลุ่มก่อนทำสำเนา');return;}const sources=selected.filter(o=>!o.locked);if(!sources.length)return;
    if(this.history.current.objects.length+sources.length>NATIVE_LIMIT){this.status('จำนวนสำเนาเกินพื้นที่ว่าง · ไม่มีการเพิ่มบางส่วน');return;}
    const shifted=translateObjects(this.history.current,sources.map(o=>o.id),sources[0].id,{x:sources[0].x+.4,z:sources[0].z+.4});
    const groupIds=new Map(),copies=shifted.map(o=>{const p={...copy(o),id:`prop-${this.root.ownerDocument.defaultView.crypto.randomUUID()}`,locked:false};delete p.slot;if(o.groupId){if(!groupIds.has(o.groupId))groupIds.set(o.groupId,`group-${this.root.ownerDocument.defaultView.crypto.randomUUID()}`);p.groupId=groupIds.get(o.groupId);}return p;});
    try{this.history.change(moveNewObjectsToFront(this.history.current,copies));this.surface=null;this.selection=new Set(copies.map(o=>o.id));this.selected=copies.at(-1).id;this.update();}catch(err){this.status(err.message);}
  }
  remove(){
    if(this.playing)return;const ids=new Set(this.selectedObjects().filter(o=>!o.locked).map(o=>o.id));if(!ids.size)return;this.office?.cancelObjectDrag();
    this.history.change(removeObjects(this.history.current,[...ids]));this.selected=null;this.selection.clear();this.update();
  }
  changeObject(o,render=true){
    if(this.playing)return;
    try{this.history.change(o.id.startsWith('builtin-')?{...this.history.current,decor:nativeDecor(this.history.current).map(p=>p.id===o.id?o:p)}:{...this.history.current,objects:this.history.current.objects.map(p=>p.id===o.id?o:p)});if(render)this.update();else{this.office?.setNativeRoom(this.history.current);this.status('มีการแก้ไขที่ยังไม่บันทึก');this.root.querySelector('.ns-undo').disabled=!this.history.past.length;this.root.querySelector('.ns-redo').disabled=!this.history.future.length;}}
    catch(err){this.status(err.message);if(render)this.update(false);}
  }
  move(id,p,render=true){
    const o=nativeObjects(this.history.current).find(o=>o.id===id);if(!o||o.locked||this.playing)return;
    if(!this.selection.has(id))this.selection=new Set([id]);this.selected=id;
    const items=this.selectedObjects();if(items.some(item=>item.groupId&&items.some(other=>other.groupId===item.groupId&&other.locked))){this.status('ปลดล็อกทุกชิ้นในกลุ่มก่อนย้าย');this.office?.setNativeRoom(this.history.current);return;}
    const moved=translateObjects(this.history.current,items.map(item=>item.id),id,p,{grid:this.grid,align:this.snapAlign});
    this.changeMany(moved.map(item=>item.id===id&&p.rotation!==undefined?{...item,rotation:p.rotation}:item),render);
  }
  action(a,render=true){const o=this.object();if(o&&!o.locked)this.changeObject({...o,interaction:a},render);}
  nudge(d){const o=this.object(),delta={left:[-.2,0],right:[.2,0],up:[0,-.2],down:[0,.2]}[d];if(!o)return;this.move(o.id,{x:Math.round((o.x+delta[0])*100)/100,z:Math.round((o.z+delta[1])*100)/100});}
  update(report=true){
    if(this.selected!==null&&!this.object())this.selected=this.history.current.objects[0]?.id||null;
    const q=s=>this.root.querySelector(s),selected=this.object(),o=selected||{locked:true,interaction:{type:'none'}};
    this.selection=new Set(this.selectedObjects().map(o=>o.id));
    const selectedItems=this.selectedObjects(),selectedGroupIds=new Set(selectedItems.map(item=>item.groupId).filter(Boolean)),blockedGroup=selectedItems.some(item=>item.groupId&&selectedItems.some(other=>other.groupId===item.groupId&&other.locked));
    this.office?.setNativeRoom(this.history.current);
    if(this.office){this.office.selectionIds=new Set(this.selection);this.office.snapGrid=this.grid;this.office.snapAlign=this.snapAlign;}
    if(this.office){this.office.playing=this.playing;const m=this.office.furniture?.get(o.id);if(this.office.selectionRing)this.office.selectionRing.visible=!!selected;if(m&&this.office.selectionRing)this.office.selectionRing.position.set(m.position.x,.025,m.position.z);}
    const surface=roomSurfaces.find(s=>s.id===this.surface),finish=selected?.finish||this.history.current.surfaces?.[this.surface]||{},baseColor=surface?.color||roomSurfaces.find(s=>s.id===selected?.source)?.color||(selected?.kind==='chair'?'#b1beb9':selected?.kind==='desk'?'#f5efe4':'#fff8f0');
    q('.ns-surface-editor').hidden=(!surface&&!selected)||this.inspectorMode!=='finish';q('.ns-object-editor').hidden=!!surface||this.inspectorMode!=='shape';
    this.root.querySelectorAll('[data-inspector]').forEach(b=>{b.setAttribute('aria-pressed',String(this.inspectorMode===b.dataset.inspector));b.disabled=b.dataset.inspector==='shape'&&!!surface;});
    q('.ns-surface-name').textContent=surface?.label||(selected?name(selected):'');
    q('.ns-material').value=finish.material||'original';q('.ns-color').value=finish.color||baseColor;q('.ns-color-hex').value=finish.color||baseColor;
    q('.ns-surface-reset').disabled=this.playing||!!selected?.locked||!Object.keys(finish).length;
    this.root.querySelectorAll('.ns-surface-editor input,.ns-surface-editor select,[data-surface-color]').forEach(b=>b.disabled=this.playing||!!selected?.locked);
    this.root.querySelectorAll('[data-room-surface]').forEach(b=>{
      const id=b.dataset.roomSurface,decor=builtInDecor.some(d=>d.source===id),exists=nativeDecor(this.history.current).some(o=>o.source===id);
      b.setAttribute('aria-pressed',String(id===this.surface||this.selected===`builtin-${id}`));
      b.textContent=`${decor&&!exists?'นำกลับ: ':''}${roomSurfaces.find(s=>s.id===id).label}`;b.disabled=decor&&!exists&&this.playing;
    });
    q('.ns-selection-count').textContent=`เลือก ${this.selection.size} ชิ้น`;
    const alreadyOneGroup=selectedGroupIds.size===1&&selectedItems.every(item=>item.groupId===[...selectedGroupIds][0]);
    q('.ns-group').disabled=this.playing||this.selection.size<2||alreadyOneGroup;q('.ns-ungroup').disabled=this.playing||!selectedGroupIds.size;
    q('.ns-snap-align').setAttribute('aria-pressed',String(this.snapAlign));q('.ns-projection').value=this.history.current.projection||'orthographic';q('.ns-projection').disabled=this.playing;
    q('.ns-scale').value=selected?Math.round(objectScale(selected).x*10000)/100:'';
    const dimensions=this.office?.objectDimensions?.(selected?.id)?.size;
    this.root.querySelectorAll('[data-dimension]').forEach(el=>{el.value=dimensions?Math.round(dimensions[el.dataset.dimension]*DESIGN_PX):'';el.disabled=!dimensions||o.locked||blockedGroup||this.playing;});
    this.root.querySelectorAll('[data-tilt]').forEach(el=>el.value=selected?.tilt?.[el.dataset.tilt]||0);
    this.root.querySelectorAll('.ns-scale,[data-tilt],.ns-size-reset').forEach(el=>el.disabled=!selected||o.locked||blockedGroup||this.playing);
    this.root.querySelectorAll('[data-align]').forEach(el=>el.disabled=this.selection.size<2||this.playing);
    const texture=finish.texture;q('.ns-texture-preview').hidden=!texture;if(texture)q('.ns-texture-preview').src=texture.data;else q('.ns-texture-preview').removeAttribute('src');
    this.root.querySelectorAll('[data-texture]').forEach(el=>{el.value=texture?.[el.dataset.texture]??'';el.disabled=!texture||o.locked&&!!selected||this.playing;});
    q('.ns-texture-upload').disabled=this.playing||!!selected?.locked;q('.ns-texture-remove').disabled=!texture||this.playing||!!selected?.locked;
    q('.ns-floor').value=this.floor;q('.ns-selected').textContent=name(selected);
    for(const k of ['x','z']){q(`.ns-${k}`).min=-nativeBounds(selected)[k];q(`.ns-${k}`).max=nativeBounds(selected)[k];}
    for(const k of ['x','z','rotation']){q(`.ns-${k}`).value=o[k]??'';q(`.ns-${k}`).disabled=o.locked||this.playing;}
    q('.ns-lock').disabled=!selected||this.playing;
    q('.ns-action').value=o.interaction.type;q('.ns-title').value=o.interaction.title||'';q('.ns-body').value=o.interaction.body||'';q('.ns-destination').value=o.interaction.floor||'lobby';
    q('.ns-popup-fields').hidden=o.interaction.type!=='popup';q('.ns-link-fields').hidden=o.interaction.type!=='floor';
    this.root.querySelectorAll('.hy-properties input,.hy-properties textarea,.hy-properties select,[data-ns-nudge]').forEach(el=>el.disabled=o.locked||this.playing);
    q('.ns-count').textContent=`${nativeObjects(this.history.current).length} ชิ้น · เพิ่มได้อีก ${NATIVE_LIMIT-this.history.current.objects.length}`;
    q('.ns-layer-heading').textContent=`ชิ้นงานในฉาก · ${nativeObjects(this.history.current).length} ชิ้น`;
    q('.ns-seat-note').textContent=selected?.slot!==undefined?'ชิ้นงานเดิมของตำแหน่ง '+(selected.slot+1)+' · ลบหรือทำสำเนาได้โดยไม่เปลี่ยน agent':'เฟอร์นิเจอร์อิสระ · ไม่ผูกกับ agent';
    q('.ns-delete').disabled=!selected||selectedItems.every(item=>item.locked)||this.playing;
    q('.ns-duplicate').disabled=!selected||!selectedItems.some(item=>!item.locked)||blockedGroup||this.playing||this.history.current.objects.length+selectedItems.filter(item=>!item.locked).length>NATIVE_LIMIT;
    q('.ns-lock').textContent=selectedItems.some(item=>item.locked)?'ปลดล็อกชุดที่เลือก':'ล็อกชุดที่เลือก';
    const ordered=nativeObjects(this.history.current),selectedIds=new Set(selectedItems.map(item=>item.id)),positions=selectedItems.map(item=>ordered.findIndex(o=>o.id===item.id)).filter(i=>i>=0),top=Math.min(...positions),bottom=Math.max(...positions),canUp=positions.some(i=>i>0&&!selectedIds.has(ordered[i-1]?.id)),canDown=positions.some(i=>i<ordered.length-1&&!selectedIds.has(ordered[i+1]?.id)),layerButtons={front:ordered.slice(0,selectedIds.size).some(o=>!selectedIds.has(o.id)),up:!canUp,down:!canDown,back:ordered.slice(-selectedIds.size).some(o=>!selectedIds.has(o.id))};
    this.root.querySelectorAll('[data-layer-action]').forEach(button=>{button.disabled=!positions.length||this.playing||layerButtons[button.dataset.layerAction];});
    this.root.querySelectorAll('[data-asset-add]').forEach(b=>{const asset=OFFICE_ASSET_BY_ID.get(b.dataset.assetAdd);b.disabled=this.playing||this.history.current.objects.length>=NATIVE_LIMIT||(asset?.format==='GLB'&&!this.office?.assetModels?.has(asset.assetId));});
    q('.ns-test').disabled=o.interaction.type==='none';q('.ns-undo').disabled=this.playing||!this.history.past.length;q('.ns-redo').disabled=this.playing||!this.history.future.length;
    q('.ns-play').textContent=this.playing?'กลับไปแก้':'ลองเล่น';q('.ns-mode').textContent=this.playing?'PLAY · กดชิ้นงานเพื่อใช้ Interaction':'EDIT · เลือกและลากของ';
    const list=q('.ns-list');list.replaceChildren();const groupLabels=new Map();
    for(const obj of nativeObjects(this.history.current)){
      const row=this.root.ownerDocument.createElement('div');row.className='ns-layer-row';
      const b=this.root.ownerDocument.createElement('button');b.type='button';b.dataset.nativeObject=obj.id;b.textContent=`${name(obj)}${obj.locked?' · ล็อก':''}`;b.setAttribute('aria-pressed',String(this.selection.has(obj.id)));b.onclick=e=>this.selectObject(obj.id,{additive:e.shiftKey||e.ctrlKey||e.metaKey});row.append(b);
      if(obj.groupId){if(!groupLabels.has(obj.groupId))groupLabels.set(obj.groupId,groupLabels.size+1);const badge=this.root.ownerDocument.createElement('span');badge.className='ns-group-badge';badge.textContent=`ชุด ${groupLabels.get(obj.groupId)}`;row.append(badge);}
      list.append(row);
    }
    q('.ns-context').textContent=this.sourceEdition==='hybrid'?'ชั้นนี้ใช้งาน Hybrid อยู่ · บันทึกที่นี่จะเปลี่ยนมาใช้ 3D เดิมของชั้น โดยเก็บแบบ Hybrid ไว้ในเครื่อง':`ฉากจริงของ ${floorByKey(this.floor).label} · โมเดล room / desk เดิม และเก้าอี้เดิม`;
    if(report)this.status(this.readIssue?`ข้อมูล 3D ที่บันทึกไว้อ่านไม่ได้ · แบบร่างยังอยู่${this.readIssue.recoverable?' กรุณาสำรองก่อนกู้คืน':' · ตรวจสิทธิ์อ่านข้อมูลก่อนบันทึกต่อ'}`:this.store?.writeBlocked?'อ่านข้อมูลที่บันทึกไว้ไม่ได้หรือข้อมูลเสียหาย · หยุดบันทึกเพื่อรักษาข้อมูลเดิม':this.history.dirty?'มีแบบร่าง 3D ที่ยังไม่บันทึก':'โหลดสถานะ 3D ของชั้นนี้แล้ว');
  }
  storeFailure(store){
    const issue=store.lastWriteError;
    if(issue?.kind==='record'||issue?.kind==='envelope'){
      this.readIssue=issue;this.storageRecovery.show(issue,value=>store.discardUnreadable(value));
      this.status(`ข้อมูล 3D ที่บันทึกไว้อ่านไม่ได้ · แบบร่างยังอยู่${issue.recoverable?' ดาวน์โหลดข้อมูลสำรองเพื่อกู้คืน':' · ตรวจสิทธิ์อ่านข้อมูลก่อนบันทึกต่อ'}`);
    }else if(issue?.kind==='invalid')this.status(`ข้อมูลฉากไม่ถูกต้อง · ${issue.reason||'ตรวจขนาดและรูปแบบก่อนบันทึก'} · แบบร่างยังอยู่`);
    else this.status('บันทึกไม่ได้ · แบบร่างยังอยู่ กรุณาส่งออกไฟล์สำรอง');
    return false;
  }
  save(){
    this.office?.cancelObjectDrag();const s=new RoomStore(this.storage);
    if((this.surface||this.object())&&!/^#[0-9a-f]{6}$/i.test(this.root.querySelector('.ns-color-hex').value)){this.status('กรอกรหัสสีแบบ #a6b9b3 ให้ถูกต้องก่อนบันทึก');return false;}
    for(const key of this.object()?['x','z','rotation','scale']:[]){const input=this.root.querySelector(`.ns-${key}`),v=Number(input.value);
      if(input.value===''||!Number.isFinite(v)||v<Number(input.min)||v>Number(input.max)){this.status('กรอกตำแหน่งและมุมหมุนให้อยู่ในช่วงที่กำหนดก่อนบันทึก');return false;}}
    for(const input of this.root.querySelectorAll('[data-dimension],[data-tilt],[data-texture]')){
      if(input.disabled||input.closest('[hidden]'))continue;
      const v=Number(input.value);if(input.value===''||!Number.isFinite(v)||v<Number(input.min)||v>Number(input.max)){this.status('กรอกขนาด มุมเอียง และ Texture ให้ครบก่อนบันทึก');return false;}
    }
    const key=`preview:${this.floor}`,storageIssue=s.writeBlocked?s.lastWriteError:s.issueFor('nativeFloors',key)||s.issueFor('editions',key);
    if(storageIssue){s.lastWriteError=storageIssue;return this.storeFailure(s);}
    if(s.floorRevision(this.floor)!==this.base){this.status('ชั้นนี้เปลี่ยนจากที่อื่นแล้ว · ส่งออกแบบร่าง แล้วเลือกชั้นใหม่เพื่อโหลดล่าสุด');return false;}
    if(!s.applyNative(this.floor,this.history.current))return this.storeFailure(s);
    this.store=s;this.readIssue=null;this.base=s.floorRevision(this.floor);this.sourceEdition='native3d';this.history.commit();this.update();this.status(`บันทึก ${floorByKey(this.floor).label} แล้ว · ใช้ 3D นี้ใน Visual Office`);return true;
  }
  use(o){if(!o)return;useOfficeInteraction(this.root,o,{onFloor:f=>this.requestLeave(()=>this.onVisitFloor?.(f)),onElevator:()=>this.root.querySelector('.ns-elevator').showModal()});}
  requestLeave(run){this.office?.cancelObjectDrag();if(this.history.dirty){this.pendingLeave=run;this.root.querySelector('.ns-discard').showModal();}else run?.();}
  export(){
    const win=this.root.ownerDocument.defaultView,url=win.URL.createObjectURL(new win.Blob([JSON.stringify(floorFile(this.floor,this.history.current),null,2)],{type:'application/json'}));
    const a=this.root.ownerDocument.createElement('a');a.href=url;a.download=`visual-office-${this.floor}-3d.json`;a.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);this.status('ส่งออกแบบ 3D ของชั้นนี้แล้ว');
  }
  reviewFile(text){try{const f=parseFloorJSON(text);if(f.edition!=='native3d')throw Error('ไฟล์นี้ไม่ใช่ฉาก 3D กรุณาเปิดในแท็บ Hybrid');this.fileProposal=f;this.root.querySelector('.ns-file-summary').textContent=`${floorByKey(f.floor).label} · ${nativeObjects(f.room).length} ชิ้น พร้อม Interaction`;this.root.querySelector('.ns-file-review').showModal();}catch(err){this.fileProposal=null;this.status(err.message);}}
  setVisible(visible){this.visible=visible;if(this.office){this.office.cancelObjectDrag();this.office.suspended=!visible;if(visible)this.office.resize();}}
  dispose(){this.disposed=true;this.root.ownerDocument.defaultView.removeEventListener('beforeunload',this.beforeUnload);this.storageRecovery?.dispose();this.office?.dispose();this.root.querySelectorAll('dialog[open]').forEach(d=>d.close());this.root.replaceChildren();}
}
