import {floorActorStates} from './office-agent-state-view.js';
import {sceneWorkspaceContext} from './scene-workspace-actions.js';
import {OfficeGridBuild} from './office-grid-build.js';
import {isOfficeSheet} from './office-scene-sheet.js';
import {domainFloors, floorByKey, floorAgents} from './domain-office.js';
import {icon} from './icons.js';
import {deriveItems, STALE_AFTER_MS} from './inbox-view.js';
import {LobbyView} from './lobby-view.js';
import {ZuriPanel} from './zuri-panel.js';
import {RoomStore,interactionFor,departmentStarterRoom,defaultOfficeRoom} from './hybrid-state.js';
import {HybridScene} from './hybrid-scene.js';
import {saveOfficeDoor} from './office-door-save.js';
import {projectFloorTasks,openFloorTasks} from './floor-tasks.js';
import {useOfficeInteraction} from './office-interaction.js';
import {defaultNativeRoom,nativeName,nativeObjects} from './native-state.js';
import {attachFloorViewport} from './office-floor-viewport.js';
import {watchOptionalAssetImages} from './optional-assets.js';

// The game HUD is a projection of work, never a simulated economy.
export function officePulse({jobs = [], reviews = {}, agents = [], connectionStatus, lastSync, mode = 'live', now = Date.now()} = {}) {
  const age = now - Date.parse(lastSync || '');
  const known = mode === 'live' && connectionStatus === 'live' && age >= 0 && age <= STALE_AFTER_MS;
  if (!known) return {known: false, active: null, online: null, attention: null, items: []};
  const uniqueJobs = [...new Map(jobs.filter(job => job?.id).map(job => [job.id, job])).values()];
  const items = deriveItems(uniqueJobs, reviews, agents);
  return {known, active: uniqueJobs.filter(job => ['queued', 'running'].includes(job.status)).length,
    online: new Set(agents.filter(agent => agent.sessionId && agent.status !== 'offline').map(agent => agent.sessionId)).size,
    attention: items.length, items};
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export class BuildingView {
  constructor(root, {onNavigate, onChat, onTask, avatarIcon, onConnect, onOpenPage, onNewTask, onConnectionState, onNativeSceneNeeded, getAgentStatePreview, getWorkspaceAccess, zuriConnector, loadStudio = () => import('./design-studio.js')} = {}) {
    this.root = root; this.onNavigate = onNavigate; this.onChat = onChat;
    this.onTask = onTask; this.avatarIcon = avatarIcon; this.onConnect = onConnect;
    this.onOpenPage = onOpenPage; this.onNewTask = onNewTask;
    this.getWorkspaceAccess=getWorkspaceAccess;
    this.getAgentStatePreview=getAgentStatePreview;this.loadStudio = loadStudio; this.onNativeSceneNeeded=onNativeSceneNeeded;
    this.connected = []; this.mode = 'live'; this.selected = 0; this.domain = null;
    this.zuriEnabled = false; this.zuriState = 'CHECKING'; this.zuriHasVerifiedRead = false;
    this.world = element('section', '', 'office-world');
    this.world.setAttribute('aria-label', 'ตึกสำนักงาน Zuri');
    this.world.innerHTML = `
      <picture class="idle-campus"><source media="(max-width: 767px)" srcset="./assets/office-world/idle-campus-mobile.png"><img data-optional-asset="image" data-optional-label="Campus preview" src="./assets/office-world/idle-campus-desktop.png" alt="เมืองสำนักงานจำลอง ตึก Zuri กลางสวนและถนน" fetchpriority="high"></picture>
      <header class="idle-hud"><button class="hq-badge" type="button" aria-label="ภาพรวมสำนักงานใหญ่"><img data-optional-asset="logo" src="./assets/brand/zuri-iconic-primary.svg" alt=""></button><div class="office-resources" aria-label="สถานะธุรกิจ"><button type="button" data-resource="active">${icon('file')}<span><strong>—</strong><small>งานเดินอยู่</small></span></button><button type="button" data-resource="online">${icon('team')}<span><strong>—</strong><small>Agent ออนไลน์</small></span></button><button type="button" data-resource="attention">${icon('bell')}<span><strong>—</strong><small>รอคุณดู</small></span></button></div></header>
      <div class="idle-location"><span>ZURI <b>HEADQUARTERS</b></span><button class="world-connection" type="button"><i></i><span>ยังไม่เชื่อมต่อ</span>${icon('arrow-right')}</button></div>
      <div class="idle-shortcuts"><button type="button" data-world-action="settings" aria-label="ตั้งค่าการเชื่อมต่อ">${icon('settings')}</button><button type="button" data-world-action="inbox" aria-label="กล่องแจ้งเตือน">${icon('bell')}<span class="idle-alert" hidden></span></button><button type="button" data-world-action="knowledge" aria-label="ความรู้ทีม">${icon('book')}</button></div>
      <button class="building-hotspot" type="button" aria-label="เข้าตึกไปชั้น G ล็อบบี้"><span class="building-pin">${icon('office')}<b>ZURI HQ</b><span>G · LOBBY</span></span></button>
      <header class="world-heading"><div><div class="world-eyebrow">YOUR OFFICE, YOUR TEAM</div><h1 tabindex="-1">ออฟฟิศของคุณ</h1><p class="world-intro">เลือกชั้น แล้วแวะไปหาทีมของคุณ</p></div><span class="world-mode">สำนักงานจำลอง</span></header>
      <div class="world-navigation"><button class="world-back" type="button">${icon('office')}<span>กลับไปที่ตึก</span></button><span class="world-breadcrumb"></span><label class="world-lift">เปลี่ยนชั้น <select aria-label="เลือกชั้นสำนักงาน"><option value="">ภาพรวมตึก</option></select></label></div>
      <div class="world-layout"><div class="world-stage"><div class="world-scene"></div><div class="world-scene-note"><span>14 ชั้น · 1 domain ต่อชั้น</span><span>คลิกชั้นเพื่อเข้าออฟฟิศ</span></div></div><aside class="world-directory" aria-label="ลิฟต์และทีมประจำชั้น"></aside></div>
      <div class="idle-entry"><p class="idle-hint">ทุกทีม อยู่ในตึกเดียวกัน</p><button class="enter-building" type="button">${icon('office')}<span><strong>เข้าออฟฟิศ</strong><small>เริ่มที่ชั้น G · ล็อบบี้</small></span>${icon('arrow-right')}</button><span class="idle-caption">ขึ้นลิฟต์จากล็อบบี้ ไปหา 14 ทีมธุรกิจ</span></div>
      <button class="idle-mission" type="button"><span class="mission-icon">${icon('link')}</span><span><small>เริ่มต้นวันทำงาน</small><strong>เชื่อมต่อทีมของคุณ</strong><span>ดูงานและสถานะจาก T3</span></span>${icon('arrow-right')}</button>
      <nav class="idle-dock" aria-label="เมนูออฟฟิศ"><button type="button" data-world-page="office" aria-current="page">${icon('office')}<span>ออฟฟิศ</span></button><button type="button" data-world-page="floors" aria-haspopup="dialog">${icon('team')}<span>เลือกทีม</span></button><button type="button" data-world-page="work">${icon('file')}<span>งาน</span></button><button type="button" data-world-page="chat">${icon('chat')}<span>แชท</span></button><button type="button" data-world-page="results">${icon('results')}<span>ผลงาน</span></button></nav>
      <p class="world-footnote">แบบทีมตาม domain ของ Zuri · บทบาทที่ยังไม่ผูก agent เป็นทีมจำลอง</p>
      <dialog class="floor-sheet directory-board" aria-labelledby="floor-sheet-title" aria-describedby="directory-instruction"><header class="directory-masthead"><div class="directory-brand"><strong>ZURI</strong><span>HEADQUARTERS</span></div><button class="sheet-close" type="button" aria-label="ปิดลิฟต์">${icon('close')}</button></header><div class="directory-heading"><div><span class="directory-eyebrow">BUILDING DIRECTORY</span><h2 id="floor-sheet-title">รายชื่อแผนก</h2></div><div class="directory-location"><span class="directory-level">G</span><span><small>คุณอยู่ที่นี่</small><strong class="directory-place">ล็อบบี้</strong></span></div></div><div class="directory-column-labels" aria-hidden="true"><span>ชั้น <b>แผนก / DEPARTMENT</b></span><span>ชั้น <b>แผนก / DEPARTMENT</b></span></div><div class="floor-directory" aria-label="รายชื่อแผนก เรียงจากชั้น 14 ถึงชั้น G"></div><footer class="directory-footer"><span id="directory-instruction">แตะแผนกเพื่อเลือกชั้นที่ต้องการไป</span><span>14 แผนก · G ล็อบบี้</span></footer></dialog>`;
    root.prepend(this.world);
    this.stopOptionalAssetWatch=watchOptionalAssetImages(this.world);
    this.studioHost = element('section', '', 'design-studio-host');
    this.studioHost.hidden = true;
    this.world.append(this.studioHost);
    const studioEntry = element('button', '', 'studio-entry');
    studioEntry.type = 'button';
    studioEntry.innerHTML = `${icon('edit')}<span>ลองแต่งออฟฟิศ</span>`;
    studioEntry.onclick = () => onNavigate?.('studio');
    this.world.append(studioEntry);
    const sceneHost=element('section','','office-panel');
    const canvasHost=element('div');canvasHost.id='scene';
    const loading=element('p','กำลังเปิดฉาก 3D…','scene-loading');loading.id='scene-loading';loading.setAttribute('role','status');
    const labels=element('div');labels.id='labels';canvasHost.append(loading,labels);sceneHost.append(canvasHost);
    this.world.querySelector('.world-scene').append(sceneHost);
    this.directory = this.world.querySelector('.world-directory');
    this.teamDialog=element('dialog','','floor-team-dialog');this.teamDialog.setAttribute('aria-label','ทีมและข้อมูลของชั้นนี้');
    const teamHeader=element('header'),teamTitle=element('h2','ทีมและข้อมูลของชั้นนี้'),teamClose=element('button','ปิด','floor-team-close');teamClose.type='button';teamClose.onclick=()=>this.teamDialog.close();teamHeader.append(teamTitle,teamClose);
    this.teamDialog.append(teamHeader,this.directory);this.world.append(this.teamDialog);
    const tools=element('nav','','floor-tools');tools.setAttribute('aria-label','เครื่องมือชั้นสำนักงาน');
    for(const [key,label,action]of [['floors','ลิฟต์',()=>this.openFloors()],['team','ทีม / ข้อมูล',()=>this.teamDialog.showModal()],['center','รีเซ็ตมุมมอง',()=>this.floorViewport?.reset()],['fit','ดูทั้งชั้น',()=>this.floorViewport?.fit()],['zoom-in','ซูม +',()=>this.floorViewport?.zoomTo(this.floorViewport.zoom*1.2)],['zoom-out','ซูม −',()=>this.floorViewport?.zoomTo(this.floorViewport.zoom/1.2)],['structure','Dev · ดูโครง 3D',()=>{const b=this.world.querySelector('[data-floor-tool=structure]'),enabled=b.getAttribute('aria-pressed')!=='true';if(this.appliedScene?.modelLayer?.skinLayer?this.appliedScene.setPresentationVisibility({wireframe:enabled}):this.appliedScene?.setStructureView(enabled)){b.setAttribute('aria-pressed',String(enabled));b.textContent=enabled?'Wireframe · เปิด':'Wireframe · ปิด';}else{b.textContent='Dev · ต้องใช้ WebGL';}}],['edit','แต่งชั้นนี้',()=>onNavigate?.('studio')]]){
      const b=element('button',label);b.type='button';b.dataset.floorTool=key;b.onclick=action;tools.append(b);
    }for(const [key,label]of [['skin','สกิน 2.5D'],['model','โมเดล']]){const b=element('button',`${label} · เปิด`);b.type='button';b.dataset.floorTool=key;b.setAttribute('aria-pressed','true');b.onclick=()=>{const enabled=b.getAttribute('aria-pressed')!=='true';if(this.appliedScene?.setPresentationVisibility({[key]:enabled})){b.setAttribute('aria-pressed',String(enabled));b.textContent=`${label} · ${enabled?'เปิด':'ปิด'}`;}};tools.insertBefore(b,tools.querySelector('[data-floor-tool=structure]'));}this.world.append(tools);
    this.sheet = this.world.querySelector('.floor-sheet');
    this.zuriPanel = new ZuriPanel(this.world, {connector: zuriConnector, onConnectionState: state => {
      const wasEnabled = this.zuriEnabled;
      this.zuriEnabled = state.enabled === true;
      this.zuriState = state.state || 'UNAVAILABLE';
      this.zuriHasVerifiedRead = state.hasVerifiedRead === true;
      this.applyZuriMode(wasEnabled !== this.zuriEnabled);
      onConnectionState?.(state);
    }});
    this.zuriReady = this.zuriPanel.ready.then(() => {
      this.zuriEnabled = this.zuriPanel.enabled;
      this.zuriState = this.zuriPanel.connectionState || (this.zuriEnabled ? 'READY' : 'DISABLED');
      this.zuriHasVerifiedRead = this.zuriPanel.hasVerifiedRead === true;
      this.applyZuriMode();
      return {enabled: this.zuriEnabled, state: this.zuriState};
    });
    this.renderFloors();
    this.openFloors = () => { this.updateFloorLocation(); this.sheet.showModal(); };
    this.lobby = new LobbyView(this.world,{onElevator:this.openFloors,onExit:()=>onNavigate?.(null),onPage:onOpenPage,onConnect:()=>this.openConnection(),onNewTask});
    this.world.querySelector('.lobby-stop').onclick = () => {this.sheet.close();onNavigate?.('lobby');};
    this.world.querySelector('.sheet-close').onclick = () => this.sheet.close();
    this.sheet.onclick = event => { if (event.target === this.sheet) { const r = this.sheet.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) this.sheet.close(); } };
    this.world.querySelector('.building-hotspot').onclick = () => onNavigate?.('lobby');
    this.world.querySelector('.enter-building').onclick = () => onNavigate?.('lobby');
    this.world.querySelector('.hq-badge').onclick = () => onNavigate?.(null);
    this.world.querySelector('.world-connection').onclick = () => { void this.openConnection(); };
    this.world.querySelectorAll('[data-world-page]').forEach(button => button.onclick = () => {
      const page = button.dataset.worldPage;
      if (page === 'floors') { if(this.isLobby || this.domain)this.openFloors();else onNavigate?.('lobby'); } else if (page === 'office') onNavigate?.(null); else onOpenPage?.(page);
    });
    this.world.querySelectorAll('[data-world-action]').forEach(button => button.onclick = () => button.dataset.worldAction === 'settings' ? this.openConnection() : onOpenPage?.(button.dataset.worldAction));
    this.world.querySelectorAll('[data-resource]').forEach(button => button.onclick = () => onOpenPage?.({active:'work', online:'team', attention:'inbox'}[button.dataset.resource]));
    this.lift = this.world.querySelector('select');
    this.lift.append(new Option('G · Lobby','lobby'));
    for (const domain of [...domainFloors].reverse()) this.lift.append(new Option(`${String(domain.number).padStart(2, '0')} · ${domain.label}`, domain.key));
    this.lift.onchange = () => onNavigate?.(this.lift.value || null);
    this.world.querySelector('.world-back').onclick = () => onNavigate?.('lobby');
    this.world.addEventListener('keydown', event => {
      if (event.key === 'Escape' && (this.domain || this.isLobby) && !event.target.closest('input,select,textarea,[contenteditable="true"]') && !document.querySelector('dialog[open]')) {
        event.preventDefault(); onNavigate?.(this.domain ? 'lobby' : null);
      }
    });
    document.body.classList.add('tower-enabled');
    this.show(null);
    this.update([], 'live');
  }

  attachOffice(office) { this.office = office; this.floorViewport?.setNativeControls(this.appliedScene?null:office.controls);this.syncScene(); }

  async openZuriConnection() { return this.zuriPanel.openConnection(); }

  openConnection() {
    if (this.zuriEnabled) return this.openZuriConnection();
    return this.onConnect?.();
  }

  applyZuriMode(enabledChanged = false) {
    this.world?.classList.toggle('zuri-enabled', this.zuriEnabled);
    if (!this.zuriPanel) return;
    if (enabledChanged && this.domain) {
      this.renderDirectory();
      this.zuriPanel.showFloor(this.domain, this.zuriEnabled && !this.root.hidden);
    }
    if (this.domain) this.world.querySelector('.world-mode').textContent = this.domain.reserved ? 'พื้นที่เตรียมการ' : this.zuriEnabled ? this.zuriHasVerifiedRead ? 'Zuri · ข้อมูลจริง' : 'เชื่อม Zuri' : 'สำนักงานจำลอง';
    if (!enabledChanged) { this.updateRoster?.(); this.renderRole?.(); }
    this.updateConnectionAffordances();
    if(enabledChanged){this.renderAppliedRoom();this.syncScene();}
  }

  hide() {
    this.teamDialog.close();this.floorViewport?.();this.floorViewport=null;
    this.world.querySelector('.native-popup')?.remove();
    if (this.sheet.open) this.sheet.close();
    this.lobby.show(false);
    this.zuriPanel.hideFloor();
    this.closeStudio();
    this.gridBuild?.dispose();this.gridBuild=null;this.appliedScene?.dispose();this.appliedHost?.remove();this.appliedHost=null;this.appliedScene=null;
  }

  show(key) {
    this.teamDialog.close();this.floorViewport?.();this.floorViewport=null;
    this.world.querySelector('.native-popup')?.remove();
    if(key==='studio'&&(this.domain||this.isLobby))this.studioFloor=this.domain?.key||'lobby';
    if (this.sheet.open) this.sheet.close();
    this.closeStudio();
    this.isStudio = key === 'studio';
    this.world.classList.toggle('in-studio', this.isStudio);
    this.studioHost.hidden = !this.isStudio;
    if (this.isStudio) this.openStudio();
    const domain = floorByKey(key);
    this.isLobby = key === 'lobby';
    const changed = this.domain?.key !== domain?.key;
    this.domain = domain;
    if (changed) this.selected = 0;
    this.world.classList.toggle('inside-floor', !!domain);
    this.world.classList.toggle('floor-immersive',!!domain);
    this.world.classList.toggle('in-lobby', this.isLobby);
    this.lobby.show(this.isLobby);
    this.lift.value = domain?.key || (this.isLobby ? 'lobby' : '');
    this.world.querySelector('.world-back span').textContent = 'ลงชั้น G';
    const liftButton = this.world.querySelector('[data-world-page="floors"]');
    liftButton.querySelector('span').textContent = this.isLobby || domain ? 'ลิฟต์' : 'ล็อบบี้';
    if(this.isLobby || domain)liftButton.setAttribute('aria-haspopup','dialog');else liftButton.removeAttribute('aria-haspopup');
    this.updateFloorLocation();
    this.world.style.setProperty('--domain-color', domain?.color || '#e7a568');
    this.world.querySelector('h1').textContent = domain ? domain.label : this.isLobby ? 'ชั้น G · ล็อบบี้' : 'ออฟฟิศของคุณ';
    this.world.querySelector('.world-intro').textContent = domain ? domain.mission : 'เลือกชั้น แล้วแวะไปหาทีมของคุณ';
    this.world.querySelector('.world-breadcrumb').textContent = domain ? `ชั้น ${String(domain.number).padStart(2, '0')} / ${domain.thai}` : 'Business Home / ล็อบบี้';
    this.world.querySelector('.world-mode').textContent = domain?.reserved ? 'พื้นที่เตรียมการ' : this.zuriEnabled ? this.zuriHasVerifiedRead ? 'Zuri · ข้อมูลจริง' : 'เชื่อม Zuri' : 'สำนักงานจำลอง';
    this.world.querySelector('.world-scene-note').firstElementChild.textContent = domain ? `${domain.thai} · ${domain.roles.length} บทบาท` : `${domainFloors.length} ชั้น · 1 domain ต่อชั้น`;
    this.world.querySelector('.world-scene-note').lastElementChild.textContent = domain ? 'คลิกตัวละครเพื่อรู้จักบทบาท' : 'คลิกชั้นเพื่อเข้าออฟฟิศ';
    this.world.querySelector('#scene').setAttribute('aria-label', domain ? `ออฟฟิศสามมิติ ชั้น ${domain.number} ${domain.label} เลือกตัวละครหรือรายชื่อทีม` : 'ตึกสำนักงานสามมิติ 14 ชั้น เลือกชั้นจากตึกหรือรายการลิฟต์');
    this.world.querySelector('#scene').setAttribute('role', 'region');
    this.renderDirectory();
    this.zuriPanel.showFloor(domain, !this.root.hidden);
    this.renderAppliedRoom();
    this.syncScene();
    const devButton=this.world.querySelector('[data-floor-tool=structure]');devButton.hidden=!this.appliedScene?.canInspectStructure();devButton.setAttribute('aria-pressed','false');devButton.textContent=this.appliedScene?.modelLayer?.skinLayer?'Wireframe · ปิด':'Dev · ปิดเลเยอร์ภาพ';for(const key of ['skin','model']){const b=this.world.querySelector(`[data-floor-tool=${key}]`);b.hidden=!this.appliedScene?.modelLayer?.skinLayer;b.setAttribute('aria-pressed','true');b.textContent=`${key==='skin'?'สกิน 2.5D':'โมเดล'} · เปิด`;}
    if(domain)this.floorViewport=attachFloorViewport(this.world.querySelector('.world-stage'),{nativeControls:this.appliedScene?null:this.office?.controls,isEmptyGround:e=>!!this.appliedScene&&!this.appliedScene.pick(e,null)});
  }

  closeStudio() {
    this.studioRequest = (this.studioRequest || 0) + 1;
    this.studio?.dispose();
    this.studio = null;
  }

  async openStudio() {
    const request = this.studioRequest;
    this.studioHost.textContent = 'กำลังจัดห้องทดลอง…';
    try {
      const {DesignStudio} = await this.loadStudio();
      if (request !== this.studioRequest || this.root.hidden) return;
      this.studio = new DesignStudio(this.studioHost, {onExit: () => this.onNavigate?.('lobby'),onVisitFloor:key=>this.onNavigate?.(key),initialFloor:this.studioFloor||'lobby',getFloorTasks:key=>this.getFloorTasks(key),onOpenWork:()=>this.onOpenPage?.('work'),onOpenTask:id=>this.onOpenPage?.('work',id)});
    } catch {
      if (request !== this.studioRequest) return;
      this.studioHost.replaceChildren(element('p', 'เปิดห้องทดลองไม่ได้ กรุณาลองโหลดหน้าอีกครั้ง'));
      const back = element('button', 'กลับล็อบบี้'); back.type = 'button';
      back.onclick = () => this.onNavigate?.('lobby'); this.studioHost.append(back);
    }
  }

  update(connected, mode, data = {}) {
    this.connected = connected; this.mode = mode;
    this.floorJobData=data;
    const pulse = officePulse({...data, agents:connected, mode});
    this.lobby.update(this.zuriEnabled ? {known:false, items:[]} : pulse);
    for (const key of ['active', 'online', 'attention']) this.world.querySelector(`[data-resource="${key}"] strong`).textContent = !this.zuriEnabled && pulse.known ? String(pulse[key]) : '—';
    const connection = this.world.querySelector('.world-connection');
    connection.classList.toggle('connected', !this.zuriEnabled && pulse.known);
    connection.querySelector('span').textContent = this.zuriEnabled ? this.zuriConnectionLabel() : pulse.known ? 'T3 · เชื่อมต่อแล้ว' : mode === 'demo' ? 'โหมดตัวอย่าง · T3' : 'T3 · ยังไม่มีข้อมูลสด';
    const alert = this.world.querySelector('.idle-alert');
    alert.hidden = !pulse.known || !pulse.attention;
    alert.textContent = pulse.attention;
    const mission = this.world.querySelector('.idle-mission');
    const item = pulse.items[0];
    mission.querySelector('small').textContent = this.zuriEnabled ? 'ข้อมูลธุรกิจจาก Zuri' : !pulse.known ? 'เริ่มต้นวันทำงาน' : item ? 'ทีม T3 ต้องการคุณ' : 'พร้อมสำหรับงานถัดไป';
    mission.querySelector('strong').textContent = this.zuriEnabled ? 'เลือก Business และอ่านข้อมูล' : !pulse.known ? 'เชื่อมต่อทีมของคุณ' : item ? item.title : 'เริ่มงานใหม่กับทีม';
    mission.querySelector('strong + span').textContent = this.zuriEnabled ? 'ดูรายการจริงและตรวจทั้ง 14 ชั้น' : !pulse.known ? 'ดูงานและสถานะจาก T3 Code' : item ? 'แตะเพื่อดูรายละเอียดงาน T3' : 'ตั้งเป้าหมาย แล้วให้ทีมช่วยลงมือ';
    mission.onclick = () => this.zuriEnabled ? this.openZuriConnection() : !pulse.known ? this.onConnect?.() : item ? this.onOpenPage?.('work', item.jobId) : this.onNewTask?.();
    // Refresh details without replacing focused buttons during status polling.
    if (this.domain) { this.updateRoster(); this.renderRole(); }
    this.syncScene(false);this.syncActorStates();
    this.updateConnectionAffordances();
  }

  roster() { return this.domain ? floorAgents(this.domain, this.connected, this.mode) : []; }

  renderFloors() {
    const list = this.sheet.querySelector('.floor-directory');
    for (const domain of [...domainFloors].reverse()) {
      const button = element('button', '', 'floor-stop');
      button.type = 'button'; button.dataset.floorKey = domain.key;
      button.style.setProperty('--floor-color', domain.color);
      button.setAttribute('aria-label', `ชั้น ${domain.number} ${domain.label}${domain.reserved ? ' พื้นที่เตรียมการ' : ''}`);
      const words = element('span', '', 'floor-stop-words');
      words.append(element('strong', domain.thai.replace(/^ทีม/, '')), element('small', domain.label));
      button.append(element('span', String(domain.number).padStart(2, '0'), 'floor-number'), words, element('span', '', 'floor-enter'));
      button.dataset.reserved = String(domain.reserved);
      button.onclick = () => { if (this.sheet.open) this.sheet.close(); this.onNavigate?.(domain.key); };
      list.append(button);
    }
    const lobby = element('button', '', 'lobby-stop');
    lobby.type = 'button'; lobby.dataset.floorKey = 'lobby';
    lobby.setAttribute('aria-label', 'ชั้น G ล็อบบี้ ต้อนรับและพื้นที่ส่วนกลาง');
    const words = element('span', '', 'floor-stop-words');
    words.append(element('strong', 'ล็อบบี้ · ต้อนรับ'), element('small', 'Lobby & Reception'));
    lobby.append(element('span', 'G', 'floor-number'), words, element('span', '', 'floor-enter'));
    list.append(lobby);
  }

  updateFloorLocation() {
    const current = this.domain?.key || (this.isLobby ? 'lobby' : null);
    this.sheet.querySelector('.directory-level').textContent = this.domain ? String(this.domain.number).padStart(2, '0') : this.isLobby ? 'G' : '—';
    this.sheet.querySelector('.directory-place').textContent = this.domain ? this.domain.thai.replace(/^ทีม/, '') : this.isLobby ? 'ล็อบบี้' : 'หน้าตึก';
    for (const button of this.sheet.querySelectorAll('[data-floor-key]')) {
      const selected = button.dataset.floorKey === current;
      if (selected) button.setAttribute('aria-current', 'location'); else button.removeAttribute('aria-current');
      const status = button.querySelector('.floor-enter');
      status.replaceChildren();
      if (selected) status.textContent = 'อยู่ชั้นนี้';
      else if (button.dataset.reserved === 'true') status.textContent = 'พื้นที่สำรอง';
      else { status.innerHTML = icon('arrow-right'); status.setAttribute('aria-hidden', 'true'); }
      if (selected || button.dataset.reserved === 'true') status.removeAttribute('aria-hidden');
    }
  }

  renderDirectory() {
    this.directory.replaceChildren();
    const heading = element('div', '', 'world-directory-heading');
    heading.append(element('span', this.domain ? this.zuriEnabled ? 'ข้อมูลจาก Zuri · อ่านอย่างเดียว' : 'ทีมประจำชั้น' : 'ขึ้นลิฟต์ไปที่…', 'world-section-title'), element('span', this.domain ? `${this.domain.roles.length} บทบาท` : '14 FLOORS', 'world-small'));
    this.directory.append(heading);
    if (this.domain) {
      this.directory.append(this.zuriPanel.floorView);
      if (this.domain.reserved) this.directory.append(element('p', 'Zuri ยังสำรอง domain นี้ไว้ ดูแบบทีมได้ แต่ยังไม่เปิดใช้งานจริง', 'floor-reserved-note'));
      const list = element('div', '', 'floor-roster');
      this.roster().forEach((agent, index) => {
        const button = element('button', '', 'floor-agent');
        button.type = 'button'; button.dataset.roleIndex = index;
        const avatar = element('span', '', 'mini-avatar'); avatar.innerHTML = this.avatarIcon(agent);
        const words = element('span', '', 'floor-agent-words');
        words.append(element('strong', agent.name), element('small', agent.role));
        button.append(avatar, words, element('span', '', 'floor-agent-state'));
        button.onclick = () => this.select(index);
        list.append(button);
      });
      this.directory.append(list, element('section', '', 'floor-role-detail'));
      this.updateRoster(); this.renderRole();
    }
  }

  updateRoster() {
    this.roster().forEach((agent, index) => {
      const button = this.directory.querySelector(`[data-role-index="${index}"]`);
      if (!button) return;
      button.classList.toggle('selected', index === this.selected);
      button.setAttribute('aria-pressed', String(index === this.selected));
      const status = button.querySelector('.floor-agent-state');
      status.textContent = this.zuriEnabled ? agent.connected ? `T3 · ${agent.status === 'offline' ? 'ออฟไลน์' : 'เชื่อมแล้ว'}` : 'บทบาทจำลอง'
        : agent.connected ? (agent.status === 'offline' ? 'ออฟไลน์' : 'เชื่อมแล้ว') : 'แบบทีม';
      status.classList.toggle('connected', agent.connected && agent.status !== 'offline');
    });
  }

  renderRole() {
    const agent = this.roster()[this.selected], detail = this.directory.querySelector('.floor-role-detail');
    if (!agent || !detail) return;
    const signature = JSON.stringify([this.domain.key, this.selected, agent.connected, agent.status, agent.lastLog, this.mode]);
    if (this.detailSignature === signature && detail.childElementCount) return;
    this.detailSignature = signature;
    detail.replaceChildren();
    detail.append(element('span', 'ROLE CARD', 'world-eyebrow'), element('h2', agent.role), element('p', agent.focus), element('span', 'สิ่งที่ส่งต่อให้ทีม', 'role-output-label'), element('p', agent.output, 'role-output'));
    detail.append(element('p', 'ทำงานภายใน domain ของตัวเอง · งานข้ามทีมส่งต่อให้เจ้าของ domain · การอนุมัติยังเป็นของผู้มีสิทธิ์', 'role-boundary'));
    if (agent.sourceAgentId && this.mode === 'live' && !this.domain.reserved) {
      const action = element('button', this.zuriEnabled
        ? agent.connected ? `เปิดแชท T3 · ${agent.name}` : `เริ่มงานใน T3 · ${agent.name}`
        : agent.connected ? `คุยกับ ${agent.name}` : `เริ่มงานกับ ${agent.name}`, 'world-primary');
      action.onclick = () => agent.connected ? this.onChat?.(agent.sourceAgentId) : this.onTask?.(agent.sourceAgentId);
      detail.append(action, element('small', this.zuriEnabled
        ? 'เปิด T3 Code แยกต่างหาก · ไม่ใช่ Zuri Agent'
        : agent.connected ? 'ใช้บทบาทและแชทเดิมที่ผูกไว้ใน T3 Code' : 'ใช้ role profile เดิม · ต้องเชื่อม T3 Code เพื่อทำงาน', 'role-connection-note'));
    } else {
      detail.append(element('div', 'บทบาทออกแบบไว้ · ยังไม่ผูก agent ที่ทำงานจริง', 'role-unbound'));
    }
  }

  zuriConnectionLabel() {
    if (this.zuriState === 'AUTH_REQUIRED') return 'Zuri · ต้องลงชื่อเข้าใช้';
    if (this.zuriState === 'NO_BUSINESS') return 'Zuri · เลือก Business';
    if (this.zuriState === 'READY') return this.zuriHasVerifiedRead ? 'Zuri · อ่านข้อมูลแล้ว' : 'เชื่อม Zuri';
    if (this.zuriState === 'CHECKING') return 'Zuri · กำลังตรวจ';
    if (this.zuriState === 'DISABLED') return 'Zuri · ปิดอยู่';
    return 'Zuri · ตรวจสถานะ';
  }

  updateConnectionAffordances() {
    if (!this.world) return;
    const labels = {active:'ข้อมูล Zuri',online:'Agent Zuri',attention:'สถานะอ่าน'};
    for (const [key, value] of Object.entries(labels)) {
      const label = this.world.querySelector(`[data-resource="${key}"] small`);
      if (label) label.textContent = this.zuriEnabled ? value : ({active:'งานเดินอยู่',online:'Agent ออนไลน์',attention:'รอคุณดู'}[key]);
    }
    const connection = this.world.querySelector('.world-connection span');
    if (connection && this.zuriEnabled) connection.textContent = this.zuriConnectionLabel();
    const mission = this.world.querySelector('.idle-mission');
    if (mission && this.zuriEnabled) {
      mission.querySelector('small').textContent = 'ข้อมูลธุรกิจจาก Zuri';
      mission.querySelector('strong').textContent = 'เลือก Business และอ่านข้อมูล';
      mission.querySelector('strong + span').textContent = 'ดูรายการจริงและตรวจทั้ง 14 ชั้น';
      mission.onclick = () => { void this.openZuriConnection(); };
    }
    const footnote = this.world.querySelector('.world-footnote');
    if (footnote) footnote.textContent = this.zuriEnabled
      ? 'ข้อมูลรายชั้นอ่านจาก Zuri · แชทและงาน T3 เปิดระบบแยก · Zuri Agent ยังไม่พร้อมใช้งาน'
      : 'แบบทีมตาม domain ของ Zuri · บทบาทที่ยังไม่ผูก agent เป็นทีมจำลอง';
  }

  select(index) {
    if (!this.domain || !this.domain.roles[index]) return;
    this.selected = index; this.updateRoster(); this.renderRole(); this.office?.select?.(index);
  }

  syncScene(reset = true) {
    if(this.tycoonActive){if(this.office)this.office.suspended=true;return;}
    if (!this.office) {if(this.domain&&!this.appliedScene)this.onNativeSceneNeeded?.();return;}
    this.office.suspended = !this.domain || this.root.hidden || !!this.appliedScene;
    if (this.domain) {
      this.office.showDomain?.(this.domain, this.roster());
      let layout=null;
      try{if(!this.zuriEnabled&&new URLSearchParams(this.root.ownerDocument.defaultView.location.search).get('office-edition')!=='original')layout=new RoomStore(this.root.ownerDocument.defaultView.localStorage).nativeFloor(this.domain.key);}catch{/* Use original geometry if storage is inaccessible. */}
      const token=JSON.stringify({floor:this.domain.key,layout});
      if(token!==this.nativeSceneToken){this.office.setNativeRoom?.(layout||defaultNativeRoom());this.nativeSceneToken=token;}
      this.office.onObjectUse=o=>useOfficeInteraction(this.world,o,{onFloor:key=>this.onNavigate?.(key),onElevator:this.openFloors});
      this.office.select?.(this.selected);
    }
  }

  renderAppliedRoom(){
    if(this.tycoonActive)return;
    this.nativeActionList?.remove();this.nativeActionList=null;
    this.gridBuild?.dispose();this.gridBuild=null;this.appliedScene?.dispose();this.appliedHost?.remove();this.appliedScene=null;this.appliedHost=null;
    this.world.classList.remove('has-hybrid-floor');
    // Connected Business views keep their own data and saved scene authority. They
    // use the shared canonical default. Only the explicit local art preview
    // marker may read browser-local presentation snapshots; it grants no data scope.
    if(this.isStudio||(!this.domain&&!this.isLobby))return;
    const connectedBaseline=!!this.domain&&this.zuriEnabled;
    if(this.zuriEnabled&&!connectedBaseline)return;
    // An "original" floor file resets to the shared default art, not the legacy renderer.
    const originalBaseline=!!this.domain&&new URLSearchParams(this.root.ownerDocument.defaultView.location.search).get('office-edition')==='original';
    const localArtPreview=this.root.ownerDocument.querySelector('meta[name=office-art-preview]')?.content==='legacy';
    const artBaseline=connectedBaseline&&!localArtPreview||originalBaseline;
    let store=null;
    if(!artBaseline){let storage=null;try{storage=this.root.ownerDocument.defaultView.localStorage;}catch{/* The default scene remains viewable when storage is unavailable. */}store=new RoomStore(storage);}
    const key=this.domain?.key||'lobby',defaultFloor=artBaseline||!!this.domain&&!store.floor(key)&&store.edition(key)!=='native3d';
    let room=artBaseline?defaultOfficeRoom(this.domain):store.floor(key)||(defaultFloor?defaultOfficeRoom(this.domain):null);
    if(!room){
      const native=store.nativeFloor(key);
      if(this.domain){const list=element('nav','','native-floor-actions');list.setAttribute('aria-label','Interaction ของเฟอร์นิเจอร์');
        const edit=element('button','แก้ฉาก 3D ชั้นนี้');edit.type='button';edit.onclick=()=>this.onNavigate?.('studio');list.append(edit);
        for(const o of (native?nativeObjects(native):[]).filter(o=>o.interaction.type!=='none')){
          const b=element('button',`${nativeName(o)} · ${o.interaction.type==='popup'?o.interaction.title||'รายละเอียด':o.interaction.type==='elevator'?'ลิฟต์':'ไปชั้นอื่น'}`);
          b.type='button';b.onclick=()=>useOfficeInteraction(this.world,o,{onFloor:f=>this.onNavigate?.(f),onElevator:this.openFloors});list.append(b);
        }
        this.world.querySelector('.world-stage').append(list);this.nativeActionList=list;
      }return;
    }
    const host=element('section','','hy-applied-floor');
    host.setAttribute('aria-label',defaultFloor?`ฉากสำนักงานจำลอง ${this.domain.label}`:'ห้องที่ตกแต่งจาก Design Studio');
    if(defaultFloor)host.classList.add('is-default-floor');
    const header=element('div','','hy-applied-header'),title=element('div');
    title.append(element('strong',room.name||'ห้องของคุณ'),element('small',connectedBaseline?'Three.js · Soft 3D · ตัวละคร 3D · ภาพประกอบ ไม่ใช่สถานะ agent':originalBaseline?'ฉากมาตรฐาน Three.js · Soft 3D · ตัวละคร 3D':defaultFloor?'Three.js · Soft 3D · ตัวละคร 3D · ฉากจำลองในเครื่อง':'แบบตกแต่งในเครื่อง · สำนักงานจำลอง'));
    const actions=element('div'),lift=element('button','ลิฟต์'),edit=element('button','แก้ไขแบบ');
    lift.type=edit.type='button';lift.onclick=()=>this.openFloors();edit.onclick=()=>this.onNavigate?.('studio');edit.hidden=connectedBaseline||originalBaseline;actions.append(lift,edit);header.append(title,actions);
    const stage=element('div','','hy-applied-stage'),note=element('p',connectedBaseline?'ตัวละครเป็นภาพประกอบ · ไม่ใช่สถานะ agent หรือข้อมูลของ Business':'ตัวละครในฉากเป็นภาพประกอบ · สถานะและบทบาทดูได้จากรายชื่อทีม','hy-object-note');
    host.append(header,stage,note);
    if(this.isLobby){
      const services=element('nav','','hy-applied-services');services.setAttribute('aria-label','บริการในล็อบบี้');
      for(const [zone,label]of [['reception','ต้อนรับ / เริ่มงาน'],['board','กระดานงาน'],['lounge','มุมสนทนา'],['knowledge','มุมความรู้']]){
        const b=element('button',label);b.type='button';b.onclick=()=>this.lobby.root.querySelector(`[data-lobby-zone="${zone}"]`).click();services.append(b);
      }
      host.append(services);
    }
    (this.domain?this.world.querySelector('.world-stage'):this.world).append(host);
    this.appliedHost=host;this.world.classList.add('has-hybrid-floor');
    if(this.domain)this.world.querySelector('.world-scene-note').lastElementChild.textContent=connectedBaseline?'ฉากประกอบ Painted 2.5D · แยกจากสถานะ agent':defaultFloor?'ฉากทีมมาตรฐาน · ปรับแต่งได้ใน Design Studio':'แบบตกแต่งของคุณ · เลือกบทบาทจากรายชื่อทีม';
    let doorRevision=store?.floorRevision(key);
    this.appliedScene=new HybridScene(stage,{getFloor:()=>this.domain,getTasks:key=>this.getFloorTasks(key),getObjectWorkspace:o=>this.objectWorkspace(o),onOpenWork:()=>this.onOpenPage?.('work'),onOpenTask:id=>this.onOpenPage?.('work',id),onDoorToggle:artBaseline?null:id=>{
      const result=saveOfficeDoor(store.storage,key,doorRevision,id);
      if(result.ok){room=result.room;doorRevision=result.revision;this.gridBuild?.refresh(room,doorRevision);this.appliedScene.render(room,null,true);}return result;
    },onUse:id=>{
      const object=room.objects.find(o=>o.id===id);
      const action=object&&interactionFor(object);
      if(action?.type==='elevator')this.openFloors();
      else if(action?.type==='floor')this.onNavigate?.(action.floor);
      else if(object?.kind==='duo'||object?.kind?.startsWith('avatar-'))note.textContent='ภาพตัวละครประกอบฉาก · ไม่ใช่สถานะ agent สด';
      else note.textContent='เฟอร์นิเจอร์จากแบบของคุณ · ปรับได้ที่ Design Studio';
    }});
    this.appliedScene.render(room,null,true);this.syncActorStates();
    if(!artBaseline&&store&&isOfficeSheet(room)&&this.appliedScene.modelLayer)this.gridBuild=new OfficeGridBuild(this.world,this.appliedScene,{storage:store.storage,floor:key,revision:doorRevision,onSaved:(saved,revision)=>{room=saved;doorRevision=revision;}});
  }
  syncActorStates(){
    if(!this.appliedScene||!this.domain)return;
    const preview=this.getAgentStatePreview?.(this.domain.key),known=!this.zuriEnabled&&officePulse({...this.floorJobData,agents:this.connected,mode:this.mode}).known;
    this.appliedScene.setAgentStates(preview||floorActorStates(this.appliedScene.room,this.roster(),{known,source:known?'T3 snapshot':''}));
  }
  getFloorTasks(key){
    if(this.getWorkspaceAccess?.().synthetic===true)return projectFloorTasks(key,{...this.floorJobData,mode:this.mode,source:'Synthetic'});
    if(this.zuriEnabled)return {state:'UNAVAILABLE',source:'Zuri',items:[],message:'ยังไม่มีสัญญา API สำหรับงานรายชั้นของ Zuri · เปิดหน้างานเพื่อดูข้อมูลที่ระบบรองรับ'};
    return projectFloorTasks(key,{...this.floorJobData,mode:this.mode});
  }
  objectWorkspace(object){
    if(!this.domain)return null;
    const access=this.getWorkspaceAccess?.()||{allowed:false},context=sceneWorkspaceContext(object,this.domain,this.roster(),access),agent=context.agent;
    const source=access.kind==='synthetic'?'Synthetic · ไม่ใช่ Agent จริง':this.zuriEnabled?'T3 แยกจาก Zuri':'T3';
    const actions=[{label:'ดูงานของชั้นนี้',run:()=>{this.appliedScene?.taskPopup?.dispose?.();if(this.appliedScene)this.appliedScene.taskPopup=openFloorTasks(this.appliedScene.root,{floor:this.domain,getTasks:key=>this.getFloorTasks(key),onOpenTask:id=>this.onOpenPage?.('work',id),onOpenWork:()=>this.onOpenPage?.('work')});}}];
    if(agent)actions.push({label:'ดูรายละเอียดบทบาท',run:()=>{this.select(context.roleIndex);this.teamDialog.showModal();}});
    if(access.allowed&&!this.domain.reserved){
      actions.push({label:context.bound?`เปิดแชท · ${agent.name}`:'เปิดแชททีม · เลือกผู้รับ',run:()=>context.bound?this.onChat?.(agent.sourceAgentId):this.onOpenPage?.('chat','choose')});
      if(access.kind!=='demo')actions.push({label:context.bound?`สร้างงาน · ${agent.name}`:'สร้างงาน · เลือกผู้รับ',run:()=>context.bound?this.onTask?.(agent.sourceAgentId):this.onNewTask?.({chooseRecipient:true})});
    }
    return{heading:agent?`${agent.name} · ${agent.role}`:context.floorLabel,note:this.domain.reserved?'พื้นที่เตรียมการ · แสดงตัวอย่างบทบาท ยังไม่เปิดแชทหรือสั่งงานของแผนกนี้':!access.allowed?access.message||'พื้นที่ทำงานยังไม่พร้อม':context.bound?`${source} · ใช้ผู้รับที่ผูกไว้`:`${source} · ${agent?'บทบาทนี้ยังไม่ผูก Agent':'วัตถุนี้ไม่ได้ระบุผู้รับงาน'} · เลือกผู้รับในหน้าถัดไป`,actions};
  }
}
