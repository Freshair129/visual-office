import {isOfficeFloor} from './office-floor-registry.js';
import {workspaceAccess,readReturnFloor,writeReturnFloor,SYNTHETIC_WORKSPACE_PROFILE} from './workspace-context.js';
import {BuildingView} from './building-view.js';
import {TycoonView} from './tycoon-view.js';
import {TycoonStore} from './tycoon-state.js';

import {CloudClient} from './cloud-client.js';
import {icon,hydrateIcons} from './icons.js';
import {profiles} from './agent-profiles.js';
import {roleCards} from './agent-state.js';
import {TaskUI} from './tasks.js';
import {ChatUI} from './chat.js';
import {chatChoices,selectedChat,resolveChatRoute,chatRouteId} from './chat-selection.js';
import {renderRichMessage,disposeRichMessages} from './rich-content.js';
import {WorkView} from './work-view.js';
import {ResultsView} from './results-view.js';
import {KnowledgeView} from './knowledge-view.js';
import {InboxView} from './inbox-view.js';
import {TeamPage} from './team-page.js';
import {workspaceRoute,workspaceHash} from './workspace-navigation.js';
import {watchOptionalAssetImages} from './optional-assets.js';
import {officeApiUrl} from './office-api-base.js';

const releaseBuild = typeof __OFFICE_RELEASE__ === 'boolean' && __OFFICE_RELEASE__;
const contextMeta = releaseBuild ? null : document.querySelector('meta[name=office-context-profile]');
let TycoonDomainView, CONTEXT_PROFILE, resolveOfficeContextRoute, domainDetail;
if (contextMeta) {
  const [viewModule, contextModule, routeModule] = await Promise.all([
    import('./tycoon-domain-view.js'), import('./office-domain-context.js'), import('./office-context-route.js'),
  ]);
  TycoonDomainView = viewModule.TycoonDomainView;
  CONTEXT_PROFILE = contextModule.CONTEXT_PROFILE;
  resolveOfficeContextRoute = routeModule.resolveOfficeContextRoute;
  domainDetail = routeModule.domainDetail;
}

watchOptionalAssetImages(document);
const $=s=>document.querySelector(s);
const syntheticWorkspace=!releaseBuild&&document.querySelector('meta[name=office-workspace-profile]')?.content===SYNTHETIC_WORKSPACE_PROFILE;
const dynamicWorkspace=!!contextMeta;
let workspaceVerified=false,returnStorage;
let sceneStatePreview={};try{if(syntheticWorkspace)sceneStatePreview=JSON.parse(document.querySelector('#office-synthetic-agent-states')?.textContent||'{}');}catch{}try{returnStorage=dynamicWorkspace?null:sessionStorage;}catch{}
function workspaceGate(){return {...workspaceAccess({verified:workspaceVerified,zuriEnabled:!!buildingUI?.zuriEnabled,synthetic:syntheticWorkspace,demo:mode==='demo',connectionStatus}),synthetic:syntheticWorkspace};}
function renderWorkspaceStatus(){
 const gate=workspaceGate(),office=currentView==='office';
 $('#workspace-notice').hidden=office;$('#workspace-state').textContent=gate.message;
 $('#workspace-notice').dataset.state=gate.kind;
 $('#workspace-pages').hidden=!gate.allowed;$('#workspace-pages').inert=!gate.allowed;
 $('#workspace-blocked').hidden=office||gate.allowed;
 $('#workspace-retry').hidden=gate.allowed;
 chatUI.setVisible(currentView==='chat'&&!document.hidden&&gate.allowed);
}
function openTask(options){const gate=workspaceGate();if(!gate.allowed){toast(gate.message);return;}$('#task-source').textContent=gate.message;taskUI.open(options);}

