import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {JSDOM} from 'jsdom';
import {defaultBlueprintPlan,validateBlueprintPlan,moveBlueprintWall,BlueprintTemplateStore,BLUEPRINT_TEMPLATES_KEY,TYCOON_BLUEPRINT_TEMPLATES_KEY} from '../web/office-blueprint-state.js';
import {blueprintPoint,blueprintLocalPoint,blueprintLayout} from '../web/office-blueprints.js';
import {TYCOON_BLUEPRINT_OPTIONS} from '../web/office-design-limits.js';
import {OfficeBlueprintEditor} from '../web/office-blueprint-editor.js';
import {TycoonScene} from '../web/tycoon-scene.js';
import {officeCamera} from '../web/office-projection.js';

const large=()=>({...defaultBlueprintPlan('large'),width:24,depth:16,originX:-14,originZ:-10});
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};

test('larger metric plans require an explicit Tycoon profile and retain the fixed coordinate translation',()=>{
  const plan=large();assert.throws(()=>validateBlueprintPlan(plan));
  assert.deepEqual(validateBlueprintPlan(plan,TYCOON_BLUEPRINT_OPTIONS),plan);
  for(const x of [0,12,24])for(const z of [0,8,16]){
    const point=blueprintPoint(plan,x,z,TYCOON_BLUEPRINT_OPTIONS),local=blueprintLocalPoint(plan,point,TYCOON_BLUEPRINT_OPTIONS);
    assert.ok(Math.abs(local.x-x)<1e-8&&Math.abs(local.z-z)<1e-8);
  }
  assert.equal(blueprintLayout(plan,TYCOON_BLUEPRINT_OPTIONS).blueprint.width,24);
  assert.throws(()=>moveBlueprintWall(plan,'right',.1,TYCOON_BLUEPRINT_OPTIONS));
  assert.throws(()=>validateBlueprintPlan({...plan,depth:16.1},TYCOON_BLUEPRINT_OPTIONS));
  assert.throws(()=>validateBlueprintPlan({...plan,width:NaN},TYCOON_BLUEPRINT_OPTIONS));
});

test('Tycoon template saves preserve the older editor collection byte for byte',()=>{
  const storage=memory(),legacy=new BlueprintTemplateStore(storage);
  assert.ok(legacy.save('Original team',defaultBlueprintPlan('medium')).ok);
  const original=storage.getItem(BLUEPRINT_TEMPLATES_KEY),metric=new BlueprintTemplateStore(storage,TYCOON_BLUEPRINT_OPTIONS);
  assert.equal(metric.items.length,1,'existing templates remain available without a write');
  assert.equal(storage.getItem(TYCOON_BLUEPRINT_TEMPLATES_KEY),null);
  assert.ok(metric.save('Department plan',large()).ok);
  const metricBytes=storage.getItem(TYCOON_BLUEPRINT_TEMPLATES_KEY);
  assert.equal(storage.getItem(BLUEPRINT_TEMPLATES_KEY),original);
  assert.equal(new BlueprintTemplateStore(storage).items.length,1);
  assert.equal(new BlueprintTemplateStore(storage,TYCOON_BLUEPRINT_OPTIONS).items.length,2);
  assert.ok(new BlueprintTemplateStore(storage).save('Other small plan',defaultBlueprintPlan('small')).ok);
  assert.equal(storage.getItem(TYCOON_BLUEPRINT_TEMPLATES_KEY),metricBytes);
});

test('metric blueprint editing renders and commits a larger plan without using legacy limits',()=>{
  const dom=new JSDOM('<main><div id="tools"></div><div id="map"></div></main>'),doc=dom.window.document,commits=[];
  const editor=new OfficeBlueprintEditor(doc.querySelector('#tools'),{surface:doc.querySelector('#map'),storage:memory(),blueprintOptions:TYCOON_BLUEPRINT_OPTIONS,onCommit:plan=>commits.push(plan)});
  editor.render({blueprint:'large',blueprintPlan:large(),objects:[]},true);
  const width=doc.querySelector('.hy-bp-width'),depth=doc.querySelector('.hy-bp-depth');
  assert.equal(width.max,'24');assert.equal(depth.max,'16');
  assert.match(doc.querySelector('#map').textContent,/24 m/);
  width.value='23.5';width.dispatchEvent(new dom.window.Event('change'));
  assert.equal(commits.length,1);assert.equal(commits[0].width,23.5);assert.equal(commits[0].depth,16);
  editor.dispose();dom.window.close();
});

test('the production isometric camera contains every 24 by 16 floor and wall corner at reset',()=>{
  for(const [width,height] of [[1440,1000],[1920,900],[390,844]]){
    const camera=officeCamera(),room={width:24,depth:16,blueprintPlan:large()},scene={root:{getBoundingClientRect:()=>({width,height})},camera,room,kind:'projects',scale:1,pan:new THREE.Vector3()};
    TycoonScene.prototype.fit.call(scene);camera.updateMatrixWorld(true);
    for(const x of [-12,12])for(const z of [-8,8])for(const y of [0,2.8]){
      const point=new THREE.Vector3(x,y,z).project(camera);
      assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1,`${width}x${height}: clipped ${x}/${y}/${z}: ${point.toArray()}`);
    }
    room.blueprintPlan.areas=[{id:'quiet-room',type:'work',name:'Quiet room',x:1,z:1,width:5,depth:4}];
    scene.fit=()=>TycoonScene.prototype.fit.call(scene);
    assert.equal(TycoonScene.prototype.focusArea.call(scene,'quiet-room').ok,true);camera.updateMatrixWorld(true);
    const focus=new THREE.Vector3(-8.5,.4,-5).project(camera);assert.ok(Math.abs(focus.x)<1e-8&&Math.abs(focus.y)<1e-8);
    assert.equal(TycoonScene.prototype.focusArea.call(scene,'unknown').ok,false);
  }
});
