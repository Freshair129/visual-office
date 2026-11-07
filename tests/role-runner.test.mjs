import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceJob} from '../scripts/role-runner.mjs';
import {taskPrompt} from '../web/agent-profiles.js';
import {roleCards} from '../web/agent-state.js';
const step=(agentId,phase='specialist')=>({agentId,phase,threadId:crypto.randomUUID(),messageId:crypto.randomUUID(),createCommandId:crypto.randomUUID(),startCommandId:crypto.randomUUID(),interruptCommandId:crypto.randomUUID(),status:'queued',result:''});
const job=()=>({id:crypto.randomUUID(),title:'Role test',brief:'Respond only; do not write files',context:'Test business',createdAt:new Date().toISOString(),status:'queued',steps:[step('beam'),step('kai'),step('mira','synthesis')]});
const args=()=>({shell:{threads:[{id:'existing',projectId:'project',modelSelection:{instanceId:'codex',model:'existing-model'}}]},project:{id:'project'},details:new Map(),commands:[],async dispatch(c){this.commands.push(c)}});
// dispatch is passed as a function by the production runner.
function deps(){const d=args();d.dispatch=c=>{d.commands.push(c);return Promise.resolve({})};return d;}
function completed(d,s,text){d.shell.threads=d.shell.threads.filter(t=>t.id!==s.threadId);d.shell.threads.push({id:s.threadId,latestTurn:{state:'completed',turnId:'turn'}});d.details.set(s.threadId,{thread:{messages:[{id:s.messageId,role:'user',text:'task'},{role:'reasoning',text:'secret',turnId:'turn'},{role:'assistant',text,turnId:'turn'}]}});}
test('specialists start as role chats; lead receives results only after all specialists complete',async()=>{
 const j=job(),d=deps();await advanceJob(j,d);assert.equal(d.commands.length,4);assert.equal(j.steps[2].status,'queued');
 assert.equal(d.commands[0].type,'thread.create');assert.ok(d.commands[1].message.text.includes('Agent ID: beam'));assert.equal(d.commands[1].runtimeMode,'approval-required');assert.equal(d.commands[0].modelSelection.model,'existing-model');assert.notEqual(d.commands[0].commandId,d.commands[1].commandId);
 completed(d,j.steps[0],'Beam evidence');d.shell.threads.push({id:j.steps[1].threadId,latestTurn:{state:'running'}});d.details.set(j.steps[1].threadId,{thread:{messages:[]}});await advanceJob(j,d);assert.equal(d.commands.length,4);
 completed(d,j.steps[1],'Kai content');await advanceJob(j,d);assert.equal(d.commands.length,6);const synthesis=d.commands[5].message.text;assert.ok(synthesis.includes('Beam evidence'));assert.ok(synthesis.includes('Kai content'));assert.ok(!synthesis.includes('secret'));
 completed(d,j.steps[2],'Mira summary');await advanceJob(j,d);assert.equal(j.status,'done');
});
test('restart reuses durable IDs and detects an already-dispatched message',async()=>{
 const j=job(),d=deps(),s=j.steps[0];d.shell.threads.push({id:s.threadId,latestTurn:{state:'running'}});d.details.set(s.threadId,{thread:{messages:[{id:s.messageId,role:'user'}]}});
 await advanceJob(j,d);assert.equal(s.status,'running');assert.equal(d.commands.some(c=>c.threadId===s.threadId),false);
});
test('approval waits recover, errors block synthesis, and cancelling stops running chats without starting queued ones',async()=>{
 const j=job(),d=deps();await advanceJob(j,d);d.shell.threads.push({id:j.steps[0].threadId,latestTurn:{state:'running'},hasPendingApprovals:true});d.details.set(j.steps[0].threadId,{thread:{messages:[]}});d.shell.threads.push({id:j.steps[1].threadId,latestTurn:{state:'running'}});d.details.set(j.steps[1].threadId,{thread:{messages:[]}});
 await advanceJob(j,d);assert.equal(j.status,'waiting');j.cancelRequested=true;await advanceJob(j,d);assert.equal(j.status,'cancelled');assert.equal(d.commands.filter(c=>c.type==='thread.turn.interrupt').length,2);assert.equal(j.steps[2].status,'cancelled');
 const bad=job(),e=deps();await advanceJob(bad,e);e.shell.threads.push({id:bad.steps[0].threadId,latestTurn:{state:'error'}});e.details.set(bad.steps[0].threadId,{thread:{messages:[]}});completed(e,bad.steps[1],'Completed');await advanceJob(bad,e);assert.equal(bad.status,'error');assert.equal(bad.steps[2].status,'cancelled');assert.equal(e.commands.length,4);
});
test('capacity queues work and stable role cards aggregate multiple chats without changing identity',async()=>{
 const j=job(),d=deps();d.budget={remaining:0};await advanceJob(j,d);assert.equal(d.commands.length,0);assert.equal(j.status,'queued');
 const second=job();second.steps=[step('beam')];second.steps[0].status='running';j.steps[0].status='running';const sessions=[{id:j.steps[0].threadId,name:'Task A',status:'working'},{id:second.steps[0].threadId,name:'Task B',status:'working'}];
 const cards=roleCards(sessions,Array(6).fill({id:null}),{},[second,j],true);assert.equal(cards[5].name,'Beam');assert.equal(cards[5].activeCount,2);assert.equal(cards[5].taskCount,2);assert.equal(cards[5].status,'working');assert.equal(roleCards(sessions,[],{},[j],false)[5].status,'offline');
 assert.ok(taskPrompt(j,j.steps[0]).includes('Test business'));
 const cancelled=job();cancelled.steps[0].status='cancelled';assert.equal(roleCards(sessions,[],{},[cancelled,j],true)[5].taskCount,1);
});
test('owner-selected sources fan out to every specialist and Mira, and transfer errors prevent dispatch',async()=>{
 const j=job(),d=deps(),source={id:crypto.randomUUID(),digest:'d'.repeat(64),name:'brief.pdf',mimeType:'application/pdf',sizeBytes:100,approvedAt:new Date().toISOString()};j.knowledgeSnapshot=[source];const prepared=[];
 const prepareKnowledge=async(job,step)=>{prepared.push(step.threadId);return[{id:'native_'+step.threadId,type:'file',name:source.name,mimeType:source.mimeType,sizeBytes:source.sizeBytes}];};
 await advanceJob(j,{...d,prepareKnowledge});
 let starts=d.commands.filter(c=>c.type==='thread.turn.start');assert.equal(starts.length,2);assert.equal(prepared.length,2);assert.notEqual(starts[0].message.attachments[0].id,starts[1].message.attachments[0].id);
 for(const step of j.steps.slice(0,2))completed(d,step,'Source-based result');
 await advanceJob(j,{...d,prepareKnowledge});starts=d.commands.filter(c=>c.type==='thread.turn.start');assert.equal(starts.length,3);assert.equal(starts[2].threadId,j.steps[2].threadId);assert.equal(starts[2].message.attachments[0].name,'brief.pdf');
 const prompt=taskPrompt(j,j.steps[0]);assert.ok(prompt.includes('ไฟล์ต้นฉบับ'));assert.ok(prompt.includes('brief.pdf'));assert.ok(prompt.includes('ไม่ได้ดึงข้อความ'));
 const blocked=job(),b=deps();blocked.steps=blocked.steps.slice(0,1);blocked.knowledgeSnapshot=[source];await assert.rejects(()=>advanceJob(blocked,{...b,prepareKnowledge:async()=>{throw new Error('source transfer failed');}}),/source transfer failed/);assert.equal(b.commands.some(c=>c.type==='thread.turn.start'),false);
});