const outfits=['#F5EFE4','#1F2937','#6B7280','#D6ECFA','#C6A052'];
const skins=['#f1c8a6','#dfaf8c','#b9825b','#82573e'];
// Appearance metadata is independent of business activity and Agent authority.
const appearance=[[0,1,'bob',true],[1,0,'short',false],[3,1,'bun',false],[2,2,'short',true],[0,3,'bob',false],[4,0,'short',false]];
const defaults=profiles.map((profile,i)=>{const [outfit,skin,hair,glasses]=appearance[i%appearance.length];return {id:profile.id,name:profile.name,role:profile.role,status:'offline',currentFile:null,lastLog:'ยังไม่มีสถานะจากระบบต้นทาง',avatar:{outfit:outfits[outfit],skin:skins[skin],hair,glasses}};});
function stored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{toast('เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกการตั้งค่า')}}
function safeAvatar(a,fallback){return{outfit:outfits.includes(a?.outfit)?a.outfit:fallback.outfit,skin:skins.includes(a?.skin)?a.skin:fallback.skin,hair:['short','bob','bun'].includes(a?.hair)?a.hair:fallback.hair,glasses:typeof a?.glasses==='boolean'?a.glasses:fallback.glasses}}
let avatars=stored('zuri-office-avatars',{});avatars=Object.fromEntries(defaults.map((a,i)=>[i,safeAvatar(avatars[i],a.avatar)]));
let mode='live',selected=0,office,preview,avatarDraft,liveSessions=[],liveJobs=[],connectionStatus='offline',liveAssignments=Array.from({length:profiles.length},()=>({id:null,name:''})),lastSync=null,autoAssign=true;

let buildingUI,tycoonUI,officeLoading;
function officePresentation(id){
 if(tycoonUI.data.dynamic&&id!=='studio'){
  const target=resolveOfficeContextRoute(workspaceHash('office',id),tycoonUI.data.state.context),detail=target.kind==='domain'?domainDetail(target.domainKey):target.key==='building'?null:target.key;
  if(detail!==id)history.replaceState(null,'',workspaceHash('office',detail));
  buildingUI.tycoonActive=true;buildingUI.world.hidden=true;buildingUI.hide();tycoonUI.show(detail);if(office)office.suspended=true;return;
 }

 let useTycoon=false;
 if(isOfficeFloor(id)){
  let storage;try{storage=window.localStorage;}catch{}
  const next=new TycoonStore(storage).get(id);
  useTycoon=next?.edition==='tycoon3d';
 }
 buildingUI.tycoonActive=useTycoon;buildingUI.world.hidden=useTycoon;
 if(useTycoon){buildingUI.hide();tycoonUI.show(id);if(office)office.suspended=true;}
 else {tycoonUI.hide();buildingUI.show(id);}
}
let currentView='office',teamContext='',workReviews={},reviewLoading=false,requestedChat=null;
function agents(){if(mode==='live')return roleCards(liveSessions,liveAssignments,avatars,liveJobs,connectionStatus==='live');return defaults.map((a,i)=>({...a,avatar:avatars[i]}));}
function avatarIcon(a){const o=a.avatar;const hairExtra=o.hair==='bob'?'<path d="M5 15h4v13H5zm18 0h4v13h-4z" fill="#403b37"/>':o.hair==='bun'?'<circle cx="22" cy="7" r="4" fill="#403b37"/>':'';return `<svg viewBox="0 0 32 42" aria-hidden="true"><path d="M6 40V29q0-6 10-6t10 6v11" fill="${o.outfit}"/><path d="M12 25h8v17h-8" fill="#1F2937"/><rect x="9" y="8" width="14" height="17" rx="5" fill="${o.skin}"/><path d="M7 15V9q1-8 10-7t9 12l-5-2V8l-9 2-1 5z" fill="#403b37"/>${hairExtra}<circle cx="13" cy="16" r=".9" fill="#1F2937"/><circle cx="20" cy="16" r=".9" fill="#1F2937"/>${o.glasses?'<g fill="none" stroke="#1F2937" stroke-width="1"><circle cx="12.5" cy="16" r="3"/><circle cx="20" cy="16" r="3"/><path d="M16 16h1"/></g>':''}<path d="M14 21h4" stroke="#82573e" stroke-width=".8"/></svg>`}
function textEl(tag,text,className){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3200)}
function currentChatRoute(){return resolveChatRoute(currentView==='chat'?requestedChat:null,profiles,liveSessions,liveJobs,liveAssignments);}
function render(){const route=currentChatRoute();if(route.index>=0)selected=route.index;const team=agents();renderChat(team[selected]);updatePages();}
function select(i){requestedChat=currentView==='chat'?'agent:'+profiles[i].id:null;selected=i;render();office?.select(i)}

