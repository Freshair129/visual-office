import test from 'node:test';import assert from 'node:assert/strict';
import {workspaceAccess,readReturnFloor,writeReturnFloor} from '../web/workspace-context.js';

test('unverified or Zuri-only workspace never presents missing records as verified empty data',()=>{
 assert.equal(workspaceAccess({verified:false}).allowed,false);
 const gate=workspaceAccess({verified:true,zuriEnabled:true,connectionStatus:'live'});
 assert.equal(gate.allowed,false);assert.match(gate.message,/API/);
 assert.equal(workspaceAccess({verified:true,zuriEnabled:false,connectionStatus:'retrying'}).allowed,false);
 assert.equal(workspaceAccess({verified:true,zuriEnabled:false,connectionStatus:'live'}).allowed,true);
 const fixture=workspaceAccess({verified:true,zuriEnabled:true,synthetic:true,connectionStatus:'live'});
 assert.equal(fixture.allowed,true);assert.match(fixture.message,/synthetic/i);
});

test('return shortcut stores presentation floor only, never arbitrary domain or authorization context',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 writeReturnFloor(storage,'projects');assert.equal(readReturnFloor(storage),'projects');
 writeReturnFloor(storage,'studio');assert.equal(readReturnFloor(storage),'projects');
 writeReturnFloor(storage,'domain:private');assert.equal(readReturnFloor(storage),'projects');
 assert.equal(readReturnFloor({getItem(){throw Error('blocked')}}),null);
 assert.equal(readReturnFloor({getItem:()=>JSON.stringify({businessId:'private'})}),null);
});
