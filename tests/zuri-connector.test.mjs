import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createZuriConnector } from '../scripts/zuri-connector.mjs';

const BUSINESS_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_COOKIE = 'zuri_session=opaque_session_value';
test('Marketing blank overview and null counts preserve producer meaning',async t=>{
 const h=await harness(t,{upstream:async()=>jsonResponse({readModel:'MARKETING_ASK',schemaVersion:'1.0',businessId:BUSINESS_ID,question:'',intentType:'OVERVIEW',state:'UNKNOWN',answer:{sections:[{key:'campaigns',count:null,value:null}],recommendations:[]},sources:[],unavailable:[],generatedAt:'2026-10-24T00:00:00Z'})});
 const result=await request(h.base,'/api/zuri/domains/growth/ask',{method:'POST',body:{businessId:BUSINESS_ID,question:'   '}});assert.equal(result.response.status,200);assert.equal(result.json.response.answer.sections[0].count,null);assert.equal(result.json.response.answer.sections[0].value,null);assert.equal(JSON.parse(h.calls[0].init.body).question,'');
});

test('Marketing protected denials have identical complete envelopes while 401 stays distinct',async t=>{
 for(const path of ['/api/zuri/scope',domainPath('growth'),'/api/zuri/domains/growth/ask']){
  let status=403;const h=await harness(t,{upstream:async()=>jsonResponse({error:{code:status===403?'PRIVATE_FORBIDDEN':'PRIVATE_NOT_FOUND'}},status)});
  const options=path.endsWith('/ask')?{method:'POST',body:{businessId:BUSINESS_ID,question:'status'}}:{};
  const forbidden=await request(h.base,path,options);status=404;const missing=await request(h.base,path,options);
  assert.equal(forbidden.response.status,missing.response.status);assert.deepEqual(forbidden.json,missing.json);assert.doesNotMatch(forbidden.text,/PRIVATE_|sourceCode/);assert.equal(forbidden.json.source.status,403);
  status=401;const expired=await request(h.base,path,options);assert.equal(expired.json.source.status,401);assert.notDeepEqual(expired.json,missing.json);
 }
});

function jsonResponse(payload, status = 200, contentType = 'application/json; charset=utf-8') {
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status,
    headers: contentType ? { 'content-type': contentType } : {},
  });
}

async function harness(t, { enabled = true, port = '3100', upstream = async () => jsonResponse({}) } = {}) {
  const calls = [];
  const connector = createZuriConnector({
    enabled,
    port,
    timeoutMs: 250,
    now: () => new Date('2026-10-20T12:00:00.000Z'),
    fetchImpl: async (input, init = {}) => {
      const url = new URL(input);
      calls.push({ url, init });
      return upstream(url, init);
    },
  });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const handled = await connector(req, res, url);
    if (!handled && !res.writableEnded) res.writeHead(404).end();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { base, calls, target: `http://127.0.0.1:${port}` };
}