const rememberedChats=new Map();
let chatOptionsSignature='',chatAgentSignature='';
function renderChat(a){
 const route=currentChatRoute(),neutral=['choose','unknown'].includes(route.kind);
 const team=agents(),agentSignature=JSON.stringify([selected,neutral,team.map(agent=>[agent.name,agent.role,agent.status,agent.avatar])]);
 if(agentSignature!==chatAgentSignature){
  chatAgentSignature=agentSignature;const list=$('#chat-agent-list');list.replaceChildren();
  team.forEach((agent,i)=>{
   const row=textEl('button','',`agent-row${i===selected&&!neutral?' selected':''}`);row.setAttribute('aria-pressed',String(i===selected&&!neutral));row.setAttribute('aria-label','คุยกับ '+agent.name);
   const avatar=textEl('span','','mini-avatar');avatar.innerHTML=avatarIcon(agent);const info=textEl('span','','agent-info');
   info.append(textEl('span',agent.name,'agent-name'),textEl('span',agent.role,'agent-role'));row.append(avatar,info,textEl('span','',`status-dot ${agent.status}`));row.onclick=()=>select(i);list.append(row);
  });
 }
 $('#chat-avatar').innerHTML=avatarIcon(a);$('#chat-role').textContent=a.role;
 $('#chat-thread-help').textContent=`เลือกเรื่องเก่าของ ${a.name} เพื่อคุยต่อ · “แชทใหม่” เปิดอีกแชท โดยยังใช้บทบาท ${a.role} เดิม`;
 $('#chat-new-task').lastElementChild.textContent='แชทใหม่';
 const choices=mode==='live'?chatChoices(profiles[selected],liveSessions,liveJobs,liveAssignments[selected]):[];
 if(neutral){
  const message=route.kind==='choose'?'เลือกผู้รับจากรายชื่อทีมก่อนเริ่มบทสนทนา':connectionStatus==='live'?'ไม่พบแชทนี้ในบริบทปัจจุบัน · เลือกผู้รับและบทสนทนาใหม่':'กำลังตรวจบทสนทนาที่เลือก…';
  $('#chat-avatar').replaceChildren();$('#chat-role').textContent='';$('#chat-thread').replaceChildren(new Option('ยังระบุบทสนทนาไม่ได้',''));$('#chat-thread').disabled=true;$('#chat-thread-caption').textContent='เลือกบทสนทนา';chatOptionsSignature='';chatUI.empty(route.kind==='choose'?'เลือกผู้รับ':'แชทที่เลือก',message,{selectionRequired:true});return;
 }
 const thread=route.kind==='thread'?route.thread:selectedChat(choices,rememberedChats.get(a.id),a.sessionId);if(thread&&liveJobs.length)rememberedChats.set(a.id,thread);
 const signature=JSON.stringify([a.id,choices,thread]);if(signature!==chatOptionsSignature){chatOptionsSignature=signature;const input=$('#chat-thread');input.replaceChildren(...(choices.length?choices.map(c=>new Option(c.title+(c.pending?' · รอ T3 รับงาน':''),c.id)):[new Option('ยังไม่มีแชทงาน','')]));input.value=thread||'';input.disabled=!choices.length;}
 $('#chat-thread-caption').textContent=choices.find(c=>c.id===thread)?.title||'ยังไม่มีการสนทนา';
 if(thread)chatUI.open(thread,a.name);else chatUI.empty(a.name,mode==='demo'?'โหมดตัวอย่าง · เชื่อมต่อเพื่อคุยจริง':'ยังไม่มีแชท · เริ่มงานใหม่ได้เลย');
 if(currentView==='chat'&&(thread||route.kind==='profile')){requestedChat=chatRouteId(thread,selected,profiles,liveSessions,liveJobs,liveAssignments);const hash=workspaceHash('chat',requestedChat);if(location.hash!==hash)history.replaceState(null,'',hash);acceptedHash=hash;}
}
function focusChat(id,name){const i=profiles.findIndex(p=>p.name===name);if(i<0)return;rememberedChats.set(profiles[i].id,id);selected=i;navigate('chat',true,chatRouteId(id,i,profiles,liveSessions,liveJobs,liveAssignments));}
$('#chat-thread').onchange=()=>{const a=agents()[selected],thread=$('#chat-thread').value;requestedChat=chatRouteId(thread,selected,profiles,liveSessions,liveJobs,liveAssignments);rememberedChats.set(a.id,thread);$('#chat-thread-menu').open=false;render();};
$('#chat-new-task').onclick=()=>openTask({chooseRecipient:['choose','unknown'].includes(currentChatRoute().kind)});

