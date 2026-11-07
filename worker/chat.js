import {fileMetadata,FILE_LIMIT,FILE_COUNT_LIMIT,TOTAL_FILE_LIMIT} from '../web/file-policy.js';
async function chatRecords(bucket,prefix){let cursor;const values=[];do{const page=await bucket.list({prefix,limit:1000,...(cursor?{cursor}:{})});for(const o of page.objects){const r=await bucket.get(o.key);if(r)values.push(await r.json());}cursor=page.truncated?page.cursor:null;}while(cursor);return values;}
const chatFileKey=(thread,id)=>`office/chat-files/${thread}/${id}`;
const fileMetaKey=(thread,id)=>`office/chat-file-meta/${thread}/${id}.json`;
const publicFile=m=>({id:m.id,type:m.type,name:m.name,mimeType:m.mimeType,sizeBytes:m.sizeBytes});
const safeContext=v=>v&&Number.isSafeInteger(v.usedTokens)&&v.usedTokens>=0&&v.usedTokens<=1e9?{usedTokens:v.usedTokens,...(Number.isSafeInteger(v.maxTokens)&&v.maxTokens>0&&v.maxTokens<=1e9?{maxTokens:v.maxTokens}:{}),updatedAt:typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt))?v.updatedAt.slice(0,50):null}:null;
const fileList=v=>Array.isArray(v)?v.filter(m=>m&&['image','file'].includes(m.type)&&typeof m.name==='string'&&Number.isFinite(m.sizeBytes)).slice(0,20).map(m=>({id:String(m.id||'').slice(0,128),type:m.type,name:m.name.slice(0,255),mimeType:String(m.mimeType||'').slice(0,100),sizeBytes:Math.max(0,m.sizeBytes)})):[];
const safeCapabilities=v=>v&&typeof v==='object'?{provider:String(v.provider||'').slice(0,100),model:String(v.model||'').slice(0,100),context:safeContext(v.context),skills:Array.isArray(v.skills)?v.skills.slice(0,50).map(s=>({name:String(s.name||'').slice(0,120),description:String(s.description||'').slice(0,300)})):[],commands:Array.isArray(v.commands)?v.commands.slice(0,30).map(s=>({name:String(s.name||'').slice(0,100),description:String(s.description||'').slice(0,200)})):[],observedTools:Array.isArray(v.observedTools)?v.observedTools.slice(0,20).map(s=>String(s).slice(0,160)):[]}:null;
const chatMessageKey=(thread,id)=>`office/chat-queue/${thread}/${id}.json`;
const chatQueueIndexKey='office/chat-queue-index.json';
const queueMessageStatuses=new Set(['queued','sent']);
const queueReservationLeaseMs=5*60*1000;
export class ChatQueueError extends Error{
 constructor(message,status=503){super(message);this.name='ChatQueueError';this.status=status;}
}
const sameQueuedMessage=(message,{threadId,id,text,attachments})=>message?.id===id&&message.threadId===threadId&&message.text===text&&JSON.stringify((message.attachments||[]).map(file=>file.id))===JSON.stringify(attachments.map(file=>file.id));
async function waitingChatMessages(bucket){return(await chatRecords(bucket,'office/chat-queue/')).filter(message=>['queued','sent'].includes(message.status));}
const validQueueKey=key=>typeof key==='string'&&/^office\/chat-queue\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.json$/i.test(key);
const validQueueEntry=entry=>entry&&validQueueKey(entry.key)&&(entry.reservedAt===null||Number.isSafeInteger(entry.reservedAt)&&entry.reservedAt>=0);
const sameEntries=(a,b)=>a.length===b.length&&a.every((entry,index)=>entry.key===b[index].key&&entry.reservedAt===b[index].reservedAt);
async function indexedActiveEntries(bucket,entries){
 const active=[];
 for(const entry of entries){
  const record=await bucket.get(entry.key);
  // A missing record may be an in-flight reservation. Keep its slot until the
  // same message ID retries, unless the reservation has expired.
  if(!record){if(Number.isSafeInteger(entry.reservedAt)&&Math.abs(Date.now()-entry.reservedAt)<queueReservationLeaseMs)active.push(entry);continue;}
  const message=await record.json();
  if(queueMessageStatuses.has(message.status))active.push({key:entry.key,reservedAt:null});
  else if(!['done','error'].includes(message.status))throw new ChatQueueError('Invalid chat queue record');
 }
 return active;
}
async function reserveChatQueueSlot(bucket,key){
 for(let attempt=0;attempt<40;attempt++){
  let record=await bucket.get(chatQueueIndexKey);
  if(!record){
   let entries;
   try{entries=(await waitingChatMessages(bucket)).map(message=>({key:chatMessageKey(message.threadId,message.id),reservedAt:null})).filter(entry=>validQueueKey(entry.key));}
   catch{throw new ChatQueueError('Unable to read the chat queue');}
   const unique=[...new Map(entries.map(entry=>[entry.key,entry])).values()];
   const created=await bucket.put(chatQueueIndexKey,JSON.stringify({entries:unique}),{onlyIf:new Headers({'if-none-match':'*'})});
   if(!created)continue;
   continue;
  }
  let index;
  try{index=await record.json();}catch{throw new ChatQueueError('Invalid chat queue index');}
  if(!index||!Array.isArray(index.entries)||index.entries.some(entry=>!validQueueEntry(entry)))throw new ChatQueueError('Invalid chat queue index');
  const registered=[...new Map(index.entries.map(entry=>[entry.key,entry])).values()],active=await indexedActiveEntries(bucket,registered),alreadyReserved=active.some(entry=>entry.key===key);
  if(!alreadyReserved&&active.length>=20)throw new ChatQueueError('มีข้อความรอครบ 20 ข้อความแล้ว',429);
  const next=alreadyReserved?active:[...active,{key,reservedAt:Date.now()}];
  if(!sameEntries(next,index.entries)){
   if(!record.etag)throw new ChatQueueError('Unable to verify chat queue capacity');
   const stored=await bucket.put(chatQueueIndexKey,JSON.stringify({entries:next}),{onlyIf:{etagMatches:record.etag}});
   if(!stored)continue;
  }
  return;
 }
 throw new ChatQueueError('Unable to reserve chat queue capacity');
}
/**
 * Atomically creates one durable chat queue record for a message ID. R2's
 * If-None-Match precondition prevents a concurrent retry from replacing a
 * record whose runner status has already advanced.
 */
