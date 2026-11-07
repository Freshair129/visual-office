import { Buffer } from 'node:buffer';


const ALLOWED_ZURI_PORTS = new Set(['3000', '3100']);
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_RECORDS = 50;
const UPSTREAM_TIMEOUT_MS = 12_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_COOKIE_VALUE = /^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+$/;

const DOMAINS = Object.freeze({
  projects: {
    path: '/api/projects',
    query: { limit: '25' },
    validPayload: (payload) => isObject(payload) && Array.isArray(payload.items)
      && Number.isInteger(payload.limit) && typeof payload.truncated === 'boolean',
    collection: (payload) => payload?.items,
    id: (row) => row?.id,
    label: (row) => row?.name || row?.code,
    status: (row) => row?.status,
  },
  customer: {
    path: '/api/crm/conversations',
    query: { limit: '25' },
    validPayload: (payload) => isObject(payload) && payload.version === '1.0' && isObject(payload.scope)
      && Array.isArray(payload.conversations)
      && isObject(payload.counts) && Number.isInteger(payload.limit) && typeof payload.truncated === 'boolean',
    collection: (payload) => payload?.conversations,
    id: (row) => row?.id,
    label: (row) => `${safeText(row?.channel, 32) || 'Customer'} conversation ${shortId(row?.id)}`,
    status: (row) => row?.status,
  },
  market: {
    path: '/api/market/observations',
    query: { limit: '25' },
    validPayload: (payload) => isObject(payload) && payload.version === '1.0' && isObject(payload.scope)
      && Array.isArray(payload.observations)
      && isObject(payload.counts) && Number.isInteger(payload.limit) && typeof payload.truncated === 'boolean',
    collection: (payload) => payload?.observations,
    id: (row) => row?.id,
    label: (row) => row?.title || [row?.provider, row?.observationType].filter(Boolean).join(' · '),
    status: (row) => row?.resolutionStatus,
  },
  growth: {
    path: '/api/growth/campaigns',
    query: {},
    validPayload: (payload) => isObject(payload) && Array.isArray(payload.campaigns)
      && typeof payload.canWrite === 'boolean' && typeof payload.truncated === 'boolean',
    collection: (payload) => payload?.campaigns,
    id: (row) => row?.id,
    label: (row) => row?.title || row?.name || row?.code,
    status: (row) => row?.status || row?.phase,
  },
  'line-oa': {
    path: '/api/line-oa/accounts',
    query: {},
    validPayload: (payload) => isObject(payload) && typeof payload.businessId === 'string' && Array.isArray(payload.accounts),
    collection: (payload) => payload?.accounts,
    id: (row) => row?.id,
    label: (row) => row?.displayName || row?.name || row?.code,
    status: (row) => row?.status,
  },
  commerce: {
    path: '/api/commerce/orders',
    query: { limit: '25' },
    validPayload: (payload) => isObject(payload) && typeof payload.businessId === 'string'
      && Array.isArray(payload.orders) && isObject(payload.summary),
    collection: (payload) => payload?.orders,
    id: (row) => row?.id,
    label: (row) => row?.code || row?.orderNo,
    status: (row) => row?.status,
  },
  inventory: {
    path: '/api/inventory/products',
    query: {},
    validPayload: (payload) => Array.isArray(payload),
    collection: (payload) => payload,
    id: (row) => row?.id,
    label: (row) => row?.name || row?.code,
    status: (row) => row?.status,
  },
  procurement: {
    path: '/api/procurement/purchase-orders',
    query: { limit: '25' },
    validPayload: (payload) => isObject(payload) && typeof payload.businessId === 'string'
      && Array.isArray(payload.orders) && isObject(payload.summary),
    collection: (payload) => payload?.orders,
    id: (row) => row?.id,
    label: (row) => row?.code || row?.orderNo,
    status: (row) => row?.status,
  },
  assets: {
    path: '/api/assets/register',
    query: { limit: '25' },
    validPayload: (payload) => isObject(payload) && Array.isArray(payload.items)
      && (payload.nextCursor === null || typeof payload.nextCursor === 'string'),
    collection: (payload) => payload?.items,
    id: (row) => row?.id,
    label: (row) => row?.name || row?.assetCode,
    status: (row) => row?.status,
  },
  people: {
    path: '/api/people',
    query: {},
    validPayload: (payload) => isObject(payload) && isObject(payload.business)
      && Array.isArray(payload.people) && Array.isArray(payload.accessMembers)
      && Array.isArray(payload.accessWithoutEmployment) && isObject(payload.summary),
    collection: (payload) => payload?.people,
    id: (row) => row?.employmentId,
    label: (row) => row?.person?.displayName || row?.person?.code,
    status: (row) => row?.status,
  },
  knowledge: {
    path: '/api/knowledge/sources',
    query: { limit: '25' },
    validPayload: (payload) => isObject(payload) && Array.isArray(payload.items)
      && typeof payload.hasMore === 'boolean'
      && (payload.nextCursor === null || typeof payload.nextCursor === 'string'),
    collection: (payload) => payload?.items,
    id: (row) => row?.id,
    label: (row) => row?.title,
    status: (row) => row?.status,
  },
  platform: {
    path: '/api/platform/integrations',
    query: {},
    validPayload: (payload) => Array.isArray(payload),
    collection: (payload) => payload,
    id: (row) => row?.id,
    label: (row) => row?.name || row?.providerName || row?.provider || row?.kind,
    status: (row) => row?.status || row?.health?.state,
  },
});