async function request(base, path, { method = 'GET', body, cookie = true, origin = 'same', headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (cookie) requestHeaders.cookie = `other_session=DO_NOT_FORWARD; ${SESSION_COOKIE}; unrelated=ALSO_PRIVATE`;
  if (origin === 'same') requestHeaders.origin = base;
  else if (origin) requestHeaders.origin = origin;
  if (body !== undefined) {
    requestHeaders['content-type'] = 'application/json';
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers: requestHeaders,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* text-only responses are not expected from connector routes */ }
  return { response, json, text };
}

function domainPath(domain, extra = '') {
  return `/api/zuri/domains/${domain}?businessId=${BUSINESS_ID}${extra}`;
}

const domainCases = [
  {
    domain: 'projects', path: `/api/projects?businessId=${BUSINESS_ID}&limit=25`,
    payload: { items: [{ id: 'project-1', code: 'P-1', name: 'Project one', status: 'ACTIVE', taxNumber: 'PRIVATE_PROJECT_DATA' }], limit: 25, truncated: false },
    record: { id: 'project-1', label: 'Project one', status: 'ACTIVE' },
    secret: 'PRIVATE_PROJECT_DATA',
  },
  {
    domain: 'customer', path: `/api/crm/conversations?businessId=${BUSINESS_ID}&limit=25`,
    payload: { version: '1.0', scope: { businessId: BUSINESS_ID }, counts: { total: 1 }, limit: 25, truncated: false, conversations: [{ id: 'conversation-1', channel: 'LINE', status: 'OPEN', customer: { email: 'PRIVATE_CUSTOMER_EMAIL' }, lastMessagePreview: 'PRIVATE_MESSAGE' }] },
    record: { id: 'conversation-1', label: 'LINE conversation conversa', status: 'OPEN' },
    secret: 'PRIVATE_CUSTOMER_EMAIL',
  },
  {
    domain: 'market', path: `/api/market/observations?businessId=${BUSINESS_ID}&limit=25`,
    payload: { version: '1.0', scope: { businessId: BUSINESS_ID }, counts: {}, limit: 25, truncated: false, observations: [{ id: 'observation-1', title: 'Market observation', resolutionStatus: 'READY', candidate: { privatePayload: 'PRIVATE_MARKET_DATA' } }] },
    record: { id: 'observation-1', label: 'Market observation', status: 'READY' },
    secret: 'PRIVATE_MARKET_DATA',
  },
  {
    domain: 'growth', path: `/api/growth/campaigns?businessId=${BUSINESS_ID}`,
    payload: { campaigns: [{ id: 'campaign-1', title: 'Spring campaign', status: 'ACTIVE', budget: 990000, brief: 'PRIVATE_CAMPAIGN_BRIEF' }], canWrite: false, truncated: false },
    record: { id: 'campaign-1', label: 'Spring campaign', status: 'ACTIVE' },
    secret: 'PRIVATE_CAMPAIGN_BRIEF',
  },
  {
    domain: 'line-oa', path: `/api/line-oa/accounts?businessId=${BUSINESS_ID}`,
    payload: { businessId: BUSINESS_ID, accounts: [{ id: 'line-account-1', displayName: 'Main store', status: 'ACTIVE', channelAccessToken: 'PRIVATE_LINE_TOKEN' }] },
    record: { id: 'line-account-1', label: 'Main store', status: 'ACTIVE' },
    secret: 'PRIVATE_LINE_TOKEN',
  },
  {
    domain: 'commerce', path: `/api/commerce/orders?businessId=${BUSINESS_ID}&limit=25`,
    payload: { businessId: BUSINESS_ID, orders: [{ id: 'order-1', code: 'SO-1', status: 'DRAFT', payments: [{ amount: 999 }] }], summary: { open: 1 } },
    record: { id: 'order-1', label: 'SO-1', status: 'DRAFT' },
    secret: '999',
  },
  {
    domain: 'inventory', path: `/api/inventory/products?businessId=${BUSINESS_ID}`,
    payload: [{ id: 'product-1', code: 'SKU-1', name: 'Tea', status: 'ACTIVE', unitCostSatang: 8000, vendorEmail: 'PRIVATE_INVENTORY_EMAIL' }],
    record: { id: 'product-1', label: 'Tea', status: 'ACTIVE' },
    secret: 'PRIVATE_INVENTORY_EMAIL',
  },
  {
    domain: 'procurement', path: `/api/procurement/purchase-orders?businessId=${BUSINESS_ID}&limit=25`,
    payload: { businessId: BUSINESS_ID, orders: [{ id: 'purchase-1', code: 'PO-1', status: 'SENT', total: 4200, supplier: { email: 'PRIVATE_SUPPLIER_EMAIL' } }], summary: { open: 1 } },
    record: { id: 'purchase-1', label: 'PO-1', status: 'SENT' },
    secret: 'PRIVATE_SUPPLIER_EMAIL',
  },
  {
    domain: 'assets', path: `/api/assets/register?businessId=${BUSINESS_ID}&limit=25`,
    payload: { items: [{ id: 'asset-1', assetCode: 'A-1', name: 'Laptop', status: 'ACTIVE', serialNumber: 'PRIVATE_SERIAL' }], nextCursor: null },
    record: { id: 'asset-1', label: 'Laptop', status: 'ACTIVE' },
    secret: 'PRIVATE_SERIAL',
  },
  {
    domain: 'people', path: `/api/people?businessId=${BUSINESS_ID}`,
    payload: { business: { id: BUSINESS_ID, code: 'B-1', name: 'Business', tenantId: 'tenant-1' }, canManageEmployment: false, canRemoveEmployment: false, accessMembers: [], accessWithoutEmployment: [], people: [{ employmentId: 'employment-1', person: { id: 'person-1', displayName: 'Jordan', email: 'PRIVATE_PERSON_EMAIL' }, employeeNo: 'PRIVATE_EMPLOYEE_NO', title: 'Owner', status: 'ACTIVE', startAt: '2026-01-01' }], summary: { peopleCount: 1 } },
    record: { id: 'employment-1', label: 'Jordan', status: 'ACTIVE' },
    secret: 'PRIVATE_PERSON_EMAIL',
  },
  {
    domain: 'knowledge', path: `/api/knowledge/sources?businessId=${BUSINESS_ID}&limit=25`,
    payload: { items: [{ id: 'source-1', title: 'Handbook', status: 'READY', fileAssetId: 'PRIVATE_FILE_ID' }], hasMore: false, nextCursor: null, capabilities: { reason: 'PRIVATE_CAPABILITY' } },
    record: { id: 'source-1', label: 'Handbook', status: 'READY' },
    secret: 'PRIVATE_FILE_ID',
  },
  {
    domain: 'platform', path: `/api/platform/integrations?businessId=${BUSINESS_ID}`,
    payload: [{ id: 'integration-1', name: 'CRM sync', providerName: 'Example', provider: 'SECRET_PROVIDER_DATA', kind: 'CHANNEL', status: 'ACTIVE', secretRef: 'PRIVATE_SECRET_REF' }],
    record: { id: 'integration-1', label: 'CRM sync', status: 'ACTIVE' },
    secret: 'PRIVATE_SECRET_REF',
  },
];

test('connector status is explicit, disabled by default, and target only accepts the two loopback ports', async (t) => {
  const disabled = await harness(t, { enabled: false });
  const status = await request(disabled.base, '/api/zuri/status', { cookie: false });
  assert.equal(status.response.status, 200);
  assert.deepEqual(status.json, { enabled: false, target: disabled.target });
  const scope = await request(disabled.base, '/api/zuri/scope');
  assert.equal(scope.response.status, 503);
  const domain = await request(disabled.base, domainPath('projects'));
  assert.equal(domain.json.state, 'UNAVAILABLE');
  assert.equal(disabled.calls.length, 0);

  const uat = await harness(t, { enabled: true, port: '3000' });
  assert.deepEqual((await request(uat.base, '/api/zuri/status', { cookie: false })).json, {
    enabled: true,
    target: 'http://127.0.0.1:3000',
  });
  for (const port of ['3001', '80', 'https://127.0.0.1:3100', 'localhost:3100']) {
    assert.throws(() => createZuriConnector({ enabled: false, port }), /ZURI_PORT must be 3000 or 3100/);
  }
});

test('scope uses /api/entry and returns only the sanitized authorized Business list', async (t) => {
  const entry = {
    viewer: {
      principal: { id: 'private-principal-id', displayName: 'PRIVATE_VIEWER_NAME' },
      role: 'OWNER', visibleDomains: ['commerce', 'people', 'platform'], isPlatform: true,
    },
    businesses: [{
      id: BUSINESS_ID, code: 'B-1', name: 'Business', canCreateBusiness: true,
      tenant: { id: 'private-tenant-id', code: 'PRIVATE_TENANT_CODE', name: 'PRIVATE_TENANT_NAME' },
      portfolio: { id: 'private-portfolio-id', code: 'PRIVATE_PORTFOLIO_CODE', name: 'PRIVATE_PORTFOLIO_NAME' },
    }],
  };
  const h = await harness(t, { upstream: async () => jsonResponse(entry) });
  const result = await request(h.base, '/api/zuri/scope');
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.json, {
    businesses: [{ id: BUSINESS_ID, code: 'B-1', name: 'Business' }],
    source: { path: '/api/entry', status: 200 },
  });
  assert.equal(h.calls[0].url.href, `${h.target}/api/entry`);
  assert.equal(h.calls[0].init.headers.cookie, SESSION_COOKIE);
  assert.deepEqual(Object.keys(h.calls[0].init.headers).sort(), ['accept', 'cookie']);
  assert.doesNotMatch(result.text, /PRIVATE_|tenant|portfolio|viewer|workspace|projects/i);
  assert.equal(Object.hasOwn(result.json, 'workspaces'), false);
  assert.equal(Object.hasOwn(result.json, 'projects'), false);
});

