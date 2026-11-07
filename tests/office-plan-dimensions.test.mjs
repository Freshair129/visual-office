import test from 'node:test';
import assert from 'node:assert/strict';
import {describeAreaDimensions,metricLength} from '../web/office-plan-dimensions.js';
import {createTycoonRoom} from '../web/tycoon-state.js';

test('authored consultation and editing room areas align with their real enclosure walls',()=>{
  const rooms={customer:['customer-public-wait','customer-private-case','customer-private-consult-1','customer-private-consult-2'],growth:['growth-campaign-review','growth-edit-booth-a','growth-edit-booth-b'],procurement:['procurement-supplier-comparison'],people:['people-consult-room-1','people-consult-room-2']};
  for(const [floor,ids]of Object.entries(rooms)){const plan=createTycoonRoom(floor).blueprintPlan;for(const id of ids)assert.equal(describeAreaDimensions(plan,plan.areas.find(a=>a.id===id)).basis,'clear-room',floor+'/'+id);}
});

test('enclosed room dimensions subtract real interior wall faces, including a doorway edge',()=>{
  const area={x:1,z:2,width:6,depth:5},plan={width:24,depth:16,partitions:[
    {axis:'z',at:1,start:2,end:7},{axis:'z',at:7,start:2,end:7},
    {axis:'x',at:2,start:1,end:7,door:{offset:2,width:1.4}},{axis:'x',at:7,start:1,end:7},
  ]};
  const d=describeAreaDimensions(plan,area);assert.equal(d.basis,'clear-room');assert.ok(Math.abs(d.widthM-5.8)<1e-8);assert.ok(Math.abs(d.depthM-4.8)<1e-8);assert.ok(Math.abs(d.areaM2-27.84)<1e-8);
  plan.partitions.pop();const open=describeAreaDimensions(plan,area);assert.deepEqual(open,{basis:'authored-zone',widthM:6,depthM:5,areaM2:30});
});

test('room against outer clear-floor boundary does not subtract the outer wall a second time',()=>{
  const plan={width:24,depth:16,partitions:[{axis:'z',at:5,start:0,end:4},{axis:'x',at:4,start:0,end:5}]};
  const d=describeAreaDimensions(plan,{x:0,z:0,width:5,depth:4});assert.equal(d.basis,'clear-room');assert.ok(Math.abs(d.widthM-4.9)<1e-8);assert.ok(Math.abs(d.depthM-3.9)<1e-8);
});

test('broken partition edges stay zone dimensions and drawn lengths use actual endpoint metres',()=>{
  const plan={width:24,depth:16,partitions:[{axis:'z',at:2,start:2,end:3},{axis:'z',at:2,start:4,end:6}]};
  assert.equal(describeAreaDimensions(plan,{x:2,z:2,width:5,depth:4}).basis,'authored-zone');
  assert.equal(metricLength([1,2],[1,4]),2);assert.equal(metricLength([0,0],[3,4]),5);
  assert.throws(()=>metricLength([0,0],[Infinity,2]));assert.throws(()=>describeAreaDimensions(plan,{x:0,z:0,width:NaN,depth:2}));
});
