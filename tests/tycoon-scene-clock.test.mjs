import test from 'node:test';
import assert from 'node:assert/strict';
import {TycoonScene} from '../web/tycoon-scene.js';

test('switching to a scene without a probe releases the previous physics clock and world',async()=>{
  const scene={sceneGeneration:0,disposed:false,ready:true,probeClock:{activity:{},snapshot:{},world:{retained:true},remainder:.01},
    activity:{stop(){}},reset(){},assembly:{owned:[],async replace(){}}};
  await TycoonScene.prototype.setScene.call(scene,'building',null,{allowProbe:false});
  assert.equal(scene.ready,true);
  assert.equal(scene.probeClock,null);
  assert.equal(scene.collisionWorld,null);
});
