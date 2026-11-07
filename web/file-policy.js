export const FILE_LIMIT=8*1024*1024;
export const TOTAL_FILE_LIMIT=20*1024*1024;
export const FILE_COUNT_LIMIT=5;
export const fileTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',csv:'text/csv',txt:'text/plain',md:'text/markdown',json:'application/json'};
export function fileMetadata(name,sizeBytes){
 if(typeof name!=='string'||!name.trim()||name.length>255||/[\x00-\x1f\x7f/\\]/.test(name))throw new Error('ชื่อไฟล์ไม่ถูกต้อง');
 const mimeType=fileTypes[name.split('.').at(-1).toLowerCase()];if(!mimeType)throw new Error('รองรับรูปภาพ PDF Word Excel PowerPoint และไฟล์ข้อความ');
 if(!Number.isInteger(sizeBytes)||sizeBytes<1||sizeBytes>FILE_LIMIT)throw new Error('ไฟล์ต้องมีข้อมูลและไม่เกิน 8 MB');
 return{name,mimeType,sizeBytes,type:mimeType.startsWith('image/')?'image':'file'};
}
export function fileSize(bytes){return bytes>=1024*1024?(bytes/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(bytes/1024))+' KB';}