test('scope rejects malformed entry success DTOs and preserves typed authorization denials', async (t) => {
  let upstreamResponse = jsonResponse({ businesses: [{ id: BUSINESS_ID, code: 'B-1', name: 'Business' }] });
  const h = await harness(t, { upstream: async () => upstreamResponse });
  const malformed = await request(h.base, '/api/zuri/scope');
  assert.equal(malformed.response.status, 502);
  assert.equal(malformed.json.error.code, 'UPSTREAM_CONTRACT_MISMATCH');
  assert.deepEqual(malformed.json.source, { path: '/api/entry', status: 200 });
  assert.equal(Object.hasOwn(malformed.json, 'businesses'), false);

  upstreamResponse = jsonResponse({ error: { code: 'BUSINESS_ROUTE_FORBIDDEN', message: 'PRIVATE_DENIAL_MESSAGE' } }, 403);
  const denied = await request(h.base, '/api/zuri/scope');
  assert.equal(denied.response.status, 403);
  assert.equal(denied.json.error.code, 'FORBIDDEN');
  assert.equal(denied.json.error.sourceCode, undefined);
  assert.deepEqual(denied.json.source, { path: '/api/entry', status: 403 });
  assert.doesNotMatch(denied.text, /PRIVATE_DENIAL_MESSAGE/);
});

