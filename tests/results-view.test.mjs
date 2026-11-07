import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyResult,collectResults,collectThreadContexts,filterResults,safeAttachmentFilename,safeResultFilename} from '../web/results-view.js';

const threadA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const threadB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('results are derived from nonempty persisted job steps with work, agent, thread, and timestamp provenance',()=>{
 const jobs=[{id:'job-1',title:'วิเคราะห์คู่แข่ง',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-02T00:00:00Z',steps:[
  {threadId:threadA,agentId:'beam',phase:'specialist',status:'done',result:'# หลักฐาน\n\nข้อมูลจากแหล่งที่มา'},
  {threadId:threadB,agentId:'mira',phase:'synthesis',status:'running',result:'```mermaid\ngraph LR\nA-->B\n```',resultTruncated:true},
  {threadId:'empty',agentId:'kai',result:'  '}
 ]}];
 const results=collectResults(jobs);
 assert.equal(results.length,2);
 assert.deepEqual(results.map(result=>result.id),[threadA,threadB]);
 assert.equal(results[0].workTitle,'วิเคราะห์คู่แข่ง');
 assert.equal(results[0].agentName,'Beam');
 assert.equal(results[0].threadId,threadA);
 assert.equal(results[0].timestamp,'2026-10-02T00:00:00Z');
 assert.equal(results[1].phase,'สรุปทีม');
 assert.equal(results[1].type.id,'diagram');
 assert.equal(results[1].truncated,true);
});

test('artifact type reflects markdown, plain text, diagrams, and interactive HTML actually present in results',()=>{
 assert.equal(classifyResult('Short answer').id,'text');
 assert.equal(classifyResult('## Report\n- finding').id,'report');
 assert.equal(classifyResult('```svg\n<svg></svg>\n```').format,'SVG');
 assert.equal(classifyResult('```html\n<button>Try</button>\n```').id,'interactive');
});

test('search matches result text, work title, and agent while filters narrow by persisted type and agent identity',()=>{
 const results=collectResults([{id:'job-1',title:'Retention plan',updatedAt:'2026-10-02T00:00:00Z',steps:[
  {threadId:threadA,agentId:'pim',status:'done',result:'## Returning customer segment'},
  {threadId:threadB,agentId:'beam',status:'done',result:'Competitor pricing notes'}
 ]}]);
 assert.deepEqual(filterResults(results,{query:'customer'}).map(r=>r.agentId),['pim']);
 assert.deepEqual(filterResults(results,{query:'retention',agentId:'beam'}).map(r=>r.agentId),['beam']);
 assert.deepEqual(filterResults(results,{type:'report'}).map(r=>r.agentId),['pim']);
 assert.equal(filterResults(results,{query:'missing'}).length,0);
});

test('download filenames remove path syntax and control characters while preserving readable Thai',()=>{
 const name=safeResultFilename('../รายงาน/แผนงาน\r\n','beam');
 assert.equal(name.includes('/'),false);
 assert.equal(name.includes('\\'),false);
 assert.equal(name.includes('\r'),false);
 assert.match(name,/รายงาน-แผนงาน-beam\.md$/);
 assert.equal(safeAttachmentFilename('../brief\r\n.txt').includes('..'),false);
});

test('file browsing contexts include known job threads before a result exists and optional known T3 sessions',()=>{
 const contexts=collectThreadContexts([{id:'job-1',title:'งานทดสอบ',steps:[
  {threadId:threadA,agentId:'beam',status:'running',result:''},
  {threadId:threadB,agentId:'kai',status:'cancelled',result:''}
 ]}],[{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'บทสนทนาเก่า'}]);
 assert.deepEqual(contexts.map(context=>context.threadId),[threadA,'dddddddd-dddd-4ddd-8ddd-dddddddddddd']);
 assert.equal(contexts[0].workTitle,'งานทดสอบ');
 assert.equal(contexts[0].agentName,'Beam');
 assert.equal(contexts[1].jobId,'');
});
