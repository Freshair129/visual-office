const FILE_LIMIT=8*1024*1024,FILE_COUNT_LIMIT=5,TOTAL_FILE_LIMIT=20*1024*1024;
const VERSION_LIMIT=20,RETAINED_LIMIT=100*1024*1024,HISTORY_LIMIT=200,MANIFEST='office/knowledge/manifest.json';
const versionKey=id=>`office/knowledge/files/${id}`;
const terminal=new Set(['done','error','cancelled']);
const types={
 '.pdf':'application/pdf','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 '.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 '.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 '.csv':'text/csv','.txt':'text/plain','.md':'text/markdown','.json':'application/json'
};
const emptyManifest=()=>({schema:1,versions:[],jobReservations:{}});
const cleanName=value=>typeof value==='string'&&value.length<=255&&!/[\x00-\x1f\x7f/\\]/.test(value)&&value.trim()?value.trim():null;
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha256=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
const safeVersion=v=>v&&typeof v.id==='string'&&typeof v.name==='string'&&typeof v.mimeType==='string'&&Number.isSafeInteger(v.sizeBytes)&&v.sizeBytes>0&&typeof v.digest==='string'&&typeof v.status==='string';
const snapshotFor=v=>({id:v.id,digest:v.digest,name:v.name,mimeType:v.mimeType,sizeBytes:v.sizeBytes,approvedAt:v.approvedAt});
const usage=m=>{const retained=m.versions.filter(v=>v.status!=='purged');return{retainedVersionCount:retained.length,retainedBytes:retained.reduce((n,v)=>n+v.sizeBytes,0),versionLimit:VERSION_LIMIT,retainedByteLimit:RETAINED_LIMIT};};

function validManifest(m){return m?.schema===1&&Array.isArray(m.versions)&&m.versions.length<=200&&m.jobReservations&&typeof m.jobReservations==='object'&&m.versions.every(safeVersion);}
async function readManifest(bucket){
 const record=await bucket.get(MANIFEST);
 if(!record)return{manifest:emptyManifest(),etag:null};
 const manifest=await record.json();
 if(!validManifest(manifest))throw new Error('Knowledge manifest is invalid');
 return{manifest,etag:record.etag||null};
}
async function updateManifest(bucket,mutate){
 for(let attempt=0;attempt<12;attempt++){
  const{manifest,etag}=await readManifest(bucket),next=structuredClone(manifest),result=await mutate(next,manifest);
  if(result?.commit===false)return result.value;
  const onlyIf=etag?{etagMatches:etag}:new Headers({'if-none-match':'*'});
  const saved=await bucket.put(MANIFEST,JSON.stringify(next),{httpMetadata:{contentType:'application/json'},onlyIf});
  if(saved!==null)return result?.value;
 }
 throw new Error('Knowledge storage is busy; retry the request');
}

function zipNames(bytes){
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes[i]===0x50&&bytes[i+1]===0x4b&&bytes[i+2]===0x05&&bytes[i+3]===0x06){eocd=i;break;}
 if(eocd<0||eocd+22>bytes.length)return null;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=view.getUint16(eocd+10,true),size=view.getUint32(eocd+12,true),offset=view.getUint32(eocd+16,true);
 if(count>1000||offset+size>eocd)return null;
 const names=new Set();let p=offset;
 for(let i=0;i<count;i++){
  if(p+46>bytes.length||view.getUint32(p,true)!==0x02014b50)return null;
  const nameLength=view.getUint16(p+28,true),extraLength=view.getUint16(p+30,true),commentLength=view.getUint16(p+32,true);
  if(p+46+nameLength+extraLength+commentLength>bytes.length)return null;
  names.add(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(p+46,p+46+nameLength)));
  p+=46+nameLength+extraLength+commentLength;
 }
 return p===offset+size?names:null;
}
function verifyFile(name,mimeType,bytes){
 const ext=name.slice(name.lastIndexOf('.')).toLowerCase();if(types[ext]!==mimeType)return false;
 if(ext==='.pdf')return bytes.length>=5&&new TextDecoder().decode(bytes.subarray(0,5))==='%PDF-';
 if(['.doc','.xls','.ppt'].includes(ext))return bytes.length>=512&&[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((b,i)=>bytes[i]===b);
 if(['.docx','.xlsx','.pptx'].includes(ext)){
  if(bytes.length<22||bytes[0]!==0x50||bytes[1]!==0x4b||bytes[2]!==0x03||bytes[3]!==0x04)return false;
  let names;try{names=zipNames(bytes);}catch{return false;}
  const root=ext==='.docx'?'word/document.xml':ext==='.xlsx'?'xl/workbook.xml':'ppt/presentation.xml';
  return !!names?.has('[Content_Types].xml')&&!!names.has(root);
 }
 if(bytes.some(byte=>byte===0))return false;
 try{
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(ext==='.json'){JSON.parse(text);return true;}
  return true;
 }catch{return false;}
}
async function readBounded(request){
 const declared=request.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)<1||Number(declared)>FILE_LIMIT))return null;
 const reader=request.body?.getReader?.();if(!reader)return null;const chunks=[];let size=0;
 try{while(true){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>FILE_LIMIT){await reader.cancel();return null;}chunks.push(value);}}catch{return null;}
 if(!size||declared!==null&&size!==Number(declared))return null;
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
async function boundedObject(record,maximum){
 if(!record||Number.isSafeInteger(record.size)&&(record.size<1||record.size>maximum))return null;
 const reader=record.body?.getReader?.();if(!reader)return null;const chunks=[];let size=0;
 try{while(true){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();return null;}chunks.push(value);}}catch{return null;}
 if(!size||Number.isSafeInteger(record.size)&&size!==record.size)return null;const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
