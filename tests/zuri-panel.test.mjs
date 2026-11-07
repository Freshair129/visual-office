import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {domainFloors, floorByKey} from '../web/domain-office.js';
import {BuildingView} from '../web/building-view.js';
import {ZuriApiError, ZuriConnector, normalizeZuriOrigin, safeZuriBusinessesUrl, safeZuriDomainUrl, safeZuriLoginUrl} from '../web/zuri-connector.js';
import {ZuriPanel} from '../web/zuri-panel.js';

const BUSINESS_A = '00000000-0000-4000-8000-000000000001';
const BUSINESS_B = '00000000-0000-4000-8000-000000000002';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function domainResult(domain, label = `${domain} item`, state = 'READY') {
  return {
    domain, state, checkedAt: '2026-10-20T10:00:00.000Z', source: {path: `/api/${domain}`, status: 200},
    records: state === 'READY' ? [{id: `${domain}-1`, label, status: 'ACTIVE'}] : [],
    count: state === 'READY' ? 1 : 0, displayedCount: state === 'READY' ? 1 : 0,
    returnedCount: state === 'READY' ? 20 : 0, countKind: 'DISPLAYED', countLabel: 'Records displayed',
    truncated: state === 'READY', moreAvailable: state === 'READY',
    agent: {state: 'UNAVAILABLE', reason: 'Native Zuri agent execution is unavailable.'},
  };
}

class FakeConnector {
  constructor({target = 'http://127.0.0.1:3100', businesses = [
    {id: BUSINESS_A, name: 'Alpha Business'}, {id: BUSINESS_B, name: 'Beta Business'},
  ]} = {}) {
    this.status = {enabled: true, target};
    this.scope = {businesses};
    this.domainCalls = [];
    this.onDomain = async domain => domainResult(domain);
    this.onGrowth = async () => ({
      command: 'MARKETING_ASK', execution: 'DETERMINISTIC_READ_MODEL',
      agent: {state: 'UNAVAILABLE', reason: 'Native Zuri agent execution is unavailable.'},
      state: 'READY', source: {path: '/api/growth/ask-marketing', status: 200},
      response: {
        readModel: 'MARKETING_ASK', schemaVersion: 'v1', businessId: BUSINESS_A,
        question: 'PRIVATE QUESTION', intentType: 'CAMPAIGN_PERFORMANCE', state: 'READY',
        answer: {sections: [{title: 'แคมเปญที่กำลังทำงาน', count: 2}], recommendations: []},
        sources: [{id: 'source-1'}], unavailable: [], generatedAt: '2026-10-20T10:00:00.000Z',
      },
    });
    this.onKnowledge = async () => ({
      command: 'KNOWLEDGE_QUERY', execution: 'SCOPED_KNOWLEDGE_RETRIEVAL',
      agent: {state: 'UNAVAILABLE', reason: 'Native Zuri agent execution is unavailable.'},
      state: 'READY', source: {path: '/api/knowledge/queries', status: 200},
      response: {
        corpusId: 'private-corpus-id', corpusGeneration: 4, manifestHash: 'private-manifest-hash', ranking: 'rrf-k60',
        results: [{sourceId: 'guide', citationId: 'guide#2', text: 'นโยบายคืนสินค้าและระยะเวลาคืนเงิน'}],
      },
    });
  }
  async getStatus() { return this.status; }
  async getScope() { return this.scope; }
  async getDomain(domain, businessId, options = {}) {
    this.domainCalls.push({domain, businessId, signal: options.signal});
    return this.onDomain(domain, businessId, options);
  }
  async askGrowth(businessId, question, options = {}) { return this.onGrowth(businessId, question, options); }
  async searchKnowledge(businessId, query, options = {}) { return this.onKnowledge(businessId, query, options); }
}

function setup(t, connector = new FakeConnector()) {
  const dom = new JSDOM('<main id="world"></main>', {url: 'http://127.0.0.1:4400/', pretendToBeVisual: true});
  const saved = {document: globalThis.document, localStorage: globalThis.localStorage};
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.localStorage.clear();
  dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const world = document.querySelector('#world');
  const connectionEvents = [];
  const panel = new ZuriPanel(world, {connector, onConnectionState: state => connectionEvents.push(state)});
  world.append(panel.floorView);
  t.after(() => {
    panel.hideFloor();
    if (panel.dialog.open) panel.dialog.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
    dom.window.close();
  });
  return {dom, world, panel, connector, connectionEvents};
}

