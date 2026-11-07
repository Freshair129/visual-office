import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultOfficeNavigation,createOfficeNavigation} from '../web/office-navigation.js';
import {officeArchitectureFootprints} from '../web/office-architecture.js';

const roomWith=(objects=[])=>({schemaVersion:'office-room/v1',background:'office',objects});
const object=(id,kind,x,y,scale=1,flip=false)=>({id,kind,x,y,scale,flip});
const near=(a,b,epsilon=.001)=>Math.abs(a-b)<=epsilon;

function assertSegmentsWalkable(navigation,path){
  assert.ok(path.length>=2);
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],length=Math.hypot(b.x-a.x,b.y-a.y);
    for(let step=0;step<=Math.ceil(length/.25);step++){
      const t=step/Math.max(1,Math.ceil(length/.25));
      assert.equal(navigation.isWalkable({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),true,
        `path segment ${i-1} leaves safe floor at t=${t}`);
    }
  }
}

test('office, corridor and lounge form one wall-safe walk area',()=>{
  const navigation=createOfficeNavigation(roomWith());
  assert.deepEqual(navigation.zones.map(zone=>zone.id),['work','corridor','lounge']);
  assert.equal(navigation.isWalkable({x:20,y:50}),false);
  assert.equal(navigation.isWalkable({x:42,y:58}),false,'wall bases stay outside the walk area');
  assert.equal(navigation.isWalkable({x:43,y:43}),true);
  const path=navigation.findPath({x:43,y:48},{x:32,y:56});
  assert.ok(path.length>=2);
  assert.deepEqual(path[0],{x:43,y:48});
  assert.deepEqual(path.at(-1),{x:32,y:56});
  assertSegmentsWalkable(navigation,path);
});

test('a route detours around the scaled work-desk footprint',()=>{
  const navigation=createOfficeNavigation(roomWith([object('desk-a','work-desk',66,43,.62)]));
  assert.equal(navigation.isWalkable({x:66,y:43}),false);
  const path=navigation.findPath({x:58,y:43},{x:74,y:43});
  assert.ok(path.length>2,'the route must go around the desk');
  assertSegmentsWalkable(navigation,path);
});

test('diagonal transitions cannot squeeze through furniture corners',()=>{
  const navigation=createOfficeNavigation(roomWith([
    object('desk-a','work-desk',65,43,.62),
    object('chair-a','task-chair',69,47,.72),
  ]));
  const path=navigation.findPath({x:55,y:43},{x:75,y:45});
  assert.ok(path.length>2);
  assertSegmentsWalkable(navigation,path);
});

test('furniture transforms affect blockers and desk stations follow mirrored desks',()=>{
  const regular=createOfficeNavigation(roomWith([object('desk-a','work-desk',64,43,.62,false)]));
  const larger=createOfficeNavigation(roomWith([object('desk-a','work-desk',64,43,1.24,false)]));
  const mirrored=createOfficeNavigation(roomWith([object('desk-a','work-desk',64,43,.62,true)]));
  const regularPolygon=regular.blockers[0].polygon,largerPolygon=larger.blockers[0].polygon;
  const width=polygon=>Math.max(...polygon.map(p=>p[0]))-Math.min(...polygon.map(p=>p[0]));
  assert.ok(width(largerPolygon)>width(regularPolygon));
  const regularStation=regular.stations.find(station=>station.objectId==='desk-a');
  const mirroredStation=mirrored.stations.find(station=>station.objectId==='desk-a');
  assert.ok(regularStation.position.x>64);
  assert.ok(mirroredStation.position.x<64);
  assert.equal(regularStation.id,mirroredStation.id);
});

test('desk, water and sofa interaction points are reachable and moved props recalculate',()=>{
  const room=roomWith([
    object('desk-a','work-desk',64,43,.62),
    object('chair-a','task-chair',67.2,40.5,.72),
    object('cooler-a','water-cooler',37,68,1),
    object('sofa-a','team-sofa',28,75,1),
  ]);
  const first=createOfficeNavigation(room);
  assert.deepEqual(first.stations.map(station=>station.type),['desk','water','sofa']);
  for(const station of first.stations){
    assert.equal(first.isWalkable(station.position),true,`${station.id} approach is safe`);
    assert.ok(first.findPath({x:32,y:56},station.position).length>0,`${station.id} is reachable`);
  }
  const desk=first.stations.find(station=>station.type==='desk');
  assert.deepEqual(desk.seat,{x:67.2,y:40.5});
  assert.equal(desk.seatObjectId,'chair-a');
  assert.equal(first.isWalkable(desk.seat),false);
  assert.ok(first.findPath(desk.position,desk.seat,{ignoreIds:[desk.seatObjectId]}).length>0);
  const oldCooler=first.stations.find(station=>station.objectId==='cooler-a');
  room.objects.find(item=>item.id==='cooler-a').x=45;
  const moved=createOfficeNavigation(room),newCooler=moved.stations.find(station=>station.objectId==='cooler-a');
  assert.equal(oldCooler.id,newCooler.id);
  assert.ok(!near(oldCooler.position.x,newCooler.position.x));
  assert.equal(first.isWalkable({x:37,y:68}),false,'the first navigation snapshot remains unchanged');
});

