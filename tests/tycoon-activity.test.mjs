import {createLegacyTycoonRoom} from './fixtures/legacy-tycoon-room.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {canTycoonWalk} from '../web/tycoon-activity.js';import {createTycoonRoom} from '../web/tycoon-state.js';
import {TycoonActivity,changeTycoonDoor} from '../web/tycoon-activity.js';
import {tycoonPlan,applyTycoonPlan,tycoonGround,createTycoonNavigation} from '../web/tycoon-blueprint.js';
test('probe cannot cross a closed door and refuses closing an occupied threshold',()=>{
 let r=createLegacyTycoonRoom('projects');r.objects=[];const plan=tycoonPlan(r);plan.partitions=[{id:'divider',axis:'z',at:6,start:0,end:8,door:{offset:3,width:1.4,open:true}}];r=applyTycoonPlan(r,plan);
 const points=[tycoonGround({x:-2,z:0}),tycoonGround({x:2,z:0})],a=new TycoonActivity(r);
 assert.equal(a.startRoute(points).ok,true);a.tick(.1);assert.equal(a.snapshot.clip,'walk');
 assert.equal(changeTycoonDoor(r,'partition:divider',[tycoonGround({x:0,z:0})]).ok,false);
 const closed=changeTycoonDoor(r,'partition:divider',[]);assert.equal(closed.ok,true);a.setRoom(closed.room);assert.equal(a.startRoute(points).ok,false);assert.equal(a.snapshot,null);
});
test('seating probes reserve one real seat, animate lifecycle and release on Stop',()=>{
 const r=createTycoonRoom('projects'),a=new TycoonActivity(r),s=createTycoonNavigation(r).stations.find(s=>s.type==='desk');assert.ok(s);
 assert.equal(a.startStation(s.id).ok,true);assert.equal(a.reservations.size,1);
 const seen=new Set();for(let i=0;i<1000;i++){a.tick(.04);seen.add(a.snapshot?.clip);}
 assert.ok(seen.has('sit_down'));assert.ok(seen.has('seated_work'));assert.ok(seen.has('stand_up'));assert.equal(a.reservations.size,0);
 a.stop();assert.equal(a.snapshot,null);assert.equal(a.reservations.size,0);
});

test('seat transition waits for the rig clip before switching to typing',()=>{
 const a=new TycoonActivity(createTycoonRoom('projects'));a.snapshot={position:{x:0,y:0},clip:'idle'};a.station={type:'desk',seatHeight:.5};
 a.transition('sit','sit_down','sit');for(let i=0;i<7;i++)a.tick(.1);
 assert.equal(a.snapshot.clip,'sit_down');a.tick(.1);a.tick(.001);assert.equal(a.snapshot.clip,'seated_work');
});

test('each default chair faces its desk and the actor faces away from the chair back',()=>{
 const room=createTycoonRoom('projects'),nav=createTycoonNavigation(room);
 for(let i=1;i<=4;i++){
  const desk=room.objects.find(o=>o.id===`desk-${i}`),chair=room.objects.find(o=>o.id===`chair-${i}`),station=nav.stations.find(s=>s.id===`station:desk-${i}`);
  assert.ok(station);assert.equal(station.seatObjectId,chair.id);
  const target=Math.atan2(desk.x-chair.x,desk.z-chair.z);
  assert.ok(Math.cos(station.heading-target)>.99,'actor faces keyboard');
  assert.ok(Math.cos(station.heading-chair.rotation)<-.99,'actor faces away from chair back');
 }
});
test('blocked seat is diagnosed and is never used as a teleport destination',()=>{
 const r=createTycoonRoom('projects');r.navigation={version:1,routes:[],forbidden:[],stations:[{objectId:'desk-1',approach:tycoonGround({x:0,z:0}),seat:tycoonGround({x:4,z:3})}]};
 const a=new TycoonActivity(r);assert.equal(a.startStation('station:desk-1').ok,false);assert.equal(a.snapshot,null);
});
test('actor clearance blocks furniture and room edges; default walking aisle stays clear',()=>{
  const r=createLegacyTycoonRoom('projects');assert.equal(canTycoonWalk(r,{x:6,z:0}),false);assert.equal(canTycoonWalk(r,{x:-1.7,z:-1.9}),false);
  for(let x=-1.5;x<=1.5;x+=.1)assert.equal(canTycoonWalk(r,{x,z:-.65}),true);
  r.objects.find(o=>o.id==='desk-1').z=-.65;assert.equal(canTycoonWalk(r,{x:-1.5,z:-.65}),false);
});

test('an unreachable station cannot spawn the probe on the destination side of a sealed wall',()=>{
 let r=createLegacyTycoonRoom('projects');r.objects=r.objects.filter(o=>['desk-1','chair-1'].includes(o.id));const p=tycoonPlan(r);p.partitions=[{id:'sealed',axis:'x',at:4,start:0,end:12}];r=applyTycoonPlan(r,p);const a=new TycoonActivity(r);assert.equal(a.startStation('station:desk-1').ok,false);assert.equal(a.snapshot,null);assert.equal(a.reservations.size,0);
});
