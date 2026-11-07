import {handleZuriRead} from './zuri-read.js';
import {resolveOfficeApi} from '../shared/office-api-routes.js';
import {profiles} from '../web/agent-profiles.js';
import {handleChat} from './chat.js';
import {handleWorkReview} from './work-review.js';
import {handleResultFiles} from './result-files.js';
import {handleKnowledge,knowledgeFingerprint,reserveKnowledgeJob,releaseKnowledgeJobReservation} from './knowledge.js';
// Private Sites sign-in gates browser requests before this Worker runs.
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const states=new Set(['working','stuck','done','idle','offline']);
const clean=(s,n)=>typeof s==='string'?s.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n):'';
async function body(request,max=64000){const text=await request.text();if(text.length>max)throw new Error('Payload too large');return JSON.parse(text);}
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const jobKey=id=>'office/jobs/'+id+'.json';
const sameJobRequest=(stored,job,versionIds)=>stored.title===job.title&&stored.brief===job.brief&&stored.team===job.team&&JSON.stringify(stored.agentIds)===JSON.stringify(job.agentIds)&&JSON.stringify(stored.knowledgeVersionIds||[])===JSON.stringify(versionIds);
const runnerAuth=(request,env)=>!!env.OFFICE_SYNC_KEY&&request.headers.get('authorization')==='Bearer '+env.OFFICE_SYNC_KEY;
const terminal=new Set(['done','error','cancelled']);
async function listJobs(bucket){
 let cursor;const jobs=[];
 do{const page=await bucket.list({prefix:'office/jobs/',limit:1000,...(cursor?{cursor}:{})});
  const records=await Promise.all(page.objects.map(o=>bucket.get(o.key)));for(const r of records)if(r){const j=await r.json();j.cancelRequested=!!(await bucket.get('office/cancel/'+j.id));jobs.push(j);}
  cursor=page.truncated?page.cursor:null;
 }while(cursor);
 return jobs.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
const writeJob=(bucket,job)=>bucket.put(jobKey(job.id),JSON.stringify(job),{httpMetadata:{contentType:'application/json'}});
export async function handleApi(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/zuri/'))return handleZuriRead(request,env);
 const route=resolveOfficeApi(url.pathname);
 if(!route)return json({error:'Not found'},404);
 if(!route.methods.includes(request.method))return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{'content-type':'application/json','cache-control':'no-store',allow:route.methods.join(', ')}});
 if(!env.BUCKET)return json({error:'Storage unavailable'},503);
 const review=await handleWorkReview(request,env,{json,body,uuid,listJobs});if(review)return review;
 const files=await handleResultFiles(request,env,{json,body,uuid,listJobs});if(files)return files;
 const chat=await handleChat(request,env,{json,body,uuid,runnerAuth,listJobs});if(chat)return chat;
 const knowledge=await handleKnowledge(request,env,{json,body,uuid,runnerAuth,listJobs});if(knowledge)return knowledge;
 if(url.pathname==='/api/team'){
  if(request.method==='GET'){const r=await env.BUCKET.get('office/team.json');return json({profiles,context:r?(await r.json()).context:''});}
  if(request.method==='PUT'){
   if(request.headers.get('origin')!==url.origin)return json({error:'Invalid origin'},403);
   try{const v=await body(request,10000);if(typeof v.context!=='string'||v.context.length>6000)throw new Error();await env.BUCKET.put('office/team.json',JSON.stringify({context:v.context.trim()}));return json({ok:true});}catch{return json({error:'Invalid context'},400);}
  }
 }
 if(url.pathname==='/api/jobs'){
  if(request.method==='GET'){const jobs=await listJobs(env.BUCKET);return json({jobs:jobs.filter((j,i)=>i<50||!terminal.has(j.status))});}
  if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)return json({error:'Invalid origin'},403);
   try{
    const v=await body(request,20000);
    const requestedVersionIds=v.knowledgeVersionIds===undefined?[]:v.knowledgeVersionIds;
    if(!uuid(v.id)||typeof v.title!=='string'||!v.title.trim()||v.title.length>120||typeof v.brief!=='string'||!v.brief.trim()||v.brief.length>10000||!Array.isArray(v.agentIds)||!v.agentIds.length||v.agentIds.length>profiles.length||new Set(v.agentIds).size!==v.agentIds.length||v.agentIds.some(id=>!profiles.some(p=>p.id===id))||typeof v.team!=='boolean'||(!v.team&&v.agentIds.length!==1)||!Array.isArray(requestedVersionIds)||requestedVersionIds.length>5||new Set(requestedVersionIds).size!==requestedVersionIds.length||requestedVersionIds.some(id=>!uuid(id)))throw new Error();
    const versionIds=[...requestedVersionIds].sort();
    const fingerprint=await knowledgeFingerprint({title:v.title,brief:v.brief,agentIds:v.agentIds,team:v.team,versionIds});
    const existing=await env.BUCKET.get(jobKey(v.id));
    if(existing){const j=await existing.json();if(j.title!==v.title.trim()||j.brief!==v.brief.trim()||j.team!==v.team||JSON.stringify(j.agentIds)!==JSON.stringify(v.agentIds)||JSON.stringify(j.knowledgeVersionIds||[])!==JSON.stringify(versionIds))return json({error:'Task ID already used'},409);await releaseKnowledgeJobReservation(env.BUCKET,v.id,fingerprint);return json({job:j});}
    const jobs=await listJobs(env.BUCKET);if(jobs.filter(j=>!terminal.has(j.status)).length>=10)return json({error:'มีงานค้างครบ 10 งานแล้ว รอหรือยกเลิกงานก่อน'},429);
    const contextRecord=await env.BUCKET.get('office/team.json');
    const context=contextRecord?(await contextRecord.json()).context:'';
    const step=(agentId,phase)=>({agentId,phase,threadId:crypto.randomUUID(),messageId:crypto.randomUUID(),createCommandId:crypto.randomUUID(),startCommandId:crypto.randomUUID(),interruptCommandId:crypto.randomUUID(),status:'queued',result:''});
    const reservation=await reserveKnowledgeJob(env.BUCKET,{jobId:v.id,versionIds,fingerprint,createJob:knowledgeSnapshot=>{
     const job={id:v.id,title:v.title.trim(),brief:v.brief.trim(),team:v.team,agentIds:v.agentIds,context,knowledgeVersionIds:versionIds,knowledgeSnapshot,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'queued',cancelRequested:false,runnerError:null,steps:v.agentIds.map(id=>step(id,'specialist'))};
     if(v.team)job.steps.push(step('mira','synthesis'));return job;
    }});
    if(reservation.error)return json({error:reservation.error},reservation.status||409);
    const job=reservation.job;
    try{
     const saved=await env.BUCKET.put(jobKey(job.id),JSON.stringify(job),{onlyIf:new Headers({'if-none-match':'*'}),httpMetadata:{contentType:'application/json'}});
     let responseJob=job;
     if(saved===null){const raced=await env.BUCKET.get(jobKey(job.id));if(!raced){await releaseKnowledgeJobReservation(env.BUCKET,v.id,fingerprint);return json({error:'Task could not be saved'},503);}const stored=await raced.json();if(!sameJobRequest(stored,job,versionIds)){await releaseKnowledgeJobReservation(env.BUCKET,v.id,fingerprint);return json({error:'Task ID already used'},409);}responseJob=stored;}
     await releaseKnowledgeJobReservation(env.BUCKET,v.id,fingerprint);return json({job:responseJob},saved===null?200:201);
    }catch(error){
     const raced=await env.BUCKET.get(jobKey(v.id)).catch(()=>null);
     if(!raced)await releaseKnowledgeJobReservation(env.BUCKET,v.id,fingerprint).catch(()=>{});
     if(raced){const stored=await raced.json();if(sameJobRequest(stored,job,versionIds)){await releaseKnowledgeJobReservation(env.BUCKET,v.id,fingerprint).catch(()=>{});return json({job:stored});}await releaseKnowledgeJobReservation(env.BUCKET,v.id,fingerprint).catch(()=>{});return json({error:'Task ID already used'},409);}
     throw error;
    }
   }catch{return json({error:'ข้อมูลงานไม่ถูกต้อง'},400);}
  }
 }
 const cancel=url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)\/cancel$/i);
 if(cancel&&request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return json({error:'Invalid origin'},403);
  if(!uuid(cancel[1]))return json({error:'Invalid ID'},400);
  const record=await env.BUCKET.get(jobKey(cancel[1]));if(!record)return json({error:'Not found'},404);
  const job=await record.json();if(!terminal.has(job.status)){await env.BUCKET.put('office/cancel/'+job.id,'true');job.cancelRequested=true;}return json({job});
 }
 if(url.pathname==='/api/runner/jobs'&&request.method==='GET'){
  if(!runnerAuth(request,env))return json({error:'Unauthorized'},401);
  return json({jobs:(await listJobs(env.BUCKET)).filter(j=>!terminal.has(j.status))});
 }
 const update=url.pathname.match(/^\/api\/runner\/jobs\/([0-9a-f-]+)$/i);
 if(update&&request.method==='PUT'){
  if(!runnerAuth(request,env))return json({error:'Unauthorized'},401);
  if(!uuid(update[1]))return json({error:'Invalid ID'},400);
  const record=await env.BUCKET.get(jobKey(update[1]));if(!record)return json({error:'Not found'},404);
  try{
   const job=await record.json(),v=await body(request,250000);const valid=new Set(['queued','running','waiting','done','error','cancelled']);
   if(!valid.has(v.status)||!Array.isArray(v.steps)||v.steps.length!==job.steps.length)throw new Error();
   job.steps=job.steps.map((s,i)=>{const incoming=v.steps[i];if(incoming.threadId!==s.threadId||incoming.agentId!==s.agentId||incoming.phase!==s.phase||!valid.has(incoming.status)||typeof incoming.result!=='string'||incoming.result.length>12000)throw new Error();return{...s,status:incoming.status,result:incoming.result,resultTruncated:incoming.resultTruncated===true};});
   // Cancellation may arrive while the runner is working. Never overwrite it.
   job.status=v.status;job.runnerError=clean(v.runnerError,300)||null;job.updatedAt=new Date().toISOString();job.cancelRequested=!!(await env.BUCKET.get('office/cancel/'+job.id));await writeJob(env.BUCKET,job);return json({ok:true,cancelRequested:job.cancelRequested});
  }catch{return json({error:'Invalid update'},400);}
 }
 if(url.pathname==='/api/sync'&&request.method==='POST'){
  if(!env.OFFICE_SYNC_KEY||request.headers.get('authorization')!=='Bearer '+env.OFFICE_SYNC_KEY)return json({error:'Unauthorized'},401);
  try{
   const incoming=await body(request);if(incoming.version!==1||!Array.isArray(incoming.sessions)||incoming.sessions.length>100)throw new Error('Invalid snapshot');
   const seen=new Set();const sessions=incoming.sessions.map(s=>{
    if(typeof s.id!=='string'||!s.id||seen.has(s.id)||!states.has(s.status))throw new Error('Invalid session');seen.add(s.id);
    return{id:clean(s.id,200),name:clean(s.name,100),role:clean(s.role,100),provider:clean(s.provider,100),status:s.status,currentFile:clean(s.currentFile,500)||null,lastLog:clean(s.lastLog,1000),updatedAt:clean(s.updatedAt,50)};
   });
   const snapshot={version:1,sessions,source:'Office bridge snapshot',hostStatus:incoming.hostStatus==='live'?'live':'offline',receivedAt:new Date().toISOString()};
   await env.BUCKET.put('office/latest.json',JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
   return json({ok:true,receivedAt:snapshot.receivedAt,count:sessions.length});
  }catch{return json({error:'Invalid snapshot'},400);}
 }
 if(url.pathname==='/api/office'&&request.method==='GET'){
  const record=await env.BUCKET.get('office/latest.json');const snapshot=record?await record.json():{version:1,sessions:[],receivedAt:null,hostStatus:'offline'};
  const stale=!snapshot.receivedAt||Date.now()-Date.parse(snapshot.receivedAt)>30000||snapshot.hostStatus!=='live';
  return json({...snapshot,stale,sessions:snapshot.sessions.map(s=>stale?{...s,status:'offline'}:s)});
 }
 if(url.pathname==='/api/preferences'){
  if(request.method==='GET'){const record=await env.BUCKET.get('office/preferences.json');return json(record?await record.json():{assignments:null,avatars:null});}
  if(request.method==='PUT'){
   // Only same-origin browser mutations; never accept cross-site CSRF.
   if(request.headers.get('origin')!==url.origin)return json({error:'Invalid origin'},403);
   try{const prefs=await body(request,12000);if(!Array.isArray(prefs.assignments)||prefs.assignments.length!==profiles.length||!prefs.avatars||typeof prefs.avatars!=='object')throw new Error();
    const assignments=prefs.assignments.map(a=>({id:typeof a?.id==='string'?clean(a.id,200):null,name:clean(a?.name,32)}));
    const avatars=Object.fromEntries(Array.from({length:profiles.length},(_,i)=>{const a=prefs.avatars[i];if(!a||!/^#[0-9a-f]{6}$/i.test(a.outfit)||!/^#[0-9a-f]{6}$/i.test(a.skin)||!['short','bob','bun'].includes(a.hair)||typeof a.glasses!=='boolean')throw new Error();return[i,{outfit:a.outfit,skin:a.skin,hair:a.hair,glasses:a.glasses}]}));
    await env.BUCKET.put('office/preferences.json',JSON.stringify({assignments,avatars}));return json({ok:true});
   }catch{return json({error:'Invalid preferences'},400);}
  }
 }
 return json({error:'Not found'},404);
}
export default {async fetch(request,env){
 const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleApi(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const asset=ASSETS[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return new Response('Not found',{status:404});
 const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
 // Allow the authored model-review document, not arbitrary same-origin frames.
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':`frame-src blob: ${url.origin}/character-lab.html; object-src 'none'; base-uri 'self'`}});
}};
