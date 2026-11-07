import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {WorkView} from '../web/work-view.js';

function setup(t,{mobile=false}={}){
 const window=new JSDOM('<!doctype html><body><div id="work"></div></body>',{url:'https://office.example/'}).window;
 const previous={};for(const key of ['window','document','DOMParser','XMLSerializer','location','Option']){previous[key]=globalThis[key];globalThis[key]=window[key];}
 window.matchMedia=()=>({matches:mobile});
 t.after(()=>{for(const[key,value]of Object.entries(previous))globalThis[key]=value;window.close();});
 return{window,root:window.document.querySelector('#work')};
}
const makeJob=(id,title,status='done',agentIds=['beam'],team=false)=>({id,title,status,agentIds,team,createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-02T00:00:00.000Z',brief:'Check official sources and summarize the result.',runnerError:null,steps:agentIds.map((agentId,index)=>({agentId,phase:index===agentIds.length-1&&team?'synthesis':'specialist',threadId:`thread-${id}-${agentId}`,status:status==='done'?'done':status,result:status==='done'?`## ${agentId} findings\n\n| Source | Status |\n|---|---|\n| Official | checked |`:'',resultTruncated:false}))});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('review sends edit base and preserves draft after typed stale conflict until explicit reload',async t=>{
 const {root,window}=setup(t),job=makeJob('review-base','Concurrent review'),bodies=[];let refreshes=0;
 const current={jobId:job.id,note:'remote note',acceptance:'remote criteria',updatedAt:'2026-10-27T00:00:00.000Z'};
 t.mock.method(globalThis,'fetch',async(_url,options)=>{bodies.push(JSON.parse(options.body));return Response.json({code:'REVIEW_CONFLICT',error:'Review changed; reload before retrying'},{status:409});});
 const view=new WorkView(root,{refresh:()=>refreshes++});t.after(()=>view.destroy());view.update({jobs:[job],reviews:[current]});view.open(job.id);
 const note=root.querySelector('[data-review-note]');note.value='my retained draft';note.dispatchEvent(new window.Event('input',{bubbles:true}));
 root.querySelector('[data-save-review]').click();await flush();
 assert.equal(bodies[0].baseUpdatedAt,current.updatedAt);assert.equal(refreshes,1);
 assert.equal(root.querySelector('[data-review-note]').value,'my retained draft');assert.equal(root.querySelector('[data-save-review]').disabled,true);
 assert.equal(root.querySelector('[data-use-latest]').hidden,false);
 view.update({jobs:[job],reviews:[{...current,note:'new remote',updatedAt:'2026-10-27T00:00:00.001Z'}]});
 assert.equal(root.querySelector('[data-review-note]').value,'my retained draft');
 root.querySelector('[data-use-latest]').click();assert.equal(root.querySelector('[data-review-note]').value,'new remote');assert.equal(root.querySelector('[data-save-review]').disabled,false);
});

test('unknown work route distinguishes loading, unavailable and a fresh missing record with retry',t=>{
 const {root}=setup(t);let retries=0;const view=new WorkView(root,{refresh:()=>retries++});t.after(()=>view.destroy());
 view.open('missing');assert.match(root.querySelector('.work-detail').textContent,/กำลังโหลด/);
 view.update({jobs:[],dataState:'unavailable'});assert.match(root.querySelector('.work-detail').textContent,/ยังตรวจสอบ/);
 view.update({jobs:[],dataState:'ready'});assert.match(root.querySelector('.work-detail').textContent,/ไม่พบงาน/);
 root.querySelector('[data-retry-work]').click();assert.equal(retries,1);
 view.update({jobs:[makeJob('missing','Arrived later')],dataState:'ready'});assert.equal(root.querySelector('#work-detail-title').textContent,'Arrived later');
});

test('changing a filter cannot retain a detail from the prior selection',t=>{
 const {root,window}=setup(t),view=new WorkView(root);t.after(()=>view.destroy());view.update({jobs:[makeJob('a','First','done'),makeJob('b','Second','running')]});view.open('a');
 const status=root.querySelector('[data-filter=status]');status.value='active';status.dispatchEvent(new window.Event('change'));
 assert.doesNotMatch(root.querySelector('.work-detail').textContent,/First/);
});

test('abandoning missing work does not reopen it when a later snapshot arrives',t=>{
 const {root}=setup(t),view=new WorkView(root);t.after(()=>view.destroy());view.open('late');view.back();
 view.update({jobs:[makeJob('late','Late arrival')]});assert.equal(root.querySelector('.work-detail').hidden,true);
});

test('filtering an unresolved work route never opens a different task',t=>{
 const {root,window}=setup(t),view=new WorkView(root);t.after(()=>view.destroy());view.update({jobs:[makeJob('a','Different task')]});view.open('missing');
 const status=root.querySelector('[data-filter=status]');status.value='ready';status.dispatchEvent(new window.Event('change'));
 assert.equal(root.querySelector('.work-detail').hidden,true);
});

