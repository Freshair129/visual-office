import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {OfficeBlueprintEditor} from '../web/office-blueprint-editor.js';
import {defaultBlueprintPlan} from '../web/office-blueprint-state.js';
import {applyOfficeBlueprint} from '../web/office-blueprints.js';
import {blueprintPoint} from '../web/office-blueprints.js';

function setup(t){
  const dom=new JSDOM('<div id="controls"></div><div id="plan"></div>',{url:'https://studio.test'});t.after(()=>dom.window.close());
  const doc=dom.window.document,root=doc.querySelector('#controls'),surface=doc.querySelector('#plan');
  dom.window.SVGElement.prototype.getBoundingClientRect=()=>({left:100,top:200,width:680,height:553});
  surface.setPointerCapture=()=>{};surface.hasPointerCapture=()=>false;
  let room=applyOfficeBlueprint({schemaVersion:'office-room/v1',name:'Example',brief:'',objects:[]},'medium');const commits=[],previews=[];
  const editor=new OfficeBlueprintEditor(root,{surface,storage:dom.window.localStorage,onCommit:plan=>{commits.push(plan);room={...room,blueprint:plan.base,blueprintPlan:plan};editor.render(room,true);},onPreview:p=>previews.push(p)});
  editor.render(room,true);t.after(()=>editor.dispose());
  const pointer=(target,type,x,y)=>{const e=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:x,clientY:y});target.dispatchEvent(e);};
  const change=(selector,value)=>{root.querySelector(selector).value=value;root.querySelector(selector).dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  return {dom,root,surface,editor,commits,previews,pointer,change,room:()=>room};
}
test('drag previews live, commits once at pointer-up, and cancellation restores without saving',t=>{
  const f=setup(t);f.pointer(f.surface.querySelector('[data-bp-handle="wall:right"]'),'pointerdown',728,444);f.pointer(f.surface,'pointermove',776,444);
  assert.equal(f.previews.at(-1).width,13);assert.equal(f.commits.length,0);assert.equal(f.room().blueprintPlan,undefined);
  f.pointer(f.surface,'pointerup',776,444);assert.equal(f.commits.length,1);assert.equal(f.room().blueprintPlan.width,13);
  const saved=JSON.stringify(f.room());f.pointer(f.surface.querySelector('[data-bp-handle="wall:right"]'),'pointerdown',728,444);f.pointer(f.surface,'pointermove',750,444);f.pointer(f.surface,'pointercancel',750,444);
  assert.equal(f.previews.at(-1),null);assert.equal(f.commits.length,1);assert.equal(JSON.stringify(f.room()),saved);
  f.pointer(f.surface.querySelector('[data-bp-handle="wall:right"]'),'pointerdown',728,444);f.pointer(f.surface,'pointermove',750,444);
  f.dom.window.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.equal(f.previews.at(-1),null);assert.equal(f.commits.length,1);assert.match(f.root.querySelector('.hy-bp-edit-status').textContent,/ยกเลิก/);
});
test('numeric, keyboard and wall selection edit actual geometry; named templates round-trip independently',t=>{
  const f=setup(t);f.change('.hy-bp-width','13');assert.equal(f.room().blueprintPlan.width,13);
  f.change('.hy-bp-target','door');f.change('.hy-bp-wall','right');f.change('.hy-bp-offset','3');
  assert.equal(f.room().blueprintPlan.door.wall,'right');assert.equal(f.room().blueprintPlan.door.offset,3);
  const handle=f.surface.querySelector('[data-bp-handle="door"]');handle.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(f.room().blueprintPlan.door.offset,3.1);
  f.change('.hy-bp-target','window:window-1');f.change('.hy-bp-wall','left');f.change('.hy-bp-offset','1');assert.equal(f.room().blueprintPlan.windows[0].wall,'left');
  const saved=JSON.stringify(f.room().blueprintPlan);f.root.querySelector('.hy-bp-template-name').value='My floor';f.root.querySelector('.hy-bp-template-save').click();
  assert.match(f.root.querySelector('.hy-bp-template-list').textContent,/My floor/);
  f.change('.hy-bp-width','14');f.root.querySelector('.hy-bp-template-load').click();assert.equal(JSON.stringify(f.room().blueprintPlan),saved);
  const before=JSON.stringify(f.room());f.change('.hy-bp-width','100');assert.equal(JSON.stringify(f.room()),before);assert.match(f.root.querySelector('.hy-bp-edit-status').textContent,/8–16/);
});
test('resize warning checks scaled oriented furniture footprints, not only object centers',t=>{
  const f=setup(t),plan=defaultBlueprintPlan('small');
  const room={schemaVersion:'office-room/v1',name:'Bounds',brief:'',background:'office',blueprint:'small',blueprintPlan:plan,
    objects:[{id:'edge-desk',kind:'work-desk',...blueprintPoint(plan,.3,3),scale:.62,flip:false,locked:false}]};
  f.editor.render(room,true);assert.match(f.root.querySelector('.hy-bp-warning').textContent,/1 ชิ้น/);
  room.objects[0]={...room.objects[0],...blueprintPoint(plan,.6,3),flip:true};f.editor.render(room,true);assert.equal(f.root.querySelector('.hy-bp-warning').textContent,'');
  room.objects[0].scale=1.24;f.editor.render(room,true);assert.match(f.root.querySelector('.hy-bp-warning').textContent,/1 ชิ้น/);
});

