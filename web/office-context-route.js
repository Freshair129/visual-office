import {workspaceRoute} from './workspace-navigation.js';
import {domainKeyValid} from './office-domain-context.js';
export function domainDetail(key){if(!domainKeyValid(key))throw Error('Invalid domain key');return 'domain:'+key;}
export function resolveOfficeContextRoute(hash,context){const lobby={kind:'shell',key:'lobby'};if(typeof hash!=='string'||!/^#office(?:\/[^/]*)?$/.test(hash))return lobby;const {id}=workspaceRoute(hash);if(!id)return {kind:'shell',key:'building'};if(['lobby','studio'].includes(id))return {kind:'shell',key:id};if(!id.startsWith('domain:'))return lobby;const key=id.slice(7);return domainKeyValid(key)&&context?.domains.some(d=>d.domainKey===key)?{kind:'domain',domainKey:key}:lobby;}
export function buildingPage(rows=[],index=0){const pages=Math.max(1,Math.ceil(rows.length/8)),page=Math.max(0,Math.min(pages-1,Number.isInteger(index)?index:0));return {page,pages,start:page*8,rows:rows.slice(page*8,page*8+8),total:rows.length};}
