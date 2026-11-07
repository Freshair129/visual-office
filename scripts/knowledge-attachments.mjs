import {t3Rpc} from './t3-rpc.mjs';
import {t3Url} from './t3-auth.mjs';

const safeId=value=>typeof value==='string'&&/^[a-z0-9_-]{1,128}$/i.test(value);
export async function prepareKnowledgeAttachments(job,{token,cloud,step,rpc=t3Rpc,upload=fetch,now=()=>Date.now()}){
 const snapshot=job.knowledgeSnapshot||[],result=[];
 for(const source of snapshot){
  if(!step?.threadId)throw new Error('Knowledge transfer requires a task thread ID');
  const route='/api/runner/knowledge/'+source.id+'?jobId='+encodeURIComponent(job.id)+'&threadId='+encodeURIComponent(step.threadId);
  const response=await cloud(route);if(!response.ok)throw new Error('อ่านเอกสารความรู้ไม่สำเร็จ: '+source.name);
  if(response.headers.get('x-file-digest')!==source.digest||Number(response.headers.get('x-file-size'))!==source.sizeBytes||response.headers.get('x-file-mime-type')!==source.mimeType)throw new Error('ข้อมูลเอกสารความรู้ไม่ตรงกับ snapshot: '+source.name);
  let attachmentId=response.headers.get('x-t3-attachment-id');
  const uploadedAt=Number(response.headers.get('x-t3-uploaded-at'));
  if(attachmentId&&uploadedAt>0&&now()-uploadedAt<=8*60000){result.push({id:attachmentId,type:'file',name:source.name,mimeType:source.mimeType,sizeBytes:source.sizeBytes});continue;}
  {
   const name=decodeURIComponent(response.headers.get('x-file-name')||'');
   const minted=await rpc(token,'attachments.createUploadUrl',{type:'file',name,mimeType:source.mimeType,sizeBytes:source.sizeBytes});
   if(!safeId(minted?.attachmentId)||typeof minted.relativeUrl!=='string')throw new Error('T3 returned an invalid attachment upload target');
   const url=new URL(minted.relativeUrl,t3Url);if(url.origin!==t3Url||!url.pathname.startsWith('/api/attachments/upload/'))throw new Error('T3 returned an invalid upload URL');
   const bytes=await response.arrayBuffer();if(bytes.byteLength!==source.sizeBytes)throw new Error('Knowledge source size changed during transfer: '+source.name);
   const uploaded=await upload(url,{method:'POST',headers:{'content-type':source.mimeType},body:bytes,signal:AbortSignal.timeout(30000)});
   if(!uploaded.ok)throw new Error('T3 attachment upload HTTP '+uploaded.status);
   const saved=await cloud(route,{method:'PUT',body:JSON.stringify({attachmentId:minted.attachmentId,uploadedAt:now()})});
   if(!saved.ok)throw new Error('บันทึกสถานะเอกสารแนบใน T3 ไม่สำเร็จ: '+source.name);
   const state=await saved.json();if(!safeId(state.attachmentId))throw new Error('Invalid cached T3 attachment ID');attachmentId=state.attachmentId;
  }
  if(!safeId(attachmentId))throw new Error('Invalid cached T3 attachment ID');
  result.push({id:attachmentId,type:'file',name:source.name,mimeType:source.mimeType,sizeBytes:source.sizeBytes});
 }
 return result;
}