test('draw partitions atomically, add and move connecting doorway, and cancel new walls',t=>{
  const f=setup(t);assert.ok(f.root.querySelector('.hy-bp-draw-wall'));
  f.root.querySelector('.hy-bp-draw-wall').click();
  f.pointer(f.surface.querySelector('svg'),'pointerdown',392,252); // local (5,0)
  f.pointer(f.surface,'pointermove',392,636);assert.equal(f.commits.length,0);assert.equal(f.previews.at(-1).partitions[0].axis,'z');
  f.pointer(f.surface,'pointerup',392,636);assert.equal(f.commits.length,1);assert.equal(f.room().blueprintPlan.partitions[0].end,8);
  const partitionId=f.room().blueprintPlan.partitions[0].id;assert.match(partitionId,/^partition-[a-f0-9]{30}$/);
  f.root.querySelector('.hy-bp-add-inner-door').click();assert.equal(f.room().blueprintPlan.partitions[0].door.width,1.4);
  f.change('.hy-bp-inner-offset','4');assert.equal(f.room().blueprintPlan.partitions[0].door.offset,4);
  const handle=f.surface.querySelector(`[data-bp-handle="partition:${partitionId}:move"]`);f.pointer(handle,'pointerdown',392,444);f.pointer(f.surface,'pointermove',440,444);f.pointer(f.surface,'pointerup',440,444);
  assert.equal(f.room().blueprintPlan.partitions[0].at,6);
  const before=JSON.stringify(f.room()),count=f.commits.length;
  f.root.querySelector('.hy-bp-draw-wall').click();f.pointer(f.surface.querySelector('svg'),'pointerdown',248,348);f.pointer(f.surface,'pointermove',248,444);f.pointer(f.surface,'pointercancel',248,444);
  assert.equal(f.commits.length,count);assert.equal(JSON.stringify(f.room()),before);
});

test('draw typed room areas and save their names with walls in a structural template',t=>{
  const f=setup(t);assert.ok(f.root.querySelector('.hy-bp-draw-area'));
  f.root.querySelector('.hy-bp-area-type').value='rest';f.root.querySelector('.hy-bp-area-name').value='มุมพัก';f.root.querySelector('.hy-bp-draw-area').click();
  f.pointer(f.surface.querySelector('svg'),'pointerdown',176,276);f.pointer(f.surface,'pointermove',296,396);f.pointer(f.surface,'pointerup',296,396);
  const area=f.room().blueprintPlan.areas[0];assert.match(area.id,/^area-[a-f0-9]{32}$/);assert.deepEqual({...area,id:'area-id'},{id:'area-id',type:'rest',name:'มุมพัก',x:.5,z:.5,width:2.5,depth:2.5});
  f.root.querySelector('.hy-bp-template-name').value='พัก';f.root.querySelector('.hy-bp-template-save').click();
  assert.match(f.dom.window.localStorage.getItem('zuri-office:blueprint-templates:v1'),/มุมพัก/);
  f.root.querySelector('.hy-bp-delete-interior').click();assert.equal(f.room().blueprintPlan.areas.length,0);
  f.root.querySelector('.hy-bp-template-load').click();assert.equal(f.room().blueprintPlan.areas[0].name,'มุมพัก');
});

test('deleting and recreating blueprint openings, partitions and areas allocates fresh bounded IDs',t=>{
  const f=setup(t);
  f.change('.hy-bp-target','window:window-1');f.root.querySelector('.hy-bp-remove-window').click();f.root.querySelector('.hy-bp-add-window').click();
  const replacementWindow=f.room().blueprintPlan.windows.find(window=>window.id!=='window-2').id;
  assert.notEqual(replacementWindow,'window-1');assert.match(replacementWindow,/^window-[a-f0-9]{32}$/);assert.ok(replacementWindow.length<=40);

  const drawPartition=()=>{f.root.querySelector('.hy-bp-draw-wall').click();f.pointer(f.surface.querySelector('svg'),'pointerdown',392,252);f.pointer(f.surface,'pointermove',392,636);f.pointer(f.surface,'pointerup',392,636);return f.room().blueprintPlan.partitions.at(-1).id;};
  const firstPartition=drawPartition();f.root.querySelector('.hy-bp-delete-interior').click();const secondPartition=drawPartition();
  assert.notEqual(secondPartition,firstPartition);assert.match(secondPartition,/^partition-[a-f0-9]{30}$/);assert.ok(secondPartition.length<=40);

  const drawArea=()=>{f.root.querySelector('.hy-bp-area-type').value='rest';f.root.querySelector('.hy-bp-area-name').value='Desk lounge';f.root.querySelector('.hy-bp-draw-area').click();f.pointer(f.surface.querySelector('svg'),'pointerdown',176,276);f.pointer(f.surface,'pointermove',296,396);f.pointer(f.surface,'pointerup',296,396);return f.room().blueprintPlan.areas.at(-1).id;};
  const firstArea=drawArea();f.root.querySelector('.hy-bp-delete-interior').click();const secondArea=drawArea();
  assert.notEqual(secondArea,firstArea);assert.match(secondArea,/^area-[a-f0-9]{32}$/);assert.ok(secondArea.length<=40);
});