test('demo missing work retry cannot call the connected service',t=>{
 const {root}=setup(t);let retries=0;const view=new WorkView(root,{isDemo:()=>true,refresh:()=>retries++});t.after(()=>view.destroy());view.update({jobs:[]});view.open('missing');
 const retry=root.querySelector('[data-retry-work]');assert.equal(retry.disabled,true);retry.click();assert.equal(retries,0);
});

test('review save settles its feedback and late errors do not update another job',async t=>{
 const {root}=setup(t),original=globalThis.fetch;let resolve;
 globalThis.fetch=()=>new Promise(r=>resolve=r);t.after(()=>globalThis.fetch=original);
 const a=makeJob('a','First'),b=makeJob('b','Second','running');let view;
 view=new WorkView(root,{onReviewChange:review=>view.update({jobs:[a,b],reviews:{a:review}})});t.after(()=>view.destroy());view.update({jobs:[a,b]});view.open('a');root.querySelector('[data-save-review]').click();
 resolve(Response.json({review:{jobId:'a',updatedAt:'2026-10-26T00:00:00Z'}}));await flush();
 assert.doesNotMatch(root.querySelector('[data-review-feedback]').textContent,/กำลังบันทึก/);
 root.querySelector('[data-save-review]').click();view.open('b');resolve(Response.json({error:'late failure for A'},{status:500}));await flush();
 assert.doesNotMatch(root.querySelector('.work-detail').textContent,/late failure/);assert.equal(root.querySelector('[data-accept-review]').disabled,true);
});

test('work list filters by review status, owner and work type while keeping provider and review state distinct',t=>{
 const{root}=setup(t),view=new WorkView(root);
 const ready=makeJob('ready','Ready report','done',['beam']),accepted=makeJob('accepted','Accepted plan','done',['kai']),active=makeJob('active','Running task','running',['beam','kai'],true);
 view.update({jobs:[ready,accepted,active],reviews:{accepted:{jobId:'accepted',dueDate:'2026-10-20',acceptance:'Verified sources',reviewStatus:'accepted',note:'Looks good',updatedAt:'2026-10-03T00:00:00.000Z'}}});
 assert.equal(root.querySelectorAll('.work-row').length,3);assert.match(root.querySelector('[data-job-id="ready"]').textContent,/พร้อมตรวจ/);assert.match(root.querySelector('[data-job-id="accepted"]').textContent,/ตรวจรับแล้ว/);assert.match(root.querySelector('[data-job-id="ready"]').textContent,/เสร็จแล้ว/);
 const status=root.querySelector('select[data-filter="status"]');status.value='ready';status.dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.deepEqual([...root.querySelectorAll('.work-row')].map(row=>row.dataset.jobId),['ready']);
 const owner=root.querySelector('select[data-filter="owner"]');owner.value='kai';owner.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(root.querySelectorAll('.work-row').length,0);assert.match(root.textContent,/ไม่พบงานตามตัวกรอง/);
 view.destroy();
});

test('detail renders real Markdown results and opens the matching chat and results callbacks',t=>{
 const{root}=setup(t),calls=[],job=makeJob('evidence','Evidence report');job.steps[0].result='## Findings\n\n| Source | Finding |\n|---|---|\n| Official | Confirmed |';
 const view=new WorkView(root,{onOpenChat:(threadId,name)=>calls.push(['chat',threadId,name]),onOpenResults:jobId=>calls.push(['results',jobId])});view.update({jobs:[job]});view.open(job.id);
 const detail=root.querySelector('.work-detail');assert.equal(detail.hidden,false);assert.equal(detail.getAttribute('aria-labelledby'),'work-detail-title');assert.equal(detail.querySelector('#work-detail-title').textContent,'Evidence report');assert.equal(detail.querySelector('.work-result h2').textContent,'Findings');assert.equal(detail.querySelectorAll('.work-result .table-scroll td')[1].textContent,'Confirmed');
 detail.querySelector('.work-evidence-item .secondary-button').click();detail.querySelector('.work-evidence-heading .secondary-button').click();
 assert.deepEqual(calls,[['chat','thread-evidence-beam','Beam'],['results','evidence']]);view.destroy();
});

test('updates retain dirty review fields and an unchanged interactive evidence card',t=>{
 const{root}=setup(t),job=makeJob('stable','Stable evidence');job.steps[0].result='```interactive\n<button>Open</button>\n```';
 const view=new WorkView(root);view.update({jobs:[job]});view.open(job.id);
 const acceptance=root.querySelector('[data-acceptance]'),card=root.querySelector('.rich-card');acceptance.value='Include two verified sources';acceptance.dispatchEvent(new window.Event('input',{bubbles:true}));
 view.update({jobs:[{...job,steps:job.steps.map(step=>({...step}))}],reviews:{}});
 assert.equal(root.querySelector('[data-acceptance]'),acceptance);assert.equal(root.querySelector('.rich-card'),card);assert.equal(root.querySelector('[data-acceptance]').value,'Include two verified sources');
 view.destroy();
});

