import {profiles} from './agent-profiles.js';
import {renderRichMessage,disposeRichMessages} from './rich-content.js';

const statusLabels={queued:'รอรับงาน',running:'กำลังทำงาน',waiting:'รอข้อมูลใน T3',done:'เสร็จแล้ว',error:'มีข้อผิดพลาด',cancelled:'ยกเลิกแล้ว'};
const types=[
 {id:'report',label:'รายงาน Markdown'},
 {id:'diagram',label:'แผนภาพ'},
 {id:'interactive',label:'ชิ้นงาน interactive'},
 {id:'text',label:'ข้อความ'}
];
const make=(doc,tag,text,className)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const normalize=value=>String(value??'').toLocaleLowerCase();

export function classifyResult(text=''){
 const source=String(text);
 const languages=[...source.matchAll(/^\s*```\s*([\w-]*)/gm)].map(match=>match[1].toLowerCase());
 if(languages.some(language=>['mermaid','svg'].includes(language)))return{id:'diagram',label:'แผนภาพ',format:languages.find(language=>['mermaid','svg'].includes(language)).toUpperCase()};
 if(languages.some(language=>['html','interactive'].includes(language)))return{id:'interactive',label:'ชิ้นงาน interactive',format:'HTML'};
 if(languages.some(Boolean)||/^\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|\|.+\|/m.test(source))return{id:'report',label:'รายงาน Markdown',format:'Markdown'};
 return{id:'text',label:'ข้อความ',format:'ข้อความ'};
}

export function collectResults(jobs=[],agents=[]){
 const agentNames=new Map(profiles.map(agent=>[agent.id,agent]));
 for(const agent of Array.isArray(agents)?agents:[])if(agent&&typeof agent.id==='string')agentNames.set(agent.id,{...agentNames.get(agent.id),...agent});
 const results=[];
 for(const job of Array.isArray(jobs)?jobs:[]){
  if(!job||!Array.isArray(job.steps))continue;
  for(const step of job.steps){
   if(!step||typeof step.result!=='string'||!step.result.trim()||typeof step.threadId!=='string'||!step.threadId)continue;
   const agent=agentNames.get(step.agentId)||{id:step.agentId||'unknown',name:step.agentId||'ไม่ทราบ agent',role:''};
   const type=classifyResult(step.result);
   results.push({
    id:step.threadId,jobId:String(job.id||''),workTitle:String(job.title||'งานไม่ระบุชื่อ'),
    agentId:String(step.agentId||''),agentName:String(agent.name||agent.id||'ไม่ทราบ agent'),agentRole:String(agent.role||''),
    threadId:step.threadId,phase:step.phase==='synthesis'?'สรุปทีม':'งานของ agent',
    status:String(step.status||job.status||''),text:step.result,truncated:step.resultTruncated===true,
    timestamp:step.updatedAt||job.updatedAt||job.createdAt||'',type,typeLabel:type.label,format:type.format
   });
  }
 }
 return results.sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0));
}

export function collectThreadContexts(jobs=[],sessions=[],agents=[]){
 const names=new Map(profiles.map(agent=>[agent.id,agent]));
 for(const agent of Array.isArray(agents)?agents:[])if(agent&&typeof agent.id==='string')names.set(agent.id,{...names.get(agent.id),...agent});
 const contexts=[],seen=new Set();
 for(const job of Array.isArray(jobs)?jobs:[]){
  if(!job||job.cancelRequested||!Array.isArray(job.steps))continue;
  for(const step of job.steps){
   if(!step||!isUuid(step.threadId)||step.status==='cancelled'||seen.has(step.threadId))continue;
   seen.add(step.threadId);const agent=names.get(step.agentId)||{id:step.agentId||'',name:step.agentId||'ไม่ทราบ agent',role:''};
   contexts.push({threadId:step.threadId,jobId:String(job.id||''),workTitle:String(job.title||'งานไม่ระบุชื่อ'),agentName:String(agent.name||agent.id||'ไม่ทราบ agent'),phase:step.phase==='synthesis'?'สรุปทีม':'บทสนทนางาน',timestamp:step.updatedAt||job.updatedAt||job.createdAt||''});
  }
 }
 for(const session of Array.isArray(sessions)?sessions:[]){
  if(!session||!isUuid(session.id)||seen.has(session.id))continue;
  seen.add(session.id);contexts.push({threadId:session.id,jobId:'',workTitle:'บทสนทนาจาก T3',agentName:String(session.name||session.role||'บทสนทนา'),phase:'บทสนทนา',timestamp:session.updatedAt||''});
 }
 return contexts;
}

export function filterResults(results,{query='',agentId='',type=''}={}){
 const needle=normalize(query).trim();
 return results.filter(result=>(!agentId||result.agentId===agentId)&&(!type||result.type.id===type)&&(!needle||[
  result.workTitle,result.agentName,result.agentRole,result.text,result.phase,result.typeLabel
 ].some(value=>normalize(value).includes(needle))));
}

export function safeResultFilename(title,agentId='result'){
 const part=value=>String(value||'').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'-').replace(/\.\.+/g,'.').replace(/\s+/g,'-').replace(/^[.\- ]+|[.\- ]+$/g,'').slice(0,72)||'result';
 return `${part(title)}-${part(agentId)}.md`;
}
export function safeAttachmentFilename(name='attachment.bin'){
 return String(name||'attachment.bin').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'-').replace(/^\.+/,'').trim().slice(0,200)||'attachment.bin';
}

function dateLabel(value){
 const time=Date.parse(value||'');
 return Number.isFinite(time)?new Date(time).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'เวลาไม่ทราบ';
}

function statusLabel(status){return statusLabels[status]||'ยังไม่มีสถานะ';}
function fileSize(bytes){return Number.isFinite(bytes)?(bytes>=1024*1024?(bytes/1024/1024).toFixed(1)+' MB':Math.max(1,Math.round(bytes/1024))+' KB'):'ขนาดไม่ทราบ';}
const isUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||'');

export class ResultsView{
 #root;#doc;#options;#jobs=[];#agents=[];#sessions=[];#results=[];#selectedId='';#pendingOpen='';#pendingOpenApplied=false;#emptyMessage='';#query='';#agentFilter='';#typeFilter='';#fileCache=new Map();#inspector;#list;#count;#agentSelect;#typeSelect;#search;#clear;#filterOptionsSignature='';#listSignature='';#inspectorSignature='';#fileBrowser;#fileJobSelect;#fileThreadSelect;#fileSlot;#selectedFileJobId='';#selectedFileThreadId='';#fileSelectionManual=false;#fileOptionsSignature='';#fileListSignature='';
 constructor(root,{onOpenChat=()=>{},onOpenWork=()=>{},onSelectionChange=()=>{},toast=()=>{},fetchImpl=globalThis.fetch?.bind(globalThis)}={}){
  this.#root=root;this.#doc=root.ownerDocument||document;this.#options={onOpenChat,onOpenWork,onSelectionChange,toast,fetchImpl};
  root.classList.add('results-view');
  const page=make(this.#doc,'div',undefined,'results-page');
  const heading=make(this.#doc,'header',undefined,'results-heading');
  heading.append(make(this.#doc,'div',undefined,'results-heading-copy'));
  const title=make(this.#doc,'h1','ผลงานและไฟล์');title.id='results-page-title';
  const copy=heading.firstElementChild;copy.append(make(this.#doc,'p','EVIDENCE · RESULTS','results-eyebrow'),title,make(this.#doc,'p','ค้นหา อ่าน และเปิดผลที่บันทึกไว้จากงานกับบทสนทนาต้นทาง','results-description'));
  page.setAttribute('aria-labelledby','results-page-title');
  const controls=make(this.#doc,'div',undefined,'results-controls');
  const searchLabel=make(this.#doc,'label',undefined,'results-search-label');searchLabel.append(make(this.#doc,'span','ค้นหาผลงาน'));this.#search=make(this.#doc,'input');this.#search.type='search';this.#search.placeholder='ค้นหาชื่องาน agent หรือเนื้อหา';this.#search.autocomplete='off';this.#search.setAttribute('aria-label','ค้นหาผลงาน');searchLabel.append(this.#search);
  const agentLabel=make(this.#doc,'label',undefined,'results-filter-label');agentLabel.append(make(this.#doc,'span','Agent'));this.#agentSelect=make(this.#doc,'select');this.#agentSelect.setAttribute('aria-label','กรองตาม agent');agentLabel.append(this.#agentSelect);
  const typeLabel=make(this.#doc,'label',undefined,'results-filter-label');typeLabel.append(make(this.#doc,'span','ประเภทผลงาน'));this.#typeSelect=make(this.#doc,'select');this.#typeSelect.setAttribute('aria-label','กรองตามประเภทผลงาน');typeLabel.append(this.#typeSelect);
  this.#clear=make(this.#doc,'button','ล้างตัวกรอง','results-clear');this.#clear.type='button';this.#clear.hidden=true;controls.append(searchLabel,agentLabel,typeLabel,this.#clear);
  this.#count=make(this.#doc,'p','กำลังโหลดผลงาน','results-count');this.#count.setAttribute('role','status');this.#count.setAttribute('aria-live','polite');
  const layout=make(this.#doc,'div',undefined,'results-layout');
  const listPanel=make(this.#doc,'section',undefined,'results-list-panel');listPanel.setAttribute('aria-label','รายการผลงาน');listPanel.append(make(this.#doc,'h2','รายการผลงาน','results-panel-title'));this.#list=make(this.#doc,'div',undefined,'results-list');listPanel.append(this.#list);
  this.#fileBrowser=make(this.#doc,'section',undefined,'results-files-browser');this.#fileBrowser.setAttribute('aria-label','ไฟล์แนบจากบทสนทนา');
  this.#fileBrowser.append(make(this.#doc,'h2','ไฟล์แนบในบทสนทนา','results-panel-title'),make(this.#doc,'p','เลือกงานและบทสนทนาเพื่อดูไฟล์ที่บันทึกไว้','results-file-browser-help'));
  const fileFilters=make(this.#doc,'div',undefined,'results-file-filters');
  const fileJobLabel=make(this.#doc,'label');fileJobLabel.append(make(this.#doc,'span','งาน'));this.#fileJobSelect=make(this.#doc,'select');this.#fileJobSelect.setAttribute('aria-label','เลือกงานสำหรับไฟล์แนบ');fileJobLabel.append(this.#fileJobSelect);
  const fileThreadLabel=make(this.#doc,'label');fileThreadLabel.append(make(this.#doc,'span','บทสนทนา'));this.#fileThreadSelect=make(this.#doc,'select');this.#fileThreadSelect.setAttribute('aria-label','เลือกบทสนทนาสำหรับไฟล์แนบ');fileThreadLabel.append(this.#fileThreadSelect);
  fileFilters.append(fileJobLabel,fileThreadLabel);this.#fileBrowser.append(fileFilters);this.#fileSlot=make(this.#doc,'div',undefined,'result-files-content');this.#fileBrowser.append(this.#fileSlot);
  listPanel.append(this.#fileBrowser);
  const detailPanel=make(this.#doc,'article',undefined,'results-detail-panel');detailPanel.setAttribute('aria-label','รายละเอียดผลงาน');this.#inspector=make(this.#doc,'div',undefined,'results-inspector');detailPanel.append(this.#inspector);
  page.append(heading,controls,this.#count,layout);layout.append(listPanel,detailPanel);root.replaceChildren(page);
  this.#search.addEventListener('input',()=>{this.#query=this.#search.value;this.#render();});
  this.#agentSelect.addEventListener('change',()=>{this.#agentFilter=this.#agentSelect.value;this.#render();});
  this.#typeSelect.addEventListener('change',()=>{this.#typeFilter=this.#typeSelect.value;this.#render();});
  this.#clear.addEventListener('click',()=>{this.#query='';this.#agentFilter='';this.#typeFilter='';this.#search.value='';this.#render();this.#search.focus();});
  this.#fileJobSelect.addEventListener('change',()=>{this.#selectedFileJobId=this.#fileJobSelect.value;this.#selectedFileThreadId='';this.#fileSelectionManual=true;this.#render();});
  this.#fileThreadSelect.addEventListener('change',()=>{this.#selectedFileThreadId=this.#fileThreadSelect.value;this.#fileSelectionManual=true;this.#render();});
  this.#list.addEventListener('click',event=>{const button=event.target.closest('[data-result-id]');if(!button||!this.#list.contains(button))return;this.#selectedId=button.dataset.resultId;this.#pendingOpen='';this.#pendingOpenApplied=false;this.#emptyMessage='';this.#fileSelectionManual=false;this.#options.onSelectionChange(this.#selectedId);this.#render();});
 }
 update({jobs=[],agents=[],sessions=[]}={}){
  this.#jobs=Array.isArray(jobs)?jobs:[];this.#agents=Array.isArray(agents)?agents:[];this.#sessions=Array.isArray(sessions)?sessions:[];this.#results=collectResults(this.#jobs,this.#agents);
  if(this.#pendingOpen)this.#resolveOpen(this.#pendingOpen);this.#render();
 }
 open(jobIdOrArtifactId){
  if(typeof jobIdOrArtifactId!=='string'||!jobIdOrArtifactId)return false;
  this.#pendingOpen=jobIdOrArtifactId;this.#pendingOpenApplied=false;
  const opened=this.#resolveOpen(jobIdOrArtifactId);
  this.#render();
  return opened;
 }
 dispose(){disposeRichMessages(this.#inspector);}
 #resolveOpen(id){
  const match=this.#results.find(result=>result.id===id)||this.#results.find(result=>result.jobId===id);
  if(match){this.#pendingOpen='';this.#pendingOpenApplied=false;this.#selectedId=match.id;this.#emptyMessage='';this.#query='';this.#agentFilter='';this.#typeFilter='';this.#search.value='';this.#fileSelectionManual=false;this.#options.onSelectionChange(match.id);return true;}
  const job=this.#jobs.find(item=>item.id===id);
  if(job){if(!this.#pendingOpenApplied){this.#selectedId='';this.#emptyMessage='งานนี้ยังไม่มีผลลัพธ์ที่บันทึกไว้';this.#query='';this.#agentFilter='';this.#typeFilter='';this.#search.value='';this.#selectedFileJobId=id;this.#selectedFileThreadId=job.steps?.[0]?.threadId||'';this.#fileSelectionManual=true;this.#pendingOpenApplied=true;}return true;}
  const thread=this.#threadContexts().find(context=>context.threadId===id);
  if(thread){if(!this.#pendingOpenApplied){this.#selectedId='';this.#emptyMessage='บทสนทนานี้ยังไม่มีผลลัพธ์ที่บันทึกไว้';this.#query='';this.#agentFilter='';this.#typeFilter='';this.#search.value='';this.#selectedFileJobId=thread.jobId||'standalone';this.#selectedFileThreadId=thread.threadId;this.#fileSelectionManual=true;this.#pendingOpenApplied=true;}return true;}
  return false;
 }
 #render(){
  const agents=new Map(this.#results.map(result=>[result.agentId,result.agentName]));
  const agentOptions=[['','ทุก agent'],...Array.from(agents.entries()).sort((a,b)=>a[1].localeCompare(b[1],'th')).map(([id,name])=>[id,name])];
  const filterOptionsSignature=JSON.stringify(agentOptions);
  if(filterOptionsSignature!==this.#filterOptionsSignature){
   this.#filterOptionsSignature=filterOptionsSignature;
   this.#agentSelect.replaceChildren(...agentOptions.map(([value,label])=>{const option=make(this.#doc,'option',label);option.value=value;return option;}));
   this.#typeSelect.replaceChildren(...[['','ทุกประเภท'],...types.map(item=>[item.id,item.label])].map(([value,label])=>{const option=make(this.#doc,'option',label);option.value=value;return option;}));
  }
  if(this.#agentSelect.value!==this.#agentFilter)this.#agentSelect.value=this.#agentFilter;
  if(this.#typeSelect.value!==this.#typeFilter)this.#typeSelect.value=this.#typeFilter;
  const filtered=filterResults(this.#results,{query:this.#query,agentId:this.#agentFilter,type:this.#typeFilter});
  if(!filtered.some(result=>result.id===this.#selectedId))this.#selectedId=this.#emptyMessage?'':filtered[0]?.id||'';
  this.#clear.hidden=!(this.#query||this.#agentFilter||this.#typeFilter);
  this.#count.textContent=`${filtered.length} ผลงาน${this.#results.length!==filtered.length?` จาก ${this.#results.length} รายการ`:''}`;
  const listSignature=JSON.stringify([this.#query,this.#agentFilter,this.#typeFilter,this.#selectedId,filtered.map(result=>[result.id,result.workTitle,result.agentName,result.text,result.type.id,result.timestamp,result.status,result.truncated])]);
  if(listSignature!==this.#listSignature){
   this.#listSignature=listSignature;this.#list.replaceChildren();
   if(!this.#results.length){this.#list.append(make(this.#doc,'p','ยังไม่มีผลลัพธ์จากงานที่บันทึกไว้ เมื่อ agent ส่งผล ระบบจะแสดงที่นี่','results-empty'));}
   else if(!filtered.length){const empty=make(this.#doc,'div',undefined,'results-empty');empty.append(make(this.#doc,'p','ไม่พบผลงานตามตัวกรองนี้'));const clear=make(this.#doc,'button','ล้างตัวกรอง','results-clear-inline');clear.type='button';clear.onclick=()=>this.#clear.click();empty.append(clear);this.#list.append(empty);}
   else for(const result of filtered)this.#list.append(this.#resultButton(result));
  }
  const selected=this.#results.find(result=>result.id===this.#selectedId);
  if(selected&&!this.#fileSelectionManual){this.#selectedFileJobId=selected.jobId;this.#selectedFileThreadId=selected.threadId;}
  const inspectorSignature=selected?JSON.stringify([selected.id,selected.jobId,selected.workTitle,selected.agentName,selected.agentRole,selected.phase,selected.type.id,selected.text,selected.truncated]):'empty:'+this.#emptyMessage;
  if(inspectorSignature!==this.#inspectorSignature){this.#inspectorSignature=inspectorSignature;this.#renderInspector(selected);}
  else if(selected)this.#syncInspectorMetadata(selected);
  this.#renderFileBrowser();
 }
 #resultButton(result){
  const button=make(this.#doc,'button',undefined,'result-row');button.type='button';button.dataset.resultId=result.id;button.setAttribute('aria-pressed',String(result.id===this.#selectedId));
  const top=make(this.#doc,'span',undefined,'result-row-top');top.append(make(this.#doc,'strong',result.workTitle),make(this.#doc,'span',result.typeLabel,'result-type'));button.append(top);
  button.append(make(this.#doc,'span',`${result.agentName}${result.agentRole?' · '+result.agentRole:''}`,'result-agent'));
  button.append(make(this.#doc,'span',result.text.replace(/\s+/g,' ').trim().slice(0,190)+(result.text.length>190?'…':''),'result-snippet'));
  const time=make(this.#doc,'time',dateLabel(result.timestamp),'result-time');if(Number.isFinite(Date.parse(result.timestamp)))time.dateTime=result.timestamp;button.append(time);
  return button;
 }
 #renderInspector(result){
  disposeRichMessages(this.#inspector);this.#inspector.replaceChildren();
  if(!result){
   const empty=make(this.#doc,'div',undefined,'results-inspector-empty');empty.append(make(this.#doc,'span','RESULT INSPECTOR','results-eyebrow'),make(this.#doc,'h2',this.#emptyMessage||'เลือกผลงานเพื่อตรวจดู'),make(this.#doc,'p',this.#emptyMessage?'ผลจะปรากฏเมื่อมีข้อความบันทึกจากงานนี้ ไฟล์แนบของบทสนทนายังเปิดดูได้ทางซ้าย':'เลือกผลงานจากรายการเพื่ออ่านเนื้อหาและเปิดแหล่งที่มา'));this.#inspector.append(empty);return;
  }
  const heading=make(this.#doc,'header',undefined,'result-detail-heading');heading.append(make(this.#doc,'p',result.typeLabel.toUpperCase(),'results-eyebrow'),make(this.#doc,'h2',result.workTitle),make(this.#doc,'p',`${result.agentName}${result.agentRole?' · '+result.agentRole:''} · ${result.phase}`,'result-detail-byline'));
  const provenance=make(this.#doc,'dl',undefined,'result-provenance');
  for(const [key,label,value] of [['work','งาน',result.workTitle],['agent','Agent',`${result.agentName}${result.agentRole?' · '+result.agentRole:''}`],['thread','บทสนทนา',result.threadId],['status','สถานะ',statusLabel(result.status)],['timestamp','อัปเดตงาน',dateLabel(result.timestamp)],['format','รูปแบบ',result.format]]){const dd=make(this.#doc,'dd',value);dd.dataset.provenance=key;provenance.append(make(this.#doc,'dt',label),dd);}
  const actions=make(this.#doc,'div',undefined,'result-actions');
  const download=make(this.#doc,'button','ดาวน์โหลดข้อความ (.md)','results-download');download.type='button';download.onclick=()=>this.#download(result);actions.append(download);
  const work=make(this.#doc,'button','เปิดงาน','results-secondary');work.type='button';work.onclick=()=>this.#options.onOpenWork(result.jobId);actions.append(work);
  const chat=make(this.#doc,'button','เปิดแชทต้นทาง','results-secondary');chat.type='button';chat.onclick=()=>this.#options.onOpenChat(result.threadId,result.agentName);actions.append(chat);
  this.#inspector.append(heading,provenance,actions);
  if(result.truncated)this.#inspector.append(make(this.#doc,'p','ข้อความผลลัพธ์นี้ถูกย่อก่อนบันทึก ดาวน์โหลดได้เฉพาะข้อความที่บันทึกไว้','results-truncated'));
  const body=make(this.#doc,'section',undefined,'result-rendered-body');body.setAttribute('aria-label','เนื้อหาผลงาน');this.#inspector.append(body);renderRichMessage(body,result.text);
 }
 #download(result){
  try{const url=URL.createObjectURL(new Blob([result.text],{type:'text/markdown;charset=utf-8'}));const link=make(this.#doc,'a');link.href=url;link.download=safeResultFilename(result.workTitle,result.agentId);link.hidden=true;this.#root.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch{this.#options.toast('ดาวน์โหลดผลงานไม่สำเร็จ');}
 }
 #syncInspectorMetadata(result){
  const values={work:result.workTitle,agent:`${result.agentName}${result.agentRole?' · '+result.agentRole:''}`,thread:result.threadId,status:statusLabel(result.status),timestamp:dateLabel(result.timestamp),format:result.format};
  for(const node of this.#inspector.querySelectorAll('[data-provenance]'))node.textContent=values[node.dataset.provenance]||'';
 }
 #threadContexts(){
  return collectThreadContexts(this.#jobs,this.#sessions,this.#agents);
 }
 #renderFileBrowser(){
  const contexts=this.#threadContexts();
  const groups=new Map();
  for(const context of contexts){const key=context.jobId||'standalone';if(!groups.has(key))groups.set(key,{id:key,label:context.jobId?context.workTitle:'บทสนทนาจาก T3'});}
  const groupOptions=Array.from(groups.values());
  if(!groups.has(this.#selectedFileJobId))this.#selectedFileJobId=groupOptions[0]?.id||'';
  const selectedContexts=contexts.filter(context=>(context.jobId||'standalone')===this.#selectedFileJobId);
  if(!selectedContexts.some(context=>context.threadId===this.#selectedFileThreadId))this.#selectedFileThreadId=selectedContexts[0]?.threadId||'';
  const optionsSignature=JSON.stringify([groupOptions,selectedContexts.map(context=>[context.threadId,context.agentName,context.phase])]);
  if(optionsSignature!==this.#fileOptionsSignature){
   this.#fileOptionsSignature=optionsSignature;
   this.#fileJobSelect.replaceChildren(...(groupOptions.length?groupOptions.map(group=>{const option=make(this.#doc,'option',group.label);option.value=group.id;return option;}):[make(this.#doc,'option','ไม่มีงานหรือบทสนทนา','') ]));
   this.#fileThreadSelect.replaceChildren(...(selectedContexts.length?selectedContexts.map(context=>{const option=make(this.#doc,'option',`${context.agentName} · ${context.phase}`);option.value=context.threadId;return option;}):[make(this.#doc,'option','ไม่มีบทสนทนาที่เปิดดูไฟล์ได้','')]));
  }
  if(this.#fileJobSelect.value!==this.#selectedFileJobId)this.#fileJobSelect.value=this.#selectedFileJobId;
  if(this.#fileThreadSelect.value!==this.#selectedFileThreadId)this.#fileThreadSelect.value=this.#selectedFileThreadId;
  if(!this.#selectedFileThreadId){if(this.#fileListSignature!=='none'){this.#fileListSignature='none';this.#fileSlot.replaceChildren(make(this.#doc,'p','ไม่มีบทสนทนาที่บันทึกไฟล์ไว้','results-file-state'));}return;}
  const context=selectedContexts.find(item=>item.threadId===this.#selectedFileThreadId);
  const cached=this.#fileCache.get(this.#selectedFileThreadId);
  const fileListSignature=JSON.stringify([this.#selectedFileThreadId,cached?.status,cached?.message,cached?.files?.map(file=>[file.id,file.name,file.sizeBytes,file.createdAt])]);
  if(fileListSignature!==this.#fileListSignature){this.#fileListSignature=fileListSignature;this.#renderFiles(context||{threadId:this.#selectedFileThreadId},this.#fileSlot,this.#selectedFileThreadId);}
 }
 #renderFiles(context,slot,threadId){
  const cached=this.#fileCache.get(threadId);slot.replaceChildren();
  if(!cached||cached.status==='loading'){
   slot.append(make(this.#doc,'p',cached?'กำลังโหลดรายการไฟล์…':'ตรวจรายการไฟล์ในบทสนทนา…','results-file-state'));
   if(!cached)this.#loadFiles(threadId);
   return;
  }
  if(cached.status==='error'){
   slot.append(make(this.#doc,'p',cached.message||'โหลดไฟล์ไม่สำเร็จ','results-file-error'));const retry=make(this.#doc,'button','ลองอีกครั้ง','results-secondary');retry.type='button';retry.onclick=()=>this.#loadFiles(threadId,true);slot.append(retry);return;
  }
  const refresh=make(this.#doc,'button','รีเฟรชรายการ','results-refresh');refresh.type='button';refresh.onclick=()=>this.#loadFiles(threadId,true);slot.append(refresh);
  if(!cached.files.length){slot.append(make(this.#doc,'p','ไม่มีไฟล์แนบที่บันทึกไว้ในบทสนทนานี้','results-file-state'));return;}
  const list=make(this.#doc,'ul',undefined,'result-file-list');
  for(const file of cached.files){if(!isUuid(file.id)||typeof file.name!=='string')continue;const item=make(this.#doc,'li');const link=make(this.#doc,'a',file.name);link.href=`/api/result-files/${encodeURIComponent(threadId)}/${encodeURIComponent(file.id)}/download`;link.download=safeAttachmentFilename(file.name);item.append(link,make(this.#doc,'small',`${fileSize(file.sizeBytes)} · ${dateLabel(file.createdAt)}`));list.append(item);}
  slot.append(list);
 }
 async #loadFiles(threadId,force=false){
  if(!isUuid(threadId)||typeof this.#options.fetchImpl!=='function'){
   this.#fileCache.set(threadId,{status:'error',message:'ไม่สามารถเชื่อมต่อรายการไฟล์ได้'});return;
  }
  if(!force&&this.#fileCache.has(threadId))return;
  this.#fileCache.set(threadId,{status:'loading'});
  if(this.#selectedFileThreadId===threadId)this.#renderFileBrowser();
  try{
   const response=await this.#options.fetchImpl(`/api/result-files?threadId=${encodeURIComponent(threadId)}`,{headers:{accept:'application/json'},signal:AbortSignal.timeout?.(15000)});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'โหลดไฟล์ไม่สำเร็จ');
   const files=Array.isArray(data.files)?data.files.filter(file=>file&&isUuid(file.id)&&typeof file.name==='string'&&Number.isFinite(file.sizeBytes)).slice(0,100):[];
   this.#fileCache.set(threadId,{status:'ready',files});
  }catch(error){this.#fileCache.set(threadId,{status:'error',message:error?.message||'โหลดไฟล์ไม่สำเร็จ'});}
  if(this.#selectedFileThreadId===threadId)this.#renderFileBrowser();
 }
}
