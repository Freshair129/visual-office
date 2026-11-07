import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {openFloorTasks, projectFloorTasks} from '../web/floor-tasks.js';

const fresh = () => new Date().toISOString();
const live = () => ({connectionStatus: 'live', lastSync: fresh(), mode: 'live'});
const floor = {key: 'projects', label: 'ทีมโครงการ', number: 4};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('a live fixture built after an import delay remains fresh', t => {
  t.mock.timers.enable({apis: ['Date'], now: Date.now() + 10 * 60_000});
  const result = projectFloorTasks(floor.key, {
    ...live(),
    jobs: [{id: 'fresh', title: 'Fresh work', status: 'running', domainKey: floor.key}],
  });
  assert.equal(result.state, 'READY');
  assert.equal(result.items[0].id, 'fresh');
});

test('reserved floor board never reads an operational feed or offers a work action',async t=>{
 const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());const root=dom.window.document.querySelector('main');
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};let reads=0;
 const dialog=openFloorTasks(root,{floor:{key:'warehouse',label:'Warehouse',reserved:true},getTasks:()=>{reads++;return{state:'EMPTY',source:'Synthetic',items:[]};},onOpenWork:()=>{}});
 await tick();assert.equal(reads,0);assert.match(dialog.textContent,/พื้นที่เตรียมการ/);assert.equal(dialog.querySelector('[data-open-work]'),null);assert.equal(dialog.querySelector('[data-refresh-floor-tasks]'),null);
});

test('synthetic floor board includes waiting and preserves source without inferring unscoped jobs',()=>{
 const result=projectFloorTasks('projects',{...live(),source:'Synthetic',jobs:[{id:'wait',title:'Need input',status:'waiting',domainKey:'projects'},{id:'other',title:'Other',status:'running',domainKey:'growth'}]});
 assert.equal(result.source,'Synthetic');assert.deepEqual(result.items,[{id:'wait',title:'Need input',status:'รอข้อมูล'}]);
 assert.equal(projectFloorTasks('projects',{...live(),source:'Synthetic',jobs:[{id:'x',title:'Unknown floor',status:'running'}]}).state,'UNAVAILABLE');
});

test('board releases its modal before navigating to an exact work item or list',async t=>{
 const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());const root=dom.window.document.querySelector('main');
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 let opened;
 const options={floor,getTasks:()=>({state:'READY',source:'Synthetic',items:[{id:'job',title:'Synthetic work',status:'รอข้อมูล'}]}),onOpenTask:id=>opened=[id,root.querySelector('dialog')],onOpenWork:()=>opened=['list',root.querySelector('dialog')]};
 openFloorTasks(root,options);await tick();root.querySelector('[data-floor-task-id]').click();assert.deepEqual(opened,['job',null]);
 openFloorTasks(root,options);await tick();root.querySelector('[data-open-work]').click();assert.deepEqual(opened,['list',null]);
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};

test('projectFloorTasks includes only jobs explicitly scoped to the exact floor and active statuses', () => {
  const input = live();
  const result = projectFloorTasks(floor.key, {
    ...input,
    jobs: [
      {id: 'running', title: 'ตรวจยอดขาย', status: 'running', domainKey: floor.key},
      {id: 'queued', title: 'จัดชุดข้อมูล', status: 'queued', domain: floor.key},
      {id: 'blocked', title: 'รอข้อมูล', status: 'blocked', domainKey: floor.key},
      {id: 'review', title: 'ตรวจร่าง', status: 'review', domain: floor.key},
      {id: 'other-floor', title: 'ห้ามแสดง', status: 'running', domainKey: 'marketing'},
      {id: 'role-guess', title: 'ห้ามเดาจาก role', status: 'running', role: floor.key},
      {id: 'nested-guess', title: 'ห้ามเดาจาก object', status: 'running', domain: {key: floor.key}},
      {id: 'done', title: 'เสร็จแล้ว', status: 'completed', domainKey: floor.key},
      {id: 'unknown', title: 'สถานะไม่รู้จัก', status: 'something-new', domainKey: floor.key},
    ],
  });

  assert.equal(result.state, 'READY');
  assert.equal(result.source, 'T3');
  assert.deepEqual(result.items, [
    {id: 'running', title: 'ตรวจยอดขาย', status: 'กำลังทำ'},
    {id: 'queued', title: 'จัดชุดข้อมูล', status: 'รอคิว'},
    {id: 'blocked', title: 'รอข้อมูล', status: 'ติดขัด'},
    {id: 'review', title: 'ตรวจร่าง', status: 'รอตรวจ'},
  ]);
  assert.equal(result.checkedAt, input.lastSync);
  assert.doesNotMatch(JSON.stringify(result.items), /ห้ามแสดง|role-guess|nested-guess|เสร็จแล้ว/);
});

