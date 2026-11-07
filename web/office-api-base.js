const apiBase = typeof __OFFICE_API_BASE__ === 'string' ? __OFFICE_API_BASE__ : '/api/';

function validApiBase(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !/[?#\\]/.test(value)
    && !value.split('/').includes('..');
}

if (!validApiBase(apiBase)) throw new Error('Office API base must be a same-origin path');

export const OFFICE_API_BASE = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;

export function officeApiUrl(route = '') {
  if (typeof route !== 'string' || /^[a-z][a-z\d+.-]*:/i.test(route) || route.startsWith('//') || route.includes('#')) {
    throw new Error('Office API route must be a same-origin path');
  }
  return OFFICE_API_BASE + route.replace(/^\/+/, '');
}
