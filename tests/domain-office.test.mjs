import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {domainFloors, domainSource, floorByKey, floorAgents} from '../web/domain-office.js';
import {BuildingView, officePulse} from '../web/building-view.js';
import {profiles} from '../web/agent-profiles.js';
import {RoomStore,starterRoom,defaultOfficeRoom} from '../web/hybrid-state.js';
import {defaultNativeRoom} from '../web/native-state.js';
import {applyOfficeBlueprint} from '../web/office-blueprints.js';

test('each operational Zuri navigation domain has one floor, and legacy agents have one owner', () => {
  const keys = ['commerce','customer','market','growth','operations','people','projects','assets','line-oa','inventory','warehouse','procurement','knowledge','platform'];
  assert.deepEqual(domainFloors.map(d => d.key).sort(), keys.sort());
  assert.equal(domainSource.lobbyKey, 'business-home');
  assert.equal(new Set(domainFloors.map(d => d.number)).size, 14);
  assert.deepEqual(domainFloors.filter(d => d.reserved).map(d => d.key).sort(), ['operations','warehouse']);
  const roles = domainFloors.flatMap(d => d.roles);
  assert.equal(roles.length, 56);
  assert.deepEqual(roles.map(r => r.sourceAgentId).filter(Boolean).sort(), profiles.map(p => p.id).sort());
  for (const domain of domainFloors) {
    assert.equal(new Set(domain.roles.map(r => r.key)).size, domain.roles.length);
    assert.ok(domain.roles.every(r => r.responsibility && r.output && r.title));
  }
  assert.equal(floorByKey('crm'), null);
  assert.equal(floorByKey('scm'), null);
});

test('role designs never borrow another domain session or report simulated work as live', () => {
  const connected = [{id:'pim',sessionId:'customer-thread',status:'working',lastLog:'Customer task'}, {id:'mira',sessionId:'marketing-thread',status:'stuck',lastLog:'Marketing task'}];
  const customer = floorAgents(floorByKey('customer'), connected);
  assert.equal(customer[0].sessionId, 'customer-thread');
  assert.equal(customer[0].status, 'working');
  assert.equal(customer[0].connected, true);
  assert.ok(customer.slice(1).every(a => !a.connected && !a.sessionId && a.status === 'idle'));
  assert.ok(floorAgents(floorByKey('procurement'), connected).every(a => !a.connected && !a.sessionId));
  const demo = floorAgents(floorByKey('customer'), connected, 'demo');
  assert.ok(demo.every(a => a.blueprint && a.status === 'idle' && !a.sessionId));
  assert.notEqual(demo[0].lastLog, 'Customer task');
  assert.equal(floorAgents(floorByKey('growth'), [{id:'mira',status:'working'}])[0].connected, false);
});

function setup(t, {loadStudio,url='about:blank'} = {}) {
  const dom = new JSDOM('<main id="office-view"></main>',{url});
  const saved = {document:globalThis.document,Option:globalThis.Option};
  globalThis.document = dom.window.document; globalThis.Option = dom.window.Option;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  t.after(() => { for (const [key,value] of Object.entries(saved)) if(value===undefined)delete globalThis[key];else globalThis[key]=value; dom.window.close(); });
  const navigation = [], chats = [], tasks = [], scene = [], pages = [], actions = [];
  const view = new BuildingView(document.querySelector('main'), {onNavigate:key=>navigation.push(key),onChat:id=>chats.push(id),onTask:id=>tasks.push(id),onOpenPage:(...args)=>pages.push(args),onConnect:()=>actions.push('connect'),onNewTask:()=>actions.push('task'),avatarIcon:()=>'',loadStudio});
  view.attachOffice({view:'building',showBuilding:(_,enter)=>scene.push(['building',enter]),showDomain:(domain,agents)=>scene.push([domain.key,agents]),select:index=>scene.push(['select',index]),highlightFloor(){}});
  return {view,navigation,chats,tasks,scene,pages,actions};
}