async function flushUntil(predicate, attempts = 100) {
  for (let index = 0; index < attempts; index++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.fail('Timed out waiting for panel update');
}

function chooseBusiness(panel, window, id = BUSINESS_A) {
  const select = panel.dialog._zuri.business;
  select.value = id;
  select.dispatchEvent(new window.Event('change', {bubbles: true}));
}

test('floor polling pauses while hidden even when a pending read completes', async t => {
  t.mock.timers.enable({apis: ['setInterval']});
  const connector = new FakeConnector({businesses: [{id: BUSINESS_A, name: 'Alpha'}]});
  const pending = deferred();
  connector.onDomain = () => pending.promise;
  const {panel, dom} = setup(t, connector);
  await panel.ready;
  assert.equal(panel.dialog.getAttribute('aria-labelledby'), panel.dialog.querySelector('h2').id);
  let hidden = false;
  Object.defineProperty(dom.window.document, 'hidden', {get: () => hidden});
  panel.showFloor(floorByKey('growth'));
  assert.equal(connector.domainCalls.length, 1);
  hidden = true;
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
  pending.resolve(domainResult('growth'));
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(90000);
  assert.equal(connector.domainCalls.length, 1);
  hidden = false;
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(connector.domainCalls.length, 2);
  t.mock.timers.tick(30000);
  assert.equal(connector.domainCalls.length, 3);
  panel.hideFloor();
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
  t.mock.timers.tick(30000);
  assert.equal(connector.domainCalls.length, 3);
});

test('connector pins routes, same-origin credentials, target allowlist, and knowledge query topK', async () => {
  const calls = [];
  const connector = new ZuriConnector({fetchImpl: async (path, options) => {
    calls.push({path, options});
    return {ok: true, json: async () => ({state: 'READY'})};
  }});
  await connector.searchKnowledge(BUSINESS_A, 'delivery policy');
  assert.deepEqual(JSON.parse(calls[0].options.body), {businessId: BUSINESS_A, query: 'delivery policy', topK: 5});
  assert.equal(calls[0].path, '/api/zuri/domains/knowledge/query');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.cache, 'no-store');
  await connector.getDomain('market', BUSINESS_A);
  assert.equal(calls[1].path, `/api/zuri/domains/market?businessId=${BUSINESS_A}`);
  await assert.rejects(connector.request(`/api/zuri/domains/market?businessId=${BUSINESS_A}&extra=1`), TypeError);
  assert.equal(normalizeZuriOrigin('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  assert.equal(normalizeZuriOrigin('http://127.0.0.1:3100/path'), '');
  assert.equal(normalizeZuriOrigin('https://example.com'), '');
  assert.equal(safeZuriLoginUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000/login');
  assert.equal(safeZuriDomainUrl('market', BUSINESS_A, 'http://127.0.0.1:3000'), 'http://127.0.0.1:3000/market');
  assert.equal(safeZuriBusinessesUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000/businesses');
  assert.throws(() => safeZuriDomainUrl('unknown', BUSINESS_A), TypeError);
});

test('connector retains nested proxy error codes and only accepts safe flat error codes', async () => {
  const payloads = [
    [{error: {code: 'UPSTREAM_CONTRACT_MISMATCH', message: 'PRIVATE_MESSAGE'}}, 'UPSTREAM_CONTRACT_MISMATCH'],
    [{code: 'AUTH_REQUIRED'}, 'AUTH_REQUIRED'],
    [{errorCode: 'FORBIDDEN'}, 'FORBIDDEN'],
    [{error: 'UNAVAILABLE'}, 'UNAVAILABLE'],
    [{error: {code: '<script>'}, errorCode: 'INVALID_REQUEST'}, 'INVALID_REQUEST'],
    [{error: {code: {secret: true}}}, ''],
  ];
  for (const [payload, expectedCode] of payloads) {
    const connector = new ZuriConnector({fetchImpl: async () => ({
      ok: false, status: 502, json: async () => payload,
    })});
    await assert.rejects(connector.getStatus(), error => {
      assert.ok(error instanceof ZuriApiError);
      assert.equal(error.status, 502);
      assert.equal(error.code, expectedCode);
      assert.doesNotMatch(error.message, /PRIVATE_MESSAGE|script/);
      return true;
    });
  }
});

test('multiple businesses stay unselected; choosing one scopes a safe real-record read', async t => {
  const connector = new FakeConnector({target: 'http://127.0.0.1:3000'});
  connector.onDomain = async domain => domainResult(domain, '<img src=x onerror=bad()>');
  const {panel, world, connectionEvents} = setup(t, connector);
  await panel.ready;
  assert.equal(panel.enabled, true);
  assert.equal(panel.businessId, '');
  assert.equal(panel.dialog._zuri.business.value, '');
  assert.equal(connector.domainCalls.length, 0);

  chooseBusiness(panel, world.ownerDocument.defaultView, BUSINESS_B);
  panel.showFloor(floorByKey('projects'), true);
  await flushUntil(() => panel.domainResults.get('projects')?.state === 'READY');
  assert.equal(connector.domainCalls.at(-1).businessId, BUSINESS_B);
  assert.equal(panel.floorView.querySelector('.zuri-record-label').textContent, '<img src=x onerror=bad()>');
  assert.match(panel.floorView.querySelector('.zuri-record-count').textContent, /แสดง 1 รายการ/);
  assert.match(panel.floorView.querySelector('.zuri-record-more').textContent, /ยังมีรายการเพิ่มเติม/);
  assert.equal(panel.floorView.querySelector('img'), null);
  assert.equal(panel.hasVerifiedRead, true);
  assert.equal(connectionEvents.at(-1).state, 'READY');
  assert.equal(connectionEvents.at(-1).hasVerifiedRead, true);
  assert.equal(panel.floorView.querySelector('[data-zuri-domain-link]').href, 'http://127.0.0.1:3000/businesses');
  assert.match(panel.floorView.querySelector('[data-zuri-business-link-hint]').textContent, /Beta Business/);

  const focusedInput = panel.floorView.querySelector('input');
  if (focusedInput) focusedInput.focus();
  await panel.syncCurrentDomain();
  if (focusedInput) assert.equal(world.ownerDocument.activeElement, focusedInput);
});

test('one available Business can be selected automatically', async t => {
  const onlyBusiness = {id: BUSINESS_A, name: 'Only Business'};
  const connector = new FakeConnector({businesses: [onlyBusiness]});
  const {panel} = setup(t, connector);
  await panel.ready;
  assert.equal(panel.businessId, BUSINESS_A);
  assert.equal(panel.dialog._zuri.business.value, BUSINESS_A);
});

test('delayed Zuri activation exposes the read panel first and labels T3 actions separately', async t => {
  const dom = new JSDOM('<main id="office-view"><section class="office-panel"><div class="office-topline"><span class="mono"></span><button id="toggle-labels"><span></span><span></span></button></div><div id="scene"></div><div class="room-label"></div></section></main>', {url: 'http://127.0.0.1:4400/', pretendToBeVisual: true});
  const saved = {document: globalThis.document, Option: globalThis.Option, localStorage: globalThis.localStorage};
  globalThis.document = dom.window.document;
  globalThis.Option = dom.window.Option;
  globalThis.localStorage = dom.window.localStorage;
  dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const statusRead = deferred();
  const domainRead = deferred();
  const connector = new FakeConnector({businesses: [{id: BUSINESS_A, name: 'Alpha Business'}]});
  connector.getStatus = () => statusRead.promise;
  connector.onDomain = () => domainRead.promise;
  const root = document.querySelector('#office-view');
  const view = new BuildingView(root, {zuriConnector: connector, avatarIcon: () => ''});
  t.after(() => {
    view.hide();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
    dom.window.close();
  });

  view.show('growth');
  assert.equal(view.zuriEnabled, false);
  statusRead.resolve({enabled: true, target: 'http://127.0.0.1:3100'});
  await view.zuriReady;
  const directory = view.world.querySelector('.world-directory');
  const children = [...directory.children];
  assert.ok(children.indexOf(view.zuriPanel.floorView) < children.findIndex(item => item.classList.contains('floor-roster')));
  assert.ok(children.indexOf(view.zuriPanel.floorView) < children.findIndex(item => item.classList.contains('floor-role-detail')));
  assert.match(directory.querySelector('.world-directory-heading').textContent, /ข้อมูลจาก Zuri/);
  assert.match(directory.querySelector('.floor-role-detail .world-primary').textContent, /T3/);
  assert.match(directory.querySelector('.floor-role-detail .role-connection-note').textContent, /ไม่ใช่ Zuri Agent/);
  assert.equal(view.world.querySelector('.world-mode').textContent, 'เชื่อม Zuri');

  domainRead.resolve(domainResult('growth', 'verified result'));
  await flushUntil(() => view.zuriPanel.hasVerifiedRead);
  assert.equal(view.world.querySelector('.world-mode').textContent, 'Zuri · ข้อมูลจริง');
});

test('late floor response cannot replace the newly selected floor data', async t => {
  const connector = new FakeConnector();
  const customerRead = deferred();
  const growthRead = deferred();
  connector.onDomain = domain => domain === 'customer' ? customerRead.promise : growthRead.promise;
  const {panel, world} = setup(t, connector);
  await panel.ready;
  chooseBusiness(panel, world.ownerDocument.defaultView);
  panel.showFloor(floorByKey('customer'), true);
  const oldCall = connector.domainCalls.at(-1);
  panel.showFloor(floorByKey('growth'), true);
  const newCall = connector.domainCalls.at(-1);
  assert.equal(oldCall.signal.aborted, true);
  growthRead.resolve(domainResult('growth', 'growth result'));
  customerRead.resolve(domainResult('customer', 'stale customer result'));
  await flushUntil(() => panel.domainResults.get('growth')?.state === 'READY');
  await Promise.resolve();
  assert.match(panel.floorView.textContent, /growth result/);
  assert.doesNotMatch(panel.floorView.textContent, /stale customer result/);
  assert.equal(panel.currentDomain.key, 'growth');
  assert.equal(newCall.businessId, BUSINESS_A);
});

test('switching Business aborts and rejects the previous Business response', async t => {
  const connector = new FakeConnector();
  const firstRead = deferred();
  const secondRead = deferred();
  connector.onDomain = (_domain, businessId) => businessId === BUSINESS_A ? firstRead.promise : secondRead.promise;
  const {panel, world} = setup(t, connector);
  await panel.ready;
  chooseBusiness(panel, world.ownerDocument.defaultView);
  panel.showFloor(floorByKey('projects'), true);
  const firstCall = connector.domainCalls.at(-1);
  chooseBusiness(panel, world.ownerDocument.defaultView, BUSINESS_B);
  const secondCall = connector.domainCalls.at(-1);
  assert.equal(firstCall.signal.aborted, true);
  secondRead.resolve(domainResult('projects', 'Beta-only record'));
  firstRead.resolve(domainResult('projects', 'Alpha stale record'));
  await flushUntil(() => panel.domainResults.get('projects')?.records?.[0]?.label === 'Beta-only record');
  assert.equal(panel.businessId, BUSINESS_B);
  assert.equal(secondCall.businessId, BUSINESS_B);
  assert.match(panel.floorView.textContent, /Beta-only record/);
  assert.doesNotMatch(panel.floorView.textContent, /Alpha stale record/);
});

test('auth expiry clears cached scope and records, then links to the validated target login', async t => {
  const connector = new FakeConnector({target: 'http://127.0.0.1:3000'});
  const {panel, world, connectionEvents} = setup(t, connector);
  await panel.ready;
  chooseBusiness(panel, world.ownerDocument.defaultView);
  panel.showFloor(floorByKey('customer'), true);
  await flushUntil(() => panel.domainResults.get('customer')?.state === 'READY');
  assert.match(panel.floorView.textContent, /customer item/);
  assert.equal(globalThis.localStorage.getItem('zuri-office-business-id'), BUSINESS_A);

  connector.onDomain = async () => { throw new ZuriApiError(401, 'AUTH_REQUIRED'); };
  await panel.syncCurrentDomain();
  assert.equal(panel.scope, null);
  assert.equal(panel.businesses.length, 0);
  assert.equal(panel.businessId, '');
  assert.equal(globalThis.localStorage.getItem('zuri-office-business-id'), null);
  assert.doesNotMatch(panel.floorView.textContent, /customer item/);
  assert.equal(panel.floorView.querySelector('.zuri-login-link.compact').hidden, false);
  assert.equal(panel.floorView.querySelector('.zuri-login-link.compact').href, 'http://127.0.0.1:3000/login');
  assert.equal(connectionEvents.at(-1).state, 'AUTH_REQUIRED');
  assert.equal(panel.hasVerifiedRead, false);
});

test('malformed domain responses fail closed without exposing private record fields', async t => {
  const connector = new FakeConnector();
  connector.onDomain = async () => ({domain: 'projects', records: [{id: 'private-id', label: 'private record'}], count: 1});
  const {panel, world} = setup(t, connector);
  await panel.ready;
  chooseBusiness(panel, world.ownerDocument.defaultView);
  panel.showFloor(floorByKey('projects'), true);
  await flushUntil(() => panel.domainResults.get('projects')?.state === 'ERROR');
  assert.match(panel.floorView.textContent, /อ่านไม่สำเร็จ/);
  assert.doesNotMatch(panel.floorView.textContent, /private record|private-id/);
  assert.deepEqual(panel.domainResults.get('projects').records, []);
});

test('read commands render only bounded projections and the 14-domain report contains no records', async t => {
  const connector = new FakeConnector();
  const {panel, world} = setup(t, connector);
  await panel.ready;
  chooseBusiness(panel, world.ownerDocument.defaultView);

  panel.showFloor(floorByKey('growth'), true);
  await flushUntil(() => panel.domainResults.get('growth')?.state === 'READY');
  const growthForm = panel.floorView.querySelector('.zuri-command-form');
  const growthInput = growthForm.querySelector('input');
  growthInput.value = 'PRIVATE QUESTION';
  growthInput.focus();
  growthForm.dispatchEvent(new world.ownerDocument.defaultView.Event('submit', {bubbles: true, cancelable: true}));
  await flushUntil(() => panel.floorView.querySelector('[data-zuri-command-result="growth"]')?.textContent.includes('Ask Marketing'));
  const growthOutput = panel.floorView.querySelector('[data-zuri-command-result="growth"]').textContent;
  assert.match(growthOutput, /แคมเปญที่กำลังทำงาน/);
  assert.match(growthOutput, /ผลอ่านอย่างเดียว/);
  assert.doesNotMatch(growthOutput, new RegExp(BUSINESS_A));
  assert.doesNotMatch(growthOutput, /PRIVATE QUESTION|DETERMINISTIC_READ_MODEL/);

  panel.showFloor(floorByKey('knowledge'), true);
  await flushUntil(() => panel.domainResults.get('knowledge')?.state === 'READY');
  const knowledgeForm = panel.floorView.querySelector('.zuri-command-form');
  const knowledgeInput = knowledgeForm.querySelector('input');
  knowledgeInput.value = 'return policy';
  knowledgeForm.dispatchEvent(new world.ownerDocument.defaultView.Event('submit', {bubbles: true, cancelable: true}));
  await flushUntil(() => panel.floorView.querySelector('[data-zuri-command-result="knowledge"]')?.textContent.includes('guide#2'));
  const knowledgeOutput = panel.floorView.querySelector('[data-zuri-command-result="knowledge"]').textContent;
  assert.match(knowledgeOutput, /นโยบายคืนสินค้า/);
  assert.doesNotMatch(knowledgeOutput, /private-corpus-id|private-manifest-hash/);
  assert.match(panel.floorView.querySelector('[data-zuri-agent]').textContent, /UNAVAILABLE/);
  assert.match(panel.floorView.textContent, /Zuri ยังไม่มี API สำหรับสั่ง agent ประจำแผนก/);

  panel.dialog._zuri.runAll.click();
  await flushUntil(() => panel.sweepComplete);
  assert.equal(connector.domainCalls.filter(call => call.businessId === BUSINESS_A).length, 16);
  assert.equal(panel.dialog._zuri.checks.querySelectorAll('.zuri-check-row').length, 14);
  const report = panel.sanitizedReport();
  const serialized = JSON.stringify(report);
  assert.equal(report.target, 'http://127.0.0.1:3100');
  assert.equal(report.checks.length, domainFloors.length);
  assert.equal(report.business.name, 'Alpha Business');
  assert.doesNotMatch(serialized, new RegExp(BUSINESS_A));
  assert.doesNotMatch(serialized, /customer item|growth item|private-corpus-id|PRIVATE QUESTION/);
  assert.ok(report.checks.every(check => check.displayedCount === 1));
  assert.doesNotMatch(serialized, /returnedCount/);
  assert.ok(report.checks.every(check => check.agent === 'UNAVAILABLE'));
  assert.equal(panel.dialog._zuri.download.disabled, false);
});

test('Marketing browser connector accepts blank overview and trimmed400 but rejects invalid inputs',async()=>{
 const bodies=[];const connector=new ZuriConnector({fetchImpl:async(path,init)=>{bodies.push(JSON.parse(init.body));return new Response('{}');}});
 await connector.askGrowth(BUSINESS_A,'   ');assert.equal(bodies[0].question,'');
 await connector.askGrowth(BUSINESS_A,'  '+'x'.repeat(400)+'  ');assert.equal(bodies[1].question.length,400);
 for(const q of [null,undefined,12,'x'.repeat(401)])assert.throws(()=>connector.askGrowth(BUSINESS_A,q));
 assert.throws(()=>connector.askGrowth('',''));assert.equal(bodies.length,2);
});
