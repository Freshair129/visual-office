export class CloudClient {
 #options;#fetch;#timer;#controller;#generation=0;#request=0;#visible=true;#active=false;
 constructor(options){this.#options=options;this.#fetch=options.fetchImpl||globalThis.fetch.bind(globalThis);}
 disconnect(){this.#active=false;this.#generation++;clearTimeout(this.#timer);this.#controller?.abort();}
 setVisible(value){
  const visible=Boolean(value);if(visible===this.#visible)return;
  this.#visible=visible;if(!visible)clearTimeout(this.#timer);
  else if(this.#active)return this.refresh();
 }
 async connect(){this.disconnect();this.#options.onState({status:'connecting'});return this.refresh();}
 async refresh(){
  this.#active=true;
  clearTimeout(this.#timer);this.#controller?.abort();const generation=this.#generation,request=++this.#request;
  this.#controller=new AbortController();
  try{const response=await this.#fetch(officeApiUrl('office'),{cache:'no-store',signal:this.#controller.signal});if(!response.ok)throw new Error('Office HTTP '+response.status);
   const snapshot=await response.json();if(generation!==this.#generation||request!==this.#request)return false;if(snapshot.version!==1||!Array.isArray(snapshot.sessions))throw new Error('Invalid office snapshot');
   const [jobs,team]=await Promise.all(['jobs','team'].map(async path=>{const r=await this.#fetch(officeApiUrl(path),{cache:'no-store',signal:this.#controller.signal});if(!r.ok)throw new Error('Office HTTP '+r.status);return r.json();}));
   if(generation!==this.#generation||request!==this.#request)return false;
   if(!Array.isArray(jobs?.jobs)||typeof team?.context!=='string')throw new Error('Invalid Office workspace response');
   this.#options.onJobs?.({jobs:jobs.jobs,context:team.context});this.#options.onSnapshot(snapshot.sessions);this.#options.onState({status:snapshot.stale?'offline':'live',lastSync:snapshot.receivedAt,error:snapshot.stale?'เครื่องที่รัน T3 ออฟไลน์ หรือไม่มีการอัปเดตล่าสุด':null});return !snapshot.stale;
  }catch(error){if(generation===this.#generation&&request===this.#request){this.#options.onJobs?.({jobs:[],context:''});this.#options.onSnapshot([]);this.#options.onState({status:'retrying',error:'เชื่อมต่อออฟฟิศไม่ได้ กำลังลองใหม่'});}return false;
  }finally{if(this.#visible&&this.#active&&generation===this.#generation&&request===this.#request)this.#timer=setTimeout(()=>this.refresh(),5000);}
 }
}
import {officeApiUrl} from './office-api-base.js';