test('cold native floor binds late renderer touch controls and restores them on leaving',async t=>{
 const {view}=setup(t,{url:'https://office.test'});await view.zuriReady;
 view.zuriEnabled=false;
 new RoomStore(view.root.ownerDocument.defaultView.localStorage).applyNative('projects',defaultNativeRoom());
 view.office=null;view.show('projects');assert.equal(view.appliedScene,null);
 const touches={ONE:0,TWO:2},controls={touches};
 const viewport=view.floorViewport;viewport.zoomTo(1.5);
 view.attachOffice({controls,showDomain(){},setNativeRoom(){}});
 assert.deepEqual(controls.touches,{ONE:null,TWO:null});assert.equal(view.floorViewport,viewport);assert.equal(viewport.zoom,1.5);
 view.hide();assert.equal(controls.touches,touches);
});

test('floors use a frameless scene with contextual team details, closed on navigation',async t=>{
 const {view}=setup(t,{url:'https://office.test'});t.after(()=>view.hide());await view.zuriReady;view.show('projects');
 const dialog=view.world.querySelector('.floor-team-dialog');
 assert.ok(view.world.classList.contains('floor-immersive'));assert.equal(dialog.open,false);
 view.world.querySelector('[data-floor-tool="team"]').click();assert.equal(dialog.open,true);
 assert.ok(dialog.contains(view.directory));assert.equal(view.directory.querySelectorAll('[data-role-index]').length,4);
 view.world.querySelector('.floor-team-close').click();assert.equal(dialog.open,false);
 view.world.querySelector('[data-floor-tool="team"]').click();view.show('lobby');assert.equal(dialog.open,false);
 assert.equal(view.world.classList.contains('floor-immersive'),false);
 view.show('projects');view.world.querySelector('[data-floor-tool="floors"]').click();assert.equal(view.sheet.open,true);
 view.hide();assert.equal(dialog.open,false);
});

test('Visual Office door clicks save the current floor and reject a later stale click',async t=>{
  const {view}=setup(t,{url:'https://office.test'});t.after(()=>view.hide());await view.zuriReady;
  const storage=view.root.ownerDocument.defaultView.localStorage,store=new RoomStore(storage),r=applyOfficeBlueprint({...starterRoom(),objects:[]},'medium');
  store.apply('preview:projects',r);view.show('projects');const objects=JSON.stringify(view.appliedScene.room.objects);
  view.appliedHost.querySelector('[data-door="entry"]').click();
  assert.equal(new RoomStore(storage).floor('projects').blueprintPlan.door.open,false);assert.equal(JSON.stringify(view.appliedScene.room.objects),objects);assert.equal(new RoomStore(storage).floor('customer'),null);
  const fresh=new RoomStore(storage),changed={...fresh.floor('projects'),name:'Changed elsewhere'};fresh.apply('preview:projects',changed);
  view.appliedHost.querySelector('[data-door="entry"]').click();assert.match(view.appliedHost.querySelector('.hy-door-status').textContent,/หน้าอื่น/);assert.equal(new RoomStore(storage).floor('projects').blueprintPlan.door.open,false);
});

test('design studio exits cleanly and a late import cannot mount after navigation away',async t=>{
  let resolve,creates=0,disposals=0;
  const pending=new Promise(r=>{resolve=r;});
  const {view,navigation}=setup(t,{loadStudio:()=>pending});
  document.querySelector('.studio-entry').click();assert.equal(navigation.at(-1),'studio');
  view.show('studio');assert.equal(view.domain,null);assert.equal(view.office.suspended,true);
  view.show('lobby');
  resolve({DesignStudio:class {constructor(){creates++;}dispose(){disposals++;}}});
  await pending;await Promise.resolve();assert.equal(creates,0);
  view.show('studio');await pending;await Promise.resolve();
  assert.equal(creates,1);assert.equal(view.studioHost.hidden,false);
  view.hide();assert.equal(disposals,1);assert.equal(view.studio,null);
  view.show('lobby');assert.equal(view.studioHost.hidden,true);
});

