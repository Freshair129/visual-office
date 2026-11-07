import test from 'node:test';import assert from 'node:assert/strict';
import {parseOfficeDomainContext,readContextJSON,contextAllows} from '../web/office-domain-context.js';
const now=Date.parse('2026-10-24T00:00:00.000Z'),wallNow=()=>now;
export const sample=()=>({schemaVersion:'office-domain-context/v1',businessId:'a',contextRevision:'r1',generatedAt:new Date(now).toISOString(),sourceRevision:'a'.repeat(40),domains:[{domainKey:'growth',label:'Marketing',canonicalDomainId:'DOM-MARKETING',availability:'ACTIVE',modules:null,reads:[{operation:'marketing.campaigns.read',decision:'ALLOW'},{operation:'marketing.overview.read',decision:'ALLOW'}],actions:[]}]});
test('strict candidate context preserves order and requires exact scope, shape and hints',()=>{
 const valid=parseOfficeDomainContext(sample(),'a',{wallNow});assert.equal(contextAllows(valid,'growth','marketing.overview.read'),true);
 const mutations=[c=>c.businessId='b',c=>c.schemaVersion='v2',c=>c.secret='x',c=>c.domains=null,c=>c.domains.push(c.domains[0]),c=>c.domains[0].domainKey='scm',c=>c.domains[0].actions.push('send'),c=>c.domains[0].reads.push(c.domains[0].reads[0]),c=>c.domains[0].reads[0].operation='projects.read',c=>c.domains[0].modules=[{key:'a',label:'a'},{key:'a',label:'b'}]];
 for(const change of mutations){const c=sample();change(c);assert.throws(()=>parseOfficeDomainContext(c,'a',{wallNow}));}
 for(const availability of ['RESERVED','UNAVAILABLE']){const c=sample();c.domains[0].availability=availability;assert.equal(contextAllows(parseOfficeDomainContext(c,'a',{wallNow}),'growth','marketing.overview.read'),false);}
 const c=sample();c.domains[0]={...c.domains[0],domainKey:'future-leaf',canonicalDomainId:null,reads:[]};assert.equal(parseOfficeDomainContext(c,'a',{wallNow}).domains[0].domainKey,'future-leaf');
});
test('timestamps use explicit UTC millisecond calendar and frozen receipt clock',()=>{
 for(const generatedAt of ['2026-02-30T00:00:00.000Z','2026-10-24T00:00:00Z',new Date(now+1).toISOString(),new Date(now-60001).toISOString()])assert.throws(()=>parseOfficeDomainContext({...sample(),generatedAt},'a',{wallNow}));
 assert.ok(parseOfficeDomainContext({...sample(),generatedAt:new Date(now-60000).toISOString()},'a',{wallNow}));assert.throws(()=>parseOfficeDomainContext(sample(),'a',{}));
});
test('streamed UTF8 reader bounds actual bytes before JSON parsing, even without length',async()=>{
 const json=JSON.stringify(sample()),base=new TextEncoder().encode(json).length;assert.deepEqual(await readContextJSON(new Response(json+' '.repeat(65536-base))),sample());
 await assert.rejects(readContextJSON(new Response(json+' '.repeat(65537-base))));await assert.rejects(readContextJSON(new Response(new Uint8Array([255]))));
 let cancelled=false;const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(33000));},cancel(){cancelled=true;}});await assert.rejects(readContextJSON(new Response(stream)));assert.equal(cancelled,true);
 const c=sample();c.domains[0].label='ก'.repeat(160);assert.deepEqual(await readContextJSON(new Response(JSON.stringify(c))),c);
});
