import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {navigationGuard,protectSyntheticHtml,syntheticCsp} from '../scripts/synthetic-browser-policy.mjs';
test('synthetic browser policy blocks external links and popups, permits local navigation',()=>{
 const dom=new JSDOM('<a href="http://127.0.0.1:3100/login">Live</a><a href="#office">Local</a>',{url:'http://127.0.0.1:4185/',runScripts:'outside-only'});
 const opened=[];dom.window.open=url=>opened.push(url);dom.window.eval(navigationGuard);
 const links=dom.window.document.querySelectorAll('a');
 const external=new dom.window.MouseEvent('click',{bubbles:true,cancelable:true});links[0].dispatchEvent(external);assert.equal(external.defaultPrevented,true);
 const local=new dom.window.MouseEvent('click',{bubbles:true,cancelable:true});links[1].dispatchEvent(local);assert.equal(local.defaultPrevented,false);
 dom.window.open('http://127.0.0.1:3100/login');assert.deepEqual(opened,[]);dom.window.open('/local');assert.deepEqual(opened,['/local']);
 assert.match(syntheticCsp,/connect-src 'self'/);assert.match(protectSyntheticHtml('<html><head><title>App</title></head>'),/<head><script>/);dom.window.close();
});
