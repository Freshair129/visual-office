import {writeFile} from 'node:fs/promises';
import {access,t3Request} from './t3-auth.mjs';
import {normalizeLegacy} from './t3-legacy.mjs';
import {loadBridgeConfig} from './bridge-config.mjs';
import {advanceJob} from './role-runner.mjs';
import {advanceChat,chatSnapshot} from './chat-runner.mjs';
import {prepareChatAttachments} from './chat-attachments.mjs';
import {prepareKnowledgeAttachments} from './knowledge-attachments.mjs';
import {t3Rpc} from './t3-rpc.mjs';
const config=await loadBridgeConfig();let auth,lastSessions=[],failures=0;
let providerConfig=null,configTime=0;
const stop=()=>{process.exit(0)};process.on('SIGINT',stop);process.on('SIGTERM',stop);
async function tick(){
 let hostStatus='live',problem=null;
 try{
  if(!auth||auth.expiresAt<Date.now()+60000)auth=await access('orchestration:read orchestration:operate','ZURI Office role runner');
  const shell=await t3Request('/api/orchestration/shell',auth.token);
  if(Date.now()-configTime>60000){try{providerConfig=await t3Rpc(auth.token,'server.getConfig');configTime=Date.now();}catch{configTime=Date.now()-45000;}}
  const threads=shell.threads.filter(t=>!t.archivedAt&&!t.deletedAt).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).slice(0,100);
  // Poll all assigned active threads; details are bounded to the most recent turns.
  const details=await Promise.all(threads.map(t=>t3Request('/api/orchestration/threads/'+encodeURIComponent(t.id)+'?turnLimit=2',auth.token)));
  lastSessions=threads.map((t,i)=>normalizeLegacy(t,details[i]));
  const project=shell.projects.find(p=>p.workspaceRoot.toLowerCase()===process.cwd().toLowerCase());
  if(project){
   // The cloud queue requires a second private credential, unavailable to browsers.
   const headers={'OAI-Sites-Authorization':'Bearer '+config.siteBearer,authorization:'Bearer '+config.syncKey,'content-type':'application/json'};
   const queued=await fetch(config.siteUrl+'/api/runner/jobs',{headers,signal:AbortSignal.timeout(15000)});
   if(queued.status!==404){
    if(!queued.ok)throw new Error('Office queue HTTP '+queued.status);
    const jobs=(await queued.json()).jobs;
    const detailMap=new Map(threads.map((t,i)=>[t.id,details[i]]));
    // Include durable queued task threads even when they fall outside the latest 100.
    for(const step of jobs.flatMap(j=>j.steps))if(!detailMap.has(step.threadId)&&shell.threads.some(t=>t.id===step.threadId&&!t.deletedAt&&!t.archivedAt))detailMap.set(step.threadId,await t3Request('/api/orchestration/threads/'+encodeURIComponent(step.threadId)+'?turnLimit=2',auth.token));
    const budget={remaining:Math.max(0,6-shell.threads.filter(t=>t.latestTurn?.state==='running').length)};
    for(const job of jobs.reverse()){
     let changed;
     try{changed=await advanceJob(job,{shell,details:detailMap,project,budget,dispatch:command=>t3Request('/api/orchestration/dispatch',auth.token,command),prepareKnowledge:(j,s)=>prepareKnowledgeAttachments(j,{token:auth.token,step:s,cloud:(route,options={})=>fetch(config.siteUrl+route,{...options,headers:{...headers,...(options.headers||{})},signal:AbortSignal.timeout(30000)})})});}
     catch(error){job.runnerError=error.message;changed=true;}
     if(changed){const saved=await fetch(config.siteUrl+'/api/runner/jobs/'+job.id,{method:'PUT',headers,body:JSON.stringify(job),signal:AbortSignal.timeout(15000)});if(!saved.ok)throw new Error('Office task save HTTP '+saved.status);}
    }
    const chatQueue=await fetch(config.siteUrl+'/api/runner/chats',{headers,signal:AbortSignal.timeout(15000)});
    if(chatQueue.status!==404){
     if(!chatQueue.ok)throw new Error('Office chat queue HTTP '+chatQueue.status);
     const chat=await chatQueue.json();
     const watched=new Set([...chat.watches.map(w=>w.threadId),...chat.messages.map(m=>m.threadId)]);
     for(const id of watched){const thread=shell.threads.find(t=>t.id===id&&!t.archivedAt&&!t.deletedAt);if(thread)detailMap.set(id,await t3Request('/api/orchestration/threads/'+encodeURIComponent(id)+'?turnLimit=20',auth.token));}
     for(const message of chat.messages){
      let update;
      try{update=await advanceChat(message,{shell,detail:detailMap.get(message.threadId),budget,initialMessages:chat.initialMessages,dispatch:command=>t3Request('/api/orchestration/dispatch',auth.token,command),prepareAttachments:m=>prepareChatAttachments(m,{token:auth.token,cloud:(route,options={})=>fetch(config.siteUrl+route,{...options,headers,signal:AbortSignal.timeout(30000)})})});}
      catch(error){update={status:/T3 HTTP (400|403|404|409|500)/.test(error.message)?'error':message.status,error:error.message};}
      if(update){const r=await fetch(config.siteUrl+'/api/runner/chats/messages/'+message.threadId+'/'+message.id,{method:'PUT',headers,body:JSON.stringify(update),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Office chat message save HTTP '+r.status);}
     }
     for(const id of watched){const thread=shell.threads.find(t=>t.id===id&&!t.archivedAt&&!t.deletedAt),detail=detailMap.get(id);if(!thread||!detail)continue;const r=await fetch(config.siteUrl+'/api/runner/chats/snapshot',{method:'POST',headers,body:JSON.stringify(chatSnapshot(thread,detail,chat.initialMessages,providerConfig?{...providerConfig,projectRoot:project.workspaceRoot}:null)),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Office chat sync HTTP '+r.status);}
    }
   }
  }
 }catch(error){hostStatus='offline';auth=null;problem=error.message;}
 try{
  const response=await fetch(config.siteUrl+'/api/sync',{method:'POST',headers:{'content-type':'application/json','OAI-Sites-Authorization':'Bearer '+config.siteBearer,authorization:'Bearer '+config.syncKey},body:JSON.stringify({version:1,sessions:lastSessions,hostStatus}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Office sync HTTP '+response.status);
  const result=await response.json();failures=0;
  await writeFile('.local/bridge-status.json',JSON.stringify({hostStatus,lastSync:result.receivedAt,count:lastSessions.length,error:problem}));
 }catch(error){failures++;await writeFile('.local/bridge-status.json',JSON.stringify({hostStatus:'offline',lastAttempt:new Date().toISOString(),error:error.message}));}
 setTimeout(tick,Math.min(30000,5000*2**Math.min(failures,3)));
}
console.log('ZURI Office bridge started (private outbound sync + role task runner).');await tick();
