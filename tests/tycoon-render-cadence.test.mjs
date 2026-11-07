import test from 'node:test';
import assert from 'node:assert/strict';
import {TycoonScene} from '../web/tycoon-scene.js';
import {FramePacer} from '../web/tycoon-frame-pacer.js';

// Break caught: variable solve work before a30Hz draw makes submission spacing
// vary even with punctual display callbacks. Render must consume the already
// committed pose; fixed-step time still goes into the following solve.
function fixture(rate){
 let cpu=0,pose=0;const draws=[],steps=[],actor={userData:{instanceId:'demo-agent'}};
 const scene={disposed:false,scene:{},camera:{},assembly:{owned:[actor]},framePacer:new FramePacer(rate),
  renderer:{render(){draws.push({cpu,pose});}},updateProbe(a,dt){assert.equal(a,actor);steps.push(dt);cpu+=steps.length===1?11:2;pose++;}};
 return {scene,draws,steps,at(ms){cpu=ms;TycoonScene.prototype.renderFrame.call(scene,ms);}};
}
test('30FPS submits the committed pose before variable solve cost and preserves elapsed simulation',()=>{
 const f=fixture(30);f.at(0);f.at(100/3);f.at(200/3);
 assert.deepEqual(f.draws,[{cpu:0,pose:0},{cpu:100/3,pose:1},{cpu:200/3,pose:2}]);
 assert.deepEqual(f.steps,[0,1/30,1/30]);
});
test('native display mode keeps update-before-render and30FPS skips do not advance physics',()=>{
 const native=fixture(0);native.at(0);assert.deepEqual(native.draws,[{cpu:11,pose:1}]);
 const capped=fixture(30);capped.at(0);capped.at(16.67);assert.equal(capped.draws.length,1);assert.equal(capped.steps.length,1);
 capped.at(33.34);assert.equal(capped.draws.length,2);assert.ok(Math.abs(capped.steps[1]-.03334)<1e-12);
});
test('disposed callbacks neither draw nor solve; scenes without a probe still draw normally',()=>{
 const f=fixture(30);f.scene.disposed=true;f.at(0);assert.deepEqual(f.draws,[]);assert.deepEqual(f.steps,[]);
 f.scene.disposed=false;f.scene.assembly.owned=[];f.at(0);assert.deepEqual(f.draws,[{cpu:0,pose:0}]);assert.deepEqual(f.steps,[]);
});
test('handoff pauses scene draws and resumes without accumulating elapsed simulation',()=>{
 const f=fixture(30);f.at(0);const resume=TycoonScene.prototype.pauseForHandoff.call(f.scene);f.at(1000);assert.equal(f.draws.length,1);assert.deepEqual(f.steps,[0]);resume();resume();f.at(2000);assert.deepEqual(f.steps,[0,0]);assert.equal(f.draws.length,2);
});
test('reduced motion applies the stopped snapshot before any capped draw',()=>{
 const previous=globalThis.matchMedia,draws=[],actor={visible:true,userData:{instanceId:'demo-agent'}};
 const scene={disposed:false,assembly:{owned:[actor]},framePacer:new FramePacer(30),activity:{snapshot:{},stop(){this.snapshot=null;}},
  renderer:{render(){draws.push(actor.visible);}},updateProbe(){actor.visible=!!this.activity.snapshot;}};
 globalThis.matchMedia=()=>({matches:true});
 try{TycoonScene.prototype.renderFrame.call(scene,0);assert.deepEqual(draws,[false]);}
 finally{if(previous===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=previous;}
});
test('a failed capped draw does not discard the elapsed fixed-step time and still propagates the render error',()=>{
 const f=fixture(30);f.at(0);f.scene.renderer.render=()=>{throw Error('context draw failed');};
 assert.throws(()=>f.at(100/3),/context draw failed/);assert.deepEqual(f.steps,[0,1/30]);
});
test('a synchronous rate change during a solve cannot omit or duplicate its draw',()=>{
 for(const rate of [0,30]){const f=fixture(rate),update=f.scene.updateProbe;f.scene.updateProbe=(...args)=>{update(...args);f.scene.framePacer.setRate(rate===30?0:30);};f.at(0);assert.equal(f.draws.length,1);}
});
