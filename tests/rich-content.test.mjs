import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderRichMessage,safeSvg,interactiveDocument,INTERACTIVE_POLICY,disposeRichMessages} from '../web/rich-content.js';
import {contextDisplay} from '../web/chat-context.js';
function dom(t){const w=new JSDOM('<!doctype html><body></body>',{url:'https://office.example/'}).window;const previous={};for(const key of ['window','document','DOMParser','XMLSerializer','location']){previous[key]=globalThis[key];globalThis[key]=w[key];}t.after(()=>{for(const[key,value]of Object.entries(previous))globalThis[key]=value;w.close();});return w.document;}
test('Markdown renders headings, lists, tables and code; hostile HTML and remote images remain inert',t=>{
 const d=dom(t),target=d.createElement('div');d.body.append(target);
 renderRichMessage(target,'## Plan\n\n**Clear** and `safe`\n\n- One\n- Two\n\n| Role | Task |\n|---|---|\n| Kai | Content |\n\n![Image](https://images.example/test.png)\n\n<script>window.stolen=true</script><img src="https://evil.example/x" onerror="alert(1)"><iframe src="https://evil.example"></iframe>\n\n[Bad](javascript:alert(1))');
 assert.equal(target.querySelector('h2').textContent,'Plan');assert.equal(target.querySelector('strong').textContent,'Clear');assert.equal(target.querySelectorAll('li').length,2);assert.equal(target.querySelector('.table-scroll table td').textContent,'Kai');
 assert.equal(target.querySelectorAll('script,img,iframe,[onerror]').length,0);assert.ok([...target.querySelectorAll('a')].every(a=>!a.href.startsWith('javascript:')));assert.match(target.innerHTML,/noopener noreferrer/);
});
test('SVG diagrams retain geometry and local markers while removing executable tags and remote resources',t=>{
 dom(t);const svg=safeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" onload="alert(1)"><script>alert(1)</script><foreignObject><div>Bad</div></foreignObject><image href="https://evil.example/x"/><rect width="100" height="50" style="fill:url(https://evil.example/x)"/><path marker-end="url(#arrow)"/><style>@import url(https://evil.example/x); .a{fill:url(https://evil.example/y)}</style></svg>');
 assert.equal(svg.getAttribute('viewBox'),'0 0 100 50');assert.equal(svg.querySelectorAll('script,foreignObject,image,[onload]').length,0);assert.equal(svg.querySelector('path').getAttribute('marker-end'),'url(#arrow)');assert.equal(svg.outerHTML.includes('evil.example'),false);
});
test('interactive HTML runs only after opening, in an opaque sandbox, and closes its preview',t=>{
 const d=dom(t),target=d.createElement('div');d.body.append(target);renderRichMessage(target,'```interactive\n<button id="counter">0</button><script>let n=0;counter.onclick=()=>counter.textContent=++n;</script>\n```');
 assert.equal(target.querySelector('iframe'),null);assert.equal(target.querySelector('script'),null);const run=[...target.querySelectorAll('button')].find(b=>b.textContent==='เปิดชิ้นงาน');run.click();const frame=target.querySelector('iframe');
 assert.equal(frame.getAttribute('sandbox'),'allow-scripts');assert.match(frame.srcdoc,/Content-Security-Policy/);assert.ok(frame.srcdoc.includes('<button id="counter">0</button>'));assert.equal(frame.getAttribute('referrerpolicy'),'no-referrer');assert.match(interactiveDocument('test'),/Content-Security-Policy/);assert.match(INTERACTIVE_POLICY,/connect-src 'none'/);assert.match(INTERACTIVE_POLICY,/form-action 'none'/);
 disposeRichMessages(target);run.click();assert.equal(target.querySelector('iframe'),null);
});
test('context display distinguishes reported zero, partial and unknown usage',()=>{
 const full=contextDisplay({model:'model-1',context:{usedTokens:22779,maxTokens:258400}});assert.equal(full.percent,8.8);assert.match(full.text,/22.8K.*258.4K/);assert.equal(full.model,'model-1');
 assert.equal(contextDisplay({context:{usedTokens:0,maxTokens:100}}).percent,0);assert.equal(contextDisplay({context:{usedTokens:25}}).percent,null);assert.equal(contextDisplay({context:{usedTokens:NaN,maxTokens:100}}).percent,null);assert.match(contextDisplay(null).text,/ยังไม่รายงาน/);assert.match(contextDisplay({context:{usedTokens:10,maxTokens:100}},true).text,/ล่าสุด/);
});
