import {profiles} from './agent-profiles.js';
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
const labels={working:'กำลังทำงาน',stuck:'รอความช่วยเหลือ',done:'ทำงานจบแล้ว',idle:'พร้อมรับงาน',offline:'ขาดการเชื่อมต่อ'};
export class TeamPage {
 constructor(root,options){this.root=root;this.options=options;this.signature='';this.agents=[];}
 update({agents=[],jobs=[]}){
  this.agents=agents;this.jobs=jobs;const signature=JSON.stringify([agents,jobs.map(j=>[j.id,j.title,j.status])]);if(signature===this.signature)return;this.signature=signature;
  const grid=el('div','','team-page-grid');
  profiles.forEach((profile,i)=>{
   const agent=agents[i]||{},card=el('article','','team-profile');card.id='profile-'+profile.id;
   const head=el('div','','team-profile-heading'),avatar=el('span','','mini-avatar');avatar.innerHTML=this.options.avatarIcon(agent);
   const info=el('div');info.append(el('h2',profile.name),el('p',profile.role));head.append(avatar,info);card.append(head,el('span',labels[agent.status]||'ยังไม่มีสถานะ','team-profile-status'),el('p',profile.focus));
   const instructions=el('details');instructions.append(el('summary','ขอบเขตบทบาท'),el('p',profile.instructions));card.append(instructions);
   const assigned=jobs.filter(j=>j.steps?.some(s=>s.agentId===profile.id)&&!['done','error','cancelled'].includes(j.status));
   card.append(el('h3','งานที่กำลังรับ · '+assigned.length));if(!assigned.length)card.append(el('p','ยังไม่มีงานที่กำลังทำ','empty-note'));
   for(const job of assigned){const button=el('button',job.title,'team-work-link');button.onclick=()=>this.options.onOpenWork(job.id);card.append(button);}
   const actions=el('div','','team-profile-actions'),chat=el('button','แชท','secondary-button'),task=el('button','สั่งงาน','primary-button'),avatarButton=el('button','แต่ง avatar','secondary-button');
   chat.onclick=()=>this.options.onChat(i);task.onclick=()=>this.options.onTask(i);avatarButton.onclick=()=>this.options.onAvatar(i);actions.append(chat,task,avatarButton);card.append(actions);
   const tools=el('details'),toolOutput=el('div','เปิดดูเพื่ออ่านความสามารถที่ T3 รายงาน','team-tools');tools.append(el('summary','เครื่องมือของแชทปัจจุบัน'),toolOutput);
   tools.addEventListener('toggle',async()=>{if(!tools.open||tools.dataset.loaded)return;const current=this.agents[i];if(!current?.sessionId){toolOutput.textContent='ยังไม่มีแชทที่รายงานเครื่องมือ';return;}
    toolOutput.textContent='กำลังอ่านจาก T3…';try{const response=await fetch('/api/chats/'+encodeURIComponent(current.sessionId),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error();const data=await response.json(),cap=data.capabilities;toolOutput.replaceChildren();
     toolOutput.append(el('p',cap?.model?'โมเดล · '+cap.model:'T3 ยังไม่รายงานโมเดล'));
     const list=el('ul');for(const skill of cap?.skills||[]){list.append(el('li',typeof skill==='string'?skill:skill.name||skill.id||'ทักษะที่รายงาน'));}toolOutput.append(list,el('p',list.children.length?'การอนุมัติเครื่องมือทำใน T3':'T3 ยังไม่รายงานรายการทักษะของแชทนี้'));tools.dataset.loaded='true';
    }catch{toolOutput.textContent='ยังอ่านเครื่องมือไม่ได้ ลองปิดแล้วเปิดอีกครั้ง';}});card.append(tools);grid.append(card);
  });this.root.replaceChildren(grid);
 }
 open(id){if(id)this.root.querySelector('#profile-'+CSS.escape(id))?.scrollIntoView({block:'start'});}
}