test('custom decor stays isolated while the default hybrid art appears on local floors',async t=>{
  const {view,navigation}=setup(t);
  t.after(()=>view.hide());
  let stored,reads=0;const storage={getItem:()=>{reads++;return stored;},setItem:(_,v)=>{stored=v;}};
  Object.defineProperty(view.root.ownerDocument.defaultView,'localStorage',{value:storage});
  const store=new RoomStore(storage),room=starterRoom();room.name='Custom preview room';
  store.apply('preview:customer',room);store.apply('preview:lobby',room);
  await view.zuriReady;
  view.show('customer');
  assert.equal(view.appliedHost.querySelector('strong').textContent,'Custom preview room');
  assert.equal(view.office.suspended,true);
  view.appliedHost.querySelectorAll('button')[1].click();assert.equal(navigation.at(-1),'studio');
  view.show('growth');assert.ok(view.appliedHost.classList.contains('is-default-floor'));assert.match(view.appliedHost.querySelector('strong').textContent,/Marketing/);assert.equal(view.office.suspended,true);
  view.show('lobby');assert.ok(view.appliedHost);assert.equal(view.lobby.root.hidden,false);
  view.appliedHost.querySelector('.hy-applied-services button').click();
  assert.equal(view.lobby.reception.open,true);view.lobby.reception.close();
  view.show('customer');reads=0;view.zuriEnabled=true;view.renderAppliedRoom();view.syncScene();
  assert.ok(view.appliedHost.classList.contains('is-default-floor'));
  assert.notEqual(view.appliedHost.querySelector('strong').textContent,'Custom preview room');
  assert.equal(view.appliedHost.querySelectorAll('.hy-object[data-kind^="avatar-"]').length,floorByKey('customer').roles.length);
  assert.match(view.appliedHost.querySelector('.hy-object-note').textContent,/ไม่ใช่สถานะ agent/);
  assert.equal(view.world.classList.contains('has-hybrid-floor'),true);
  assert.equal(reads,0);assert.equal(view.office.suspended,true);
  view.zuriEnabled=false;view.show('customer');const old=view.appliedHost;
  view.hide();assert.equal(old.isConnected,false);assert.equal(view.appliedScene,null);
});

test('an uncustomized local domain floor starts with the shared painted hybrid scene without saving demo state',async t=>{
  const {view}=setup(t);let stored;
  t.after(()=>view.hide());
  const storage={getItem:()=>stored,setItem:(_,value)=>{stored=value;}};
  Object.defineProperty(view.root.ownerDocument.defaultView,'localStorage',{value:storage});
  const domain=floorByKey('projects');

  await view.zuriReady;
  view.show(domain.key);

  assert.ok(view.appliedScene);
  assert.equal(view.appliedScene.room.sceneSheet,'office-sheet/v1');assert.equal(view.appliedHost.querySelector('.hy-background').getAttribute('src'),null);
  assert.equal(view.appliedHost.querySelectorAll('.hy-object[data-kind="work-desk"]').length,domain.roles.length);
  assert.equal(view.appliedHost.querySelectorAll('.hy-object[data-kind="task-chair"]').length,domain.roles.length);
  assert.equal(view.appliedHost.querySelectorAll('.hy-object[data-kind^="avatar-"]').length,domain.roles.length);
  assert.equal(view.office.suspended,true);
  assert.equal(stored,undefined);
});

test('restoring a local floor returns to the shared art direction instead of the legacy blocky fallback',async t=>{
  const {view}=setup(t);let stored;
  t.after(()=>view.hide());
  const storage={getItem:()=>stored,setItem:(_,value)=>{stored=value;}};
  Object.defineProperty(view.root.ownerDocument.defaultView,'localStorage',{value:storage});
  const domain=floorByKey('customer');
  await view.zuriReady;
  const store=new RoomStore(storage);
  assert.equal(store.apply(`preview:${domain.key}`,starterRoom()),true);
  view.show(domain.key);
  assert.equal(view.appliedHost.classList.contains('is-default-floor'),false);
  assert.equal(new RoomStore(storage).unapply(`preview:${domain.key}`),true);
  view.show(domain.key);
  assert.equal(view.appliedHost.classList.contains('is-default-floor'),true);
  assert.equal(view.appliedHost.querySelector('.hy-background').getAttribute('src'),'./assets/office-world/hybrid/backgrounds/office-isometric-v4.png');
});