test('drawing on the thick boundary snaps inside instead of resizing an external wall',t=>{
  const f=setup(t);f.root.querySelector('.hy-bp-draw-wall').click();
  f.pointer(f.surface.querySelector('[data-bp-handle="wall:left"]'),'pointerdown',148,444); // -.083m, on thick boundary
  f.pointer(f.surface,'pointermove',296,444);f.pointer(f.surface,'pointerup',296,444);
  assert.equal(f.room().blueprintPlan.width,12);assert.equal(f.room().blueprintPlan.partitions[0].start,0);assert.equal(f.room().blueprintPlan.partitions[0].end,3);
});

test('a short partition can receive the minimum 1.2 metre door',t=>{
  const f=setup(t),p=defaultBlueprintPlan('medium');p.partitions=[{id:'short',axis:'x',at:3,start:1,end:2.6}];
  f.editor.render({...f.room(),blueprintPlan:p},true);f.change('.hy-bp-target','partition:short:move');f.root.querySelector('.hy-bp-add-inner-door').click();
  assert.equal(f.commits.at(-1).partitions[0].door.width,1.2);
});

test('room connection probe finds free floor when the area centre contains furniture',t=>{
  const f=setup(t),p=defaultBlueprintPlan('medium');p.areas=[{id:'lounge',type:'rest',name:'พัก',x:.2,z:.2,width:2.6,depth:3.4},{id:'work',type:'work',name:'งาน',x:3.5,z:5.8,width:8.3,depth:2}];
  f.editor.render({...f.room(),blueprintPlan:p},true);let tested;f.editor.interior.onTest=points=>{tested=points;return {ok:true,message:'walking'};};f.root.querySelector('.hy-bp-test-rooms').click();
  assert.ok(tested?.length>=2,'probe chooses reachable free points inside the named rooms');
});

test('drawing a second room keeps its new type and name instead of copying selected room fields',t=>{
  const f=setup(t),p=defaultBlueprintPlan('medium');p.areas=[{id:'area-1',type:'meeting',name:'ประชุม',x:.5,z:.5,width:2,depth:2}];
  f.editor.render({...f.room(),blueprintPlan:p},true);f.change('.hy-bp-target','area:area-1:move');
  f.root.querySelector('.hy-bp-area-type').value='rest';f.root.querySelector('.hy-bp-area-name').value='พัก';f.root.querySelector('.hy-bp-draw-area').click();
  f.pointer(f.surface.querySelector('svg'),'pointerdown',176,444);f.pointer(f.surface,'pointermove',272,540);f.pointer(f.surface,'pointerup',272,540);
  assert.equal(f.commits.at(-1).areas[1].type,'rest');assert.equal(f.commits.at(-1).areas[1].name,'พัก');
});

test('coincident room anchors report overlap without starting a zero-length probe',t=>{
  const f=setup(t),p=defaultBlueprintPlan('medium');p.areas=['a','b'].map(id=>({id,type:'work',name:id,x:3,z:6,width:2,depth:1.5}));
  f.editor.render({...f.room(),blueprintPlan:p},true);let called=false;f.editor.interior.onTest=()=>{called=true;};f.root.querySelector('.hy-bp-test-rooms').click();
  assert.equal(called,false);assert.match(f.root.querySelector('.hy-bp-edit-status').textContent,/ทับกัน/);
});

test('selected-door button toggles external and internal state with Undo-owner commits',t=>{
  const f=setup(t),p=defaultBlueprintPlan('medium');p.partitions=[{id:'p',axis:'z',at:3,start:0,end:8,door:{offset:4,width:1.4}}];
  f.editor.render({...f.room(),blueprintPlan:p},true);f.change('.hy-bp-target','door');f.root.querySelector('.hy-bp-toggle-door').click();assert.equal(f.commits.at(-1).door.open,false);
  f.change('.hy-bp-target','partition:p:move');f.root.querySelector('.hy-bp-toggle-door').click();assert.equal(f.commits.at(-1).partitions[0].door.open,false);
  f.change('.hy-bp-target','window:window-1');assert.equal(f.root.querySelector('.hy-bp-toggle-door').disabled,true);
});
