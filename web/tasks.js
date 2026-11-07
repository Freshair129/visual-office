import {profiles,profileById} from './agent-profiles.js';
import {officeApiUrl} from './office-api-base.js';
const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
async function api(path,method,body){const r=await fetch(officeApiUrl(path),{method,headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok)throw new Error(data.error||'บันทึกไม่สำเร็จ');return data;}
export class TaskUI{
 #options;#requestId;#knowledgeVersions=[];#knowledgeLoad=null;#knowledgeError='';
 constructor(options){
  this.#options=options;
  $('#task-agent').replaceChildren(...profiles.map(p=>new Option(`${p.name} · ${p.role}`,p.id)));
  const checks=$('#task-members');
  for(const p of profiles){const l=el('label','');const c=document.createElement('input');c.type='checkbox';c.value=p.id;c.checked=p.id!=='mira';l.append(c,el('span',`${p.name} · ${p.role}`));checks.append(l);}
  $('#task-mode').onchange=()=>this.#mode();$('#task-agent').onchange=()=>this.#mode();
  const knowledge=document.createElement('fieldset');knowledge.id='task-knowledge';knowledge.className='task-knowledge';knowledge.innerHTML='<legend>เอกสารที่ตรวจทานแล้ว</legend><p class="info-note">เลือกเอกสารที่อนุมัติไว้ในความรู้ทีมได้ไม่เกิน 5 ไฟล์และ 20 MiB ต่อหนึ่งงาน</p><div id="task-knowledge-list"></div><p id="task-knowledge-feedback" class="info-note" role="status"></p>';
  $('#task-brief').closest('label').after(knowledge);
  knowledge.addEventListener('change',()=>this.#renderKnowledge());
  $('#task-form').addEventListener('input',()=>{this.#requestId=null;});
  $('#task-form').onsubmit=e=>{e.preventDefault();void this.#submit();};

 }
 open({chooseRecipient=false}={}){if(this.#options.isDemo()){this.#options.toast('กลับเข้าโหมดเชื่อมต่อ T3 เพื่อสั่งงานจริง');return;}
  const select=$('#task-agent'),previous=select.value;select.querySelector('[data-choose-recipient]')?.remove();
  if(chooseRecipient){const option=new Option('เลือกผู้รับงาน','');option.disabled=true;option.dataset.chooseRecipient='';select.prepend(option);$('#task-mode').value='solo';for(const member of document.querySelectorAll('#task-members input'))member.checked=false;}
  select.value=chooseRecipient?'':this.#options.getAgent();if(previous!==select.value)this.#requestId=null;
  $('#task-feedback').textContent='';this.#mode();this.#knowledgeLoad=this.#loadKnowledge();$('#task-dialog').showModal();}
 async #loadKnowledge(){
  const feedback=$('#task-knowledge-feedback');feedback.textContent='กำลังโหลดเอกสารที่อนุมัติไว้…';
  try{const response=await fetch(officeApiUrl('knowledge'),{headers:{'accept':'application/json'},signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'โหลดเอกสารไม่สำเร็จ');this.#knowledgeVersions=Array.isArray(data.versions)?data.versions.filter(v=>v.status==='approved'):[];this.#knowledgeError='';this.#renderKnowledge();}
  catch(error){this.#knowledgeError=error?.message||'โหลดเอกสารไม่สำเร็จ';feedback.textContent='โหลดรายการไม่สำเร็จ จึงไม่แนบเอกสารใดกับงานนี้ · '+this.#knowledgeError;this.#knowledgeVersions=[];this.#renderKnowledge();}
 }
 #renderKnowledge(){
  const list=$('#task-knowledge-list'),feedback=$('#task-knowledge-feedback');if(!list||!feedback)return;const selected=new Set([...list.querySelectorAll('input:checked')].map(input=>input.value));list.replaceChildren();
  if(this.#knowledgeError){feedback.textContent='โหลดรายการไม่สำเร็จ จึงไม่แนบเอกสารใดกับงานนี้ · '+this.#knowledgeError;return;}
  let count=0,total=0;
  for(const version of this.#knowledgeVersions){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=version.id;input.checked=selected.has(version.id);if(input.checked){count++;total+=version.sizeBytes;}label.append(input,el('span',`${version.name} · ${(version.sizeBytes/1024/1024).toFixed(2)} MiB`));list.append(label);}
  for(const input of list.querySelectorAll('input:not(:checked)'))input.disabled=count>=5||total+this.#knowledgeVersions.find(v=>v.id===input.value).sizeBytes>20*1024*1024;
  feedback.textContent=this.#knowledgeVersions.length?`เลือกแล้ว ${count}/5 ไฟล์ · ${(total/1024/1024).toFixed(2)}/20 MiB`:'ไม่มีเอกสารที่อนุมัติให้เลือก';
 }
 #selectedKnowledge(){return [...$('#task-knowledge-list').querySelectorAll('input:checked')].map(input=>input.value);}
 #mode(){const team=$('#task-mode').value==='team';$('#solo-choice').hidden=team;$('#team-choice').hidden=!team;$('#task-agent').required=!team;const p=profileById($('#task-agent').value);$('#task-role').textContent=team?'สมาชิกทำส่วนของตัวเองพร้อมกัน แล้วส่งผลให้ Mira สรุปรวมเป็นแชทอีกหนึ่งงาน':p?`${p.focus} · ${p.instructions}`:'วัตถุในฉากยังไม่ผูก Agent · เลือกผู้รับงานก่อนส่ง';}
 async #submit(){
  const b=$('#task-submit');b.disabled=true;$('#task-feedback').textContent='';
  if(this.#knowledgeLoad)await this.#knowledgeLoad;
  const team=$('#task-mode').value==='team';const agentIds=team?[...document.querySelectorAll('#task-members input:checked')].map(c=>c.value):[$('#task-agent').value];
  if(!agentIds.length||agentIds.some(id=>!profileById(id))){$('#task-feedback').textContent='เลือกผู้รับงานอย่างน้อยหนึ่งคน';b.disabled=false;return;}
  const knowledgeVersionIds=this.#selectedKnowledge();
  const selected=this.#knowledgeVersions.filter(v=>knowledgeVersionIds.includes(v.id));if(selected.length!==knowledgeVersionIds.length||selected.length>5||selected.reduce((n,v)=>n+v.sizeBytes,0)>20*1024*1024){$('#task-feedback').textContent='รายการเอกสารเปลี่ยนหรือเกินขีดจำกัด กรุณาโหลดรายการใหม่ในความรู้ทีม';b.disabled=false;return;}
  this.#requestId??=crypto.randomUUID();
  try{
   const {job}=await api('jobs','POST',{id:this.#requestId,title:$('#task-title').value,brief:$('#task-brief').value,agentIds,team,knowledgeVersionIds});
   this.#requestId=null;$('#task-dialog').close();$('#task-title').value='';$('#task-brief').value='';this.#options.openWork(job.id);this.#options.toast(this.#options.queueNotice?.()||'ส่งงานเข้าคิวแล้ว เครื่องที่รัน T3 จะรับงานอัตโนมัติ');void this.#options.refresh();
  }catch(e){$('#task-feedback').textContent=e.message+' — ลองส่งอีกครั้งได้ ระบบใช้ ID เดิมป้องกันงานซ้ำ';}finally{b.disabled=false;}
 }
}
