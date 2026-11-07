import test from 'node:test';
import assert from 'node:assert/strict';
import {chatChoices,selectedChat,chatOwnerIndex,resolveChatRoute} from '../web/chat-selection.js';

test('profile-qualified shared threads still require current profile membership',()=>{
 const profiles=[{id:'mira'},{id:'pim'},{id:'beam'}],sessions=[{id:'same'}],assignments=[{id:'same'},{id:'same'}];
 assert.deepEqual(resolveChatRoute('agent:pim:same',profiles,sessions,[],assignments),{kind:'thread',index:1,thread:'same'});
 for(const route of ['same','agent:beam:same','agent:pim:foreign','agent:pim:'])assert.equal(resolveChatRoute(route,profiles,sessions,[],assignments).kind,'unknown');
});

test('deep-link owner is resolved only from a unique current profile conversation',()=>{
 const profiles=[{id:'mira'},{id:'pim'}],jobs=[{title:'Pim task',steps:[{agentId:'pim',threadId:'pim-work',status:'waiting'}]}];
 assert.equal(chatOwnerIndex('pim-work',profiles,[],jobs,[]),1);
 assert.equal(chatOwnerIndex('unknown',profiles,[],jobs,[]),-1);
 const sessions=[{id:'same'}];assert.equal(chatOwnerIndex('same',profiles,sessions,[],[{id:'same'},{id:'same'}]),-1);
});
test('selected conversation survives another job becoming active; role choices include queued chats and exclude cancelled ones',()=>{
 const jobs=[{title:'ใหม่',steps:[{agentId:'beam',threadId:'new',status:'queued'}]},{title:'เดิม',steps:[{agentId:'beam',threadId:'old',status:'done'},{agentId:'kai',threadId:'kai',status:'done'},{agentId:'beam',threadId:'cancelled',status:'cancelled'}]}];
 const c=chatChoices({id:'beam'},[{id:'old'},{id:'manual',name:'Beam'}],jobs,{id:'manual'});
 assert.deepEqual(c.map(c=>c.id),['new','old','manual']);assert.equal(c[0].pending,true);
 assert.equal(selectedChat(c,'old','new'),'old');assert.equal(selectedChat(c,'removed','new'),'new');assert.equal(selectedChat([],null,null),null);
});