const RESERVED_DOMAINS = new Set(['warehouse', 'operations']);
const AGENT_UNAVAILABLE = Object.freeze({
  state: 'UNAVAILABLE',
  reason: 'NO_AUTHENTICATED_DOMAIN_AGENT_DISPATCH_API',
});

const SAFE_ERRORS = Object.freeze({
  AUTH_REQUIRED: 'Sign in to Zuri and choose a Business to read this data.',
  FORBIDDEN: 'This data is not available to the current Zuri session or Business scope.',
  UNAVAILABLE: 'Zuri did not return data. Check that the local backend is running and try again.',
  ERROR: 'Zuri returned a response that could not be safely read.',
  UPSTREAM_CONTRACT_MISMATCH: 'Zuri returned data outside the supported API contract.',
  UPSTREAM_RESPONSE_TOO_LARGE: 'Zuri returned more data than the connector can safely read.',
  INVALID_REQUEST: 'The request did not match the supported connector contract.',
  DOMAIN_RESERVED: 'This domain is reserved and has no active Zuri API.',
});

function safeText(value, max = 180) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function shortId(value) {
  const id = safeText(value, 80);
  return id ? id.slice(0, 8) : 'record';
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function publicError(code, sourceCode = null) {
  return {
    code,
    message: SAFE_ERRORS[code] || SAFE_ERRORS.ERROR,
    ...(sourceCode ? { sourceCode } : {}),
  };
}

function contractMismatch(sourceStatus = null) {
  const error = new Error('upstream contract mismatch');
  error.code = 'UPSTREAM_CONTRACT_MISMATCH';
  if (sourceStatus !== null) error.sourceStatus = sourceStatus;
  return error;
}

function writeJson(res, status, payload, extraHeaders = {}) {
  if (res.headersSent) return;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function resolveTarget(portValue = process.env.ZURI_PORT) {
  const port = portValue === undefined || portValue === '' ? '3100' : String(portValue);
  if (!ALLOWED_ZURI_PORTS.has(port)) throw new TypeError('ZURI_PORT must be 3000 or 3100');
  return `http://127.0.0.1:${port}`;
}

function loopbackHost(hostname) {
  const value = String(hostname || '').toLowerCase();
  return value === '127.0.0.1' || value === 'localhost' || value === '[::1]' || value === '::1';
}

function loopbackAddress(address) {
  const value = String(address || '').toLowerCase();
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}

function requestIsSameOriginLoopback(req) {
  const hostHeader = req.headers.host;
  if (typeof hostHeader !== 'string' || !hostHeader || hostHeader.includes(',')) return false;
  if (!loopbackAddress(req.socket?.remoteAddress)) return false;

  let host;
  try {
    host = new URL(`http://${hostHeader}`);
  } catch {
    return false;
  }
  if (host.username || host.password || !loopbackHost(host.hostname)) return false;
  const port = host.port ? Number(host.port) : 80;
  if (!Number.isInteger(port) || port !== req.socket?.localPort) return false;

  const originHeader = req.headers.origin;
  if (originHeader === undefined) return req.method !== 'POST';
  if (typeof originHeader !== 'string' || originHeader.includes(',')) return false;

  try {
    const origin = new URL(originHeader);
    return origin.protocol === 'http:'
      && !origin.username
      && !origin.password
      && loopbackHost(origin.hostname)
      && origin.origin === host.origin;
  } catch {
    return false;
  }
}

function sessionCookie(cookieHeader) {
  if (typeof cookieHeader !== 'string' || cookieHeader.length > 16_384) return null;
  const matches = [];
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name === 'zuri_session') matches.push(part.slice(separator + 1).trim());
  }
  if (matches.length !== 1) return null;
  const value = matches[0];
  if (!value || value.length > 8192 || !SESSION_COOKIE_VALUE.test(value)) return null;
  return `zuri_session=${value}`;
}

