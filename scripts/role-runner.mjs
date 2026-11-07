import {taskPrompt} from '../web/agent-profiles.js';
// Commands, threads and messages have durable IDs allocated by the queue. A restart
// checks the existing message before reusing a command; it cannot create a new chat.
export async function advanceJob(job,{shell,details,dispatch,project,prepareKnowledge,budget={remaining:6},now=()=>new Date().toISOString()}){
 let changed=false;
 for(const step of job.steps){
  if(['done','error','cancelled'].includes(step.status))continue;
  const summary=shell.threads.find(t=>t.id===step.threadId);
  const detail=details.get(step.threadId)?.thread;
  if(job.cancelRequested){
   if(summary?.latestTurn?.state==='running')await dispatch({type:'thread.turn.interrupt',commandId:step.interruptCommandId,threadId:step.threadId,createdAt:now()});
   step.status='cancelled';changed=true;continue;
  }
  if(step.phase==='synthesis'){
   if(job.steps.some(s=>s.phase==='specialist'&&s.status==='error')){step.status='cancelled';changed=true;continue;}
   if(!job.steps.filter(s=>s.phase==='specialist').every(s=>s.status==='done'))continue;
  }
  if(step.status==='queued'){
   const alreadySent=detail?.messages.some(m=>m.id===step.messageId||m.messageId===step.messageId);
   if(!alreadySent){
    if(budget.remaining<=0)continue;
    // Keep the user's existing Codex model selection on this project.
    const selection=shell.threads.find(t=>t.projectId===project.id&&t.modelSelection?.instanceId==='codex')?.modelSelection;
    if(!selection)throw new Error('ไม่พบโมเดล Codex ของโปรเจกต์ใน T3');
    let attachments=[];
    if(job.knowledgeSnapshot?.length){
     if(typeof prepareKnowledge!=='function')throw new Error('ไม่สามารถแนบเอกสารความรู้ที่งานเลือกไว้ได้');
     attachments=await prepareKnowledge(job,step);
     if(!Array.isArray(attachments)||attachments.length!==job.knowledgeSnapshot.length||attachments.some((a,i)=>a?.type!=='file'||typeof a.id!=='string'||a.name!==job.knowledgeSnapshot[i].name||a.mimeType!==job.knowledgeSnapshot[i].mimeType||a.sizeBytes!==job.knowledgeSnapshot[i].sizeBytes))throw new Error('ไฟล์ความรู้ที่เลือกแนบไม่ครบหรือข้อมูลไม่ตรงกัน');
    }
    // The raw legacy HTTP dispatcher does not execute client-side bootstrap.
    // Create first, then start; each command has its own durable receipt ID.
    if(!summary){
     if(!step.createCommandId)throw new Error('งานนี้สร้างจากคิวรุ่นเก่า กรุณายกเลิกและส่งใหม่');
     await dispatch({type:'thread.create',commandId:step.createCommandId,threadId:step.threadId,projectId:project.id,title:`[ZURI:${step.agentId}] ${job.title}${step.phase==='synthesis'?' · สรุปทีม':''}`,modelSelection:selection,runtimeMode:'approval-required',interactionMode:'default',branch:null,worktreePath:null,createdAt:job.createdAt});
    }
    await dispatch({type:'thread.turn.start',commandId:step.startCommandId,threadId:step.threadId,
     message:{messageId:step.messageId,role:'user',text:taskPrompt(job,step),attachments},runtimeMode:'approval-required',interactionMode:'default',createdAt:job.createdAt});
    budget.remaining--;
   }
   step.status='running';changed=true;continue;
  }
  if(!summary||summary.archivedAt||summary.deletedAt){step.status='error';step.result='ไม่พบแชทงานที่ใช้งานได้ใน T3';changed=true;continue;}
  if(!detail)continue;
  const turn=summary.latestTurn;
  if(turn?.state==='completed'){
   const messages=detail.messages.filter(m=>m.role==='assistant'&&(!m.turnId||m.turnId===turn.turnId));
   const result=messages.map(m=>m.text||'').join('\n\n').trim();
   step.result=result.slice(0,12000);step.resultTruncated=result.length>12000;step.status='done';changed=true;
  }else if(turn?.state==='error'||turn?.state==='interrupted'||summary.session?.status==='error'){
   step.status='error';step.result='งานหยุดหรือเกิดข้อผิดพลาด ตรวจแชทใน T3';changed=true;
  }else{
   const status=summary.hasPendingApprovals||summary.hasPendingUserInput||summary.hasActionableProposedPlan?'waiting':'running';
   if(step.status!==status){step.status=status;changed=true;}
  }
 }
 const specialists=job.steps.filter(s=>s.phase==='specialist');
 const status=job.cancelRequested?'cancelled':job.steps.every(s=>s.status==='done')?'done':job.steps.every(s=>['done','error','cancelled'].includes(s.status))?'error':job.steps.some(s=>s.status==='waiting')?'waiting':job.steps.every(s=>s.status==='queued')?'queued':'running';
 if(job.status!==status){job.status=status;changed=true;}
 if(changed){job.updatedAt=now();job.runnerError=null;}
 return changed;
}
