import {profiles,profileById} from './agent-profiles.js';
import {renderRichMessage,disposeRichMessages} from './rich-content.js';

const providerLabels={queued:'รอเริ่ม',running:'กำลังทำงาน',waiting:'รอข้อมูล',done:'เสร็จแล้ว',error:'มีข้อผิดพลาด',cancelled:'ยกเลิกแล้ว'};
const reviewLabels={pending:'รอตรวจรับ',accepted:'ตรวจรับแล้ว',changes_requested:'ต้องแก้ไข'};
const reviewStates=new Set(['pending','accepted','changes_requested']);
const text=(tag,value,cls)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=value;if(cls)node.className=cls;return node;};
const button=(label,cls,action)=>{const node=text('button',label,cls);node.type='button';if(action)node.addEventListener('click',action);return node;};
const assignedIds=job=>{
 const ids=Array.isArray(job.agentIds)?job.agentIds:(Array.isArray(job.steps)?job.steps.map(step=>step.agentId):[]);
 return [...new Set(ids.filter(id=>typeof id==='string'&&id))];
};
const ownerIds=job=>typeof job.ownerId==='string'&&job.ownerId?[job.ownerId]:assignedIds(job);
const normalizeReview=(jobId,review)=>({jobId,dueDate:typeof review?.dueDate==='string'?review.dueDate:'',acceptance:typeof review?.acceptance==='string'?review.acceptance:'',reviewStatus:reviewStates.has(review?.reviewStatus)?review.reviewStatus:'pending',note:typeof review?.note==='string'?review.note:'',updatedAt:typeof review?.updatedAt==='string'?review.updatedAt:null});
const normalizeReviews=reviews=>{
 const result=new Map();
 if(reviews instanceof Map){for(const [id,review] of reviews)result.set(id,normalizeReview(id,review));}
 else if(Array.isArray(reviews)){for(const review of reviews)if(review?.jobId)result.set(review.jobId,normalizeReview(review.jobId,review));}
 else if(reviews&&typeof reviews==='object'){for(const [id,review] of Object.entries(reviews))result.set(id,normalizeReview(id,review));}
 return result;
};
const isDemo=options=>typeof options.isDemo==='function'?!!options.isDemo():!!options.isDemo;
const dateLabel=value=>{
 if(!value)return'ยังไม่กำหนด';
 const date=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'UTC'}).format(date):value;
};
const dateTime=value=>{
 if(!value)return'ไม่ทราบเวลา';
 const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(date):value;
};

export class WorkView{
 #dataState='loading';
 #root;#options;#jobs=[];#agents=new Map();#reviews=new Map();#filters={status:'all',owner:'all',type:'all'};#selectedJob=null;#pendingJobId=null;#detailOpen=false;#listSignature='';#ownerSignature='';#inspectorSignature='';#detailSignatures={};#listScrollTop=0;#drafts=new Map();#saving=new Set();#list;#listRegion;#statusFilter;#ownerFilter;#typeFilter;#inspector;#detail;#grid;#reviewSection=null;#evidenceList=null;#reviewFeedback=null;

 constructor(root,{onOpenChat=()=>{},onCreateTask=()=>{},onOpenResults=()=>{},onReviewChange=()=>{},onSelectionChange=()=>{},toast=()=>{},refresh=()=>{},isDemo=false}={}){
  this.#root=root;this.#options={onOpenChat,onCreateTask,onOpenResults,onReviewChange,onSelectionChange,toast,refresh,isDemo};
  this.#build();
 }

 #build(){
  this.#root.replaceChildren();
  const workspace=text('div',undefined,'work-workspace');
  this.#grid=text('div',undefined,'work-grid');
  const listPanel=text('section',undefined,'work-list-panel');listPanel.setAttribute('aria-labelledby','work-list-heading');
  const listHeading=text('div',undefined,'work-list-heading');listHeading.append(text('h2','รายการงาน',''));listHeading.firstElementChild.id='work-list-heading';
  listHeading.append(text('p','ดูผู้รับผิดชอบ สถานะ และงานที่ต้องตรวจต่อ',''));
  this.#statusFilter=this.#makeFilter('status','สถานะ');
  this.#ownerFilter=this.#makeFilter('owner','ผู้รับผิดชอบ');
  this.#typeFilter=this.#makeFilter('type','ประเภทงาน');
  const filters=text('div',undefined,'work-filters');filters.append(this.#statusFilter.label,this.#ownerFilter.label,this.#typeFilter.label);
  this.#statusFilter.select.addEventListener('change',()=>this.#setFilter('status',this.#statusFilter.select.value));
  this.#ownerFilter.select.addEventListener('change',()=>this.#setFilter('owner',this.#ownerFilter.select.value));
  this.#typeFilter.select.addEventListener('change',()=>this.#setFilter('type',this.#typeFilter.select.value));
  this.#listRegion=text('div',undefined,'work-list-region');this.#listRegion.tabIndex=0;this.#listRegion.setAttribute('role','region');this.#listRegion.setAttribute('aria-label','รายการงานของทีม');
  this.#list=text('div',undefined,'work-list');this.#listRegion.append(this.#list);
  listPanel.append(listHeading,filters,this.#listRegion);
  this.#inspector=text('aside',undefined,'work-inspector');this.#inspector.setAttribute('aria-label','รายละเอียดงานที่เลือก');
  this.#detail=text('section',undefined,'work-detail');this.#detail.hidden=true;this.#detail.setAttribute('aria-labelledby','work-detail-title');
  this.#grid.append(listPanel,this.#inspector,this.#detail);workspace.append(this.#grid);this.#root.append(workspace);
 }

 #makeFilter(name,label){
  const wrap=text('label',undefined,'work-filter');wrap.append(text('span',label));
  const select=document.createElement('select');select.dataset.filter=name;select.setAttribute('aria-label',label);wrap.append(select);return{label:wrap,select};
 }

