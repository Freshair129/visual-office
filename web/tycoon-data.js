import {ZuriConnector,normalizeZuriOrigin} from './zuri-connector.js';
// Reads existing loopback integration only. No speculative Agent dispatch API.
const empty=()=>({status:'UNAVAILABLE',synthetic:false,targetOrigin:'',businesses:[],businessId:'',records:[],agentState:'UNAVAILABLE',checkedAt:'',truncated:false,ask:null,askStatus:'IDLE'});
const text=v=>typeof v==='string'?v.slice(0,160):'';
export class TycoonData{
  constructor(connector=new ZuriConnector(),{onChange}={}){this.connector=connector;this.onChange=onChange;this.state=empty();this.generation=0;this.domain='projects';this.askGeneration=0;}
  cancelAsk(){this.askGeneration++;this.askController?.abort();this.emit({ask:null,askStatus:'IDLE'});}
  deny(status){this.generation++;this.controller?.abort();this.askGeneration++;this.askController?.abort();this.emit({status,askStatus:status,ask:null,records:[],businessId:'',businesses:[],checkedAt:'',source:undefined,truncated:false});}
  setDomain(domain){if(domain!==null&&!['projects','growth'].includes(domain))throw Error('Unsupported read domain');if(this.domain===domain)return;this.domain=domain;if(!this.state.businessId){this.cancelAsk();this.emit({records:[],checkedAt:'',source:undefined,truncated:false});return;}this.suspend();return this.refreshProjects();}
  suspend(){this.generation++;this.controller?.abort();this.cancelAsk();this.emit({records:[],checkedAt:'',source:undefined,truncated:false,status:this.state.businessId?'IDLE':this.state.status});}
  async askMarketing(question){
    if(typeof question!=='string')throw Error('Question must be text');const value=question.trim();if(this.domain!=='growth'||!this.state.businessId||value.length>400)throw Error('Business and question (0–400 characters) required');if(this.state.askStatus==='LOADING')throw Error('Ask already pending');
    this.cancelAsk();const generation=this.askGeneration,businessId=this.state.businessId;this.askController=new AbortController();this.emit({askStatus:'LOADING'});
    try{const result=await this.connector.askGrowth(businessId,value,{signal:this.askController.signal});if(generation!==this.askGeneration)return;
      if(result?.response?.businessId!==businessId||!['READY','EMPTY','PARTIAL','UNAVAILABLE','UNKNOWN'].includes(result.response.state))throw Error('Ask scope/contract mismatch');
      this.emit({ask:result.response,askStatus:result.response.state});
    }catch(error){if(generation===this.askGeneration){if([401,403,404].includes(error.status))this.deny(error.status===401?'AUTH_REQUIRED':'FORBIDDEN');else this.emit({ask:null,askStatus:'ERROR'});}}
  }
  emit(update){this.state={...this.state,...update};this.onChange?.(this.state);}
  async connect(){
    this.cancelAsk();
    const generation=++this.generation;this.controller?.abort();this.controller=new AbortController();const {signal}=this.controller;
    this.emit({...empty(),status:'CHECKING'});
    try{
      const status=await this.connector.getStatus({signal});if(generation!==this.generation)return;
      const targetOrigin=normalizeZuriOrigin(status?.target);
      this.emit({targetOrigin,synthetic:status.synthetic===true});
      if(status?.enabled!==true||!targetOrigin){this.emit({status:'UNAVAILABLE'});return;}
      const scope=await this.connector.getScope({signal});if(generation!==this.generation)return;
      if(!Array.isArray(scope?.businesses))throw Error('scope');
      this.emit({status:'SELECT_BUSINESS',businesses:scope.businesses.filter(b=>b&&typeof b.id==='string').map(b=>({id:text(b.id),name:text(b.name||b.code||b.id)}))});
    }catch(error){if(generation===this.generation)this.emit({status:error.status===401?'AUTH_REQUIRED':error.status===403?'FORBIDDEN':'ERROR'});}
  }
  selectBusiness(id){if(!this.state.businesses.some(b=>b.id===id))throw Error('Business outside authorized scope');this.cancelAsk();this.emit({businessId:id,records:[],checkedAt:'',truncated:false,source:undefined,agentState:'UNAVAILABLE'});return this.refreshProjects();}
  async refreshProjects(){
    if(this.domain===null){this.emit({status:'UNAVAILABLE',records:[],checkedAt:'',source:undefined,truncated:false});return;}
    if(!this.state.businessId)return;const generation=++this.generation;this.controller?.abort();this.controller=new AbortController();const {signal}=this.controller;
    this.emit({status:'LOADING',records:[],checkedAt:'',truncated:false,source:undefined});
    try{
      const result=await this.connector.getDomain(this.domain,this.state.businessId,{signal});if(generation!==this.generation)return;
      const status=['READY','EMPTY','AUTH_REQUIRED','FORBIDDEN','UNAVAILABLE','ERROR'].includes(result?.state)?result.state:'ERROR';
      if(['AUTH_REQUIRED','FORBIDDEN'].includes(status)){this.deny(status);return;}
      if(['READY','EMPTY'].includes(status)&&!Array.isArray(result.records))throw Error('records');
      const records=['READY','EMPTY'].includes(status)?result.records.filter(r=>r&&typeof r.id==='string').slice(0,100).map(r=>({id:text(r.id),label:text(r.label||r.id),status:text(r.status)})):[];
      this.emit({status,records,checkedAt:text(result.checkedAt),truncated:result.truncated===true||result.moreAvailable===true,source:result.source});
    }catch(error){if(generation===this.generation){if([401,403,404].includes(error.status))this.deny(error.status===401?'AUTH_REQUIRED':'FORBIDDEN');else this.emit({status:'ERROR',records:[],truncated:false,source:undefined});}}
  }
  dispose(){this.onChange=null;this.suspend();this.state=empty();}
}
