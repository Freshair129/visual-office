import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector4} from 'three';
const module=await import('../web/tycoon-draw-preparation.js').catch(()=>null);
const prepare=(...args)=>{assert.equal(typeof module?.prepareTycoonHiddenDraw,'function');return module.prepareTycoonHiddenDraw(...args);};
function fixture(){
 const calls=[],stage={visible:false},actor={visible:false},canvas=new EventTarget(),rect=new Vector4(2,3,40,50);let status=0,target={name:'previous'},scissor=true;
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,ALREADY_SIGNALED:2,CONDITION_SATISFIED:3,TIMEOUT_EXPIRED:4,WAIT_FAILED:5,isContextLost:()=>false,
  fenceSync(){calls.push('fence');return {};},flush(){calls.push('flush');},clientWaitSync(sync,flags,timeout){assert.equal(timeout,0,'never block JavaScript waiting for GPU');return status?gl.CONDITION_SATISFIED:gl.TIMEOUT_EXPIRED;},deleteSync(){calls.push('delete');}};
 const renderer={domElement:canvas,getContext:()=>gl,getRenderTarget:()=>target,getActiveCubeFace:()=>2,getActiveMipmapLevel:()=>1,
  getScissor:out=>out.copy(rect),setScissor(x,y,z,w){if(x?.isVector4)rect.copy(x);else rect.set(x,y,z,w);},
  setRenderTarget(value,face,mip){target=value;calls.push(['target',value,face,mip]);},getScissorTest:()=>scissor,setScissorTest(v){scissor=v;calls.push(['scissor',v]);},
  render(){calls.push('draw');assert.equal(stage.visible,true);assert.equal(actor.visible,true);assert.equal(target,null);},clear(){calls.push('clear');assert.equal(stage.visible,false);assert.equal(actor.visible,false);assert.equal(scissor,false);}};
 return {calls,stage,actor,canvas,gl,renderer,target,scissor:()=>scissor,ready(){status=1;}};
}
test('first draw is cleared and visibility/target/scissor restored before waiting for GPU completion',async()=>{
 const f=fixture();let turns=0;const result=await prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor,yieldTurn:async()=>{turns++;assert.equal(f.stage.visible,false);assert.equal(f.actor.visible,false);assert.equal(f.renderer.getRenderTarget(),f.target);assert.equal(f.scissor(),true);assert.ok(f.calls.includes('clear'));f.ready();}});
 assert.equal(result.completed,true);assert.equal(result.cancelled,false);assert.equal(result.submitted,true);assert.equal(turns,1);
 assert.ok(f.calls.indexOf('clear')<f.calls.indexOf('fence'));assert.deepEqual(f.calls.filter(c=>c==='delete'),['delete']);
});
test('hidden rehearsal bounds default-buffer fragments and restores the rectangle before its completion yield',async()=>{
 const f=fixture(),draw=f.renderer.render;f.renderer.render=()=>{draw();assert.deepEqual(f.renderer.getScissor(new Vector4()).toArray(),[0,0,1,1]);assert.equal(f.scissor(),true);};
 const result=await prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor,yieldTurn:async()=>{assert.deepEqual(f.renderer.getScissor(new Vector4()).toArray(),[2,3,40,50]);f.ready();}});
 assert.equal(result.completed,true);assert.equal(result.scissored,true);
});
test('draw and clear errors restore the default rectangle before rebinding a target-specific rectangle',async()=>{
 for(const key of ['render','clear']){const f=fixture();let active;
  const bind=f.renderer.setRenderTarget;f.target.scissor=new Vector4(7,8,9,10);f.renderer.setRenderTarget=(target,...args)=>{bind(target,...args);active=target?target.scissor.toArray():f.renderer.getScissor(new Vector4()).toArray();};
  f.renderer[key]=()=>{throw Error(key+' failed');};await assert.rejects(prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor}),new RegExp(key+' failed'));
  assert.deepEqual(f.renderer.getScissor(new Vector4()).toArray(),[2,3,40,50]);assert.deepEqual(active,[7,8,9,10]);
 }
});
test('supersession during GPU wait cancels without another poll or stale visibility publication',async()=>{
 const f=fixture();let current=true,polls=0;f.gl.clientWaitSync=()=>{polls++;return f.gl.TIMEOUT_EXPIRED;};
 const result=await prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor,isCurrent:()=>current,yieldTurn:async()=>{current=false;}});
 assert.equal(result.completed,false);assert.equal(result.cancelled,true);assert.equal(result.reason,'superseded');assert.equal(polls,1);assert.equal(f.stage.visible,false);assert.equal(f.actor.visible,false);assert.ok(f.calls.includes('delete'));
});
test('context loss and restoration during a yield permanently cancels this draw preparation',async()=>{
 const f=fixture();const result=await prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor,yieldTurn:async()=>{f.canvas.dispatchEvent(new Event('webglcontextlost'));f.canvas.dispatchEvent(new Event('webglcontextrestored'));f.ready();}});
 assert.equal(result.completed,false);assert.equal(result.cancelled,true);assert.equal(result.reason,'context-lost');assert.ok(f.calls.includes('delete'));
});
test('draw exception restores and clears synchronously and does not submit a completion fence',async()=>{
 const f=fixture();f.renderer.render=()=>{throw Error('draw failed');};await assert.rejects(prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor}),/draw failed/);
 assert.equal(f.stage.visible,false);assert.equal(f.actor.visible,false);assert.equal(f.renderer.getRenderTarget(),f.target);assert.equal(f.scissor(),true);assert.ok(f.calls.includes('clear'));assert.ok(!f.calls.includes('fence'));
});
test('unavailable or failed synchronization is reported incomplete and never becomes success',async()=>{
 for(const mode of ['missing','null-fence','wait-failed']){const f=fixture();if(mode==='missing')delete f.gl.fenceSync;if(mode==='null-fence')f.gl.fenceSync=()=>null;if(mode==='wait-failed')f.gl.clientWaitSync=()=>f.gl.WAIT_FAILED;
  const result=await prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor});assert.equal(result.completed,false,mode);assert.equal(result.cancelled,false,mode);assert.equal(f.stage.visible,false);assert.equal(f.actor.visible,false);
 }
});
test('timeout releases the fence, removes loss listener and reports incomplete instead of waiting forever',async()=>{
 const f=fixture();let now=0,adds=0,removes=0;const add=f.canvas.addEventListener.bind(f.canvas),remove=f.canvas.removeEventListener.bind(f.canvas);f.canvas.addEventListener=(...a)=>{adds++;add(...a);};f.canvas.removeEventListener=(...a)=>{removes++;remove(...a);};
 const result=await prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor,now:()=>now,maxWaitMs:20,yieldTurn:async()=>{now+=10;}});
 assert.equal(result.completed,false);assert.equal(result.reason,'gpu-draw-timeout');assert.equal(adds,1);assert.equal(removes,1);assert.ok(f.calls.includes('delete'));
});
test('a visible live stage or already superseded generation is never drawn or cleared',async()=>{
 for(const live of [true,false]){const f=fixture();f.stage.visible=live;const result=await prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor,isCurrent:()=>live});assert.equal(result.completed,false);assert.ok(!f.calls.includes('draw'));assert.ok(!f.calls.includes('clear'));}
});
test('restoring a non-default target preserves its scissor state independently of the renderer default',async()=>{
 const f=fixture();f.target.scissorTest=false;let activeScissor=false;
 const setTarget=f.renderer.setRenderTarget,setScissor=f.renderer.setScissorTest;
 f.renderer.setRenderTarget=(target,...args)=>{setTarget(target,...args);activeScissor=target?target.scissorTest:f.scissor();};
 f.renderer.setScissorTest=value=>{setScissor(value);activeScissor=value;};f.ready();
 const result=await prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor});assert.equal(result.completed,true);
 assert.equal(f.scissor(),true,'renderer default remains true');assert.equal(activeScissor,false,'bound target keeps its own false scissor state');
});
test('a clear failure still restores visibility, global scissor and previous target and removes its listener',async()=>{
 const f=fixture();let listeners=0;const add=f.canvas.addEventListener.bind(f.canvas),remove=f.canvas.removeEventListener.bind(f.canvas);f.canvas.addEventListener=(...a)=>{listeners++;add(...a);};f.canvas.removeEventListener=(...a)=>{listeners--;remove(...a);};
 f.renderer.clear=()=>{throw Error('clear failed');};await assert.rejects(prepare(f.renderer,{}, {},{stage:f.stage,actor:f.actor}),/clear failed/);
 assert.equal(f.stage.visible,false);assert.equal(f.actor.visible,false);assert.equal(f.renderer.getRenderTarget(),f.target);assert.equal(f.scissor(),true);assert.equal(listeners,0);assert.ok(!f.calls.includes('fence'));
});