test('an original-edition floor preview uses the current default art baseline',t=>{
  const {view}=setup(t,{url:'https://office.test/?office-edition=original'}),storage=view.root.ownerDocument.defaultView.localStorage;
  const custom={...starterRoom(),name:'Saved local customization'};
  new RoomStore(storage).apply('preview:projects',custom);
  view.show('projects');
  assert.ok(view.appliedHost.classList.contains('is-default-floor'));
  assert.match(view.appliedHost.querySelector('strong').textContent,/Projects & Work/);
  assert.equal(view.appliedScene.room.sceneSheet,'office-sheet/v1');assert.equal(view.appliedHost.querySelector('.hy-background').getAttribute('src'),null);
  assert.equal(view.appliedHost.querySelector('.hy-applied-header button:nth-of-type(2)').hidden,true);
});

test('actual Office consumes the saved native floor, exposes interactions and resets for other floors or connected scope',t=>{
  const {view,navigation}=setup(t);let data;
  const storage={getItem:()=>data,setItem:(_,v)=>{data=v;}};
  Object.defineProperty(view.root.ownerDocument.defaultView,'localStorage',{value:storage});
  const room=defaultNativeRoom();room.objects[0].x=-1;
  room.objects[0].interaction={type:'popup',title:'Planning',body:'Saved floor'};
  new RoomStore(storage).applyNative('projects',room);
  let applied;view.office.setNativeRoom=r=>{applied=r;};
  view.show('projects');assert.deepEqual(applied,room);assert.equal(view.office.suspended,false);
  const buttons=view.nativeActionList.querySelectorAll('button');buttons[0].click();assert.equal(navigation.at(-1),'studio');
  buttons[1].click();assert.equal(view.world.querySelector('.native-popup p').textContent,'Saved floor');
  view.show('customer');assert.deepEqual(applied,defaultNativeRoom());assert.equal(view.world.querySelector('.native-popup'),null);
  view.show('projects');assert.equal(applied.objects[0].x,-1);
  view.zuriEnabled=true;view.applyZuriMode(true);assert.deepEqual(applied,defaultNativeRoom());assert.equal(view.nativeActionList,null);
});

test('tower, elevator, role selection, reserved floors and existing-role actions use the right identities', t => {
  const {view,navigation,chats,tasks,scene} = setup(t);
  assert.equal(document.querySelectorAll('.floor-stop').length,14);
  assert.deepEqual([...document.querySelector('.floor-directory').children].map(button=>button.dataset.floorKey),[...domainFloors].reverse().map(domain=>domain.key).concat('lobby'));
  document.querySelector('[data-floor-key="procurement"]').click();
  assert.deepEqual(navigation,['procurement']);
  view.show('procurement');
  assert.match(document.querySelector('h1').textContent,/Procurement/);
  assert.equal(view.sheet.querySelector('[aria-current="location"]').dataset.floorKey,'procurement');
  assert.equal(view.sheet.querySelector('.directory-level').textContent,'09');
  view.world.querySelector('[data-floor-tool="team"]').click();
  document.querySelector('[data-role-index="3"]').click();
  assert.match(document.querySelector('.floor-role-detail').textContent,/Receiving Reviewer/);
  assert.equal(document.querySelector('.floor-role-detail button'),null);
  assert.deepEqual(scene.at(-1),['select',3]);
  const focused = document.querySelector('[data-role-index="3"]'); focused.focus();
  view.update([], 'live');
  assert.equal(document.activeElement,focused);
  assert.equal(document.querySelector('[data-role-index="3"]'),focused);
  view.show('warehouse');
  assert.match(document.querySelector('.floor-reserved-note').textContent,/ยังสำรอง/);
  assert.equal(document.querySelector('.world-primary'),null);
  view.show('customer');
  document.querySelector('.world-primary').click(); assert.deepEqual(tasks,['pim']);
  view.update([{id:'pim',sessionId:'customer-thread',status:'idle'}],'live');
  document.querySelector('.world-primary').click(); assert.deepEqual(chats,['pim']);
  view.update([], 'demo'); assert.equal(document.querySelector('.world-primary'),null);
  view.show('invalid-domain'); assert.equal(document.querySelectorAll('.floor-stop').length,14);
  view.lift.value='knowledge'; view.lift.dispatchEvent(new document.defaultView.Event('change'));
  assert.equal(navigation.at(-1),'knowledge');
  document.querySelector('.world-back').click(); assert.equal(navigation.at(-1),'lobby');
});