 update({jobs=[],agents=[],reviews={},dataState='ready'}={}){
  this.#dataState=dataState;
  this.#jobs=Array.isArray(jobs)?jobs:[];this.#agents=this.#normalizeAgents(agents);this.#reviews=normalizeReviews(reviews);
  for(const [jobId,draft] of this.#drafts){
   if(!draft.dirty)continue;
   const latest=this.#reviews.get(jobId)||normalizeReview(jobId);
   if(draft.baseUpdatedAt!==latest.updatedAt)draft.conflict=true;
  }
  if(this.#pendingJobId){
   const pending=this.#jobs.find(job=>job.id===this.#pendingJobId);
   if(pending){this.#selectedJob=pending.id;this.#detailOpen=true;this.#pendingJobId=null;if(!this.#matches(pending))this.#filters={status:'all',owner:'all',type:'all'};}
  }
  if(this.#selectedJob&&!this.#jobs.some(job=>job.id===this.#selectedJob)&&!this.#pendingJobId){this.#selectedJob=null;this.#detailOpen=false;}
  if(!this.#selectedJob&&this.#jobs.length)this.#selectedJob=this.#jobs[0].id;
  this.#syncFilterOptions();this.#renderList();this.#renderInspector();this.#renderDetail();
 }

 open(jobId){
  if(typeof jobId!=='string'||!jobId)return false;
  this.#options.onSelectionChange(jobId);
  const job=this.#jobs.find(item=>item.id===jobId);
  this.#selectedJob=jobId;this.#detailOpen=true;
  if(job){this.#pendingJobId=null;if(!this.#matches(job))this.#filters={status:'all',owner:'all',type:'all'};}
  else this.#pendingJobId=jobId;
  this.#syncFilterControls();this.#renderList(true);this.#renderInspector(true);this.#renderDetail(true);
  return !!job;
 }

 destroy(){
  disposeRichMessages(this.#root);this.#root.replaceChildren();this.#drafts.clear();this.#saving.clear();
 }

 #normalizeAgents(agents){
  const values=agents instanceof Map?[...agents.values()]:Array.isArray(agents)?agents:agents&&typeof agents==='object'?Object.values(agents):[];
  const result=new Map(profiles.map(profile=>[profile.id,profile]));
  for(const agent of values)if(agent&&typeof agent.id==='string')result.set(agent.id,{...result.get(agent.id),...agent});
  return result;
 }
 #agentName(id){return this.#agents.get(id)?.name||profileById(id)?.name||id;}
 #agentRole(id){return this.#agents.get(id)?.role||profileById(id)?.role||'';}
 #jobOwners(job){return ownerIds(job).map(id=>({id,name:this.#agentName(id)}));}
 #review(jobId){return this.#reviews.get(jobId)||normalizeReview(jobId);}
 #job(jobId=this.#selectedJob){return this.#jobs.find(job=>job.id===jobId)||null;}
 #workStatus(job,review=this.#review(job.id)){
  if(job.status==='done')return review.reviewStatus==='pending'?'ready':review.reviewStatus;
  if(job.status==='queued'||job.status==='running')return'active';
  return job.status||'unknown';
 }
 #statusText(job,review=this.#review(job.id)){
  if(job.status==='done')return review.reviewStatus==='pending'?'พร้อมตรวจ':reviewLabels[review.reviewStatus]||'พร้อมตรวจ';
  return providerLabels[job.status]||'ไม่ทราบสถานะ';
 }
 #reviewText(job,review){return review.reviewStatus==='pending'?(job.status==='done'?'พร้อมตรวจ':'รอตรวจเมื่อ T3 เสร็จ'):reviewLabels[review.reviewStatus]||reviewLabels.pending;}
 #providerText(job){return providerLabels[job.status]||'ไม่ทราบสถานะ';}
 #matches(job){
  if(this.#filters.type==='team'&&!job.team)return false;
  if(this.#filters.type==='solo'&&job.team)return false;
  if(this.#filters.owner!=='all'&&!ownerIds(job).includes(this.#filters.owner))return false;
  const review=this.#review(job.id),status=this.#workStatus(job,review);
  switch(this.#filters.status){
   case'all':return true;
   case'active':return status==='active';
   case'waiting':return job.status==='waiting';
   case'ready':return status==='ready';
   case'accepted':return status==='accepted';
   case'changes_requested':return status==='changes_requested';
   case'error':return job.status==='error';
   case'cancelled':return job.status==='cancelled';
   default:return true;
  }
 }
 #filteredJobs(){return this.#jobs.filter(job=>this.#matches(job));}

 #syncFilterOptions(){
  const owners=new Map();for(const job of this.#jobs)for(const owner of this.#jobOwners(job))owners.set(owner.id,owner.name);
  const signature=JSON.stringify([...owners].sort(([a],[b])=>a.localeCompare(b)));
  if(signature!==this.#ownerSignature){
   this.#ownerSignature=signature;const select=this.#ownerFilter.select;select.replaceChildren(new Option('ทุกคน','all'));
   for(const[id,name]of [...owners].sort((a,b)=>a[1].localeCompare(b[1])))select.add(new Option(name,id));
  }
  this.#statusFilter.select.replaceChildren(...[
   ['all','ทุกสถานะ'],['active','กำลังทำ / รอเริ่ม'],['waiting','รอข้อมูล'],['ready','พร้อมตรวจ'],['accepted','ตรวจรับแล้ว'],['changes_requested','ต้องแก้'],['error','มีข้อผิดพลาด'],['cancelled','ยกเลิก']
  ].map(([value,label])=>new Option(label,value)));
  this.#typeFilter.select.replaceChildren(...[['all','ทุกประเภท'],['solo','งานเดี่ยว'],['team','งานทีม']].map(([value,label])=>new Option(label,value)));
  this.#syncFilterControls();
 }
 #syncFilterControls(){
  if(!this.#statusFilter)return;
  this.#statusFilter.select.value=this.#filters.status;this.#ownerFilter.select.value=this.#filters.owner;this.#typeFilter.select.value=this.#filters.type;
 }
 #setFilter(name,value){
  if(this.#pendingJobId){this.back();}
  this.#filters={...this.#filters,[name]:value};this.#listScrollTop=0;this.#listRegion.scrollTop=0;
  const visible=this.#filteredJobs();
  if(this.#selectedJob&&!visible.some(job=>job.id===this.#selectedJob))this.#selectedJob=visible[0]?.id||null;
  this.#syncFilterControls();this.#renderList(true);this.#renderInspector(true);
  if(this.#detailOpen){if(!this.#selectedJob)this.#detailOpen=false;this.#pendingJobId=null;this.#renderDetail(true);this.#options.onSelectionChange(this.#detailOpen?this.#selectedJob:null);}
 }

 #renderList(force=false){
  const jobs=this.#filteredJobs();
  const signature=JSON.stringify([jobs.map(job=>{const review=this.#review(job.id);return[job.id,job.title,job.status,job.team,ownerIds(job),review.dueDate,review.reviewStatus,job.cancelRequested];}),this.#selectedJob]);
  if(!force&&signature===this.#listSignature)return;
  const oldScroll=this.#listRegion.scrollTop;this.#listSignature=signature;this.#list.replaceChildren();
  if(!jobs.length){
   const empty=text('div',undefined,'work-empty');
   if(!this.#jobs.length){empty.append(text('strong','ยังไม่มีงานของทีม'),text('p','เมื่อส่งงาน งานและผลลัพธ์จาก agent จะแสดงที่นี่'));const create=button('สร้างงานใหม่','primary-button',()=>this.#options.onCreateTask());empty.append(create);}
   else{empty.append(text('strong','ไม่พบงานตามตัวกรอง'),text('p','ลองเปลี่ยนตัวกรองเพื่อดูงานอื่น'));empty.append(button('ล้างตัวกรอง','secondary-button',()=>{this.#filters={status:'all',owner:'all',type:'all'};this.#selectedJob=this.#jobs[0]?.id||null;this.#syncFilterControls();this.#renderList(true);this.#renderInspector(true);}));}
   this.#list.append(empty);
  }else for(const job of jobs)this.#list.append(this.#jobRow(job));
  this.#listRegion.scrollTop=this.#listScrollTop||oldScroll;
 }

 #jobRow(job){
  const review=this.#review(job.id),owners=this.#jobOwners(job),row=button('',`work-row${job.id===this.#selectedJob?' is-selected':''}`,()=>{
   this.#listScrollTop=this.#listRegion.scrollTop;this.#selectedJob=job.id;this.#options.onSelectionChange(job.id);this.#renderList(true);this.#renderInspector(true);
   if(this.#isCompact())this.open(job.id);
  });
  row.setAttribute('aria-pressed',job.id===this.#selectedJob?'true':'false');row.dataset.jobId=job.id;
  const heading=text('span',undefined,'work-row-heading');heading.append(text('strong',job.title||'งานไม่มีชื่อ'));
  const category=text('span',job.team?'ทีม':'เดี่ยว','work-row-type');heading.append(category);
  const status=text('span',this.#statusText(job,review),`work-status-tag status-${this.#workStatus(job,review)}`);
  const detail=text('span',`${owners.map(owner=>owner.name).join(', ')||'ยังไม่ระบุผู้รับผิดชอบ'} · ${this.#providerText(job)} · กำหนดส่ง ${dateLabel(review.dueDate)}`,'work-row-meta');
  const rowBottom=text('span',undefined,'work-row-bottom');rowBottom.append(status,detail);row.append(heading,rowBottom);
  return row;
 }

 #renderInspector(force=false){
  const job=this.#job(),review=job?this.#review(job.id):null;
  const signature=job?JSON.stringify([job,review]):'none';
  if(!force&&signature===this.#inspectorSignature)return;this.#inspectorSignature=signature;this.#inspector.replaceChildren();
  if(!job){const empty=text('div',undefined,'work-inspector-empty');empty.append(text('span','WORK DETAILS','eyebrow'),text('h2','เลือกงานเพื่อตรวจดู'),text('p','ผู้รับผิดชอบ กำหนดส่ง และผลงานจะแสดงที่นี่'));this.#inspector.append(empty);return;}
  this.#inspector.append(this.#summaryBlock(job,review,'inspector'));
  this.#inspector.append(this.#acceptancePreview(review));
  this.#inspector.append(this.#evidencePreview(job));
  const actions=text('div',undefined,'work-inspector-actions');
  actions.append(button('เปิดรายละเอียดเต็ม','primary-button',()=>this.open(job.id)));
  if(typeof this.#options.onOpenResults==='function'&&this.#hasEvidence(job))actions.append(button('เปิดผลงาน','secondary-button',()=>this.#options.onOpenResults(job.id)));
  this.#inspector.append(actions);
  this.#appendChatLinks(this.#inspector,job,'บทสนทนาที่เกี่ยวข้อง');
 }

 #summaryBlock(job,review,kind){
  const block=text('section',undefined,`work-summary work-summary-${kind}`);
  const heading=text('div',undefined,'work-summary-heading');heading.append(text('span','OWNER / NEXT ACTION','eyebrow'),text('h2',job.title||'งานไม่มีชื่อ'));
  if(kind==='detail')heading.querySelector('h2').id='work-detail-title';
  const statuses=text('div',undefined,'work-statuses');statuses.append(text('span',`T3 · ${this.#providerText(job)}`,'work-status-tag'),text('span',`ตรวจรับ · ${this.#statusText(job,review)}`,`work-review-tag status-${this.#workStatus(job,review)}`));
  const ownerNames=this.#jobOwners(job).map(owner=>owner.name).join(', ')||'ยังไม่ระบุ';
  const list=text('dl',undefined,'work-facts');
  this.#fact(list,'ผู้รับผิดชอบ',ownerNames);
  this.#fact(list,'กำหนดส่ง',dateLabel(review.dueDate));
  this.#fact(list,'สถานะจาก T3',this.#providerText(job));
  this.#fact(list,'Blocker',this.#blocker(job));
  block.append(heading,statuses,list);
  if(kind==='detail'&&job.brief)block.append(text('p',job.brief,'work-brief'));
  if(!['done','error','cancelled'].includes(job.status)){
   const cancel=button(job.cancelRequested?'กำลังขอหยุดงาน':'หยุดงานนี้','secondary-button danger-text',()=>void this.#cancelJob(job));
   cancel.dataset.workCancel=job.id;cancel.disabled=job.cancelRequested||isDemo(this.#options);block.append(cancel);
  }
  return block;
 }
 async #cancelJob(job){
  if(job.cancelRequested||isDemo(this.#options))return;
  const controls=[...this.#root.querySelectorAll('[data-work-cancel]')].filter(node=>node.dataset.workCancel===job.id);controls.forEach(node=>node.disabled=true);
  try{const response=await fetch(officeApiUrl('jobs/'+encodeURIComponent(job.id)+'/cancel'),{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'ขอหยุดงานไม่สำเร็จ');
   if(data.job?.id===job.id)Object.assign(job,data.job);this.#options.toast(job.cancelRequested?'ขอหยุดงานแล้ว รอ T3 รับคำสั่ง':'งานนี้สิ้นสุดแล้ว');this.#renderList(true);this.#renderInspector(true);this.#renderDetail(true);void this.#options.refresh();
  }catch(error){this.#options.toast(error.message||'ขอหยุดงานไม่สำเร็จ');controls.forEach(node=>node.disabled=false);}
 }
 #fact(list,label,value){list.append(text('dt',label),text('dd',value));}
 #blocker(job){
  if(typeof job.blocker==='string'&&job.blocker.trim())return job.blocker.trim();
  if(job.runnerError)return String(job.runnerError);
  if(job.cancelRequested&&job.status!=='cancelled')return'กำลังรอ T3 รับคำสั่งหยุดงาน';
  if(job.status==='waiting')return'งานกำลังรอข้อมูลหรือการอนุมัติใน T3';
  return'ไม่มี blocker ที่ระบบงานรายงาน';
 }
 #acceptancePreview(review){
  const section=text('section',undefined,'work-preview-block');section.append(text('h3','เกณฑ์ตรวจรับ'));
  section.append(text('p',review.acceptance||'ยังไม่ได้ระบุเกณฑ์ตรวจรับ','work-preview-copy'));return section;
 }
 #evidencePreview(job){
  const sections=(job.steps||[]).filter(step=>typeof step.result==='string'&&step.result.trim());
  const block=text('section',undefined,'work-preview-block');block.append(text('h3','ผลงานและหลักฐาน'));
  block.append(text('p',sections.length?`${sections.length} ส่วนส่งผลลัพธ์แล้ว`:'ยังไม่มีผลลัพธ์จาก agent','work-preview-copy'));return block;
 }

 #renderDetail(force=false){
  const job=this.#job();
  this.#grid.classList.toggle('detail-open',this.#detailOpen);
  if(!this.#detailOpen){this.#detail.hidden=true;return;}
  this.#detail.hidden=false;
  if(!job){
   const pendingState=`${this.#pendingJobId}:${this.#dataState}`;
   if(this.#detail.dataset.pendingId===pendingState)return;
   disposeRichMessages(this.#detail);this.#detail.replaceChildren();this.#detail.dataset.pendingId=pendingState;delete this.#detail.dataset.jobId;
   this.#reviewSection=null;this.#evidenceList=null;this.#reviewFeedback=null;
   const message=this.#dataState==='ready'?'ไม่พบงานนี้ในข้อมูลล่าสุด · กลับไปเลือกรายการงานหรือลองใหม่':this.#dataState==='unavailable'?'ยังตรวจสอบงานนี้ไม่ได้ · แหล่งข้อมูลยังไม่พร้อม':'กำลังโหลดรายละเอียดงาน…';
   const title=text('h2',message,'work-loading');title.id='work-detail-title';title.setAttribute('role','status');
   const retry=button('ลองโหลดงานอีกครั้ง','secondary-button',()=>{if(!isDemo(this.#options))void this.#options.refresh();});retry.dataset.retryWork='';retry.disabled=isDemo(this.#options);
   this.#detail.append(button('← กลับไปงาน','work-back',()=>this.back()),title,retry);return;
  }
  const review=this.#review(job.id),jobSignature=JSON.stringify([job.id,job.title,job.brief,job.status,job.runnerError,job.blocker,job.cancelRequested,job.createdAt,job.updatedAt,ownerIds(job)]),reviewSignature=JSON.stringify(review),evidenceSignature=JSON.stringify((job.steps||[]).map(step=>[step.threadId,step.agentId,step.phase,step.status,step.result,step.resultTruncated]));
  const sameJob=this.#detail.dataset.jobId===job.id;
  const summaryChanged=!sameJob||this.#detailSignatures.job!==jobSignature;
  const reviewChanged=!sameJob||this.#detailSignatures.review!==reviewSignature;
  const evidenceChanged=!sameJob||this.#detailSignatures.evidence!==evidenceSignature;
  if(!force&&!summaryChanged&&!reviewChanged&&!evidenceChanged)return;

  const draft=this.#drafts.get(job.id);
  const reviewForm=this.#reviewSection&&sameJob&&!reviewChanged?this.#reviewSection:null;
  const evidenceList=this.#evidenceList&&sameJob&&!evidenceChanged?this.#evidenceList:null;
  const priorFeedback=sameJob?this.#reviewFeedback?.textContent||'':'';
  if(!evidenceList)disposeRichMessages(this.#evidenceList||this.#detail);
  this.#detail.replaceChildren();this.#detail.dataset.jobId=job.id;delete this.#detail.dataset.pendingId;
  const head=text('div',undefined,'work-detail-top');head.append(button('← กลับไปงาน','work-back',()=>this.back()),text('span','WORK DETAIL','eyebrow'));
  this.#detail.append(head,this.#summaryBlock(job,review,'detail'));

  this.#reviewSection=reviewForm||this.#makeReviewSection(job,review,draft);
  this.#detail.append(this.#reviewSection);
  this.#reviewFeedback=this.#reviewSection.querySelector('[data-review-feedback]');
  if(priorFeedback&&!this.#reviewFeedback.textContent)this.#reviewFeedback.textContent=priorFeedback;
  this.#updateReviewControls(job);

  const evidence=text('section',undefined,'work-evidence-section');
  const evidenceHead=text('div',undefined,'work-evidence-heading');evidenceHead.append(text('div',undefined,''));evidenceHead.firstElementChild.append(text('h3','ผลงานและหลักฐาน'),text('p','ผลลัพธ์จากแต่ละขั้นของงานนี้'));
  if(typeof this.#options.onOpenResults==='function'&&this.#hasEvidence(job))evidenceHead.append(button('เปิดผลงาน','secondary-button',()=>this.#options.onOpenResults(job.id)));
  this.#evidenceList=evidenceList||this.#renderEvidenceList(job);evidence.append(evidenceHead,this.#evidenceList);this.#detail.append(evidence);
  this.#appendChatLinks(this.#detail,job,'บทสนทนาของงาน');
  const activity=text('section',undefined,'work-activity');activity.append(text('h3','กิจกรรม'));activity.append(text('p',`สร้างเมื่อ ${dateTime(job.createdAt)} · อัปเดตจาก T3 ${dateTime(job.updatedAt)}`));this.#detail.append(activity);
  this.#detailSignatures={job:jobSignature,review:reviewSignature,evidence:evidenceSignature};
 }

 #makeReviewSection(job,review,draft){
  const section=text('section',undefined,'work-review-panel');section.setAttribute('aria-labelledby','work-review-heading');
  const heading=text('div',undefined,'work-review-heading');heading.append(text('span','HUMAN REVIEW','eyebrow'),text('h3','ตรวจรับงาน'));heading.children[1].id='work-review-heading';
  const state=text('p',`สถานะจาก T3: ${this.#providerText(job)} · การตรวจรับ: ${this.#reviewText(job,review)}`,'work-review-context');
  const help=text('p','สถานะการตรวจบันทึกในบริการพื้นที่ทำงาน · แยกจากสถานะผู้ให้บริการ · เปิดแชทต้นทางเพื่อส่งรายละเอียดที่ต้องแก้','work-review-help');
  const form=text('div',undefined,'work-review-fields');
  const dueLabel=text('label',undefined,'work-field');dueLabel.append(text('span','กำหนดส่ง'));
  const due=document.createElement('input');due.type='date';due.value=draft?.dueDate??review.dueDate;due.dataset.dueDate='';due.setAttribute('aria-label','กำหนดส่ง');dueLabel.append(due);
  const acceptanceLabel=text('label',undefined,'work-field');acceptanceLabel.append(text('span','เกณฑ์ตรวจรับ'));
  const acceptance=document.createElement('textarea');acceptance.rows=4;acceptance.maxLength=4000;acceptance.value=draft?.acceptance??review.acceptance;acceptance.dataset.acceptance='';acceptance.setAttribute('aria-label','เกณฑ์ตรวจรับ');acceptance.placeholder='ระบุว่าผลงานต้องมีอะไรบ้างก่อนตรวจรับ';acceptanceLabel.append(acceptance);
  const noteLabel=text('label',undefined,'work-field');noteLabel.append(text('span','บันทึกการตรวจ'));
  const note=document.createElement('textarea');note.rows=3;note.maxLength=2000;note.value=draft?.note??review.note;note.dataset.reviewNote='';note.setAttribute('aria-label','บันทึกการตรวจ');note.placeholder='บันทึกเหตุผลหรือสิ่งที่ต้องแก้';noteLabel.append(note);
  form.append(dueLabel,acceptanceLabel,noteLabel);section.append(heading,state,form);
  const conflict=text('p','ข้อมูลตรวจรับเปลี่ยนจากอีกหน้าต่างหนึ่ง ตรวจทานก่อนบันทึก','work-review-conflict');conflict.dataset.reviewConflict='';conflict.hidden=!draft?.conflict;
  const feedback=text('p','', 'work-review-feedback');feedback.dataset.reviewFeedback='';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  const actions=text('div',undefined,'work-review-actions');
  const save=button('บันทึกรายละเอียด','secondary-button',()=>void this.#saveReview(job,'metadata'));save.dataset.saveReview='';
  const accept=button('ยอมรับผลงาน','primary-button',()=>void this.#saveReview(job,'accepted'));accept.dataset.acceptReview='';
  const changes=button('บันทึกว่าต้องแก้','secondary-button',()=>void this.#saveReview(job,'changes_requested'));changes.dataset.requestChanges='';
  actions.append(save,accept,changes);section.append(help,conflict,feedback,actions);
  const mark=()=>this.#captureDraft(job,review);
  due.addEventListener('input',mark);acceptance.addEventListener('input',mark);note.addEventListener('input',mark);
  const useLatest=button('โหลดข้อมูลล่าสุด','text-button',()=>{this.#drafts.delete(job.id);this.#reviewSection=null;this.#renderDetail(true);});useLatest.dataset.useLatest='';useLatest.hidden=!draft?.conflict;section.append(useLatest);
  return section;
 }

 #captureDraft(job,baseReview){
  const section=this.#reviewSection;if(!section)return;
  const values={dueDate:section.querySelector('[data-due-date]').value,acceptance:section.querySelector('[data-acceptance]').value,note:section.querySelector('[data-review-note]').value};
  const base=normalizeReview(job.id,baseReview),dirty=values.dueDate!==base.dueDate||values.acceptance!==base.acceptance||values.note!==base.note;
  const current=this.#drafts.get(job.id);
  this.#drafts.set(job.id,{...values,dirty,conflict:!!current?.conflict,baseUpdatedAt:current?.baseUpdatedAt??base.updatedAt});
  const conflict=section.querySelector('[data-review-conflict]');if(conflict)conflict.hidden=!current?.conflict;
  const latest=section.querySelector('[data-use-latest]');if(latest)latest.hidden=!current?.conflict;
 }

 #updateReviewControls(job){
  if(!this.#reviewSection)return;
  const done=job.status==='done',demo=isDemo(this.#options),saving=this.#saving.has(job.id),draft=this.#drafts.get(job.id);
  const conflict=!!draft?.conflict;
  this.#reviewSection.querySelector('[data-review-conflict]').hidden=!conflict;
  this.#reviewSection.querySelector('[data-use-latest]').hidden=!conflict;
  for(const selector of ['[data-save-review]','[data-accept-review]','[data-request-changes]']){
   const control=this.#reviewSection.querySelector(selector);if(!control)continue;
   control.disabled=demo||saving||conflict||(!done&&selector!=='[data-save-review]');
  }
  const save=this.#reviewSection.querySelector('[data-save-review]');if(save)save.disabled=demo||saving||conflict;
  const accept=this.#reviewSection.querySelector('[data-accept-review]');if(accept){accept.disabled=demo||saving||conflict||!done;accept.title=done?'บันทึกการตรวจรับแยกจากสถานะของ T3':'ยอมรับได้เมื่อ T3 รายงานว่างานเสร็จแล้ว';}
  const changes=this.#reviewSection.querySelector('[data-request-changes]');if(changes)changes.disabled=demo||saving||conflict||!done;
  if(demo){const feedback=this.#reviewSection.querySelector('[data-review-feedback]');if(feedback&&!feedback.textContent)feedback.textContent='โหมดตัวอย่างเป็นแบบอ่านอย่างเดียว';}
 }

 async #saveReview(job,decision){
  const section=this.#reviewSection;if(!section||this.#saving.has(job.id))return;
  const review=this.#review(job.id),draft=this.#drafts.get(job.id);
  if(draft?.conflict){this.#reviewFeedback.textContent='โหลดข้อมูลล่าสุดก่อนบันทึก';return;}
  if(isDemo(this.#options)){this.#reviewFeedback.textContent='การตรวจรับใช้ได้เมื่อเชื่อมต่อ T3';return;}
  const dueDate=section.querySelector('[data-due-date]').value,acceptance=section.querySelector('[data-acceptance]').value,note=section.querySelector('[data-review-note]').value;
  const reviewStatus=decision==='metadata'?(job.status==='done'?review.reviewStatus:'pending'):decision;
  if(reviewStatus!=='pending'&&job.status!=='done'){this.#reviewFeedback.textContent='รอให้ T3 รายงานว่างานเสร็จก่อนตรวจรับ';return;}
  if(decision==='changes_requested'&&!note.trim()){this.#reviewFeedback.textContent='บันทึกว่าต้องแก้ต้องมีบันทึกการตรวจ';return;}
  if(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)){this.#reviewFeedback.textContent='กำหนดส่งต้องเป็นวันที่ที่ถูกต้อง';return;}
  this.#saving.add(job.id);this.#reviewFeedback.textContent='กำลังบันทึก…';this.#updateReviewControls(job);
  try{
   const baseUpdatedAt=draft?draft.baseUpdatedAt:review.updatedAt;
   const response=await fetch(officeApiUrl('work-reviews/'+encodeURIComponent(job.id)),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({jobId:job.id,dueDate,acceptance,reviewStatus,note,action:decision,baseUpdatedAt}),signal:AbortSignal.timeout(20000)});
   const data=await response.json();
   if(response.status===409&&data.code==='REVIEW_CONFLICT'){
    this.#drafts.set(job.id,{dueDate,acceptance,note,dirty:true,conflict:true,baseUpdatedAt});
    if(this.#job()?.id===job.id)this.#renderDetail(true);
    void this.#options.refresh();
   }
   if(!response.ok)throw new Error(data.error||'บันทึกการตรวจไม่สำเร็จ');
   if(decision==='changes_requested'&&(!data.handoff||!['queued','sent','done'].includes(data.handoff.status)))throw new Error('ยังยืนยันไม่ได้ว่ารายการแก้ไขถูกส่งเข้าคิวแชท');
   const saved=normalizeReview(job.id,data.review);this.#reviews.set(job.id,saved);this.#drafts.set(job.id,{dueDate:saved.dueDate,acceptance:saved.acceptance,note:saved.note,dirty:false,conflict:false,baseUpdatedAt:saved.updatedAt});
   this.#options.onReviewChange(saved);this.#options.toast(decision==='accepted'?'บันทึกการตรวจรับแล้ว':decision==='changes_requested'?data.handoff.status==='queued'?'บันทึกและส่งรายการแก้ไขเข้าแชทแล้ว':'บันทึกรายการแก้ไขที่ส่งถึง agent แล้ว':'บันทึกรายละเอียดงานแล้ว');
   this.#renderList(true);this.#renderInspector(true);this.#renderDetail();
   if(this.#job()?.id===job.id&&this.#reviewFeedback)this.#reviewFeedback.textContent='บันทึกแล้ว';
  }catch(error){if(this.#job()?.id===job.id&&this.#reviewFeedback)this.#reviewFeedback.textContent=error?.message||'บันทึกการตรวจไม่สำเร็จ';}
  finally{this.#saving.delete(job.id);if(this.#job()?.id===job.id)this.#updateReviewControls(job);}
 }

 #renderEvidenceList(job){
  const list=text('div',undefined,'work-evidence-list');
  if(!(job.steps||[]).length){list.append(text('p','งานนี้ยังไม่มีขั้นตอนรายงานจาก T3','work-evidence-empty'));return list;}
  for(const step of job.steps){
   const evidence=text('article',undefined,'work-evidence-item'),agent=this.#agentName(step.agentId),role=this.#agentRole(step.agentId);
   const header=text('div',undefined,'work-evidence-item-header');header.append(text('div',undefined,''));header.firstElementChild.append(text('h4',`${agent} · ${step.phase==='synthesis'?'สรุปทีม':role||'ผลลัพธ์'}`),text('span',providerLabels[step.status]||'ไม่ทราบสถานะ','work-evidence-step-status'));
   evidence.append(header);
   if(typeof step.result==='string'&&step.result.trim()){
    const result=text('div',undefined,'work-result');renderRichMessage(result,step.result);evidence.append(result);
    if(step.resultTruncated)evidence.append(text('p','ผลลัพธ์นี้ถูกย่อในสถานะงาน · ตรวจรายงานฉบับเต็มใน T3','work-evidence-note'));
   }else evidence.append(text('p','ยังไม่มีผลลัพธ์จากขั้นตอนนี้','work-evidence-empty'));
   const link=button('เปิดแชทกับ '+agent,'secondary-button',()=>this.#options.onOpenChat(step.threadId,agent));link.disabled=!step.threadId;evidence.append(link);
   list.append(evidence);
  }
  return list;
 }

 #appendChatLinks(parent,job,label){
  const steps=Array.isArray(job.steps)?job.steps.filter(step=>step.threadId):[];
  const section=text('section',undefined,'work-related-chats');section.append(text('h3',label));
  if(!steps.length){section.append(text('p','ยังไม่มีบทสนทนาที่เชื่อมกับงานนี้','work-evidence-empty'));parent.append(section);return;}
  const list=text('div',undefined,'work-chat-links');
  for(const step of steps){const name=this.#agentName(step.agentId);list.append(button(`เปิดแชท · ${name}`,'work-chat-link',()=>this.#options.onOpenChat(step.threadId,name)));}
  section.append(list);parent.append(section);
 }
 #hasEvidence(job){return(job.steps||[]).some(step=>typeof step.result==='string'&&step.result.trim());}
 #isCompact(){return typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(max-width: 1199px)').matches;}

 back(){
  this.#pendingJobId=null;
  this.#options.onSelectionChange(null);
  if(!this.#detailOpen)return;this.#listScrollTop=this.#listRegion.scrollTop;this.#detailOpen=false;this.#renderDetail();this.#renderList(true);this.#renderInspector(true);
 }
}
import {officeApiUrl} from './office-api-base.js';