export async function enqueueChatMessage(bucket,{threadId,id,text,attachments=[],commandId=crypto.randomUUID()}){
 try{
  const input={threadId,id,text,attachments},key=chatMessageKey(threadId,id);
  const existing=await bucket.get(key);
  if(existing){
   const message=await existing.json();
   if(!sameQueuedMessage(message,input))throw new ChatQueueError('Message ID already used',409);
   if(queueMessageStatuses.has(message.status))await reserveChatQueueSlot(bucket,key);
   if(message.status==='queued')await bucket.put('office/chat-watch/'+threadId,JSON.stringify({threadId,at:new Date().toISOString()}));
   return{message,created:false};
  }
  await reserveChatQueueSlot(bucket,key);
  const message={id,threadId,text,attachments,commandId,status:'queued',error:null,createdAt:new Date().toISOString()};
  const stored=await bucket.put(key,JSON.stringify(message),{onlyIf:new Headers({'if-none-match':'*'})});
  if(!stored){
   const raced=await bucket.get(key);
   if(!raced)throw new ChatQueueError('Unable to confirm the chat queue record');
   const queued=await raced.json();
   if(!sameQueuedMessage(queued,input))throw new ChatQueueError('Message ID already used',409);
   if(queueMessageStatuses.has(queued.status))await reserveChatQueueSlot(bucket,key);
   if(queued.status==='queued')await bucket.put('office/chat-watch/'+threadId,JSON.stringify({threadId,at:new Date().toISOString()}));
   return{message:queued,created:false};
  }
  await bucket.put('office/chat-watch/'+threadId,JSON.stringify({threadId,at:new Date().toISOString()}));
  return{message,created:true};
 }catch(error){
  if(error instanceof ChatQueueError)throw error;
  throw new ChatQueueError('ไม่สามารถบันทึกรายการลงคิวแชทได้');
 }
}
export async function handleChat(request,env,{json,body,uuid,runnerAuth,listJobs}){
 const url=new URL(request.url),route=url.pathname.match(/^\/api\/chats\/([0-9a-f-]+)(?:\/(messages|watch|attachments|history)(?:\/([0-9a-f-]+))?)?$/i);
 const runnerFile=url.pathname.match(/^\/api\/runner\/chats\/attachments\/([0-9a-f-]+)\/([0-9a-f-]+)$/i);
 if(runnerFile){
  if(!runnerAuth(request,env))return json({error:'Unauthorized'},401);
  const [,thread,id]=runnerFile;if(!uuid(thread)||!uuid(id))return json({error:'Invalid ID'},400);
  const record=await env.BUCKET.get(fileMetaKey(thread,id));if(!record)return json({error:'Not found'},404);const metadata=await record.json();
  if(request.method==='GET'){const file=await env.BUCKET.get(chatFileKey(thread,id));return file?new Response(file.body,{headers:{'content-type':'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff','x-t3-attachment-id':metadata.attachmentId||'','x-t3-uploaded-at':String(metadata.uploadedAt||0)}}):json({error:'Not found'},404);}
  if(request.method==='PUT'){try{const v=await body(request,1000);if(typeof v.attachmentId!=='string'||!/^[a-z0-9_-]{1,128}$/i.test(v.attachmentId)||!Number.isFinite(v.uploadedAt))throw new Error();await env.BUCKET.put(fileMetaKey(thread,id),JSON.stringify({...metadata,attachmentId:v.attachmentId,uploadedAt:v.uploadedAt}));return json({ok:true});}catch{return json({error:'Invalid upload state'},400);}}
  return json({error:'Method not allowed'},405);
 }
 const runner=url.pathname.match(/^\/api\/runner\/chats(?:\/(snapshot|messages\/([0-9a-f-]+)\/([0-9a-f-]+)))?$/i);
 if(!route&&!runner)return null;
 if(runner){
  if(!runnerAuth(request,env))return json({error:'Unauthorized'},401);
  if(!runner[1]&&request.method==='GET'){
   const messages=(await chatRecords(env.BUCKET,'office/chat-queue/')).filter(m=>['queued','sent'].includes(m.status)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
   const watches=(await chatRecords(env.BUCKET,'office/chat-watch/')).filter(w=>Date.now()-Date.parse(w.at)<300000);
   const jobs=await listJobs(env.BUCKET);return json({messages,watches,initialMessages:jobs.flatMap(j=>j.steps.map(s=>({threadId:s.threadId,messageId:s.messageId,text:j.brief,canStart:!j.cancelRequested&&!['cancelled','error'].includes(j.status)})))});
  }
  if(runner[1]==='snapshot'&&request.method==='POST'){
   try{const v=await body(request,500000);if(!uuid(v.threadId)||!['idle','working','stuck','done','offline'].includes(v.status)||!Array.isArray(v.messages)||v.messages.length>100)throw new Error();
    const incoming=v.messages.map(m=>{if(typeof m.id!=='string'||!m.id||m.id.length>200||!['user','assistant','system'].includes(m.role)||typeof m.text!=='string'||m.text.length>8000)throw new Error();return{id:m.id,role:m.role,text:m.text,attachments:fileList(m.attachments),createdAt:typeof m.createdAt==='string'?m.createdAt.slice(0,50):'',truncated:m.truncated===true};});
    const key='office/chat-history/'+v.threadId,record=await env.BUCKET.get(key),previous=record?await record.json():{messages:[]},byId=new Map((previous.messages||[]).map(m=>[m.id,m]));
    for(const message of incoming)byId.set(message.id,message);
    const all=[...byId.values()];let first=Math.max(0,all.length-300),messages=all.slice(first),history;
    const makeHistory=()=>({threadId:v.threadId,status:v.status,messages,historyTruncated:previous.historyTruncated===true||v.historyTruncated===true||first>0,capabilities:safeCapabilities(v.capabilities),receivedAt:new Date().toISOString()});
    history=makeHistory();
    while(first<all.length&&JSON.stringify(history).length>450000){first++;messages=all.slice(first);history=makeHistory();}
    await env.BUCKET.put(key,JSON.stringify(history));return json({ok:true});
   }catch{return json({error:'Invalid chat snapshot'},400);}
  }
  if(runner[2]&&request.method==='PUT'){
   if(!uuid(runner[2])||!uuid(runner[3]))return json({error:'Invalid ID'},400);
   const key=chatMessageKey(runner[2],runner[3]),r=await env.BUCKET.get(key);if(!r)return json({error:'Not found'},404);
   try{const v=await body(request,2000);if(!['queued','sent','done','error'].includes(v.status))throw new Error();const m=await r.json();
    if(queueMessageStatuses.has(v.status)){
     if(!queueMessageStatuses.has(m.status))return json({error:'A completed message cannot be requeued'},409);
     await reserveChatQueueSlot(env.BUCKET,key);
    }
    m.status=v.status;m.error=typeof v.error==='string'?v.error.slice(0,300):null;
    const updated=await env.BUCKET.put(key,JSON.stringify(m),{onlyIf:{etagMatches:r.etag}});if(!updated){const latest=await env.BUCKET.get(key),current=latest?await latest.json():null;return current?.status===v.status&&current.error===m.error?json({ok:true}):json({error:'Message status changed; retry the update'},409);}
    return json({ok:true});
   }catch(error){return error instanceof ChatQueueError?json({error:error.message},error.status):json({error:'Invalid message update'},400);}
  }
  return json({error:'Method not allowed'},405);
 }
 const id=route[1];if(!uuid(id))return json({error:'Invalid thread'},400);
 const snapshotRecord=await env.BUCKET.get('office/latest.json'),snapshot=snapshotRecord?await snapshotRecord.json():{sessions:[]};
 const jobs=await listJobs(env.BUCKET);const known=snapshot.sessions.some(s=>s.id===id)||jobs.some(j=>!j.cancelRequested&&j.steps.some(s=>s.threadId===id&&s.status!=='cancelled'));
 if(!known)return json({error:'ไม่พบแชทนี้ในออฟฟิศ'},404);
 if(!route[2]&&request.method==='GET'){
  const r=await env.BUCKET.get('office/chat-history/'+id),history=r?await r.json():{messages:[],receivedAt:null,status:'idle'};
  const stale=!history.receivedAt||Date.now()-Date.parse(history.receivedAt)>30000||snapshot.hostStatus!=='live'||Date.now()-Date.parse(snapshot.receivedAt)>30000;
  const pending=(await chatRecords(env.BUCKET,'office/chat-queue/'+id+'/')).filter(m=>m.status!=='done').sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const messages=history.messages||[],current=messages.slice(-30);
  return json({...history,messages:current,historyCursor:current[0]?.id||null,hasMoreHistory:messages.length>current.length,threadId:id,stale,status:stale?'offline':history.status,pending:pending.map(m=>({id:m.id,text:m.text,attachments:m.attachments||[],status:m.status,error:m.error,createdAt:m.createdAt}))});
 }
 if(route[2]==='history'&&request.method==='GET'){
  const rawLimit=url.searchParams.get('limit'),limit=rawLimit===null?30:Number(rawLimit),before=url.searchParams.get('before');
  if(!Number.isSafeInteger(limit)||limit<1||limit>50||typeof before!=='string'||!before||before.length>200)return json({error:'Invalid history cursor'},400);
  const r=await env.BUCKET.get('office/chat-history/'+id),history=r?await r.json():{messages:[]},messages=history.messages||[],index=messages.findIndex(m=>m.id===before);
  if(index<0)return json({error:'History cursor not found'},404);
  const start=Math.max(0,index-limit),page=messages.slice(start,index);
  return json({messages:page,hasMoreHistory:start>0,nextCursor:start>0?messages[start]?.id||null:null,historyTruncated:history.historyTruncated===true});
 }
 if(request.headers.get('origin')!==url.origin)return json({error:'Invalid origin'},403);
 if(route[2]==='attachments'&&request.method==='POST'){
  if(!uuid(route[3]))return json({error:'Invalid file ID'},400);
  try{
   const name=decodeURIComponent(request.headers.get('x-file-name')||''),declared=Number(request.headers.get('content-length'));
   if(declared>FILE_LIMIT)return json({error:'ไฟล์ต้องไม่เกิน 8 MB'},413);
   const reader=request.body?.getReader();if(!reader)throw new Error('ไม่มีข้อมูลไฟล์');let size=0;const chunks=[];
   while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>FILE_LIMIT){await reader.cancel();return json({error:'ไฟล์ต้องไม่เกิน 8 MB'},413);}chunks.push(value);}
   const metadata={...fileMetadata(name,size),id:route[3],threadId:id};const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');
   const key=fileMetaKey(id,route[3]),existing=await env.BUCKET.get(key);if(existing){const m=await existing.json();return m.digest===digest&&m.name===name?json({file:publicFile(m)}):json({error:'File ID already used'},409);}
   // Reject binary signatures inconsistent with their declared image/document format.
   const hex=[...data.slice(0,12)].map(b=>b.toString(16).padStart(2,'0')).join('');
   if(metadata.type==='image'&&!(metadata.mimeType==='image/png'?hex.startsWith('89504e470d0a1a0a'):metadata.mimeType==='image/jpeg'?hex.startsWith('ffd8ff'):metadata.mimeType==='image/gif'?hex.startsWith('4749463837')||hex.startsWith('4749463839'):hex.startsWith('52494646')&&hex.slice(16,24)==='57454250'))throw new Error('รูปภาพไม่ตรงกับชนิดไฟล์');
   if(metadata.mimeType==='application/pdf'&&!hex.startsWith('25504446'))throw new Error('ไฟล์ PDF ไม่ถูกต้อง');
   if((await chatRecords(env.BUCKET,'office/chat-file-meta/'+id+'/')).length>=100)return json({error:'แชทนี้แนบไฟล์ครบ 100 ไฟล์แล้ว'},429);
   await env.BUCKET.put(chatFileKey(id,route[3]),data,{httpMetadata:{contentType:metadata.mimeType}});await env.BUCKET.put(key,JSON.stringify({...metadata,digest,createdAt:new Date().toISOString()}));return json({file:publicFile(metadata)},201);
  }catch(e){return json({error:e.message||'อัปโหลดไฟล์ไม่สำเร็จ'},400);}
 }
 if(route[2]==='watch'&&request.method==='POST'){await env.BUCKET.put('office/chat-watch/'+id,JSON.stringify({threadId:id,at:new Date().toISOString()}));return json({ok:true});}
 if(route[2]==='messages'&&request.method==='POST'){
  try{const v=await body(request,24000);if(!uuid(v.id)||typeof v.text!=='string'||v.text.length>10000||v.attachments!==undefined&&(!Array.isArray(v.attachments)||v.attachments.length>FILE_COUNT_LIMIT||v.attachments.some(a=>!uuid(a))||new Set(v.attachments).size!==v.attachments.length))throw new Error();
   const attachments=[];for(const fileId of v.attachments||[]){const r=await env.BUCKET.get(fileMetaKey(id,fileId));if(!r)return json({error:'ไม่พบไฟล์แนบในแชทนี้'},400);attachments.push(publicFile(await r.json()));}
   if(!v.text.trim()&&!attachments.length)throw new Error();if(attachments.reduce((n,a)=>n+a.sizeBytes,0)>TOTAL_FILE_LIMIT)return json({error:'ไฟล์รวมต้องไม่เกิน 20 MB'},400);
   const result=await enqueueChatMessage(env.BUCKET,{id:v.id,threadId:id,text:v.text.trim(),attachments});return json({message:result.message},result.created?201:200);
  }catch(error){return error instanceof ChatQueueError?json({error:error.message},error.status):json({error:'ข้อความไม่ถูกต้อง'},400);}
 }
 return json({error:'Method not allowed'},405);
}
