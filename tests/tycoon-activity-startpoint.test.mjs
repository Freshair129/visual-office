import test from 'node:test';
import assert from 'node:assert/strict';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {createTycoonRoom} from '../web/tycoon-state.js';

test('station start accepts a detached captured point and keeps the synchronous no-argument API',()=>{
  const activity=new TycoonActivity(createTycoonRoom('projects'));
  const station={id:'desk-1',objectId:'desk-1',position:{x:2,y:3},seatObjectId:'chair-1'};
  const calls=[];
  activity.nav={stations:[station],spawnPoint:{x:0,y:0},isWalkable:()=>true,
    findLocalPath:(from,to)=>{calls.push({from:{...from},to:{...to}});return [{...from},{...to}];}};
  const previous={x:8,y:9};activity.snapshot={position:previous};
  const requested={x:4,y:5};
  const result=activity.startStation('desk-1',{startPoint:requested});
  requested.x=100;
  assert.equal(result instanceof Promise,false,'ordinary station starts remain synchronous');
  assert.equal(result.ok,true);
  assert.deepEqual(calls[0],{from:{x:4,y:5},to:{x:2,y:3}},'the captured point overrides the cleared snapshot');
  assert.deepEqual(activity.path[0],{x:4,y:5},'the started route retains a detached point');

  activity.stop();activity.snapshot={position:previous};
  const sync=activity.startStation('desk-1');
  assert.equal(sync.ok,true);
  assert.deepEqual(calls[1].from,{x:8,y:9},'the existing no-argument API still starts from the current snapshot');
});