function connectionUI(){
 const isLive=mode==='live'&&connectionStatus==='live';
 $('#disconnect').hidden=mode==='demo';
 document.querySelector('.workspace-settings')?.setAttribute('title',mode==='demo'?'ข้อมูลตัวอย่าง':isLive?'เชื่อมต่อแล้ว':'ตั้งค่าการเชื่อมต่อ');renderWorkspaceStatus();
}
const chatUI=new ChatUI({toast,refresh:()=>client.refresh(),renderMessage:renderRichMessage,disposeMessages:disposeRichMessages,contactTitle:name=>name});
const taskUI=new TaskUI({openWork:id=>navigate('work',true,id),chat:focusChat,getAgent:()=>profiles[selected].id,isDemo:()=>mode==='demo',queueNotice:()=>syntheticWorkspace?'บันทึกงานในคิว synthetic แล้ว · ไม่มี Agent จริงรับงาน':null,toast,refresh:()=>client.refresh()});
const client=new CloudClient({onSnapshot(data){liveSessions=data;if(mode==='live'){if(autoAssign&&data.length){autoAssign=false;liveAssignments=Array.from({length:profiles.length},(_,i)=>({id:data.find(s=>s.name===profiles[i].name)?.id||null,name:''}));saveLive()}render()}},onJobs(data){liveJobs=data.jobs;teamContext=data.context||'';void refreshReviews();if(mode==='live')render();},onState(state){connectionStatus=state.status;if(state.lastSync)lastSync=state.lastSync;$('#connect-feedback').textContent=state.error||'';connectionUI();if(mode==='live')render();}});
const workUI=new WorkView($('#work-content'),{onOpenChat:focusChat,onCreateTask:()=>openTask(),onOpenResults:id=>navigate('results',true,id),toast,refresh:()=>client.refresh(),isDemo:()=>mode==='demo',onSelectionChange(id){if(currentView==='work')history.replaceState(null,'',workspaceHash('work',id));},onReviewChange(review){workReviews[review.jobId]=review;updatePages();}});
const resultsUI=new ResultsView($('#results-content'),{onSelectionChange(id){if(currentView==='results')history.replaceState(null,'',workspaceHash('results',id));},onOpenChat:focusChat,onOpenWork:id=>navigate('work',true,id),toast});
const knowledgeUI=new KnowledgeView($('#knowledge-content'),{autoLoad:false,toast,isDemo:()=>mode==='demo',onContextChange(context){teamContext=context;}});
const inboxUI=new InboxView($('#inbox-content'),{onOpenConnection:openConnect,onOpenWork:id=>navigate('work',true,id),onOpenChat:focusChat,onCreateTask:()=>openTask(),toast,onCount(count){$('#inbox-count').textContent=count;$('#inbox-count').hidden=!count;}});
const teamUI=new TeamPage($('#team-content'),{avatarIcon,onOpenWork:id=>navigate('work',true,id),onChat(i){select(i);navigate('chat');},onTask(i){select(i);openTask();},onAvatar(i){select(i);openAvatar();}});
function updatePages(){const team=agents();buildingUI?.update(team,mode,{jobs:liveJobs,reviews:workReviews,connectionStatus,lastSync});const data={jobs:mode==='demo'?[]:liveJobs,agents:team,reviews:workReviews,sessions:mode==='demo'?[]:liveSessions};workUI.update({...data,dataState:mode==='demo'||connectionStatus==='live'?'ready':connectionStatus==='connecting'?'loading':'unavailable'});resultsUI.update(data);knowledgeUI.update({context:teamContext,active:currentView==='knowledge'&&workspaceGate().allowed});teamUI.update(data);inboxUI.update({...data,connectionStatus:mode==='demo'?'demo':connectionStatus,lastSync});const count=inboxUI.count;if(typeof count==='number'){$('#inbox-count').textContent=count;$('#inbox-count').hidden=!count;}}
async function refreshReviews(){if(reviewLoading)return;reviewLoading=true;try{const response=await fetch(officeApiUrl('work-reviews'),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(response.ok){const data=await response.json();for(const review of data.reviews||[]){const existing=workReviews[review.jobId];if(!existing||Date.parse(review.updatedAt)>=Date.parse(existing.updatedAt))workReviews[review.jobId]=review;}updatePages();}}catch{}finally{reviewLoading=false;}}
let preferenceQueue=Promise.resolve();
function saveLive(){save('zuri-office-desks',{endpoint:'cloud',assignments:liveAssignments});persistPreferences()}
function persistPreferences(){if(mode!=='live')return;const body=JSON.stringify({assignments:liveAssignments,avatars});preferenceQueue=preferenceQueue.catch(()=>{}).then(async()=>{const response=await fetch(officeApiUrl('preferences'),{method:'PUT',headers:{'content-type':'application/json'},body});if(!response.ok)throw new Error();}).catch(()=>toast('บันทึกบนเว็บไม่สำเร็จ การตั้งค่ายังอยู่ในอุปกรณ์นี้'))}
function openDialog(id){const d=$(id);if(!d.open)d.showModal()}
function openConnect(){if(buildingUI?.zuriEnabled){buildingUI.openZuriConnection();return;}openDialog('#connect-dialog')}
function zuriConnectionUI(state){
 if(!state?.enabled)return;
 document.querySelector('.workspace-settings')?.setAttribute('title',state.state==='READY'?'Zuri · '+(state.businessName||'เชื่อมต่อแล้ว'):'เชื่อมต่อ Zuri');
}
async function startLive(){client.disconnect();mode='live';liveSessions=[];const saved=stored('zuri-office-desks',{});try{const response=await fetch(officeApiUrl('preferences'),{cache:'no-store'});if(!response.ok)throw new Error();const prefs=await response.json();if(prefs.assignments){liveAssignments=prefs.assignments;autoAssign=false;}else if(saved.endpoint==='cloud'&&saved.assignments?.length===profiles.length){liveAssignments=saved.assignments;autoAssign=false;}if(prefs.avatars)avatars=Object.fromEntries(defaults.map((a,i)=>[i,safeAvatar(prefs.avatars[i],a.avatar)]));}catch{if(saved.endpoint==='cloud'&&saved.assignments?.length===profiles.length){liveAssignments=saved.assignments;autoAssign=false;}}render();connectionUI();await client.connect();}
$('#connect-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('#connect-submit');button.disabled=true;try{await startLive();$('#connect-dialog').close();}finally{button.disabled=false;}});
function useDemo(){if(knowledgeUI.dirty||knowledgeUI.saving||knowledgeUI.libraryBusy){toast('มีร่างความรู้ทีมค้างอยู่ · บันทึกหรือคืนค่าร่างก่อนเปิดตัวอย่าง');return;}client.disconnect();teamContext='';workReviews={};mode='demo';connectionUI();render();$('#connect-dialog').close();toast('กำลังแสดงออฟฟิศตัวอย่าง')}
$('#use-demo').onclick=useDemo;$('#disconnect').onclick=()=>{client.disconnect();liveSessions=liveSessions.map(a=>({...a,status:'offline'}));connectionStatus='offline';render();connectionUI();$('#connect-dialog').close();toast('ยกเลิกการเชื่อมต่อแล้ว')};
async function openAvatar(){avatarDraft={...avatars[selected]};$('#avatar-subtitle').textContent=`${agents()[selected].name} · โต๊ะ ${String(selected+1).padStart(2,'0')}`;openDialog('#avatar-dialog');try{preview?.dispose();preview=(await import('./office.js')).avatarPreview($('#avatar-preview'),avatarDraft)}catch{$('#avatar-preview').textContent='อุปกรณ์นี้ไม่รองรับ WebGL'}renderAvatarControls()}
function renderAvatarControls(){for(const [key,colors] of [['outfit',outfits],['skin',skins]]){const wrap=$('#'+key+'-options');wrap.replaceChildren();colors.forEach((color,i)=>{const b=document.createElement('button');b.className='swatch';b.style.background=color;b.setAttribute('aria-label',`${key==='skin'?'สีผิว':'เสื้อ'} ${i+1}`);b.setAttribute('aria-pressed',String(avatarDraft[key]===color));b.onclick=()=>{avatarDraft[key]=color;preview?.update(avatarDraft);renderAvatarControls()};wrap.append(b)})}document.querySelectorAll('[data-hair]').forEach(b=>b.classList.toggle('active',b.dataset.hair===avatarDraft.hair));$('#avatar-glasses').checked=avatarDraft.glasses}
document.querySelectorAll('[data-hair]').forEach(b=>b.onclick=()=>{avatarDraft.hair=b.dataset.hair;preview?.update(avatarDraft);renderAvatarControls()});$('#avatar-glasses').onchange=e=>{avatarDraft.glasses=e.target.checked;preview?.update(avatarDraft)};
$('#save-avatar').onclick=()=>{avatars[selected]={...avatarDraft};save('zuri-office-avatars',avatars);persistPreferences();$('#avatar-dialog').close();render();toast('บันทึก avatar แล้ว')};$('#avatar-dialog').addEventListener('close',()=>{preview?.dispose();preview=null});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{if(b.dataset.action==='connect')openConnect();else if(b.dataset.action==='help')openDialog('#help-dialog');else if(b.dataset.action==='task')openTask();});

let acceptedHash=location.hash,lastOfficeDetail=readReturnFloor(returnStorage);
function navigate(destination,record=true,id=null,leaveConfirmed=false){
 const studio=buildingUI?.isStudio?buildingUI.studio:null;
 const editor=studio?.mode==='tycoon'?studio.tycoon:studio?.mode==='native'?studio.native:studio?.mode==='hybrid'?studio.hybrid:null;
 const dirty=editor?.dirty||editor?.saving||editor?.history?.dirty||editor?.hasUnsavedFloor?.();
 if(dirty&&!leaveConfirmed&&!editor.leaveApproved){history.replaceState(null,'',acceptedHash);return editor.requestLeave(()=>navigate(destination,record,id,true),()=>history.replaceState(null,'',acceptedHash));}
 destination=workspaceRoute('#'+destination).view;currentView=destination;requestedChat=destination==='chat'?id:null;if(destination==='office'&&id!==null){lastOfficeDetail=id;writeReturnFloor(returnStorage,id);}document.body.classList.toggle('idle-active',destination==='office');
 document.body.classList.toggle('chat-screen',destination==='chat');renderWorkspaceStatus();
 $('.workspace-header').hidden=destination==='office';$('.workspace-dock').hidden=destination==='office';
 $('#workspace-title').textContent={chat:'แชททีม',work:'งาน',results:'ผลงานและไฟล์',knowledge:'ความรู้ทีม',team:'ทีม',inbox:'แจ้งเตือน'}[destination]||'ออฟฟิศ';
 $('#office-view').hidden=destination!=='office';$('#chat-view').hidden=destination!=='chat';
 for(const view of ['work','results','knowledge','team','inbox'])$('#'+view+'-page').hidden=destination!==view;
 if(record){const hash=workspaceHash(destination,id);if(location.hash!==hash)history.pushState(null,'',hash);}
 document.querySelectorAll('[data-nav]').forEach(b=>{const active=b.dataset.nav===destination;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current');});
 $('#workspace-more').classList.toggle('active',['knowledge','team','inbox'].includes(destination));
 if($('#more-dialog').open)$('#more-dialog').close();
 if(destination==='knowledge')knowledgeUI.update({context:teamContext,active:workspaceGate().allowed});
 if(destination==='work'){if(id)workUI.open(id);else workUI.back();}else if(destination==='results')resultsUI.open(id);else if(destination==='team')teamUI.open(id);
 if(destination==='office'&&tycoonUI)officePresentation(id);else {buildingUI?.hide();tycoonUI?.hide();}if(office)office.suspended=destination!=='office'||!!buildingUI?.tycoonActive||!buildingUI?.domain;
 const target=$(destination==='office'?(buildingUI?.tycoonActive?'.tycoon-world':'.office-world'):destination==='chat'?'#chat-view':'#'+destination+'-page');if(destination==='office'){target?.scrollIntoView({behavior:'instant',block:'start'});target?.querySelector('h1')?.focus({preventScroll:true});}else{document.documentElement.scrollTop=0;document.body.scrollTop=0;target?.focus({preventScroll:true});}
 if(destination==='chat')render();
 acceptedHash=workspaceHash(destination,destination==='chat'?requestedChat:id);
 document.title={office:'Zuri Office World',chat:'แชททีม',work:'งาน',results:'ผลงานและไฟล์',knowledge:'ความรู้ทีม',team:'ทีม',inbox:'แจ้งเตือน'}[destination]+' · zuri office';
}
function restoreView(){const route=workspaceRoute(location.hash);navigate(route.view,false,route.id);}
window.addEventListener('popstate',restoreView);
window.addEventListener('hashchange',restoreView);
client.setVisible(!document.hidden);
document.addEventListener('visibilitychange',()=>{chatUI.setVisible(currentView==='chat'&&!document.hidden&&workspaceGate().allowed);void client.setVisible(!document.hidden);});
$('#task-open-knowledge').onclick=()=>{$('#task-dialog').close();navigate('knowledge');};
$('#workspace-more').onclick=()=>openDialog('#more-dialog');
$('#workspace-retry').onclick=()=>buildingUI?.zuriEnabled&&!syntheticWorkspace?openConnect():client.refresh();
document.querySelectorAll('#more-dialog [data-action]').forEach(button=>button.addEventListener('click',()=>$('#more-dialog').close()));
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav,true,b.dataset.nav==='office'?lastOfficeDetail:null));
buildingUI=new BuildingView($('#office-view'),{avatarIcon,getWorkspaceAccess:workspaceGate,getAgentStatePreview:key=>syntheticWorkspace&&Array.isArray(sceneStatePreview[key])?sceneStatePreview[key]:null,onNativeSceneNeeded:ensureNativeOffice,onNavigate:key=>navigate('office',true,key),onChat:id=>{const i=profiles.findIndex(p=>p.id===id);if(i>=0){select(i);navigate('chat');}},onTask:id=>{const i=profiles.findIndex(p=>p.id===id);if(i>=0){select(i);openTask();}},onConnect:openConnect,onConnectionState:zuriConnectionUI,onOpenPage:(page,id)=>navigate(page,true,id),onNewTask:options=>openTask(options)});
let tycoonStorage;try{tycoonStorage=window.localStorage;}catch{}
const dynamicCandidate=!!contextMeta&&contextMeta.content===CONTEXT_PROFILE;
const frozenContextClock=Date.parse(document.querySelector('meta[name=office-context-wall-clock]')?.content||'');
const OfficeSurface=dynamicCandidate?TycoonDomainView:TycoonView;
tycoonUI=new OfficeSurface($('#office-view'),{dataOptions:{wallNow:()=>Number.isFinite(frozenContextClock)?frozenContextClock:Date.now()},storage:tycoonStorage,onNavigate:(key,{replace=false}={})=>{if(replace)history.replaceState(null,'',workspaceHash('office',key));navigate('office',!replace,key);},onLegacy:async key=>{const hash=location.hash,ok=await new TycoonStore(tycoonStorage).select(key,'legacy');if(location.hash!==hash)return;if(ok)navigate('office',false,key);else toast('ยังบันทึก edition ไม่ได้ · อยู่ในฉากเดิม');},onStudio:async key=>{const hash=location.hash,ok=await new TycoonStore(tycoonStorage).select(key,'tycoon3d');if(location.hash!==hash)return;if(!ok){toast('ยังบันทึก edition ไม่ได้ · อยู่ในฉากเดิม');return;}buildingUI.domain=null;buildingUI.isLobby=false;buildingUI.studioFloor=key;navigate('office',true,'studio');}});
// The prototype's Work button is a domain board, so expose workspace routes
// explicitly without replacing its scoped board/Ask actions.
const workspaceMenu=document.createElement('button');workspaceMenu.type='button';workspaceMenu.dataset.workspaceMenu='';workspaceMenu.setAttribute('aria-label','พื้นที่ทำงานเพิ่มเติม');workspaceMenu.innerHTML=icon('menu')+'<span>เพิ่มเติม</span>';workspaceMenu.onclick=()=>openDialog('#more-dialog');tycoonUI.host.querySelector('.tycoon-dock').append(workspaceMenu);
hydrateIcons();render();connectionUI();restoreView();document.body.removeAttribute('data-app-boot');void Promise.resolve(buildingUI.zuriReady).then(()=>{workspaceVerified=true;if(!buildingUI.zuriEnabled||syntheticWorkspace)return startLive();renderWorkspaceStatus();});
// The Native editor and saved native floors still use this renderer. No hidden
// dashboard renderer is allocated for painted, hybrid, Lobby or building routes.
async function ensureNativeOffice(){
 if(office||officeLoading)return;
 officeLoading=(async()=>{
  try{const {Office}=await import('./office.js');await document.fonts.ready;
   office=new Office($('#scene'),{onSelect:i=>buildingUI.select(i)});await office.load();buildingUI.attachOffice(office);
  }catch(error){office?.dispose();office=null;console.error('Office renderer could not load:',error.message);const note=$('#scene-loading');note.hidden=false;note.textContent='ไม่สามารถแสดงโมเดล 3D ได้ · เปิด Design Studio เพื่อเลือกฉากที่รองรับ';}
 })();await officeLoading;
}
