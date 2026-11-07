import {ChatQueueError,enqueueChatMessage} from './chat.js';

const PREFIX='office/reviews/';
const OUTBOX_PREFIX='office/review-handoff-outbox/';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reviewKey=id=>PREFIX+id+'.json';
const outboxKey=id=>OUTBOX_PREFIX+id+'.json';
const reviewStates=new Set(['pending','accepted','changes_requested']);
const reviewActions=new Set(['metadata','accepted','changes_requested']);

function emptyReview(jobId){return{jobId,dueDate:'',acceptance:'',reviewStatus:'pending',note:'',updatedAt:null};}
function validDate(value){
 if(value==='')return true;
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function validText(value,max){return typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);}
function sameReview(a,b){return a.jobId===b.jobId&&a.dueDate===b.dueDate&&a.acceptance===b.acceptance&&a.reviewStatus===b.reviewStatus&&a.note===b.note;}
function validHandoff(value){return !!value&&typeof value==='object'&&UUID.test(value.revisionId)&&UUID.test(value.messageId)&&UUID.test(value.commandId)&&UUID.test(value.threadId);}
function validStoredReview(value,id){return !!value&&value.jobId===id&&validDate(value.dueDate)&&validText(value.acceptance,4000)&&reviewStates.has(value.reviewStatus)&&validText(value.note,2000)&&typeof value.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt))&&(value.handoff===undefined||validHandoff(value.handoff));}