function decodeName(value){try{return cleanName(decodeURIComponent(value||''));}catch{return null;}}
function jsonError(json,message,status){return json({error:message},status);}

export function knowledgeFingerprint({title,brief,agentIds,team,versionIds}){
 return sha256(new TextEncoder().encode(JSON.stringify({title:title.trim(),brief:brief.trim(),agentIds,team,versionIds})));
}
export async function reserveKnowledgeJob(bucket,{jobId,versionIds,fingerprint,createJob}){
 return updateManifest(bucket,manifest=>{
  const prior=manifest.jobReservations[jobId];
  if(prior){if(prior.fingerprint!==fingerprint||JSON.stringify(prior.versionIds)!==JSON.stringify(versionIds))return{commit:false,value:{error:'Task ID already used'}};return{commit:false,value:{job:prior.job,created:false}};}
  const versions=[];
  for(const id of versionIds){const v=manifest.versions.find(x=>x.id===id);if(!v||v.status!=='approved')return{commit:false,value:{error:'Selected knowledge is not approved or available'}};versions.push(v);}
  if(versions.length>FILE_COUNT_LIMIT||versions.reduce((size,v)=>size+v.sizeBytes,0)>TOTAL_FILE_LIMIT)return{commit:false,value:{error:'Selected knowledge exceeds the task attachment limit',status:413}};
  const snapshot=versions.map(snapshotFor),job=createJob(snapshot);
  manifest.jobReservations[jobId]={fingerprint,versionIds:[...versionIds],snapshot,job};
  return{value:{job,created:true}};
 });
}
export async function releaseKnowledgeJobReservation(bucket,jobId,fingerprint){
 return updateManifest(bucket,manifest=>{
  const prior=manifest.jobReservations[jobId];if(!prior)return{commit:false,value:false};
  if(fingerprint&&prior.fingerprint!==fingerprint)return{commit:false,value:false};
  delete manifest.jobReservations[jobId];return{value:true};
 });
}

function activeJobReferences(jobs,id){return jobs.some(job=>!terminal.has(job.status)&&Array.isArray(job.knowledgeSnapshot)&&job.knowledgeSnapshot.some(v=>v.id===id));}
async function verifyActiveJob(env,jobId,threadId,version){
 const jobs=await env.listJobs(env.BUCKET),job=jobs.find(j=>j.id===jobId&&!terminal.has(j.status));
 return !!job&&Array.isArray(job.knowledgeSnapshot)&&job.knowledgeSnapshot.some(v=>v.id===version.id&&v.digest===version.digest&&v.name===version.name&&v.sizeBytes===version.sizeBytes)&&job.steps.some(s=>s.threadId===threadId);
}

