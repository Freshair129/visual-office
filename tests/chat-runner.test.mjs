import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceChat,chatSnapshot} from '../scripts/chat-runner.mjs';
import {roleCards} from '../web/agent-state.js';
const message=()=>({id:crypto.randomUUID(),threadId:'thread',commandId:crypto.randomUUID(),text:'Follow up',status:'queued',createdAt:new Date().toISOString()});
const setup=()=>{const d={shell:{threads:[{id:'thread',latestTurn:{state:'completed',turnId:'previous'}}]},detail:{thread:{messages:[]}},budget:{remaining:6},initialMessages:[],commands:[]};d.dispatch=async c=>{d.commands.push(c)};return d;};
test('follow-up uses the same chat, keeps IDs, and a second queued message waits for the current turn',async()=>{
 const d=setup(),m=message();assert.deepEqual(await advanceChat(m,d),{status:'sent'});assert.equal(d.commands[0].threadId,'thread');assert.equal(d.commands[0].message.text,'Follow up');assert.equal(d.commands[0].commandId,m.commandId);assert.equal(d.commands[0].runtimeMode,'approval-required');
 assert.equal(await advanceChat(message(),d),null);assert.equal(d.commands.length,1);
 d.detail.thread.messages=[{id:m.id,turnId:'own-turn'}];d.shell.threads[0].latestTurn={state:'running',turnId:'own-turn'};assert.deepEqual(await advanceChat(m,d),{status:'sent'});assert.equal(d.commands.length,1);
 d.shell.threads[0].latestTurn={state:'completed',turnId:'own-turn'};assert.deepEqual(await advanceChat({...m,status:'sent'},d),{status:'done'});
});
test('pending approvals, missing role chat and capacity queue messages; archived chats fail visibly',async()=>{
 const d=setup(),m=message();d.shell.threads[0].hasPendingApprovals=true;assert.equal(await advanceChat(m,d),null);
 d.shell.threads=[];d.initialMessages=[{threadId:'thread',canStart:true}];assert.equal(await advanceChat(m,d),null);
 d.initialMessages=[];assert.equal((await advanceChat(m,d)).status,'error');
 d.shell.threads=[{id:'thread',archivedAt:'now'}];assert.equal((await advanceChat(m,d)).status,'error');
});
test('visible history substitutes the original brief, excludes reasoning, and live chat animates a completed role job',()=>{
 const snap=chatSnapshot({id:'thread',latestTurn:{state:'running'}},{thread:{messages:[{id:'initial',role:'user',text:'Internal role instructions'},{id:'hidden',role:'reasoning',text:'Secret'},{id:'reply',role:'assistant',text:'Visible'}]}},[{threadId:'thread',messageId:'initial',text:'Original brief'}]);assert.equal(snap.messages.length,2);assert.equal(snap.messages[0].text,'Original brief');assert.equal(snap.status,'working');
 const cards=roleCards([{id:'thread',status:'working',lastLog:'Answering follow up'}],[],{},[{title:'Old task',steps:[{agentId:'beam',threadId:'thread',status:'done'}]}],true);assert.equal(cards[5].name,'Beam');assert.equal(cards[5].status,'working');assert.equal(cards[5].activeCount,1);
});
test('chat snapshots expose a bounded older-history window and mark omitted messages',()=>{
 const detail={thread:{messages:Array.from({length:125},(_,i)=>({id:'m'+i,role:'assistant',text:'x'.repeat(8000)})),activities:[]}},snapshot=chatSnapshot({id:'thread'},detail,[]);
 assert.ok(snapshot.messages.length>0&&snapshot.messages.length<=100);assert.equal(snapshot.messages.at(-1).id,'m124');assert.equal(snapshot.historyTruncated,true);assert.ok(JSON.stringify(snapshot).length<=400000);
});
test('attachments reach native T3 and replay checks the message before re-uploading',async()=>{
 const d=setup(),m={...message(),attachments:[{id:'cloud-file'}]};let uploads=0;d.prepareAttachments=async()=>{uploads++;return[{id:'t3-file',type:'file',name:'test.txt',mimeType:'text/plain',sizeBytes:10}];};
 await advanceChat(m,d);assert.equal(uploads,1);assert.equal(d.commands[0].message.attachments[0].id,'t3-file');
 d.detail.thread.messages=[{id:m.id,turnId:'own'}];d.shell.threads[0].latestTurn={state:'completed',turnId:'own'};await advanceChat({...m,status:'sent'},d);assert.equal(uploads,1);assert.equal(d.commands.length,1);
});
test('capability snapshots use matching provider/workspace and omit disabled skills and paths',()=>{
 const snap=chatSnapshot({id:'t',modelSelection:{instanceId:'codex',model:'example'}},{thread:{messages:[],activities:[{tone:'tool',summary:'Read test.txt'},{tone:'info',summary:'ignore'}]}},[],{projectRoot:'C:/project',providers:[{instanceId:'codex',driver:'codex',skills:[],workspaceSnapshots:[{cwd:'C:/project',skills:[{name:'pdf',description:'Read PDFs',enabled:true,path:'secret'},{name:'disabled',enabled:false}],slashCommands:[]}]}]});
 assert.deepEqual(snap.capabilities.skills,[{name:'pdf',description:'Read PDFs'}]);assert.deepEqual(snap.capabilities.observedTools,['Read test.txt']);assert.equal(JSON.stringify(snap).includes('secret'),false);
});

test('chat notifications respect provider errors and background work even after an earlier completed turn',()=>{
 const detail={thread:{messages:[],activities:[]}},base={id:'t',latestTurn:{state:'completed'}};
 assert.equal(chatSnapshot({...base,session:{status:'error'}},detail,[]).status,'stuck');
 assert.equal(chatSnapshot({...base,backgroundLiveness:'working'},detail,[]).status,'working');
 assert.equal(chatSnapshot(base,detail,[]).status,'done');
});

test('context uses only actual context-window events from this thread and chooses the latest valid report',()=>{
 const thread={id:'t',modelSelection:{instanceId:'codex',model:'model-a'}},detail={thread:{messages:[],activities:[{kind:'context-window.updated',createdAt:'2026-10-10T00:00:00Z',payload:{usedTokens:100,maxTokens:1000,credential:'private'}},{kind:'context-window.updated',createdAt:'2026-10-10T00:01:00Z',payload:{usedTokens:200,maxTokens:1000}},{kind:'context-window.updated',createdAt:'2026-10-10T00:02:00Z',payload:{usedTokens:'bad',maxTokens:1000}},{kind:'other',payload:{usedTokens:999}}]}};
 const capabilities=chatSnapshot(thread,detail,[]).capabilities;assert.deepEqual(capabilities.context,{usedTokens:200,maxTokens:1000,updatedAt:'2026-10-10T00:01:00Z'});assert.equal(capabilities.model,'model-a');assert.equal(JSON.stringify(capabilities).includes('private'),false);
 assert.equal(chatSnapshot(thread,{thread:{messages:[],activities:[]}},[]).capabilities.context,null);
});
