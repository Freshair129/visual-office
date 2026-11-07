import {profiles} from './agent-profiles.js';
export function roleCards(sessions,assignments,avatars,jobs,online=true){
 return profiles.map((p,i)=>{
  const steps=jobs.flatMap(j=>j.steps.filter(s=>s.agentId===p.id&&(s.status!=='cancelled'||sessions.some(t=>t.id===s.threadId))).map(s=>({...s,job:j})));
  const active=steps.filter(s=>['running','waiting'].includes(s.status));
  const liveActive=steps.filter(s=>['working','stuck'].includes(sessions.find(t=>t.id===s.threadId)?.status));
  const preferred=liveActive.find(s=>sessions.find(t=>t.id===s.threadId)?.status==='stuck')||liveActive[0]||active.find(s=>s.status==='waiting')||active[0]||steps[0];
  const taskSessions=steps.map(s=>sessions.find(t=>t.id===s.threadId)).filter(Boolean);
  const manual=sessions.find(s=>s.id===assignments[i]?.id);
  const chosen=(preferred&&sessions.find(s=>s.id===preferred.threadId))||manual;
  let status=chosen?.status||'idle';
  if(liveActive.length)status=liveActive.some(s=>sessions.find(t=>t.id===s.threadId)?.status==='stuck')?'stuck':'working';
  else if(active.length)status=active.some(s=>s.status==='waiting')?'stuck':'working';
  else if(preferred)status=preferred.status==='done'?'done':preferred.status==='error'?'stuck':'idle';
  if(!online)status='offline';
  return {...chosen,id:p.id,sessionId:chosen?.id||null,name:p.name,role:p.role,focus:p.focus,avatar:avatars[i],status,
   currentFile:chosen?.currentFile||null,lastLog:preferred?.status==='queued'?'งานอยู่ในคิว รอ T3 รับงาน':chosen?.lastLog||preferred?.result||'พร้อมรับงานตามบทบาท',
   activeCount:new Set([...active,...liveActive].map(s=>s.threadId)).size,taskCount:steps.length,taskTitle:preferred?.job.title||null,sessions:taskSessions,jobId:preferred?.job.id||null};
 });
}