export async function handleKnowledge(request,env,{json,body,uuid,runnerAuth,listJobs}){
 const url=new URL(request.url),upload=url.pathname.match(/^\/api\/knowledge\/files\/([0-9a-f-]+)$/i),action=url.pathname.match(/^\/api\/knowledge\/versions\/([0-9a-f-]+)\/(approve|revoke|purge)$/i),runner=url.pathname.match(/^\/api\/runner\/knowledge\/([0-9a-f-]+)$/i);
 if(url.pathname==='/api/knowledge'){
  if(request.method!=='GET')return jsonError(json,'Method not allowed',405);
  try{const{manifest}=await readManifest(env.BUCKET);return json({versions:manifest.versions.map(v=>({...v})),usage:usage(manifest),selectionLimits:{files:FILE_COUNT_LIMIT,totalBytes:TOTAL_FILE_LIMIT,perFileBytes:FILE_LIMIT}});}catch{return jsonError(json,'Knowledge storage unavailable',503);}
 }
 if(upload){
  if(request.method!=='POST')return jsonError(json,'Method not allowed',405);
  if(request.headers.get('origin')!==url.origin)return jsonError(json,'Invalid origin',403);
  const id=upload[1];if(!uuid(id))return jsonError(json,'Invalid ID',400);
  const name=decodeName(request.headers.get('x-file-name'));if(!name)return jsonError(json,'Invalid file name',400);
  const ext=name.slice(name.lastIndexOf('.')).toLowerCase(),mimeType=types[ext];
  if(!mimeType||!['application/octet-stream',mimeType].includes(request.headers.get('content-type')||''))return jsonError(json,'Unsupported file type',400);
  const bytes=await readBounded(request);if(!bytes)return jsonError(json,'File must be between 1 byte and 8 MiB',413);
  if(!verifyFile(name,mimeType,bytes))return jsonError(json,'File signature or content is invalid for this type',400);
  const digest=await sha256(bytes),createdAt=new Date().toISOString();
  try{
   let effectiveId=id;
   const reservation=await updateManifest(env.BUCKET,manifest=>{
    const existing=manifest.versions.find(v=>v.id===id);
    if(existing){if(existing.digest!==digest||existing.name!==name||existing.mimeType!==mimeType||existing.sizeBytes!==bytes.byteLength||existing.status==='purged'||existing.status==='purging')return{commit:false,value:{error:'Version ID already used',status:409}};return{commit:false,value:{version:existing,created:false}};}
    const interrupted=manifest.versions.find(v=>v.status==='uploading'&&v.digest===digest&&v.name===name&&v.mimeType===mimeType&&v.sizeBytes===bytes.byteLength);
    if(interrupted){return{commit:false,value:{version:interrupted,created:false}};}
    const use=usage(manifest);if(use.retainedVersionCount>=VERSION_LIMIT||use.retainedBytes+bytes.byteLength>RETAINED_LIMIT)return{commit:false,value:{error:'Workspace knowledge storage limit reached',status:413}};
    while(manifest.versions.length>=HISTORY_LIMIT){const old=manifest.versions.findIndex(v=>v.status==='purged');if(old<0)return{commit:false,value:{error:'Knowledge version history is full; purge an unused version before uploading',status:409}};manifest.versions.splice(old,1);}
    const version={id,name,mimeType,sizeBytes:bytes.byteLength,digest,createdAt,status:'uploading',approvedAt:null,revokedAt:null,purgedAt:null,t3Attachments:{}};
    manifest.versions.push(version);return{value:{version,created:true}};
   });
   if(reservation.error)return jsonError(json,reservation.error,reservation.status);
   const version=reservation.version;effectiveId=version.id;
   const existing=await env.BUCKET.get(versionKey(effectiveId));
   if(existing){const prior=await boundedObject(existing,FILE_LIMIT);if(!prior||await sha256(prior)!==digest)return jsonError(json,'Stored version integrity check failed',503);}
   else{
    const stored=await env.BUCKET.put(versionKey(effectiveId),bytes,{onlyIf:new Headers({'if-none-match':'*'}),httpMetadata:{contentType:'application/octet-stream'}});
    if(stored===null){const raced=await env.BUCKET.get(versionKey(effectiveId)),prior=await boundedObject(raced,FILE_LIMIT);if(!prior||await sha256(prior)!==digest)return jsonError(json,'Stored version integrity check failed',503);}
   }
   await updateManifest(env.BUCKET,manifest=>{const target=manifest.versions.find(v=>v.id===effectiveId);if(!target||target.digest!==digest)throw new Error('Version changed during upload');if(target.status==='uploading')target.status='pending';return{value:true};});
   const savedManifest=(await readManifest(env.BUCKET)).manifest,fresh=savedManifest.versions.find(v=>v.id===effectiveId);return json({version:fresh,usage:usage(savedManifest)},reservation.created?201:200);
  }catch{return jsonError(json,'Knowledge upload could not be saved',503);}
 }
 if(action){
  if(request.method!=='POST')return jsonError(json,'Method not allowed',405);
  if(request.headers.get('origin')!==url.origin)return jsonError(json,'Invalid origin',403);
  const id=action[1],choice=action[2];if(!uuid(id))return jsonError(json,'Invalid ID',400);
  try{
   if(choice==='purge'){
    const jobs=await listJobs(env.BUCKET);
    const reserved=await updateManifest(env.BUCKET,manifest=>{
     const version=manifest.versions.find(v=>v.id===id);if(!version)return{commit:false,value:{error:'Not found',status:404}};
     if(version.status==='purged')return{commit:false,value:{version,alreadyPurged:true}};
     if(version.status==='uploading')return{commit:false,value:{error:'Upload is still in progress',status:409}};
     if(activeJobReferences(jobs,id)||Object.values(manifest.jobReservations).some(r=>r.versionIds.includes(id)))return{commit:false,value:{error:'An active task still references this version',status:409}};
     version.status='purging';return{value:{version,alreadyPurged:false}};
    });
    if(reserved.error)return jsonError(json,reserved.error,reserved.status);
    if(!reserved.alreadyPurged){await env.BUCKET.delete(versionKey(id));await updateManifest(env.BUCKET,manifest=>{const version=manifest.versions.find(v=>v.id===id);if(version?.status==='purging'){version.status='purged';version.purgedAt=new Date().toISOString();version.t3Attachments={};}return{value:true};});}
    const{manifest}=await readManifest(env.BUCKET);return json({version:manifest.versions.find(v=>v.id===id),usage:usage(manifest)});
   }
   const result=await updateManifest(env.BUCKET,manifest=>{
    const version=manifest.versions.find(v=>v.id===id);if(!version)return{commit:false,value:{error:'Not found',status:404}};
    if(['uploading','purging','purged'].includes(version.status))return{commit:false,value:{error:'Version is not available for review',status:409}};
    if(choice==='approve'){version.status='approved';version.approvedAt=new Date().toISOString();version.revokedAt=null;}
    else{version.status='revoked';version.revokedAt=new Date().toISOString();}
    return{value:version};
   });
   if(result.error)return jsonError(json,result.error,result.status);
   return json({version:result});
  }catch{return jsonError(json,'Knowledge version update failed',503);}
 }
 if(runner){
  if(!runnerAuth(request,env))return jsonError(json,'Unauthorized',401);
  if(!uuid(runner[1]))return jsonError(json,'Invalid ID',400);
  const id=runner[1],jobId=url.searchParams.get('jobId'),threadId=url.searchParams.get('threadId');if(!uuid(jobId)||!uuid(threadId))return jsonError(json,'Invalid task or thread ID',400);
  try{
   const{manifest}=await readManifest(env.BUCKET),version=manifest.versions.find(v=>v.id===id);
   if(!version||version.status==='purged'||version.status==='purging'||!await verifyActiveJob({BUCKET:env.BUCKET,listJobs},jobId,threadId,version))return jsonError(json,'Knowledge version is unavailable to this task',404);
   if(request.method==='GET'){
    const cached=version.t3Attachments?.[threadId],fresh=cached&&Date.now()-cached.uploadedAt<=8*60000;
    const cacheHeaders={'cache-control':'no-store','x-content-type-options':'nosniff','x-file-name':encodeURIComponent(version.name),'x-file-mime-type':version.mimeType,'x-file-size':String(version.sizeBytes),'x-file-digest':version.digest,'x-t3-attachment-id':fresh?cached.attachmentId:'','x-t3-uploaded-at':String(cached?.uploadedAt||0)};
    if(fresh)return new Response(null,{status:204,headers:cacheHeaders});
    const record=await env.BUCKET.get(versionKey(id)),bytes=await boundedObject(record,FILE_LIMIT);
    if(!bytes||bytes.byteLength!==version.sizeBytes||await sha256(bytes)!==version.digest)return jsonError(json,'Knowledge source integrity check failed',503);
    return new Response(bytes,{headers:{...cacheHeaders,'content-type':'application/octet-stream','content-length':String(bytes.byteLength)} });
   }
   if(request.method==='PUT'){
    const input=await body(request,1000);if(typeof input.attachmentId!=='string'||!/^[a-z0-9_-]{1,128}$/i.test(input.attachmentId)||!Number.isFinite(input.uploadedAt))return jsonError(json,'Invalid T3 attachment cache',400);
    const result=await updateManifest(env.BUCKET,manifest=>{
     const target=manifest.versions.find(v=>v.id===id);if(!target||target.digest!==version.digest||['purged','purging'].includes(target.status))return{commit:false,value:{error:'Knowledge version is unavailable',status:404}};
     target.t3Attachments??={};const prior=target.t3Attachments[threadId];if(prior&&Date.now()-prior.uploadedAt<=8*60000)return{commit:false,value:{attachmentId:prior.attachmentId,uploadedAt:prior.uploadedAt,reused:true}};
     target.t3Attachments[threadId]={attachmentId:input.attachmentId,uploadedAt:input.uploadedAt};return{value:{attachmentId:input.attachmentId,uploadedAt:input.uploadedAt,reused:false}};
    });
    if(result.error)return jsonError(json,result.error,result.status);return json(result);
   }
   return jsonError(json,'Method not allowed',405);
  }catch{return jsonError(json,'Knowledge transfer state unavailable',503);}
 }
 return null;
}
