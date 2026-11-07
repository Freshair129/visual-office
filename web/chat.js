import {fileMetadata,fileSize,FILE_COUNT_LIMIT,TOTAL_FILE_LIMIT} from './file-policy.js';
import {quickMessage} from './chat-view.js';
import {contextDisplay} from './chat-context.js';
const $=s=>document.querySelector(s);
const label={idle:'พร้อมคุย',working:'กำลังตอบ…',stuck:'ต้องตรวจสอบใน T3',done:'ตอบแล้ว',offline:'รอเครื่อง T3 ออนไลน์'};
const el=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
export class ChatUI{
 #thread=null;#visible=true;#name;#timer;#generation=0;#watched=0;#drafts=new Map();#sending=new Set();#signature='';#first=true;#latestMessages=[];#pendingMessages=[];#olderMessages=[];#latestCursor=null;#olderCursor=null;#hasMoreHistory=false;#historyTruncated=false;#historyLoading=false;#historyAnchor=null;
 constructor({toast,refresh,renderMessage,disposeMessages,contactTitle}){this.toast=toast;this.refresh=refresh;this.renderMessage=renderMessage||((target,text)=>target.textContent=text);this.disposeMessages=disposeMessages||(()=>{});this.contactTitle=contactTitle||(name=>'คุยกับ '+name);
  $('#chat-form').onsubmit=e=>{e.preventDefault();void this.#send();};
  $('#chat-input').oninput=()=>{if(this.#thread){const draft=this.#draft();draft.text=$('#chat-input').value;draft.id=null;}};
  $('#chat-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();if(!e.repeat)void this.#send();}};
  $('#chat-attach').onclick=()=>$('#chat-files').click();
  $('#chat-load-older').onclick=()=>void this.#loadOlder();
  $('#chat-files').onchange=()=>{const files=[...($('#chat-files').files||[])];$('#chat-files').value='';void this.#addFiles(files);};
 }
 setVisible(value){
  const next=!!value;if(next===this.#visible)return;
  this.#visible=next;clearTimeout(this.#timer);this.#generation++;this.#historyLoading=false;
  if(next&&this.#thread)void this.#poll(this.#generation,this.#thread);
 }
 #draft(thread=this.#thread){let d=this.#drafts.get(thread);if(!d){d={text:'',id:null,files:[]};this.#drafts.set(thread,d);}d.files??=[];return d;}
 async #api(thread,route='',method='GET',body){const r=await fetch('/api/chats/'+thread+route,{method,cache:'no-store',headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw new Error(d.error||'เชื่อมต่อแชทไม่สำเร็จ');return d;}
 #controls(){const disabled=!this.#thread||this.#sending.has(this.#thread);$('#chat-send').disabled=disabled||!!this.#drafts.get(this.#thread)?.files?.some(f=>f.state!=='ready');$('#chat-input').disabled=disabled;$('#chat-attach').disabled=disabled;$('#chat-files').disabled=disabled;}
 open(threadId,name){this.#name=name;$('#chat-title').textContent=this.contactTitle(name);if(threadId===this.#thread)return;
  clearTimeout(this.#timer);this.#generation++;this.#thread=threadId;this.#watched=0;this.#signature='';this.#first=true;this.#latestMessages=[];this.#pendingMessages=[];this.#olderMessages=[];this.#latestCursor=null;this.#olderCursor=null;this.#hasMoreHistory=false;this.#historyTruncated=false;this.#historyLoading=false;this.#historyAnchor=null;this.#historyButton();
  $('#chat-input').value=this.#drafts.get(threadId)?.text||'';$('#chat-feedback').textContent='';$('#chat-status').textContent='กำลังเชื่อมต่อ…';
  $('#chat-latest').textContent='กำลังโหลดข้อความล่าสุดของ '+name+'…';
  this.disposeMessages($('#chat-messages'));$('#chat-messages').replaceChildren(el('p','กำลังโหลดบทสนทนาของ '+name+'…','empty-note'));this.#renderFiles();this.#tools(null);this.#controls();if(this.#visible)void this.#poll(this.#generation,threadId);
 }
 empty(name,message,{selectionRequired=false}={}){if(this.#thread===null&&this.#name===name&&$('#chat-status').textContent===message)return;
  clearTimeout(this.#timer);this.#generation++;this.#thread=null;this.#name=name;this.#signature='';this.#latestMessages=[];this.#pendingMessages=[];this.#olderMessages=[];this.#latestCursor=null;this.#olderCursor=null;this.#hasMoreHistory=false;this.#historyTruncated=false;this.#historyLoading=false;this.#historyAnchor=null;this.#historyButton();
  $('#chat-title').textContent=this.contactTitle(name);$('#chat-status').textContent=message;$('#chat-input').value='';$('#chat-feedback').textContent='';
  $('#chat-latest').textContent=selectionRequired?message:'ยังไม่มีบทสนทนา · กดสั่งงานใหม่เพื่อเริ่มคุยกับ '+name;
  this.disposeMessages($('#chat-messages'));const wrap=el('div','','chat-empty');wrap.append(el('strong',selectionRequired?'เลือกผู้รับก่อนเริ่มแชท':'เริ่มงานกับ '+name),el('p',selectionRequired?message:'กดสั่งงานใหม่เพื่อเปิดแชทตามบทบาท แล้วคุยต่อได้ตรงนี้'));$('#chat-messages').replaceChildren(wrap);this.#renderFiles();this.#tools(null);this.#controls();
 }
 async #poll(generation,thread){clearTimeout(this.#timer);if(generation!==this.#generation||!this.#visible)return;
  try{if(Date.now()-this.#watched>60000){await this.#api(thread,'/watch','POST',{});if(generation!==this.#generation)return;this.#watched=Date.now();}
   const d=await this.#api(thread);if(generation!==this.#generation)return;$('#chat-status').textContent=label[d.status]||'กำลังเชื่อมต่อ';this.#tools(d.capabilities,d.stale);
   $('#chat-latest').textContent=quickMessage(d.messages,d.pending,this.#name);
   const latestMessages=d.messages||[];
   if(this.#olderMessages.length){const latestIds=new Set(latestMessages.map(m=>m.id)),olderIds=new Set(this.#olderMessages.map(m=>m.id));
    const aged=this.#latestMessages.filter(m=>!latestIds.has(m.id)&&!olderIds.has(m.id)),merged=new Map([...this.#olderMessages,...aged].map(m=>[m.id,m]));
    this.#olderMessages=[...merged.values()].sort((a,b)=>{const left=Date.parse(a.createdAt||''),right=Date.parse(b.createdAt||'');return Number.isFinite(left)&&Number.isFinite(right)?left-right:0;});
   }
   this.#latestMessages=latestMessages;this.#pendingMessages=d.pending||[];
   if(!this.#olderMessages.length){this.#latestCursor=d.historyCursor||this.#latestMessages[0]?.id||null;this.#olderCursor=this.#latestCursor;this.#hasMoreHistory=d.hasMoreHistory===true;this.#historyTruncated=d.historyTruncated===true;}
   this.#historyButton();const signature=this.#currentSignature();if(signature!==this.#signature){this.#signature=signature;this.#renderMessages();}
  }catch(e){if(generation===this.#generation){$('#chat-status').textContent=e.message;}}
  finally{if(generation===this.#generation&&this.#visible)this.#timer=setTimeout(()=>this.#poll(generation,thread),5000);}
 }
 #currentSignature(){return JSON.stringify([this.#latestMessages,this.#pendingMessages,this.#olderMessages,this.#hasMoreHistory,this.#historyTruncated]);}
 #historyButton(){const button=$('#chat-load-older');button.hidden=!this.#hasMoreHistory;button.disabled=this.#historyLoading;button.textContent=this.#historyLoading?'กำลังโหลดข้อความ…':'โหลดข้อความก่อนหน้า';button.setAttribute?.('aria-busy',String(this.#historyLoading));}
 #renderMessages({preserveTop=false}={}){const list=$('#chat-messages'),scroll=list.scrollTop,height=list.scrollHeight,atEnd=this.#first||list.scrollHeight-scroll-list.clientHeight<60,visible=preserveTop?this.#visibleAnchor(list):null;
  this.#historyAnchor=visible;
  this.disposeMessages(list);list.replaceChildren();this.#historyButton();
  const messages=[...this.#olderMessages,...this.#latestMessages],ids=new Set(messages.map(m=>m.id));
  for(const m of messages)this.#bubble(m.role,m.text,m.truncated?'ข้อความย่อ':null,m.attachments,m.createdAt,preserveTop,m.id);
  for(const m of this.#pendingMessages)if(!ids.has(m.id))this.#bubble('user',m.text,m.status==='error'?'ส่งไม่สำเร็จ · '+m.error:m.status==='sent'?'ส่งแล้ว กำลังรอคำตอบ':m.error?'รอลองส่งใหม่ · '+m.error:'อยู่ในคิว',m.attachments,null,preserveTop,m.id);
  if(!messages.length&&!this.#pendingMessages.length){const wrap=el('div','','chat-empty');wrap.append(el('strong',this.#name+' พร้อมคุย'),el('p','พิมพ์ข้อความด้านล่างเพื่อเริ่มบทสนทนาในแชทนี้'));list.append(wrap);}
  if(this.#historyTruncated&&!this.#hasMoreHistory)list.append(el('p','แสดงเฉพาะประวัติส่วนล่าสุดที่ซิงก์จาก T3','chat-history-note'));
  list.scrollTop=preserveTop?scroll+list.scrollHeight-height:atEnd?list.scrollHeight:scroll;
  if(this.#historyAnchor)this.#historyAnchor.element=[...list.children].find(node=>node.dataset?.messageId===this.#historyAnchor.id)||null;
  this.#first=false;
 }
 async #loadOlder(){const thread=this.#thread,generation=this.#generation,cursor=this.#olderCursor||this.#latestCursor;if(!thread||!cursor||!this.#hasMoreHistory||this.#historyLoading)return;
  this.#historyLoading=true;this.#historyButton();
  try{const page=await this.#api(thread,'/history?before='+encodeURIComponent(cursor)+'&limit=30');if(generation!==this.#generation)return;
   const known=new Set([...this.#olderMessages,...this.#latestMessages].map(m=>m.id));this.#olderMessages=[...(page.messages||[]).filter(m=>!known.has(m.id)),...this.#olderMessages];this.#olderCursor=page.nextCursor||null;this.#hasMoreHistory=page.hasMoreHistory===true;this.#historyTruncated=page.historyTruncated===true;this.#historyLoading=false;this.#renderMessages({preserveTop:true});this.#signature=this.#currentSignature();
  }catch(e){if(generation===this.#generation){this.#historyLoading=false;this.#historyButton();$('#chat-feedback').textContent=e.message;}}
 }
 #visibleAnchor(list){if(!list.getBoundingClientRect)return null;const viewport=list.getBoundingClientRect();for(const node of list.children){if(node.dataset?.messageId===undefined||!node.getBoundingClientRect)continue;const rect=node.getBoundingClientRect();if(rect.bottom>viewport.top&&rect.top<viewport.bottom)return{id:node.dataset.messageId,element:node};}return null;}
 #anchorTop(node){return node?.getBoundingClientRect?.().top??null;}
 #bubble(role,text,note,files,createdAt,preserveAnchor=false,id=null){const d=el('div','','chat-bubble '+role),content=el('div','','message-body');if(id!==null&&id!==undefined)d.dataset.messageId=String(id);d.append(el('small',role==='user'?'คุณ':role==='assistant'?this.#name:'ระบบ'),content);
  const list=$('#chat-messages');let stick=false,anchorBefore=null;this.renderMessage(content,text,{onResize:({before=false}={})=>{if(before){stick=!preserveAnchor&&list.scrollHeight-list.scrollTop-list.clientHeight<120;const anchor=this.#historyAnchor,attached=anchor?.element&&(anchor.element.isConnected||list.contains?.(anchor.element));anchorBefore=preserveAnchor&&attached?this.#anchorTop(anchor.element):null;}else if(preserveAnchor&&anchorBefore!==null){const anchor=this.#historyAnchor,attached=anchor?.element&&(anchor.element.isConnected||list.contains?.(anchor.element));if(attached){const after=this.#anchorTop(anchor.element);if(after!==null)list.scrollTop+=after-anchorBefore;}anchorBefore=null;}else if(stick)list.scrollTop=list.scrollHeight;}});
  if(role==='assistant'&&$('#chat-avatar').innerHTML){const avatar=el('span','','message-avatar mini-avatar');avatar.innerHTML=$('#chat-avatar').innerHTML;d.append(avatar);}
  for(const f of files||[])d.append(el('span',f.name+' · '+fileSize(f.sizeBytes),'chat-file-record'));if(note)d.append(el('small',note,'chat-note'));if(createdAt&&Number.isFinite(Date.parse(createdAt)))d.append(el('time',new Date(createdAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}),'message-time'));list.append(d);}
 #tools(capabilities,stale=false){const wrap=$('#chat-tool-list');const signature=JSON.stringify([capabilities,stale]);if(wrap.dataset?.signature===signature)return;if(wrap.dataset)wrap.dataset.signature=signature;wrap.replaceChildren();
  const context=contextDisplay(capabilities,stale);$('#chat-model').textContent=context.model;$('#chat-context').textContent=context.text;$('#chat-context').title=context.title;$('#chat-context-meter').hidden=context.percent===null;$('#chat-context-meter').value=Math.min(100,context.percent??0);
  if(!capabilities){wrap.append(el('p',this.#thread?'กำลังรอข้อมูลทักษะจาก T3…':'เลือกแชทเพื่อดูทักษะที่ T3 รายงาน','chat-help'));return;}
  wrap.append(el('p',capabilities.provider+' · '+capabilities.model+(stale?' · ข้อมูลล่าสุดก่อนออฟไลน์':''),'tool-provider'));
  wrap.append(el('p','ทักษะที่ T3 รายงานสำหรับแชทนี้','tool-label'));const skills=el('ul','','tool-skills');for(const skill of capabilities.skills||[]){const li=el('li','');li.append(el('strong',skill.name));if(skill.description)li.append(el('span',skill.description));skills.append(li);}if(!skills.children.length)skills.append(el('li','T3 ยังไม่รายงานทักษะ'));wrap.append(skills);
  if(capabilities.observedTools?.length){wrap.append(el('p','การใช้เครื่องมือที่พบในแชทล่าสุด','tool-label'));const list=el('ul','','tool-skills');for(const tool of capabilities.observedTools)list.append(el('li',tool));wrap.append(list);}
  wrap.append(el('p','รายชื่อ tool/MCP ทั้งหมดไม่ได้ส่งผ่าน API นี้ การรันคำสั่งหรือแก้ไขไฟล์ที่ต้องอนุมัติยังจัดการใน T3','chat-help'));
 }
 #renderFiles(){const wrap=$('#chat-attachments');wrap.replaceChildren();for(const file of this.#drafts.get(this.#thread)?.files||[]){const chip=el('div','','attachment-chip');chip.append(el('span',file.name+' · '+fileSize(file.sizeBytes)),el('small',file.state==='ready'?'พร้อมแนบ':file.state==='uploading'?'กำลังอัปโหลด…':file.error));if(file.state==='error'){const retry=el('button','ลองใหม่');retry.type='button';retry.onclick=()=>void this.#upload(this.#thread,file);chip.append(retry);}const remove=el('button','×');remove.type='button';remove.setAttribute?.('aria-label','เอาไฟล์ '+file.name+' ออก');remove.disabled=this.#sending.has(this.#thread);remove.onclick=()=>{const draft=this.#draft();if(file.state==='uploading'&&file.uploadController&&!file.uploadController.signal.aborted)file.uploadController.abort();draft.files=draft.files.filter(f=>f.id!==file.id);draft.id=null;this.#renderFiles();this.#controls();};chip.append(remove);wrap.append(chip);}}
 async #addFiles(files){const thread=this.#thread;if(!thread||this.#sending.has(thread))return;const draft=this.#draft(thread);$('#chat-feedback').textContent='';
  for(const file of files){try{const meta=fileMetadata(file.name,file.size);if(draft.files.length>=FILE_COUNT_LIMIT)throw new Error('แนบได้สูงสุด 5 ไฟล์ต่อข้อความ');if(draft.files.reduce((n,f)=>n+f.sizeBytes,0)+file.size>TOTAL_FILE_LIMIT)throw new Error('ไฟล์รวมต้องไม่เกิน 20 MB');const item={...meta,id:crypto.randomUUID(),file,state:'uploading'};draft.files.push(item);draft.id=null;void this.#upload(thread,item);}catch(e){$('#chat-feedback').textContent=e.message;}}
  this.#renderFiles();this.#controls();
 }
 async #upload(thread,item){item.state='uploading';if(thread===this.#thread){this.#renderFiles();this.#controls();}
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(new DOMException('The operation timed out','TimeoutError')),60000);item.uploadController=controller;
  try{const r=await fetch('/api/chats/'+thread+'/attachments/'+item.id,{method:'POST',headers:{'content-type':item.mimeType,'x-file-name':encodeURIComponent(item.name)},body:item.file,signal:controller.signal});const d=await r.json();if(!r.ok)throw new Error(d.error||'อัปโหลดไม่สำเร็จ');if(!this.#drafts.get(thread)?.files?.includes(item))return;item.state='ready';item.error=null;}catch(e){if(this.#drafts.get(thread)?.files?.includes(item)){item.state='error';item.error=e.message;}}
  finally{clearTimeout(timeout);if(item.uploadController===controller)item.uploadController=null;if(this.#drafts.get(thread)?.files?.includes(item)&&thread===this.#thread){this.#renderFiles();this.#controls();}}
 }
 async #send(){const thread=this.#thread,name=this.#name,text=$('#chat-input').value.trim();if(!thread||this.#sending.has(thread))return;
  const draft=this.#draft(thread);if(!text&&!draft.files.length)return;if(draft.files.some(f=>f.state!=='ready'))return;draft.text=text;draft.id??=crypto.randomUUID();this.#sending.add(thread);this.#controls();
  const generation=this.#generation;$('#chat-feedback').textContent='';
  try{await this.#api(thread,'/messages','POST',{id:draft.id,text,attachments:draft.files.map(f=>f.id)});this.#drafts.delete(thread);
   if(generation===this.#generation){$('#chat-input').value='';this.#renderFiles();this.#first=true;await this.#poll(generation,thread);}void this.refresh();
  }catch(e){if(generation===this.#generation)$('#chat-feedback').textContent=e.message+' · กดส่งอีกครั้งได้ ระบบกันข้อความซ้ำ';else this.toast('ส่งข้อความไม่สำเร็จ กลับไปที่แชท '+name+' เพื่อลองใหม่');}
  finally{this.#sending.delete(thread);this.#controls();}
 }
}
