import {domainFloors} from './domain-office.js';

export const SYNTHETIC_WORKSPACE_PROFILE='office-workspace-synthetic/v1';
const returnKey='zuri-office:return-floor:v1';
const presentationFloors=new Set(['lobby',...domainFloors.map(f=>f.key)]);
export function readReturnFloor(storage){try{const value=storage?.getItem(returnKey);return presentationFloors.has(value)?value:null;}catch{return null;}}
export function writeReturnFloor(storage,floor){if(!presentationFloors.has(floor))return;try{storage?.setItem(returnKey,floor);}catch{/* Optional navigation convenience only. */}}

export function workspaceAccess({verified=false,zuriEnabled=false,synthetic=false,demo=false,connectionStatus='offline'}={}){
 if(!verified)return{allowed:false,kind:'loading',message:'กำลังตรวจแหล่งข้อมูลของพื้นที่ทำงาน…'};
 if(demo)return{allowed:true,kind:'demo',message:'ข้อมูลตัวอย่างแบบอ่านอย่างเดียว · ไม่ส่งคำสั่งหรือบันทึกธุรกิจ'};
 if(zuriEnabled&&!synthetic)return{allowed:false,kind:'unavailable',message:'ยังไม่มี API ของ Zuri สำหรับพื้นที่แชท งาน และเอกสารชุดนี้ · ยังไม่ได้รับข้อมูล ไม่ใช่รายการว่าง'};
 if(connectionStatus!=='live')return{allowed:false,kind:'unavailable',message:synthetic?'Synthetic workspace ยังไม่พร้อม · ลองโหลดข้อมูลอีกครั้ง':'บริการพื้นที่ทำงานยังไม่พร้อม · ยังไม่ได้รับข้อมูล ลองเชื่อมต่ออีกครั้ง'};
 return{allowed:true,kind:synthetic?'synthetic':'connected',message:synthetic?'SYNTHETIC WORKSPACE · ข้อมูลและคำสั่งทดลองอยู่ในหน่วยความจำของเครื่องนี้ · ไม่ส่งไป Zuri หรือ agent จริง':'ข้อมูลจากบริการพื้นที่ทำงาน T3 · แยกจากข้อมูล Business ของ Zuri'};
}