test('invalid and out-of-bounds points fail quickly without unbounded searches',()=>{
  const navigation=createOfficeNavigation(roomWith());
  assert.equal(navigation.isWalkable({x:NaN,y:43}),false);
  assert.equal(navigation.isWalkable({x:1000000000,y:43}),false);
  assert.deepEqual(navigation.findPath({x:43,y:43},{x:1000000000,y:52}),[]);
  assert.deepEqual(navigation.findPath({x:10,y:10},{x:20,y:20}),[]);
});

test('authored routes constrain pathfinding and blocked graphs fail closed',()=>{
  const authored=roomWith();
  authored.navigation={version:1,routes:[{id:'door-route',points:[
    {x:43,y:48},{x:36,y:54},{x:32,y:56},
  ]}],forbidden:[],stations:[]};
  const navigation=createOfficeNavigation(authored);
  const path=navigation.findPath({x:43,y:48},{x:32,y:56});
  assert.ok(path.length>=3,'path follows authored door waypoints');
  assertSegmentsWalkable(navigation,path);

  authored.navigation={version:1,routes:[{id:'blocked-route',points:[{x:43,y:48},{x:32,y:56}]}],
    forbidden:[{id:'route-closure',points:[{x:36,y:50},{x:39,y:50},{x:39,y:52},{x:36,y:52}]}],stations:[]};
  const disconnected=createOfficeNavigation(authored);
  assert.deepEqual(disconnected.findPath({x:43,y:48},{x:32,y:56}),[],
    'a blocked authored graph never silently falls back to free routing');
});

test('forbidden polygons remain blockers when object ids are ignored',()=>{
  const room=roomWith([object('desk-a','work-desk',64,43,.62)]);
  room.navigation={version:1,routes:[],forbidden:[{id:'restricted',points:[
    {x:45,y:49},{x:48,y:49},{x:48,y:52},{x:45,y:52},
  ]}],stations:[]};
  const navigation=createOfficeNavigation(room);
  assert.equal(navigation.isWalkable({x:46.5,y:50.5}),false);
  assert.equal(navigation.isWalkable({x:46.5,y:50.5},{ignoreIds:['restricted','desk-a']}),false);
  assert.ok(navigation.blockers.some(blocker=>blocker.id==='restricted'&&blocker.type==='forbidden'));
});

test('local navigation bypasses authored waypoints but still enforces every collision',()=>{
  const room=roomWith();
  room.navigation={version:1,routes:[{id:'blocked-route',points:[{x:43,y:48},{x:32,y:56}]}],
    forbidden:[{id:'closure',points:[{x:36,y:50},{x:39,y:50},{x:39,y:52},{x:36,y:52}]}],stations:[]};
  const navigation=createOfficeNavigation(room);
  assert.deepEqual(navigation.findPath({x:43,y:48},{x:32,y:56}),[],'authored-route mode fails closed');
  const local=navigation.findLocalPath({x:43,y:48},{x:32,y:56});
  assert.ok(local.length>=2,'local pathfinding can reach a safe interaction point independently');
  assertSegmentsWalkable(navigation,local);
  assert.equal(navigation.isSegmentWalkable({x:43,y:48},{x:32,y:56}),false,
    'route validation rejects a segment crossing a permanent forbidden area');
});

test('default navigation config materializes only safe generated stations',()=>{
  const room=roomWith([
    object('desk-a','work-desk',64,43,.62),object('chair-a','task-chair',67.2,40.5,.72),
    object('water-a','water-cooler',37,68),object('sofa-a','team-sofa',28,75),
  ]);
  const config=createDefaultOfficeNavigation(room);
  assert.deepEqual(config.routes,[]);
  assert.deepEqual(config.forbidden,[]);
  assert.equal(config.stations.length,3);
  const checked=createOfficeNavigation({...room,navigation:config});
  assert.equal(checked.issues.length,0);
  assert.equal(checked.stations.length,3);
});

