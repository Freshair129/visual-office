import {t3Rpc} from './t3-rpc.mjs';
import {t3Url} from './t3-auth.mjs';
export async function prepareChatAttachments(message,{token,cloud}){
 const result=[];
 for(const file of message.attachments||[]){
  const route='/api/runner/chats/attachments/'+message.threadId+'/'+file.id;
  const response=await cloud(route);if(!response.ok)throw new Error('อ่านไฟล์แนบไม่สำเร็จ');
  const cached=response.headers.get('x-t3-attachment-id'),uploadedAt=Number(response.headers.get('x-t3-uploaded-at'));
  let attachmentId=cached;
  if(!cached||Date.now()-uploadedAt>8*60000){
   const minted=await t3Rpc(token,'attachments.createUploadUrl',{type:file.type,name:file.name,mimeType:file.mimeType,sizeBytes:file.sizeBytes});
   const url=new URL(minted.relativeUrl,t3Url);if(url.origin!==t3Url||!url.pathname.startsWith('/api/attachments/upload/'))throw new Error('T3 returned an invalid upload URL');
   const data=await response.arrayBuffer();if(data.byteLength!==file.sizeBytes)throw new Error('ไฟล์แนบมีขนาดไม่ตรงกับข้อมูล');
   const uploaded=await fetch(url,{method:'POST',headers:{'content-type':file.mimeType},body:data,signal:AbortSignal.timeout(30000)});if(!uploaded.ok)throw new Error('T3 attachment upload HTTP '+uploaded.status);
   attachmentId=minted.attachmentId;
   const saved=await cloud(route,{method:'PUT',body:JSON.stringify({attachmentId,uploadedAt:Date.now()})});if(!saved.ok)throw new Error('บันทึกสถานะไฟล์แนบไม่สำเร็จ');
  }
  result.push({id:attachmentId,type:file.type,name:file.name,mimeType:file.mimeType,sizeBytes:file.sizeBytes});
 }
 return result;
}
