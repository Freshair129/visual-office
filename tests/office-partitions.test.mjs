import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBlueprintPlan,validateBlueprintPlan,moveBlueprintWall,BlueprintTemplateStore} from '../web/office-blueprint-state.js';
import {blueprintLayout,blueprintPoint} from '../web/office-blueprints.js';
import {createOfficeNavigation} from '../web/office-navigation.js';
import {createOfficeArchitecture,disposeOfficeArchitecture} from '../web/office-architecture.js';
import {parseRoomJSON,RoomStore,floorFile,parseFloorJSON} from '../web/hybrid-state.js';

const partition=()=>({id:'partition-1',axis:'z',at:5,start:0,end:8});
const plan=()=>({...defaultBlueprintPlan('medium'),partitions:[partition()],areas:[{id:'area-1',type:'meeting',name:'ห้องประชุม',x:.5,z:.5,width:4,depth:3}]});
const room=p=>({schemaVersion:'office-room/v1',name:'Rooms',brief:'',background:'office',blueprint:'medium',blueprintPlan:p,objects:[]});

test('interior partitions are strict, bounded, nonoverlapping and keep doors clear of junctions',()=>{
  const p=plan();assert.deepEqual(validateBlueprintPlan(p),p);
  for(const patch of [{partitions:[{...partition(),axis:'diagonal'}]},{partitions:[{...partition(),at:20}]},{partitions:[partition(),{...partition(),id:'other'}]},
    {partitions:[{...partition(),door:{offset:7.5,width:1.2}}]},
    {partitions:[{...partition(),door:{offset:2,width:1.2}},{id:'junction',axis:'x',at:2.5,start:0,end:5}]},
    {areas:[{...p.areas[0],type:'business'}]},{areas:[{...p.areas[0],width:30}]},
    {partitions:[{...partition(),script:'bad'}]},{partitions:null},{areas:0},{partitions:[{...partition(),door:null}]}])assert.throws(()=>validateBlueprintPlan({...p,...patch}));
  const moved=moveBlueprintWall(p,'left',-.5);assert.equal(moved.partitions[0].at,5.5);assert.equal(moved.areas[0].x,1);
});

test('partition doors drive actual wall meshes and reroute walks; sealed rooms remain unreachable',()=>{
  const p=plan(),from=blueprintPoint(p,2,2),to=blueprintPoint(p,9,2);
  assert.equal(createOfficeNavigation(room(p)).findPath(from,to).length,0);
  p.partitions[0].door={offset:4,width:1.4};
  const layout=blueprintLayout(p),spans=layout.walls.filter(w=>w.partitionId==='partition-1');assert.equal(spans.length,2);
  const model=createOfficeArchitecture(p);try{assert.equal(model.userData.officeArchitecture.walls.length,layout.walls.length);}finally{disposeOfficeArchitecture(model);}
  const nav=createOfficeNavigation(room(p)),path=nav.findPath(from,to);assert.ok(path.length>2);
  for(let i=1;i<path.length;i++)assert.ok(nav.isSegmentWalkable(path[i-1],path[i]));
  const authored=room(p);authored.navigation={version:1,routes:[{id:'old',points:[from,to]}],forbidden:[],stations:[]};
  const rerouted=createOfficeNavigation(authored),route=rerouted.findPath(from,to);assert.ok(route.length>2);
  for(let i=1;i<route.length;i++)assert.ok(rerouted.isSegmentWalkable(route[i-1],route[i]));
  assert.deepEqual(authored.navigation.routes[0].points,[from,to]);
  delete p.partitions[0].door;assert.equal(createOfficeNavigation(authored).findPath(from,to).length,0);
});

test('rooms and doorways roundtrip in independent templates and floor snapshots',()=>{
  const p=plan();p.partitions[0].door={offset:4,width:1.4};const r=room(p);
  assert.deepEqual(parseRoomJSON(JSON.stringify(r)),r);assert.deepEqual(parseFloorJSON(JSON.stringify(floorFile('projects',r))).room,r);
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const templates=new BlueprintTemplateStore(storage);assert.equal(templates.save('Three rooms',p).ok,true);assert.deepEqual(new BlueprintTemplateStore(storage).items[0].plan,p);
  new RoomStore(storage).apply('preview:projects',r);assert.deepEqual(new RoomStore(storage).floor('projects').blueprintPlan,p);assert.equal(new RoomStore(storage).floor('customer'),null);
});
