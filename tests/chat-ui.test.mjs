import test from 'node:test';
import assert from 'node:assert/strict';
import {ChatUI} from '../web/chat.js';
function setup(t,fetcher,{renderMessage}={}){
 t.mock.timers.enable({apis:['setTimeout'],now:0});
 const elements=new Map();const create=()=>{const node={value:'',textContent:'',children:[],dataset:{},scrollTop:0,clientHeight:100,parentNode:null,height:10,append(...items){for(const item of items){if(item.parentNode)item.parentNode.children=item.parentNode.children.filter(child=>child!==item);item.parentNode=this;this.children.push(item);}},replaceChildren(...items){for(const child of this.children)child.parentNode=null;this.children=[];this.append(...items);},contains(target){return this===target||this.children.some(child=>child.contains?.(target));},getBoundingClientRect(){if(this===elements.get('#chat-messages'))return{top:0,bottom:this.clientHeight};const list=elements.get('#chat-messages'),index=list?.children.indexOf(this)??-1;if(index<0)return{top:0,bottom:this.height};const top=-list.scrollTop+list.children.slice(0,index).reduce((sum,child)=>sum+child.height,0);return{top,bottom:top+this.height};}};Object.defineProperty(node,'scrollHeight',{get(){return this===elements.get('#chat-messages')?this.children.reduce((sum,child)=>sum+child.height,0):100;}});return node;};
 const root=create();
 t.mock.method(globalThis,'fetch',fetcher);
 const previous=globalThis.document;globalThis.document={querySelector(s){if(!elements.has(s)){const element=create();elements.set(s,element);root.append(element);}return elements.get(s);},createElement:create};t.after(()=>{globalThis.document=previous;});
 return{ui:new ChatUI({toast(){},refresh(){},renderMessage}),get:s=>globalThis.document.querySelector(s),contains:node=>root.contains(node)};
}
const response=value=>({ok:true,json:async()=>value});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('hidden chat suspends reads and late replies; resume preserves draft and reloads current thread',async t=>{
 let resolveRead,reads=0;
 const {ui,get}=setup(t,async url=>{if(url.endsWith('/watch'))return response({});reads++;if(reads===1)return new Promise(resolve=>{resolveRead=resolve;});return response({status:'idle',messages:[{id:'current',role:'assistant',text:'Resumed answer'}],pending:[]});});
 ui.open('beam','Beam');await flush();get('#chat-input').value='Keep this draft';get('#chat-input').oninput();
 ui.setVisible(false);resolveRead(response({status:'done',messages:[{id:'late',role:'assistant',text:'Late hidden answer'}],pending:[]}));await flush();
 t.mock.timers.tick(10000);await flush();assert.equal(reads,1);
 assert.equal(get('#chat-messages').children.some(n=>n.dataset.messageId==='late'),false);
 ui.setVisible(true);await flush();assert.equal(reads,2);assert.equal(get('#chat-input').value,'Keep this draft');
 assert.ok(get('#chat-messages').children.some(n=>n.dataset.messageId==='current'));
});
test('inline selection retains each draft and ignores a late history response from the previous agent',async t=>{
 let resolveBeam;const calls=[];
 const{ui,get}=setup(t,async(url)=>{calls.push(url);if(url.endsWith('/watch'))return response({});if(url==='/api/chats/beam')return new Promise(resolve=>{resolveBeam=resolve;});return response({status:'done',messages:[{id:'kai-answer',role:'assistant',text:'Kai only'}],pending:[]});});
 ui.open('beam','Beam');await flush();get('#chat-input').value='Beam draft';get('#chat-input').oninput();
 ui.open('kai','Kai');await flush();resolveBeam(response({status:'done',messages:[{id:'beam-answer',role:'assistant',text:'Beam only'}],pending:[]}));await flush();
 assert.equal(get('#chat-title').textContent,'คุยกับ Kai');assert.equal(get('#chat-messages').children[0].children[1].textContent,'Kai only');
 get('#chat-input').value='Kai draft';get('#chat-input').oninput();ui.open('beam','Beam');assert.equal(get('#chat-input').value,'Beam draft');ui.open('kai','Kai');assert.equal(get('#chat-input').value,'Kai draft');
 assert.ok(calls.includes('/api/chats/beam'));assert.ok(!calls.some(c=>c.includes('undefined')));
 ui.empty('test','closed');await flush();
});
test('a pending send stays bound to its original thread while another agent remains editable',async t=>{
 let resolveSend,sent;
 const{ui,get}=setup(t,async(url,options)=>{if(url.endsWith('/messages')){sent={url,body:JSON.parse(options.body)};return new Promise(resolve=>{resolveSend=resolve;});}return response(url.endsWith('/watch')?{}:{status:'idle',messages:[],pending:[]});});
 ui.open('beam','Beam');await flush();get('#chat-input').value='Continue Beam';get('#chat-input').oninput();get('#chat-form').onsubmit({preventDefault(){}});
 ui.open('kai','Kai');get('#chat-input').value='Do not erase Kai';get('#chat-input').oninput();resolveSend(response({}));await flush();
 assert.equal(sent.url,'/api/chats/beam/messages');assert.equal(sent.body.text,'Continue Beam');assert.match(sent.body.id,/^[0-9a-f-]{36}$/);assert.equal(get('#chat-input').value,'Do not erase Kai');assert.equal(get('#chat-input').disabled,false);
 ui.open('beam','Beam');assert.equal(get('#chat-input').value,'');
 ui.empty('test','closed');await flush();
});
test('Enter sends once; Shift+Enter and IME composition do not dispatch',async t=>{
 const sent=[];const{ui,get}=setup(t,async(url,options)=>{if(url.endsWith('/messages'))sent.push(JSON.parse(options.body));return response(url.endsWith('/watch')?{}:{status:'idle',messages:[],pending:[]});});
 ui.open('beam','Beam');await flush();get('#chat-input').value='Enter message';get('#chat-input').oninput();let prevented=0;
 const key={key:'Enter',preventDefault(){prevented++;}};
 get('#chat-input').onkeydown({...key,shiftKey:true});get('#chat-input').onkeydown({...key,isComposing:true});get('#chat-input').onkeydown({...key,keyCode:229});assert.equal(sent.length,0);assert.equal(prevented,0);
 get('#chat-input').onkeydown(key);get('#chat-input').onkeydown({...key,repeat:true});await flush();assert.equal(sent.length,1);assert.equal(sent[0].text,'Enter message');assert.equal(get('#chat-input').value,'');
 ui.empty('test','closed');await flush();
});
test('older chat history loads before the visible messages and remains after the next live poll',async t=>{
 const calls=[],latest=Array.from({length:30},(_,i)=>({id:'m'+(i+30),role:i%2?'user':'assistant',text:'Message '+(i+30)}));
 let polls=0;const shifted=Array.from({length:30},(_,i)=>({id:'m'+(i+31),role:i%2?'user':'assistant',text:'Message '+(i+31)}));
 const{ui,get,contains}=setup(t,async(url)=>{calls.push(url);if(url.endsWith('/watch'))return response({});if(url.includes('/history?'))return response({messages:Array.from({length:30},(_,i)=>({id:'m'+i,role:i%2?'user':'assistant',text:'Message '+i})),hasMoreHistory:false,nextCursor:null,historyTruncated:true});polls++;return response({status:'done',messages:polls===1?latest:shifted,pending:[],historyCursor:polls===1?'m30':'m31',hasMoreHistory:true});});
 ui.open('beam','Beam');await flush();const button=get('#chat-load-older'),list=get('#chat-messages');assert.equal(button.hidden,false);assert.equal(contains(button),true);button.onclick();await flush();
 assert.ok(calls.some(url=>url==='/api/chats/beam/history?before=m30&limit=30'));assert.equal(list.children[0].children[1].textContent,'Message 0');assert.equal(button.hidden,true);assert.equal(contains(button),true);
 t.mock.timers.tick(5000);await flush();const visible=list.children.filter(node=>node.className.startsWith('chat-bubble ')).map(node=>node.children[1].textContent);assert.deepEqual(visible,Array.from({length:61},(_,i)=>'Message '+i));assert.equal(contains(button),true);assert.ok(list.children.some(node=>node.className==='chat-history-note'));
 ui.empty('test','closed');await flush();
});
test('async message growth above the history anchor preserves its viewport position',async t=>{
 const resizes=new Map(),latest=Array.from({length:30},(_,i)=>({id:'m'+(i+30),role:i%2?'user':'assistant',text:'Message '+(i+30)}));
 const{ui,get}=setup(t,async(url)=>{if(url.endsWith('/watch'))return response({});if(url.includes('/history?'))return response({messages:Array.from({length:30},(_,i)=>({id:'m'+i,role:i%2?'user':'assistant',text:'Message '+i})),hasMoreHistory:false,nextCursor:null});return response({status:'done',messages:latest,pending:[],historyCursor:'m30',hasMoreHistory:true});},{renderMessage(target,text,{onResize}){target.textContent=text;if(text==='Message 5')resizes.set(text,onResize);}});
 ui.open('beam','Beam');await flush();const list=get('#chat-messages');list.scrollTop=100;const priorAnchor=list.children.find(node=>node.dataset.messageId==='m40'),priorTop=priorAnchor.getBoundingClientRect().top;
 get('#chat-load-older').onclick();await flush();const anchor=list.children.find(node=>node.dataset.messageId==='m40'),growing=list.children.find(node=>node.dataset.messageId==='m5'),resize=resizes.get('Message 5'),scroll=list.scrollTop;
 assert.ok(resize);assert.equal(anchor.getBoundingClientRect().top,priorTop);resize({before:true});growing.height+=30;resize();
 assert.equal(list.scrollTop,scroll+30);assert.equal(anchor.getBoundingClientRect().top,priorTop);
 ui.empty('test','closed');await flush();
});
test('removing uploads aborts once, ignores late success and failure, and sends only the surviving file',async t=>{
 const uploads=[];let sent;
 const{ui,get}=setup(t,async(url,options)=>{if(url.includes('/attachments/')){const upload={id:url.split('/').at(-1),name:decodeURIComponent(options.headers['x-file-name']),signal:options.signal};uploads.push(upload);return new Promise((resolve,reject)=>{upload.resolve=resolve;upload.reject=reject;});}if(url.endsWith('/messages')){sent=JSON.parse(options.body);return response({});}return response(url.endsWith('/watch')?{}:{status:'idle',messages:[],pending:[]});});
 ui.open('beam','Beam');await flush();get('#chat-files').files=[{name:'late-success.txt',size:8},{name:'late-error.txt',size:9},{name:'survivor.txt',size:10}];get('#chat-files').onchange();await flush();assert.equal(uploads.length,3);
 const chips=get('#chat-attachments').children;const removeSuccess=chips[0].children.at(-1),removeError=chips[1].children.at(-1);let successAborts=0,errorAborts=0;
 uploads[0].signal.addEventListener('abort',()=>successAborts++);uploads[1].signal.addEventListener('abort',()=>errorAborts++);
 removeSuccess.onclick();removeSuccess.onclick();removeError.onclick();removeError.onclick();assert.equal(uploads[0].signal.aborted,true);assert.equal(uploads[1].signal.aborted,true);assert.equal(successAborts,1);assert.equal(errorAborts,1);assert.equal(get('#chat-attachments').children.length,1);
 uploads[1].reject(new Error('late upload failure'));uploads[2].resolve(response({}));await flush();await flush();
 assert.equal(get('#chat-attachments').children.length,1);assert.match(get('#chat-attachments').children[0].children[0].textContent,/survivor\.txt/);assert.equal(get('#chat-attachments').children[0].children[1].textContent,'พร้อมแนบ');assert.equal(get('#chat-feedback').textContent,'');assert.equal(get('#chat-send').disabled,false);
 get('#chat-input').value='Send survivor';get('#chat-input').oninput();get('#chat-form').onsubmit({preventDefault(){}});await flush();assert.equal(sent.text,'Send survivor');assert.deepEqual(sent.attachments,[uploads[2].id]);
 uploads[0].resolve(response({}));await flush();await flush();assert.equal(get('#chat-attachments').children.length,0);assert.equal(get('#chat-input').value,'');
 ui.empty('test','closed');await flush();
});
test('upload timeout stays at 60 seconds, retry succeeds, and a ready file can be removed',async t=>{
 const uploadSignals=[];let attempt=0,sent;
 const{ui,get}=setup(t,async(url,options)=>{if(url.includes('/attachments/')){attempt++;uploadSignals.push(options.signal);if(attempt===1)return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));return response({});}if(url.endsWith('/messages')){sent=JSON.parse(options.body);return response({});}return response(url.endsWith('/watch')?{}:{status:'idle',messages:[],pending:[]});});
 ui.open('beam','Beam');await flush();get('#chat-files').files=[{name:'retry.txt',size:8}];get('#chat-files').onchange();await flush();assert.equal(uploadSignals.length,1);
 t.mock.timers.tick(59_999);assert.equal(uploadSignals[0].aborted,false);t.mock.timers.tick(1);assert.equal(uploadSignals[0].aborted,true);assert.equal(uploadSignals[0].reason.name,'TimeoutError');await flush();await flush();
 const failedChip=get('#chat-attachments').children[0];assert.match(failedChip.children[1].textContent,/timed out/);failedChip.children[2].onclick();await flush();assert.equal(attempt,2);assert.equal(get('#chat-attachments').children[0].children[1].textContent,'พร้อมแนบ');
 const readyRemove=get('#chat-attachments').children[0].children.at(-1);readyRemove.onclick();assert.equal(get('#chat-attachments').children.length,0);assert.equal(uploadSignals[1].aborted,false);
 get('#chat-input').value='No attachment';get('#chat-input').oninput();get('#chat-form').onsubmit({preventDefault(){}});await flush();assert.equal(sent.text,'No attachment');assert.deepEqual(sent.attachments,[]);
 ui.empty('test','closed');await flush();
});
