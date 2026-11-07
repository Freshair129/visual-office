import {OFFICE_DEPARTMENTS} from './office-departments.js';
import {designId} from './office-world-identity.js';
import {buildOfficeHandoff} from './office-handoff.js';
import {collectHandoffAssets,handoffZip} from './office-handoff-assets.js';
import {customModels} from './custom-assets.js';
import {normalizeZuriOrigin,openOfficeTransfer} from './office-zuri-transfer.js';
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
export function showDepartmentDesign(view){
  const key=view.floor==='building'?'lobby':view.floor,d=OFFICE_DEPARTMENTS.find(d=>d.key===key),body=view.openSheet('ทีมและ Workflow · แบบออกแบบ','department-design');if(!d)return;
  body.append(node('p',d.purpose),node('p','ตำแหน่งทีมที่ออกแบบไว้ · ยังไม่ใช่ Agent ที่ลงทะเบียนหรือได้รับสิทธิ์จาก Zuri'));
  const identity=node('small','Floor ID…');body.append(identity);void designId('floor',key).then(id=>{if(identity.isConnected)identity.textContent='Floor design ID: '+id;});
  for(const r of d.roles){const card=node('article','');card.className='tycoon-project-card';card.append(node('h3',r.title),node('p',r.responsibilities.join(' · ')),node('p','ผลส่งมอบ: '+r.outputs.join(' · ')));const id=node('small','');card.append(id);void designId('agentDesign',key+'/'+r.key+'/slot-1').then(value=>{if(id.isConnected)id.textContent='Agent design ID: '+value;});body.append(card);}
  for(const w of d.workflows){body.append(node('h3',w.label),node('p','เริ่มเมื่อ: '+w.trigger));const list=node('ol','');for(const s of w.steps){const role=d.roles.find(r=>r.key===s.roleKey);list.append(node('li',`${role?.title||s.roleKey}: ${s.label} — ${s.action} → ${s.output}`));}body.append(list);for(const h of w.handoffs||[])body.append(node('p',`ส่งต่อ ${h.toDepartmentKey}: ${h.artifact} · ${h.condition}`));}
  const button=node('button','ส่งออกแปลนทุกชั้น + ทีม + ID (.zip)'),status=node('p','แพ็กประกอบด้วย manifest, schema และโมเดลตาม hash สำหรับส่งต่อให้ทีม Zuri');button.type='button';body.append(button,status);
  const buildZip=async()=>{
    const {rooms}=await view.store.snapshotForExport();
    const readFile=async path=>{const response=await fetch('./'+path);if(!response.ok)throw Error('โหลดไฟล์ไม่สำเร็จ: '+path);return new Uint8Array(await response.arrayBuffer());};
    const assets=await collectHandoffAssets(rooms,{readFile,readCustom:id=>customModels.get(id)}),manifest=await buildOfficeHandoff({rooms,assets:assets.descriptors}),response=await fetch('./office-handoff.schema.json');if(!response.ok)throw Error('โหลด schema ไม่สำเร็จ');
    return handoffZip(manifest,assets.blobs,await response.json());
  };
  button.onclick=async()=>{
    button.disabled=true;status.textContent='กำลังตรวจฉาก โมเดล และ ID ทุกชั้น…';try{
      const zip=await buildZip();
      if(!button.isConnected)return;const url=URL.createObjectURL(new Blob([zip],{type:'application/zip'})),a=node('a','');a.href=url;a.download='zuri-office-design-handoff.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='ส่งออกแพ็กแบบออกแบบแล้ว · ยังไม่ได้ลงทะเบียนหรือเขียน DB ของ Zuri';
    }catch(error){status.textContent='ส่งออกไม่ได้ · '+error.message;}finally{button.disabled=false;}
  };
  const label=node('label','Zuri '),input=node('select',''),send=node('button','ส่ง handoff ไป Zuri');let trustedOrigins=[];input.append(node('option','เลือก Zuri ที่ติดตั้งไว้'));input.firstChild.value='';label.append(input);send.type='button';send.disabled=true;body.append(label,send);
  void fetch('./office-zuri-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('ไม่พบการตั้งค่า Zuri');return r.json()}).then(config=>{if(!Array.isArray(config.origins)||config.origins.length>10)throw Error('การตั้งค่า Zuri ไม่ถูกต้อง');trustedOrigins=[...new Set(config.origins.map(normalizeZuriOrigin))];for(const origin of trustedOrigins){const option=node('option',origin);option.value=origin;input.append(option)}send.disabled=!trustedOrigins.length;if(!trustedOrigins.length)status.textContent='ยังไม่ได้ตั้งค่า Zuri ปลายทางสำหรับ handoff'}).catch(error=>{status.textContent=error.message});
  send.onclick=async()=>{send.disabled=true;status.textContent='กำลังเปิด Zuri เพื่อเลือก Business และ Workspace…';const resume=view.scene?.pauseForHandoff?.();try{
    const result=await openOfficeTransfer(window,input.value,buildZip,trustedOrigins,message=>{status.textContent='Zuri · '+message});
    status.textContent=`ลงทะเบียนแบบออกแบบรุ่น ${result.version} แล้ว · อ่าน ${result.count} IDs กลับจาก Zuri`;
  }catch(error){status.textContent='ยังยืนยันผล handoff ไม่ได้ · '+error.message}finally{resume?.();send.disabled=false}};
}
