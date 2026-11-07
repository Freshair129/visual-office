import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as state from '../web/office-blueprint-state.js';
import {blueprintLayout,blueprintPoint} from '../web/office-blueprints.js';
import {createOfficeNavigation} from '../web/office-navigation.js';
import {createOfficeArchitecture,disposeOfficeArchitecture} from '../web/office-architecture.js';
import {RoomStore,parseFloorJSON,floorFile} from '../web/hybrid-state.js';
const plan=()=>({...state.defaultBlueprintPlan('medium'),partitions:[{id:'divide',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4}}]});
const room=p=>({schemaVersion:'office-room/v1',name:'Doors',brief:'',background:'office',blueprint:'medium',blueprintPlan:p,objects:[]});

test('legacy door defaults open; strict boolean state and toggles preserve inventory-independent structure',()=>{
  const p=plan();assert.equal(blueprintLayout(p).doors.find(d=>d.id==='partition:divide').open,true);
  const shut=state.toggleBlueprintDoor(p,'partition:divide');assert.equal(shut.partitions[0].door.open,false);assert.equal(p.partitions[0].door.open,undefined);
  assert.equal(state.toggleBlueprintDoor(shut,'partition:divide').partitions[0].door.open,true);
  assert.equal(state.toggleBlueprintDoor(p,'entry').door.open,false);
  for(const open of ['false',0,null]){assert.throws(()=>state.validateBlueprintPlan({...p,door:{...p.door,open}}));const bad=plan();bad.partitions[0].door.open=open;assert.throws(()=>state.validateBlueprintPlan(bad));}
  assert.throws(()=>state.toggleBlueprintDoor(p,'partition:missing'));
});

test('visible door panels and navigation agree: closed seals the room and reopened restores paths',()=>{
  const p=plan(),a=blueprintPoint(p,2,2),b=blueprintPoint(p,9,2);
  assert.ok(createOfficeNavigation(room(p)).findPath(a,b).length);
  const closed=state.toggleBlueprintDoor(p,'partition:divide'),nav=createOfficeNavigation(room(closed));assert.equal(nav.findPath(a,b).length,0);
  assert.equal(nav.isSegmentWalkable(blueprintPoint(p,4,4.7),blueprintPoint(p,6,4.7)),false);
  const model=createOfficeArchitecture(closed);try{const door=model.userData.officeArchitecture.doors.find(d=>d.id==='partition:divide');assert.equal(door.open,false);assert.ok(new THREE.Box3().setFromObject(door.group).getSize(new THREE.Vector3()).y>2,'normal adult doorway clearance despite low cutaway walls');assert.ok(door.panels.every(m=>m.visible));}finally{disposeOfficeArchitecture(model);}
  const opened=state.toggleBlueprintDoor(closed,'partition:divide'),model2=createOfficeArchitecture(opened);try{assert.ok(model2.userData.officeArchitecture.doors.find(d=>d.id==='partition:divide').panels.every(m=>!m.visible));}finally{disposeOfficeArchitecture(model2);}
  assert.ok(createOfficeNavigation(room(opened)).findPath(a,b).length);
});

test('door states persist through floor JSON and selected-floor storage independently',()=>{
  const p=state.toggleBlueprintDoor(plan(),'partition:divide'),r=room(p),values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  assert.deepEqual(parseFloorJSON(JSON.stringify(floorFile('projects',r))).room,r);
  new RoomStore(storage).apply('preview:projects',r);assert.equal(new RoomStore(storage).floor('projects').blueprintPlan.partitions[0].door.open,false);assert.equal(new RoomStore(storage).floor('customer'),null);
});