test('all twelve active domains call fixed backend paths and expose only their safe record projection', async (t) => {
  let payload;
  const h = await harness(t, { upstream: async () => jsonResponse(payload) });
  for (const item of domainCases) {
    payload = item.payload;
    const result = await request(h.base, domainPath(item.domain));
    assert.equal(result.response.status, 200, item.domain);
    assert.equal(result.json.domain, item.domain);
    assert.equal(result.json.state, 'READY', item.domain);
    assert.deepEqual(result.json.records, [item.record], item.domain);
    assert.equal(result.json.count, 1, item.domain);
    assert.equal(result.json.displayedCount, 1, item.domain);
    assert.equal(result.json.returnedCount, 1, item.domain);
    assert.equal(result.json.countKind, 'DISPLAYED', item.domain);
    assert.equal(result.json.countLabel, 'Records displayed', item.domain);
    assert.equal(result.json.source.path, item.path.split('?')[0], item.domain);
    assert.equal(h.calls.at(-1).url.href, `${h.target}${item.path}`, item.domain);
    assert.equal(h.calls.at(-1).init.method || 'GET', 'GET', item.domain);
    assert.equal(h.calls.at(-1).init.headers.cookie, SESSION_COOKIE, item.domain);
    assert.deepEqual(Object.keys(h.calls.at(-1).init.headers).sort(), ['accept', 'cookie'], item.domain);
    assert.doesNotMatch(result.text, new RegExp(item.secret), item.domain);
    assert.deepEqual(Object.keys(result.json.records[0]).sort(), ['id', 'label', 'status'], item.domain);
  }
  assert.equal(h.calls.length, domainCases.length);
});

test('reserved domains and agent dispatch stay honest and never call upstream', async (t) => {
  const h = await harness(t);
  for (const domain of ['warehouse', 'operations']) {
    const result = await request(h.base, domainPath(domain));
    assert.equal(result.json.state, 'RESERVED');
    assert.equal(result.json.error.code, 'DOMAIN_RESERVED');
    assert.equal(result.json.agent.state, 'UNAVAILABLE');
  }
  const agent = await request(h.base, '/api/zuri/agent', { method: 'POST', body: { businessId: BUSINESS_ID, question: 'Start work' } });
  assert.equal(agent.response.status, 501);
  assert.equal(agent.json.error.code, 'AGENT_DISPATCH_UNAVAILABLE');
  assert.equal(h.calls.length, 0);
});

test('malformed, HTML, and unknown success DTOs are errors rather than empty results', async (t) => {
  let responseFactory = async () => jsonResponse(null);
  const h = await harness(t, { upstream: async (...args) => responseFactory(...args) });
  for (const item of domainCases) {
    const result = await request(h.base, domainPath(item.domain));
    assert.equal(result.json.state, 'ERROR', item.domain);
    assert.equal(result.json.error.code, 'UPSTREAM_CONTRACT_MISMATCH', item.domain);
    assert.equal(result.json.source.status, 200, item.domain);
  }

  responseFactory = async () => new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  const html = await request(h.base, domainPath('projects'));
  assert.equal(html.json.state, 'ERROR');
  assert.equal(html.json.error.code, 'UPSTREAM_CONTRACT_MISMATCH');
  assert.equal(html.json.source.status, 200);

  responseFactory = async () => jsonResponse({ items: [], limit: '25', truncated: false });
  const wrongType = await request(h.base, domainPath('projects'));
  assert.equal(wrongType.json.state, 'ERROR');
  assert.equal(wrongType.json.error.code, 'UPSTREAM_CONTRACT_MISMATCH');
});

