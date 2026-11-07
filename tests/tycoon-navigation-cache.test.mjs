import test from 'node:test';
import assert from 'node:assert/strict';
import {OFFICE_FLOORS} from '../web/office-floor-registry.js';
import {buildOfficeHandoff} from '../web/office-handoff.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {createTycoonNavigation} from '../web/tycoon-blueprint.js';
import {createTycoonRoom} from '../web/tycoon-state.js';

const emptyNavigation=()=>({version:1,routes:[],forbidden:[],stations:[]});
const measured=value=>typeof value==='number'?Number(value.toFixed(8)):Array.isArray(value)?value.map(measured):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,child])=>[key,measured(child)])):value;
function navigationRoom(id='cache-desk'){
  const room=createTycoonRoom('projects');
  room.blueprintPlan.partitions=[];
  const desk={...room.objects.find(object=>object.id==='desk-1'),id,x:-4,y:0,z:0,rotation:Math.PI,scale:1};
  const chair={...room.objects.find(object=>object.id==='chair-1'),id:id.replace('desk','chair'),x:-4,y:0,z:-1.2,rotation:Math.PI,scale:1};
  room.objects=[desk,chair];
  room.navigation=emptyNavigation();
  return room;
}
function emptyRooms(projectRoom){
  return Object.fromEntries(OFFICE_FLOORS.map(({key})=>{
    const room=createTycoonRoom(key);
    room.objects=[];
    room.blueprintPlan.partitions=[];
    room.navigation=emptyNavigation();
    return [key,key==='projects'?projectRoom:room];
  }));
}
const testAssets=Object.fromEntries(['actor','floor','wall','window','door-frame','desk','chair'].map((kind,index)=>{
  const hash=String(index+1).padStart(64,'0');
  return [kind,{sha256:hash,bytes:64,uri:`assets/${hash}.glb`}];
}));

test('cached navigation shares immutable path closures but returns detached activity and handoff metadata',async()=>{
  const room=navigationRoom('cache-desk-a'),first=createTycoonNavigation(room),expected=structuredClone(first.stations[0]),findLocalPath=first.findLocalPath;
  assert.ok(expected?.seat&&expected?.footAnchor);

  // These fields are calibrated by TycoonScene.startStation after measuring the actor and chair.
  Object.assign(first.stations[0],{
    seatHeight:9,
    footWidthScale:.8,
    footToeOutRad:1,
    entryFlexM:.04,
    footPlacementDiagnostic:{ok:false,reason:'mutated-test'},
  });
  first.stations[0].footAnchor.x+=100;
  first.stations.push({id:'mutated-station'});
  first.issues.push({objectId:'mutated-issue'});
  first.blockers[0].polygon[0][0]+=100;
  first.blockers.push({id:'mutated-blocker'});
  first.zones[0].polygon[0][0]+=100;
  first.zones.push({id:'mutated-zone'});
  first.spawnPoint.x+=100;
  room.objects[0].finish={color:'#ff00ff'};

  const activity=new TycoonActivity(room),second=activity.nav;
  assert.strictEqual(second.findLocalPath,findLocalPath,'appearance-only changes reuse the geometry closure');
  assert.notStrictEqual(second.stations,first.stations);
  assert.notStrictEqual(second.blockers,first.blockers);
  assert.notStrictEqual(second.zones,first.zones);
  assert.deepEqual(second.stations,[expected]);
  assert.deepEqual(second.issues,[]);
  assert.notEqual(second.blockers[0].polygon[0][0],first.blockers[0].polygon[0][0]);
  assert.notEqual(second.zones[0].polygon[0][0],first.zones[0].polygon[0][0]);
  assert.notEqual(second.spawnPoint.x,first.spawnPoint.x);

  const handoff=await buildOfficeHandoff({rooms:emptyRooms(room),assets:testAssets});
  const handoffStation=handoff.entities.find(entity=>entity.type==='station'&&entity.key==='projects/station:cache-desk-a');
  assert.ok(handoffStation);
  assert.deepEqual(handoffStation.data.interaction,measured(expected),'handoff uses the original geometry, without transient scene calibration');
});

test('placement, wall, door, and authored-route changes invalidate the cached closures',()=>{
  const base=navigationRoom('cache-key-desk'),original=createTycoonNavigation(base).findLocalPath;
  const placement=structuredClone(base);placement.objects[0].x+=.25;
  assert.notStrictEqual(createTycoonNavigation(placement).findLocalPath,original,'placement changes geometry');

  const wall=structuredClone(base);wall.blueprintPlan.partitions=[{id:'cache-wall',axis:'x',at:7,start:1,end:4}];
  assert.notStrictEqual(createTycoonNavigation(wall).findLocalPath,original,'partition changes geometry');

  const door=structuredClone(base);door.blueprintPlan.door.offset+=.25;
  assert.notStrictEqual(createTycoonNavigation(door).findLocalPath,original,'door placement changes geometry');

  const route=structuredClone(base);route.navigation.routes=[{id:'cache-route',points:[{x:48,y:50},{x:52,y:50}]}];
  assert.notStrictEqual(createTycoonNavigation(route).findLocalPath,original,'authored navigation changes path closures');
});

test('the navigation geometry cache evicts beyond eight entries',()=>{
  const base=navigationRoom(`capacity-desk-${Date.now()}`),original=createTycoonNavigation(base).findLocalPath;
  for(let index=1;index<=8;index++){
    const variant=structuredClone(base);variant.objects[0].x+=index*.125;
    createTycoonNavigation(variant);
  }
  assert.notStrictEqual(createTycoonNavigation(base).findLocalPath,original,'the ninth distinct key evicts the oldest cached geometry');
});
