import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSeatFitSearch} from '../web/tycoon-seat-fit.js';

test('cold seat fitting looks up its long geometry prefix once per root search',()=>{
  const probe={restPelvis:1,legs:[{a:.5,b:.5,x:0,ankleY:0,hipOffset:new THREE.Vector3(),ankleRest:new THREE.Quaternion(),
    shoe:{a:new THREE.Vector3(),b:new THREE.Vector3(.1,0,0),radius:.1}}],
  footReachAtAnchor:()=>({ok:true,legs:[{ok:true,requiredM:.5}]}),
  shoeCapsulesAtAnchor:anchor=>[{name:'left-shoe',side:'left',start:anchor.clone(),end:anchor.clone(),radius:.1}]};
  let geometryCalls=0;
  const world={inspectCapsules(){
    geometryCalls++;
    return {ok:false,minClearanceM:-.02,hit:{objectId:'fixed-chair-triangle',clearanceM:-.02}};
  }};
  const search=createSeatFitSearch(probe,world),options={point:new THREE.Vector3(),root:new THREE.Vector3(.2,.5,.3),heading:0,seatHeight:.5,
    seatExtent:.01,chairExtent:.2,shoeRear:.1,front:new THREE.Vector3(1,0,0),clearanceM:.005,stepM:.005,maxDistance:.04};
  let longStringLookups=0,numericLookups=0;
  const originalGet=Map.prototype.get;
  Map.prototype.get=function(key){if(typeof key==='string'&&key.length>64)longStringLookups++;if(typeof key==='number')numericLookups++;return originalGet.call(this,key);};
  try{
    const first=search(options),firstGeometryCalls=geometryCalls;
    assert.equal(first.selected,null,'the fixture leaves every candidate blocked');
    assert.ok(first.candidates>0,'the real search examines reachable candidates');
    assert.equal(longStringLookups,1,'one long rig/anchor prefix lookup scopes the first search');
    assert.ok(numericLookups>=first.candidates,'candidate lookups use compact numeric shape and distance keys');

    const second=search({...options,root:new THREE.Vector3(.22,.5,.3)});
    assert.equal(second.selected,null);
    assert.equal(second.geometryQueries,0,'the shifted root reuses exact shoe geometry checks independent of leg reach');
    assert.equal(geometryCalls,firstGeometryCalls);
    assert.equal(longStringLookups,2,'the long prefix is looked up once again for the second root');
    assert.ok(numericLookups>=first.candidates+second.candidates);
  }finally{Map.prototype.get=originalGet;}
});