test('domain response distinguishes displayed rows, returned rows, and known pagination', async (t) => {
  const rows = Array.from({ length: 55 }, (_, index) => ({ id: `product-${index}`, name: `Product ${index}`, status: 'ACTIVE' }));
  const h = await harness(t, { upstream: async () => jsonResponse(rows) });
  const result = await request(h.base, domainPath('inventory'));
  assert.equal(result.json.state, 'READY');
  assert.equal(result.json.records.length, 50);
  assert.equal(result.json.count, 50);
  assert.equal(result.json.returnedCount, 55);
  assert.equal(result.json.countKind, 'DISPLAYED');
  assert.equal(result.json.truncated, true);
  assert.equal(result.json.moreAvailable, true);
  assert.equal(Object.hasOwn(result.json, 'totalCount'), false);
});

test('upstream auth, forbidden, redirects, and availability errors stay typed and sanitized', async (t) => {
  let status = 401;
  const h = await harness(t, {
    upstream: async () => jsonResponse({ error: { code: 'SESSION_EXPIRED', message: 'PRIVATE_BACKEND_MESSAGE' } }, status),
  });
  const auth = await request(h.base, domainPath('projects'));
  assert.equal(auth.json.state, 'AUTH_REQUIRED');
  assert.equal(auth.json.error.code, 'AUTH_REQUIRED');
  assert.equal(auth.json.error.sourceCode, 'SESSION_EXPIRED');
  assert.doesNotMatch(auth.text, /PRIVATE_BACKEND_MESSAGE/);

  status = 403;
  const forbidden = await request(h.base, domainPath('people'));
  assert.equal(forbidden.json.state, 'FORBIDDEN');
  assert.equal(forbidden.json.error.sourceCode, 'SESSION_EXPIRED');

  status = 404;
  const hiddenBusiness = await request(h.base, domainPath('growth'));
  assert.equal(hiddenBusiness.json.state, 'FORBIDDEN');

  status = 503;
  const unavailable = await request(h.base, domainPath('commerce'));
  assert.equal(unavailable.json.state, 'UNAVAILABLE');

  status = 302;
  const redirected = await request(h.base, domainPath('projects'));
  assert.equal(redirected.json.state, 'AUTH_REQUIRED');
  assert.equal(h.calls.length, 5, 'redirects are classified without following them');
});

test('business, path, target, and credential inputs cannot alter the fixed proxy request', async (t) => {
  const h = await harness(t);
  const extraQuery = await request(h.base, domainPath('projects', '&path=http://169.254.169.254/latest/meta-data'));
  assert.equal(extraQuery.response.status, 400);
  assert.equal(extraQuery.json.error.code, 'INVALID_REQUEST');
  const unknownDomain = await request(h.base, domainPath('not-a-domain'));
  assert.equal(unknownDomain.response.status, 404);
  const unknown = await request(h.base, '/api/zuri/domains/projects/../../admin');
  assert.equal(unknown.response.status, 404);
  const malformedId = await request(h.base, '/api/zuri/domains/projects?businessId=not-a-uuid');
  assert.equal(malformedId.response.status, 400);
  assert.equal(h.calls.length, 0);
  assert.throws(() => createZuriConnector({ enabled: true, port: '127.0.0.1:3100' }), /ZURI_PORT must be 3000 or 3100/);
});

