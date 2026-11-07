import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {officeBlueprints,blueprintLayout,blueprintPoint,blueprintLocalPoint,applyOfficeBlueprint,blueprintSVG} from '../web/office-blueprints.js';
import {groundToWorld} from '../web/office-projection.js';
import {createOfficeArchitecture,disposeOfficeArchitecture} from '../web/office-architecture.js';
import {createOfficeNavigation} from '../web/office-navigation.js';
import {createOfficeCharacter,updateOfficeCharacter,disposeOfficeCharacter} from '../web/office-characters.js';
import {departmentStarterRoom,parseRoomJSON,RoomStore,RoomHistory,floorFile,parseFloorJSON} from '../web/hybrid-state.js';

for(const [id,w,d] of [['small',8,6],['medium',12,8],['large',16,10]]){
  test(`${id}: exact metric orthogonal plan, geometry and safe circulation share one source`,()=>{
    const b=officeBlueprints[id],layout=blueprintLayout(id);
    assert.equal(b.width,w);assert.equal(b.depth,d);assert.equal(b.designPxPerMetre,100);
    const corners=[[0,0],[w,0],[w,d],[0,d]].map(([x,z])=>groundToWorld(blueprintPoint(id,x,z)));
    assert.ok(Math.abs(corners[0].distanceTo(corners[1])-w)<1e-8);
    assert.ok(Math.abs(corners[1].distanceTo(corners[2])-d)<1e-8);
    assert.ok(Math.abs(corners[1].clone().sub(corners[0]).dot(corners[2].clone().sub(corners[1])))<1e-8);
    const room=applyOfficeBlueprint({schemaVersion:'office-room/v1',name:'Team',brief:'',background:'office',objects:[]},id);
    const model=createOfficeArchitecture(id),meta=model.userData.officeArchitecture;
    try{
      const box=new THREE.Box3().setFromObject(meta.floorMeshes.outerBoundary);
      assert.ok(Math.abs(box.max.x-box.min.x-w)<1e-5);assert.ok(Math.abs(box.max.z-box.min.z-d)<1e-5);
      assert.equal(meta.blueprintId,id);
      assert.equal(meta.doorwayOpening.widthMeters,1.2);
      assert.deepEqual(meta.zones.work.polygon,layout.zones.find(z=>z.id==='work').polygon);
      const nav=createOfficeNavigation(room);
      const a=blueprintPoint(id,1.5,d-1),c=blueprintPoint(id,w-1,d-1);
      assert.ok(nav.isSegmentWalkable(a,c),'2m circulation strip must stay open');
      const desks=nav.stations.filter(s=>s.type==='desk');
      assert.equal(desks.length,b.columns*b.rows);
      for(const station of nav.stations){
        if(station.type==='desk')assert.ok(station.seat,`${station.objectId} needs its chair`);
        assert.ok(nav.findPath(a,station.position).length,`${station.objectId} reachable from corridor`);
      }
      assert.equal(nav.isWalkable(blueprintPoint(id,-.5,2)),false);
    }finally{disposeOfficeArchitecture(model);}
    const svg=blueprintSVG(id,room);
    assert.match(svg,new RegExp(`${w} m`));assert.match(svg,new RegExp(`${d} m`));assert.match(svg,/100 design px/);
    assert.doesNotMatch(svg,/NaN|undefined/);
  });
}
test('template application preserves avatar identity and count, is undoable and isolated per floor',()=>{
  const old=departmentStarterRoom({number:1,label:'Projects',roles:Array(4).fill('role')});
  const avatars=old.objects.filter(o=>o.kind.startsWith('avatar-'));
  const next=applyOfficeBlueprint(old,'large');
  assert.deepEqual(next.objects.filter(o=>o.kind.startsWith('avatar-')).map(o=>[o.id,o.kind]),avatars.map(o=>[o.id,o.kind]));
  assert.ok(next.objects.length<=40);assert.equal(next.navigation,undefined);
  assert.deepEqual(parseRoomJSON(JSON.stringify(next)),next);
  assert.deepEqual(parseFloorJSON(JSON.stringify(floorFile('projects',next))).room,next);
  const history=new RoomHistory(old);history.change(next);history.undo();assert.deepEqual(history.current,old);history.redo();assert.deepEqual(history.current,next);
  let saved;const storage={getItem:()=>saved,setItem:(k,v)=>{saved=v;}};
  const store=new RoomStore(storage);store.apply('preview:projects',next);
  assert.equal(new RoomStore(storage).floor('projects').blueprint,'large');assert.equal(new RoomStore(storage).floor('customer'),null);
  assert.throws(()=>parseRoomJSON(JSON.stringify({...next,blueprint:'foreign'})));
});
test('a crowded room fails explicitly before normalization can truncate avatars',()=>{
  const room={schemaVersion:'office-room/v1',name:'Crowded',brief:'',background:'office',objects:Array.from({length:40},(_,i)=>({id:`person-${i}`,kind:'avatar-01',x:50,y:70,scale:.82,flip:false,locked:false}))};
  for(const id of Object.keys(officeBlueprints))assert.throws(()=>applyOfficeBlueprint(room,id),/40/);
  assert.equal(room.objects.length,40);
});
test('template IDs never rename preserved avatars and Office blueprints cannot replace the Lobby',()=>{
  const room=departmentStarterRoom({number:1,roles:['one']});
  room.objects.find(o=>o.kind.startsWith('avatar-')).id='plan-desk-1';
  const next=applyOfficeBlueprint(room,'small');
  const normalized=parseRoomJSON(JSON.stringify(next));
  assert.equal(normalized.objects.find(o=>o.kind.startsWith('avatar-')).id,'plan-desk-1');
  assert.throws(()=>floorFile('lobby',next),/Lobby/);
  let saved;const store=new RoomStore({getItem:()=>saved,setItem:(k,v)=>{saved=v;}});
  assert.equal(store.apply('preview:lobby',next),false);assert.equal(saved,undefined);
});
test('dense or oversized inventories fail without truncation or moving bodies through the shell',()=>{
  for(const [id,count] of [['small',32],['medium',24],['large',20]]){
    const input={objects:Array.from({length:count},(_,i)=>({id:`person-${i}`,kind:'avatar-01',x:50,y:70,scale:.82,flip:false,locked:false}))};
    assert.throws(()=>applyOfficeBlueprint(input,id),/พื้นที่ปลอดภัย/);assert.equal(input.objects.length,count);
    assert.throws(()=>applyOfficeBlueprint({objects:[{...input.objects[0],scale:1.5}]},id),/พื้นที่ปลอดภัย/);
    const room=applyOfficeBlueprint({...input,objects:input.objects.slice(0,4)},id),b=officeBlueprints[id];
    const avatars=room.objects.filter(o=>o.kind.startsWith('avatar-'));
    for(const object of avatars){const p=blueprintLocalPoint(id,object);assert.ok(p.x>=.74&&p.x<=b.width-.74&&p.z>=.74&&p.z<=b.depth-.74);}
    assert.match(blueprintSVG(id,room),/floor-lift/);
  }
});
test('accepted walking bodies remain inside the actual metric shell across headings and gait phases',()=>{
  for(const id of Object.keys(officeBlueprints)){
    const b=officeBlueprints[id],room=applyOfficeBlueprint({objects:Array.from({length:4},(_,i)=>({id:`person-${i}`,kind:'avatar-01',scale:1.02}))},id);
    const origin=groundToWorld(blueprintPoint(id,0,0)),model=createOfficeCharacter(0);model.scale.setScalar(1.02/.82);
    try{for(const object of room.objects.filter(o=>o.kind.startsWith('avatar-'))){
      model.position.copy(groundToWorld(object));
      for(let step=0;step<8;step++)for(const time of [0,.16,.32,.48]){
        updateOfficeCharacter(model,{action:'walking',heading:step*Math.PI/4,time});
        const box=new THREE.Box3().setFromObject(model);
        assert.ok(box.min.x>=origin.x&&box.max.x<=origin.x+b.width&&box.min.z>=origin.z&&box.max.z<=origin.z+b.depth,`${id} ${object.id} actual body inside ${JSON.stringify({step,time,min:box.min.toArray(),max:box.max.toArray(),origin:origin.toArray()})}`);
      }
    }}finally{disposeOfficeCharacter(model);}
  }
});
