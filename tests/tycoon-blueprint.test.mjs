import {createLegacyTycoonRoom as createTycoonRoom} from './fixtures/legacy-tycoon-room.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {validateTycoonRoom,tycoonFloorFile,parseTycoonFloorJSON,TycoonStore} from '../web/tycoon-state.js';
import {tycoonPlan,tycoonEditorRoom,tycoonStructure,applyTycoonPlan,createTycoonNavigation,tycoonGround} from '../web/tycoon-blueprint.js';
import {worldToGround} from '../web/office-projection.js';
import {toggleBlueprintDoor} from '../web/office-blueprint-state.js';
const p=(x,z)=>tycoonGround({x,z});
const divided=()=>{const r=createTycoonRoom('projects');r.objects=[];const plan=tycoonPlan(r);plan.partitions=[{id:'divide',axis:'z',at:6,start:0,end:8,door:{offset:3,width:1.4,open:true}}];return applyTycoonPlan(r,plan);};
test('optional blueprint/navigation roundtrip preserves per-floor layout and rejects unknown state',()=>{
 const r=divided();r.navigation={version:1,routes:[{id:'route-1',points:[p(-2,0),p(2,0)]}],forbidden:[],stations:[]};
 assert.deepEqual(parseTycoonFloorJSON(JSON.stringify(tycoonFloorFile('lobby',r))).room,r);
 assert.throws(()=>validateTycoonRoom({...r,blueprintPlan:{...r.blueprintPlan,agentId:'x'}}));
 const before=createTycoonRoom('projects');assert.equal('blueprintPlan'in validateTycoonRoom(before),false);
});
test('GLB door panels and navigation consume identical authored door state',()=>{
 const r=divided(),a=p(-2,0),b=p(2,0);assert.ok(createTycoonNavigation(r).findLocalPath(a,b).length>1);
 assert.equal(tycoonStructure(r).some(o=>o.id==='door:partition:divide:panel'),false);
 r.blueprintPlan=toggleBlueprintDoor(r.blueprintPlan,'partition:divide');
 assert.equal(createTycoonNavigation(r).findLocalPath(a,b).length,0);
 assert.ok(tycoonStructure(r).some(o=>o.id==='door:partition:divide:panel'&&o.intent==='door'));
});
test('plan moves preserve world furniture and collision covers rotated and scaled GLB props',()=>{
 const r=createTycoonRoom('projects'),before=structuredClone(r.objects),plan=tycoonPlan(r);plan.width=13;
 const next=applyTycoonPlan(r,plan);assert.deepEqual(next.objects,before);assert.equal(next.width,13);
 const nav=createTycoonNavigation(next);assert.equal(nav.isWalkable(p(r.objects[4].x,r.objects[4].z)),false);
 assert.equal(tycoonEditorRoom(next).blueprintPlan.width,13);
});

test('metric clearance rejects wall and forbidden edges without rounding through them',()=>{
 const r=divided();const nav=createTycoonNavigation(r);assert.equal(nav.isWalkable(p(-.25,-2)),false);assert.equal(nav.isWalkable(p(-.6,-2)),true);
 r.navigation={version:1,routes:[],stations:[],forbidden:[{id:'blocked',points:[p(-4,-2),p(-3,-2),p(-3,-1),p(-4,-1)]}]};const n=createTycoonNavigation(r);assert.equal(n.isWalkable(p(-2.85,-1.5)),false);assert.equal(n.isWalkable(p(-2.5,-1.5)),true);
});
