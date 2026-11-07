import test from 'node:test';import assert from 'node:assert/strict';
import {floorActorStates} from '../web/office-agent-state-view.js';
test('only fresh bound role state maps onto a known presentation actor',()=>{
 const room={objects:[{id:'role-1-avatar',kind:'avatar-01'},{id:'custom-person',kind:'avatar-02'}]},roster=[{connected:true,status:'idle'}];
 assert.deepEqual(floorActorStates(room,roster),[{avatarId:'role-1-avatar',state:'unknown',source:''},{avatarId:'custom-person',state:'unknown',source:''}]);
 const known=floorActorStates(room,roster,{known:true,source:'T3 snapshot'});
 assert.equal(known[0].state,'idle');assert.equal(known[1].state,'unknown');
 roster[0].status='stuck';assert.equal(floorActorStates(room,roster,{known:true,source:'T3'})[0].state,'waiting');
 roster[0].connected=false;assert.equal(floorActorStates(room,roster,{known:true,source:'T3'})[0].state,'unknown');
});
