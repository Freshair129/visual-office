import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {TYCOON_COORDINATE_BOUNDS,validateOfficeNavigation} from '../web/office-nav-state.js';
import {TYCOON_BLUEPRINT_OPTIONS} from '../web/office-design-limits.js';
import {createOfficeNavigation} from '../web/office-navigation.js';
import {OfficeNavigationEditor} from '../web/office-nav-editor.js';

const tycoonBounds={minX:-64,maxX:164,minY:-32,maxY:144};
const navigation=points=>({version:1,routes:[{id:'large-room',points}],forbidden:[],stations:[]});

test('explicit expanded bounds permit authored sofa seats beyond legacy0..100 coordinates',()=>{
 const blueprintPlan={version:1,base:'large',width:24,depth:16,originX:-14,originZ:-10,door:{wall:'front',offset:1.5,width:1.2},windows:[],partitions:[],areas:[]};
 const room={blueprint:'large',blueprintPlan,objects:[{id:'edge-sofa',kind:'team-sofa',x:-4,y:45,scale:.8}],navigation:{version:1,routes:[],forbidden:[],stations:[{objectId:'edge-sofa',approach:{x:4,y:45},seat:{x:-4,y:45}}]}};
 const nav=createOfficeNavigation(room,{coordinateBounds:TYCOON_COORDINATE_BOUNDS,blueprintOptions:TYCOON_BLUEPRINT_OPTIONS});
 assert.deepEqual(nav.issues,[]);assert.deepEqual(nav.stations.find(s=>s.objectId==='edge-sofa')?.seat,{x:-4,y:45});
});

test('Tycoon navigation accepts projected room-edge points only when expanded bounds are explicit',()=>{
  const config=navigation([{x:-21,y:-1},{x:121,y:109}]);
  assert.throws(()=>validateOfficeNavigation(config),/0\.\.100/);
  assert.deepEqual(validateOfficeNavigation(config,[],{coordinateBounds:tycoonBounds}),config);
  assert.deepEqual(validateOfficeNavigation(navigation([{x:0,y:0},{x:100,y:100}])),navigation([{x:0,y:0},{x:100,y:100}]));
});

test('Tycoon navigation rejects non-finite points and coordinates outside its bounded envelope',()=>{
  for(const point of [
    {x:-64.01,y:0},{x:164.01,y:0},{x:0,y:-32.01},{x:0,y:144.01},
    {x:NaN,y:0},{x:0,y:Infinity},{x:-1e9,y:0},{x:0,y:1e9},
  ])assert.throws(()=>validateOfficeNavigation(navigation([point,{x:0,y:0}]),[],{coordinateBounds:tycoonBounds}));
  assert.throws(()=>validateOfficeNavigation(navigation([{x:-.01,y:50},{x:50,y:50}])));
  assert.throws(()=>validateOfficeNavigation(navigation([{x:100.01,y:50},{x:50,y:50}])));
});

test('Tycoon navigation editor maps clicks and numeric edits through its explicit coordinate bounds',t=>{
  const dom=new JSDOM('<main><div class="panel"></div><div class="stage"></div></main>');
  t.after(()=>dom.window.close());
  const root=dom.window.document.querySelector('.panel'),stage=dom.window.document.querySelector('.stage');
  stage.getBoundingClientRect=()=>({left:0,top:0,width:228,height:176});
  let committed;
  const editor=new OfficeNavigationEditor(root,{stage,coordinateBounds:tycoonBounds,onChange:value=>{committed=value;},navigationFactory:()=>({zones:[],blockers:[],stations:[],issues:[]})});
  t.after(()=>editor.dispose());
  editor.render({background:'office',objects:[],navigation:navigation([{x:-21,y:-1},{x:121,y:109}])},true);

  assert.equal(editor.svg.getAttribute('viewBox'),'-64 -32 228 176');
  assert.deepEqual(editor.screenPoint({clientX:43,clientY:31}),{x:-21,y:-1});
  editor.target='route:large-room';editor.selectedPoint=0;
  editor.editPoint(editor.screenPoint({clientX:44,clientY:32}));
  assert.deepEqual(committed.routes[0].points[0],{x:-20,y:0});
});

test('large Tycoon room pathfinding reaches negative and over-100 projected edges through an open partition door',()=>{
  const plan={version:1,base:'large',width:24,depth:16,originX:-14,originZ:-10,door:{wall:'front',offset:1.5,width:1.2},windows:[],
    partitions:[{id:'divider',axis:'x',at:8,start:0,end:24,door:{offset:5,width:1.2,open:true}}],areas:[]};
  const room={blueprint:'large',blueprintPlan:plan,objects:[],navigation:{version:1,routes:[],forbidden:[],stations:[]}};
  const nav=createOfficeNavigation(room,{objectBlockers:[],coordinateBounds:TYCOON_COORDINATE_BOUNDS,blueprintOptions:TYCOON_BLUEPRINT_OPTIONS});
  const from={x:-13.64,y:42.94},to={x:103.03,y:67.76};
  assert.equal(nav.isWalkable(from),true);
  assert.equal(nav.isWalkable(to),true);
  const path=nav.findLocalPath(from,to);
  assert.ok(path.length>2,'pathfinding must route around the partition through its opening');
  assert.ok(path.some(point=>point.x<0),'the path retains the legacy fixed projection at the left edge');
  assert.ok(path.some(point=>point.x>100),'the path reaches the right edge beyond the legacy normalized range');
  for(let i=1;i<path.length;i++)assert.equal(nav.isSegmentWalkable(path[i-1],path[i]),true);
});
