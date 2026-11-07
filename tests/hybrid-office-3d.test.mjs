import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {HybridOffice3D,isOfficeModel} from '../web/hybrid-office-3d.js';
import {departmentStarterRoom} from '../web/hybrid-state.js';
import {groundToWorld,worldToGround,officeSceneCamera} from '../web/office-projection.js';
import {defaultBlueprintPlan,moveBlueprintWall,toggleBlueprintDoor} from '../web/office-blueprint-state.js';
import {blueprintPoint} from '../web/office-blueprints.js';
import * as THREE from 'three';
import {HybridScene} from '../web/hybrid-scene.js';

function fixture(){
  const dom=new JSDOM('<div id="scene"><div class="hy-objects"></div></div>');
  class Renderer{
    constructor(){this.domElement=dom.window.document.createElement('canvas');this.shadowMap={};}
    setClearColor(){} setPixelRatio(){} setSize(){} render(){} dispose(){}
  }
  const root=dom.window.document.querySelector('#scene');
  const layer=new HybridOffice3D(root,{Renderer});
  const room=departmentStarterRoom({key:'projects',number:1,label:'Projects',roles:[{id:'a'},{id:'b'},{id:'c'},{id:'d'}]});
  layer.sync(room,true);
  return {dom,root,layer,room,close(){layer.dispose();dom.window.close();}};
}

test('custom structural edits rebuild only architecture, dispose the old shell and keep model identity/transforms',()=>{
  const f=fixture();try{
    const base={...f.room,blueprint:'medium',blueprintPlan:defaultBlueprintPlan('medium')};f.layer.sync(base,false);
    const shell=f.layer.architecture,models=[...f.layer.models.entries()].map(([id,m])=>[id,m,m.position.clone()]);
    const edited={...base,blueprintPlan:moveBlueprintWall(base.blueprintPlan,'right',1)};f.layer.sync(edited,false);
    assert.notEqual(f.layer.architecture,shell);assert.equal(shell.userData.officeArchitectureDisposed,true);
    assert.equal(f.layer.architecture.userData.officeArchitecture.dimensions.width,13);
    for(const [id,m,p] of models){assert.equal(f.layer.models.get(id),m);assert.ok(m.position.equals(p));}
    const unchanged=f.layer.architecture;f.layer.sync(edited,false);assert.equal(f.layer.architecture,unchanged);
  }finally{f.close();}
});

test('walk-test follows exact authored vertices, reports completion and never writes scene state',()=>{
  const f=fixture();try{
    const snapshot=JSON.stringify(f.room),points=f.layer.navigation.findLocalPath({x:43,y:48},{x:32,y:56});
    const result=f.layer.startWalkTest(points);
    assert.equal(result.ok,true);
    for(let tick=0;tick<900&&f.layer.testWalk.status==='running';tick++)f.layer.step(tick/10);
    assert.equal(f.layer.testWalk.status,'completed');
    const actor=f.layer.actors.get(f.layer.testWalk.actorId);
    assert.deepEqual(actor.position,points.at(-1));assert.equal(actor.action,'idle');
    assert.equal(JSON.stringify(f.room),snapshot);
    assert.equal(f.layer.startWalkTest([{x:60,y:43},{x:62,y:43}]).ok,false,'a segment through a desk is refused');
  }finally{f.close();}
});

test('generated multi-room probes accept more than 32 safe vertices with a bounded limit',()=>{
  const f=fixture();try{
    const path=f.layer.navigation.findLocalPath({x:43,y:48},{x:32,y:56}),a=path[0],b=path[1];
    const points=Array.from({length:42},(_,i)=>({x:a.x+(b.x-a.x)*i/41,y:a.y+(b.y-a.y)*i/41}));
    assert.equal(f.layer.startWalkTest(points).ok,true);assert.equal(f.layer.startWalkTest(Array(513).fill(a)).ok,false);
  }finally{f.close();}
});

