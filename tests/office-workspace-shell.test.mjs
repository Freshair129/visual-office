import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';import {JSDOM} from 'jsdom';

test('shipped HTML contains only the new workspace shell, not a concealed legacy dashboard',async()=>{
 const html=await readFile('web/index.html','utf8'),dom=new JSDOM(html),d=dom.window.document;
 for(const selector of ['.rail','.mobile-nav','#office-overview','.workspace-grid','#agent-detail','#agent-list','#job-list','#office-chat-slot','#job-dialog','#chat-open-full','#chat-quick-status'])assert.equal(d.querySelector(selector),null,selector);
 assert.equal(d.querySelector('#office-view').children.length,0);
 assert.equal(d.querySelector('#agent-chat').parentElement.id,'chat-page-content');
 assert.equal(d.querySelectorAll('#chat-input').length,1);
 assert.ok(d.querySelector('.workspace-dock [data-nav="chat"]'));
 assert.ok(d.querySelector('.workspace-header [data-nav="office"]'));
 for(const path of ['style.css','workspace.css','chat-page.css','chat-rich.css','workspace-pages.css']){
  assert.equal(d.querySelector(`link[href="./${path}"]`),null);
  await assert.rejects(access('web/'+path));
 }
 dom.window.close();
});

test('app no longer binds retired navigation and dashboard selectors',async()=>{
 const source=await readFile('web/app.js','utf8');
 assert.doesNotMatch(source,/railSize|rail-toggle|rail-open|agent-detail|\$\('#agent-list'|setTab\(|renderActivity|office-chat-slot|showChatView/);
 assert.match(source,/workspace-header/);
});
