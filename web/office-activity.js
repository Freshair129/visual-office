// Local ambient presentation only: never an Agent run, role or business-state writer.
// Verified by tests/office-activity.test.mjs.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
export const activityNames={auto:'กิจวัตรจำลอง',seated:'นั่งที่โต๊ะ',walking:'เดินในสำนักงาน',thinking:'ท่าครุ่นคิด',idle:'พัก'};
const states={idle:'ว่าง',working:'กำลังทำงาน',thinking:'กำลังคิด',waiting:'รอข้อมูล',done:'เสร็จแล้ว',offline:'ออฟไลน์',unknown:'ไม่ทราบสถานะ'};
const poses={walking:'เดินไปจุดหมาย',seated:'นั่งที่โต๊ะ',sitting:'นั่งพัก',thinking:'ท่าครุ่นคิด',idle:'ยืนพัก',drinking:'ดื่มน้ำ',resting:'พักที่โซฟา'};
export function officeAgentState(value){
  const source=typeof value?.source==='string'?value.source.trim().slice(0,160):'';
  return source&&Object.hasOwn(states,value?.state)?{state:value.state,source}:{state:'unknown',source:''};
}
export function officeActivityCaption(action,value){
  const status=officeAgentState(value);
  return `${states[status.state]} · ${poses[action]||poses.idle} (จำลอง)`;
}
export function sampleOfficeActivity(room,object,index,elapsed,{reduced=false,mode='auto',agentState}={}){
  const time=(Math.max(0,elapsed)+index*7600)%36000;
  const nearby=room.objects.filter(o=>['work-desk','desk'].includes(o.kind)).map(o=>({object:o,distance:Math.hypot(o.x-object.x,o.y-object.y)})).sort((a,b)=>a.distance-b.distance)[0];
  const desk=room.objects.find(o=>['work-desk','desk'].includes(o.kind)&&o.id===object.id.replace(/-avatar$/,'-desk'))||(nearby?.distance<=20?nearby.object:null);
  let action=reduced||mode==='auto'?(desk?'sitting':'idle'):mode;
  if(!desk&&(action==='seated'||action==='sitting'))action='idle';
  let x=object.x,y=object.y,flip=object.flip;
  if(action==='walking'){
    // A bounded out-and-back aisle route around the actor's desk, derived from its
    // current placement. This is ambient blocking, not a general navigation mesh.
    const side=object.x<50?-1:1,edge=clamp(object.x+side*13,10,90),front=clamp((desk?.y??object.y)+5,42,92);
    const points=room.background==='office'
      ?[[object.x,object.y],[object.x+6,object.y-3],[object.x+9,object.y-1],[object.x+6,object.y+1],[object.x+9,object.y-1],[object.x+6,object.y-3],[object.x,object.y]]
      :[[object.x,object.y],[edge,object.y],[edge,front],[50,front],[edge,front],[edge,object.y],[object.x,object.y]];
    const phase=((mode==='walking'?elapsed%14000:time-20000)/14000)*6;
    const segment=clamp(Math.floor(phase),0,5),a=points[segment],b=points[segment+1],t=phase-segment;
    x=mix(a[0],b[0],t);y=mix(a[1],b[1],t);flip=b[0]<a[0];
  }
  return {x:clamp(x,8,92),y:clamp(y,18,94),flip,action,thought:officeActivityCaption(action,agentState),frame:action==='walking'?Math.floor(elapsed/320)%2:0};
}