test('closing a door invalidates active motion and threshold occupancy is detectable',()=>{
  const f=fixture();try{
    const p={...defaultBlueprintPlan('medium'),partitions:[{id:'split',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4}}]};
    const from=blueprintPoint(p,4,4.7),to=blueprintPoint(p,6,4.7),r={...f.room,blueprint:'medium',blueprintPlan:p,objects:f.room.objects.filter(o=>o.kind.startsWith('avatar-')).map(o=>({...o,...from}))};
    f.layer.sync(r,false);const actor=[...f.layer.actors.values()][0];actor.position=blueprintPoint(p,5,4.7);
    assert.equal(f.layer.isDoorOccupied('partition:split'),true);actor.position=from;
    // Put the remaining actors safely away from the threshold.
    for(const other of [...f.layer.actors.values()].slice(1))other.position=blueprintPoint(p,2,2);
    assert.equal(f.layer.isDoorOccupied('partition:split'),false);
    actor.initialized=true;actor.path=[to];actor.mode='walking';actor.action='walking';
    f.layer.sync({...r,blueprintPlan:toggleBlueprintDoor(p,'partition:split')},true);
    for(let i=0;i<40;i++)f.layer.step(i/10);
    assert.ok(actor.position.x<blueprintPoint(p,5,4.7).x);assert.equal(actor.path.length,0);
  }finally{f.close();}
});

test('closed door panels can be picked directly and occlude furniture picking',()=>{
  const f=fixture();try{
    const p={...defaultBlueprintPlan('medium'),partitions:[{id:'split',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4,open:false}}]};
    f.layer.sync({...f.room,objects:[],blueprint:'medium',blueprintPlan:p},false);f.root.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});
    const door=f.layer.architecture.userData.officeArchitecture.doors.find(d=>d.id==='partition:split'),v=new THREE.Vector3(.2,.6,0);door.group.localToWorld(v);v.project(f.layer.camera);
    assert.equal(f.layer.pickDoor((v.x+1)*500,(1-v.y)*350),'partition:split');assert.ok(door.panels.every(m=>f.layer.wallMeshes.includes(m)));
  }finally{f.close();}
});

test('scene pointer capture toggles a real door mesh; an occupied threshold cannot close',()=>{
  const f=fixture();let scene;try{
    const p={...defaultBlueprintPlan('medium'),partitions:[{id:'split',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4,open:false}}]},r={...f.room,blueprint:'medium',blueprintPlan:p};
    const calls=[];scene=new HybridScene(f.root,{onDoorToggle:id=>{calls.push(id);return {ok:true,message:'changed'};}});scene.modelLayer=f.layer;scene.room=r;
    f.layer.sync({...r,objects:[]},false);f.root.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});scene.renderDoors();
    const door=f.layer.architecture.userData.officeArchitecture.doors.find(d=>d.id==='partition:split'),v=new THREE.Vector3(.2,.6,0);door.group.localToWorld(v);v.project(f.layer.camera);
    f.root.querySelector('.hy-motion-toggle').dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:(v.x+1)*500,clientY:(1-v.y)*350}));assert.equal(calls.length,0,'HUD controls keep input even when a door is behind them');
    f.root.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:(v.x+1)*500,clientY:(1-v.y)*350}));assert.deepEqual(calls,['partition:split']);
    const opened=toggleBlueprintDoor(p,'partition:split');scene.room={...r,blueprintPlan:opened};f.layer.sync(scene.room,false);[...f.layer.actors.values()][0].position=blueprintPoint(p,5,4.7);
    scene.toggleDoor('partition:split');assert.equal(calls.length,1);assert.match(f.root.querySelector('.hy-door-status').textContent,/ตัวละครอยู่ในช่องประตู/);
  }finally{if(scene){scene.modelLayer=null;scene.dispose();}f.close();}
});

test('ground positions roundtrip and match the actual scene camera',()=>{
  const camera=officeSceneCamera();
  for(const p of [{x:20,y:59},{x:61,y:43},{x:78,y:82}]){
    const world=groundToWorld(p),roundtrip=worldToGround(world),projected=world.clone().project(camera);
    assert.ok(Math.abs(roundtrip.x-p.x)<1e-8&&Math.abs(roundtrip.y-p.y)<1e-8);
    assert.ok(Math.abs((projected.x+1)*50-p.x)<1e-7);
    assert.ok(Math.abs((1-projected.y)*50-p.y)<1e-7);
  }
});