test('projectFloorTasks reports unavailable when T3 jobs have no floor mapping', () => {
  const result = projectFloorTasks(floor.key, {
    ...live(),
    jobs: [{id: 'unmapped', title: 'งานที่ยังจับคู่ไม่ได้', status: 'running'}],
  });

  assert.equal(result.state, 'UNAVAILABLE');
  assert.deepEqual(result.items, []);
  assert.match(result.message, /ระบุชั้น|จับคู่/);
});

test('projectFloorTasks treats blank floor fields as missing mapping', () => {
  const result = projectFloorTasks(floor.key, {
    ...live(),
    jobs: [{id: 'blank-scope', title: 'งานไม่มีชั้น', status: 'running', domainKey: ' '}],
  });

  assert.equal(result.state, 'UNAVAILABLE');
  assert.match(result.message, /ระบุชั้น|จับคู่/);
});

test('projectFloorTasks reports an empty floor when jobs are scoped elsewhere', () => {
  const result = projectFloorTasks(floor.key, {
    ...live(),
    jobs: [{id: 'other', title: 'งานทีมอื่น', status: 'running', domainKey: 'marketing'}],
  });

  assert.equal(result.state, 'EMPTY');
  assert.deepEqual(result.items, []);
});

test('projectFloorTasks returns unavailable for demo, disconnected, and stale data', () => {
  for (const options of [
    {...live(), mode: 'demo'},
    {...live(), connectionStatus: 'offline'},
    {...live(), lastSync: '2000-01-01T00:00:00.000Z'},
  ]) {
    const result = projectFloorTasks(floor.key, {
      ...options,
      jobs: [{id: 'a', title: 'ไม่ควรแสดง', status: 'running', domainKey: floor.key}],
    });
    assert.equal(result.state, 'UNAVAILABLE');
    assert.deepEqual(result.items, []);
  }
});

test('projectFloorTasks tolerates malformed records and caps bounded text and items', () => {
  const jobs = [null, 'bad row', {id: {}, title: 'bad id', status: 'running', domainKey: floor.key}];
  for (let index = 0; index < 105; index++) {
    jobs.push({
      id: `id-${index}`,
      title: 'x'.repeat(240),
      status: 'PENDING',
      domainKey: floor.key,
    });
  }

  const result = projectFloorTasks(floor.key, {...live(), jobs});
  assert.equal(result.state, 'READY');
  assert.equal(result.items.length, 100);
  assert.ok(result.items.every(item => item.title.length <= 160));
  assert.ok(result.items.every(item => item.id.length <= 128));
  assert.ok(result.items.every(item => item.status === 'รอดำเนินการ'));
});

