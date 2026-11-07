import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {TycoonStore} from '../web/tycoon-state.js';
import {domainFloors} from '../web/domain-office.js';
import {RoomStore} from '../web/hybrid-state.js';
import {defaultNativeRoom} from '../web/native-state.js';

const threadId='22222222-2222-4222-8222-222222222222';

async function startWorkspace({failOfficeLoad=false,tycoonSaved=false,zuriEnabled=false,hash='#chat',legacyLobby=false,contextCandidate=false,contextPayload=null,legacyArt=false,nativeFloor=false,syntheticWorkspace=false,returnFloor=null,assignedProfiles=null,workspaceJobs=[]}={}){
 const bundle=await build({entryPoints:['web/app.js'],bundle:true,write:false,format:'esm',platform:'browser',plugins:[{name:'test-adapters',setup(builder){
  builder.onLoad({filter:/web[\\/]office\.js$/},()=>({contents:'export class Office {setAgents(){} select(){} async load(){if(globalThis.__officeLifecycleTest.failLoad)throw new Error("fixture Office load failed")} dispose(){globalThis.__officeLifecycleTest.disposeCalls++}}; export function avatarPreview(){return {dispose(){},update(){}}}',loader:'js'}));
  builder.onLoad({filter:/web[\\/]rich-content\.js$/},()=>({contents:'export function renderRichMessage(node,text){node.textContent=text}; export function disposeRichMessages(){}',loader:'js'}));
 }}]});
 const dom=new JSDOM(await readFile(new URL('../web/index.html',import.meta.url),'utf8'),{url:'https://office.example/'+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const win=dom.window,errors=[];if(returnFloor)win.sessionStorage.setItem('zuri-office:return-floor:v1',returnFloor);if(syntheticWorkspace){const meta=win.document.createElement('meta');meta.name='office-workspace-profile';meta.content='office-workspace-synthetic/v1';win.document.head.append(meta);}if(legacyArt){const meta=win.document.createElement('meta');meta.name='office-art-preview';meta.content='legacy';win.document.head.append(meta);}if(nativeFloor)new RoomStore(win.localStorage).applyNative('projects',defaultNativeRoom());if(contextCandidate){const meta=win.document.createElement('meta');meta.name='office-context-profile';meta.content='office-domain-context/v1-candidate';win.document.head.append(meta);if(contextPayload){const clock=win.document.createElement('meta');clock.name='office-context-wall-clock';clock.content=contextPayload.generatedAt;win.document.head.append(clock);}win.TextEncoder=TextEncoder;win.TextDecoder=TextDecoder;}win.__officeLifecycleTest={failLoad:failOfficeLoad,disposeCalls:0};win.console.error=(...args)=>errors.push(args);win.document.fonts={ready:Promise.resolve()};win.matchMedia=()=>({matches:true,addEventListener(){}});win.HTMLElement.prototype.scrollIntoView=function(){};
 win.structuredClone=structuredClone;win.AbortSignal=AbortSignal;win.fetch=async path=>Response.json(path==='/api/preferences'?{assignments:assignedProfiles||[{id:threadId},...Array.from({length:5},()=>({id:null}))]}:path==='/api/office'?{version:1,sessions:[{id:threadId,name:'Mira',status:'idle'}],stale:false,receivedAt:new Date().toISOString()}:path==='/api/team'?{context:'Saved brand context'}:path==='/api/jobs'?{jobs:workspaceJobs}:path==='/api/work-reviews'?{reviews:[]}:{messages:[],pending:[],status:'idle',capabilities:null});
 let workspaceDown=false;const requests=[],legacyFetch=win.fetch;win.fetch=async path=>{requests.push(path);if(workspaceDown&&path==='/api/office')return Response.json({error:'synthetic offline'},{status:503});if(path==='/api/zuri/status'){await new Promise(resolve=>setTimeout(resolve,5));return Response.json({enabled:zuriEnabled,target:'http://127.0.0.1:3100',synthetic:contextCandidate,contextProfile:contextCandidate?'office-domain-context/v1-candidate':undefined});}if(contextCandidate&&contextPayload&&path==='/api/zuri/scope')return Response.json({businesses:[{id:contextPayload.businessId,name:'Synthetic A'}]});if(contextCandidate&&contextPayload&&path.startsWith('/api/zuri/synthetic/domain-context?'))return Response.json(contextPayload);if(path==='/api/zuri/scope')return Response.json({error:{code:'AUTH_REQUIRED'}},{status:401});return legacyFetch(path);};
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};win.HTMLDialogElement.prototype.close=function(){this.open=false;};
 Object.defineProperty(win.navigator,'locks',{value:navigator.locks});
 if(tycoonSaved){const floor=hash.split('/').at(-1);await new TycoonStore(win.localStorage).select(['lobby',...domainFloors.map(f=>f.key)].includes(floor)?floor:'projects','tycoon3d');}
 if(legacyLobby)await new TycoonStore(win.localStorage).select('lobby','legacy');
 await win.eval('(async()=>{'+bundle.outputFiles[0].text+'})()');await new Promise(resolve=>setTimeout(resolve,30));
 return{dom,win,errors,requests,setWorkspaceUnavailable:()=>workspaceDown=true};
}

test('reserved scene objects retain role inspection without offering Chat or task creation',async t=>{
 const {win}=await startWorkspace({syntheticWorkspace:true,legacyArt:true,hash:'#office/warehouse'});t.after(()=>win.close());
 win.document.querySelector('[data-object="role-1-desk"]').click();
 const actions=win.document.querySelector('.hy-workspace-actions');assert.match(actions.textContent,/พื้นที่เตรียมการ/);
 const labels=[...actions.querySelectorAll('button')].map(b=>b.textContent).join(' ');
 assert.doesNotMatch(labels,/สร้างงาน|เปิดแชท/);assert.match(labels,/ดูรายละเอียดบทบาท/);
});

test('painted floor objects bridge to workspace without assigning unbound roles',async t=>{
 const {win}=await startWorkspace({zuriEnabled:true,syntheticWorkspace:true,legacyArt:true,hash:'#office/projects'});t.after(()=>win.close());
 const doc=win.document;
 doc.querySelector('[data-object="role-1-avatar"]').click();
 assert.match(doc.querySelector('.hy-workspace-actions').textContent,/Atlas · Project Lead/);
 assert.match(doc.querySelector('.hy-workspace-actions').textContent,/ยังไม่ผูก Agent/);
 [...doc.querySelectorAll('[data-workspace-action]')].find(b=>b.textContent.includes('เปิดแชททีม')).click();
 assert.equal(win.location.hash,'#chat/choose');assert.equal(doc.querySelector('#chat-input').disabled,true);assert.equal(doc.querySelectorAll('.hy-interaction-popup[open]').length,0);
 assert.equal(doc.querySelector('#chat-view').hidden,false);
 win.location.hash='#office/projects';win.dispatchEvent(new win.Event('hashchange'));await new Promise(r=>setTimeout(r,10));
 doc.querySelector('[data-object="role-1-desk"]').click();
 [...doc.querySelectorAll('[data-workspace-action]')].find(b=>b.textContent==='ดูงานของชั้นนี้').click();await new Promise(r=>setTimeout(r,0));
 assert.match(doc.querySelector('.floor-tasks-source').textContent,/Synthetic/);
 doc.querySelector('[data-open-work]').click();assert.equal(win.location.hash,'#work');assert.equal(doc.querySelector('dialog.floor-tasks-dialog'),null);
 assert.equal(doc.querySelectorAll('.agent-row').length,6);
});

test('chat URL retains the chosen conversation and unknown routes never fall back to another recipient',async t=>{
 const {win,requests}=await startWorkspace({hash:'#chat/'+threadId});t.after(()=>win.close());
 assert.equal(win.document.querySelector('#chat-input').disabled,false);assert.equal(win.location.hash,'#chat/'+threadId);
 const unknown='33333333-3333-4333-8333-333333333333';win.location.hash='#chat/'+unknown;win.dispatchEvent(new win.Event('hashchange'));await new Promise(r=>setTimeout(r,5));
 assert.equal(win.document.querySelector('#chat-input').disabled,true);assert.match(win.document.querySelector('#chat-status').textContent,/ไม่พบ/);
 assert.equal(requests.some(p=>p.startsWith('/api/chats/'+unknown)),false);
 win.document.querySelector('[aria-label="คุยกับ Mira"]').click();assert.equal(win.location.hash,'#chat/'+threadId);assert.equal(win.document.querySelector('#chat-input').disabled,false);
});

test('empty recipient has its own refreshable route instead of the previous thread',async t=>{
 const first=await startWorkspace({hash:'#chat/'+threadId});t.after(()=>first.win.close());
 first.win.document.querySelector('[aria-label="คุยกับ Pim"]').click();
 assert.equal(first.win.location.hash,'#chat/agent%3Apim');assert.equal(first.win.document.querySelector('#chat-input').disabled,true);
 const second=await startWorkspace({hash:first.win.location.hash});t.after(()=>second.win.close());
 assert.equal(second.win.document.querySelector('#chat-title').textContent,'Pim');assert.equal(second.win.document.querySelector('#chat-input').disabled,true);
 assert.equal(second.requests.some(p=>p.startsWith('/api/chats/'+threadId)),false);
});

test('explicit Chat profile remains refreshable when two profiles share a manual thread',async t=>{
 const assignedProfiles=Array.from({length:6},(_,i)=>({id:[0,2].includes(i)?threadId:null}));
 const otherThread='55555555-5555-4555-8555-555555555555',workspaceJobs=[{id:'44444444-4444-4444-8444-444444444444',title:'Pim synthetic task',status:'done',agentIds:['pim'],steps:[{agentId:'pim',threadId:otherThread,status:'done',phase:'work',result:'Synthetic'}]}];
 const first=await startWorkspace({hash:'#chat/choose',assignedProfiles,workspaceJobs});t.after(()=>first.win.close());
 first.win.document.querySelector('[aria-label="คุยกับ Pim"]').click();
 assert.equal(first.win.document.querySelector('#chat-thread').options.length,2);
 first.win.document.querySelector('#chat-thread').value=threadId;first.win.document.querySelector('#chat-thread').dispatchEvent(new first.win.Event('change'));
 assert.equal(first.win.location.hash,'#chat/agent%3Apim%3A'+threadId);
 assert.equal(first.win.document.querySelector('#chat-input').disabled,false);
 const second=await startWorkspace({hash:first.win.location.hash,assignedProfiles,workspaceJobs});t.after(()=>second.win.close());
 assert.equal(second.win.document.querySelector('#chat-title').textContent,'Pim');
 assert.equal(second.win.document.querySelector('#chat-input').disabled,false);
 assert.equal(second.win.document.querySelector('#chat-thread').value,threadId);
 second.win.location.hash='#chat/'+threadId;second.win.dispatchEvent(new second.win.Event('hashchange'));await new Promise(r=>setTimeout(r,5));
 assert.equal(second.win.document.querySelector('#chat-input').disabled,true);
});

for(const route of ['choose','not-a-current-thread'])test(`neutral Chat ${route} cannot preselect a task recipient`,async t=>{
 const {win}=await startWorkspace({hash:'#chat/'+route,syntheticWorkspace:true});t.after(()=>win.close());
 const doc=win.document;assert.equal(doc.querySelector('#chat-input').disabled,true);
 doc.querySelector('#chat-new-task').click();
 assert.equal(doc.querySelector('#task-dialog').open,true);
 assert.equal(doc.querySelector('#task-agent').value,'');
 assert.equal(doc.querySelector('#task-agent').required,true);
 assert.equal(doc.querySelectorAll('#task-members input:checked').length,0);
});

test('Zuri startup on a direct floor keeps auth UI separate from the legacy T3 client',async t=>{
 const {win,requests}=await startWorkspace({tycoonSaved:true,zuriEnabled:true,hash:'#office/growth'});t.after(()=>win.close());
 assert.equal(win.document.body.hasAttribute('data-app-boot'),false);
 assert.ok(requests.includes('/api/zuri/scope'));
 assert.equal(requests.some(path=>['/api/office','/api/preferences','/api/jobs','/api/team'].includes(path)),false);
 assert.match(win.document.querySelector('.tycoon-title').textContent,/Marketing/);
 win.document.querySelector('.tycoon-connection').click();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(win.document.querySelector('.tycoon-sheet').open,true);
 assert.equal(win.document.querySelector('#connect-dialog').open,false);
 assert.equal(win.document.querySelector('.tycoon-sheet a').getAttribute('href'),'http://127.0.0.1:3100/login');
});

test('workspace navigation keeps one chat composer and dirty knowledge across pages',async t=>{
 const {dom,win}=await startWorkspace();t.after(()=>win.close());
 const composer=win.document.querySelector('#chat-input');composer.value='Draft preserved';
 const nav=view=>{const direct=win.document.querySelector('.workspace-dock [data-nav="'+view+'"]');if(direct)direct.click();else{win.document.querySelector('#workspace-more').click();win.document.querySelector('#more-dialog [data-nav="'+view+'"]').click();}};
 nav('work');assert.equal(win.document.querySelector('#work-page').hidden,false);assert.equal(win.document.querySelector('#office-view').hidden,true);
 nav('knowledge');const knowledge=win.document.querySelector('#knowledge-context-input');knowledge.value='Draft brand';knowledge.dispatchEvent(new win.Event('input',{bubbles:true}));
 nav('results');nav('chat');assert.equal(win.document.querySelector('#chat-input'),composer);assert.equal(composer.value,'Draft preserved');
 nav('knowledge');assert.equal(knowledge.value,'Draft brand');nav('team');assert.equal(win.document.querySelectorAll('.team-profile').length,6);nav('inbox');assert.equal(win.document.querySelector('#inbox-page').hidden,false);
 assert.equal(win.document.querySelectorAll('#results-page-title').length,1);assert.equal(win.document.querySelectorAll('#knowledge-page-title').length,1);
});

test('workspace pages do not allocate the obsolete hidden Office renderer',async t=>{
 const {win,errors}=await startWorkspace({failOfficeLoad:true});t.after(()=>win.close());
 assert.equal(win.__officeLifecycleTest.disposeCalls,0);assert.equal(errors.length,0);
 assert.equal(win.document.querySelector('#office-overview'),null);
 win.document.querySelector('.workspace-dock [data-nav="work"]').click();
 assert.equal(win.document.querySelector('#work-page').hidden,false);
});

test('saved native floor still lazy-loads its renderer and exposes a failed-load fallback',async t=>{
 const {win,errors}=await startWorkspace({hash:'#office/projects',nativeFloor:true,legacyArt:true,failOfficeLoad:true});t.after(()=>win.close());
 assert.equal(win.__officeLifecycleTest.disposeCalls,1);assert.equal(errors.length,1);
 assert.match(win.document.querySelector('#scene-loading').textContent,/ไม่สามารถแสดง/);
});

test('domain links restore the correct floor and browser history without changing existing team identities',async t=>{
 const {win}=await startWorkspace({legacyLobby:true});t.after(()=>win.close());
 win.document.querySelector('.workspace-dock [data-nav="office"]').click();
 assert.equal(win.document.body.classList.contains('idle-active'),true);
 assert.equal(win.document.querySelectorAll('.floor-stop').length,14);
 win.document.querySelector('.enter-building').click();assert.equal(win.location.hash,'#office/lobby');assert.equal(win.document.querySelector('.floor-sheet').open,false);
 win.document.querySelector('.lobby-elevator').click();assert.equal(win.document.querySelector('.floor-sheet').open,true);
 win.document.querySelector('[data-floor-key="customer"]').click();
 assert.equal(win.document.querySelector('.floor-sheet').open,false);
 assert.equal(win.location.hash,'#office/customer');
 assert.equal(win.document.querySelector('.office-world h1').textContent,'Customer');
 assert.match(win.document.querySelector('.floor-roster').textContent,/Pim/);
 win.history.replaceState(null,'','#office/knowledge');win.dispatchEvent(new win.PopStateEvent('popstate'));
 assert.equal(win.document.querySelector('.office-world h1').textContent,'Knowledge (GKS)');
 win.document.querySelector('[data-role-index="0"]').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(win.location.hash,'#office/lobby');assert.equal(win.document.querySelectorAll('.floor-stop').length,14);
 win.history.replaceState(null,'','#office/lobby');win.dispatchEvent(new win.PopStateEvent('popstate'));assert.equal(win.document.querySelector('.lobby-room').hidden,false);
 win.document.querySelector('.lobby-board').click();assert.equal(win.document.querySelector('.board-dialog').open,true);
 win.history.replaceState(null,'','#work');win.dispatchEvent(new win.PopStateEvent('popstate'));assert.equal(win.document.querySelector('.board-dialog').open,false);
 win.history.replaceState(null,'','#office/lobby');win.dispatchEvent(new win.PopStateEvent('popstate'));
 win.document.querySelector('[data-world-page="work"]').click();assert.equal(win.location.hash,'#work');assert.equal(win.document.body.classList.contains('idle-active'),false);
 win.document.querySelector('#workspace-more').click();win.document.querySelector('#more-dialog [data-nav="team"]').click();assert.equal(win.document.querySelectorAll('.team-profile').length,6);
});

test('fresh Office keeps the canonical painted presentation without a version switch',async t=>{
 const {win}=await startWorkspace({hash:'#office/projects'});t.after(()=>win.close());
 assert.equal(win.document.querySelector('.office-world').hidden,false);
 assert.equal(win.document.querySelector('.tycoon-world').hidden,true);
 assert.ok(win.document.querySelector('.hq-badge img[src="./assets/brand/zuri-iconic-primary.svg"]'));
 assert.equal(win.document.querySelector('.tycoon-legacy-switch'),null);
});

test('old art-preview metadata cannot bypass dynamic context routing',async t=>{
 const {win}=await startWorkspace({contextCandidate:true,legacyArt:true,hash:'#office/projects'});t.after(()=>win.close());
 assert.equal(win.document.querySelector('.tycoon-world').hidden,false);
 assert.equal(win.document.querySelector('.office-world').hidden,true);
 assert.equal(win.location.hash,'#office/lobby');
});

test('explicitly saved GLB edition retains accessible object sheets without WebGL',async t=>{
 const {win}=await startWorkspace({tycoonSaved:true,hash:'#office/projects'});t.after(()=>win.close());
 assert.equal(win.document.querySelector('.tycoon-world').hidden,false);
 assert.equal(win.document.querySelector('.office-world').hidden,true);
 assert.equal(win.document.activeElement,win.document.querySelector('.tycoon-world h1'));
 assert.match(win.document.querySelector('.tycoon-notice').textContent,/3D/);
 win.document.querySelector('.tycoon-dock [data-nav="work"]').click();
 assert.equal(win.document.querySelector('.tycoon-sheet').open,true);
 assert.match(win.document.querySelector('.tycoon-sheet-body').textContent,/ยังไม่มี API/);
 assert.equal(win.location.hash,'#office/projects');
});
test('explicit saved department editions use their own Tycoon floor while default legacy choices remain separate',async t=>{
 const {win}=await startWorkspace({tycoonSaved:true,hash:'#office/customer'});t.after(()=>win.close());
 assert.equal(win.document.querySelector('.tycoon-world').hidden,false);assert.equal(win.document.querySelector('.office-world').hidden,true);
 assert.match(win.document.querySelector('.tycoon-title').textContent,/Customer/);
 await new TycoonStore(win.localStorage).select('knowledge','tycoon3d');win.history.replaceState(null,'','#office/knowledge');win.dispatchEvent(new win.PopStateEvent('popstate'));
 assert.equal(win.document.querySelector('.tycoon-world').hidden,false);assert.match(win.document.querySelector('.tycoon-title').textContent,/Knowledge/);
 const legacy=[...win.document.querySelectorAll('.tycoon-world button')].find(b=>b.textContent==='ใช้ฉากเดิม');assert.ok(legacy);legacy.click();await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(new TycoonStore(win.localStorage).get('knowledge').edition,'legacy');assert.equal(win.document.querySelector('.tycoon-world').hidden,true);assert.equal(win.document.querySelector('.office-world').hidden,false);
});
test('failed edition selection stays on Tycoon and reports why Studio cannot open',async t=>{
 const {win}=await startWorkspace({tycoonSaved:true,hash:'#office/projects'});t.after(()=>win.close());
 win.Storage.prototype.setItem=()=>{throw Error('quota');};
 win.document.querySelector('.tycoon-dock [data-nav="studio"]').click();await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(win.location.hash,'#office/projects');assert.match(win.document.querySelector('#toast').textContent,/บันทึก edition/);
});
test('global navigation and history both respect an unsaved Tycoon draft',async t=>{
 const {win}=await startWorkspace({tycoonSaved:true,hash:'#office/projects'});t.after(()=>win.close());
 win.document.querySelector('.tycoon-dock [data-nav="studio"]').click();await new Promise(resolve=>setTimeout(resolve,30));
 const field=win.document.querySelector('.studio-tycoon-host [data-field="x"]');assert.ok(field);field.value='-3';field.dispatchEvent(new win.Event('change',{bubbles:true}));
 let prompts=0;win.confirm=()=>{prompts++;return false;};win.document.querySelector('.workspace-dock [data-nav="work"]').click();assert.equal(win.location.hash,'#office/studio');assert.equal(field.value,'-3');
 win.history.replaceState(null,'','#work');win.dispatchEvent(new win.PopStateEvent('popstate'));assert.equal(win.location.hash,'#office/studio');assert.equal(prompts,2);
 win.confirm=()=>true;win.document.querySelector('.workspace-dock [data-nav="work"]').click();assert.equal(win.location.hash,'#work');assert.equal(win.document.querySelector('#work-page').hidden,false);
});

test('dynamic boot and browser history never fall through to legacy floors before context',async t=>{
 const {win}=await startWorkspace({contextCandidate:true,hash:'#office/domain%3Ahidden'});t.after(()=>win.close());
 assert.equal(win.document.querySelector('.tycoon-world').hidden,false);assert.equal(win.document.querySelector('.office-world').hidden,true);assert.equal(win.location.hash,'#office/lobby');
 assert.doesNotMatch(win.document.querySelector('.tycoon-world h1').textContent,/hidden/);
 win.history.replaceState(null,'','#office/customer');win.dispatchEvent(new win.PopStateEvent('popstate'));assert.equal(win.location.hash,'#office/lobby');assert.equal(win.document.querySelector('.office-world').hidden,true);
});

test('composed candidate app routes new authorized leaf and removes it on refresh without legacy/storage fallback',async t=>{
 const contextPayload={schemaVersion:'office-domain-context/v1',businessId:'a',contextRevision:'r',generatedAt:'2026-10-24T00:00:00.000Z',sourceRevision:'a'.repeat(40),domains:[{domainKey:'future-leaf',label:'Future',canonicalDomainId:null,availability:'ACTIVE',modules:null,reads:[],actions:[]}]};
 const {win,requests}=await startWorkspace({contextCandidate:true,contextPayload,zuriEnabled:true,hash:'#office'});t.after(()=>win.close());const q=s=>win.document.querySelector(s);
 q('.tycoon-connection').click();const select=q('.tycoon-sheet select');select.value='a';select.dispatchEvent(new win.Event('change'));await new Promise(r=>setTimeout(r,30));
 q('.tycoon-dock [data-nav=floors]').click();const floor=[...q('.tycoon-sheet-body').querySelectorAll('button')].find(b=>b.textContent.includes('Future'));assert.ok(floor);floor.click();assert.equal(win.location.hash,'#office/domain%3Afuture-leaf');assert.match(q('.tycoon-world h1').textContent,/Future/);assert.equal(q('.office-world').hidden,true);assert.equal(q('.tycoon-dock [data-nav=studio]').disabled,true);assert.equal(requests.some(p=>p.includes('/domains/projects')),false);
 const historyLength=win.history.length;win.dispatchEvent(new win.Event('focus'));await new Promise(r=>setTimeout(r,30));assert.equal(win.location.hash,'#office/domain%3Afuture-leaf');assert.equal(win.history.length,historyLength);
 contextPayload.domains=[];[...q('.tycoon-entry').querySelectorAll('button')].find(b=>b.textContent==='โหลดรายชื่อชั้นใหม่').click();await new Promise(r=>setTimeout(r,30));assert.equal(win.location.hash,'#office/lobby');win.history.replaceState(null,'','#office/domain%3Afuture-leaf');win.dispatchEvent(new win.PopStateEvent('popstate'));assert.equal(win.location.hash,'#office/lobby');assert.doesNotMatch(q('.tycoon-world h1').textContent,/Future/);
});

for(const key of [null,'lobby',...domainFloors.map(f=>f.key),'studio'])test('fresh app restores '+(key||'building')+' without retired UI',async t=>{
 const {win,errors}=await startWorkspace({hash:'#office'+(key?'/'+key:''),legacyArt:true,zuriEnabled:true});t.after(()=>win.close());
 assert.equal(win.document.querySelector('.rail,#office-overview,#office-chat-slot,#job-list'),null);
 assert.equal(win.document.querySelector('.office-world').hidden,false);
 assert.equal(win.document.body.hasAttribute('data-app-boot'),false);
 assert.equal(win.location.hash,'#office'+(key?'/'+key:''));
 assert.equal(win.document.querySelectorAll('#chat-input').length,1);
 assert.equal(errors.length,0);
});

test('default Office exposes Chat, full Work and Results through its workspace menu',async t=>{
 const {win}=await startWorkspace({tycoonSaved:true,hash:'#office/projects'});t.after(()=>win.close());
 win.document.querySelector('[data-workspace-menu]').click();assert.equal(win.document.querySelector('#more-dialog').open,true);
 win.document.querySelector('#more-dialog [data-nav="work"]').click();assert.equal(win.location.hash,'#work');
 assert.equal(win.document.querySelector('#work-page').hidden,false);
 win.document.querySelector('.workspace-header [data-nav="office"]').click();assert.equal(win.location.hash,'#office/projects');
 win.document.querySelector('[data-workspace-menu]').click();win.document.querySelector('#more-dialog [data-nav="chat"]').click();assert.equal(win.location.hash,'#chat/'+threadId);
 win.document.querySelector('.workspace-dock [data-nav="results"]').click();assert.equal(win.location.hash,'#results');
});

test('Zuri-only workspace shows unavailable and refuses legacy task writes',async t=>{
 const {win,requests}=await startWorkspace({zuriEnabled:true,hash:'#chat'});t.after(()=>win.close());
 assert.equal(win.document.querySelector('#workspace-pages').hidden,true);
 assert.match(win.document.querySelector('#workspace-state').textContent,/API/);
 win.document.querySelector('#chat-new-task').click();assert.equal(win.document.querySelector('#task-dialog').open,false);
 assert.equal(requests.includes('/api/knowledge'),false);
});

test('opt-in synthetic workspace loads actual workspace clients even beside synthetic Zuri',async t=>{
 const {win,requests}=await startWorkspace({zuriEnabled:true,syntheticWorkspace:true,hash:'#chat'});t.after(()=>win.close());
 assert.ok(requests.includes('/api/office'));assert.equal(win.document.querySelector('#workspace-pages').hidden,false);
 assert.match(win.document.querySelector('#workspace-state').textContent,/SYNTHETIC/);
});

test('Hybrid Studio draft protects global navigation and history as well as its own exit',async t=>{
 const {win}=await startWorkspace({legacyArt:true,hash:'#office/studio'});t.after(()=>win.close());
 const field=win.document.querySelector('.hy-name input');field.value='Unsaved room';field.dispatchEvent(new win.Event('change',{bubbles:true}));
 win.history.replaceState(null,'','#work');win.dispatchEvent(new win.PopStateEvent('popstate'));
 assert.equal(win.location.hash,'#office/studio');assert.equal(win.document.querySelector('.hy-discard-dialog').open,true);
 win.document.querySelector('.hy-keep-draft').click();assert.equal(field.value,'Unsaved room');
 win.document.querySelector('#more-dialog [data-nav="work"]').click();win.document.querySelector('.hy-discard').click();
 assert.equal(win.location.hash,'#work');
});

test('read-only demo clears prior service context and preserves dirty drafts by refusing a source switch',async t=>{
 const {win}=await startWorkspace();t.after(()=>win.close());
 assert.equal(win.document.querySelector('#knowledge-context-input').value,'Saved brand context');
 win.document.querySelector('#use-demo').click();assert.equal(win.document.querySelector('#knowledge-context-input').value,'');
});

test('bare Office boot preserves a safe previous floor for the workspace return shortcut',async t=>{
 const {win}=await startWorkspace({hash:'#office',returnFloor:'projects'});t.after(()=>win.close());
 win.document.querySelector('[data-workspace-menu]').click();win.document.querySelector('#more-dialog [data-nav="chat"]').click();
 win.document.querySelector('.workspace-header [data-nav="office"]').click();assert.equal(win.location.hash,'#office/projects');
});

test('demo switch is refused while a Knowledge file mutation is in flight',async t=>{
 const {win}=await startWorkspace({hash:'#knowledge'});t.after(()=>win.close());
 const field=win.document.querySelector('#knowledge-files');Object.defineProperty(field,'files',{configurable:true,value:[new win.File(['synthetic only'],'fixture.txt',{type:'text/plain'})]});
 field.dispatchEvent(new win.Event('change',{bubbles:true}));win.document.querySelector('#use-demo').click();
 assert.notEqual(win.document.querySelector('#workspace-notice').dataset.state,'demo');assert.match(win.document.querySelector('#toast').textContent,/ร่าง|ค้าง/);
 await new Promise(resolve=>setTimeout(resolve,5));
});

test('workspace readiness loss suspends chat polls behind the blocked page',async t=>{
 const {win,requests,setWorkspaceUnavailable}=await startWorkspace({hash:'#chat'});t.after(()=>win.close());
 assert.equal(win.document.querySelector('#workspace-pages').hidden,false);
 setWorkspaceUnavailable();win.document.querySelector('#workspace-retry').click();await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(win.document.querySelector('#workspace-pages').hidden,true);
 const chatReads=()=>requests.filter(p=>p.startsWith('/api/chats/')).length,count=chatReads();
 await new Promise(resolve=>setTimeout(resolve,5100));assert.equal(chatReads(),count);
});
