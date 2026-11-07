import test from 'node:test';
import assert from 'node:assert/strict';
import {TycoonScene} from '../web/tycoon-scene.js';
import {createTycoonRoom} from '../web/tycoon-state.js';

async function waitFor(predicate){
  for(let attempt=0;attempt<100;attempt++){
    if(predicate())return;
    await new Promise(setImmediate);
  }
  assert.fail('scene did not reach renderer-program preparation');
}

test('scene readiness waits for current render preparation and an old generation cannot publish readiness',async()=>{
  let ready=false,compileCalls=0,reflections=0;const errors=[],listeners=new Set();
  const material={},program={isReady:()=>ready,getUniforms(){reflections++;return {};}};
  const canvas={addEventListener(_name,listener){listeners.add(listener);},removeEventListener(_name,listener){listeners.delete(listener);},loseContext(){for(const listener of [...listeners])listener();}};
  const fake={
    sceneGeneration:0,disposed:false,ready:false,stage:{visible:false},
    renderer:{domElement:canvas,compile(){compileCalls++;return [material];},properties:{get:()=>({currentProgram:program})},
      extensions:{has:()=>true},render(){},clear(){},getRenderTarget:()=>null,setRenderTarget(){},getScissorTest:()=>false,setScissorTest(){},getContext:()=>({isContextLost:()=>false,SYNC_GPU_COMMANDS_COMPLETE:1,ALREADY_SIGNALED:2,CONDITION_SATISFIED:3,TIMEOUT_EXPIRED:4,WAIT_FAILED:5,fenceSync:()=>({}),flush(){},clientWaitSync:()=>2,deleteSync(){}})},
    editor:{cancel(){},highlight(){}},assembly:{owned:[],replace:async()=>{}},
    reset(){},fit(){},onError(message){errors.push(message);},
  };
  const room=createTycoonRoom('projects');
  const first=TycoonScene.prototype.setScene.call(fake,'projects',room,{preserveCamera:true,allowProbe:false});
  await waitFor(()=>compileCalls===1);
  assert.equal(fake.ready,false,'readiness remains gated while the current shader program is compiling');

  ready=true;
  const second=TycoonScene.prototype.setScene.call(fake,'projects',room,{preserveCamera:true,allowProbe:false});
  await second;
  assert.equal(fake.ready,true,'the replacement generation becomes ready after its compile check');
  assert.equal(fake.renderPreparationDiagnostics?.completed,true);

  canvas.loseContext();
  await first;
  assert.equal(fake.ready,true,'the stale generation cannot publish readiness over the replacement');
  assert.equal(fake.renderPreparationDiagnostics?.completed,true,'stale diagnostics do not replace the current result');
  assert.equal(reflections,1,'only the current generation prepares the uniform/attribute cache');
  assert.deepEqual(errors,[],'context loss from a stale generation stays silent');
});

test('current context loss reports recovery guidance and leaves the scene unready',async()=>{
  let contextLost=false;const errors=[],listeners=new Set();
  const canvas={addEventListener(_name,listener){listeners.add(listener);},removeEventListener(_name,listener){listeners.delete(listener);},loseContext(){contextLost=true;for(const listener of [...listeners])listener();}};
  const program={isReady(){canvas.loseContext();return false;}};
  const fake={
    sceneGeneration:0,disposed:false,ready:false,
    renderer:{domElement:canvas,compile(){return [{}];},properties:{get:()=>({currentProgram:program})},
      extensions:{has:()=>true},getContext:()=>({isContextLost:()=>contextLost})},
    editor:{cancel(){},highlight(){}},assembly:{owned:[],replace:async()=>{}},
    reset(){},fit(){},onError(message){errors.push(message);},
  };
  await TycoonScene.prototype.setScene.call(fake,'projects',createTycoonRoom('projects'),{preserveCamera:true,allowProbe:false});
  assert.equal(fake.ready,false,'a context-lost scene is never marked ready');
  assert.equal(fake.renderPreparationDiagnostics?.reason,'context-lost');
  assert.equal(errors.length,1);
  assert.match(errors[0],/3D.*เปิดฉากใหม่หรือรีเฟรชหน้า/,'the message gives the user a recovery action');
  assert.equal(listeners.size,0,'the renderer context listener is removed after cancellation');
});

function drawGateFixture(){
 const canvas=new EventTarget(),errors=[];let fences=0,complete=false;
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,ALREADY_SIGNALED:2,CONDITION_SATISFIED:3,TIMEOUT_EXPIRED:4,WAIT_FAILED:5,isContextLost:()=>false,fenceSync:()=>({id:++fences}),flush(){},clientWaitSync:sync=>complete||sync.id>1?2:4,deleteSync(){}};
 const fake={sceneGeneration:0,disposed:false,ready:false,stage:{visible:false},scene:{},camera:{},
 renderer:{domElement:canvas,shadowMap:{enabled:false},compile:()=>[{}],properties:{get:()=>({currentProgram:{isReady:()=>true,getUniforms(){}}})},extensions:{has:()=>true},getContext:()=>gl,render(){},clear(){},getRenderTarget:()=>null,setRenderTarget(){},getScissorTest:()=>false,setScissorTest(){}},
 editor:{cancel(){},highlight(){}},assembly:{owned:[],replace:async()=>{}},fit(){},onError:m=>errors.push(m)};
 return {fake,canvas,errors,fences:()=>fences,complete:()=>{complete=true;}};
}
test('scene remains hidden and unready until the actual draw completion fence succeeds',async()=>{
 const f=drawGateFixture(),pending=TycoonScene.prototype.setScene.call(f.fake,'building',null,{preserveCamera:true});
 await waitFor(()=>f.fences()===1);assert.equal(f.fake.ready,false);assert.equal(f.fake.stage.visible,false);
 f.complete();await pending;assert.equal(f.fake.ready,true);assert.equal(f.fake.stage.visible,true);assert.equal(f.fake.renderPreparationDiagnostics.draw.completed,true);
});
test('replacement scene readiness and diagnostics survive a stale load waiting for its draw fence',async()=>{
 const f=drawGateFixture(),first=TycoonScene.prototype.setScene.call(f.fake,'building',null,{preserveCamera:true});await waitFor(()=>f.fences()===1);
 const second=TycoonScene.prototype.setScene.call(f.fake,'building',null,{preserveCamera:true});await second;
 const current=f.fake.renderPreparationDiagnostics;assert.equal(f.fake.ready,true);assert.equal(current.draw.completed,true);
 await first;assert.equal(f.fake.ready,true);assert.equal(f.fake.stage.visible,true);assert.equal(f.fake.renderPreparationDiagnostics,current);assert.deepEqual(f.errors,[]);
});