test('openFloorTasks shows loading then renders the scoped projection in an unattached root', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const root = dom.window.document.createElement('main');
  const pending = deferred();
  const dialog = openFloorTasks(root, {floor, getTasks: () => pending.promise});

  assert.equal(dialog.localName, 'dialog');
  assert.equal(dialog.parentNode, root);
  assert.match(dialog.textContent, /กำลังโหลด/);
  assert.match(dialog.textContent, /ทีมโครงการ/);
  assert.match(dialog.querySelector('.floor-tasks-source').textContent, /ยังไม่ยืนยัน/);

  pending.resolve(projectFloorTasks(floor.key, {
    ...live(),
    jobs: [{id: 'p1', title: 'เตรียมแผน', status: 'pending', domainKey: floor.key}],
  }));
  await tick();

  assert.match(dialog.textContent, /เตรียมแผน/);
  assert.match(dialog.textContent, /รอดำเนินการ/);
  assert.match(dialog.querySelector('.floor-tasks-source').textContent, /T3/);
  assert.doesNotMatch(dialog.textContent, /กำลังโหลด/);
  dom.window.close();
});

test('openFloorTasks renders provider errors as unavailable and never leaks unverified rows', async () => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  const dialog = openFloorTasks(root, {
    floor,
    getTasks: async () => ({
      state: 'READY', source: 'unknown-source', message: 'untrusted',
      items: [{id: 'global-id', title: 'GLOBAL JOB LEAK', status: 'running'}],
    }),
  });
  await tick();

  assert.match(dialog.textContent, /ไม่สามารถยืนยันแหล่งข้อมูล/);
  assert.doesNotMatch(dialog.textContent, /GLOBAL JOB LEAK|global-id|untrusted/);
  dom.window.close();
});

test('openFloorTasks accepts a Zuri unavailable projection and identifies its source', async () => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  const dialog = openFloorTasks(root, {
    floor,
    getTasks: async () => ({
      state: 'UNAVAILABLE', source: 'Zuri', items: [],
      message: 'ยังไม่มี API งานรายชั้นที่ได้รับอนุมัติ',
    }),
  });
  await tick();

  assert.match(dialog.querySelector('.floor-tasks-source').textContent, /Zuri/);
  assert.match(dialog.textContent, /ยังไม่มี API งานรายชั้นที่ได้รับอนุมัติ/);
  assert.equal(dialog.querySelector('.floor-task-item'), null);
  dom.window.close();
});

test('openFloorTasks rejects Zuri ready data and does not expose its items', async () => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  const dialog = openFloorTasks(root, {
    floor,
    getTasks: async () => ({
      state: 'READY', source: 'Zuri', message: 'untrusted',
      items: [{id: 'global-zuri-task', title: 'ZURI TASK LEAK', status: 'running'}],
    }),
  });
  await tick();

  assert.match(dialog.textContent, /ไม่สามารถยืนยันแหล่งข้อมูล/);
  assert.doesNotMatch(dialog.textContent, /ZURI TASK LEAK|global-zuri-task|untrusted/);
  assert.doesNotMatch(dialog.querySelector('.floor-tasks-source').textContent, /Zuri/);
  dom.window.close();
});

test('openFloorTasks uses text nodes for malicious floor and task labels', async () => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  const hostileFloor = {...floor, label: '<img src=x onerror=alert(1)>'};
  const dialog = openFloorTasks(root, {
    floor: hostileFloor,
    getTasks: () => ({
      state: 'READY', source: 'T3', message: '<svg onload=alert(1)>',
      items: [{id: 'safe-id', title: '<script>alert(1)</script>', status: '<b>running</b>'}],
    }),
  });
  await tick();

  assert.equal(dialog.querySelector('img, svg, script, b'), null);
  assert.match(dialog.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(dialog.textContent, /<script>alert\(1\)<\/script>/);
  assert.match(dialog.textContent, /<svg onload=alert\(1\)>/);
  dom.window.close();
});