test('3D actors reserve interactions, walk only on safe ground and leave authored state untouched',()=>{
  const f=fixture();try{
    const {layer,room}=f,snapshot=JSON.stringify(room),[first,second]=layer.actors.values();
    assert.equal(first.action,'sitting');
    const bounds=layer.bounds(first.model);assert.ok(bounds.top>20&&bounds.left>20&&bounds.width<15&&bounds.height<30,'DOM controls track the actual model bounds');
    assert.equal(layer.setMode(first.id,'water'),true);
    assert.equal(layer.setMode(second.id,'water'),false,'the cooler is reserved while walking');
    assert.equal(second.mode,'auto','failed commands preserve the previous mode');
    for(let tick=0;tick<1600;tick++){
      layer.step(tick/10);
      for(const actor of layer.actors.values())if(actor.action==='walking')assert.equal(layer.navigation.isWalkable(actor.position,{ignoreIds:actor.ignoreIds||[]}),true);
      if(first.action==='drinking')break;
    }
    assert.equal(first.action,'drinking');
    assert.equal(layer.setMode(first.id,'idle'),true);
    assert.equal(first.target,null);
    assert.equal(layer.setMode(second.id,'water'),true,'cancelled interaction frees the station');
    assert.equal(JSON.stringify(room),snapshot);
    layer.sync(room,false);
    assert.ok([...layer.actors.values()].every(actor=>!actor.target&&!actor.station&&actor.action==='idle'&&actor.mode==='auto'));
  }finally{f.close();}
});

test('navigation overlay, actual Three.js room walls and stationary reduced-motion poses remain available',()=>{
  const f=fixture();try{
    assert.ok(f.layer.architecture?.isGroup,'the room is real geometry in the shared scene');
    assert.ok(f.layer.wallMeshes.length>=4);
    assert.ok(f.layer.wallMeshes.every(mesh=>mesh.material.colorWrite!==false));
    assert.equal(f.layer.toggleNavigation(),true);
    assert.equal(f.root.querySelector('.hy-navigation-map').hasAttribute('hidden'),false);
    assert.equal(f.root.querySelectorAll('.hy-navigation-map circle').length,f.layer.navigation.stations.length);
    const first=[...f.layer.actors.values()][0],position={...first.position};
    f.layer.step(30,{staticPose:true});
    assert.equal(first.action,'sitting');assert.deepEqual(first.position,position);
  }finally{f.close();}
});

test('moved chairs define seats, removed chairs cannot produce floating seated people',()=>{
  const f=fixture();try{
    const desk=f.room.objects.find(o=>o.kind==='work-desk');
    const station=f.layer.navigation.stations.find(s=>s.objectId===desk.id);
    assert.ok(station.seatObjectId);
    const chair=f.room.objects.find(o=>o.id===station.seatObjectId);
    chair.x+=.5;
    f.layer.sync(f.room,false);f.layer.sync(f.room,true);
    const moved=f.layer.navigation.stations.find(s=>s.objectId===desk.id);
    assert.equal(moved.seat.x,chair.x);
    f.room.objects=f.room.objects.filter(o=>o.kind!=='task-chair');
    f.layer.sync(f.room,false);f.layer.sync(f.room,true);
    assert.ok([...f.layer.actors.values()].every(actor=>actor.action!=='seated'));
    assert.equal(f.layer.navigation.isWalkable({x:37,y:76}),false,'the whiteboard blocks walking');
  }finally{f.close();}
});

test('explicit walking trip remains on safe paths without automatically sitting or drinking',()=>{
  const f=fixture();try{
    const actor=[...f.layer.actors.values()][0];
    assert.equal(f.layer.setMode(actor.id,'walking'),true);
    let positions=new Set();
    for(let tick=0;tick<900;tick++){
      f.layer.step(tick/10);
      assert.ok(['walking','idle'].includes(actor.action));
      assert.equal(f.layer.navigation.isWalkable(actor.position,{ignoreIds:actor.ignoreIds||[]}),true);
      positions.add(`${Math.round(actor.position.x)},${Math.round(actor.position.y)}`);
    }
    assert.ok(positions.size>15);
    assert.equal(actor.mode,'walking');
  }finally{f.close();}
});
test('wayfinding arrow is real ground geometry sharing the Office depth buffer',()=>{
  assert.equal(isOfficeModel('wayfinding-arrow'),true);
});
