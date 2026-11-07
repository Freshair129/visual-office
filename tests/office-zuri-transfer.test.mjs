import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeZuriOrigin,openOfficeTransfer} from '../web/office-zuri-transfer.js';
import {JSDOM} from 'jsdom';

test('accepts HTTPS origins and loopback HTTP only',()=>{
 assert.equal(normalizeZuriOrigin('https://zuri.example/'),'https://zuri.example');
 assert.equal(normalizeZuriOrigin('http://127.0.0.1:3100'),'http://127.0.0.1:3100');
 for(const value of ['http://remote.example','https://user:pass@example.com','https://example.com/path','javascript:alert(1)']) assert.throws(()=>normalizeZuriOrigin(value));
});

test('sends bytes only to the opened Zuri origin after the nonce handshake',async()=>{
 let listener;const sent=[],progress=[];const popup={postMessage:(data,origin)=>sent.push({data,origin}),closed:false};
 const win={location:{origin:'https://office.example'},crypto:{randomUUID:()=> 'nonce-1'},open:()=>popup,addEventListener:(_,fn)=>{listener=fn},removeEventListener:()=>{}};
 assert.throws(()=>openOfficeTransfer(win,'https://evil.example',async()=>new Uint8Array([1]),['https://zuri.example']));
 assert.throws(()=>openOfficeTransfer(win,'https://office.example:444',async()=>new Uint8Array([1]),['https://office.example:444']));
 let builds=0;const transfer=openOfficeTransfer(win,'https://zuri.example',async()=>{builds++;return new Uint8Array([1,2])},['https://zuri.example'],value=>progress.push(value));
 listener({origin:'https://evil.example',source:popup,data:{type:'office-ready',nonce:'nonce-1'}});
 listener({origin:'https://zuri.example',source:{},data:{type:'office-ready',nonce:'nonce-1'}});
 assert.equal(sent.length,0);
 listener({origin:'https://zuri.example',source:popup,data:{type:'office-ready',nonce:'nonce-1'}});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(sent.length,1);assert.equal(sent[0].origin,'https://zuri.example');assert.deepEqual([...sent[0].data.bytes],[1,2]);
 listener({origin:'https://zuri.example',source:popup,data:{type:'office-ready',nonce:'nonce-1'}});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(builds,1);assert.equal(sent.length,2);
 listener({origin:'https://evil.example',source:popup,data:{type:'office-progress',nonce:'nonce-1',message:'forged'}});
 listener({origin:'https://zuri.example',source:popup,data:{type:'office-progress',nonce:'nonce-1',message:'retry available'}});assert.equal(progress.at(-1),'retry available');assert.equal(progress.includes('forged'),false);
 listener({origin:'https://zuri.example',source:popup,data:{type:'office-complete',nonce:'nonce-1',version:1,count:2}});
 assert.deepEqual(await transfer,{version:1,count:2});
});

test('closing the popup reports an unknown outcome',async()=>{
 const popup={closed:false};const win={location:{origin:'https://office.example'},crypto:{randomUUID:()=> 'nonce-2'},open:()=>popup,addEventListener:()=>{},removeEventListener:()=>{}};
 const transfer=openOfficeTransfer(win,'https://zuri.example',async()=>new Uint8Array([1]),['https://zuri.example']);popup.closed=true;
 await assert.rejects(transfer,/ผลอาจยังไม่แน่ชัด/);
});

test('hidden popup watcher resumes and reports a closure with the existing unknown outcome',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const doc=new JSDOM('').window.document;let hidden=false,checks=0;
 Object.defineProperty(doc,'hidden',{get:()=>hidden});
 let closed=false;const popup={get closed(){checks++;return closed}};
 const win={document:doc,location:{origin:'https://office.example'},crypto:{randomUUID:()=> 'nonce'},open:()=>popup,addEventListener:()=>{},removeEventListener:()=>{}};
 const transfer=openOfficeTransfer(win,'https://zuri.example',async()=>new Uint8Array([1]),['https://zuri.example']);
 hidden=true;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));const before=checks;
 closed=true;t.mock.timers.tick(10000);assert.equal(checks,before);
 hidden=false;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));
 await assert.rejects(transfer,/ปิดหน้าต่าง Zuri แล้ว ผลอาจยังไม่แน่ชัด โปรดตรวจ Zuri ก่อนลองใหม่/);
 const after=checks;t.mock.timers.tick(10000);assert.equal(checks,after);
});

test('package preparation can finish while hidden and a never-answering popup remains pending',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const doc=new JSDOM('').window.document;let hidden=false,listener,release,settled=false;
 Object.defineProperty(doc,'hidden',{get:()=>hidden});
 const sent=[],popup={closed:false,postMessage:data=>sent.push(data)};
 const win={document:doc,location:{origin:'https://office.example'},crypto:{randomUUID:()=> 'nonce'},open:()=>popup,addEventListener:(_,fn)=>{listener=fn},removeEventListener:()=>{}};
 const transfer=openOfficeTransfer(win,'https://zuri.example',()=>new Promise(resolve=>{release=resolve}),['https://zuri.example']);
 transfer.then(()=>{settled=true},()=>{settled=true});
 listener({origin:'https://zuri.example',source:popup,data:{type:'office-ready',nonce:'nonce'}});
 await Promise.resolve();hidden=true;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));
 release(new Uint8Array([1]));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sent.length,1);t.mock.timers.tick(60000);assert.equal(settled,false);
 hidden=false;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));t.mock.timers.tick(60000);assert.equal(settled,false);
 listener({origin:'https://zuri.example',source:popup,data:{type:'office-complete',nonce:'nonce',version:1,count:1}});
 assert.deepEqual(await transfer,{version:1,count:1});
});
