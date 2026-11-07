import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfficeNavigation} from '../web/office-navigation.js';
import {runSeatFitSteps} from '../web/tycoon-seat-fit.js';

const room=()=>({schemaVersion:'office-room/v1',background:'office',objects:[{id:'desk-a',kind:'work-desk',x:66,y:43,scale:.62,flip:false}]});
const from=()=>({x:58,y:43}),to=()=>({x:74,y:43});
// Literal result recorded from the unchanged ordered search before adding scheduling.
const detour=[{x:58,y:43},{x:63,y:37.5},{x:69.75,y:38.25},{x:74,y:43}];
const drain=iterator=>{let step;do{step=iterator.next();}while(!step.done);return step.value;};

test('local path steps yield the original ordered detour and share the detached synchronous cache',async()=>{
 const nav=createOfficeNavigation(room());
 assert.equal(typeof nav.findLocalPathSteps,'function','cold pathfinding must be consumable without one monolithic call');
 let turns=0,clock=0;
 const result=await runSeatFitSteps(nav.findLocalPathSteps(from(),to()),{budgetMs:1,now:()=>++clock,yieldTurn:async()=>{turns++;}});
 assert.ok(turns>1,'a cold detour yields multiple scheduler turns');
 assert.deepEqual(result,detour);
 const before=nav.getQueryCacheStats().findLocalPath;result[1].x=999;
 assert.deepEqual(nav.findLocalPath(from(),to()),detour,'caller mutation cannot poison the warmed path');
 const after=nav.getQueryCacheStats().findLocalPath;
 assert.equal(after.computations,before.computations);assert.equal(after.hits,before.hits+1);
});

test('scheduled path snapshots mutable inputs and keeps ignore/refusal behavior',()=>{
 const nav=createOfficeNavigation(room(),{cacheQueries:false});
 assert.equal(typeof nav.findLocalPathSteps,'function');
 const a=from(),b=to(),ignored=[],steps=nav.findLocalPathSteps(a,b,{ignoreIds:ignored});
 assert.equal(steps.next().done,false);a.x=0;b.y=0;ignored.push('desk-a');
 assert.deepEqual(drain(steps),detour,'yielding never adopts edited caller-owned points or ignore IDs');
 assert.deepEqual(drain(nav.findLocalPathSteps(from(),to(),{ignoreIds:['desk-a']})),[from(),to()]);
 assert.deepEqual(drain(nav.findLocalPathSteps(from(),{x:66,y:43})),[]);
});

test('cancelled path steps do not publish a partial route to the query cache',()=>{
 const nav=createOfficeNavigation(room());assert.equal(typeof nav.findLocalPathSteps,'function');
 const before=nav.getQueryCacheStats().findLocalPath,steps=nav.findLocalPathSteps(from(),to());
 assert.equal(steps.next().done,false);steps.return();
 const cancelled=nav.getQueryCacheStats().findLocalPath;
 assert.equal(cancelled.entries,before.entries,'unfinished route is never cached as a result');
 assert.deepEqual(nav.findLocalPath(from(),to()),detour);
 assert.equal(nav.getQueryCacheStats().findLocalPath.computations,cancelled.computations+1);
});

test('synchronous and scheduled paths preserve refusal for missing endpoints',()=>{
 const nav=createOfficeNavigation(room());
 for(const [a,b]of [[null,to()],[from(),null],[undefined,to()],[from(),undefined]]){
  assert.deepEqual(nav.findLocalPath(a,b),[],'missing endpoints are refused instead of throwing');
  assert.deepEqual(drain(nav.findLocalPathSteps(a,b)),[]);
 }
});