async function readRequestJson(req) {
  const type = req.headers['content-type'];
  if (typeof type !== 'string' || !/^application\/json(?:\s*;|\s*$)/i.test(type)) {
    return { error: 'INVALID_REQUEST', status: 415 };
  }
  const declared = req.headers['content-length'];
  if (declared !== undefined && (!/^\d+$/.test(String(declared)) || Number(declared) > MAX_REQUEST_BYTES)) {
    req.resume();
    return { error: 'INVALID_REQUEST', status: 413 };
  }

  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_REQUEST_BYTES) {
      chunks.length = 0;
      return { error: 'INVALID_REQUEST', status: 413 };
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!isObject(body)) return { error: 'INVALID_REQUEST', status: 400 };
    return { body };
  } catch {
    return { error: 'INVALID_REQUEST', status: 400 };
  }
}

function onlyKeys(value, keys) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validBusinessId(value) {
  return typeof value === 'string' && UUID.test(value);
}

function exactKeys(value, fields) {
  return isObject(value) && Object.keys(value).length === fields.length
    && Object.keys(value).every((key) => fields.includes(key));
}

function requiredEntryText(value, max) {
  if (typeof value !== 'string' || !value.trim()) throw contractMismatch();
  const sanitized = safeText(value, max);
  if (!sanitized) throw contractMismatch();
  return sanitized;
}

function safeEntry(payload) {
  if (!exactKeys(payload, ['viewer', 'businesses']) || !Array.isArray(payload.businesses)) throw contractMismatch();
  const viewer = payload.viewer;
  if (!exactKeys(viewer, ['principal', 'role', 'visibleDomains', 'isPlatform'])
    || !exactKeys(viewer.principal, ['id', 'displayName'])
    || !['OWNER', 'MEMBER', 'DEV'].includes(viewer.role)
    || !Array.isArray(viewer.visibleDomains) || !viewer.visibleDomains.every((domain) => typeof domain === 'string')
    || typeof viewer.isPlatform !== 'boolean'
    || typeof viewer.principal.id !== 'string' || !viewer.principal.id.trim()
    || typeof viewer.principal.displayName !== 'string') throw contractMismatch();

  const businesses = payload.businesses.map((business) => {
    if (!exactKeys(business, ['id', 'code', 'name', 'canCreateBusiness', 'tenant', 'portfolio'])
      || typeof business.canCreateBusiness !== 'boolean'
      || !exactKeys(business.tenant, ['id', 'code', 'name'])
      || !exactKeys(business.portfolio, ['id', 'code', 'name'])) throw contractMismatch();
    const id = requiredEntryText(business.id, 64);
    if (!UUID.test(id)) throw contractMismatch();
    requiredEntryText(business.tenant.id, 64);
    requiredEntryText(business.tenant.code, 64);
    requiredEntryText(business.tenant.name, 180);
    requiredEntryText(business.portfolio.id, 64);
    requiredEntryText(business.portfolio.code, 64);
    requiredEntryText(business.portfolio.name, 180);
    return {
      id,
      code: requiredEntryText(business.code, 64),
      name: requiredEntryText(business.name, 180),
    };
  });
  return { businesses, source: { path: '/api/entry', status: 200 } };
}