test('idle HUD separates observed work, human review, and unknown or simulated state', () => {
  const now = Date.parse('2026-10-20T10:00:00Z');
  const data = {now,lastSync:'2026-10-20T09:59:58Z',connectionStatus:'live',
    agents:[{sessionId:'one',status:'working'},{sessionId:'one',status:'idle'},{sessionId:'two',status:'offline'},{id:'blueprint'}],
    jobs:[{id:'run',status:'running'},{id:'run',status:'running'},{id:'queue',status:'queued'},{id:'done',status:'done'},{id:'accepted',status:'done'},{id:'cancelled',status:'cancelled'},{id:'failed',status:'error'}],
    reviews:{accepted:{reviewStatus:'accepted'}}};
  const live = officePulse(data);
  assert.deepEqual([live.known,live.active,live.online,live.attention],[true,2,1,2]);
  assert.deepEqual(live.items.map(item=>item.type),['error','review']);
  for (const overrides of [{mode:'demo'},{connectionStatus:'offline'},{connectionStatus:'retrying'},{lastSync:null},{now:now+31000}]) {
    const unknown=officePulse({...data,...overrides});
    assert.deepEqual([unknown.known,unknown.active,unknown.online,unknown.attention],[false,null,null,null]);
  }
});

test('idle building enters ground floor before the elevator and preserves business action routing', t => {
  const {view,navigation,pages,actions} = setup(t);
  assert.equal(view.office.suspended,true);
  document.querySelector('.building-hotspot').click(); assert.equal(navigation.at(-1),'lobby');assert.equal(view.sheet.open,false);
  view.show('lobby');assert.equal(view.lobby.root.hidden,false);assert.equal(view.office.suspended,true);
  assert.equal(view.sheet.querySelector('[aria-current="location"]').dataset.floorKey,'lobby');
  assert.equal(view.sheet.querySelectorAll('[aria-current="location"]').length,1);
  assert.equal(view.sheet.querySelector('.directory-level').textContent,'G');
  document.querySelector('.lobby-elevator').click();assert.equal(view.sheet.open,true);
  document.querySelector('.sheet-close').click(); assert.equal(view.sheet.open,false);
  document.querySelector('[data-world-page="floors"]').click(); assert.equal(view.sheet.open,true);
  document.querySelector('[data-floor-key="customer"]').click();
  assert.equal(view.sheet.open,false); assert.equal(navigation.at(-1),'customer');
  for(const page of ['work','chat','results']) document.querySelector(`[data-world-page="${page}"]`).click();
  assert.deepEqual(pages,[['work'],['chat'],['results']]);
  document.querySelector('.idle-mission').click(); assert.deepEqual(actions,['connect']);
  const now=Date.parse('2026-10-20T10:00:00Z');
  const data={connectionStatus:'live',lastSync:new Date(now).toISOString(),now,jobs:[{id:'review-me',title:'Deliverable',status:'done'}]};
  view.update([], 'live', data);
  assert.equal(document.querySelector('[data-resource="attention"] strong').textContent,'1');
  document.querySelector('.idle-mission').click(); assert.deepEqual(pages.at(-1),['work','review-me']);
  view.update([], 'live', {...data,reviews:{'review-me':{reviewStatus:'accepted'}}});
  document.querySelector('.idle-mission').click(); assert.equal(actions.at(-1),'task');
  view.update([], 'live', {...data,connectionStatus:'offline'});
  assert.equal(document.querySelector('[data-resource="attention"] strong').textContent,'—');
  view.show('customer'); assert.equal(view.office.suspended,true);
  view.root.hidden=true;view.update([], 'live');assert.equal(view.office.suspended,true);
});