test('loopback Host and exact Origin checks block cross-origin reads and writes', async (t) => {
  const h = await harness(t);
  const crossOrigin = await request(h.base, '/api/zuri/status', { cookie: false, origin: 'http://attacker.example' });
  assert.equal(crossOrigin.response.status, 403);
  const noOrigin = await request(h.base, '/api/zuri/domains/growth/ask', {
    method: 'POST', body: { businessId: BUSINESS_ID, question: 'How are campaigns doing?' }, origin: null,
  });
  assert.equal(noOrigin.response.status, 403);
  assert.equal(h.calls.length, 0);

  const hostAttack = await new Promise((resolve, reject) => {
    const address = new URL(h.base);
    const req = http.request({
      hostname: '127.0.0.1', port: address.port, path: '/api/zuri/status', method: 'GET',
      headers: { host: `attacker.example:${address.port}` },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal(hostAttack.status, 403);
});

test('marketing ask calls only the deterministic read model and projects safe response fields', async (t) => {
  let sentBody;
  const upstreamPayload = {
    readModel: 'MARKETING_ASK', schemaVersion: '1.0', businessId: BUSINESS_ID,
    question: 'How are campaigns doing?', intentType: 'CAMPAIGN_STATUS', state: 'READY',
    answer: { sections: [{ key: 'campaigns', title: 'Campaigns', count: 2, privateBrief: 'PRIVATE_ASK_DATA' }], recommendations: [{ text: 'ignored' }] },
    sources: [{ source: 'MARKETING', state: 'READY', reasonCode: null, private: 'PRIVATE_SOURCE_DATA' }],
    unavailable: [], generatedAt: '2026-10-20T12:00:00.000Z',
  };
  const h = await harness(t, {
    upstream: async (_url, init) => {
      sentBody = JSON.parse(init.body);
      return jsonResponse(upstreamPayload);
    },
  });
  const result = await request(h.base, '/api/zuri/domains/growth/ask', {
    method: 'POST', body: { businessId: BUSINESS_ID, question: ' How are campaigns doing? ' },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.json.command, 'MARKETING_ASK');
  assert.equal(result.json.execution, 'DETERMINISTIC_READ_MODEL');
  assert.equal(result.json.agent.state, 'UNAVAILABLE');
  assert.deepEqual(sentBody, { businessId: BUSINESS_ID, question: 'How are campaigns doing?' });
  assert.equal(h.calls[0].url.href, `${h.target}/api/growth/ask-marketing`);
  assert.equal(h.calls[0].init.headers.cookie, SESSION_COOKIE);
  assert.equal(h.calls[0].init.headers.origin, h.target);
  assert.deepEqual(result.json.response.answer, { sections: [{ key: 'campaigns', title: 'Campaigns', count: 2 }], recommendations: [] });
  assert.doesNotMatch(result.text, /PRIVATE_|ignored/);

  const unsupportedHarness = await harness(t, {
    upstream: async () => jsonResponse({
      readModel: 'MARKETING_ASK', schemaVersion: '1.0', businessId: BUSINESS_ID,
      question: 'Unsupported', intentType: 'UNSUPPORTED', state: 'UNAVAILABLE', answer: null,
      sources: [], unavailable: [{ source: 'ASK_MARKETING', reasonCode: 'QUESTION_UNSUPPORTED' }],
      generatedAt: '2026-10-20T12:00:00.000Z',
    }),
  });
  const unsupported = await request(unsupportedHarness.base, '/api/zuri/domains/growth/ask', {
    method: 'POST', body: { businessId: BUSINESS_ID, question: 'Unsupported' },
  });
  assert.equal(unsupported.json.state, 'UNAVAILABLE');
  assert.equal(unsupported.json.response.answer, null);
});

test('Marketing question uses trimmed 400 character boundary before upstream',async t=>{
 const h=await harness(t,{upstream:async()=>jsonResponse({})});
 const rejected=await request(h.base,'/api/zuri/domains/growth/ask',{method:'POST',body:{businessId:BUSINESS_ID,question:'x'.repeat(401)}});
 assert.equal(rejected.response.status,400);assert.equal(h.calls.length,0);
 await request(h.base,'/api/zuri/domains/growth/ask',{method:'POST',body:{businessId:BUSINESS_ID,question:'  '+'x'.repeat(400)+'  '}});assert.equal(h.calls.length,1);
});
test('Marketing rejects wrong scope and preserves only bounded source provenance',async t=>{
 const payload={readModel:'MARKETING_ASK',schemaVersion:'1.0',businessId:BUSINESS_ID,question:'status',intentType:'CAMPAIGN_STATUS',state:'PARTIAL',answer:null,sources:[{owner:'MARKETING',source:'MARKETING_CAMPAIGNS',sourceVersion:'v1',ref:'private-reference',window:{from:'2026-10-01',to:'2026-10-24'},state:'READY'}],unavailable:[],generatedAt:'2026-10-24T00:00:00Z'};
 const h=await harness(t,{upstream:async()=>jsonResponse(payload)}),send=()=>request(h.base,'/api/zuri/domains/growth/ask',{method:'POST',body:{businessId:BUSINESS_ID,question:'status'}});
 const valid=await send();assert.equal(valid.json.response.sources[0].owner,undefined);assert.equal(valid.json.response.sources[0].sourceVersion,undefined);assert.equal(valid.json.response.sources[0].window,undefined);assert.doesNotMatch(valid.text,/private-reference/);
 payload.businessId='foreign';assert.equal((await send()).response.status,502);
 payload.businessId=BUSINESS_ID;payload.schemaVersion='999';assert.equal((await send()).response.status,502);
});

test('knowledge query sends a fixed topK=5 scoped retrieval and returns validated result envelopes', async (t) => {
  let sentBody;
  const knowledge = {
    corpusId: 'corpus-1', corpusGeneration: 3, manifestHash: 'a'.repeat(64), ranking: 'rrf-k60',
    results: [{ sourceId: 'source-1', ingestionId: 'ingestion-1', snapshotId: 'snapshot-1', generation: 3,
      chunkId: 'chunk-1', contentHash: 'b'.repeat(64), rankFusionScore: 0.7, snapshotScore: 0.8,
      text: 'Approved internal policy.', citationId: 'citation-1', privateInternalField: 'PRIVATE_KNOWLEDGE_METADATA' }],
  };
  const h = await harness(t, {
    upstream: async (_url, init) => {
      sentBody = JSON.parse(init.body);
      return jsonResponse(knowledge);
    },
  });
  const result = await request(h.base, '/api/zuri/domains/knowledge/query', {
    method: 'POST', body: { businessId: BUSINESS_ID, query: 'policy' },
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.json.command, 'KNOWLEDGE_QUERY');
  assert.equal(result.json.execution, 'SCOPED_KNOWLEDGE_RETRIEVAL');
  assert.deepEqual(sentBody, { businessId: BUSINESS_ID, query: 'policy', topK: 5 });
  assert.equal(h.calls[0].url.href, `${h.target}/api/knowledge/queries`);
  assert.equal(h.calls[0].init.headers.cookie, SESSION_COOKIE);
  assert.equal(h.calls[0].init.headers.origin, h.target);
  assert.equal(result.json.response.results[0].citationId, 'citation-1');
  assert.doesNotMatch(result.text, /PRIVATE_KNOWLEDGE_METADATA/);

  const invalid = await request(h.base, '/api/zuri/domains/knowledge/query', {
    method: 'POST', body: { businessId: BUSINESS_ID, query: 'policy', topK: 6 },
  });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.json.error.code, 'INVALID_REQUEST');
  assert.equal(h.calls.length, 1);
});

test('command body size, malformed JSON, unknown fields, and invalid DTOs fail closed', async (t) => {
  let payload = { readModel: 'MARKETING_ASK', schemaVersion: '1.0', businessId: BUSINESS_ID,
    question: 'Q', intentType: 'UNSUPPORTED', state: 'UNAVAILABLE', answer: null, sources: [], unavailable: [],
    generatedAt: '2026-10-20T12:00:00.000Z' };
  const h = await harness(t, { upstream: async () => jsonResponse(payload) });
  const malformedJson = await request(h.base, '/api/zuri/domains/growth/ask', {
    method: 'POST', body: '{bad-json', headers: { 'content-type': 'application/json' },
  });
  assert.equal(malformedJson.response.status, 400);
  const extraField = await request(h.base, '/api/zuri/domains/growth/ask', {
    method: 'POST', body: { businessId: BUSINESS_ID, question: 'Q', prompt: 'inject' },
  });
  assert.equal(extraField.response.status, 400);
  const oversized = await request(h.base, '/api/zuri/domains/growth/ask', {
    method: 'POST', body: { businessId: BUSINESS_ID, question: 'q'.repeat(17_000) },
  });
  assert.equal(oversized.response.status, 413);

  payload = { readModel: 'MARKETING_ASK', state: 'READY', answer: [] };
  const badSuccess = await request(h.base, '/api/zuri/domains/growth/ask', {
    method: 'POST', body: { businessId: BUSINESS_ID, question: 'Q' },
  });
  assert.equal(badSuccess.response.status, 502);
  assert.equal(badSuccess.json.error.code, 'UPSTREAM_CONTRACT_MISMATCH');
});