test('mobile detail has a back path that preserves selected work and filters',t=>{
 const{root,window}=setup(t,{mobile:true}),view=new WorkView(root),job=makeJob('mobile','Mobile review');view.update({jobs:[job,makeJob('other','Other work','running')]});
 const status=root.querySelector('select[data-filter="status"]');status.value='ready';status.dispatchEvent(new window.Event('change',{bubbles:true}));
 const row=root.querySelector('[data-job-id="mobile"]');root.querySelector('.work-list-region').scrollTop=36;row.click();
 assert.equal(root.querySelector('.work-detail').hidden,false);root.querySelector('.work-back').click();
 assert.equal(root.querySelector('.work-detail').hidden,true);assert.equal(root.querySelector('select[data-filter="status"]').value,'ready');assert.equal(root.querySelector('.work-list-region').scrollTop,36);assert.equal(root.querySelector('.work-row[aria-pressed="true"]').dataset.jobId,'mobile');
 view.destroy();
});

test('human decisions are persisted separately and notify the host after a provider-done result',async t=>{
 const{root}=setup(t),job=makeJob('decision','Review decision'),calls=[];let requestBody;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{requestBody=JSON.parse(options.body);return new Response(JSON.stringify({review:{...requestBody,updatedAt:'2026-10-04T00:00:00.000Z'}}),{status:200,headers:{'content-type':'application/json'}});});
 const view=new WorkView(root,{onReviewChange:review=>calls.push(review),toast:message=>calls.push(message)});view.update({jobs:[job]});view.open(job.id);
 root.querySelector('[data-acceptance]').value='Contains a source list';root.querySelector('[data-acceptance]').dispatchEvent(new window.Event('input',{bubbles:true}));root.querySelector('[data-review-note]').value='All claims checked';root.querySelector('[data-review-note]').dispatchEvent(new window.Event('input',{bubbles:true}));
 root.querySelector('[data-accept-review]').click();await flush();
 assert.equal(requestBody.reviewStatus,'accepted');assert.equal(requestBody.action,'accepted');assert.equal(requestBody.acceptance,'Contains a source list');assert.equal(requestBody.note,'All claims checked');assert.equal(calls[0].reviewStatus,'accepted');assert.match(calls[1],/ตรวจรับ/);assert.match(root.querySelector('.work-review-context').textContent,/T3: เสร็จแล้ว/);assert.match(root.querySelector('.work-review-context').textContent,/ตรวจรับแล้ว/);
 view.destroy();
});

test('change requests require a note and surface handoff errors before confirming queue success',async t=>{
 const{root,window}=setup(t),job=makeJob('handoff','Request changes'),bodies=[],updated=[],responses=[
  new Response(JSON.stringify({error:'ไม่พบขั้นตอนปลายทาง'}),{status:409,headers:{'content-type':'application/json'}}),
  new Response(JSON.stringify({review:{jobId:job.id,dueDate:'',acceptance:'Add a source list',reviewStatus:'changes_requested',note:'Add missing comparison',updatedAt:'2026-10-04T00:00:00.000Z'},handoff:{status:'queued',messageId:'queue-id',threadId:'thread-id'}}),{status:200,headers:{'content-type':'application/json'}})
 ];
 t.mock.method(globalThis,'fetch',async(_url,options)=>{bodies.push(JSON.parse(options.body));return responses.shift();});
 const view=new WorkView(root,{onReviewChange:review=>updated.push(review),toast:message=>updated.push(message)});view.update({jobs:[job]});view.open(job.id);
 root.querySelector('[data-request-changes]').click();await flush();assert.equal(bodies.length,0);assert.match(root.querySelector('[data-review-feedback]').textContent,/ต้องมีบันทึก/);
 const note=root.querySelector('[data-review-note]');note.value='Add missing comparison';note.dispatchEvent(new window.Event('input',{bubbles:true}));
 root.querySelector('[data-acceptance]').value='Add a source list';root.querySelector('[data-request-changes]').click();await flush();
 assert.equal(bodies[0].action,'changes_requested');assert.equal(bodies[0].reviewStatus,'changes_requested');assert.match(root.querySelector('[data-review-feedback]').textContent,/ไม่พบขั้นตอนปลายทาง/);assert.equal(updated.length,0);
 root.querySelector('[data-request-changes]').click();await flush();assert.equal(updated[0].reviewStatus,'changes_requested');assert.match(updated[1],/เข้าแชท/);
 view.destroy();
});

test('stopping unfinished work keeps its provider status until T3 acknowledges cancellation',async t=>{
 const{root}=setup(t),job=makeJob('running-job','Running work','running');let requested,refreshes=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{requested={url,method:options.method};return Response.json({job:{...job,cancelRequested:true}});});
 const view=new WorkView(root,{refresh:()=>refreshes++});view.update({jobs:[job]});view.open(job.id);
 root.querySelector('.work-detail [data-work-cancel]').click();await flush();
 assert.deepEqual(requested,{url:'/api/jobs/running-job/cancel',method:'POST'});assert.equal(job.status,'running');assert.equal(job.cancelRequested,true);assert.equal(refreshes,1);assert.equal(root.querySelector('.work-detail [data-work-cancel]').disabled,true);view.destroy();
});
