import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {defaults} from '../web/studio-state.js';

const require=createRequire(import.meta.url);
const output=await build({entryPoints:['web/studio-scene.js'],bundle:true,write:false,format:'esm',platform:'browser',plugins:[{
  name:'studio-renderer-fixture',setup(b){
    b.onResolve({filter:/^threeReal$/},()=>({path:require.resolve('three'),namespace:'file'}));
    b.onResolve({filter:/^three$/},()=>({path:'three',namespace:'studio-test'}));
    b.onResolve({filter:/^three\/addons\/controls\/OrbitControls.js$/},()=>({path:'controls',namespace:'studio-test'}));
    b.onLoad({filter:/.*/,namespace:'studio-test'},({path})=>({loader:'js',contents:path==='three'?`
      export * from 'threeReal';
      export class WebGLRenderer {
        constructor(){this.domElement=document.createElement('canvas');this.shadowMap={};this.info={render:{triangles:0,calls:0},memory:{geometries:0}};globalThis.studioFixture.renderer=this;}
        setPixelRatio(){} setSize(){} render(){globalThis.studioFixture.renders++;}
        dispose(){globalThis.studioFixture.disposals++;} forceContextLoss(){globalThis.studioFixture.contextLosses++;}
      }`:`import {Vector3} from 'threeReal';
      export class OrbitControls {
        constructor(){this.target=new Vector3();this.listeners=new Map();globalThis.studioFixture.controls=this;}
        update(){} addEventListener(k,fn){this.listeners.set(k,fn);} removeEventListener(k){this.listeners.delete(k);}
        dispose(){globalThis.studioFixture.controlDisposals++;}
      }`}));
  }
}]});
const {StudioScene}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));

function fixture(t){
  const dom=new JSDOM('<div id="room"></div>',{pretendToBeVisual:true});
  const keys=['document','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','studioFixture'];
  const saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
  const state={renders:0,disposals:0,contextLosses:0,controlDisposals:0,frames:new Map(),next:0,disconnects:0};
  globalThis.studioFixture=state;globalThis.document=dom.window.document;
  globalThis.ResizeObserver=class{constructor(fn){state.resize=fn;}observe(){}disconnect(){state.disconnects++;}};
  globalThis.requestAnimationFrame=fn=>{state.frames.set(++state.next,fn);return state.next;};
  globalThis.cancelAnimationFrame=id=>state.frames.delete(id);
  const root=document.querySelector('#room');root.getBoundingClientRect=()=>({width:800,height:600});
  state.flush=()=>{const frames=[...state.frames.values()];state.frames.clear();frames.forEach(fn=>fn());};
  t.after(()=>{keys.forEach(k=>{if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k];});dom.window.close();});
  return {state,root,dom};
}
test('scene renders on demand, releases replaced models and cancels all work on exit',t=>{
  const {state,root,dom}=fixture(t);const scene=new StudioScene(root);scene.setState(defaults());state.flush();
  assert.equal(state.renders,1);assert.equal(state.frames.size,0);
  const resources=[];
  scene.content.traverse(n=>{for(const r of [n.geometry,n.material].filter(Boolean)){r.disposes=0;r.addEventListener('dispose',()=>r.disposes++);resources.push(r);}});
  scene.setState({...defaults(),room:'signature',wing:true});assert.ok(resources.every(r=>r.disposes===1));state.flush();
  const live=[];scene.content.traverse(n=>{for(const r of [n.geometry,n.material].filter(Boolean)){r.disposes=0;r.addEventListener('dispose',()=>r.disposes++);live.push(r);}});
  scene.rotate();const stale=[...state.frames.values()];const count=state.renders;
  scene.dispose();scene.dispose();stale.forEach(fn=>fn());state.resize();dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(state.renders,count);assert.equal(state.frames.size,0);assert.equal(state.disconnects,1);
  assert.equal(state.disposals,1);assert.equal(state.contextLosses,1);assert.equal(state.controlDisposals,1);assert.equal(state.controls.listeners.size,0);
  assert.equal(root.children.length,0);assert.ok(live.every(r=>r.disposes===1));
});
test('hidden pages stop scheduled work and WebGL loss invokes the text fallback',t=>{
  const {state,root,dom}=fixture(t);let losses=0;
  const scene=new StudioScene(root,{onUnavailable:()=>losses++});scene.setState(defaults());
  Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(state.frames.size,0);scene.invalidate();assert.equal(state.frames.size,0);
  Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new dom.window.Event('visibilitychange'));
  state.flush();assert.equal(state.renders,1);
  state.renderer.domElement.dispatchEvent(new dom.window.Event('webglcontextlost',{cancelable:true}));
  scene.invalidate();assert.equal(losses,1);assert.equal(state.frames.size,0);scene.dispose();
});
