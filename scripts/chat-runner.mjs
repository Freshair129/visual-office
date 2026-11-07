export async function advanceChat(message,{shell,detail,dispatch,budget,initialMessages,prepareAttachments}){
 const thread=shell.threads.find(t=>t.id===message.threadId);
 if(!thread){if(initialMessages.some(m=>m.threadId===message.threadId&&m.canStart))return null;return{status:'error',error:'ไม่พบแชทใน T3'};}
 if(thread.archivedAt||thread.deletedAt)return{status:'error',error:'แชทถูกเก็บถาวรหรือลบใน T3'};
 const already=detail?.thread.messages.find(m=>m.id===message.id);
 if(already){
  const turn=thread.latestTurn;
  if(already.turnId&&turn?.turnId!==already.turnId)return{status:'done'};
  if(turn?.state==='completed')return{status:'done'};
  if(['error','interrupted'].includes(turn?.state))return{status:'error',error:'รอบสนทนาหยุด ตรวจแชทใน T3'};
  return message.status==='sent'?null:{status:'sent'};
 }
 if(message.status==='sent')return null;
 if(thread.latestTurn?.state==='running'||['starting','running'].includes(thread.session?.status)||thread.hasPendingApprovals||thread.hasPendingUserInput||thread.hasActionableProposedPlan||budget.remaining<=0)return null;
 if(message.attachments?.length&&!prepareAttachments)throw new Error('ระบบไฟล์แนบยังไม่พร้อม');
 const attachments=message.attachments?.length?await prepareAttachments(message):[];
 await dispatch({type:'thread.turn.start',commandId:message.commandId,threadId:message.threadId,message:{messageId:message.id,role:'user',text:message.text,attachments},runtimeMode:'approval-required',interactionMode:'default',createdAt:message.createdAt});
 budget.remaining--;thread.latestTurn={state:'running'}; // Serialize multiple queued messages on this thread in the same tick.
 return{status:'sent'};
}
export function chatSnapshot(thread,detail,initialMessages,config){
 const turn=thread.latestTurn;let status=turn?.state==='completed'?'done':'idle';
 if(turn?.state==='running'||['starting','running'].includes(thread.session?.status)||thread.backgroundLiveness==='working')status='working';
 if(thread.hasPendingApprovals||thread.hasPendingUserInput||thread.hasActionableProposedPlan||turn?.state==='error'||thread.session?.status==='error')status='stuck';
 const allMessages=detail.thread.messages.filter(m=>['user','assistant','system'].includes(m.role)).map(m=>{
  const initial=initialMessages.find(s=>s.threadId===thread.id&&s.messageId===m.id);const text=initial?initial.text:m.text||'';
  return{id:m.id,role:m.role,text:text.slice(0,8000),attachments:(m.attachments||[]).filter(a=>['image','file'].includes(a.type)).map(a=>({id:a.id,type:a.type,name:a.name,mimeType:a.mimeType,sizeBytes:a.sizeBytes})),createdAt:m.createdAt||m.updatedAt,truncated:text.length>8000};
 });
 let first=Math.max(0,allMessages.length-100),messages=allMessages.slice(first),snapshot;
 const provider=config?.providers?.find(p=>p.instanceId===thread.modelSelection?.instanceId);
 const project=config?.projectRoot;const workspace=provider?.workspaceSnapshots?.find(w=>w.cwd.toLowerCase()===project?.toLowerCase());
 const usage=(detail.thread.activities||[]).filter(a=>a.kind==='context-window.updated'&&Number.isSafeInteger(a.payload?.usedTokens)&&a.payload.usedTokens>=0).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0))[0];
 const context=usage?{usedTokens:usage.payload.usedTokens,...(Number.isSafeInteger(usage.payload.maxTokens)&&usage.payload.maxTokens>0?{maxTokens:usage.payload.maxTokens}:{}),updatedAt:usage.createdAt||null}:null;
 const capabilities=provider||thread.modelSelection?{provider:provider?.displayName||provider?.driver||thread.modelSelection?.instanceId||'',model:thread.modelSelection?.model||'',context,skills:(workspace?.skills||provider?.skills||[]).filter(s=>s.enabled).map(s=>({name:s.displayName||s.name,description:s.shortDescription||s.description||''})),commands:(workspace?.slashCommands||provider?.slashCommands||[]).map(s=>({name:s.name,description:s.description||''})),observedTools:[...new Set((detail.thread.activities||[]).filter(a=>a.tone==='tool').map(a=>a.summary).filter(Boolean))].slice(-20)}:null;
 const makeSnapshot=()=>({threadId:thread.id,status,messages,historyTruncated:first>0,capabilities});
 snapshot=makeSnapshot();
 // Leave headroom under the Worker request limit for JSON metadata and UTF-8 payload overhead.
 while(first<allMessages.length&&JSON.stringify(snapshot).length>400000){first++;messages=allMessages.slice(first);snapshot=makeSnapshot();}
 return snapshot;
}