async function readBoundedText(response) {
  const chunks = [];
  let bytes = 0;
  if (!response.body) return '';
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      const error = new Error('upstream response too large');
      error.code = 'UPSTREAM_RESPONSE_TOO_LARGE';
      throw error;
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function classifyStatus(status) {
  if (status === 401 || (status >= 300 && status < 400)) return 'AUTH_REQUIRED';
  if (status === 403 || status === 404) return 'FORBIDDEN';
  if (status === 408 || status === 425 || status === 429 || status >= 500) return 'UNAVAILABLE';
  return 'ERROR';
}

function safeSourceCode(payload) {
  const candidate = payload?.error?.code ?? payload?.errorCode ?? payload?.code;
  return typeof candidate === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(candidate)
    ? candidate
    : null;
}

function extractRecords(domain, payload, businessId) {
  const definition = DOMAINS[domain];
  if (!definition.validPayload(payload)) throw contractMismatch();
  const payloadBusinessId = payload?.businessId ?? payload?.scope?.businessId ?? payload?.business?.id;
  if (payloadBusinessId !== undefined && payloadBusinessId !== businessId) throw contractMismatch();
  const rows = definition.collection(payload);
  if (!Array.isArray(rows)) throw contractMismatch();
  const mapped = [];
  for (const [index, row] of rows.entries()) {
    if (!isObject(row)) throw contractMismatch();
    const id = safeText(definition.id(row), 160);
    if (!id) throw contractMismatch();
    const rawStatus = definition.status(row);
    if (rawStatus !== undefined && rawStatus !== null && typeof rawStatus !== 'string') throw contractMismatch();
    if (index >= MAX_RECORDS) continue;
    const label = safeText(definition.label(row), 180) || `Record ${shortId(id)}`;
    const status = safeText(rawStatus, 48);
    mapped.push({ id, label, ...(status ? { status } : {}) });
  }
  const moreAvailable = payload?.truncated === true || payload?.hasMore === true
    || (typeof payload?.nextCursor === 'string' && payload.nextCursor.length > 0);
  return {
    records: mapped,
    returnedCount: rows.length,
    truncated: rows.length > MAX_RECORDS || moreAvailable,
    moreAvailable: rows.length > MAX_RECORDS || moreAvailable,
  };
}

function safeMarketingResult(payload, businessId, question) {
  if (!isObject(payload) || payload.readModel !== 'MARKETING_ASK'
    || payload.schemaVersion !== '1.0' || payload.businessId !== businessId
    || !['READY','EMPTY','PARTIAL','UNAVAILABLE','UNKNOWN'].includes(payload.state)
    || typeof payload.intentType !== 'string'
    || (payload.answer !== null && (!isObject(payload.answer)
      || !Array.isArray(payload.answer.sections) || !Array.isArray(payload.answer.recommendations)))
    || !Array.isArray(payload.sources) || !Array.isArray(payload.unavailable)
    || typeof payload.generatedAt !== 'string') {
    throw contractMismatch();
  }
  const answer = payload.answer;
  const sections = answer ? answer.sections.slice(0, 20).map((section) => {
    if (!isObject(section)) throw contractMismatch();
    const result = {};
    for (const key of ['key', 'title', 'state']) {
      const value = safeText(section[key], 80);
      if (value) result[key] = value;
    }
    for (const key of ['count', 'value']) {
      if (section[key] === null || (typeof section[key] === 'number' && Number.isFinite(section[key]))) result[key] = section[key];
    }
    if (isObject(section.window)) {
      result.window = {
        ...(section.window.from === null ? { from: null } : safeText(section.window.from, 48) ? { from: safeText(section.window.from, 48) } : {}),
        ...(section.window.to === null ? { to: null } : safeText(section.window.to, 48) ? { to: safeText(section.window.to, 48) } : {}),
      };
    }
    return result;
  }) : null;
  const safeSources = payload.sources.slice(0, 20).map((source) => {
    if (!isObject(source)) throw contractMismatch();
    return ({
    ...(safeText(source?.source, 80) ? { source: safeText(source.source, 80) } : {}),
    ...(safeText(source?.state, 48) ? { state: safeText(source.state, 48) } : {}),
    ...(safeText(source?.reasonCode, 100) ? { reasonCode: safeText(source.reasonCode, 100) } : {}),
    });
  });
  const unavailable = payload.unavailable.slice(0, 20).map((entry) => {
    if (!isObject(entry)) throw contractMismatch();
    return ({
    ...(safeText(entry?.source, 80) ? { source: safeText(entry.source, 80) } : {}),
    ...(safeText(entry?.reasonCode, 100) ? { reasonCode: safeText(entry.reasonCode, 100) } : {}),
    });
  });
  return {
    command: 'MARKETING_ASK',
    execution: 'DETERMINISTIC_READ_MODEL',
    agent: AGENT_UNAVAILABLE,
    state: safeText(payload.state, 48) || 'UNKNOWN',
    source: { path: '/api/growth/ask-marketing' },
    response: {
      readModel: 'MARKETING_ASK',
      schemaVersion: safeText(payload.schemaVersion, 24) || '1.0',
      businessId,
      question,
      intentType: safeText(payload.intentType, 48) || 'UNKNOWN',
      state: safeText(payload.state, 48) || 'UNKNOWN',
      answer: sections ? { sections, recommendations: [] } : null,
      sources: safeSources,
      unavailable,
      generatedAt: safeText(payload.generatedAt, 64),
    },
  };
}

function responseFailure(res, status, code, extra = {}) {
  const mapped = code === 'AUTH_REQUIRED' || code === 'FORBIDDEN' || code === 'UNAVAILABLE'
    || code === 'UPSTREAM_CONTRACT_MISMATCH' || code === 'UPSTREAM_RESPONSE_TOO_LARGE'
    || code === 'INVALID_REQUEST'
    ? code
    : 'ERROR';
  const safeStatus = status === 413 || status === 415
    ? status
    : mapped === 'AUTH_REQUIRED' ? 401
      : mapped === 'FORBIDDEN' ? 403
        : mapped === 'UNAVAILABLE' ? 503
          : mapped === 'UPSTREAM_CONTRACT_MISMATCH' || mapped === 'UPSTREAM_RESPONSE_TOO_LARGE' || status >= 500
            ? 502
            : status;
  writeJson(res, safeStatus, { error: publicError(mapped), ...extra });
}

function getSingleBusinessId(url) {
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 1 || keys[0] !== 'businessId' || url.searchParams.getAll('businessId').length !== 1) return null;
  const value = url.searchParams.get('businessId');
  return validBusinessId(value) ? value : null;
}

