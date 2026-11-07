import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { InboxView } from '../web/inbox-view.js';
import { KnowledgeView, MAX_CONTEXT_LENGTH } from '../web/knowledge-view.js';

function mount(id) {
  const dom = new JSDOM(`<main><section id="${id}"></section></main>`, { url: 'https://zuri.example/' });
  return { dom, root: dom.window.document.querySelector(`#${id}`) };
}

function click(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}

test('unchanged Knowledge library rows keep focused approval controls across workspace polls',()=>{
 const {dom,root}=mount('knowledge'),view=new KnowledgeView(root,{autoLoad:false});
 view.versions=[{id:'fixture-version',name:'synthetic.txt',status:'pending',sizeBytes:42000,createdAt:'2026-10-25T00:00:00Z'}];
 view.update({context:'A',active:false});const approve=root.querySelector('[data-knowledge-action="approve"]');approve.focus();
 view.update({context:'B',active:false});assert.equal(root.querySelector('[data-knowledge-action="approve"]'),approve);assert.equal(dom.window.document.activeElement,approve);
 dom.window.close();
});

test('KnowledgeView preserves a dirty draft across polls and flags a newer saved value', () => {
  const { dom, root } = mount('knowledge');
  const view = new KnowledgeView(root);
  view.update({ context: 'Current saved context' });
  const input = root.querySelector('#knowledge-context-input');
  input.value = 'My unsaved edit';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

  view.update({ context: 'Current saved context' });
  assert.equal(input.value, 'My unsaved edit');
  assert.equal(root.querySelector('[data-knowledge-action="save"]').disabled, false);

  view.update({ context: 'Changed in another session' });
  assert.equal(input.value, 'My unsaved edit');
  assert.match(root.querySelector('#knowledge-feedback').textContent, /เปลี่ยนระหว่างที่คุณกำลังแก้/);

  click(dom, root.querySelector('[data-knowledge-action="discard"]'));
  assert.equal(input.value, 'Changed in another session');
  assert.equal(root.querySelector('[data-knowledge-action="save"]').disabled, true);
  assert.match(root.querySelector('#knowledge-feedback').textContent, /คืนค่าบริบท/);
  dom.window.close();
});

test('KnowledgeView inserts only an explicitly requested blank template and saves through team API', async t => {
  const { dom, root } = mount('knowledge');
  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === '/api/knowledge') return Response.json({ versions: [], usage: { retainedVersionCount: 0, retainedBytes: 0, versionLimit: 20, retainedByteLimit: 100 * 1024 * 1024 } });
    return { ok: true, status: 200 };
  };
  t.after(() => { globalThis.fetch = previousFetch; dom.window.close(); });

  const changes = [];
  const notices = [];
  const view = new KnowledgeView(root, { onContextChange: value => changes.push(value), toast: value => notices.push(value) });
  view.update({ context: '' });
  const input = root.querySelector('#knowledge-context-input');
  assert.equal(input.value, '');
  click(dom, root.querySelector('[data-knowledge-action="template"]'));
  assert.match(input.value, /ธุรกิจ \/ สินค้า:/);
  assert.equal(input.value.includes('ZURI'), false);
  assert.equal(requests.filter(request => request.options.method === 'PUT' || request.options.method === 'POST').length, 0, 'opening the template must not write automatically');

  input.value = '  Verified business details  ';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  click(dom, root.querySelector('[data-knowledge-action="save"]'));
  await new Promise(resolve => setImmediate(resolve));
  const writes = requests.filter(request => request.options.method === 'PUT' || request.options.method === 'POST');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url, '/api/team');
  assert.equal(writes[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(writes[0].options.body), { context: 'Verified business details' });
  assert.deepEqual(changes, ['Verified business details']);
  assert.match(notices[0], /งานใหม่/);
  assert.equal(root.querySelector('[data-knowledge-action="save"]').disabled, true);
});

test('KnowledgeView enforces the 6000 character limit and blocks writes in demo mode', async t => {
  const { dom, root } = mount('knowledge');
  const previousFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'PUT' || options.method === 'POST') writes++;
    return url === '/api/knowledge' ? Response.json({ versions: [] }) : { ok: true, status: 200 };
  };
  t.after(() => { globalThis.fetch = previousFetch; dom.window.close(); });

  const view = new KnowledgeView(root);
  view.update({ context: '' });
  const input = root.querySelector('#knowledge-context-input');
  input.value = 'x'.repeat(MAX_CONTEXT_LENGTH);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(root.querySelector('#knowledge-context-count').textContent, `${MAX_CONTEXT_LENGTH} / ${MAX_CONTEXT_LENGTH}`);
  assert.equal(root.querySelector('[data-knowledge-action="save"]').disabled, false);

  input.value += 'x';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(root.querySelector('[data-knowledge-action="save"]').disabled, true);
  click(dom, root.querySelector('[data-knowledge-action="save"]'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 0);

  const demoMount = mount('demo-knowledge');
  const demo = new KnowledgeView(demoMount.root, { isDemo: () => true });
  demo.update({ context: 'Demo context' });
  assert.equal(demoMount.root.querySelector('#knowledge-context-input').disabled, true);
  assert.equal(demoMount.root.querySelector('[data-knowledge-action="save"]').disabled, true);
  click(demoMount.dom, demoMount.root.querySelector('[data-knowledge-action="save"]'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 0);
  demoMount.dom.window.close();
});