test('ground floor reception, knowledge and lounge use existing flows; leaving closes modals', t => {
  const {view,navigation,pages,actions}=setup(t);
  document.querySelector('.enter-building').click();assert.equal(navigation.at(-1),'lobby');assert.equal(view.sheet.open,false);
  view.show('lobby');assert.match(document.querySelector('h1').textContent,/ชั้น G/);
  document.querySelector('.lobby-reception').click();assert.equal(view.lobby.reception.open,true);
  document.querySelector('[data-reception="task"]').click();assert.equal(actions.at(-1),'task');assert.equal(view.lobby.reception.open,false);
  document.querySelector('.lobby-reception').click();document.querySelector('[data-reception="elevator"]').click();assert.equal(view.sheet.open,true);
  document.querySelector('.lobby-stop').click();assert.equal(navigation.at(-1),'lobby');assert.equal(view.sheet.open,false);
  document.querySelector('.lobby-lounge').click();document.querySelector('.lobby-knowledge').click();assert.deepEqual(pages,[['chat'],['knowledge']]);
  document.querySelector('.lobby-reception').click();view.hide();assert.equal(view.lobby.reception.open,false);assert.equal(view.lobby.root.hidden,true);
  view.show('lobby');document.querySelector('.lobby-exit').click();assert.equal(navigation.at(-1),null);
});

test('lobby board uses exact live job identity, rejects stale actions, and preserves polling focus', t => {
  const {view,pages,actions}=setup(t);view.show('lobby');
  document.querySelector('.lobby-board').click();assert.match(document.querySelector('.lobby-board-content').textContent,/ยังไม่มีข้อมูลสด/);
  document.querySelector('[data-board-action="connect"]').click();assert.equal(actions.at(-1),'connect');
  const now=Date.parse('2026-10-20T10:00:00Z');const data={now,lastSync:new Date(now).toISOString(),connectionStatus:'live',jobs:[{id:'result-1',status:'done',title:'Report <script>bad()</script>'}]};
  view.update([], 'live', data);document.querySelector('.lobby-board').click();
  const result=document.querySelector('.lobby-work-item');result.focus();
  assert.equal(document.querySelector('.lobby-board-content script'),null);
  view.update([], 'live', data);assert.equal(document.activeElement,result);
  result.click();assert.deepEqual(pages.at(-1),['work','result-1']);
  document.querySelector('.lobby-board').click();const stale=document.querySelector('.lobby-work-item');stale.focus();
  view.update([], 'live', {...data,connectionStatus:'offline'});
  assert.equal(document.querySelector('.lobby-work-item'),null);assert.equal(document.activeElement,view.lobby.board.querySelector('.sheet-close'));
  const count=pages.length;stale.click();assert.equal(pages.length,count);
  view.update([], 'live', {...data,reviews:{'result-1':{reviewStatus:'accepted'}}});assert.equal(document.querySelector('.lobby-work-item'),null);
  document.querySelector('[data-board-action="task"]').click();assert.equal(actions.at(-1),'task');
});

test('explicit local art preview shows the same saved sheet as Studio even with synthetic connector enabled',async t=>{const {view}=setup(t,{url:'https://office.test'});t.after(()=>view.hide());await view.zuriReady;const doc=view.root.ownerDocument,meta=doc.createElement('meta');meta.name='office-art-preview';meta.content='legacy';doc.head.append(meta);const room={...defaultOfficeRoom(floorByKey('projects')),name:'Local sheet saved in Studio'};new RoomStore(doc.defaultView.localStorage).apply('preview:projects',room);view.zuriEnabled=true;view.show('projects');assert.equal(view.appliedScene.room.name,room.name);assert.equal(view.appliedScene.room.sceneSheet,'office-sheet/v1');assert.equal(view.appliedHost.querySelector('.hy-background').getAttribute('src'),null);});