function validQueryKeys(url, allowed) {
  const keys = [...url.searchParams.keys()];
  return keys.every((key) => allowed.includes(key)) && allowed.every((key) => url.searchParams.getAll(key).length <= 1);
}

function isKnowledgeQueryResponse(payload) {
  if (!isObject(payload) || typeof payload.corpusId !== 'string'
    || !Number.isInteger(payload.corpusGeneration) || typeof payload.manifestHash !== 'string'
    || payload.ranking !== 'rrf-k60' || !Array.isArray(payload.results)) return false;
  return payload.results.every((row) => isObject(row)
    && typeof row.sourceId === 'string' && typeof row.ingestionId === 'string'
    && typeof row.snapshotId === 'string' && Number.isInteger(row.generation)
    && typeof row.chunkId === 'string' && typeof row.contentHash === 'string'
    && Number.isFinite(row.rankFusionScore) && Number.isFinite(row.snapshotScore)
    && typeof row.text === 'string' && typeof row.citationId === 'string');
}

function safeKnowledgeQueryResponse(payload) {
  if (!isKnowledgeQueryResponse(payload)) throw contractMismatch();
  return {
    corpusId: payload.corpusId,
    corpusGeneration: payload.corpusGeneration,
    manifestHash: payload.manifestHash,
    ranking: payload.ranking,
    results: payload.results.map((row) => ({
      sourceId: row.sourceId,
      ingestionId: row.ingestionId,
      snapshotId: row.snapshotId,
      generation: row.generation,
      chunkId: row.chunkId,
      contentHash: row.contentHash,
      rankFusionScore: row.rankFusionScore,
      snapshotScore: row.snapshotScore,
      text: row.text,
      citationId: row.citationId,
    })),
  };
}

