import {ZuriConnector,normalizeZuriOrigin} from './zuri-connector.js';
import {CONTEXT_PROFILE,parseOfficeDomainContext,contextAllows} from './office-domain-context.js';
const text=v=>typeof v==='string'?v.slice(0,160):'';
const initial=()=>({status:'UNAVAILABLE',synthetic:true,targetOrigin:'',businesses:[],businessId:'',records:[],agentState:'UNAVAILABLE',checkedAt:'',source:undefined,truncated:false,ask:null,askStatus:'IDLE',context:null,contextStatus:'UNAVAILABLE',contextEpoch:0});
// Candidate-only in-memory lifecycle. No context/authority is persisted or exported.
export class OfficeContextData{
 constructor(connector=new ZuriConnector(),{onChange,wallNow=Date.now,monotonicNow=()=>performance.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}){Object.assign(this,{connector,onChange,wallNow,monotonicNow,setTimer,clearTimer});this.dynamic=true;this.state=initial();this.epoch=0;this.readSeq=0;this.askSeq=0;this.domain=null;this.hidden=false;}
 emit(update){this.state={...this.state,...update};this.onChange?.(this.state);}
 purge(status,scope={}){this.epoch++;this.readSeq++;this.askSeq++;this.contextController?.abort();this.readController?.abort();this.askController?.abort();this.clearTimer(this.timer);this.timer=null;this.domain=null;this.emit({context:null,contextStatus:status,contextEpoch:this.epoch,status,records:[],ask:null,askStatus:'IDLE',checkedAt:'',source:undefined,truncated:false,...scope});}
 async connect(){if(this.hidden){this.enabled=false;this.purge('HIDDEN',{businessId:'',businesses:[]});return;}this.enabled=false;this.purge('CHECKING',{businessId:'',businesses:[]});const epoch=this.epoch;this.contextController=new AbortController();const {signal}=this.contextController;
  try{const status=await this.connector.getStatus({signal});if(epoch!==this.epoch)return;const target=normalizeZuriOrigin(status?.target);if(!status?.enabled||status.synthetic!==true||status.contextProfile!==CONTEXT_PROFILE||!target){this.emit({status:'UNAVAILABLE',contextStatus:'UNAVAILABLE'});return;}
   const scope=await this.connector.getScope({signal});if(epoch!==this.epoch)return;if(!Array.isArray(scope.businesses))throw Error('scope');this.enabled=true;this.emit({targetOrigin:target,businesses:scope.businesses.filter(b=>b&&typeof b.id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(b.id)).map(b=>({id:b.id,name:text(b.name||b.id)})),status:'SELECT_BUSINESS',contextStatus:'SELECT_BUSINESS'});
  }catch(error){if(epoch===this.epoch)this.failure(error,true);}
 }
 failure(error,context=false){if([401,403,404].includes(error?.status)){this.enabled=false;this.purge(error.status===401?'AUTH_REQUIRED':'FORBIDDEN',{businessId:'',businesses:[]});}else if(context)this.purge('UNAVAILABLE',{businessId:''});else this.emit({status:'ERROR',records:[],checkedAt:'',source:undefined,truncated:false});}
 selectBusiness(id){if(!this.enabled||!this.state.businesses.some(b=>b.id===id))throw Error('Business outside scope');return this.refreshContext(id);}
 async refreshContext(id=this.state.businessId){if(!this.enabled||this.hidden||!id||!this.state.businesses.some(b=>b.id===id))return;this.purge('LOADING',{businessId:id});const epoch=this.epoch;this.contextController=new AbortController();
  try{const raw=await this.connector.getDomainContext(id,{signal:this.contextController.signal});if(epoch!==this.epoch||this.hidden)return;const context=parseOfficeDomainContext(raw,id,{wallNow:this.wallNow});this.expiresAt=this.monotonicNow()+60000;const expire=()=>{if(this.ensureFresh()){this.timer=this.setTimer(expire,Math.max(1,this.expiresAt-this.monotonicNow()));this.timer?.unref?.();}};this.timer=this.setTimer(expire,60000);this.timer?.unref?.();this.emit({context,contextStatus:'READY',status:'IDLE'});}
  catch(error){if(epoch===this.epoch)this.failure(error,true);}
 }
 ensureFresh(){if(this.state.context&&this.monotonicNow()>=this.expiresAt)this.purge('EXPIRED');return !!this.state.context&&!this.hidden&&this.state.contextStatus==='READY';}
 canRead(operation){return this.ensureFresh()&&contextAllows(this.state.context,this.domain,operation);}
 setHidden(value){this.hidden=value;if(value)this.purge('HIDDEN');else return this.enabled?this.refreshContext():this.connect();}
 focus(){if(!this.hidden)return this.refreshContext();}
 setDomain(key){if(this.domain===key)return;this.domain=key;this.readSeq++;this.askSeq++;this.readController?.abort();this.askController?.abort();this.emit({records:[],ask:null,askStatus:'IDLE',status:'IDLE',checkedAt:'',source:undefined,truncated:false});if(key==='growth')return this.refreshProjects();}
 async refreshProjects(){if(!this.canRead('marketing.campaigns.read'))return;const epoch=this.epoch,seq=++this.readSeq,id=this.state.businessId;this.readController?.abort();this.readController=new AbortController();this.emit({status:'LOADING',records:[],checkedAt:'',source:undefined,truncated:false});
  try{const result=await this.connector.getDomain('growth',id,{signal:this.readController.signal});if(!this.canRead('marketing.campaigns.read')||epoch!==this.epoch||seq!==this.readSeq)return;
   if(['AUTH_REQUIRED','FORBIDDEN'].includes(result?.state)){this.failure({status:result.state==='AUTH_REQUIRED'?401:403});return;}
   const status=['READY','EMPTY','UNAVAILABLE','ERROR'].includes(result?.state)?result.state:'ERROR';if(['READY','EMPTY'].includes(status)&&!Array.isArray(result.records))throw Error('records');const records=['READY','EMPTY'].includes(status)?result.records.filter(r=>r&&typeof r.id==='string').slice(0,100).map(r=>({id:text(r.id),label:text(r.label||r.id),status:text(r.status)})):[];this.emit({status,records,checkedAt:text(result.checkedAt),source:result.source,truncated:result.truncated===true||result.moreAvailable===true});
  }catch(error){if(epoch===this.epoch&&seq===this.readSeq)this.failure(error);}
 }
 async askMarketing(question){if(typeof question!=='string'||question.trim().length>400||!this.canRead('marketing.overview.read')||this.state.askStatus==='LOADING')throw Error('Marketing read unavailable');const epoch=this.epoch,seq=++this.askSeq,id=this.state.businessId;this.askController?.abort();this.askController=new AbortController();this.emit({ask:null,askStatus:'LOADING'});
  try{const result=await this.connector.askGrowth(id,question.trim(),{signal:this.askController.signal});if(!this.canRead('marketing.overview.read')||epoch!==this.epoch||seq!==this.askSeq)return;if(result?.response?.businessId!==id||!['READY','EMPTY','PARTIAL','UNAVAILABLE','UNKNOWN'].includes(result.response.state))throw Error('response');this.emit({ask:result.response,askStatus:result.response.state});}
  catch(error){if(epoch===this.epoch&&seq===this.askSeq){if([401,403,404].includes(error.status))this.failure(error);else this.emit({ask:null,askStatus:'ERROR'});}}
 }
 suspend(){this.hidden=true;this.purge('HIDDEN');}
 dispose(){this.onChange=null;this.enabled=false;this.purge('UNAVAILABLE',{businessId:'',businesses:[]});}
}
