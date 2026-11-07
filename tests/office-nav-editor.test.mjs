import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {OfficeNavigationEditor} from '../web/office-nav-editor.js';
import {departmentStarterRoom} from '../web/hybrid-state.js';

function setup({onTest=points=>({ok:points.length>=2,message:'running'})}={}){
  const dom=new JSDOM('<section id="panel"></section><div id="stage"></div>');
  const panel=dom.window.document.querySelector('#panel'),stage=dom.window.document.querySelector('#stage');
  stage.getBoundingClientRect=()=>({left:100,top:50,width:1000,height:600});
  let room=departmentStarterRoom({number:1,roles:[{id:'a'}]});
  const changes=[];
  const editor=new OfficeNavigationEditor(panel,{stage,onChange:n=>{changes.push(n);room={...room,navigation:n};editor.render(room,true);},onTest});
  editor.render(room,true);
  return {dom,panel,stage,editor,changes,get room(){return room;},close(){editor.dispose();dom.window.close();}};
}

test('navigation editor authors routes/areas and moves points with keyboard without touching furniture',()=>{
  const f=setup();try{
    const objects=JSON.stringify(f.room.objects);
    f.panel.querySelector('[data-nav-new-route]').click();
    assert.equal(f.room.navigation.routes.length,1);
    const before=f.room.navigation.routes[0].points[0].x;
    f.stage.querySelector('[data-nav-handle]').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    assert.equal(f.room.navigation.routes[0].points[0].x,before+1);
    f.panel.querySelector('[data-nav-new-area]').click();
    assert.equal(f.room.navigation.forbidden[0].points.length,4);
    assert.equal(JSON.stringify(f.room.objects),objects);
    f.panel.querySelector('[data-nav-delete]').click();
    assert.equal(f.room.navigation.forbidden.length,0);
  }finally{f.close();}
});

test('deleted route and forbidden-zone IDs stay retired while recreated geometry keeps its points',()=>{
  const f=setup();try{
    f.panel.querySelector('[data-nav-new-route]').click();const firstRoute=structuredClone(f.room.navigation.routes[0]);
    assert.match(firstRoute.id,/^route-[a-f0-9]{32}$/);assert.ok(firstRoute.id.length<=60);
    f.panel.querySelector('[data-nav-delete]').click();f.panel.querySelector('[data-nav-new-route]').click();
    const secondRoute=f.room.navigation.routes[0];assert.notEqual(secondRoute.id,firstRoute.id);assert.deepEqual(secondRoute.points,firstRoute.points);

    f.panel.querySelector('[data-nav-new-area]').click();const firstZone=structuredClone(f.room.navigation.forbidden[0]);
    assert.match(firstZone.id,/^area-[a-f0-9]{32}$/);assert.ok(firstZone.id.length<=60);
    f.panel.querySelector('[data-nav-delete]').click();f.panel.querySelector('[data-nav-new-area]').click();
    const secondZone=f.room.navigation.forbidden[0];assert.notEqual(secondZone.id,firstZone.id);assert.deepEqual(secondZone.points,firstZone.points);
  }finally{f.close();}
});

test('drag coordinates use the real scaled stage bounds and cancellation never commits',()=>{
  const f=setup();try{
    f.panel.querySelector('[data-nav-new-route]').click();
    const dispatch=(type,x,y)=>{const event=new f.dom.window.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});Object.defineProperty(event,'pointerId',{value:7});return event;};
    const handle=f.stage.querySelector('[data-nav-handle]');
    handle.dispatchEvent(dispatch('pointerdown',530,320));
    f.editor.svg.dispatchEvent(dispatch('pointermove',550,332));
    f.editor.svg.dispatchEvent(dispatch('pointerup',550,332));
    const p=f.room.navigation.routes[0].points[0];
    assert.equal(p.x,45);assert.equal(p.y,50);
    const count=f.changes.length;
    f.stage.querySelector('[data-nav-handle]').dispatchEvent(dispatch('pointerdown',550,332));
    f.editor.svg.dispatchEvent(dispatch('pointermove',800,500));
    f.editor.svg.dispatchEvent(dispatch('pointercancel',800,500));
    assert.equal(f.changes.length,count);
  }finally{f.close();}
});

test('walk test and stop controls are explicit, and closing editor releases its overlay',async()=>{
  const f=setup();try{
    f.panel.querySelector('[data-nav-new-route]').click();
    f.panel.querySelector('[data-nav-test]').click();
    await new Promise(setImmediate);
    assert.match(f.panel.querySelector('[data-nav-status]').textContent,/running/);
    f.editor.render(f.room,false);
    assert.equal(f.editor.svg.hidden,true);
  }finally{f.close();}
});

test('navigation editor awaits an asynchronous test result before publishing its status',async()=>{
  let resolve;const f=setup({onTest:()=>new Promise(r=>resolve=r)});try{
    f.panel.querySelector('[data-nav-new-route]').click();
    f.panel.querySelector('[data-nav-test]').click();
    assert.match(f.panel.querySelector('[data-nav-status]').textContent,/กำลังทดสอบ/);
    resolve({ok:true,message:'completed'});await new Promise(setImmediate);
    assert.equal(f.panel.querySelector('[data-nav-status]').textContent,'completed');
  }finally{f.close();}
});

test('navigation editor Stop suppresses a late asynchronous test result',async()=>{
  let resolve;const f=setup({onTest:()=>new Promise(r=>resolve=r)});try{
    f.panel.querySelector('[data-nav-new-route]').click();
    f.panel.querySelector('[data-nav-test]').click();
    assert.match(f.panel.querySelector('[data-nav-status]').textContent,/กำลังทดสอบ/);
    f.panel.querySelector('[data-nav-stop]').click();
    const stopped=f.panel.querySelector('[data-nav-status]').textContent;
    resolve({ok:true,message:'stale completion'});await new Promise(setImmediate);
    assert.equal(f.panel.querySelector('[data-nav-status]').textContent,stopped);
  }finally{f.close();}
});

test('a prop without a generated approach still offers a draggable seed to repair it',()=>{
  const f=setup();try{
    const room=JSON.parse(JSON.stringify(f.room)),desk=room.objects.find(o=>o.kind==='work-desk');desk.x=92;desk.y=40;
    f.editor.render(room,true);
    const select=f.panel.querySelector('[data-nav-target]');select.value=`station:${desk.id}`;select.dispatchEvent(new f.dom.window.Event('change'));
    assert.ok(f.stage.querySelector('[data-nav-handle]'));
    assert.match(f.panel.querySelector('[data-nav-status]').textContent,/ลาก/);
  }finally{f.close();}
});
