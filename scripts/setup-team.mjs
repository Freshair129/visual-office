import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {access,t3Request,revokeLabel} from './t3-auth.mjs';
const label='ZURI setup '+randomUUID();
const auth=await access('orchestration:read orchestration:operate',label);
try{
const shell=await t3Request('/api/orchestration/shell',auth.token);
const project=shell.projects.find(p=>p.workspaceRoot.toLowerCase()===process.cwd().toLowerCase());if(!project)throw new Error('T3 workspace project not found');
const members=['Mira · Marketing Lead','Kai · Content Strategist','Pim · CRM Specialist','Theo · Performance Marketer','Nara · Lifecycle Specialist','Beam · Marketing Analyst'];
const dispatch=command=>t3Request('/api/orchestration/dispatch',auth.token,{commandId:randomUUID(),...command});
if(project.title==='visual-office')await dispatch({type:'project.meta.update',projectId:project.id,title:'Marketing & CRM'});
const ids=[];
for(const title of members){
 let thread=shell.threads.find(t=>t.projectId===project.id&&t.title===title&&!t.archivedAt);
 if(!thread&&title===members[0]){thread=shell.threads.find(t=>t.projectId===project.id&&t.title==='New thread'&&!t.latestTurn&&!t.session);if(thread)await dispatch({type:'thread.meta.update',threadId:thread.id,title});}
 if(!thread){const id=randomUUID();await dispatch({type:'thread.create',threadId:id,projectId:project.id,title,modelSelection:{instanceId:'codex',model:'gpt-6-astra'},runtimeMode:'approval-required',interactionMode:'default',branch:null,worktreePath:null,createdAt:new Date().toISOString()});thread={id};}
 ids.push(thread.id);
}
await writeFile('.local/team-threads.json',JSON.stringify(ids));console.log(JSON.stringify({projectId:project.id,threads:ids}));
if(process.argv.includes('--smoke')){
 const detail=await t3Request('/api/orchestration/threads/'+ids[0]+'?turnLimit=2',auth.token);
 if(detail.thread.latestTurn?.state==='running')throw new Error('Thread is already running');
 await dispatch({type:'thread.turn.start',threadId:ids[0],message:{messageId:randomUUID(),role:'user',text:'ทดสอบการเชื่อมต่อ ZURI Office กับ T3 Code: อ่าน package.json และ README.md ใน workspace นี้ แล้วตอบสั้น ๆ เป็นภาษาไทยว่าโปรเจกต์นี้ใช้เทคโนโลยีอะไร และพร้อมติดตาม agent ผ่าน T3 หรือไม่ ห้ามแก้ไขไฟล์ ห้ามรันงานแคมเปญ ห้ามอ่าน credential หรือไฟล์ใน .local/.t3/.codex',attachments:[]},runtimeMode:'approval-required',interactionMode:'default',createdAt:new Date().toISOString()});
 console.log('Read-only Codex smoke test submitted.');
}
}finally{await revokeLabel(label);}
