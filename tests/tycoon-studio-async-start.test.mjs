import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {TycoonStudio} from '../web/tycoon-studio.js';

function setup(){
  const dom=new JSDOM('<main></main>',{url:'http://localhost'});globalThis.document=dom.window.document;
  const pending=[];
  class Scene{
    constructor(){this.stopCount=0;}
    setScene(){}
    stopTest(){this.stopCount++;}
    startStationAsync(id,options){return new Promise(resolve=>pending.push({id,options,resolve}));}
    dispose(){}
  }
  const editor=new TycoonStudio(document.querySelector('main'),{floor:'projects',storage:dom.window.localStorage,Scene});
  return {dom,editor,pending,close(){editor.dispose();dom.window.close();}};
}

test('Studio exposes pending station preparation and resolves only after the scene finishes',async()=>{
  const f=setup();try{
    const pending=f.editor.testStation('desk-1');
    assert.equal(typeof pending?.then,'function','Studio returns the real asynchronous completion');
    assert.match(f.editor.q('[data-probe-status]').textContent,/กำลังเตรียม/,'pending is visible and never reports success early');
    assert.equal(f.pending[0].id,'desk-1');
    f.pending[0].resolve({ok:true,message:'station completed'});
    assert.deepEqual(await pending,{ok:true,message:'station completed'});
    assert.equal(f.editor.q('[data-probe-status]').textContent,'station completed');
  }finally{f.close();}
});

test('late station completions cannot overwrite Stop, edits, Undo, Redo, floor loads or disposal',async()=>{
  const cases=[
    ['Stop',editor=>editor.stopTest()],
    ['edit',editor=>editor.change(room=>{room.objects[0].x+=.1;})],
    ['Undo',editor=>{editor.change(room=>{room.objects[0].x+=.1;});editor.undo();}],
    ['Redo',editor=>{editor.change(room=>{room.objects[0].x+=.1;});editor.undo();editor.redo();}],
    ['floor load',editor=>editor.load('growth')],
    ['disposal',editor=>editor.dispose()],
  ];
  for(const [label,invalidate] of cases){
    const f=setup();try{
      const status=f.editor.q('[data-probe-status]'),pending=f.editor.testStation('desk-1');
      assert.equal(typeof pending?.then,'function',`${label} case has a pending station request`);
      invalidate(f.editor);const afterInvalidation=status.textContent;
      f.pending[0].resolve({ok:true,message:'stale success'});await pending;
      assert.equal(status.textContent,afterInvalidation,`${label} must suppress stale success status`);
    }finally{f.close();}
  }
});

test('a newer station start suppresses an older completion without hiding the newer pending state',async()=>{
  const f=setup();try{
    const first=f.editor.testStation('desk-1'),second=f.editor.testStation('sofa-1');
    assert.equal(f.pending.length,2);
    f.pending[0].resolve({ok:true,message:'old station completed'});await first;
    assert.match(f.editor.q('[data-probe-status]').textContent,/กำลังเตรียม/);
    f.pending[1].resolve({ok:true,message:'new station completed'});await second;
    assert.equal(f.editor.q('[data-probe-status]').textContent,'new station completed');
  }finally{f.close();}
});

test('Studio navigation test awaits selected-station completion instead of settling on submission',async()=>{
  const f=setup();try{
    f.editor.q('[data-tool="navigation"]').click();
    const target=f.editor.q('[data-nav-target]');target.value='station:desk-1';target.dispatchEvent(new f.dom.window.Event('change'));
    f.editor.q('[data-nav-test]').click();
    assert.equal(f.pending.length,1);
    assert.match(f.editor.q('[data-nav-status]').textContent,/กำลังทดสอบ/);
    f.pending[0].resolve({ok:true,message:'seat test completed'});await new Promise(setImmediate);
    assert.equal(f.editor.q('[data-nav-status]').textContent,'seat test completed');
  }finally{f.close();}
});

test('Studio preparation uses background tasks without publishing completion before the real scene result',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'scheduler'),calls=[],scheduler={postTask(callback,options){assert.equal(this,scheduler,'native scheduler receiver is preserved');calls.push(options.priority);return Promise.resolve(callback());},yield(){throw Error('boosted continuations must not starve rendering');}};
 Object.defineProperty(globalThis,'scheduler',{value:scheduler,configurable:true});const f=setup();
 try{const done=f.editor.testStation('desk-1');assert.equal(typeof f.pending[0].options?.yieldTurn,'function');await f.pending[0].options.yieldTurn();assert.deepEqual(calls,['background']);assert.match(f.editor.q('[data-probe-status]').textContent,/กำลังเตรียม/);f.pending[0].resolve({ok:true,message:'real completion'});await done;assert.equal(f.editor.q('[data-probe-status]').textContent,'real completion');}
 finally{f.close();if(descriptor)Object.defineProperty(globalThis,'scheduler',descriptor);else delete globalThis.scheduler;}
});

test('Studio preparation falls back to a timer when background scheduling is unavailable',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'scheduler');Object.defineProperty(globalThis,'scheduler',{value:{yield(){throw Error('do not use boosted continuation fallback');}},configurable:true});const f=setup();
 try{const done=f.editor.testStation('desk-1');let resumed=false;const turn=f.pending[0].options.yieldTurn().then(()=>resumed=true);assert.equal(resumed,false);await turn;assert.equal(resumed,true);assert.match(f.editor.q('[data-probe-status]').textContent,/กำลังเตรียม/);f.pending[0].resolve({ok:true,message:'completed'});await done;}
 finally{f.close();if(descriptor)Object.defineProperty(globalThis,'scheduler',descriptor);else delete globalThis.scheduler;}
});
