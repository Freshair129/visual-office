import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {CharacterLabDialog} from '../web/characters/lab-dialog.js';

test('Studio lab preserves its host draft and releases its iframe on close, cancel and disposal',()=>{
  const doc=new JSDOM('<main><input value="unsaved room"></main>',{url:'http://localhost/#office/studio'}).window.document;
  const host=doc.querySelector('main'),draft=doc.querySelector('input');
  const lab=new CharacterLabDialog(host),dialog=host.querySelector('dialog');
  dialog.showModal=()=>{dialog.open=true;};
  dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new doc.defaultView.Event('close'));};
  lab.open();const first=dialog.querySelector('iframe');
  assert.equal(first.src,'http://localhost/character-lab.html');assert.match(first.title,/Character Lab/);
  lab.open();assert.equal(dialog.querySelectorAll('iframe').length,1);
  dialog.querySelector('button').click();assert.equal(dialog.querySelector('iframe'),null);
  assert.equal(host.querySelector('input'),draft);assert.equal(draft.value,'unsaved room');
  lab.open();assert.notEqual(dialog.querySelector('iframe'),first);
  dialog.dispatchEvent(new doc.defaultView.Event('cancel',{cancelable:true}));
  assert.equal(dialog.open,false);assert.equal(dialog.querySelector('iframe'),null);
  lab.open();lab.dispose();assert.equal(host.querySelector('dialog'),null);assert.equal(host.querySelector('input'),draft);
  lab.open();assert.equal(host.querySelector('iframe'),null);
});
