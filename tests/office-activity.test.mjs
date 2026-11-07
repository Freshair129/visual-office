import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {sampleOfficeActivity} from '../web/office-activity.js';
import {departmentStarterRoom,parseRoomJSON,catalog,backgrounds} from '../web/hybrid-state.js';
import {domainFloors} from '../web/domain-office.js';
import {HybridScene} from '../web/hybrid-scene.js';

const room=()=>departmentStarterRoom(domainFloors.find(d=>d.key==='projects'));
test('department floors use a work office, distinct from preserved reception assets',()=>{
  const r=room();assert.equal(r.background,'office');
  assert.equal(r.objects.filter(o=>o.kind==='work-desk').length,4);
  assert.equal(r.objects.filter(o=>o.kind==='task-chair').length,4);
  assert.ok(r.objects.some(o=>o.kind==='whiteboard'));
  assert.ok(r.objects.some(o=>o.kind==='water-cooler'));
  assert.equal(r.objects.some(o=>o.kind==='printer'),false);
  assert.equal(r.objects.find(o=>o.id==='floor-lift').kind,'wayfinding-arrow');
  assert.equal(r.objects.find(o=>o.id==='floor-board').interaction.type,'tasks');
  assert.notEqual(catalog['work-desk'].src,catalog.desk.src);
  assert.ok(backgrounds.office);assert.deepEqual(parseRoomJSON(JSON.stringify(r)),r);
});
test('fallback characters stay quiet and unknown without modifying saved scene state',()=>{
  const r=room(),o=r.objects.find(o=>o.kind.startsWith('avatar-')),before=JSON.stringify(r);
  const phases=new Set(),positions=new Set();
  for(let t=0;t<36000;t+=250){const p=sampleOfficeActivity(r,o,0,t);phases.add(p.action);positions.add(`${p.x},${p.y}`);assert.ok(p.x>=8&&p.x<=92);assert.ok(p.y>=18&&p.y<=94);assert.match(p.thought,/จำลอง/);}
  assert.deepEqual([...phases],['sitting']);assert.equal(positions.size,1);assert.match(sampleOfficeActivity(r,o,0,0).thought,/ไม่ทราบสถานะ/);
  assert.equal(JSON.stringify(r),before);
  assert.equal(sampleOfficeActivity(r,o,0,18000,{reduced:true}).action,'sitting');
});
test('catalog-added avatars can sit near a work desk without a role-pattern ID',()=>{
  const r=room(),desk=r.objects.find(o=>o.kind==='work-desk'),o={id:'studio-new-avatar',kind:'avatar-01',x:desk.x+3,y:desk.y-7,scale:1,flip:false,locked:false};
  r.objects.push(o);const before=JSON.stringify(r);
  assert.equal(sampleOfficeActivity(r,o,0,0,{mode:'seated'}).action,'seated');assert.equal(JSON.stringify(r),before);
  const unpaired={...o,id:'room-generated-123'};assert.equal(sampleOfficeActivity(r,unpaired,0,0,{mode:'seated'}).action,'seated');
  assert.equal(sampleOfficeActivity({objects:[unpaired]},unpaired,0,0,{mode:'seated'}).action,'idle');
});
test('atlas hit testing passes through transparent parts of a character to furniture',()=>{
  const dom=new JSDOM('<main></main>'),scene=new HybridScene(dom.window.document.querySelector('main')),r=room();scene.render(r,null,true);
  const actor=scene.root.querySelector('[data-kind^="avatar-"]'),desk=scene.root.querySelector('[data-kind="work-desk"]');
  const rect={left:0,top:0,right:100,bottom:100,width:100,height:100};
  for(const el of [actor,desk,actor.querySelector('.hy-sprite-art')])el.getBoundingClientRect=()=>rect;
  actor.style.zIndex='999';desk.style.zIndex='900';
  scene.alpha.set(actor.querySelector('img').src,new Uint8ClampedArray(128*128*4));scene.alpha.set(desk.querySelector('img').src,new Uint8ClampedArray(128*128*4).fill(255));
  assert.equal(scene.pick({clientX:50,clientY:50},actor),desk);
  scene.alpha.set(actor.querySelector('img').src,new Uint8ClampedArray(128*128*4).fill(255));assert.equal(scene.pick({clientX:50,clientY:50},desk),actor);
  const lateLoad=actor.querySelector('img').onload;scene.dispose();assert.doesNotThrow(()=>lateLoad());dom.window.close();
});
test('Play exposes character activity and pause controls; editing and dispose stop scheduling',()=>{
  const dom=new JSDOM('<main></main>'),win=dom.window,pending=new Map();let next=0;
  win.requestAnimationFrame=fn=>{pending.set(++next,fn);return next;};win.cancelAnimationFrame=id=>pending.delete(id);
  const scene=new HybridScene(win.document.querySelector('main'),{editable:true}),r=room();
  scene.render(r,null,false);assert.equal(pending.size,0);
  scene.render(r,null,true);assert.equal(pending.size,1);
  assert.match(scene.root.querySelector('.hy-activity-hud').textContent,/จำลอง/);
  const actor=scene.root.querySelector('[data-kind^="avatar-"]');assert.ok(actor.querySelector('.hy-thought').textContent);
  const pause=scene.root.querySelector('.hy-motion-toggle');pause.click();assert.equal(pending.size,0);assert.equal(pause.getAttribute('aria-pressed'),'true');
  pause.click();assert.equal(pending.size,1);
  scene.render(r,null,false);assert.equal(pending.size,0);assert.equal(actor.querySelector('.hy-thought').hidden,true);
  scene.render(r,null,true);scene.dispose();assert.equal(pending.size,0);dom.window.close();
});
test('character action controls are local, reduced motion is static, and hidden scenes stop scheduling',()=>{
  const dom=new JSDOM('<main></main>'),win=dom.window,pending=new Map();let next=0,reduced=false,visibility='visible';
  win.matchMedia=()=>({get matches(){return reduced;},addEventListener(){},removeEventListener(){}});
  win.requestAnimationFrame=fn=>{pending.set(++next,fn);return next;};win.cancelAnimationFrame=id=>pending.delete(id);
  Object.defineProperty(win.document,'visibilityState',{get:()=>visibility});
  win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};win.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const scene=new HybridScene(win.document.querySelector('main')),r=room(),before=JSON.stringify(r),o=r.objects.find(o=>o.kind.startsWith('avatar-'));
  scene.render(r,null,true);scene.activate(o.id);
  const walk=[...scene.popup.querySelectorAll('button')].find(b=>b.textContent==='เดินในสำนักงาน');assert.equal(walk.disabled,true);
  [...scene.popup.querySelectorAll('button')].find(b=>b.textContent==='ท่าครุ่นคิด').click();
  assert.equal(scene.root.querySelector(`[data-object="${o.id}"]`).dataset.activity,'thinking');assert.equal(JSON.stringify(r),before);
  visibility='hidden';win.document.dispatchEvent(new win.Event('visibilitychange'));assert.equal(pending.size,0);
  visibility='visible';win.document.dispatchEvent(new win.Event('visibilitychange'));assert.equal(pending.size,1);
  reduced=true;scene.preferenceChanged();assert.equal(pending.size,0);
  assert.equal(scene.root.querySelector(`[data-object="${o.id}"]`).dataset.activity,'sitting');
  scene.dispose();dom.window.close();
});
