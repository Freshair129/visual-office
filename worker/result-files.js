const FILE_LIMIT = 8 * 1024 * 1024;
const LIST_LIMIT = 100;
const fileKey = (threadId, fileId) => `office/chat-files/${threadId}/${fileId}`;
const metadataKey = (threadId, fileId) => `office/chat-file-meta/${threadId}/${fileId}.json`;

function safeMetadata(value, threadId, fileId) {
 if (!value || value.id !== fileId || value.threadId !== threadId || typeof value.name !== 'string' ||
     !value.name.trim() || value.name.length > 255 || /[\x00-\x1f\x7f/\\]/.test(value.name) ||
     !['image','file'].includes(value.type) || typeof value.mimeType !== 'string' || value.mimeType.length > 100 ||
     !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes < 1 || value.sizeBytes > FILE_LIMIT) return null;
 return {
  id:fileId,
  type:value.type,
  name:value.name,
  mimeType:value.mimeType,
  sizeBytes:value.sizeBytes,
  createdAt:typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt)) ? value.createdAt.slice(0,50) : null
 };
}

function knownThread(threadId, snapshot, jobs) {
 return (Array.isArray(snapshot?.sessions) && snapshot.sessions.some(session => session?.id === threadId)) ||
  jobs.some(job => !job.cancelRequested && Array.isArray(job.steps) && job.steps.some(step =>
   step?.threadId === threadId && step.status !== 'cancelled'));
}

function contentDisposition(name) {
 const encoded = encodeURIComponent(name).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
 return `attachment; filename="attachment.bin"; filename*=UTF-8''${encoded}`;
}

async function boundedFileBody(object, maximum) {
 if (Number.isSafeInteger(object?.size) && (object.size < 1 || object.size > maximum)) return null;
 const reader = object?.body?.getReader?.();
 if (!reader) return null;
 const chunks = [];
 let size = 0;
 try {
  while (true) {
   const {value, done} = await reader.read();
   if (done) break;
   size += value.byteLength;
   if (size > maximum) {
    await reader.cancel();
    return null;
   }
   chunks.push(value);
  }
 } catch {
  return null;
 }
 if (size < 1 || Number.isSafeInteger(object?.size) && size !== object.size) return null;
 const bytes = new Uint8Array(size);
 let offset = 0;
 for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
 return bytes;
}

export async function handleResultFiles(request, env, {json, uuid, listJobs}) {
 const url = new URL(request.url);
 const listing = url.pathname === '/api/result-files';
 const download = url.pathname.match(/^\/api\/result-files\/([0-9a-f-]+)\/([0-9a-f-]+)\/download$/i);
 if (!listing && !download) return null;
 if (request.method !== 'GET') return json({error:'Method not allowed'},405);

 const threadId = listing ? url.searchParams.get('threadId') : download[1];
 const fileId = download?.[2];
 if (!uuid(threadId) || fileId && !uuid(fileId)) return json({error:'Invalid ID'},400);
 const snapshotRecord = await env.BUCKET.get('office/latest.json');
 const snapshot = snapshotRecord ? await snapshotRecord.json() : null;
 const jobs = await listJobs(env.BUCKET);
 if (!knownThread(threadId, snapshot, jobs)) return json({error:'ไม่พบแชทนี้ในออฟฟิศ'},404);

 if (listing) {
  const page = await env.BUCKET.list({prefix:`office/chat-file-meta/${threadId}/`,limit:LIST_LIMIT});
  const files = [];
  for (const item of page.objects.slice(0,LIST_LIMIT)) {
   const match = item.key.match(new RegExp(`^office/chat-file-meta/${threadId}/([0-9a-f-]{36})\\.json$`, 'i'));
   if (!match || !uuid(match[1])) continue;
   const record = await env.BUCKET.get(metadataKey(threadId,match[1]));
   if (!record) continue;
   let value;
   try { value = await record.json(); } catch { continue; }
   const metadata = safeMetadata(value,threadId,match[1]);
   if (metadata) files.push(metadata);
  }
  files.sort((a,b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0));
  return json({files});
 }

 const record = await env.BUCKET.get(metadataKey(threadId,fileId));
 if (!record) return json({error:'Not found'},404);
 let value;
 try { value = await record.json(); } catch { return json({error:'Not found'},404); }
 const metadata = safeMetadata(value,threadId,fileId);
 if (!metadata) return json({error:'Not found'},404);
 const object = await env.BUCKET.get(fileKey(threadId,fileId));
 if (!object) return json({error:'Not found'},404);
 const bytes = await boundedFileBody(object,metadata.sizeBytes);
 if (!bytes || bytes.byteLength !== metadata.sizeBytes) return json({error:'Not found'},404);
 return new Response(bytes,{headers:{
  'content-type':'application/octet-stream',
  'content-disposition':contentDisposition(metadata.name),
  'content-length':String(bytes.byteLength),
  'cache-control':'no-store',
  'x-content-type-options':'nosniff'
 }});
}
