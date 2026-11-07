import test from 'node:test';
import assert from 'node:assert/strict';
import {quickMessage} from '../web/chat-view.js';

test('quick notifications use the latest response and prioritize pending delivery without duplicate queue alerts',()=>{
 const messages=[{id:'1',role:'assistant',text:'Old answer'},{id:'2',role:'assistant',text:'Latest answer'}];
 assert.equal(quickMessage(messages,[{id:'2',status:'sent'}],'Beam'),'Latest answer');
 assert.match(quickMessage(messages,[{id:'3',status:'sent'}],'Beam'),/รอ Beam ตอบ/);
 assert.match(quickMessage(messages,[{id:'3',status:'error'}],'Beam'),/ส่งไม่สำเร็จ/);
 assert.equal(quickMessage([{role:'assistant',text:'x'.repeat(500)}]).length,241);
 assert.match(quickMessage([],[],'Mira'),/Mira พร้อมคุย/);
});
