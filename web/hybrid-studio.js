import {placementCandidate,applyGridPlacement} from './office-placement-grid.js';
import {rebuildOfficeFromSheet,isOfficeSheet,compileOfficeSheet} from './office-scene-sheet.js';
import {SkeletonAlignmentEditor} from './office-skeleton-editor.js';
import {RoomStore,RoomHistory,starterRoom,departmentStarterRoom,normalizeRoom,parseRoomJSON,roomDiff,catalog,catalogGroups,backgrounds,clone,defaultEffects,interactionFor,floorFile,parseFloorJSON,defaultOfficeRoom} from './hybrid-state.js';
import {OfficeNavigationEditor} from './office-nav-editor.js';
import {OfficeBlueprintPanel} from './office-blueprint-panel.js';
import {defaultBlueprintPlan,toggleBlueprintDoor} from './office-blueprint-state.js';
import {HybridScene} from './hybrid-scene.js';
import {domainFloors} from './domain-office.js';
import {icon} from './icons.js';
import {CharacterLabDialog} from './characters/lab-dialog.js';
import {CHARACTER_APPEARANCES,resolveAppearance} from './characters/runtime-catalog.js';
import {StorageRecoveryUI} from './storage-recovery-ui.js';

export const previewFloors=[{key:'lobby',label:'G · ล็อบบี้'},...domainFloors.map(d=>({key:d.key,label:`${String(d.number).padStart(2,'0')} · ${d.label}`}))];
const uid=()=>`room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const defaultFloorRoom=key=>{const domain=domainFloors.find(f=>f.key===key);return domain?defaultOfficeRoom(domain):starterRoom();};
const usesDefaultHybrid=(store,key)=>key!=='lobby'&&!store.floor(key)&&store.edition(key)!=='native3d';
const groupedCatalog=()=>Object.entries(catalogGroups).map(([group,label])=>{
  const cards=Object.entries(catalog).filter(([,item])=>item.group===group);
  return cards.length?`<section class="hy-catalog-group" data-catalog-group="${group}"><h4>${label}</h4><div class="hy-catalog-items">${cards.map(([kind,item])=>`<button type="button" data-add="${kind}"><img src="${item.src}" alt="" loading="lazy"><span>${item.name}</span><small>เพิ่มในห้อง</small></button>`).join('')}</div></section>`:'';
}).join('');
export class HybridStudio{
  constructor(root,{storage,onVisitFloor,initialFloor='lobby',onEditNative,getFloorTasks,onOpenTask,onOpenWork}={}){
    this.root=root;this.storage=storage;this.onVisitFloor=onVisitFloor;this.onEditNative=onEditNative;this.store=new RoomStore(storage);
    this.sceneOptions={getFloor:()=>domainFloors.find(f=>f.key===this.editingFloor)||{key:'lobby',number:0,label:'Lobby'},getTasks:getFloorTasks,onOpenTask,onOpenWork};
    initialFloor=previewFloors.some(f=>f.key===initialFloor)?initialFloor:'lobby';
    const applied=this.store.floor(initialFloor);
    const matching=applied&&this.store.data.designs.find(d=>JSON.stringify(d.room)===JSON.stringify(applied));
    this.designId=matching?.id||uid();this.history=new RoomHistory(applied||defaultFloorRoom(initialFloor));
    this.editingFloor=initialFloor;this.floorBase=JSON.stringify(applied);this.edition=applied?'draft':'current';this.hasDraft=!!applied;
    this.scopeBase=this.store.floorRevision(initialFloor);
    this.selected=this.history.current.objects.find(o=>['desk','work-desk'].includes(o.kind))?.id;this.playing=false;this.zoom=1;
    this.target=previewFloors.some(f=>f.key===initialFloor)?initialFloor:'lobby';
    root.innerHTML=`
      <div class="hy-top"><div><span class="studio-eyebrow">BUILD A PLACE TO BELONG</span><h2>ห้องเล็ก ๆ ที่เราออกแบบด้วยกัน</h2><p>ฉากวาดอบอุ่น · เฟอร์นิเจอร์นุ่มมน · ตัวละคร 3D ในชั้น Office</p></div><span class="hy-local">พื้นที่ทดลอง · บันทึกในเครื่อง</span></div>
      <section class="hy-floor-workspace" aria-label="เลือกชั้นและ Edition">
        <label>กำลังออกแบบชั้น<select class="hy-edit-floor">${previewFloors.map(f=>`<option value="${f.key}">${f.label}</option>`).join('')}</select></label>
        <label>Edition ที่แสดง<select class="hy-edition"><option value="draft">แบบร่างที่แก้ไขได้</option><option value="current">ฉากที่ชั้นใช้อยู่จริง</option></select></label>
        <button type="button" class="hy-save-floor primary">บันทึกชั้นนี้</button><button type="button" class="hy-download-floor">ส่งออกไฟล์ชั้น</button><button type="button" class="hy-open-file">เปิดไฟล์ชั้น</button><button type="button" class="hy-edit-native">แก้ฉาก 3D ของชั้นนี้</button><button type="button" class="hy-character-lab">Character Lab · Zuri / วางใจ</button>
        <button type="button" class="hy-rebuild-sheet" title="จัดตำแหน่งในแบบร่างเท่านั้น · ย้อนกลับได้ · กดบันทึกชั้นนี้เมื่อต้องการใช้">ใช้แปลนแนะนำ · โต๊ะคู่ + มุมพัก</button><input class="hy-floor-file" type="file" accept=".json,application/json" hidden>
        <p class="hy-floor-state" role="status"></p>
      </section>
      <section class="hy-blueprint-host" aria-label="บลูพริ้นต์สำนักงาน"></section>
      <section class="hy-current-floor" hidden><div class="hy-current-scene"></div><div class="hy-original-frame"></div><p class="hy-current-note"></p><button class="hy-start-edit" type="button">เปิดแบบร่างเพื่อแก้ไข</button><button class="hy-open-actual" type="button">เข้าชั้นนี้ใน Visual Office</button></section>
      <div class="hy-toolbar" aria-label="จัดการแบบห้อง">
        <label class="hy-name">ชื่อแบบ<input maxlength="80" aria-label="ชื่อแบบห้อง"></label>
        <button type="button" class="hy-library">${icon('book')}แบบของฉัน</button>
        <button type="button" class="hy-save">${icon('file')}เก็บเข้าคลังแบบ</button>
        <button type="button" class="hy-apply">${icon('office')}คัดลอกไปชั้นอื่น…</button>
      </div>
      <div class="hy-layout">
        <section class="hy-workbench" aria-label="ห้องตัวอย่างแบบผสม">
          <div class="hy-scene-bar"><span class="hy-room-status"></span><div><button class="hy-undo" type="button" aria-label="ย้อนการแก้ไข">${icon('rotate-left')}</button><button class="hy-redo" type="button" aria-label="ทำซ้ำการแก้ไข">${icon('rotate-right')}</button><button class="hy-nav-edit" type="button" aria-pressed="false">ทางเดิน / จุดใช้งาน</button><button class="hy-play" type="button" aria-pressed="false">${icon('eye')}ลองเล่น</button></div></div>
          <section class="hy-sheet-layers" hidden><strong>SCENE SHEET · ภาพและโครงชุดเดียวกัน</strong><button type="button" class="hy-sheet-image" aria-pressed="true">สกิน 2.5D · เปิด</button><button type="button" class="hy-sheet-model" aria-pressed="true">โมเดล · เปิด</button><button type="button" class="hy-sheet-wire" aria-pressed="false">Wireframe · ปิด</button><button type="button" class="hy-grid-toggle" aria-pressed="false">จัดวางเป็นช่อง · ปิด</button><button type="button" class="hy-sheet-download">ดาวน์โหลดชีต</button><p>ภาพสกินผูกกับของแต่ละชิ้น · เปิดปิดแต่ละเลเยอร์แยกกัน · ย้ายภาพและโครงพร้อมกัน · ผนัง/ประตูแก้จากแปลนด้านบน · บันทึกชั้นนี้เพื่อเก็บ</p></section><section class="hy-skeleton-panel-host"></section><section class="hy-nav-panel-host" hidden></section><div class="hy-viewport"><div class="hy-stage"></div></div>
          <div class="hy-bottom-bar"><span class="hy-hint">ลากของจัดวาง · เลือกแล้วใช้ปุ่มลูกศรได้</span><div><button class="hy-zoom-out" type="button" aria-label="ซูมออก">${icon('minus')}</button><button class="hy-zoom-reset" type="button" aria-label="คืนมุมมอง">100%</button><button class="hy-zoom-in" type="button" aria-label="ซูมเข้า">${icon('plus')}</button></div></div>
          <p class="hy-feedback" role="status" aria-live="polite"></p>
          <nav class="hy-drawer-tabs" aria-label="คลังออกแบบ"><button type="button" data-drawer="objects" aria-pressed="true">เพิ่มของ</button><button type="button" data-drawer="scenes" aria-pressed="false">เปลี่ยนฉาก</button><button type="button" data-drawer="ai" aria-pressed="false">ออกแบบร่วมกับ AI</button></nav>
          <div class="hy-drawer" data-drawer-panel="objects"><div class="hy-catalog">${groupedCatalog()}</div><p>Avatar กลางเป็นตัวประกอบภาพ ไม่ผูกกับ agent หรือ role จริง · ของแต่ละชิ้นย้ายได้แยกกัน · สูงสุด 40 ชิ้น</p></div>
          <div class="hy-drawer" data-drawer-panel="scenes" hidden><div class="hy-backgrounds">${Object.entries(backgrounds).map(([k,v])=>`<button type="button" data-background="${k}" aria-pressed="false"><img src="${v.src}" alt="" loading="lazy"><span>${v.name}</span></button>`).join('')}</div><p>เปลี่ยนฉากโดยเก็บของและตำแหน่งเดิม</p></div>
          <div class="hy-drawer hy-collab" data-drawer-panel="ai" hidden>
            <div><span class="studio-eyebrow">HUMAN + AI</span><h3>คุณวางไอเดีย ให้ AI ช่วยต่อแบบ</h3><p>เขียนโจทย์แล้วส่งชุดแบบให้ AI ที่คุณใช้ นำ JSON ที่ตอบกลับมาดูการเปลี่ยนแปลงก่อนรับเข้าแบบร่าง</p></div>
            <label>โจทย์ของห้อง<textarea class="hy-brief" rows="3" maxlength="4000" placeholder="เช่น จัดโต๊ะ 2 ตัว เว้นทางเดินกลาง และเพิ่มต้นไม้ข้างหน้าต่าง"></textarea></label>
            <div class="hy-collab-actions"><button type="button" class="hy-copy">คัดลอกโจทย์ + แบบให้ AI</button><button type="button" class="hy-export">ดาวน์โหลดแบบ JSON</button></div>
            <label>วางแบบ JSON จาก AI<textarea class="hy-import" rows="4" maxlength="80000" placeholder='{"schemaVersion":"office-room/v1",…}' spellcheck="false"></textarea></label>
            <button type="button" class="hy-review">ตรวจและดูข้อเสนอ</button>
            <div class="hy-proposal" hidden><p class="hy-diff"></p><div class="hy-proposal-scene"></div><div><button type="button" class="hy-accept primary">รับเข้าแบบร่าง</button><button type="button" class="hy-reject">ไม่ใช้ข้อเสนอนี้</button></div></div>
            <small>ส่งต่อด้วยการคัดลอกไฟล์ · ยังไม่ได้เชื่อม AI อัตโนมัติ · รับข้อเสนอแล้วต้องบันทึกและใช้กับชั้นเอง</small>
          </div>
        </section>
        <aside class="hy-inspector" aria-label="แก้ไขชิ้นงาน"><span class="studio-eyebrow">YOUR ROOM</span><h3>เก็บรายละเอียด</h3>
          <div class="hy-selection-empty">เลือกของในห้องหรือเพิ่มจากคลังด้านล่าง</div>
          <div class="hy-selection"><div class="hy-selected-title"></div><label class="hy-appearance-field" hidden>ตัวละครชั่วคราว<select class="hy-appearance">${CHARACTER_APPEARANCES.map(a=>`<option value="${a.id}">${a.label}</option>`).join('')}</select><small>เปลี่ยนเฉพาะหน้าตา · งานภาพยังไม่ผ่าน · ไม่เปลี่ยน Agent หรือ role</small></label><label>ขนาด <output class="hy-size-value"></output><input class="hy-size" type="range" min="60" max="150" step="5"></label>
          <div class="hy-nudge"><button type="button" data-nudge="left" aria-label="ขยับซ้าย">←</button><button type="button" data-nudge="up" aria-label="ขยับขึ้น">↑</button><button type="button" data-nudge="down" aria-label="ขยับลง">↓</button><button type="button" data-nudge="right" aria-label="ขยับขวา">→</button></div>
          <div class="hy-object-actions"><button class="hy-flip" type="button">กลับด้าน</button><button class="hy-lock" type="button"></button><button class="hy-duplicate" type="button">ทำสำเนา</button><button class="hy-delete" type="button">นำออก</button></div>
          <details class="hy-properties" open><summary>Interaction · เมื่อกดไอเท็ม</summary>
            <label>การทำงาน<select class="hy-action"><option value="none">ไม่มี</option><option value="popup">แสดงป๊อปอัป</option><option value="tasks">งานของชั้นนี้</option><option value="elevator">เปิดบอร์ดลิฟต์</option><option value="floor">ไปชั้นที่กำหนด</option></select></label>
            <div class="hy-popup-fields"><label>หัวข้อ<input class="hy-popup-title" maxlength="80"></label><label>ข้อความ<textarea class="hy-popup-body" maxlength="1000" rows="3"></textarea></label></div>
            <label class="hy-link-fields">ชั้นปลายทาง<select class="hy-link-floor">${previewFloors.map(f=>`<option value="${f.key}">${f.label}</option>`).join('')}</select></label>
            <button type="button" class="hy-test-action">ทดสอบ Interaction</button>
          </details>
          <details class="hy-properties"><summary>Effects · รูปลักษณ์</summary>
            <label>ความทึบ <output class="hy-opacity-value"></output><input class="hy-opacity" type="range" min="25" max="100" step="5"></label>
            <label>เงาเพิ่ม <output class="hy-shadow-value"></output><input class="hy-shadow" type="range" min="0" max="24" step="2"></label>
            <label><input class="hy-glow" type="checkbox"> เรืองแสง</label>
            <label>เมื่อชี้ / โฟกัส<select class="hy-hover"><option value="none">ไม่มี</option><option value="lift">ยกขึ้นเล็กน้อย</option><option value="highlight">เน้นกรอบ</option></select></label>
          </details><p class="hy-object-note">Interaction เป็นการนำทางและข้อความ ไม่มีคำสั่ง agent</p></div>
          <div class="hy-layer-heading"><strong>ของในห้อง</strong><span class="hy-count"></span></div><div class="hy-layer-list"></div>
          <p class="hy-save-state"></p><button class="hy-save-copy" type="button">บันทึกเป็นแบบใหม่</button>
        </aside>
      </div>
      <dialog class="hy-floor-dialog" aria-labelledby="hy-floor-title"><div class="hy-dialog-head"><div><span class="studio-eyebrow">ROOM ASSIGNMENT</span><h2 id="hy-floor-title">นำแบบไปใช้ที่ชั้นไหน?</h2></div><button type="button" data-close aria-label="ปิด">${icon('close')}</button></div><p>ใช้กับชั้นในสำนักงานจำลองบนเบราว์เซอร์นี้ ข้อมูลแผนกและ agent คงเดิม</p><label>เลือกชั้น<select class="hy-floor-select">${previewFloors.map(f=>`<option value="${f.key}">${f.label}</option>`).join('')}</select></label><p class="hy-floor-summary"></p><div class="hy-floor-preview"></div><p class="hy-floor-feedback" role="status"></p><div class="hy-dialog-actions"><button type="button" class="hy-unapply">คืนฉากเดิมของชั้น</button><button type="button" class="hy-confirm-floor primary">บันทึกและใช้กับชั้นนี้</button><button type="button" class="hy-visit-floor" hidden>เข้าดูชั้นนี้</button></div><small>ชุดชั้นนี้เป็นตัวอย่างที่มีอยู่ ยังไม่ใช่การจัด domain จาก platform รุ่นใหม่</small></dialog>
      <dialog class="hy-library-dialog" aria-labelledby="hy-library-title"><div class="hy-dialog-head"><h2 id="hy-library-title">แบบของฉัน</h2><button type="button" data-close aria-label="ปิด">${icon('close')}</button></div><div class="hy-library-list"></div><button type="button" class="hy-new-room">เริ่มห้องใหม่</button></dialog>
      <dialog class="hy-discard-dialog" aria-labelledby="hy-discard-title"><h2 id="hy-discard-title">มีแบบร่างที่ยังไม่บันทึก</h2><p>กลับไปบันทึกแบบก่อน หรือเลือกทิ้งการแก้ไขล่าสุดเพื่อไปต่อ</p><div class="hy-dialog-actions"><button type="button" class="hy-keep-draft">กลับไปแก้ต่อ</button><button type="button" class="hy-discard">ทิ้งแบบร่างแล้วไปต่อ</button></div></dialog>
      <dialog class="hy-file-dialog" aria-label="ตรวจไฟล์ชั้น"><h2>ตรวจแบบก่อนเปิด</h2><p class="hy-file-summary"></p><div class="hy-file-preview"></div><p>เปิดเข้าแบบร่างก่อน ไม่มีการบันทึกทับชั้นจนกว่าจะกดบันทึกชั้นนี้</p><button type="button" class="hy-file-accept primary">เปิดเข้าแบบร่างของชั้นในไฟล์</button><button type="button" data-close>ยกเลิก</button></dialog>
      <dialog class="hy-play-elevator" aria-label="บอร์ดลิฟต์"><h2>เลือกชั้นที่จะไป</h2><div class="hy-play-floor-list">${previewFloors.map(f=>`<button type="button" data-play-floor="${f.key}">${f.label}</button>`).join('')}</div><button type="button" data-close>ปิด</button></dialog>
      <footer class="hy-footnote">Office ใช้โครงห้องและตัวละคร Three.js · เลื่อนและซูมได้ · Garden/City คงฉากภาพเดิม</footer>`;
    this.storageRecovery=new StorageRecoveryUI(root,{fileName:'visual-office-hybrid-backup.json',onRecovered:()=>{
      this.store=new RoomStore(this.storage);this.scopeBase=this.store.floorRevision(this.editingFloor);this.targetBase=this.store.floorRevision(this.target);
      this.updateEdition();this.floorFeedback('นำข้อมูลที่อ่านไม่ได้ออกแล้ว · แบบร่างยังอยู่ กรุณาบันทึกอีกครั้ง');
    }});
    this.scene=new HybridScene(root.querySelector('.hy-stage'),{...this.sceneOptions,editable:true,onSelect:id=>this.select(id),onMove:(id,p)=>this.move(id,p),onUse:id=>this.useObject(id),onDoorToggle:id=>{
      if(this.editingFloor==='lobby'||!this.history.current.blueprint)return {ok:false,message:'ชั้นนี้ไม่มีประตู Office'};
      const plan=toggleBlueprintDoor(this.history.current.blueprintPlan||defaultBlueprintPlan(this.history.current.blueprint),id);
      this.scene.stopWalkTest();this.playing=false;this.edition='draft';this.hasDraft=true;this.originalDraft=false;this.change({blueprintPlan:plan});this.updateEdition();return {ok:true,message:'เปลี่ยนประตูในแบบร่างแล้ว · กดบันทึกชั้นนี้เพื่อใช้จริง'};
    }});
    this.skeletonEditor=new SkeletonAlignmentEditor(root.querySelector('.hy-skeleton-panel-host'),{stage:root.querySelector('.hy-stage'),getRoom:()=>this.history.current,
      onPreview:room=>{this.scene.render(room,this.selected,false);this.scene.modelLayer?.highlightSkeleton(this.skeletonEditor.target);},
      onCommit:skeletonAlignment=>{this.change({skeletonAlignment});},
      onPartCommit:(id,value)=>{const skeletonParts=[...(this.history.current.skeletonParts||[]).filter(p=>p.id!==id),...value?[{id,...value}]:[]];this.change({skeletonParts});},
      onArtChange:officeArt=>this.change({officeArt}),onPick:(x,y)=>this.scene.modelLayer?.pickSkeleton(x,y),onSelectTarget:id=>this.scene.modelLayer?.highlightSkeleton(id),
      onView:(mode,opacity)=>{this.scene.cancelDrag();this.scene.stopWalkTest();this.playing=false;this.navigationEditing=false;const ok=this.scene.setCalibrationView(mode,opacity);this.update();return ok;}
    });
    this.navEditor=new OfficeNavigationEditor(root.querySelector('.hy-nav-panel-host'),{stage:root.querySelector('.hy-stage'),onChange:navigation=>{
      const next=parseRoomJSON(JSON.stringify({...this.history.current,navigation}));this.change({navigation:next.navigation});return true;
    },onTest:points=>this.scene.startWalkTest(points,message=>this.navEditor.status(message)),onStop:()=>this.scene.stopWalkTest()});
    this.blueprintPanel=new OfficeBlueprintPanel(root.querySelector('.hy-blueprint-host'),{storage:this.store.storage,canApply:()=>this.editingFloor!=='lobby',
      onToggleDoor:id=>this.scene.toggleDoor(id),
      onTest:(points,onStatus)=>this.scene.startWalkTest(points,onStatus),
      onStop:()=>this.scene.stopWalkTest(),
      onEditStart:()=>{this.scene.stopWalkTest();this.playing=false;this.navigationEditing=false;this.edition='draft';this.hasDraft=true;this.update();this.updateEdition();},
      onPlan:plan=>{
        if(this.editingFloor==='lobby')return;
        const room=parseRoomJSON(JSON.stringify({...this.history.current,background:'office',blueprint:plan.base,blueprintPlan:plan}));
        this.scene.stopWalkTest();this.playing=false;this.navigationEditing=false;this.edition='draft';this.hasDraft=true;this.originalDraft=false;
        this.scene.cancelDrag();this.history.change(room);this.update();this.updateEdition();
      },onPreview:plan=>this.scene.render(plan?{...this.history.current,blueprint:plan.base,blueprintPlan:plan}:this.history.current,this.selected,false),onApply:room=>{
      if(this.editingFloor==='lobby')return;
      this.scene.stopWalkTest();this.playing=false;this.navigationEditing=false;this.edition='draft';this.originalDraft=false;this.hasDraft=true;
      this.scene.cancelDrag();this.history.change(room);this.update();this.updateEdition();this.feedback('ใช้แม่แบบในแบบร่างแล้ว · Undo ได้ · กดบันทึกชั้นนี้เพื่อใช้จริง');
    }});
    const q=s=>root.querySelector(s);
    this.characterLab=new CharacterLabDialog(root);
    q('.hy-character-lab').onclick=()=>this.characterLab.open();
    q('.hy-rebuild-sheet').onclick=()=>{this.skeletonEditor?.setEnabled(false);this.scene.cancelDrag();this.scene.stopWalkTest();this.playing=false;this.edition='draft';this.originalDraft=false;this.hasDraft=true;let rebuilt;try{rebuilt=rebuildOfficeFromSheet(this.history.current);}catch(e){this.floorFeedback(e.message);return;}this.history.change(rebuilt);this.update();this.updateEdition();this.floorFeedback('ขึ้นฉากใหม่จากชีตเดียวในแบบร่างแล้ว · Undo ได้ · กดบันทึกชั้นนี้เพื่อใช้');};
    for(const [selector,key,label]of [['.hy-sheet-image','skin','สกิน 2.5D'],['.hy-sheet-model','model','โมเดล'],['.hy-sheet-wire','wireframe','Wireframe']])q(selector).onclick=()=>{const enabled=q(selector).getAttribute('aria-pressed')!=='true';if(this.scene.setPresentationVisibility({[key]:enabled})){q(selector).setAttribute('aria-pressed',String(enabled));q(selector).textContent=`${label} · ${enabled?'เปิด':'ปิด'}`;}};
    q('.hy-grid-toggle').onclick=()=>{const enabled=!this.scene.gridPlacement?.enabled;if(enabled){this.playing=false;this.history.change({...this.history.current,placementGrid:this.history.current.placementGrid||{cellSize:.5}});this.update();}this.scene.setGridPlacement(enabled);q('.hy-grid-toggle').setAttribute('aria-pressed',String(enabled));q('.hy-grid-toggle').textContent=enabled?'จัดวางเป็นช่อง · เปิด':'จัดวางเป็นช่อง · ปิด';};
    q('.hy-sheet-download').onclick=()=>this.download(compileOfficeSheet(this.history.current),`scene-sheet-${this.editingFloor}.json`);
    q('.hy-nav-edit').onclick=()=>{this.skeletonEditor?.setEnabled(false);this.scene.stopWalkTest();this.navigationEditing=!this.navigationEditing;this.playing=false;this.update();};
    q('.hy-edit-native').onclick=()=>this.onEditNative?.(this.editingFloor);
    q('.hy-edit-floor').onchange=e=>{const key=e.target.value;e.target.value=this.editingFloor;this.requestLeave(()=>this.loadFloor(key));};
    q('.hy-edition').onchange=e=>{this.scene.cancelDrag();this.edition=e.target.value;if(this.edition==='draft')this.hasDraft=true;this.updateEdition();};
    q('.hy-start-edit').onclick=()=>{this.edition='draft';this.originalDraft=false;this.hasDraft=true;this.updateEdition();};
    q('.hy-open-actual').onclick=()=>this.requestLeave(()=>this.onVisitFloor?.(this.editingFloor));
    q('.hy-save-floor').onclick=()=>this.saveFloor();
    q('.hy-download-floor').onclick=()=>this.exportFloor();
    q('.hy-open-file').onclick=()=>q('.hy-floor-file').click();
    q('.hy-floor-file').onchange=async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{if(file.size>350000)throw Error('ไฟล์ชั้นใหญ่เกินไป');this.reviewFloorFile(await file.text());}
      catch(err){this.floorFeedback(err.message);}finally{e.target.value='';}
    };
    q('.hy-file-accept').onclick=()=>this.acceptFloorFile();
    root.querySelectorAll('[data-play-floor]').forEach(b=>b.onclick=()=>{q('.hy-play-elevator').close();this.requestLeave(()=>this.onVisitFloor?.(b.dataset.playFloor));});
    q('.hy-action').onchange=e=>{
      const type=e.target.value;this.setInteraction(type==='popup'?{type,title:catalog[this.object().kind].name,body:''}:type==='floor'?{type,floor:this.editingFloor}:{type});
    };
    for(const [s,k]of [['.hy-popup-title','title'],['.hy-popup-body','body']])q(s).oninput=e=>this.setInteraction({...interactionFor(this.object()),[k]:e.target.value},false);
    q('.hy-link-floor').onchange=e=>this.setInteraction({type:'floor',floor:e.target.value});
    q('.hy-test-action').onclick=()=>this.scene.activate(this.selected);
    for(const [s,k,read]of [['.hy-opacity','opacity',e=>Number(e.target.value)/100],['.hy-shadow','shadow',e=>Number(e.target.value)],['.hy-glow','glow',e=>e.target.checked],['.hy-hover','hover',e=>e.target.value]]){
      q(s).onchange=e=>{const o=this.object();if(o)this.move(o.id,{effects:{...defaultEffects,...o.effects,[k]:read(e)}});};
    }
    for(const [selector,key]of [['.hy-name input','name'],['.hy-brief','brief']]){
      q(selector).oninput=e=>{
        this.history.change({...this.history.current,[key]:e.target.value});
        q('.hy-save-state').textContent=this.history.dirty?'มีการแก้ไขที่ยังไม่บันทึก':'บันทึกแบบแล้วในเครื่องนี้';
        q('.hy-undo').disabled=!this.history.past.length;q('.hy-redo').disabled=!this.history.future.length;
      };
    }
    q('.hy-name input').onchange=e=>this.change({name:e.target.value});
    q('.hy-brief').onchange=e=>this.change({brief:e.target.value});
    q('.hy-save').onclick=()=>this.save();
    q('.hy-save-copy').onclick=()=>this.save(true);
    q('.hy-undo').onclick=()=>{this.skeletonEditor?.cancel();this.scene.cancelDrag();this.history.undo();this.update();};
    q('.hy-redo').onclick=()=>{this.skeletonEditor?.cancel();this.scene.cancelDrag();this.history.redo();this.update();};
    q('.hy-play').onclick=()=>{this.skeletonEditor?.setEnabled(false);this.scene.cancelDrag();this.playing=!this.playing;this.navigationEditing=false;this.update();this.feedback(this.playing?'โหมดลองเล่น · แตะของเพื่อสำรวจ แตะลิฟต์เพื่อเลือกชั้น':'กลับมาแต่งห้องแล้ว');};
    root.querySelectorAll('[data-drawer]').forEach(b=>b.onclick=()=>{
      root.querySelectorAll('[data-drawer]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
      root.querySelectorAll('[data-drawer-panel]').forEach(p=>p.hidden=p.dataset.drawerPanel!==b.dataset.drawer);
    });
    root.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>this.add(b.dataset.add));
    root.querySelectorAll('[data-background]').forEach(b=>b.onclick=()=>this.change({background:b.dataset.background}));
    q('.hy-size').onchange=e=>this.move(this.selected,{scale:Number(e.target.value)/100});
    q('.hy-appearance').onchange=e=>this.move(this.selected,{appearance:e.target.value});
    q('.hy-size').oninput=e=>{q('.hy-size-value').textContent=`${e.target.value}%`;};
    root.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=()=>{
      const o=this.object();if(!o)return;const d={left:[-2,0],right:[2,0],up:[0,-2],down:[0,2]}[b.dataset.nudge];this.move(o.id,{x:o.x+d[0],y:o.y+d[1]});
    });
    q('.hy-flip').onclick=()=>{const o=this.object();if(o)this.move(o.id,{flip:!o.flip});};
    q('.hy-lock').onclick=()=>{const o=this.object();if(o)this.change({objects:this.history.current.objects.map(p=>p.id===o.id?{...p,locked:!p.locked}:p)});};
    q('.hy-duplicate').onclick=()=>{const o=this.object();if(o)this.add(o.kind,{...o,x:o.x+5,y:o.y+4,locked:false});};
    q('.hy-delete').onclick=()=>{const o=this.object();if(o&&!o.locked)this.change({objects:this.history.current.objects.filter(p=>p.id!==o.id),...(this.history.current.navigation?{navigation:{...this.history.current.navigation,stations:this.history.current.navigation.stations.filter(s=>s.objectId!==o.id)}}:{})});};
    q('.hy-zoom-in').onclick=()=>this.setZoom(this.zoom+.2);q('.hy-zoom-out').onclick=()=>this.setZoom(this.zoom-.2);q('.hy-zoom-reset').onclick=()=>this.setZoom(1);
    root.querySelectorAll('dialog [data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
    q('.hy-apply').onclick=()=>this.openFloor();
    q('.hy-floor-select').value=this.target;
    q('.hy-floor-select').onchange=e=>{this.target=e.target.value;this.updateFloor();};
    q('.hy-confirm-floor').onclick=()=>{
      const fresh=new RoomStore(this.storage);
      const targetKey=`preview:${this.target}`,storageIssue=fresh.writeBlocked?fresh.lastWriteError:fresh.issueFor('floors',targetKey)||fresh.issueFor('editions',targetKey);
      if(storageIssue){fresh.lastWriteError=storageIssue;return void this.storeFailure(fresh,'floor');}
      if(fresh.floorRevision(this.target)!==this.targetBase)return void(q('.hy-floor-feedback').textContent='ชั้นนี้เปลี่ยนจากที่อื่นแล้ว · ส่งออกแบบร่าง แล้วเปิดหน้าต่างนี้ใหม่เพื่อโหลดล่าสุด');
      if(this.target===this.editingFloor&&fresh.floorRevision(this.target)!==this.scopeBase)return void(q('.hy-floor-feedback').textContent='ชั้นที่กำลังแก้ถูกเปลี่ยนจากที่อื่นแล้ว · ส่งออกแบบร่างและโหลดชั้นล่าสุดก่อนใช้');
      if(!this.save())return void(q('.hy-floor-feedback').textContent='บันทึกแบบไม่ได้ จึงยังไม่เปลี่ยนชั้น');
      if(!this.store.apply(`preview:${this.target}`,this.history.current))return void this.storeFailure(this.store,'floor');
      if(this.target===this.editingFloor){this.floorBase=JSON.stringify(this.store.floor(this.target));this.scopeBase=this.store.floorRevision(this.target);}
      this.updateFloor();q('.hy-floor-feedback').textContent='ใช้แบบนี้แล้ว · เข้าดูชั้นได้เลย';
    };
    q('.hy-unapply').onclick=()=>{
      this.store=new RoomStore(this.storage);
      const targetKey=`preview:${this.target}`,storageIssue=this.store.writeBlocked?this.store.lastWriteError:this.store.issueFor('floors',targetKey)||this.store.issueFor('editions',targetKey);
      if(storageIssue){this.store.lastWriteError=storageIssue;return void this.storeFailure(this.store,'floor');}
      if(this.store.floorRevision(this.target)!==this.targetBase)return void(q('.hy-floor-feedback').textContent='ชั้นนี้เปลี่ยนจากที่อื่นแล้ว · ส่งออกแบบร่าง แล้วเปิดหน้าต่างนี้ใหม่เพื่อโหลดล่าสุด');
      if(this.target===this.editingFloor&&this.store.floorRevision(this.target)!==this.scopeBase)return void(q('.hy-floor-feedback').textContent='ชั้นที่กำลังแก้ถูกเปลี่ยนจากที่อื่นแล้ว · ส่งออกแบบร่างและโหลดชั้นล่าสุดก่อนคืนฉาก');
      if(this.store.unapply(`preview:${this.target}`)){if(this.target===this.editingFloor){this.floorBase='null';this.scopeBase=this.store.floorRevision(this.target);}this.updateFloor();q('.hy-floor-feedback').textContent='คืนฉากเดิมแล้ว แบบยังอยู่ในแบบของฉัน';}
      else q('.hy-floor-feedback').textContent='คืนฉากไม่สำเร็จ กรุณาลองใหม่';
    };
    q('.hy-visit-floor').onclick=()=>{q('.hy-floor-dialog').close();this.onVisitFloor?.(this.target);};
    q('.hy-library').onclick=()=>this.openLibrary();
    q('.hy-new-room').onclick=()=>this.loadDesign(null);
    q('.hy-keep-draft').onclick=()=>q('.hy-discard-dialog').close();
    q('.hy-discard').onclick=()=>{q('.hy-discard-dialog').close();this.pendingLoad?.();this.pendingLoad=null;};
    q('.hy-copy').onclick=()=>this.copyBrief();
    q('.hy-export').onclick=()=>this.exportRoom();
    q('.hy-review').onclick=()=>this.reviewProposal();
    q('.hy-import').oninput=()=>{this.proposal=null;q('.hy-proposal').hidden=true;};
    q('.hy-accept').onclick=()=>{
      if(!this.proposal)return;
      if(this.proposalBase!==JSON.stringify(this.history.current)){this.proposal=null;q('.hy-proposal').hidden=true;this.feedback('แบบร่างเปลี่ยนหลังตรวจข้อเสนอ กรุณาตรวจข้อเสนออีกครั้ง');return;}
      this.history.change(this.proposal);this.proposal=null;q('.hy-proposal').hidden=true;this.update();this.feedback('รับข้อเสนอเข้าแบบร่างแล้ว · ย้อนกลับได้ ยังไม่เปลี่ยนชั้น');
    };
    q('.hy-reject').onclick=()=>{this.proposal=null;q('.hy-proposal').hidden=true;this.feedback('เก็บแบบปัจจุบันไว้');};
    this.beforeUnload=e=>{if(this.hasUnsavedFloor()){e.preventDefault();e.returnValue='';}};
    root.ownerDocument.defaultView?.addEventListener('beforeunload',this.beforeUnload);
    this.update();this.updateEdition();
  }
  object(){return this.history.current.objects.find(o=>o.id===this.selected);}
  floorFeedback(message){this.root.querySelector('.hy-floor-state').textContent=message;}
  storeFailure(store,area='library'){
    const issue=store.lastWriteError;
    if(issue?.kind==='record'||issue?.kind==='envelope')this.storageRecovery.show(issue,value=>store.discardUnreadable(value));
    const message=issue?.kind==='record'||issue?.kind==='envelope'
      ?`ข้อมูลที่บันทึกไว้อ่านไม่ได้ · แบบร่างยังอยู่${issue.recoverable?' ดาวน์โหลดข้อมูลสำรองเพื่อกู้คืน':' · ตรวจสิทธิ์อ่านข้อมูลก่อนบันทึกต่อ'}`
      :issue?.kind==='invalid'?'แบบห้องไม่ถูกต้องหรือใหญ่เกิน 80 KB · แบบร่างยังอยู่'
      :area==='floor'?'บันทึกชั้นไม่สำเร็จ · แบบร่างยังอยู่ กรุณาส่งออกไฟล์สำรอง'
      :'บันทึกไม่ได้ · ตรวจพื้นที่เบราว์เซอร์หรือจำนวนแบบ (สูงสุด 20) แล้วลองใหม่';
    if(area==='floor'){this.floorFeedback(message);const dialogMessage=this.root.querySelector('.hy-floor-feedback');if(dialogMessage)dialogMessage.textContent=message;}else this.feedback(message);
    return false;
  }
  setInteraction(action,render=true){
    const o=this.object();if(!o||o.locked||this.playing)return;
    this.history.change({...this.history.current,objects:this.history.current.objects.map(p=>p.id===o.id?{...p,interaction:action}:p)});
    if(render)this.update();
    else {this.scene.render(this.history.current,this.selected,this.playing);this.root.querySelector('.hy-save-state').textContent='มีการแก้ไขที่ยังไม่บันทึก';this.root.querySelector('.hy-undo').disabled=!this.history.past.length;this.root.querySelector('.hy-redo').disabled=!this.history.future.length;}
  }
  loadFloor(key){
    if(isOfficeSheet(this.history.current)){this.scene.modelLayer?.setImageLayerMode('art');this.scene.structureView=false;}
    if(!previewFloors.some(f=>f.key===key))return;
    this.skeletonEditor?.setEnabled(false);if(this.skeletonEditor)this.skeletonEditor.target='all';this.scene.cancelDrag();this.store=new RoomStore(this.storage);
    this.editingFloor=key;this.target=key;const applied=this.store.floor(key);
    this.floorBase=JSON.stringify(applied);this.originalDraft=false;this.hasDraft=!!applied;
    this.scopeBase=this.store.floorRevision(key);
    this.history=new RoomHistory(applied||defaultFloorRoom(key));this.designId=uid();this.playing=false;this.navigationEditing=false;
    this.edition=applied?'draft':'current';this.proposal=null;this.root.querySelector('.hy-proposal').hidden=true;
    this.update();this.updateEdition();
  }
  updateEdition(){
    const q=s=>this.root.querySelector(s),current=this.edition==='current';if(current)this.skeletonEditor?.setEnabled(false);
    q('.hy-edit-floor').value=this.editingFloor;q('.hy-edition').value=this.edition;
    q('.hy-edit-native').hidden=this.editingFloor==='lobby'||!this.onEditNative;q('.hy-rebuild-sheet').hidden=this.editingFloor==='lobby';
    q('.hy-current-floor').hidden=!current;
    q('.hy-toolbar').hidden=current||this.originalDraft;
    q('.hy-layout').hidden=current||this.originalDraft;
    this.currentScene?.dispose();this.currentScene=null;q('.hy-original-frame').replaceChildren();
    const store=new RoomStore(this.storage),saved=store.floor(this.editingFloor),defaultFloor=usesDefaultHybrid(store,this.editingFloor);
    const room=current?saved||(defaultFloor?defaultFloorRoom(this.editingFloor):null):this.originalDraft?null:this.history.current;
    if(current||this.originalDraft){
      q('.hy-current-floor').hidden=false;
      q('.hy-current-scene').hidden=!room;
      if(room){this.currentScene=new HybridScene(q('.hy-current-scene'),{...this.sceneOptions,onUse:id=>this.useObject(id,room)});this.currentScene.render(room,null,true);}
      else {
        const frame=this.root.ownerDocument.createElement('iframe');
        frame.title='ฉากเดิมของชั้นใน Visual Office';frame.src=`${this.originalDraft?'?office-edition=original':''}#office/${this.editingFloor}`;frame.tabIndex=-1;
        q('.hy-original-frame').inert=true;q('.hy-original-frame').append(frame);
      }
      q('.hy-current-note').textContent=this.originalDraft?'ไฟล์ฉากเดิมพร้อมคืนค่า · กดบันทึกชั้นนี้เพื่อใช้':saved?'ภาพจากสถานะที่ชั้นนี้บันทึกไว้ · การแก้แบบร่างยังไม่มีผลต่อภาพนี้':defaultFloor?'โครงห้อง Three.js · เฟอร์นิเจอร์ Soft 3D · ตัวละคร 3D':'ฉากเดิมของชั้น · เลือกเริ่มแบบ Hybrid เพื่อปรับแต่ง';
      q('.hy-start-edit').textContent=saved?'กลับไปแก้แบบร่าง':defaultFloor?'ปรับแต่งฉากทีมนี้':'เริ่มแบบผสมสำหรับชั้นนี้';
    }
    q('.hy-save-floor').disabled=current;
    this.floorFeedback(store.writeBlocked?'อ่านข้อมูลที่บันทึกไว้ไม่ได้หรือข้อมูลเสียหาย · หยุดบันทึกเพื่อรักษาข้อมูลเดิม':`${previewFloors.find(f=>f.key===this.editingFloor).label} · ${current?'สถานะที่ใช้อยู่':this.originalDraft?'แบบร่างคืนฉากเดิม':'แบบร่าง Hybrid'} · บันทึกเฉพาะชั้นนี้ในเครื่อง`);
  }
  saveFloor(){
    if(this.scene.gridPlacement?.pending){this.floorFeedback('ยืนยันหรือยกเลิกมุมหมุนก่อนบันทึก');return false;}
    this.scene.cancelDrag();
    const fresh=new RoomStore(this.storage);
    const key=`preview:${this.editingFloor}`,storageIssue=fresh.writeBlocked?fresh.lastWriteError:fresh.issueFor('floors',key)||fresh.issueFor('editions',key);
    if(storageIssue){fresh.lastWriteError=storageIssue;return this.storeFailure(fresh,'floor');}
    if(fresh.floorRevision(this.editingFloor)!==this.scopeBase){this.floorFeedback('ชั้นนี้ถูกเปลี่ยนจากที่อื่นแล้ว · ส่งออกแบบร่างก่อน แล้วเลือกชั้นใหม่เพื่อโหลดสถานะล่าสุด');return false;}
    const room=this.originalDraft?null:this.history.current;
    const ok=room?fresh.apply(`preview:${this.editingFloor}`,room):fresh.unapply(`preview:${this.editingFloor}`);
    if(!ok)return this.storeFailure(fresh,'floor');
    this.store=fresh;this.floorBase=JSON.stringify(fresh.floor(this.editingFloor));this.scopeBase=fresh.floorRevision(this.editingFloor);this.history.savedNow();
    this.update();if(this.originalDraft)this.updateEdition();this.floorFeedback(`บันทึก ${previewFloors.find(f=>f.key===this.editingFloor).label} แล้ว · Visual Office ใช้สถานะนี้`);
    return true;
  }
  download(data,name){
    const win=this.root.ownerDocument.defaultView,blob=new win.Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=win.URL.createObjectURL(blob),a=this.root.ownerDocument.createElement('a');a.href=url;a.download=name;a.click();
    win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  }
  exportFloor(){
    const store=new RoomStore(this.storage),room=this.edition==='current'?(store.nativeFloor(this.editingFloor)||store.floor(this.editingFloor)||(usesDefaultHybrid(store,this.editingFloor)?defaultFloorRoom(this.editingFloor):null)):this.originalDraft?null:this.history.current;
    this.download(floorFile(this.editingFloor,room),`visual-office-${this.editingFloor}-${this.edition}.json`);
    this.floorFeedback(`ส่งออกไฟล์ชั้น ${this.editingFloor} · ${this.edition==='current'?'สถานะที่ใช้อยู่':'แบบร่าง'} แล้ว`);
  }
  reviewFloorFile(input){
    try{
      this.fileProposal=parseFloorJSON(input);
      if(this.fileProposal.edition==='native3d'){this.onEditNative?.(this.fileProposal.floor,this.fileProposal);return;}
      const v=this.fileProposal,q=s=>this.root.querySelector(s);
      q('.hy-file-summary').textContent=`${previewFloors.find(f=>f.key===v.floor).label} · ${v.edition==='hybrid'?`${v.room.name} · ${v.room.objects.length} ชิ้น`:'ฉากเดิม'} · จะเปิดชั้นตามไฟล์`;
      this.fileScene?.dispose();this.fileScene=null;q('.hy-file-preview').replaceChildren();
      if(v.room){this.fileScene=new HybridScene(q('.hy-file-preview'),{...this.sceneOptions,getFloor:()=>domainFloors.find(f=>f.key===v.floor)||{key:v.floor,number:0,label:'Lobby'}});this.fileScene.render(v.room);}
      q('.hy-file-dialog').showModal();
    }catch(err){this.fileProposal=null;this.floorFeedback(err.message);}
  }
  acceptFloorFile(){
    if(!this.fileProposal)return;
    const v=clone(this.fileProposal);this.root.querySelector('.hy-file-dialog').close();
    this.requestLeave(()=>{
      this.loadFloor(v.floor);this.originalDraft=v.edition==='original';
      this.history.change(v.room||starterRoom());this.edition='draft';this.hasDraft=true;
      this.update();this.updateEdition();this.floorFeedback('เปิดไฟล์เข้าแบบร่างแล้ว · ตรวจแล้วกดบันทึกชั้นนี้เพื่อใช้จริง');
    });
  }
  select(id){if(this.scene.gridPlacement?.enabled&&this.selected===id)return;this.scene.cancelDrag();this.selected=id;this.update();}
  feedback(message){this.root.querySelector('.hy-feedback').textContent=message;}
  change(patch){this.scene.cancelDrag();this.history.change({...this.history.current,...patch});this.update();}
  move(id,patch){
    const o=this.history.current.objects.find(o=>o.id===id);if(!o||o.locked||this.playing)return;
    if(this.scene.gridPlacement?.enabled){const c=placementCandidate(this.history.current,id,{...o,...patch},this.scene.gridPlacement.grid,{rotation:patch.rotation,patch,snap:patch.rotation===undefined&&(patch.x!==undefined||patch.y!==undefined)});if(!c.ok){this.feedback(c.message);return;}this.selected=id;this.history.change(applyGridPlacement(this.history.current,c));this.update();return;}
    this.selected=id;this.change({objects:this.history.current.objects.map(o=>o.id===id?{...o,...patch}:o)});
  }
  add(kind,props={}){
    if(this.history.current.objects.length>=40)return this.feedback('ห้องนี้มีครบ 40 ชิ้นแล้ว นำของออกก่อนเพิ่ม');
    this.playing=false;this.selected=uid();
    this.change({objects:[...this.history.current.objects,{kind,x:45+(this.history.current.objects.length%4)*5,y:74,scale:1,flip:false,locked:false,...props,id:this.selected}]});
    this.feedback(`เพิ่ม${catalog[kind].name}แล้ว · ลากไปวางได้เลย`);
  }
  setZoom(z){
    this.zoom=Math.max(1,Math.min(1.8,Math.round(z*10)/10));
    this.root.querySelector('.hy-stage').style.width=`${this.zoom*100}%`;
    this.root.querySelector('.hy-zoom-reset').textContent=`${Math.round(this.zoom*100)}%`;
    this.root.querySelector('.hy-zoom-out').disabled=this.zoom<=1;
    this.root.querySelector('.hy-zoom-in').disabled=this.zoom>=1.8;
  }
  save(asNew=false){
    // Commit focused text before saving, even when invoked without a blur.
    this.change({name:this.root.querySelector('.hy-name input').value,brief:this.root.querySelector('.hy-brief').value});
    const id=asNew?uid():this.designId;this.store=new RoomStore(this.storage);
    if(!this.store.save(id,this.history.current))return this.storeFailure(this.store,'library');
    this.designId=id;this.history.savedNow();this.update();this.feedback(asNew?'บันทึกเป็นแบบใหม่แล้ว':'บันทึกแบบแล้ว · เปิดซ้ำได้จากแบบของฉัน');return true;
  }
  update(){
    const state=this.history.current,q=s=>this.root.querySelector(s);
    this.blueprintPanel?.render(state);this.skeletonEditor?.render(state);
    if(!this.object())this.selected=state.objects.at(-1)?.id;
    this.scene.render(state,this.selected,this.playing);q('.hy-grid-toggle').setAttribute('aria-pressed',String(!!this.scene.gridPlacement?.enabled));q('.hy-grid-toggle').textContent=this.scene.gridPlacement?.enabled?'จัดวางเป็นช่อง · เปิด':'จัดวางเป็นช่อง · ปิด';q('.hy-grid-toggle').disabled=!this.scene.modelLayer;q('.hy-sheet-layers').hidden=!isOfficeSheet(state);q('.hy-sheet-image').disabled=!this.scene.modelLayer;for(const [selector,key,label]of [['.hy-sheet-image','skin','สกิน 2.5D'],['.hy-sheet-model','model','โมเดล'],['.hy-sheet-wire','wireframe','Wireframe']]){const enabled=this.scene.modelLayer?.skinLayer?.visibility[key]??(key!=='wireframe');q(selector).setAttribute('aria-pressed',String(enabled));q(selector).disabled=!this.scene.modelLayer?.skinLayer;q(selector).textContent=`${label} · ${enabled?'เปิด':'ปิด'}`;}if(this.skeletonEditor?.enabled)this.scene.modelLayer?.highlightSkeleton(this.skeletonEditor.target);
    this.navEditor?.render(state,!!this.navigationEditing&&!this.playing);
    q('.hy-nav-edit').hidden=state.background!=='office';q('.hy-nav-edit').setAttribute('aria-pressed',String(!!this.navigationEditing));
    this.root.querySelectorAll('[data-add]').forEach(b=>{b.hidden=state.background==='office'&&['printer','lift','elevator-door'].includes(b.dataset.add);});
    q('.hy-top p').textContent=state.background==='office'?'โครงห้อง Three.js · เฟอร์นิเจอร์ Soft 3D · ตัวละคร 3D':'ฉากวาดอบอุ่น · เฟอร์นิเจอร์นุ่มมน · คู่หูอนิเมะ';
    q('.hy-name input').value=state.name;q('.hy-brief').value=state.brief;
    q('.hy-room-status').textContent=this.playing?'PLAY · สำรวจห้อง':'EDIT · ห้องผสม';
    q('.hy-play').setAttribute('aria-pressed',String(this.playing));q('.hy-play').innerHTML=`${icon(this.playing?'edit':'eye')}${this.playing?'กลับไปแต่ง':'ลองเล่น'}`;
    q('.hy-hint').textContent=this.playing?'แตะลิฟต์เลือกชั้น · แตะของเพื่อสำรวจ':'ลากของจัดวาง · ใช้ปุ่มลูกศร · ซูมแล้วเลื่อนพื้นที่ได้';
    q('.hy-undo').disabled=!this.history.past.length;q('.hy-redo').disabled=!this.history.future.length;
    const o=this.object();q('.hy-selection').hidden=!o;q('.hy-selection-empty').hidden=!!o;
    if(o){
      q('.hy-selected-title').textContent=catalog[o.kind].name;
      q('.hy-appearance-field').hidden=!/^avatar-\d\d$/.test(o.kind)||state.background!=='office';q('.hy-appearance').value=resolveAppearance(o);q('.hy-appearance').disabled=o.locked||this.playing;
      q('.hy-size').value=String(o.scale*100);q('.hy-size-value').textContent=`${Math.round(o.scale*100)}%`;
      q('.hy-lock').textContent=o.locked?'ปลดล็อก':'ล็อกตำแหน่ง';
      q('.hy-lock').setAttribute('aria-pressed',String(o.locked));
      ['.hy-size','.hy-flip','.hy-delete'].forEach(s=>q(s).disabled=o.locked||this.playing);
      this.root.querySelectorAll('[data-nudge]').forEach(b=>b.disabled=o.locked||this.playing);
      q('.hy-lock').disabled=this.playing;
      const action=interactionFor(o),fx={...defaultEffects,...o.effects};
      q('.hy-action').value=action.type;q('.hy-popup-fields').hidden=action.type!=='popup';q('.hy-link-fields').hidden=action.type!=='floor';
      q('.hy-popup-title').value=action.title||'';q('.hy-popup-body').value=action.body||'';q('.hy-link-floor').value=action.floor||this.editingFloor;
      q('.hy-opacity').value=fx.opacity*100;q('.hy-opacity-value').textContent=`${Math.round(fx.opacity*100)}%`;
      q('.hy-shadow').value=fx.shadow;q('.hy-shadow-value').textContent=`${fx.shadow}px`;q('.hy-glow').checked=fx.glow;q('.hy-hover').value=fx.hover;
      this.root.querySelectorAll('.hy-properties input,.hy-properties select,.hy-properties textarea').forEach(el=>el.disabled=o.locked||this.playing);
      q('.hy-test-action').disabled=action.type==='none';
    }
    q('[data-drawer="scenes"]').hidden=isOfficeSheet(state);this.root.querySelectorAll('[data-background]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.background===state.background)));
    q('.hy-count').textContent=`${state.objects.length} / 40`;
    const list=q('.hy-layer-list');list.replaceChildren();
    for(const item of [...state.objects].reverse()){
      const b=this.root.ownerDocument.createElement('button');b.type='button';b.dataset.layer=item.id;
      b.textContent=`${catalog[item.kind].name}${item.locked?' · ล็อก':''}`;b.setAttribute('aria-pressed',String(item.id===this.selected));
      b.onclick=()=>{this.select(item.id);this.root.querySelector(`[data-object="${item.id}"]`)?.focus({preventScroll:true});};list.append(b);
    }
    q('.hy-save-state').textContent=JSON.stringify(state)===this.floorBase?'ตรงกับสถานะที่ชั้นนี้บันทึกไว้':this.history.dirty?'มีการแก้ไขที่ยังไม่บันทึก':this.store.data.designs.some(d=>d.id===this.designId)?'บันทึกในคลังแล้ว · ยังไม่ได้ใช้กับชั้นนี้':'แบบร่าง · ยังไม่ได้บันทึกชั้นนี้';
    this.setZoom(this.zoom);
  }
  openLibrary(){
    const list=this.root.querySelector('.hy-library-list');list.replaceChildren();
    for(const d of this.store.data.designs){
      const b=this.root.ownerDocument.createElement('button');b.type='button';b.dataset.design=d.id;
      b.textContent=`${d.room.name||'ไม่มีชื่อ'} · ${d.room.objects.length} ชิ้น`;b.onclick=()=>this.loadDesign(d);list.append(b);
    }
    if(!list.children.length)list.textContent='ยังไม่มีแบบที่บันทึก · เริ่มแต่งแล้วกดบันทึกแบบ';
    this.root.querySelector('.hy-library-dialog').showModal();
  }
  loadDesign(d){
    const run=()=>{this.history=new RoomHistory(d?.room||starterRoom());this.designId=d?.id||uid();this.originalDraft=false;this.hasDraft=true;this.edition='draft';this.playing=false;this.root.querySelector('.hy-library-dialog').close();this.update();this.updateEdition();};
    this.requestLeave(run);
  }
  requestLeave(run){
    if(this.hasUnsavedFloor()){this.pendingLoad=run;this.root.querySelector('.hy-discard-dialog').showModal();}else run?.();
  }
  hasUnsavedFloor(){
    return this.history.dirty||this.hasDraft&&JSON.stringify(this.originalDraft?null:this.history.current)!==this.floorBase;
  }
  openFloor(){
    this.store=new RoomStore(this.storage);
    this.floorPreview?.dispose();
    this.floorPreview=new HybridScene(this.root.querySelector('.hy-floor-preview'),{...this.sceneOptions,getFloor:()=>domainFloors.find(f=>f.key===this.target)||{key:this.target,number:0,label:'Lobby'}});
    this.updateFloor();this.root.querySelector('.hy-floor-dialog').showModal();
  }
  updateFloor(){
    const q=s=>this.root.querySelector(s),applied=this.store.floor(this.target);
    this.targetBase=this.store.floorRevision(this.target);
    q('.hy-floor-select').value=this.target;
    q('.hy-floor-summary').textContent=`แบบที่จะใช้: ${this.history.current.name||'ไม่มีชื่อ'} · ${this.history.current.objects.length} ชิ้น${applied?` · จะแทนแบบ “${applied.name}” ของชั้นนี้`:''}`;
    q('.hy-floor-feedback').textContent='';
    q('.hy-unapply').disabled=!applied;
    q('.hy-visit-floor').hidden=!applied;
    this.floorPreview?.render(this.history.current);
  }
  useObject(id,room=this.history.current){
    const o=room.objects.find(o=>o.id===id);if(!o)return;
    const a=interactionFor(o);
    if(a.type==='elevator')return this.root.querySelector('.hy-play-elevator').showModal();
    if(a.type==='floor')return this.requestLeave(()=>this.onVisitFloor?.(a.floor));
    this.feedback(o.kind==='duo'?'Zuri และวางใจ · ตัวละครประกอบฉาก ยังไม่ใช่สถานะ agent สด':o.kind.startsWith('avatar-')?`${catalog[o.kind].name} · ตัวประกอบภาพ ยังไม่ผูกกับ agent หรือ role`: `${catalog[o.kind].name} · กลับไปแต่งเพื่อย้าย ปรับขนาด หรือทำสำเนา`);
  }
  async copyBrief(){
    const room=clone(this.history.current);room.brief=this.root.querySelector('.hy-brief').value;
    const prompt=`ช่วยปรับแบบห้อง Visual Office ตามโจทย์: ${room.brief||'ปรับพื้นที่ให้ใช้งานง่าย'}\nคง schema office-room/v1 ส่งเฉพาะ JSON ห้ามเพิ่ม key/URL/business/agent ใช้ kind: ${Object.keys(catalog).join(', ')}; background: ${Object.keys(backgrounds).join(', ')}; x 8..92, y 18..94, scale .6..1.5, flip/locked boolean; id ไม่ซ้ำ; ไม่เกิน40ชิ้น; รักษาของที่ locked=true อย่าเปลี่ยน identity ตัวละคร Avatar กลางเป็นเพียงตัวประกอบภาพ ห้ามผูกกับ agent, role หรือสถานะธุรกิจจริง\noptional object fields: interaction = {type:"none"|"elevator"|"tasks"} หรือ {type:"popup",title:string<=80,body:string<=1000} หรือ {type:"floor",floor:หนึ่งใน ${previewFloors.map(f=>f.key).join(',')}}; effects = {opacity:.25..1,shadow:0..24,glow:boolean,hover:"none"|"lift"|"highlight"}; ห้ามใส่ script หรือ CSS\nแบบปัจจุบัน:\n${JSON.stringify(room,null,2)}`;
    try{await this.root.ownerDocument.defaultView.navigator.clipboard.writeText(prompt);this.feedback('คัดลอกโจทย์และแบบแล้ว · นำไปวางในแชต AI ได้');}
    catch{this.root.querySelector('.hy-import').value=prompt;this.feedback('เข้าถึงคลิปบอร์ดไม่ได้ · แสดงข้อความให้เลือกคัดลอกในช่องด้านล่าง');}
  }
  exportRoom(){
    this.download(this.history.current,'visual-office-room.json');this.feedback('ส่งออกแบบ JSON แล้ว');
  }
  reviewProposal(){
    const q=s=>this.root.querySelector(s);
    try{
      this.proposal=parseRoomJSON(q('.hy-import').value);
      for(const o of this.history.current.objects.filter(o=>o.locked)){
        if(JSON.stringify(this.proposal.objects.find(p=>p.id===o.id))!==JSON.stringify(o))throw Error('ข้อเสนอเปลี่ยนของที่ล็อกไว้ กรุณาปลดล็อกก่อนหรือให้ AI คงชิ้นนั้น');
      }
      const d=roomDiff(this.history.current,this.proposal);
      this.proposalBase=JSON.stringify(this.history.current);
      q('.hy-diff').textContent=`เพิ่ม ${d.added} · นำออก ${d.removed} · ปรับ ${d.changed} ชิ้น${d.background?' · เปลี่ยนฉาก':''}${d.name?' · เปลี่ยนชื่อ':''}${d.brief?' · เปลี่ยนโจทย์':''}${d.navigation?' · ปรับทางเดิน/จุดใช้งาน':''}${d.skeletonAlignment||d.skeletonParts?' · ปรับแนวโครง 3D':''}${d.officeArt?' · เปลี่ยนชุดภาพอ้างอิง':''} — ยังไม่เปลี่ยนแบบปัจจุบัน`;
      this.proposalScene?.dispose();this.proposalScene=new HybridScene(q('.hy-proposal-scene'),this.sceneOptions);this.proposalScene.render(this.proposal);
      q('.hy-proposal').hidden=false;this.feedback('ตรวจแบบผ่าน · ดูข้อเสนอก่อนรับเข้าแบบร่าง');
    }catch(err){this.proposal=null;q('.hy-proposal').hidden=true;this.feedback(err.message);}
  }
  dispose(){
    this.characterLab?.dispose();
    this.root.ownerDocument.defaultView?.removeEventListener('beforeunload',this.beforeUnload);
    this.storageRecovery?.dispose();this.skeletonEditor?.dispose();this.blueprintPanel?.dispose();this.navEditor?.dispose();this.scene.dispose();this.floorPreview?.dispose();this.proposalScene?.dispose();this.currentScene?.dispose();this.fileScene?.dispose();
    this.root.querySelectorAll('dialog').forEach(d=>{if(d.open)d.close();});this.root.replaceChildren();
  }
}
