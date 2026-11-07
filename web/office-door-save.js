import {RoomStore} from './hybrid-state.js';
import {defaultBlueprintPlan,toggleBlueprintDoor} from './office-blueprint-state.js';
// @req VO-FR-023 — revision-checked local presentation-only door updates.
// @tested tests/office-door-save.test.mjs
export function saveOfficeDoor(storage,key,expectedRevision,id){
  try{
    const fresh=new RoomStore(storage),room=fresh.floor(key);
    if(key==='lobby'||!room?.blueprint)return {ok:false,message:'ไม่มีประตูของชั้นที่บันทึกไว้ · เปิด Design Studio ก่อน'};
    if(fresh.floorRevision(key)!==expectedRevision)return {ok:false,message:'ชั้นนี้ถูกเปลี่ยนจากหน้าอื่นแล้ว · โหลดชั้นใหม่ก่อนเปลี่ยนประตู'};
    const next={...room,blueprintPlan:toggleBlueprintDoor(room.blueprintPlan||defaultBlueprintPlan(room.blueprint),id)};
    if(!fresh.apply(`preview:${key}`,next))return {ok:false,message:'บันทึกประตูไม่สำเร็จ · สถานะเดิมยังอยู่'};
    return {ok:true,room:fresh.floor(key),revision:fresh.floorRevision(key),message:'บันทึกสถานะประตูของชั้นนี้แล้ว'};
  }catch{return {ok:false,message:'เปลี่ยนสถานะประตูไม่ได้ · สถานะเดิมยังอยู่'};}
}
