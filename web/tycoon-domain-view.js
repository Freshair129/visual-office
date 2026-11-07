import {TycoonView} from './tycoon-view.js';
import {OfficeArtScene} from './office-art-scene.js';
import {OfficeContextData} from './office-context-data.js';
import {createTycoonRoom} from './tycoon-state.js';
import {resolveOfficeContextRoute,domainDetail,buildingPage} from './office-context-route.js';
import {workspaceHash} from './workspace-navigation.js';
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
const button=(label,fn)=>{const b=el('button',label);b.type='button';b.onclick=fn;return b;};
const messages={CHECKING:'กำลังตรวจโหมดจำลอง',SELECT_BUSINESS:'เลือก Business',LOADING:'กำลังโหลดรายชื่อชั้น',READY:'รายชื่อชั้นพร้อม',EXPIRED:'Context หมดอายุ · โหลดรายชื่อชั้นใหม่',HIDDEN:'พักข้อมูลเมื่อออกจากหน้าต่าง',UNAVAILABLE:'Context ไม่พร้อม · เลือก Business เพื่อลองใหม่',AUTH_REQUIRED:'ต้องเข้าสู่ระบบใหม่ · synthetic ไม่เปิด live',FORBIDDEN:'ไม่มีสิทธิ์อ่านข้อมูล'};
export class TycoonDomainView extends TycoonView{
 constructor(root,options={}){super(root,{Scene:OfficeArtScene,...options,Data:OfficeContextData});this.page=0;this.target={kind:'shell',key:'building'};this.window=root.ownerDocument.defaultView;this.visibility=()=>this.data.setHidden(root.ownerDocument.hidden||this.host.hidden);this.focus=()=>{if(!this.host.hidden)this.data.focus();};this.window.addEventListener('focus',this.focus);root.ownerDocument.addEventListener('visibilitychange',this.visibility);this.host.querySelector('[data-nav=studio]').disabled=true;if(root.ownerDocument.hidden)this.data.setHidden(true);}
 get rows(){return this.data.state.context?.domains||[];}
 get row(){return this.target?.kind==='domain'?this.rows.find(r=>r.domainKey===this.target.domainKey):null;}
 onDataChange(state){const changed=this.lastEpoch!==state.contextEpoch||this.lastContext!==state.context;const purged=this.lastEpoch!==state.contextEpoch;const sameBusiness=this.contextBusiness===state.businessId;this.contextBusiness=state.businessId;this.lastEpoch=state.contextEpoch;this.lastContext=state.context;
  this.host.querySelector('.tycoon-edition').textContent='SYNTHETIC · CONTRACT CANDIDATE · ไม่เชื่อม live';this.host.querySelector('.tycoon-connection').textContent=state.businesses.find(b=>b.id===state.businessId)?.name||messages[state.contextStatus]||'เลือก Business';
  if(purged){this.pendingDomain=state.contextStatus==='LOADING'&&sameBusiness&&this.target?.kind==='domain'?this.target.domainKey:null;this.closeSheet();this.content.replaceChildren();if(this.target?.kind==='domain'){this.target={kind:'shell',key:'lobby'};if(!this.host.hidden&&this.onNavigate){this.internalNavigation=true;try{this.onNavigate('lobby',{replace:true});}finally{this.internalNavigation=false;}return;}}}
  if(state.contextStatus==='READY'&&this.pendingDomain){const key=this.pendingDomain;this.pendingDomain=null;if(state.context?.domains.some(row=>row.domainKey===key)){if(this.onNavigate)this.onNavigate(domainDetail(key),{replace:true});else this.show(domainDetail(key));return;}}
  this.host.querySelector('.tycoon-hint').textContent=messages[state.contextStatus]||'ยังไม่มี Context';
  if(changed&&!this.host.hidden)this.renderDomain();
  if(this.sheet.open&&this.sheetMode==='ask')this.renderAskResult();else if(this.sheet.open&&this.sheetMode==='work')this.work(false);else if(this.sheet.open&&this.sheetMode==='connect')this.connection(false);
 }
 show(detail){if(!this.internalNavigation)this.pendingDomain=null;this.closeSheet();this.data.ensureFresh();this.target=resolveOfficeContextRoute(workspaceHash('office',detail),this.data.state.context);if(this.target.key==='studio')this.target={kind:'shell',key:'lobby'};this.host.hidden=false;if(this.data.hidden&&!this.root.ownerDocument.hidden)void this.data.setHidden(false);this.renderDomain();void this.data.setDomain(this.target.kind==='domain'?this.target.domainKey:null);}
 renderDomain(){const row=this.row,page=buildingPage(this.rows,this.page);this.page=page.page;this.floor=this.target.kind==='domain'?this.target.domainKey:this.target.key;this.room=this.floor==='growth'?createTycoonRoom('growth'):this.floor==='lobby'?createTycoonRoom('lobby'):null;
  this.host.querySelector('h1').textContent=row?`${this.rows.indexOf(row)+1} · ${row.label}`:this.floor==='building'?'ZURI · DOMAIN OFFICE':'G · Lobby';
  this.host.querySelector('.tycoon-edition').textContent='SYNTHETIC · CONTRACT CANDIDATE · ไม่เชื่อม live';
  this.host.querySelector('.tycoon-hint').textContent=messages[this.data.state.contextStatus]||'ยังไม่มี Context';
  const entry=this.host.querySelector('.tycoon-entry');entry.replaceChildren();
  if(this.floor==='building'){entry.append(button('เข้าออฟฟิศ → G Lobby',()=>this.onNavigate?.('lobby')),button('ดู directory ทุกชั้น',()=>this.directory()));if(this.rows.length){entry.append(el('p',`ชั้น ${page.start+1}–${page.start+page.rows.length} จาก ${page.total} · หน้า ${page.page+1}/${page.pages}`));const prev=button('ชั้นก่อนหน้า',()=>{this.page--;this.renderDomain();}),next=button('ชั้นถัดไป',()=>{this.page++;this.renderDomain();});prev.disabled=page.page===0;next.disabled=page.page+1===page.pages;entry.append(prev,next);}else entry.append(el('p',this.data.state.contextStatus==='READY'?'ไม่มี domain ที่ได้รับอนุญาต':'รายชื่อชั้นยังไม่พร้อม'));}
  else if(this.floor==='lobby')entry.append(button('เลือก Business / เชื่อม Zuri',()=>this.connection()),button('ดู directory ทุกชั้น',()=>this.directory()));
  else if(row?.domainKey==='growth')entry.append(button('วัตถุในชั้นนี้',()=>this.objects()));
  else entry.append(el('p',row?`${row.availability} · unsupported reader · ยังไม่มีตัวอ่านของชั้นนี้`:'Context ไม่พร้อม'),button('ดู directory ทุกชั้น',()=>this.directory()));
  if(row&&row.availability!=='ACTIVE')entry.append(el('p',row.availability+' · ไม่เปิดการอ่านข้อมูล'));
  if(this.data.state.businessId)entry.append(button('โหลดรายชื่อชั้นใหม่',()=>this.data.refreshContext()));
  this.host.querySelector('[data-nav=studio]').disabled=true;this.retryScene();
 }
 retryScene(){this.data.ensureFresh();if(this.host.hidden)return;const generation=this.renderGeneration=(this.renderGeneration||0)+1;this.scene?.dispose();this.scene=null;this.stage.replaceChildren();
  if(!this.room&&this.floor!=='building'){this.host.querySelector('.tycoon-notice').textContent='ชั้นนี้แสดงแบบข้อความ · ไม่มีการสร้าง Agent หรือ grant';return;}
  this.host.querySelector('.tycoon-notice').textContent='กำลังโหลดฉาก · ไม่เปลี่ยน Context';
  const status=m=>{if(generation===this.renderGeneration&&!this.host.hidden)this.host.querySelector('.tycoon-notice').textContent=m;};
  try{this.scene=new this.Scene(this.stage,{onPick:id=>this.pick(id),onStatus:status,onError:status});this.scene.setScene(this.floor,this.room,{demoActors:false,floorLabel:this.row?.label||this.floor,...(this.floor==='building'?{domainRows:buildingPage(this.rows,this.page).rows}:{})});}catch{status('3D ไม่พร้อม · ใช้ directory และปุ่มวัตถุเพื่อไปต่อ');}
 }
 directory(){this.data.ensureFresh();const body=this.openSheet('บอร์ดหน้าลิฟต์ · Business domains','floors');body.append(el('p',messages[this.data.state.contextStatus]||'Context ไม่พร้อม'));const lobby=button('G · Lobby',()=>this.onNavigate?.('lobby'));lobby.className='tycoon-floor-choice';body.append(lobby);if(this.data.state.contextStatus==='READY'&&!this.rows.length)body.append(el('p','ไม่มี domain ที่ได้รับอนุญาต'));for(const [i,row]of this.rows.entries()){const b=button(`${i+1} · ${row.label} · ${row.availability}`,()=>this.onNavigate?.(domainDetail(row.domainKey)));b.className='tycoon-floor-choice';body.append(b);}}
 objects(){if(this.floor!=='growth'){this.directory();return;}const body=this.openSheet('วัตถุในชั้นนี้','objects');for(const [label,operation,action]of [['บอร์ด Campaigns','marketing.campaigns.read',()=>this.work()],['Ask Marketing','marketing.overview.read',()=>this.ask()]]){const b=button(label,action);b.disabled=!this.data.canRead(operation);body.append(b);}body.append(el('p','อ่านตาม operation hint เท่านั้น · actions ว่าง'))}
 pick(id){this.data.ensureFresh();if(this.floor==='building'){if(id==='shell:lobby')this.onNavigate?.('lobby');else if(id.startsWith('domain:')&&this.rows.some(r=>domainDetail(r.domainKey)===id))this.onNavigate?.(id);return;}if(this.floor==='lobby'){if(id==='reception')this.connection();else this.directory();return;}if(this.floor==='growth'){if(id==='marketing-ask')this.ask();else if(id==='marketing-board'||id.startsWith('desk-'))this.work();else if(['lift','directory'].includes(id))this.directory();else this.openSheet('ของตกแต่ง · ไม่มีคำสั่งธุรกิจ','object');}}
 work(open=true){if(!this.data.canRead('marketing.campaigns.read')){const body=this.openSheet('ข้อมูลของชั้นนี้','work',open);body.append(el('p',this.row?.domainKey!=='growth'?'unsupported reader · ไม่มี operation สำหรับชั้นนี้':'การอ่านไม่พร้อม · ต้องมี ACTIVE และ ALLOW'),button('ดู directory ทุกชั้น',()=>this.directory()));return;}super.work(open);const ask=[...this.content.querySelectorAll('button')].find(b=>b.textContent==='Ask Marketing');if(ask)ask.disabled=!this.data.canRead('marketing.overview.read');}
 ask(){if(!this.data.canRead('marketing.overview.read')){this.openSheet('Ask Marketing ไม่พร้อม','object').append(el('p','ต้องมี ACTIVE และ ALLOW สำหรับ marketing.overview.read'));return;}super.ask();}
 updateAskForm(){super.updateAskForm();const submit=this.content.querySelector('button[type=submit]');if(submit&&!this.data.canRead('marketing.overview.read'))submit.disabled=true;}
 toggleDoor(){return Promise.resolve({ok:false,reason:'read-only'});}
 dispose(){this.window.removeEventListener('focus',this.focus);this.root.ownerDocument.removeEventListener('visibilitychange',this.visibility);super.dispose();}
}