test('InboxView derives stable actionable items, excludes accepted work, and opens source job or chat', () => {
  const { dom, root } = mount('inbox');
  const openedWork = [];
  const openedChat = [];
  const openedConnection = [];
  const counts = [];
  const view = new InboxView(root, {
    onOpenWork: id => openedWork.push(id),
    onOpenChat: (id, name) => openedChat.push([id, name]),
    onOpenConnection: () => openedConnection.push(true),
    onCount: count => counts.push(count)
  });
  const jobs = [
    { id: 'wait-1', title: 'รอข้อมูล', status: 'waiting', steps: [{ agentId: 'beam', threadId: 'thread-wait', status: 'waiting' }] },
    { id: 'error-1', title: 'เกิดข้อผิดพลาด', status: 'error', steps: [{ agentId: 'kai', threadId: 'thread-error', status: 'error', result: 'ตรวจแหล่งข้อมูลไม่ได้' }] },
    { id: 'review-1', title: 'ตรวจรายงาน', status: 'done', steps: [{ status: 'done' }] },
    { id: 'revision-1', title: 'ขอแก้ไขรายงาน', status: 'done', steps: [{ status: 'done' }] },
    { id: 'accepted-1', title: 'รับงานแล้ว', status: 'done', steps: [{ status: 'done' }] },
    { id: 'running-1', title: 'กำลังทำ', status: 'running', steps: [{ status: 'running' }] },
    { id: 'cancelled-1', title: 'ยกเลิกแล้ว', status: 'cancelled', runnerError: 'stale failure', steps: [{ status: 'error', result: 'old failure' }] }
  ];
  const lastSync = new Date(Date.now() - 60_000).toISOString();
  view.update({
    jobs,
    agents: [{ id: 'beam', name: 'Beam' }, { id: 'kai', name: 'Kai' }],
    reviews: { 'accepted-1': { reviewStatus: 'accepted' }, 'revision-1': { reviewStatus: 'changes_requested' } },
    connectionStatus: 'live',
    lastSync
  });

  const ids = [...root.querySelectorAll('.inbox-item')].map(node => node.dataset.itemId);
  assert.deepEqual(ids, ['job:error-1', 'job:wait-1', 'job:revision-1', 'job:review-1']);
  assert.equal(root.querySelectorAll('.inbox-item').length, 4, 'duplicate sources and non-actionable jobs are omitted');
  assert.equal(root.querySelector('[data-item-id="job:revision-1"]').classList.contains('is-revision'), true);
  assert.match(root.querySelector('#inbox-connection').textContent, /T3/);
  assert.equal(view.count, 5, 'the stale connection is included in the badge');
  assert.equal(view.getCount(), 5);
  assert.equal(root.querySelector('#inbox-count-value').textContent, '5');

  click(dom, root.querySelector('[data-inbox-action="work"][data-job-id="review-1"]'));
  click(dom, root.querySelector('[data-inbox-action="chat"][data-thread-id="thread-wait"]'));
  click(dom, root.querySelector('[data-inbox-connection-action="true"]'));
  assert.deepEqual(openedWork, ['review-1']);
  assert.deepEqual(openedChat, [['thread-wait', 'Beam']]);
  assert.deepEqual(openedConnection, [true]);

  const previousCountCalls = counts.length;
  view.update({ jobs, agents: [{ id: 'beam', name: 'Beam' }, { id: 'kai', name: 'Kai' }], reviews: { 'accepted-1': { reviewStatus: 'accepted' }, 'revision-1': { reviewStatus: 'changes_requested' } }, connectionStatus: 'live', lastSync });
  assert.equal(counts.length, previousCountCalls, 'identical polling snapshots do not rebroadcast the count');
  dom.window.close();
});

test('InboxView keeps a job item ID as its state changes and offers task creation in the empty state', () => {
  const { dom, root } = mount('inbox');
  const created = [];
  const view = new InboxView(root, { onCreateTask: () => created.push(true) });
  view.update({ jobs: [{ id: 'same-job', title: 'Current work', status: 'waiting', steps: [] }], connectionStatus: 'live', lastSync: new Date().toISOString() });
  const before = root.querySelector('.inbox-item').dataset.itemId;
  view.update({ jobs: [{ id: 'same-job', title: 'Current work', status: 'done', steps: [] }], connectionStatus: 'live', lastSync: new Date().toISOString() });
  assert.equal(root.querySelector('.inbox-item').dataset.itemId, before);
  assert.equal(root.querySelector('.inbox-item').classList.contains('is-review'), true);

  view.update({ jobs: [], connectionStatus: 'demo', lastSync: null });
  assert.equal(root.querySelectorAll('.inbox-item').length, 0);
  click(dom, root.querySelector('[data-inbox-create-task="true"]'));
  assert.deepEqual(created, [true]);
  assert.equal(view.count, 0);
  dom.window.close();
});
