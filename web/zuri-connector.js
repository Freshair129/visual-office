import {CONTEXT_PATH,readContextJSON} from './office-domain-context.js';
const ZURI_PORTS = new Set(['3000', '3100']);

const DOMAIN_KEYS = new Set([
  'business-home', 'projects', 'customer', 'market', 'growth', 'line-oa', 'commerce', 'inventory',
  'warehouse', 'procurement', 'assets', 'people', 'operations', 'knowledge', 'platform',
]);

const DOMAIN_PATHS = Object.freeze({
  'business-home': '/overview',
  projects: '/projects', customer: '/customer', market: '/market', growth: '/growth',
  'line-oa': '/line-oa', commerce: '/commerce', inventory: '/inventory', warehouse: '/warehouse',
  procurement: '/procurement', assets: '/assets', people: '/people', operations: '/operations',
  knowledge: '/knowledge', platform: '/settings',
});
const API_PATHS = new Set([
  '/api/zuri/status', '/api/zuri/scope',
  ...[...DOMAIN_KEYS].filter(key => key !== 'business-home').map(key => `/api/zuri/domains/${key}`),
  '/api/zuri/domains/growth/ask', '/api/zuri/domains/knowledge/query',
]);

export function normalizeZuriOrigin(target) {
  try {
    const url = new URL(String(target || ''));
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !ZURI_PORTS.has(url.port)
      || url.username || url.password || !['', '/'].includes(url.pathname) || url.search || url.hash) return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function safeZuriLoginUrl(origin) {
  const safeOrigin = normalizeZuriOrigin(origin);
  return safeOrigin ? `${safeOrigin}/login` : '';
}

export function safeZuriBusinessesUrl(origin) {
  const safeOrigin = normalizeZuriOrigin(origin);
  return safeOrigin ? `${safeOrigin}/businesses` : '';
}

export class ZuriApiError extends Error {
  constructor(status, code = '') {
    super(`Zuri request failed (${status || 'network'})`);
    this.name = 'ZuriApiError';
    this.status = Number(status) || 0;
    this.code = /^[A-Z0-9_-]{1,64}$/.test(String(code)) ? String(code) : '';
  }
}

function safeErrorCode(value) {
  return typeof value === 'string' && /^[A-Z0-9_-]{1,64}$/.test(value) ? value : '';
}

function responseError(response, payload) {
  const candidates = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? [
      payload.error && typeof payload.error === 'object' && !Array.isArray(payload.error) ? payload.error.code : null,
      payload.code,
      payload.errorCode,
      typeof payload.error === 'string' ? payload.error : null,
    ]
    : [];
  const code = candidates.map(safeErrorCode).find(Boolean) || '';
  return new ZuriApiError(response.status, code);
}

export function safeZuriDomainUrl(domainKey, businessId, origin) {
  if (!DOMAIN_KEYS.has(domainKey)) throw new TypeError('Unknown Zuri domain');
  const safeOrigin = normalizeZuriOrigin(origin);
  if (!safeOrigin) throw new TypeError('Unknown Zuri target');
  const path = DOMAIN_PATHS[domainKey] || '/';
  const url = new URL(path, safeOrigin);
  // The Zuri UI scope selector ignores businessId query parameters. Keep URLs
  // navigation-only and ask the user to verify the selected Business there.
  return url.href;
}

export class ZuriConnector {
  constructor({fetchImpl = globalThis.fetch?.bind(globalThis)} = {}) {
    this.fetchImpl = fetchImpl;
  }

  getDomainContext(businessId,{signal}={}){
    if(typeof businessId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(businessId))throw new TypeError('Invalid Business scope');
    return this.readCandidateContext(businessId,signal);
  }
  async readCandidateContext(businessId,signal){
    let response;try{response=await this.fetchImpl(CONTEXT_PATH+'?businessId='+encodeURIComponent(businessId),{method:'GET',credentials:'omit',cache:'no-store',signal});}catch(error){if(error.name==='AbortError')throw error;throw new ZuriApiError(0,'CONTEXT_UNAVAILABLE');}
    if(!response.ok){await response.body?.cancel().catch(()=>{});throw new ZuriApiError(response.status===404?403:response.status,'CONTEXT_UNAVAILABLE');}
    return readContextJSON(response);
  }
  async request(path, {method = 'GET', body, signal} = {}) {
    if (typeof this.fetchImpl !== 'function') throw new ZuriApiError(0, 'FETCH_UNAVAILABLE');
    const [pathname, rawQuery = ''] = String(path).split('?', 2);
    const knownRoute = API_PATHS.has(pathname);
    const isDomainRead = knownRoute && [...DOMAIN_KEYS].some(key => key !== 'business-home' && pathname === `/api/zuri/domains/${key}`);
    const allowedQuery = !rawQuery || (isDomainRead && (() => {
      const params = new URLSearchParams(rawQuery);
      return params.size === 1 && Boolean(params.get('businessId')) && /^[A-Za-z0-9_-]{1,128}$/.test(params.get('businessId'));
    })());
    const allowedMethod = pathname.endsWith('/ask') || pathname.endsWith('/query') ? 'POST' : 'GET';
    if (!knownRoute || !allowedQuery || method !== allowedMethod) {
      throw new TypeError('Unsupported Zuri connector path');
    }
    let response;
    try {
      response = await this.fetchImpl(path, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
        headers: body === undefined ? undefined : {'content-type': 'application/json'},
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new ZuriApiError(0, 'NETWORK_ERROR');
    }
    let payload = null;
    try { payload = await response.json(); } catch { /* an empty error response is still reported by status */ }
    if (!response.ok) throw responseError(response, payload);
    return payload;
  }

  getStatus(options = {}) { return this.request('/api/zuri/status', options); }
  getScope(options = {}) { return this.request('/api/zuri/scope', options); }

  getDomain(domainKey, businessId, options = {}) {
    if (!DOMAIN_KEYS.has(domainKey)) throw new TypeError('Unknown Zuri domain');
    if (!businessId) throw new TypeError('A selected Business is required');
    return this.request(`/api/zuri/domains/${domainKey}?businessId=${encodeURIComponent(businessId)}`, options);
  }

  askGrowth(businessId, question, options = {}) {
    if (!businessId || typeof question !== 'string' || question.trim().length > 400) throw new TypeError('Business and question are required');
    return this.request('/api/zuri/domains/growth/ask', {
      ...options, method: 'POST', body: {businessId, question: String(question).trim()},
    });
  }

  searchKnowledge(businessId, query, options = {}) {
    if (!businessId || !String(query || '').trim()) throw new TypeError('Business and query are required');
    return this.request('/api/zuri/domains/knowledge/query', {
      ...options, method: 'POST', body: {businessId, query: String(query).trim(), topK: 5},
    });
  }
}