function reviewSnapshot(review){
 if(!review)return null;
 return{jobId:review.jobId,dueDate:review.dueDate,acceptance:review.acceptance,reviewStatus:review.reviewStatus,note:review.note,updatedAt:review.updatedAt};
}
async function deterministicUuid(namespace,seed){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`zuri-review-handoff-v1:${namespace}:${seed}`)));
 bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=[...bytes.slice(0,16)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 return`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function resolveDestination(job,uuid){
 if(job.cancelRequested===true||!Array.isArray(job.steps))return null;
 const phase=job.team===true?'synthesis':job.team===false?'specialist':null;
 if(!phase)return null;
 const candidates=job.steps.filter(step=>step?.phase===phase);
 if(candidates.length!==1||candidates[0].status!=='done'||!uuid(candidates[0].threadId))return null;
 return candidates[0].threadId;
}
function handoffText(job,review){
 const title=(typeof job.title==='string'?job.title:'').trim().slice(0,120)||'Untitled job';
 const note=review.note.trim().slice(0,2000);
 const acceptance=review.acceptance.trim().slice(0,4000)||'(not specified)';
 return`Review requested for completed job\nJob ID: ${job.id}\nTitle: ${title}\nReview note:\n${note}\nAcceptance criteria:\n${acceptance}`;
}
async function makeHandoff(job,threadId,previous,review){
 const seed=JSON.stringify({jobId:job.id,threadId,from:reviewSnapshot(previous),to:reviewSnapshot({...review,updatedAt:null})});
 return{
  revisionId:await deterministicUuid('revision',seed),
  messageId:await deterministicUuid('message',seed),
  commandId:await deterministicUuid('command',seed),
  threadId
 };
}
async function readReview(bucket,key,id){
 const record=await bucket.get(key);if(!record)return{record:null,review:null};
 let review;
 try{review=await record.json();}catch{return{record,invalid:true};}
 return{record,review:validStoredReview(review,id)?review:null,invalid:!validStoredReview(review,id)};
}
function handoffState(message){
 return{status:message.status,messageId:message.id,threadId:message.threadId};
}
async function ensureQueued(bucket,job,review,pointer,threadId,uuid){
 if(!validHandoff(pointer)||pointer.threadId!==threadId||!uuid(pointer.messageId)||!uuid(pointer.commandId)){
  return{error:'ไม่สามารถยืนยันปลายทางของรายการแก้ไขได้',status:409};
 }
 try{
  const key=outboxKey(pointer.revisionId),text=handoffText(job,review);
  const intent={...pointer,jobId:job.id,text,status:'pending',createdAt:new Date().toISOString()};
  let record=await bucket.get(key),outbox=record?await record.json():null;
  if(!record){
   const created=await bucket.put(key,JSON.stringify(intent),{onlyIf:new Headers({'if-none-match':'*'}),httpMetadata:{contentType:'application/json'}});
   if(created){record=created;outbox=intent;}else{record=await bucket.get(key);outbox=record?await record.json():null;}
  }
  if(!record||!outbox||outbox.revisionId!==pointer.revisionId||outbox.jobId!==job.id||outbox.messageId!==pointer.messageId||outbox.commandId!==pointer.commandId||outbox.threadId!==pointer.threadId||outbox.text!==text||!['pending','queued'].includes(outbox.status)){
   return{error:'ไม่สามารถยืนยันรายการแก้ไขใน outbox ได้',status:409};
  }
  const queued=await enqueueChatMessage(bucket,{id:pointer.messageId,threadId:pointer.threadId,text:handoffText(job,review),commandId:pointer.commandId});
  if(!['queued','sent','done'].includes(queued.message.status))return{error:'รายการแก้ไขในแชทยังไม่พร้อมส่ง',status:502};
  if(outbox.status!=='queued'){
   if(typeof record.etag!=='string')return{error:'ยืนยันสถานะ outbox ไม่ได้ ให้ลองบันทึกอีกครั้ง',status:503};
   const updated={...outbox,status:'queued',queuedAt:new Date().toISOString()};
   const saved=await bucket.put(key,JSON.stringify(updated),{onlyIf:{etagMatches:record.etag},httpMetadata:{contentType:'application/json'}});
   if(!saved){const latest=await bucket.get(key);const latestOutbox=latest?await latest.json():null;if(latestOutbox?.status!=='queued')return{error:'ยืนยันสถานะ outbox ไม่ได้ ให้ลองบันทึกอีกครั้ง',status:503};}
  }
  return{handoff:handoffState(queued.message)};
 }catch(error){
  return{error:error instanceof ChatQueueError?error.message:'ไม่สามารถบันทึกรายการแก้ไขลงคิวแชทได้',status:error instanceof ChatQueueError?error.status:503};
 }
}
function reviewWriteCondition(record){
 if(record){if(typeof record.etag!=='string')return null;return{onlyIf:{etagMatches:record.etag}};}
 return{onlyIf:new Headers({'if-none-match':'*'})};
}
const nextReviewTime=previous=>new Date(Math.max(Date.now(),previous?Date.parse(previous.updatedAt)+1:0)).toISOString();
const conflictResponse=json=>json({code:'REVIEW_CONFLICT',error:'ข้อมูลตรวจรับเปลี่ยนจากอีกหน้าต่างหนึ่ง โหลดข้อมูลล่าสุดก่อนบันทึก'},409);

/**
 * Handles durable, user-owned review metadata and review-to-chat handoffs.
 * Provider job state remains in office/jobs and is never modified here.
 */
export async function handleWorkReview(request,env,{json,body,uuid,listJobs}){
 const url=new URL(request.url);
 const collection=url.pathname==='/api/work-reviews';
 const match=url.pathname.match(/^\/api\/work-reviews\/([^/]+)$/);
 if(!collection&&!match)return null;
 if(!['GET','PUT'].includes(request.method))return json({error:'Method not allowed'},405);

 if(collection&&request.method==='GET'){
  const jobs=await listJobs(env.BUCKET),reviews=[];
  const known=new Set(jobs.map(job=>job.id));let cursor;
  do{
   const page=await env.BUCKET.list({prefix:PREFIX,limit:1000,...(cursor?{cursor}:{})});
   const records=await Promise.all(page.objects.map(async object=>{
    const id=object.key.slice(PREFIX.length).replace(/\.json$/,'');
    if(!uuid(id)||!known.has(id)||object.key!==reviewKey(id))return null;
    const record=await env.BUCKET.get(object.key);if(!record)return null;
    try{const value=await record.json();if(!validStoredReview(value,id))return null;return value;}catch{return null;}
   }));
   reviews.push(...records.filter(Boolean));cursor=page.truncated?page.cursor:null;
  }while(cursor);
  reviews.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  return json({reviews});
 }

 if(match&&request.method==='GET'){
  const jobId=match[1];if(!uuid(jobId))return json({error:'Invalid ID'},400);
  if(!(await listJobs(env.BUCKET)).some(job=>job.id===jobId))return json({error:'Not found'},404);
  const found=await readReview(env.BUCKET,reviewKey(jobId),jobId);
  if(found.invalid)return json({error:'Review unavailable'},500);
  return json({review:found.review||emptyReview(jobId)});
 }

 // All writes are browser initiated and same-origin. The review record uses
 // conditional writes, while the chat message uses a create-only queue key.
 if(request.headers.get('origin')!==url.origin)return json({error:'Invalid origin'},403);
 const jobId=match?.[1]||null;if(jobId&&!uuid(jobId))return json({error:'Invalid ID'},400);
 let value;
 try{value=await body(request,10000);}catch{return json({error:'Invalid review'},400);}
 if(!value||typeof value!=='object'||Array.isArray(value))return json({error:'Invalid review'},400);
 // Optional for older clients; the current UI always supplies its edit base.
 const hasBase=Object.hasOwn(value,'baseUpdatedAt');
 if(hasBase&&value.baseUpdatedAt!==null&&(typeof value.baseUpdatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.baseUpdatedAt)||!Number.isFinite(Date.parse(value.baseUpdatedAt))))return json({error:'Invalid review base'},400);
 const targetId=(jobId||value.jobId||'').toLowerCase(),action=value.action===undefined?'metadata':value.action;
 if(!uuid(targetId)||typeof value.jobId!=='string'||value.jobId.toLowerCase()!==targetId||jobId&&jobId.toLowerCase()!==targetId||
  !reviewActions.has(action)||!validDate(value.dueDate)||!validText(value.acceptance,4000)||!reviewStates.has(value.reviewStatus)||!validText(value.note,2000)||
  action==='accepted'&&value.reviewStatus!=='accepted'||action==='changes_requested'&&value.reviewStatus!=='changes_requested')return json({error:'Invalid review'},400);

 const normalized={jobId:targetId,dueDate:value.dueDate,acceptance:value.acceptance.trim(),reviewStatus:value.reviewStatus,note:value.note.trim()};
 if(action==='changes_requested'&&!normalized.note)return json({error:'บันทึกว่าต้องแก้ต้องมีบันทึกการตรวจ'},400);
 const jobs=await listJobs(env.BUCKET),job=jobs.find(item=>item.id.toLowerCase()===targetId);
 if(!job)return json({error:'Not found'},404);
 if(normalized.reviewStatus!=='pending'&&job.status!=='done')return json({error:'Task must be complete before review'},409);

 const key=reviewKey(job.id),current=await readReview(env.BUCKET,key,job.id);
 if(current.invalid)return json({error:'Review unavailable'},500);
 let previous=current.review;
 // Identical retries are safe, including retrying an already committed outbox.
 // A different stale payload must never write or enqueue against a newer base.
 if(hasBase&&value.baseUpdatedAt!==(previous?.updatedAt??null)&&(!previous||!sameReview(previous,normalized)))return conflictResponse(json);
 if(action!=='changes_requested'&&previous&&sameReview(previous,normalized))return json({review:previous});

 if(action==='changes_requested'){
  const threadId=resolveDestination(job,uuid);
  if(!threadId)return json({error:'ไม่พบขั้นตอนปลายทางที่ชัดเจนสำหรับส่งรายการแก้ไข'},409);

  // A saved pointer lets a retry finish enqueue after a transient queue error.
  if(previous&&sameReview(previous,normalized)&&previous.handoff){
   const queued=await ensureQueued(env.BUCKET,job,normalized,previous.handoff,threadId,uuid);
   if(queued.error)return json({error:queued.error},queued.status);
   return json({review:previous,handoff:queued.handoff});
  }

  const pointer=await makeHandoff(job,threadId,previous,normalized);
  const review={...normalized,updatedAt:nextReviewTime(previous),handoff:pointer};
  const condition=reviewWriteCondition(current.record);
  if(!condition)return json({error:'Review version unavailable; reload before retrying'},503);
  const stored=await env.BUCKET.put(key,JSON.stringify(review),{...condition,httpMetadata:{contentType:'application/json'}});
  if(!stored){
   const latest=await readReview(env.BUCKET,key,job.id);
   if(latest.invalid)return json({error:'Review unavailable'},500);
   if(!latest.review||!sameReview(latest.review,normalized)||!latest.review.handoff)return conflictResponse(json);
   const queued=await ensureQueued(env.BUCKET,job,normalized,latest.review.handoff,threadId,uuid);
   if(queued.error)return json({error:queued.error},queued.status);
   return json({review:latest.review,handoff:queued.handoff});
  }

  const queued=await ensureQueued(env.BUCKET,job,normalized,pointer,threadId,uuid);
  if(queued.error)return json({error:queued.error},queued.status);
  return json({review,handoff:queued.handoff});
 }

 const review={...normalized,updatedAt:nextReviewTime(previous)};
 const condition=reviewWriteCondition(current.record);
 if(!condition)return json({error:'Review version unavailable; reload before retrying'},503);
 const stored=await env.BUCKET.put(key,JSON.stringify(review),{...condition,httpMetadata:{contentType:'application/json'}});
 if(!stored){
  const latest=await readReview(env.BUCKET,key,job.id);
  if(latest.invalid)return json({error:'Review unavailable'},500);
  if(latest.review&&sameReview(latest.review,normalized))return json({review:latest.review});
  return conflictResponse(json);
 }
 return json({review});
}
