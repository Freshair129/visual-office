import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeZuriOrigin,openOfficeTransfer} from '../web/office-zuri-transfer.js';

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