test('openFloorTasks invokes task and work callbacks only after explicit button clicks', async () => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  const openedTasks = [];
  let openedWork = 0;
  const dialog = openFloorTasks(root, {
    floor,
    getTasks: () => projectFloorTasks(floor.key, {
      ...live(),
      jobs: [{id: 'job-7', title: 'ส่งรายงาน', status: 'running', domainKey: floor.key}],
    }),
    onOpenTask: (id, item) => openedTasks.push([id, item.title]),
    onOpenWork: () => { openedWork++; },
  });
  await tick();

  assert.deepEqual(openedTasks, []);
  assert.equal(openedWork, 0);
  dialog.querySelector('[data-floor-task-id="job-7"]').click();
  assert.deepEqual(openedTasks, [['job-7', 'ส่งรายงาน']]);
  dialog.querySelector('[data-open-work]').click();
  assert.equal(openedWork, 1);
  dom.window.close();
});

test('openFloorTasks ignores a late response after dispose', async () => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  const pending = deferred();
  const dialog = openFloorTasks(root, {floor, getTasks: () => pending.promise});
  const beforeDispose = dialog.textContent;

  dialog.dispose();
  pending.resolve(projectFloorTasks(floor.key, {
    ...live(),
    jobs: [{id: 'late', title: 'late leak', status: 'running', domainKey: floor.key}],
  }));
  await tick();

  assert.equal(dialog.parentNode, null);
  assert.equal(dialog.textContent, beforeDispose);
  assert.doesNotMatch(dialog.textContent, /late leak/);
  dom.window.close();
});

test('openFloorTasks ignores a late response after removal from the root', async () => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  const pending = deferred();
  const dialog = openFloorTasks(root, {floor, getTasks: () => pending.promise});
  const beforeRemoval = dialog.textContent;

  dialog.remove();
  pending.resolve(projectFloorTasks(floor.key, {
    ...live(),
    jobs: [{id: 'late', title: 'late leak', status: 'running', domainKey: floor.key}],
  }));
  await tick();

  assert.equal(dialog.textContent, beforeRemoval);
  assert.doesNotMatch(dialog.textContent, /late leak/);
  dom.window.close();
});

test('openFloorTasks ignores a late response after the floor object changes scope', async () => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  const pending = deferred();
  const mutableFloor = {...floor};
  const dialog = openFloorTasks(root, {floor: mutableFloor, getTasks: () => pending.promise});
  const beforeScopeChange = dialog.textContent;

  mutableFloor.key = 'marketing';
  pending.resolve(projectFloorTasks(floor.key, {
    ...live(),
    jobs: [{id: 'late', title: 'late leak', status: 'running', domainKey: floor.key}],
  }));
  await tick();

  assert.equal(dialog.textContent, beforeScopeChange);
  assert.doesNotMatch(dialog.textContent, /late leak/);
  dom.window.close();
});

test('openFloorTasks returns focus to its opener when closed or cancelled', async () => {
  const dom = new JSDOM('<main><button id="board">board</button></main>');
  const document = dom.window.document;
  const root = document.querySelector('main'), opener = document.getElementById('board');
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  for (const close of [
    dialog => dialog.querySelector('.floor-tasks-close').click(),
    dialog => dialog.dispatchEvent(new dom.window.Event('cancel', {cancelable: true})),
  ]) {
    opener.focus();
    const dialog = openFloorTasks(root, {floor, getTasks: () => new Promise(() => {})});
    dialog.querySelector('.floor-tasks-close').focus();
    assert.equal(document.activeElement, dialog.querySelector('.floor-tasks-close'));
    close(dialog);
    assert.equal(dialog.parentNode, null);
    assert.equal(document.activeElement, opener);
  }
  dom.window.close();
});

test('openFloorTasks leaves focus alone when it already moved elsewhere', () => {
  const dom = new JSDOM('<main><button id="board">board</button><input id="other"></main>');
  const document = dom.window.document;
  const root = document.querySelector('main');
  document.getElementById('board').focus();
  const dialog = openFloorTasks(root, {floor, getTasks: () => new Promise(() => {})});
  document.getElementById('other').focus();
  dialog.dispose();
  assert.equal(document.activeElement.id, 'other');
  dom.window.close();
});
