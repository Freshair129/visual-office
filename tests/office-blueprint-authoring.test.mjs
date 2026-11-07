import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaultBlueprintPlan,validateBlueprintPlan,moveBlueprintWall,moveBlueprintOpening,BlueprintTemplateStore} from '../web/office-blueprint-state.js';
import {blueprintLayout,blueprintPoint} from '../web/office-blueprints.js';
import {createOfficeArchitecture,disposeOfficeArchitecture} from '../web/office-architecture.js';
import {groundToWorld} from '../web/office-projection.js';
import {departmentStarterRoom,parseRoomJSON,RoomHistory,RoomStore,floorFile,parseFloorJSON} from '../web/hybrid-state.js';

test('walls resize in metres with opposite edge anchored; doors/windows have validated wall coordinates',()=>{
  const p=defaultBlueprintPlan('medium'),moved=moveBlueprintWall(p,'left',-.8);
  assert.ok(Math.abs(moved.width-12.8)<1e-9);assert.ok(Math.abs(moved.originX-p.originX+.8)<1e-9);
  assert.equal(moved.originX+moved.width,p.originX+p.width);
  const a=groundToWorld(blueprintPoint(moved,0,0)),b=groundToWorld(blueprintPoint(moved,moved.width,0));assert.ok(Math.abs(a.distanceTo(b)-12.8)<1e-8);
  assert.equal(blueprintLayout(moved).blueprint.width,12.8);
  const door=moveBlueprintOpening(p,'door','right',3);assert.equal(door.door.wall,'right');assert.equal(door.door.offset,3);
  const window=moveBlueprintOpening(p,'window-1','left',1);assert.equal(window.windows[0].wall,'left');assert.equal(window.windows[0].offset,1);
  for(const bad of [{...p,width:NaN},{...p,width:100},{...p,tenantId:'no'},{...p,windows:[...p.windows,p.windows[0]]},{...p,door:{wall:'rear',offset:p.windows[0].offset,width:1.2}}])assert.throws(()=>validateBlueprintPlan(bad));
});
test('mesh window/door positions and collision spans follow a custom plan',()=>{
  let p=moveBlueprintWall(defaultBlueprintPlan('medium'),'right',1);
  p=moveBlueprintOpening(p,'door','right',3);p=moveBlueprintOpening(p,'window-1','left',1);
  const model=createOfficeArchitecture(p),meta=model.userData.officeArchitecture,layout=blueprintLayout(p);
  try{
    const box=new THREE.Box3().setFromObject(meta.floorMeshes.outerBoundary);assert.ok(Math.abs(box.max.x-box.min.x-13)<1e-5);
    assert.equal(meta.windows.length,p.windows.length);assert.equal(meta.doorwayOpening.wall,'right');
    assert.deepEqual(meta.walls.map(w=>[w.start,w.end]),layout.walls.map(w=>[w.start,w.end]));
    assert.ok(meta.windows.some(w=>w.group.userData.openingId==='window-1'));
  }finally{disposeOfficeArchitecture(model);}
});
test('custom plan round-trips through floor save and Undo without moving objects; templates are separate',()=>{
  const old=departmentStarterRoom({number:1,label:'Projects',roles:['one']});
  const room={...old,blueprint:'medium',blueprintPlan:moveBlueprintWall(defaultBlueprintPlan('medium'),'right',1)};
  assert.deepEqual(parseRoomJSON(JSON.stringify(room)),room);
  assert.deepEqual(parseFloorJSON(JSON.stringify(floorFile('projects',room))).room,room);
  const history=new RoomHistory(room);history.change({...room,blueprintPlan:moveBlueprintWall(room.blueprintPlan,'front',.5)});history.undo();assert.deepEqual(history.current,room);
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  const floors=new RoomStore(storage);floors.apply('preview:projects',room);assert.equal(new RoomStore(storage).floor('customer'),null);
  const templates=new BlueprintTemplateStore(storage);assert.equal(templates.save('My layout',room.blueprintPlan).ok,true);
  const loaded=new BlueprintTemplateStore(storage);assert.equal(loaded.items.length,1);assert.deepEqual(loaded.items[0].plan,room.blueprintPlan);
  assert.deepEqual(new RoomStore(storage).floor('projects').objects,old.objects);
  assert.throws(()=>parseRoomJSON(JSON.stringify({...room,blueprintPlan:{...room.blueprintPlan,script:'x'}})));
});
