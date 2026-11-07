import {OFFICE_FLOORS,isOfficeFloor} from './office-floor-registry.js';
import {showDepartmentDesign} from './office-design-panel.js';
import {designId} from './office-world-identity.js';
import {TYCOON_BLUEPRINT_OPTIONS} from './office-design-limits.js';
import {buildFloorSpaceGuide} from './office-space-guide.js';
import {OFFICE_DEPARTMENTS} from './office-departments.js';
import {describeAreaDimensions} from './office-plan-dimensions.js';
import {TycoonScene} from './tycoon-scene.js';
import {TycoonStore,createTycoonRoom} from './tycoon-state.js';
import {changeTycoonDoor} from './tycoon-activity.js';
import {tycoonPlan} from './tycoon-blueprint.js';
import {blueprintLayout} from './office-blueprints.js';
import {TycoonData} from './tycoon-data.js';
import {safeZuriLoginUrl} from './zuri-connector.js';
const names={...Object.fromEntries(OFFICE_FLOORS.map(f=>[f.key,f.label])),building:'ZURI · OFFICE'};
const stateNames={CHECKING:'กำลังตรวจการเชื่อมต่อ',UNAVAILABLE:'ยังไม่เชื่อม Zuri',ERROR:'อ่านข้อมูลไม่สำเร็จ',FORBIDDEN:'ไม่มีสิทธิ์อ่านข้อมูล',AUTH_REQUIRED:'ต้องเข้าสู่ระบบ Zuri',SELECT_BUSINESS:'เลือก Business',LOADING:'กำลังอ่าน Projects',READY:'อ่าน Projects แล้ว',EMPTY:'ยังไม่มี Projects'};
const labels={'marketing-board':'บอร์ด Campaigns','marketing-ask':'Ask Marketing',reception:'Reception',lift:'ลิฟต์',directory:'บอร์ดเลือกชั้น','project-board':'บอร์ด Projects',welcome:'รู้จัก Projects',meeting:'โต๊ะประชุม',artifacts:'ตู้ผลงาน',coffee:'มุมกาแฟ',lounge:'มุมพัก'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(label,fn,cls)=>{const b=el('button',label,cls);b.type='button';b.onclick=fn;return b;};
export class TycoonView{
  constructor(root,{onNavigate,onStudio,onLegacy,Scene=TycoonScene,storage,connector,Data=TycoonData,dataOptions={}}={}){
    this.onNavigate=onNavigate;this.onStudio=onStudio;this.Scene=Scene;this.store=new TycoonStore(storage);this.root=root;this.onLegacy=onLegacy;this.frameRate=0;
    this.host=el('section','','tycoon-world');this.host.hidden=true;root.prepend(this.host);
    this.host.innerHTML=`<div class="tycoon-stage"></div><header class="tycoon-hud"><button class="tycoon-home" type="button" aria-label="กลับหน้าอาคาร"><img src="./assets/brand/zuri-iconic-primary.svg" alt="Zuri"></button><div class="tycoon-title"><small>ZURI HEADQUARTERS</small><h1 tabindex="-1">ZURI · OFFICE</h1></div><button class="tycoon-connection" type="button">เชื่อม Zuri</button></header><div class="tycoon-chapter"><span class="tycoon-edition">GLB PROTOTYPE · ฉากตัวอย่าง</span><p class="tycoon-hint"></p></div><div class="tycoon-camera"><button type="button" data-zoom="in" aria-label="ซูมเข้า">+</button><button type="button" data-zoom="out" aria-label="ซูมออก">−</button><button type="button" data-zoom="reset">คืนมุม</button></div><div class="tycoon-entry"></div><button type="button" data-scene-retry class="tycoon-retry">โหลดฉาก 3D ใหม่</button><p class="tycoon-notice" role="status"></p><nav class="tycoon-dock" aria-label="เมนู Office"><button type="button" data-nav="building"><b>⌂</b><span>อาคาร</span></button><button type="button" data-nav="floors"><b>▤</b><span>ชั้น</span></button><button type="button" data-nav="work"><b>▦</b><span>งาน</span></button><button type="button" data-nav="studio"><b>✎</b><span>แต่งห้อง</span></button></nav><dialog class="tycoon-sheet" aria-labelledby="tycoon-sheet-title"><header><h2 id="tycoon-sheet-title"></h2><button type="button" class="tycoon-close" aria-label="ปิดรายละเอียด">×</button></header><div class="tycoon-sheet-body"></div></dialog>`;
    this.host.querySelector('[data-scene-retry]').onclick=()=>this.retryScene();
    this.stage=this.host.querySelector('.tycoon-stage');this.sheet=this.host.querySelector('dialog');this.content=this.host.querySelector('.tycoon-sheet-body');
    const frameButton=button('30 FPS',()=>{this.frameRate=this.frameRate?0:30;frameButton.setAttribute('aria-pressed',String(this.frameRate===30));this.scene?.setFrameRate?.(this.frameRate);});
    frameButton.dataset.frameRate='';frameButton.setAttribute('aria-label','โหมดประหยัดภาพ 30 FPS');frameButton.setAttribute('aria-pressed','false');this.host.querySelector('.tycoon-camera').append(frameButton);
    this.host.querySelector('.tycoon-home').onclick=()=>onNavigate?.(null);
    this.host.querySelector('.tycoon-connection').onclick=()=>this.connection();this.host.querySelector('.tycoon-close').onclick=()=>this.closeSheet();
    this.sheet.addEventListener('close',()=>(this.returnFocus?.isConnected?this.returnFocus:this.host.querySelector('.tycoon-connection'))?.focus?.());
    this.host.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{
      const action=b.dataset.nav;if(action==='building')onNavigate?.(null);else if(action==='floors')this.directory();else if(action==='work')this.work();else onStudio?.(this.floor==='building'?'lobby':this.floor);
    });
    this.host.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>b.dataset.zoom==='reset'?this.scene?.reset():this.scene?.zoom(b.dataset.zoom==='in'?.1:-.1));
    this.data=new Data(connector,{...dataOptions,onChange:state=>{
      if(this.data?.dynamic){this.onDataChange?.(state);return;}
      if(state.businessId!==this.lastBusiness){this.lastBusiness=state.businessId;if(this.scene&&isOfficeFloor(this.floor)){this.loadRoom();this.scene.setScene(this.floor,this.room,{demoActors:!state.businessId,allowProbe:!state.businessId});}}
      this.host.querySelector('.tycoon-edition').textContent=state.synthetic?'SYNTHETIC · ข้อมูลจำลอง · ไม่เชื่อม live':'GLB PROTOTYPE · ฉากตัวอย่าง';
      this.host.querySelector('.tycoon-connection').textContent=state.businesses.find(b=>b.id===state.businessId)?.name||stateNames[state.status];
      if(this.sheet.open&&this.sheetMode==='ask')this.renderAskResult();else if(this.sheet.open&&this.sheetMode==='work')this.work(false);else if(this.sheet.open&&this.sheetMode==='connect')this.connection(false);
    }});this.ready=this.data.connect();
  }
  show(floor){this.closeSheet();this.floor=floor||'building';void this.data.setDomain(this.floor==='growth'?'growth':['projects','lobby','building'].includes(this.floor)?'projects':null);this.host.hidden=false;this.host.querySelector('h1').textContent=names[this.floor];
    this.loadRoom();
    this.host.querySelector('.tycoon-hint').textContent=this.floor==='building'?'เข้าออฟฟิศที่ Lobby หรือแตะชั้น Projects':'แตะวัตถุเพื่อเปิดงาน · ลากพื้นว่างเพื่อเลื่อน · เลื่อนล้อเมาส์เพื่อซูม';
    this.host.querySelector('.tycoon-notice').textContent='ฉากต้นแบบ · การตกแต่งไม่เปลี่ยนข้อมูลหรือ role ของ Agent';
    const entry=this.host.querySelector('.tycoon-entry');entry.replaceChildren();
    if(this.floor==='building'){entry.append(button('เข้าออฟฟิศ → G Lobby',()=>this.onNavigate?.('lobby'),'tycoon-primary'),button('01 · Projects',()=>this.onNavigate?.('projects')),button(names.growth,()=>this.onNavigate?.('growth')));}
    else {entry.append(button('พื้นที่และการใช้งาน',()=>this.spaces()),button('ทีมและ Workflow',()=>showDepartmentDesign(this)),button('วัตถุในชั้นนี้',()=>this.objects()),button('ใช้ฉากเดิม',()=>this.onLegacy?.(this.floor)));}
    this.retryScene();
    this.host.querySelectorAll('[data-nav]').forEach(b=>b.setAttribute('aria-current',b.dataset.nav==='building'&&this.floor==='building'?'page':'false'));
  }
  retryScene(){
    if(this.host.hidden)return;
    this.host.querySelector('.tycoon-notice').textContent='กำลังโหลดฉากใหม่ · ข้อมูลและแบบร่างยังอยู่';
    const generation=this.renderGeneration=(this.renderGeneration||0)+1;
    this.scene?.dispose();this.scene=null;this.stage.replaceChildren();
    try{this.scene=new this.Scene(this.stage,{frameRate:this.frameRate,onPick:id=>this.pick(id),onStatus:message=>{if(generation===this.renderGeneration)this.host.querySelector('.tycoon-notice').textContent=message;},onError:message=>{if(generation===this.renderGeneration)this.host.querySelector('.tycoon-notice').textContent=message;}});this.scene.setScene(this.floor,this.room,{demoActors:!this.data.state.businessId,allowProbe:!this.data.state.businessId});}catch{this.host.querySelector('.tycoon-notice').textContent='แสดง 3D ไม่ได้ · ใช้ปุ่มวัตถุหรือเมนูด้านล่างเพื่อไปต่อ';}
  }
  loadRoom(){this.roomGeneration=(this.roomGeneration||0)+1;const saved=isOfficeFloor(this.floor)?this.store.get(this.floor):null;this.revision=saved?.revision||0;this.room=this.floor==='building'?null:this.data.state.businessId?createTycoonRoom(this.floor):saved?.room||createTycoonRoom(this.floor);}
  openSheet(title,mode,open=true){this.sheetMode=mode;this.host.querySelector('#tycoon-sheet-title').textContent=title;const restore=this.sheet.open&&this.content.contains(document.activeElement);this.content.replaceChildren();if(restore)this.host.querySelector('.tycoon-close').focus();if(open&&!this.sheet.open){this.returnFocus=document.activeElement;if(this.sheet.showModal)this.sheet.showModal();else this.sheet.setAttribute('open','');}return this.content;}
  closeSheet(){if(this.sheet?.open){if(this.sheet.close)this.sheet.close();else this.sheet.removeAttribute('open');}this.sheetMode=null;}
  directory(){const body=this.openSheet('บอร์ดหน้าลิฟต์','floors');body.append(el('p','ชั้นตัวอย่างที่เปิดให้ทดลอง · รายชื่อ domain จริงรอข้อมูลที่ Zuri อนุญาต'));for(const floor of OFFICE_FLOORS.map(f=>f.key))body.append(button(names[floor],()=>{this.closeSheet();this.onNavigate?.(floor);},'tycoon-floor-choice'));}
  spaces(){
    const body=this.openSheet('พื้นที่และการใช้งาน','spaces'),guide=buildFloorSpaceGuide(this.floor,this.room),department=OFFICE_DEPARTMENTS.find(d=>d.key===this.floor),plan=this.room?.blueprintPlan;
    body.append(el('p','เลือกพื้นที่เพื่อดูหน้าที่ของห้องและซูมไปยังตำแหน่งในแปลน'));
    if(this.room)body.append(el('p',`ขนาดภายในชั้น ${this.room.width} × ${this.room.depth} ม. · ${(this.room.width*this.room.depth).toFixed(0)} ตร.ม.`));
    if(!guide.length){body.append(el('p','แปลนนี้ยังไม่ได้แบ่งพื้นที่ห้อง · เพิ่มพื้นที่ได้ใน Studio'));return;}
    for(const use of guide){
      const card=el('article','','tycoon-project-card');card.dataset.spaceArea=use.areaId;card.append(el('h3',use.name),el('p',use.purpose));
      const area=plan.areas.find(area=>area.id===use.areaId),d=describeAreaDimensions(plan,area);
      const parentArea=plan.areas.filter(candidate=>candidate.id!==area.id&&candidate.width*candidate.depth>area.width*area.depth+1e-6&&candidate.x<=area.x+1e-6&&candidate.z<=area.z+1e-6&&candidate.x+candidate.width>=area.x+area.width-1e-6&&candidate.z+candidate.depth>=area.z+area.depth-1e-6).sort((a,b)=>a.width*a.depth-b.width*b.depth)[0];
      if(parentArea)card.append(el('p','พื้นที่ย่อยใน '+parentArea.name+' · ไม่นับพื้นที่ซ้ำกับโซนหลัก'));
      card.append(el('p',`${d.basis==='clear-room'?'ขนาดใช้สอยภายใน':'ขนาดพื้นที่ตามแบบ'} ${d.widthM.toFixed(1)} × ${d.depthM.toFixed(1)} ม. · ${d.areaM2.toFixed(1)} ตร.ม.`,'tycoon-space-dimensions'));
      const activities=el('ul');for(const activity of use.activities)activities.append(el('li',activity));card.append(activities);
      const roles=use.roleKeys.map(key=>department?.roles.find(role=>role.key===key)?.title).filter(Boolean),steps=use.workflowStepKeys.map(key=>department?.workflows.flatMap(workflow=>workflow.steps).find(step=>step.key===key)?.label).filter(Boolean);
      if(roles.length)card.append(el('p','บทบาทตามแบบ: '+roles.join(' · ')));if(steps.length)card.append(el('p','ลำดับงานที่ใช้พื้นที่: '+steps.join(' → ')));
      const notice=el('p'),focus=button('ดูพื้นที่นี้',()=>{const result=this.scene?.ready!==false?this.scene?.focusArea?.(use.areaId):null;if(result?.ok){this.closeSheet();this.host.querySelector('.tycoon-notice').textContent=use.name+' · '+use.purpose;}else notice.textContent=result?.message||'กำลังโหลดฉาก · ลองอีกครั้งเมื่อโมเดลพร้อม';});
      focus.dataset.area=use.areaId;notice.setAttribute('role','status');card.append(focus,notice);body.append(card);
    }
    body.append(button('ดูทีมและ Workflow',()=>showDepartmentDesign(this)));
  }
  doors(){try{return this.room?blueprintLayout(tycoonPlan(this.room),TYCOON_BLUEPRINT_OPTIONS).doors:[];}catch{return [];}}
  objects(){const body=this.openSheet('วัตถุในชั้นนี้','objects');for(const door of this.doors())body.append(button(`${door.label} · ${door.open?'เปิด':'ปิด'} — กดสลับ`,()=>this.toggleDoor(door.id)));if(!this.data.state.businessId&&this.scene?.probeVisible?.())body.append(button('ตัวละครตัวอย่าง (จำลอง)',()=>this.pick('demo-agent'),'tycoon-object-choice'));for(const o of this.room?.objects||[])body.append(button(o.asset?.name||labels[o.id]||o.id,()=>this.pick(o.id),'tycoon-object-choice'));}
  pick(id){if(this.floor==='building'){if(id==='lobby')this.onNavigate?.('lobby');if(id==='projects')this.onNavigate?.('projects');if(id==='growth')this.onNavigate?.('growth');return;}
    if(id.startsWith('door:')){this.toggleDoor(id.slice(5).replace(/:(frame|panel)$/, ''));return;}
    if(id==='demo-agent'){if(this.data.state.businessId||!this.scene?.probeVisible?.())return;const body=this.openSheet('ตัวละครตัวอย่าง · ยังไม่ผูก Agent','agent');body.append(el('p','ใช้ทดสอบโมเดลและ animation เท่านั้น · ไม่มี role หรือสิทธิ์ธุรกิจจากตัวละครนี้'),button('โฟกัสตัวละครในฉาก',()=>{const result=this.scene?.focusProbe?.();this.closeSheet();if(!result?.ok)this.host.querySelector('.tycoon-notice').textContent=result?.message||'ตัวละครทดลองยังไม่พร้อม';}),button('ดูงานของชั้นนี้',()=>this.work()));return;}
    const object=this.room?.objects.find(o=>o.id===id);if(!object)return;
    if(object.intent==='marketing-ask')this.ask();else if(object.intent==='floors')this.directory();else if(object.intent==='connect')this.connection();else if(['projects','work'].includes(object.intent))this.work();
    else {const body=this.openSheet(object.asset?.name||labels[id]||id,'object');body.append(el('p',object.intent==='artifacts'?'ผลงานของ Project จะแสดงเมื่อ Zuri เปิด contract ที่รองรับ':object.intent==='meeting'?'เลือก Project จากบอร์ดเพื่อดูงาน · การวางโต๊ะไม่สร้างหรืออนุมัติแผนธุรกิจ':'ของตกแต่งในฉาก · บันทึกรูปแบบแยกแต่ละชั้น'),button(this.floor==='growth'?'ดู Campaigns และงาน':'ดู Projects และงาน',()=>this.work()));}
    const identifiers=el('details',''),heading=el('summary','รหัสแบบออกแบบสำหรับส่งต่อ Zuri'),identity=el('small','กำลังอ่านรหัส…'),floor=this.floor;identifiers.append(heading,identity);this.content.append(identifiers);
    void Promise.all([designId('floor',floor),designId('placement',floor+'/furniture/'+object.id),designId('asset',object.asset?'custom/'+object.asset.id:object.kind)]).then(([floorId,placementId,assetId])=>{if(identity.isConnected)identity.textContent=`Floor ID: ${floorId} · Placement ID: ${placementId} · Asset ID: ${assetId} · ยังไม่ได้ลงทะเบียนใน Zuri`;});
    if((['desk','sofa','coffee'].includes(object.kind)||(object.asset&&object.asset.interaction.mode!=='none'))&&!this.data.state.businessId)this.content.append(button('ลองเดินไปใช้งาน (จำลอง)',()=>{this.closeSheet();const result=this.scene?.startStation?.(`station:${object.id}`);this.host.querySelector('.tycoon-notice').textContent=result?.message||'ฉากยังไม่พร้อม';}));}
  async toggleDoor(id){
    const notice=this.host.querySelector('.tycoon-notice');if(this.data.state.businessId){notice.textContent='ฉากที่เชื่อม Business ยังอ่านอย่างเดียว · แก้และบันทึกได้ใน Studio แบบ local';return {ok:false,reason:'read-only'};}
    const changed=changeTycoonDoor(this.room,id,this.scene?.actorPositions||[]);if(!changed.ok){notice.textContent=changed.message;return changed;}
    const generation=this.roomGeneration;this.scene?.stopTest?.();
    const saved=await this.store.save(this.floor,changed.room,this.revision);if(generation!==this.roomGeneration||this.data.state.businessId)return saved;
    if(!saved.ok){notice.textContent=saved.reason==='conflict'?'มีฉบับใหม่จาก Studio · กลับเข้าชั้นอีกครั้งก่อนสลับประตู':'บันทึกไม่ได้ · ประตูยังคงสถานะเดิม';return saved;}
    this.room=changed.room;this.revision=saved.revision;this.scene?.setScene(this.floor,this.room,{preserveCamera:true});notice.textContent=changed.message+' · บันทึกเฉพาะชั้นนี้แล้ว';if(this.sheetMode==='objects')this.objects();return saved;
  }
  connection(open=true){const restoreSelect=this.sheetMode==='connect'&&document.activeElement===this.content.querySelector('select');const body=this.openSheet('เชื่อมต่อ Zuri','connect',open),state=this.data.state;body.append(el('p',(this.floor==='growth'?{READY:'อ่าน Campaigns แล้ว',EMPTY:'ยังไม่มี Campaigns',LOADING:'กำลังอ่าน Campaigns'}[state.status]:null)||stateNames[state.status]||'ยังไม่พร้อม'));
    const label=el('label','Business ที่มีสิทธิ์'),select=el('select'),option=(name,id)=>{const o=el('option',name);o.value=id;return o;};select.setAttribute('aria-label','เลือก Business');select.append(option('เลือก Business',''));
    for(const b of state.businesses)select.append(option(b.name,b.id));select.value=state.businessId;select.onchange=()=>{if(select.value)void this.data.selectBusiness(select.value);};label.append(select);body.append(label,button('ตรวจการเชื่อมต่ออีกครั้ง',()=>this.data.connect()));if(restoreSelect)select.focus();
    const loginUrl=state.synthetic?null:safeZuriLoginUrl(state.targetOrigin);if(loginUrl){const login=el('a','เปิดหน้าเข้าสู่ระบบ Zuri');login.href=loginUrl;login.target='_blank';login.rel='noopener noreferrer';body.append(login);}else body.append(el('p',state.synthetic?'โหมด synthetic · ปิดการเข้าสู่ระบบ live':'ยังไม่ทราบปลายทาง Zuri · เปิดตัวเชื่อมที่ตั้งค่าไว้ก่อน'));
    body.append(el('p','Office ใช้สิทธิ์และข้อมูลจาก Zuri · ฉากที่แต่งบันทึกในเครื่องนี้'));
  }
  work(open=true){if(!['projects','growth','lobby','building'].includes(this.floor)){showDepartmentDesign(this);return;}const marketing=this.floor==='growth',title=marketing?'Campaigns':'Projects';const body=this.openSheet(title+' · งานของชั้นนี้','work',open),state=this.data.state;
    body.append(el('p',marketing?({LOADING:'กำลังอ่าน Campaigns',READY:'อ่าน Campaigns แล้ว',EMPTY:'ยังไม่มี Campaigns',IDLE:'กดอ่านข้อมูลอีกครั้ง'}[state.status]||stateNames[state.status]||'ยังไม่พร้อม'):stateNames[state.status]||'ยังไม่พร้อม'));
    if(!state.businessId)body.append(button('เลือก Business / เชื่อม Zuri',()=>this.connection()));
    else {if(marketing)body.append(el('p',`แสดง ${state.records.length} Campaigns · จำนวนรายการที่แสดง ไม่ใช่ KPI`));body.append(button('อ่าน '+title+' อีกครั้ง',()=>this.data.refreshProjects()));for(const r of state.records){const card=el('article','','tycoon-project-card');card.append(el('strong',r.label),...(marketing?[el('small','Campaign ID: '+r.id)]:[]),el('span',r.status),el('p',marketing?'Campaign เป็นโครงการการตลาด ไม่ใช่จำนวนงานหรือผลลัพธ์ KPI':'รายละเอียด WorkItems และคำสั่ง Agent รอ contract จาก Zuri'));body.append(card);}if(state.truncated)body.append(el('p','แสดงบางรายการจาก Zuri · ยังไม่ได้โหลดทั้งหมด'));if(state.checkedAt)body.append(el('small','เวลาตรวจข้อมูล · '+state.checkedAt));}
    if(marketing)body.append(button('Ask Marketing',()=>this.ask()));
    body.append(el('p','ยังไม่มี API สั่ง Agent ของชั้นนี้ ที่ยืนยันสำหรับ Office จึงยังส่งคำสั่งจากฉากนี้ไม่ได้','tycoon-command-note'));
  }
  ask(){
    const body=this.openSheet('Ask Marketing · อ่านข้อมูลเท่านั้น','ask');
    body.append(el('p','สรุปจากข้อมูล Zuri แบบ deterministic · ไม่สั่ง Agent หรือส่งโฆษณา'));
    const form=el('form'),label=el('label','คำถาม Marketing (ไม่บังคับ)'),input=el('textarea');
    input.setAttribute('aria-label','คำถาม Marketing');input.setAttribute('aria-describedby','marketing-question-help marketing-question-count');
    input.placeholder='เว้นว่างเพื่อดูภาพรวม หรือถามเกี่ยวกับ Campaigns';label.append(input);
    const help=el('p','เว้นว่างเพื่อดูภาพรวม Marketing · ไม่เกิน 400 ตัวอักษรหลังตัดช่องว่างหัวท้าย');help.id='marketing-question-help';
    const count=el('small');count.id='marketing-question-count';count.setAttribute('aria-live','polite');
    const submit=el('button');submit.type='submit';
    const result=el('div','','tycoon-ask-result');result.setAttribute('aria-live','polite');
    input.oninput=()=>this.updateAskForm();
    form.onsubmit=e=>{e.preventDefault();if(submit.disabled)return;input.focus();void this.data.askMarketing(input.value).catch(()=>{result.textContent='เลือก Business และใช้คำถามไม่เกิน 400 ตัวอักษร';});};
    form.append(label,help,count,submit);body.append(form,result);
    body.append(el('div','','tycoon-ask-recovery'));
    this.renderAskResult();
  }
  updateAskForm(){
    const input=this.content.querySelector('textarea'),submit=this.content.querySelector('button[type=submit]');if(!input||!submit)return;
    const length=input.value.trim().length,invalid=length>400;
    input.setCustomValidity(invalid?'คำถามต้องไม่เกิน 400 ตัวอักษรหลังตัดช่องว่างหัวท้าย':'');input.setAttribute('aria-invalid',String(invalid));
    this.content.querySelector('#marketing-question-count').textContent=`${length}/400${invalid?' · เกินขีดจำกัด':''}`;
    submit.textContent=this.data.state.askStatus==='LOADING'?'กำลังอ่านข้อมูล…':length?'อ่านคำตอบจาก Zuri':'ดูภาพรวม Marketing';
    submit.disabled=!this.data.state.businessId||this.data.state.askStatus==='LOADING'||invalid;
  }
  renderAskResult(){const result=this.content.querySelector('.tycoon-ask-result');if(!result)return;result.replaceChildren();const {ask,askStatus}=this.data.state;this.updateAskForm();const recovery=this.content.querySelector('.tycoon-ask-recovery');if(recovery){recovery.replaceChildren();if(!this.data.state.businessId)recovery.append(button('เลือก Business / เชื่อม Zuri',()=>this.connection()));}result.append(el('p',({IDLE:'พร้อมอ่านข้อมูล',LOADING:'กำลังอ่านคำตอบ',READY:'ข้อมูลพร้อม',EMPTY:'ไม่มีข้อมูล',PARTIAL:'ข้อมูลบางส่วน',UNKNOWN:'ยังยืนยันข้อมูลไม่ได้',UNAVAILABLE:'ข้อมูลยังไม่พร้อม'}[askStatus]||stateNames[askStatus]||askStatus)));if(!ask)return;for(const section of ask.answer?.sections||[]){const card=el('article');card.append(el('strong',section.title||section.key||'ข้อมูล'),el('p',section.state||''));for(const key of ['count','value'])if(typeof section[key]==='number'||section[key]===null)card.append(el('p',key+': '+(section[key]===null?'ยังไม่ทราบ':section[key])));if(section.window)card.append(el('p',`ช่วงข้อมูล: ${section.window.from??'ยังไม่ทราบ'} → ${section.window.to??'ยังไม่ทราบ'}`));result.append(card);}for(const source of ask.sources||[])result.append(el('p',[source.source,source.state,source.reasonCode].filter(Boolean).join(' · ')));for(const reason of ask.unavailable||[])result.append(el('p',[reason.source,reason.reasonCode].filter(Boolean).join(' · ')));if(ask.generatedAt)result.append(el('small','เวลาสร้างคำตอบจาก Zuri · '+ask.generatedAt));}
  hide(){this.host.hidden=true;this.renderGeneration=(this.renderGeneration||0)+1;this.data.suspend();this.roomGeneration=(this.roomGeneration||0)+1;this.host.hidden=true;this.closeSheet();this.scene?.dispose();this.scene=null;}
  dispose(){this.hide();this.data.dispose();this.host.remove();}
}
