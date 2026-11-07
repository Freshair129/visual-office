import {isOfficeFloor} from './office-floor-registry.js';
import {StudioScene} from './studio-scene.js';
import {StudioHistory,readStudioState,saveStudioState,levels} from './studio-state.js';
import {icon} from './icons.js';
import {ArtStudio} from './studio-art.js';
import {HybridStudio} from './hybrid-studio.js';
import {NativeStudio} from './native-studio.js';
import {TycoonStudio} from './tycoon-studio.js';
import {TycoonStore} from './tycoon-state.js';
import {RoomStore} from './hybrid-state.js';
import {floorByKey} from './domain-office.js';

const names={starter:'Starter',studio:'Studio',signature:'Signature'};
const descriptions={starter:'เรียบง่าย พร้อมเริ่มวัน',studio:'ไม้โทนอุ่น • สีเขียวสบายตา',signature:'วัสดุพิเศษ • รายละเอียดทอง'};
export class DesignStudio {
  constructor(root,{onExit,onVisitFloor,initialFloor,Scene=StudioScene,storage,getFloorTasks,onOpenTask,onOpenWork}={}) {
    const document=root.ownerDocument;
    this.root=root;this.selected='all';this.Scene=Scene;
    try{this.storage=storage??window.localStorage;}catch{this.storage=null;}
    this.history=new StudioHistory(readStudioState(this.storage));
    root.innerHTML=`
      <header class="studio-header"><button class="studio-back" type="button" aria-label="กลับล็อบบี้">${icon('arrow-right')}</button><div><span class="studio-eyebrow">ZURI · DESIGN STUDIO</span><h1 tabindex="-1">พื้นที่เล็ก ๆ ในแบบของคุณ</h1></div><span class="studio-sandbox">ฉากทดลอง</span></header>
      <nav class="studio-modes" aria-label="พื้นที่ออกแบบ"><button type="button" data-studio-mode="hybrid" aria-pressed="true">แต่งห้องแบบผสม</button><button type="button" data-studio-mode="native" aria-pressed="false">แก้ฉาก 3D ประจำชั้น</button><button type="button" data-studio-mode="art" aria-pressed="false">เทียบ 3 สไตล์</button><button type="button" data-studio-mode="model" aria-pressed="false">โมเดลต้นแบบ 3D เดิม</button></nav>
      <div class="studio-hybrid-host"></div>
      <div class="studio-native-host studio-hybrid-host" hidden></div>
      <div class="studio-art-host"></div>
      <div class="studio-layout">
        <section class="studio-viewport" aria-label="ห้องทดลองตกแต่งสำนักงาน">
          <div class="studio-scene"></div>
          <div class="studio-room-label"><span class="studio-room-symbol">${icon('office')}</span><span><strong>ห้องตัวอย่าง</strong><small>4 โต๊ะทดลอง · ไม่มี agent จริง</small></span></div>
          <div class="studio-fallback" hidden><strong>แสดงฉาก 3D ไม่ได้</strong><span>ยังเลือกและบันทึกชุดตกแต่งด้านข้างได้</span></div>
          <div class="studio-camera"><button type="button" data-camera="rotate" aria-label="หมุนห้อง">${icon('rotate-right')}</button><button type="button" data-camera="out" aria-label="ซูมออก">${icon('minus')}</button><button type="button" data-camera="in" aria-label="ซูมเข้า">${icon('plus')}</button><button type="button" data-camera="reset" aria-label="คืนมุมกล้อง">${icon('focus')}</button></div>
          <span class="studio-scene-hint">ลากเพื่อหมุน · แตะโต๊ะเพื่อเลือก</span>
        </section>
        <aside class="studio-editor" aria-label="ปรับแต่งห้องทดลอง">
          <div class="studio-editor-heading"><span class="studio-eyebrow">MAKE IT YOURS</span><h2>ลองแต่งออฟฟิศ</h2><p>ทุกแบบลองได้ฟรีในห้องนี้</p></div>
          <fieldset class="studio-target"><legend>เปลี่ยนโต๊ะชุดไหน</legend><div>${['all','0','1','2','3'].map((key,i)=>`<button type="button" data-slot="${key}" aria-pressed="${i===0}">${i===0?'ทุกโต๊ะ':`โต๊ะ ${i}`}</button>`).join('')}</div></fieldset>
          <div class="studio-tier-list" aria-label="ชุดโต๊ะสามระดับ">${levels.map((tier,i)=>`<button type="button" class="studio-tier" data-tier="${tier}" aria-pressed="false"><span class="studio-mini-desk ${tier}" aria-hidden="true"><i></i><b></b><em></em></span><span class="studio-tier-copy"><small>COLLECTION 0${i+1}</small><strong>${names[tier]}</strong><span>${descriptions[tier]}</span></span><span class="studio-tier-check" aria-hidden="true">✓</span></button>`).join('')}</div>
          <div class="studio-room-options"><label for="studio-room-style">วัสดุห้อง<select id="studio-room-style">${levels.map(tier=>`<option value="${tier}">${names[tier]}</option>`).join('')}</select></label><label class="studio-toggle"><span>เพิ่มมุมพักด้านข้าง<small>ขยายฉากของห้องเดิม</small></span><input type="checkbox" id="studio-wing"></label><label class="studio-toggle"><span>ตัวละครทดสอบท่านั่ง<small>หุ่นจำลองที่โต๊ะ 1</small></span><input type="checkbox" id="studio-mannequin"></label><button class="studio-plant" type="button">${icon('rotate-right')}<span>ย้ายต้นไม้ · <b>มุมทางเข้า</b></span></button></div>
          <div class="studio-save"><p role="status" aria-live="polite" class="studio-feedback">แบบทดลอง บันทึกเฉพาะเบราว์เซอร์นี้</p><button class="studio-apply" type="button" disabled>ใช้แบบนี้</button><div><button type="button" class="studio-undo" disabled>${icon('rotate-left')}ย้อนกลับ</button><button type="button" class="studio-cancel" disabled>คืนแบบที่บันทึก</button></div></div>
          <details class="studio-asset-details"><summary>ไฟล์โมเดลและรายละเอียดฉาก</summary><p>ฉากศิลป์ v0.1 · หน่วยเมตร · ไม่มีข้อมูลธุรกิจ</p><output class="studio-metrics">กำลังเตรียมโมเดล…</output><div>${levels.map(tier=>`<a href="./assets/models/studio/desk-${tier}.glb" download>โต๊ะ ${names[tier]} · GLB</a>`).join('')}<a href="./assets/models/studio/room-starter.glb" download>ห้อง Starter · GLB</a></div></details>
        </aside>
      </div><footer class="studio-footer">DESIGN SANDBOX <span>การตกแต่งไม่เปลี่ยน Business, domain หรือความสามารถของ agent</span></footer>`;
    this.root.querySelector('.studio-back').onclick=()=>this.mode==='native'?this.native?.requestLeave(onExit):this.hybrid?this.hybrid.requestLeave(onExit):onExit?.();
    this.root.querySelectorAll('[data-slot]').forEach(button=>button.onclick=()=>this.select(button.dataset.slot));
    this.root.querySelectorAll('[data-tier]').forEach(button=>button.onclick=()=>{
      const desks=[...this.history.current.desks];
      if(this.selected==='all')desks.fill(button.dataset.tier);else desks[Number(this.selected)]=button.dataset.tier;
      this.change({desks});
    });
    root.querySelector('#studio-room-style').onchange=event=>this.change({room:event.target.value});
    root.querySelector('#studio-wing').onchange=event=>this.change({wing:event.target.checked});
    root.querySelector('#studio-mannequin').onchange=event=>this.change({mannequin:event.target.checked});
    root.querySelector('.studio-plant').onclick=()=>this.change({plant:(this.history.current.plant+1)%3});
    root.querySelector('.studio-undo').onclick=()=>{this.history.undo();this.update();};
    root.querySelector('.studio-cancel').onclick=()=>{this.history.cancel();this.update();this.feedback('กลับเป็นแบบที่บันทึกแล้ว');};
    root.querySelector('.studio-apply').onclick=()=>{
      if(saveStudioState(this.storage,this.history.current)){this.history.commit();this.update(false);this.feedback('บันทึกแบบแล้ว · อยู่ในเบราว์เซอร์นี้เท่านั้น');}
      else this.feedback('เบราว์เซอร์บันทึกไม่ได้ ลองดูแบบต่อได้ แต่ยังไม่ได้บันทึก');
    };
    root.querySelectorAll('[data-camera]').forEach(button=>button.onclick=()=>{
      const action=button.dataset.camera;if(action==='reset')this.scene?.resetCamera();else if(action==='rotate')this.scene?.rotate();else this.scene?.zoom(action==='in'?.1:-.1);
    });
    this.art=new ArtStudio(root.querySelector('.studio-art-host'),{storage:this.storage});
    this.nativeOptions={storage:this.storage,onVisitFloor,initialFloor};
    this.hybrid=new HybridStudio(root.querySelector('.studio-hybrid-host'),{storage:this.storage,onVisitFloor,initialFloor,getFloorTasks,onOpenTask,onOpenWork,onEditNative:(floor,file)=>this.hybrid.requestLeave(()=>{
      const open=()=>{this.setMode('native');this.native.loadFloor(floor);if(file)this.native.reviewFile(JSON.stringify(file));};
      if(this.native)this.native.requestLeave(open);else open();
    })});
    this.tycoonOptions={storage:this.storage,onVisitFloor,floor:initialFloor};
    const tycoonTab=document.createElement('button');tycoonTab.type='button';tycoonTab.dataset.studioMode='tycoon';tycoonTab.textContent='แต่ง Tycoon GLB';root.querySelector('.studio-modes').prepend(tycoonTab);
    const tycoonHost=document.createElement('div');tycoonHost.className='studio-tycoon-host';tycoonHost.hidden=true;root.querySelector('.studio-modes').after(tycoonHost);
    root.querySelectorAll('[data-studio-mode]').forEach(b=>b.onclick=()=>this.mode==='tycoon'&&b.dataset.studioMode!=='tycoon'?this.tycoon.requestLeave(()=>this.setMode(b.dataset.studioMode)):this.mode==='native'&&b.dataset.studioMode!=='native'?this.native.requestLeave(()=>this.setMode(b.dataset.studioMode)):this.setMode(b.dataset.studioMode));
    this.root.querySelector('.studio-back').onclick=()=>this.mode==='tycoon'?this.tycoon.requestLeave(onExit):this.mode==='native'?this.native?.requestLeave(onExit):this.hybrid?this.hybrid.requestLeave(onExit):onExit?.();
    const initialEdition=floorByKey(initialFloor)?new RoomStore(this.storage).edition(initialFloor):null;
    const tycoonSelected=isOfficeFloor(initialFloor)&&new TycoonStore(this.storage).get(initialFloor)?.edition==='tycoon3d';
    this.setMode(tycoonSelected?'tycoon':initialEdition==='native3d'?'native':'hybrid');
    this.update();root.querySelector('h1').focus({preventScroll:true});
  }
  setMode(mode){
    this.mode=mode;
    const tycoonHost=this.root.querySelector('.studio-tycoon-host');tycoonHost.hidden=mode!=='tycoon';
    if(mode==='tycoon'&&!this.tycoon)this.tycoon=new TycoonStudio(tycoonHost,this.tycoonOptions);
    this.tycoon?.setVisible(mode==='tycoon');
    const nativeHost=this.root.querySelector('.studio-native-host');nativeHost.hidden=mode!=='native';
    if(mode==='native'&&!this.native)this.native=new NativeStudio(nativeHost,this.nativeOptions);
    this.native?.setVisible(mode==='native');
    const model=mode==='model';
    this.root.querySelector('.studio-layout').hidden=!model;
    this.root.querySelector('.studio-art-host').hidden=mode!=='art';
    this.root.querySelector('.studio-hybrid-host').hidden=mode!=='hybrid';
    this.hybrid?.scene.cancelDrag();
    this.root.querySelector('.studio-footer').hidden=!model;
    this.root.querySelectorAll('[data-studio-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studioMode===mode)));
    if(!model){this.scene?.dispose();this.scene=null;return;}
    this.art?.cancelDrag();
    if(!this.scene)try{
      this.root.querySelector('.studio-fallback').hidden=true;
      this.root.querySelector('.studio-camera').hidden=false;
      this.root.querySelector('.studio-scene-hint').hidden=false;
      this.scene=new this.Scene(this.root.querySelector('.studio-scene'),{onSelect:index=>this.select(String(index)),onMetrics:metrics=>{
        this.root.querySelector('.studio-metrics').textContent=`${metrics.triangles.toLocaleString()} triangles · ${metrics.calls} draw calls · ${metrics.geometries} geometries`;
      },onUnavailable:()=>this.unavailable()});
      this.update();this.scene.select(this.selected==='all'?null:Number(this.selected));
    }catch{this.unavailable();}
  }
  feedback(text){this.root.querySelector('.studio-feedback').textContent=text;}
  unavailable(){
    this.root.querySelector('.studio-fallback').hidden=false;
    this.root.querySelector('.studio-camera').hidden=true;
    this.root.querySelector('.studio-scene-hint').hidden=true;
    this.root.querySelector('.studio-metrics').textContent='WebGL ไม่พร้อม · ยังเลือกชุดตกแต่งได้';
  }
  select(key){
    this.selected=['all','0','1','2','3'].includes(key)?key:'all';
    this.scene?.select(this.selected==='all'?null:Number(this.selected));this.update(false);
  }
  change(patch){this.history.change(patch);this.update();}
  update(rebuild=true){
    const state=this.history.current;
    this.root.querySelectorAll('[data-slot]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.slot===this.selected)));
    const tier=this.selected==='all'?(new Set(state.desks).size===1?state.desks[0]:null):state.desks[Number(this.selected)];
    this.root.querySelectorAll('[data-tier]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tier===tier)));
    this.root.querySelector('#studio-room-style').value=state.room;
    this.root.querySelector('#studio-wing').checked=state.wing;
    this.root.querySelector('#studio-mannequin').checked=state.mannequin;
    this.root.querySelector('.studio-plant b').textContent=['มุมทางเข้า','ริมหน้าต่างด้านหน้า','ข้างโซฟา'][state.plant];
    this.root.querySelector('.studio-apply').disabled=!this.history.dirty;
    this.root.querySelector('.studio-cancel').disabled=!this.history.dirty;
    this.root.querySelector('.studio-undo').disabled=!this.history.past.length;
    this.feedback(this.history.dirty?'กำลังลองแบบ · ยังไม่ได้บันทึก':'แบบทดลอง บันทึกเฉพาะเบราว์เซอร์นี้');
    if(rebuild)this.scene?.setState(state);
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.scene?.dispose();this.art?.dispose();this.hybrid?.dispose();this.native?.dispose();this.tycoon?.dispose();this.root.replaceChildren();}
}
