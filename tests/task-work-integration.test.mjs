import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {TaskUI} from '../web/tasks.js';
test('creating work uses saved server knowledge and opens the full work page',async()=>{
 const dom=new JSDOM(await readFile(new URL('../web/index.html',import.meta.url),'utf8'),{url:'https://office.example/'});
 const previous={document:globalThis.document,Option:globalThis.Option,fetch:globalThis.fetch};
 globalThis.document=dom.window.document;globalThis.Option=dom.window.Option;
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;}
  const requests=[],opened=[],version={id:'22222222-2222-4222-8222-222222222222',name:'brief.pdf',mimeType:'application/pdf',sizeBytes:100,digest:'a'.repeat(64),status:'approved'};const job={id:'11111111-1111-4111-8111-111111111111',title:'Research',agentIds:['beam'],team:false,status:'queued',steps:[]};
  globalThis.fetch=async(path,options={})=>{requests.push({path,body:options.body?JSON.parse(options.body):null});return Response.json(path==='/api/knowledge'?{versions:[version]}:{job});};
 try{
  const ui=new TaskUI({getAgent:()=> 'beam',isDemo:()=>false,toast(){},refresh(){},openWork:id=>opened.push(id),chat(){}});
  ui.open({chooseRecipient:true});assert.equal(document.querySelector('#task-agent').value,'');
  assert.equal(document.querySelectorAll('#task-members input:checked').length,0);
  await new Promise(resolve=>setTimeout(resolve,0));document.querySelector('#task-knowledge-list input').checked=true;document.querySelector('#task-title').value='Research';document.querySelector('#task-brief').value='Compare three rivals';
  document.querySelector('#task-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(requests.map(r=>r.path),['/api/knowledge']);
  document.querySelector('#task-agent').value='beam';
  document.querySelector('#task-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual(requests.map(r=>r.path),['/api/knowledge','/api/jobs']);
  assert.deepEqual(requests[1].body.agentIds,['beam']);assert.deepEqual(requests[1].body.knowledgeVersionIds,[version.id]);assert.deepEqual(opened,[job.id]);
  assert.equal(document.querySelector('#job-list'),null);
  assert.equal(document.querySelector('#job-dialog'),null);
 }finally{Object.assign(globalThis,previous);dom.window.close();}
});
