// Compact current-conversation summary used by the full Chat page.
export function quickMessage(messages=[],pending=[],name='agent'){
 const ids=new Set(messages.map(m=>m.id));
 const queued=pending.filter(m=>!ids.has(m.id)).at(-1);
 if(queued)return queued.status==='error'?'ส่งไม่สำเร็จ · เปิดแชทเต็มเพื่อตรวจสอบ':queued.status==='sent'?'ส่งข้อความแล้ว · รอ '+name+' ตอบ':'ข้อความอยู่ในคิว · รอ T3 รับงาน';
 const last=messages.filter(m=>m.role==='assistant').at(-1)||messages.at(-1);
 if(!last)return name+' พร้อมคุย · พิมพ์ข้อความด้านล่างได้เลย';
 const text=last.text||((last.attachments||[]).length?'ส่งไฟล์แนบแล้ว':'ยังไม่มีข้อความ');
 return (last.role==='user'?'คุณ: ':'')+text.slice(0,240)+(text.length>240?'…':'');
}