test('safe authored stations override defaults; blocked overrides are omitted with an issue',()=>{
  const room=roomWith([object('desk-a','work-desk',64,43,.62),object('chair-a','task-chair',67.2,40.5,.72)]);
  room.navigation={version:1,routes:[],forbidden:[],stations:[{
    objectId:'desk-a',approach:{x:58,y:38},seat:{x:67.2,y:40.5},
  }]};
  const customNavigation=createOfficeNavigation(room),custom=customNavigation.stations.find(station=>station.objectId==='desk-a');
  assert.deepEqual(custom.position,{x:58,y:38});
  assert.deepEqual(custom.seat,{x:67.2,y:40.5});
  assert.equal(custom.seatObjectId,'chair-a','a chair seat is allowed through its own matched chair blocker');
  assert.ok(customNavigation.findLocalPath(custom.position,custom.seat,{ignoreIds:[custom.seatObjectId]}).length>0);
  assert.equal(custom.custom,true);

  room.navigation.stations=[{objectId:'desk-a',approach:{x:64,y:43},seat:{x:67.2,y:40.5}}];
  const navigation=createOfficeNavigation(room);
  assert.equal(navigation.stations.find(station=>station.objectId==='desk-a'),undefined,
    'a blocked authored station is omitted instead of silently substituting a different point');
  assert.ok(navigation.issues.some(issue=>issue.objectId==='desk-a'));
});

test('custom desk seats need a matched nearby chair and must remain inside its footprint',()=>{
  const desk=object('desk-a','work-desk',64,43,.62),chair=object('chair-a','task-chair',67.2,40.5,.72);
  const makeRoom=(objects,seat)=>{
    const room=roomWith(objects);room.navigation={version:1,routes:[],forbidden:[],stations:[{
      objectId:'desk-a',approach:{x:58,y:38},seat,
    }]};return room;
  };

  const unpaired=createOfficeNavigation(makeRoom([desk],{x:59,y:38}));
  assert.equal(unpaired.stations.find(station=>station.objectId==='desk-a'),undefined);
  assert.match(unpaired.issues.find(issue=>issue.objectId==='desk-a')?.message,/matched chair/i);

  const distant=createOfficeNavigation(makeRoom([desk,chair],{x:59,y:38}));
  assert.equal(distant.stations.find(station=>station.objectId==='desk-a'),undefined);
  assert.match(distant.issues.find(issue=>issue.objectId==='desk-a')?.message,/chair footprint/i);
});

test('custom sofa seats must stay on the sofa footprint',()=>{
  const sofa=object('sofa-a','team-sofa',28,75,1),defaultStation=createOfficeNavigation(roomWith([sofa])).stations[0];
  const room=roomWith([sofa]);
  room.navigation={version:1,routes:[],forbidden:[],stations:[{objectId:'sofa-a',approach:defaultStation.position,seat:{x:40,y:75}}]};
  const blocked=createOfficeNavigation(room);
  assert.equal(blocked.stations.find(station=>station.objectId==='sofa-a'),undefined);
  assert.match(blocked.issues.find(issue=>issue.objectId==='sofa-a')?.message,/sofa footprint/i);

  room.navigation.stations[0].seat={x:28,y:75};
  const valid=createOfficeNavigation(room).stations.find(station=>station.objectId==='sofa-a');
  assert.deepEqual(valid.seat,{x:28,y:75});
  assert.equal(valid.seatObjectId,'sofa-a');
});

test('malformed water cooler seating remains visible as a navigation issue',()=>{
  const cooler=object('water-a','water-cooler',37,68,1),room=roomWith([cooler]);
  room.navigation={version:1,routes:[],forbidden:[],stations:[{
    objectId:'water-a',approach:{x:34,y:70},seat:{x:37,y:68},
  }]};
  const navigation=createOfficeNavigation(room);
  assert.ok(navigation.issues.some(issue=>issue.objectId==='water-a'&&/water cooler.*seat/i.test(issue.message)));
});

test('fixed architecture fixtures block their centers and local routes detour around them',()=>{
  const fixtures=officeArchitectureFootprints(.3),navigation=createOfficeNavigation(roomWith());
  const architecture=navigation.blockers.filter(blocker=>blocker.type==='architecture');
  assert.equal(architecture.length,fixtures.length);
  for(const fixture of fixtures){
    const blocker=architecture.find(item=>item.objectId===`architecture-${fixture.id}`);
    assert.ok(blocker,`navigation includes fixed fixture ${fixture.id}`);
    assert.equal(navigation.isWalkable(fixture.center,{ignoreIds:[blocker.id,blocker.objectId]}),false,
      `${fixture.id} stays blocked even when its id is ignored`);
  }

  const loungePlant=fixtures.find(fixture=>fixture.id==='plant-lounge');
  const from={x:loungePlant.center.x+2.6,y:loungePlant.center.y+1.5};
  const to={x:loungePlant.center.x-.6,y:loungePlant.center.y+3.45};
  assert.equal(navigation.isWalkable(from),true);
  assert.equal(navigation.isWalkable(to),true);
  assert.equal(navigation.isSegmentWalkable(from,to),false,'the direct segment crosses a fixed plant');
  const path=navigation.findLocalPath(from,to);
  assert.ok(path.length>2,'the local route should detour around the fixed plant');
  for(let index=1;index<path.length;index++)
    assert.equal(navigation.isSegmentWalkable(path[index-1],path[index]),true,
      'every path segment clears architecture fixtures');
});
