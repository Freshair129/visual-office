export function normalizeZuriOrigin(value){
 const url=new URL(value);
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('ระบุเฉพาะ origin ของ Zuri');
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Zuri ต้องใช้ HTTPS หรือ loopback');
 return url.origin;
}

export function openOfficeTransfer(win,value,buildZip,trustedOrigins,onProgress=()=>{}){
 const origin=normalizeZuriOrigin(value);if(!Array.isArray(trustedOrigins)||!trustedOrigins.includes(origin))throw Error('Zuri ปลายทางไม่ได้อยู่ในการตั้งค่าที่เชื่อถือ');
 if(new URL(origin).hostname===new URL(win.location.origin).hostname&&origin!==win.location.origin)throw Error('Office และ Zuri ต้องใช้ hostname แยกกันเพื่อป้องกัน session cookie รั่วข้ามพอร์ต');
 const nonce=win.crypto.randomUUID();
 const url=new URL('/office-handoff',origin);url.hash=new URLSearchParams({origin:win.location.origin,nonce}).toString();
 const popup=win.open(url.toString(),'_blank');if(!popup)throw Error('เปิดหน้าต่าง Zuri ไม่สำเร็จ โปรดอนุญาต popup');
 return new Promise((resolve,reject)=>{
  let sent=false,done=false,zipPromise,readyToResend=false;
  const timer=setInterval(()=>{if(popup.closed)finish(new Error('ปิดหน้าต่าง Zuri แล้ว ผลอาจยังไม่แน่ชัด โปรดตรวจ Zuri ก่อนลองใหม่'))},1000);
  function finish(error,result){if(done)return;done=true;clearInterval(timer);win.removeEventListener('message',onMessage);error?reject(error):resolve(result)}
  async function onMessage(event){
   if(event.origin!==origin||event.source!==popup||event.data?.nonce!==nonce)return;
   if(event.data.type==='office-ready'){try{if(!sent){sent=true;onProgress('กำลังเตรียมแพ็กจากฉากที่บันทึกไว้');zipPromise=Promise.resolve().then(buildZip)}else if(!readyToResend)return;const bytes=await zipPromise;if(done)return;if(!(bytes instanceof Uint8Array)||bytes.byteLength>100000000)throw Error('แพ็กมีขนาดไม่ถูกต้อง');readyToResend=true;popup.postMessage({type:'office-package',nonce,bytes},origin);onProgress('ส่งแพ็กไปหน้าต่าง Zuri แล้ว')}catch(error){finish(error)}}
   if(event.data.type==='office-complete'&&sent&&Number.isInteger(event.data.version)&&event.data.version>0&&Number.isInteger(event.data.count)&&event.data.count>0)finish(null,{version:event.data.version,count:event.data.count});
   if(event.data.type==='office-progress'&&typeof event.data.message==='string')onProgress(event.data.message.slice(0,300));
   if(event.data.type==='office-error')finish(new Error(String(event.data.message||'Zuri ปฏิเสธการส่ง').slice(0,300)));
  }
  win.addEventListener('message',onMessage);
 });
}
