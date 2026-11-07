import {icon} from './icons.js';
import {watchOptionalAssetImages} from './optional-assets.js';

const zone = (key, symbol, title, detail) => `<button class="lobby-zone lobby-${key}" data-lobby-zone="${key}" type="button" ${['elevator','reception','board'].includes(key) ? 'aria-haspopup="dialog"' : ''}>${icon(symbol)}<span><strong>${title}</strong><small>${detail}</small></span></button>`;
const node = (tag, text, className) => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };

// Ground-floor places are shortcuts into existing workflows, not new agents or grants.
export class LobbyView {
  constructor(world, {onElevator, onExit, onPage, onConnect, onNewTask} = {}) {
    this.onPage = onPage; this.onConnect = onConnect; this.onNewTask = onNewTask;
    this.root = document.createElement('section');
    this.root.className = 'lobby-room'; this.root.hidden = true;
    this.root.setAttribute('aria-label', 'ชั้น G ล็อบบี้สำนักงาน');
    this.root.innerHTML = `
      <picture class="lobby-art"><source media="(max-width: 767px)" srcset="./assets/office-world/lobby-mobile.png"><img data-optional-asset="image" data-optional-label="Lobby preview" src="./assets/office-world/lobby-desktop.png" alt="ล็อบบี้สำนักงาน Zuri มีเคาน์เตอร์ต้อนรับ ลิฟต์ กระดานงาน มุมสนทนา และมุมความรู้" loading="lazy"></picture>
      <div class="lobby-welcome"><span class="lobby-floor-mark">G</span><span><strong>ล็อบบี้</strong><small>จุดเริ่มต้นวันทำงานของคุณ</small></span></div>
      <div class="lobby-places" aria-label="จุดบริการในล็อบบี้">
        ${zone('elevator','office','ลิฟต์','เลือกชั้น · 14 domain')}
        ${zone('reception','help','ต้อนรับ','เริ่มงาน / วิธีใช้งาน')}
        ${zone('board','file','กระดานงาน','ยังไม่มีข้อมูลสด')}
        ${zone('lounge','chat','มุมสนทนา','คุยกับทีม')}
        ${zone('knowledge','book','มุมความรู้','ข้อมูลบริษัท')}
      </div>
      <button class="lobby-exit" type="button">${icon('arrow-right')}<span>ออกไปหน้าตึก</span></button>
      <p class="lobby-guide">แตะจุดในห้องเพื่อใช้งาน · ขึ้นลิฟต์เพื่อไปหาทีม</p>
      <dialog class="lobby-dialog reception-dialog" aria-labelledby="lobby-reception-title"><div class="sheet-heading"><div><span class="world-eyebrow">G / RECEPTION</span><h2 id="lobby-reception-title">เริ่มตรงนี้ได้เลย</h2><p>เลือกสิ่งที่อยากทำ แล้วให้ทีมช่วยต่อ</p></div><button type="button" class="sheet-close" aria-label="ปิดเคาน์เตอร์ต้อนรับ">${icon('close')}</button></div><div class="reception-actions"><button type="button" data-reception="task">${icon('plus')}<span><strong>เริ่มงานใหม่</strong><small>บอกเป้าหมาย แล้วเลือก agent ที่มีอยู่</small></span>${icon('arrow-right')}</button><button type="button" data-reception="elevator">${icon('office')}<span><strong>ไปหาทีมที่รับผิดชอบ</strong><small>ขึ้นลิฟต์ไปยัง 14 domain ของธุรกิจ</small></span>${icon('arrow-right')}</button><button type="button" data-reception="connect">${icon('link')}<span><strong>เชื่อมต่อออฟฟิศ</strong><small>ตั้งค่าการเชื่อมต่อเพื่อดูสถานะงานจริง</small></span>${icon('arrow-right')}</button></div><p class="lobby-dialog-note">กระดานงานช่วยดูสิ่งที่รอคุณ · มุมสนทนาเปิดแชทเดิม<br>มุมความรู้เก็บข้อมูลให้ทีมใช้ในงานถัดไป</p></dialog>
      <dialog class="lobby-dialog board-dialog" aria-labelledby="lobby-board-title"><div class="sheet-heading"><div><span class="world-eyebrow">G / WORK BOARD</span><h2 id="lobby-board-title">มีอะไรให้ช่วยต่อ?</h2><p>งานที่รอข้อมูล รอตรวจผล หรือมีข้อผิดพลาด</p></div><button type="button" class="sheet-close" aria-label="ปิดกระดานงาน">${icon('close')}</button></div><div class="lobby-board-content"></div></dialog>`;
    world.append(this.root);
    this.stopOptionalAssetWatch=watchOptionalAssetImages(this.root);
    this.art = this.root.querySelector('.lobby-art img');
    this.art.onload = () => this.positionPlaces();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.positionPlaces());
      this.resizeObserver.observe(this.root);
    }
    this.reception = this.root.querySelector('.reception-dialog');
    this.board = this.root.querySelector('.board-dialog');
    this.root.querySelector('.lobby-exit').onclick = onExit;
    this.root.querySelectorAll('dialog').forEach(dialog => {
      dialog.querySelector('.sheet-close').onclick = () => dialog.close();
      dialog.onclick = event => {
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
      };
    });
    this.root.querySelectorAll('[data-lobby-zone]').forEach(button => button.onclick = () => {
      switch (button.dataset.lobbyZone) {
        case 'elevator': onElevator?.(); break;
        case 'reception': this.reception.showModal(); break;
        case 'board': this.renderBoard(); this.board.showModal(); break;
        case 'lounge': onPage?.('chat'); break;
        case 'knowledge': onPage?.('knowledge'); break;
      }
    });
    this.root.querySelectorAll('[data-reception]').forEach(button => button.onclick = () => {
      this.reception.close();
      const action = button.dataset.reception;
      if (action === 'task') onNewTask?.(); else if (action === 'elevator') onElevator?.(); else onConnect?.();
    });
    this.update({known:false,items:[]});
  }

  show(visible) {
    if (!visible) for (const dialog of [this.reception,this.board]) if (dialog.open) dialog.close();
    this.root.hidden = !visible;
    if (visible) this.positionPlaces();
  }

  positionPlaces() {
    const {width,height} = this.root.getBoundingClientRect();
    if (!width || !height || !this.art.naturalWidth) return;
    const mobile = this.art.naturalWidth < this.art.naturalHeight;
    const places = mobile ? {elevator:[.61,.255],reception:[.28,.43],board:[.91,.375],lounge:[.29,.61],knowledge:[.80,.62]}
      : {elevator:[.58,.36],reception:[.33,.55],board:[.88,.41],lounge:[.16,.75],knowledge:[.83,.76]};
    const scale = Math.min(width / this.art.naturalWidth,height / this.art.naturalHeight);
    const imageWidth=this.art.naturalWidth*scale, imageHeight=this.art.naturalHeight*scale;
    for (const [key,[x,y]] of Object.entries(places)) {
      const button=this.root.querySelector(`[data-lobby-zone="${key}"]`),half=button.offsetWidth/2;
      button.style.left=`${Math.max(half+12,Math.min(width-half-12,(width-imageWidth)/2+x*imageWidth))}px`;
      button.style.top=`${(height-imageHeight)/2+y*imageHeight}px`;
    }
  }

  update(pulse) {
    this.pulse = pulse;
    this.root.querySelector('.lobby-board small').textContent = pulse.known ? pulse.attention ? `${pulse.attention} งานรอคุณดู` : 'ไม่มีงานค้างให้ดู' : 'ยังไม่มีข้อมูลสด';
    // A polling snapshot must not recreate the focused action in an open board.
    if (this.board.open) {
      const signature = this.signature();
      if (signature !== this.boardSignature) {
        const focused = this.board.querySelector(':focus');
        const focusedJob = focused?.dataset.jobId;
        const focusedAction = focused?.dataset.boardAction;
        this.renderBoard();
        const replacement = [...this.board.querySelectorAll('button')].find(button => focusedJob ? button.dataset.jobId === focusedJob : focusedAction && button.dataset.boardAction === focusedAction);
        if (focused) (replacement || this.board.querySelector('.sheet-close')).focus();
      }
    }
  }

  signature() { return JSON.stringify([this.pulse.known,this.pulse.items.map(({jobId,title,type})=>({jobId,title,type}))]); }

  renderBoard() {
    this.boardSignature = this.signature();
    const content = this.root.querySelector('.lobby-board-content'); content.replaceChildren();
    const action = (label, key, callback) => { const button = node('button',label,'lobby-board-action'); button.type='button'; button.dataset.boardAction=key; button.onclick=()=>{this.board.close();callback?.();}; return button; };
    if (!this.pulse.known) {
      content.append(node('p','ยังไม่มีข้อมูลสด เชื่อมต่อออฟฟิศเพื่อดูงานที่ทีมส่งมา','lobby-board-empty'),action('เชื่อมต่อออฟฟิศ','connect',this.onConnect));
      return;
    }
    if (!this.pulse.items.length) content.append(node('p','ตอนนี้ไม่มีงานที่รอให้คุณช่วยหรือตรวจผล เริ่มเป้าหมายใหม่กับทีมได้เลย','lobby-board-empty'),action('เริ่มงานใหม่','task',this.onNewTask));
    const list = node('div','','lobby-work-list');
    for (const item of this.pulse.items.slice(0,5)) {
      const button = node('button','','lobby-work-item'); button.type='button'; button.dataset.jobId=item.jobId;
      button.append(node('span',{error:'ตรวจข้อผิดพลาด',waiting:'รอข้อมูล',revision:'ต้องแก้ไข',review:'รอตรวจรับ'}[item.type],'lobby-work-state'),node('strong',item.title));
      // Resolve again at click time: never send the user to a removed/stale item.
      button.onclick=()=>{ const current=this.pulse.known&&this.pulse.items.find(candidate=>candidate.jobId===item.jobId); if(current){this.board.close();this.onPage?.('work',current.jobId);} };
      list.append(button);
    }
    content.append(list,action('ดูงานทั้งหมด','all',()=>this.onPage?.('work')));
    if (this.pulse.items.length > 5) content.append(action(`ดูสิ่งที่รอทั้งหมด ${this.pulse.attention} รายการ`,'inbox',()=>this.onPage?.('inbox')));
  }
}
