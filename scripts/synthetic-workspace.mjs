// Opt-in loopback harness storage. Never imported by the browser or production Worker.
import {profiles} from '../web/agent-profiles.js';

export class SyntheticBucket{
 constructor(){this.records=new Map();this.version=0;}
 async put(key,value,options={}){
  const previous=this.records.get(key),condition=options.onlyIf;
  if(condition instanceof Headers&&condition.get('if-none-match')==='*'&&previous)return null;
  if(condition&&!(condition instanceof Headers)&&condition.etagMatches!==undefined&&previous?.etag!==condition.etagMatches)return null;
  let bytes;if(typeof value==='string')bytes=new TextEncoder().encode(value);else if(value instanceof Uint8Array)bytes=value.slice();else bytes=new Uint8Array(await new Response(value).arrayBuffer());
  const etag=String(++this.version);this.records.set(key,{bytes,etag,httpMetadata:options.httpMetadata||{}});return{etag};
 }
 async get(key){const r=this.records.get(key);if(!r)return null;const bytes=r.bytes.slice();return{etag:r.etag,size:bytes.byteLength,httpMetadata:r.httpMetadata,body:new Response(bytes).body,json:async()=>JSON.parse(new TextDecoder().decode(bytes)),arrayBuffer:async()=>bytes.buffer,writeHttpMetadata:headers=>{for(const [k,v]of Object.entries(r.httpMetadata))if(k==='contentType')headers.set('content-type',v);}};}
 async delete(key){for(const item of Array.isArray(key)?key:[key])this.records.delete(item);}
 async list({prefix=''}){return{objects:[...this.records].filter(([k])=>k.startsWith(prefix)).map(([key,r])=>({key,size:r.bytes.byteLength})),truncated:false};}
}

const id=n=>`76666666-6666-4666-8666-${String(n).padStart(12,'0')}`;
export function syntheticBodyLimit(path,workspace=false){
 if(!workspace||path.startsWith('/api/zuri/'))return 16384;
 return /^\/api\/(?:chats\/[0-9a-f-]{36}\/attachments\/[0-9a-f-]{36}|knowledge\/files\/[0-9a-f-]{36})$/i.test(path)?8*1024*1024:128*1024;
}
export async function createSyntheticWorkspace(){
 const bucket=new SyntheticBucket(),now=()=>new Date().toISOString();
 const sessions=profiles.map((p,i)=>({id:id(i+1),name:p.name,status:i===1?'working':i===2?'stuck':'idle',currentFile:null,lastLog:'Synthetic fixture · ไม่มี agent จริงทำงาน'}));
 const seedJob=(n,agentId,status,title,result)=>({id:id(100+n),title:'Synthetic · '+title,brief:'ข้อมูลทดลองสำหรับตรวจ flow ของ Visual Office เท่านั้น',agentIds:[agentId],team:false,status,cancelRequested:false,createdAt:now(),updatedAt:now(),steps:[{agentId,phase:'specialist',threadId:sessions[profiles.findIndex(p=>p.id===agentId)].id,status,result:result||'',updatedAt:now()}]});
 const jobs=[seedJob(1,'beam','done','รายงานพร้อมตรวจ','# Synthetic report\n\nผลส่งมอบตัวอย่างสำหรับตรวจรับ ไม่ใช่ผลจาก agent จริง'),seedJob(2,'pim','waiting','รอข้อมูลจากผู้ใช้',''),seedJob(3,'kai','running','วางแผนแคมเปญตัวอย่าง','')];
 // Explicit fixture scope only: does not bind scene roles or change create-job contracts.
 jobs[0].domainKey='projects';jobs[1].domainKey='projects';jobs[2].domainKey='growth';
 for(const job of jobs)await bucket.put('office/jobs/'+job.id+'.json',JSON.stringify(job));
 await bucket.put('office/team.json',JSON.stringify({context:'Synthetic workspace · สินค้าและธุรกิจสมมติ · ข้อมูลไม่ออกจากเครื่องนี้'}));
 await bucket.put('office/preferences.json',JSON.stringify({assignments:sessions.map(s=>({id:s.id,name:''})),avatars:null}));
 const capabilities={provider:'synthetic-fixture',model:'Fixture transcript · ไม่มีโมเดล live',skills:[],commands:[],observedTools:[],context:{usedTokens:1200,maxTokens:32000,updatedAt:now()}};
 for(const session of sessions){const messages=Array.from({length:34},(_,i)=>({id:'fixture-'+session.id+'-'+i,role:i%2?'assistant':'user',text:`Synthetic ${i+1} · ${i%2?'คำตอบตัวอย่าง ไม่ใช่ agent จริง':'ข้อความตัวอย่าง'}`,createdAt:now()}));await bucket.put('office/chat-history/'+session.id,JSON.stringify({messages,receivedAt:now(),status:session.status,capabilities}));}
 const refresh=async()=>{
  await bucket.put('office/latest.json',JSON.stringify({version:1,sessions,hostStatus:'live',receivedAt:now()}));
  for(const s of sessions){const record=await bucket.get('office/chat-history/'+s.id);if(record){const history=await record.json();history.receivedAt=now();await bucket.put('office/chat-history/'+s.id,JSON.stringify(history));}}
 };
 await refresh();
 return{bucket,refresh,sessions,jobs,actorStates:{projects:Array.from({length:4},(_,i)=>({avatarId:`role-${i+1}-avatar`,state:'idle',source:'synthetic-workspace-fixture'}))}};
}