export function createZuriConnector({ enabled = false, port, fetchImpl = globalThis.fetch, timeoutMs = UPSTREAM_TIMEOUT_MS, now = () => new Date() } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const target = resolveTarget(port);
  const upstreamOrigin = target;

  async function callUpstream(path, { method = 'GET', body, cookie } = {}) {
    const headers = { accept: 'application/json' };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      headers.origin = upstreamOrigin;
    }
    const response = await fetchImpl(`${target}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      return { status: response.status, redirect: true, payload: null };
    }
    const text = await readBoundedText(response);
    const contentType = response.headers?.get?.('content-type') || '';
    if (response.status >= 200 && response.status < 300
      && !/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
      throw contractMismatch(response.status);
    }
    if (!text) {
      if (response.status >= 200 && response.status < 300) throw contractMismatch(response.status);
      return { status: response.status, payload: null, sourceCode: null };
    }
    try {
      const payload = JSON.parse(text);
      return { status: response.status, payload, sourceCode: safeSourceCode(payload) };
    } catch {
      if (response.status >= 200 && response.status < 300) throw contractMismatch(response.status);
      return { status: response.status, payload: null, sourceCode: null };
    }
  }

  async function safeCall(path, options) {
    try {
      return { result: await callUpstream(path, options) };
    } catch (error) {
      const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      if (error?.code === 'UPSTREAM_CONTRACT_MISMATCH' || error?.code === 'UPSTREAM_RESPONSE_TOO_LARGE') {
        return { state: 'ERROR', errorCode: error.code, status: error.sourceStatus ?? null };
      }
      return { state: isTimeout ? 'UNAVAILABLE' : 'UNAVAILABLE' };
    }
  }

  function authError(res, source = null, status = 401, domain = null) {
    const error = publicError('AUTH_REQUIRED');
    if (source) return writeJson(res, 200, {
      ...(domain ? { domain } : {}), state: 'AUTH_REQUIRED', source, error, agent: AGENT_UNAVAILABLE,
      checkedAt: now().toISOString(), records: [], count: 0, displayedCount: 0,
      returnedCount: 0, countKind: 'DISPLAYED', countLabel: 'Records displayed',
    });
    return writeJson(res, status, { error });
  }

  function proxyState(result, fallbackState) {
    return fallbackState || classifyStatus(result.status);
  }

  async function handleScope(req, res, cookie) {
    if (!enabled) return responseFailure(res, 503, 'UNAVAILABLE');
    if (!cookie) return authError(res);
    const called = await safeCall('/api/entry', { cookie });
    if (!called.result) {
      const code = called.errorCode || called.state;
      return responseFailure(res, called.state === 'ERROR' ? 502 : 503, called.state, {
        error: publicError(code), source: { path: '/api/entry', status: called.status ?? null },
      });
    }
    const { result } = called;
    if (result.status < 200 || result.status >= 300) {
      const state = proxyState(result);
      const protectedDenial = [403,404].includes(result.status);
      return responseFailure(res, result.status, state, {
        state, error: publicError(state, protectedDenial ? undefined : result.sourceCode), source: { path: '/api/entry', status: protectedDenial ? 403 : result.status },
      });
    }
    try {
      writeJson(res, 200, safeEntry(result.payload));
    } catch {
      responseFailure(res, 502, 'UPSTREAM_CONTRACT_MISMATCH', {
        error: publicError('UPSTREAM_CONTRACT_MISMATCH'),
        source: { path: '/api/entry', status: result.status },
      });
    }
  }

  async function handleDomain(req, res, url, domain, cookie) {
    const checkedAt = now().toISOString();
    const sourcePathValue = DOMAINS[domain]?.path || null;
    const source = { path: sourcePathValue, status: null };
    if (RESERVED_DOMAINS.has(domain)) {
      return writeJson(res, 200, {
        domain, state: 'RESERVED', checkedAt, source,
        records: [], count: 0, displayedCount: 0, returnedCount: 0, countKind: 'DISPLAYED', countLabel: 'Records displayed', agent: AGENT_UNAVAILABLE,
        error: { code: 'DOMAIN_RESERVED', message: SAFE_ERRORS.DOMAIN_RESERVED },
      });
    }
    if (!DOMAINS[domain]) return responseFailure(res, 404, 'ERROR');
    if (!validQueryKeys(url, ['businessId'])) return responseFailure(res, 400, 'INVALID_REQUEST');
    const businessId = getSingleBusinessId(url);
    if (!businessId) return responseFailure(res, 400, 'INVALID_REQUEST');
    if (!enabled) {
      return writeJson(res, 200, {
        domain, state: 'UNAVAILABLE', checkedAt, source,
        records: [], count: 0, displayedCount: 0, returnedCount: 0, countKind: 'DISPLAYED', countLabel: 'Records displayed',
        agent: AGENT_UNAVAILABLE, error: publicError('UNAVAILABLE'),
      });
    }
    if (!cookie) return authError(res, source, 401, domain);

    const definition = DOMAINS[domain];
    const query = new URLSearchParams({ businessId, ...definition.query });
    const path = `${definition.path}?${query}`;
    const called = await safeCall(path, { cookie });
    if (!called.result) {
      const state = called.state;
      source.status = called.status;
      return writeJson(res, 200, {
        domain, state, checkedAt, source,
        records: [], count: 0, displayedCount: 0, returnedCount: 0, countKind: 'DISPLAYED', countLabel: 'Records displayed',
        agent: AGENT_UNAVAILABLE, error: publicError(called.errorCode || state),
      });
    }
    source.status = called.result.status;
    if (called.result.status < 200 || called.result.status >= 300) {
      const state = proxyState(called.result);
      const protectedMarketing = domain === 'growth' && [403,404].includes(called.result.status);
      if (protectedMarketing) source.status = 403;
      return writeJson(res, 200, {
        domain, state, checkedAt, source,
        records: [], count: 0, displayedCount: 0, returnedCount: 0, countKind: 'DISPLAYED', countLabel: 'Records displayed',
        agent: AGENT_UNAVAILABLE, error: publicError(state, protectedMarketing ? undefined : called.result.sourceCode),
      });
    }
    try {
      const { records, returnedCount, truncated, moreAvailable } = extractRecords(domain, called.result.payload, businessId);
      return writeJson(res, 200, {
        domain, state: records.length ? 'READY' : 'EMPTY', checkedAt, source,
        records, count: records.length, displayedCount: records.length, returnedCount,
        countKind: 'DISPLAYED', countLabel: 'Records displayed',
        ...(truncated ? { truncated: true } : {}), ...(moreAvailable ? { moreAvailable: true } : {}),
        agent: AGENT_UNAVAILABLE,
      });
    } catch (error) {
      return writeJson(res, 200, {
        domain, state: 'ERROR', checkedAt, source,
        records: [], count: 0, displayedCount: 0, returnedCount: 0, countKind: 'DISPLAYED', countLabel: 'Records displayed',
        agent: AGENT_UNAVAILABLE, error: publicError(error?.code || 'UPSTREAM_CONTRACT_MISMATCH'),
      });
    }
  }

  async function handleMarketingAsk(req, res, cookie) {
    if (!enabled) return responseFailure(res, 503, 'UNAVAILABLE');
    const parsed = await readRequestJson(req);
    if (parsed.error) return responseFailure(res, parsed.status, parsed.error);
    const body = parsed.body;
    if (!onlyKeys(body, ['businessId', 'question']) || !validBusinessId(body.businessId)
      || typeof body.question !== 'string' || body.question.trim().length > 400) {
      return responseFailure(res, 400, 'INVALID_REQUEST');
    }
    if (!cookie) return authError(res);
    const question = body.question.trim();
    const called = await safeCall('/api/growth/ask-marketing', {
      method: 'POST', cookie, body: { businessId: body.businessId, question },
    });
    if (!called.result) return responseFailure(res, called.state === 'ERROR' ? 502 : 503, called.state, {
      state: called.state, error: publicError(called.errorCode || called.state),
      command: 'MARKETING_ASK', execution: 'DETERMINISTIC_READ_MODEL',
      agent: AGENT_UNAVAILABLE, source: { path: '/api/growth/ask-marketing', status: called.status ?? null },
    });
    if (called.result.status < 200 || called.result.status >= 300) {
      const protectedMarketing = [403,404].includes(called.result.status);
      return responseFailure(res, called.result.status, proxyState(called.result), {
        state: proxyState(called.result), error: publicError(proxyState(called.result), protectedMarketing ? undefined : called.result.sourceCode),
        command: 'MARKETING_ASK', execution: 'DETERMINISTIC_READ_MODEL',
        agent: AGENT_UNAVAILABLE, source: { path: '/api/growth/ask-marketing', status: protectedMarketing ? 403 : called.result.status },
      });
    }
    try {
      const response = safeMarketingResult(called.result.payload, body.businessId, question);
      response.source.status = called.result.status;
      writeJson(res, 200, response);
    } catch (error) {
      responseFailure(res, 502, error?.code || 'UPSTREAM_CONTRACT_MISMATCH', {
        error: publicError(error?.code || 'UPSTREAM_CONTRACT_MISMATCH'),
        command: 'MARKETING_ASK', execution: 'DETERMINISTIC_READ_MODEL',
        agent: AGENT_UNAVAILABLE, source: { path: '/api/growth/ask-marketing', status: called.result.status },
      });
    }
  }

  async function handleKnowledgeQuery(req, res, cookie) {
    if (!enabled) return responseFailure(res, 503, 'UNAVAILABLE');
    const parsed = await readRequestJson(req);
    if (parsed.error) return responseFailure(res, parsed.status, parsed.error);
    const body = parsed.body;
    if (!onlyKeys(body, ['businessId', 'query', 'topK']) || !validBusinessId(body.businessId)
      || typeof body.query !== 'string' || !body.query.trim() || body.query.length > 12_000
      || (body.topK !== undefined && body.topK !== 5)) {
      return responseFailure(res, 400, 'INVALID_REQUEST');
    }
    if (!cookie) return authError(res);
    const requestBody = { businessId: body.businessId, query: body.query.trim(), topK: 5 };
    const called = await safeCall('/api/knowledge/queries', { method: 'POST', cookie, body: requestBody });
    const source = { path: '/api/knowledge/queries', status: called.result?.status ?? null };
    if (!called.result) return responseFailure(res, called.state === 'ERROR' ? 502 : 503, called.state, {
      error: publicError(called.errorCode || called.state),
      command: 'KNOWLEDGE_QUERY', execution: 'SCOPED_KNOWLEDGE_RETRIEVAL', agent: AGENT_UNAVAILABLE, source,
    });
    if (called.result.status < 200 || called.result.status >= 300) {
      return responseFailure(res, called.result.status, proxyState(called.result), {
        error: publicError(proxyState(called.result), called.result.sourceCode),
        command: 'KNOWLEDGE_QUERY', execution: 'SCOPED_KNOWLEDGE_RETRIEVAL', agent: AGENT_UNAVAILABLE, source,
      });
    }
    let response;
    try {
      response = safeKnowledgeQueryResponse(called.result.payload);
    } catch {
      return responseFailure(res, 502, 'UPSTREAM_CONTRACT_MISMATCH', {
        error: publicError('UPSTREAM_CONTRACT_MISMATCH'),
        command: 'KNOWLEDGE_QUERY', execution: 'SCOPED_KNOWLEDGE_RETRIEVAL', agent: AGENT_UNAVAILABLE, source,
      });
    }
    writeJson(res, 200, {
      command: 'KNOWLEDGE_QUERY',
      execution: 'SCOPED_KNOWLEDGE_RETRIEVAL',
      agent: AGENT_UNAVAILABLE,
      state: response.results.length ? 'READY' : 'EMPTY',
      source,
      response,
    });
  }

  return async function handleZuriRequest(req, res, url) {
    if (!url.pathname.startsWith('/api/zuri')) return false;
    if (!requestIsSameOriginLoopback(req)) {
      writeJson(res, 403, { error: publicError('FORBIDDEN') });
      return true;
    }

    const cookie = sessionCookie(req.headers.cookie);
    if (url.pathname === '/api/zuri/status') {
      if (req.method !== 'GET') writeJson(res, 405, { error: publicError('ERROR') }, { allow: 'GET' });
      else if (url.search) responseFailure(res, 400, 'INVALID_REQUEST');
      else writeJson(res, 200, { enabled: Boolean(enabled), target });
      return true;
    }
    if (url.pathname === '/api/zuri/scope') {
      if (req.method !== 'GET') writeJson(res, 405, { error: publicError('ERROR') }, { allow: 'GET' });
      else if (url.search) responseFailure(res, 400, 'INVALID_REQUEST');
      else await handleScope(req, res, cookie);
      return true;
    }
    if (url.pathname === '/api/zuri/domains/growth/ask') {
      if (req.method !== 'POST') writeJson(res, 405, { error: publicError('ERROR') }, { allow: 'POST' });
      else if (url.search) responseFailure(res, 400, 'INVALID_REQUEST');
      else await handleMarketingAsk(req, res, cookie);
      return true;
    }
    if (url.pathname === '/api/zuri/domains/knowledge/query') {
      if (req.method !== 'POST') writeJson(res, 405, { error: publicError('ERROR') }, { allow: 'POST' });
      else if (url.search) responseFailure(res, 400, 'INVALID_REQUEST');
      else await handleKnowledgeQuery(req, res, cookie);
      return true;
    }
    if (url.pathname === '/api/zuri/agent' || /^\/api\/zuri\/domains\/[a-z0-9-]+\/agent$/i.test(url.pathname)) {
      writeJson(res, 501, {
        error: { code: 'AGENT_DISPATCH_UNAVAILABLE', message: 'No authenticated domain-agent dispatch API is available.' },
        agent: AGENT_UNAVAILABLE,
      });
      return true;
    }

    const match = url.pathname.match(/^\/api\/zuri\/domains\/([a-z0-9-]+)$/i);
    if (match) {
      if (req.method !== 'GET') {
        writeJson(res, 405, { error: publicError('ERROR') }, { allow: 'GET' });
      } else {
        await handleDomain(req, res, url, match[1].toLowerCase(), cookie);
      }
      return true;
    }

    writeJson(res, 404, { error: { code: 'ROUTE_NOT_FOUND', message: 'Zuri connector route not found.' } });
    return true;
  };
}
