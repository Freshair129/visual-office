import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {sceneWorkspaceContext} from '../web/scene-workspace-actions.js';
import {HybridScene} from '../web/hybrid-scene.js';

test('scene context uses exact current floor slots, never appearance or copied IDs',()=>{
 const floor={key:'projects',label:'Projects',roles:[{}]},roster=[{name:'Atlas',role:'Lead',sourceAgentId:null}];
 for(const suffix of ['avatar','desk','chair']){
  const context=sceneWorkspaceContext({id:`role-1-${suffix}`,appearance:'zuri'},floor,roster,{allowed:true,kind:'synthetic'});
  assert.equal(context.agent.name,'Atlas');assert.equal(context.bound,false);
 }
 for(const id of ['role-1-avatar-copy','role-0-desk','role-99-desk','custom-desk'])assert.equal(sceneWorkspaceContext({id},floor,roster,{}).agent,null);
 roster[0]={...roster[0],sourceAgentId:'mira',connected:true};
 assert.equal(sceneWorkspaceContext({id:'role-1-avatar'},floor,roster,{allowed:true,kind:'synthetic'}).bound,true);
 assert.equal(sceneWorkspaceContext({id:'role-1-avatar'},floor,roster,{allowed:false}).bound,false);
});

test('character and desk expose workspace actions separately and close before navigating',t=>{
 const dom=new JSDOM('<main></main>');t.after(()=>dom.window.close());
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const root=dom.window.document.querySelector('main'),calls=[];
 const scene=new HybridScene(root,{getObjectWorkspace:o=>({heading:'Project Lead',note:'ยังไม่ผูก Agent',actions:[{label:'เปิดแชททีม · เลือกผู้รับ',run:()=>calls.push([o.id,!!root.querySelector('dialog[open]')])}]})});t.after(()=>scene.dispose());
 scene.room={objects:[{id:'role-1-avatar',kind:'avatar-04'},{id:'role-1-desk',kind:'work-desk'}]};
 scene.activate('role-1-avatar');assert.match(root.textContent,/ยังไม่ผูก Agent/);assert.match(root.textContent,/กิจกรรมภาพจำลอง/);
 root.querySelector('[data-workspace-action]').click();assert.deepEqual(calls,[['role-1-avatar',false]]);
 // Even a WebGL fallback can expose business shortcuts; it cannot claim a seat path.
 scene.activate('role-1-desk');assert.ok(root.querySelector('[data-workspace-action]'));assert.equal(root.querySelector('[data-use-station]')?.disabled,true);
});
