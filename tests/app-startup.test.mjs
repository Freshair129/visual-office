import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('initial document withholds the current workspace before the module graph loads',async()=>{
 const html=await readFile('web/index.html','utf8');
 const dom=new JSDOM(html);
 assert.equal(dom.window.document.body.dataset.appBoot,'pending');
 assert.equal(dom.window.document.querySelector('#app-boot-status')?.getAttribute('role'),'status');
 assert.ok(html.indexOf('./app-startup.css')<html.indexOf('./office-workspace.css'));
 const css=await readFile('web/app-startup.css','utf8');
 assert.match(css,/visibility:\s*hidden\s*!important/);
 assert.match(css,/#app-boot-status/);
 const style=dom.window.document.createElement('style');style.textContent=css;dom.window.document.head.append(style);
 for(const selector of ['.office-app']){
  assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector(selector)).visibility,'hidden');
 }
 assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('#app-boot-status')).display,'grid');
 dom.window.document.body.removeAttribute('data-app-boot');
 assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('#app-boot-status')).display,'none');
 assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('.office-app')).visibility,'visible');
 dom.window.close();
});

test('startup only reveals the selected route after restoreView, before renderer awaits',async()=>{
 const source=await readFile('web/app.js','utf8');
 const ready=source.indexOf("document.body.removeAttribute('data-app-boot')");
 assert.ok(ready>source.indexOf('connectionUI();restoreView();'));
 assert.ok(ready<source.indexOf('await document.fonts.ready'));
});
